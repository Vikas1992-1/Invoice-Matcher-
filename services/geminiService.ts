import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";
import { formatDateToDisplay } from "./excelService";

const INVOICE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The unique invoice number extracted exactly as it appears on the document." },
      vendor_name: { type: Type.STRING, description: "Name of the vendor/seller." },
      gst_number: { type: Type.STRING, description: "GSTIN or tax ID of the vendor/seller." },
      pmc_consultant_gst: { type: Type.STRING, description: "The GSTIN/tax ID belonging to 'PMC Consultants Private Limited' or 'PMC Consultants Pvt Ltd'. IMPORTANT: ONLY extract this if it is explicitly printed on the pages of THIS specific invoice. If it is missing on these pages, return an empty string. DO NOT use a GST number found on other invoices in the same file." },
      reverse_charge: { type: Type.STRING, description: "Indicates if reverse charge is applicable. Return 'yes' or 'no'." },
      hsn_code: { type: Type.STRING, description: "HSN or SAC code found in line items." },
      invoice_type: { type: Type.STRING, description: "Document type (e.g., tax invoice, e-invoice, credit note)." },
      has_signature: { type: Type.STRING, description: "Return 'yes' if there is a signature or digital stamp, otherwise 'no'." },
      invoice_date: { type: Type.STRING, description: "Date of invoice in DD-MM-YYYY format." },
      taxable_amount: { type: Type.NUMBER, description: "Taxable amount before tax." },
      cgst_amount: { type: Type.NUMBER, description: "Central GST amount." },
      sgst_amount: { type: Type.NUMBER, description: "State GST amount." },
      igst_amount: { type: Type.NUMBER, description: "Integrated GST amount." },
      gst_amount: { type: Type.NUMBER, description: "Total tax (sum of CGST, SGST, IGST)." },
      total_amount: { type: Type.NUMBER, description: "Final total amount including tax." },
      page_start: { type: Type.INTEGER, description: "1-based start page." },
      page_end: { type: Type.INTEGER, description: "1-based end page." }
    },
    required: ["invoice_number", "total_amount", "page_start", "page_end"]
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const processPdfWithGemini = async (pdfFile: File, excelReference?: InvoiceData[]): Promise<InvoiceData[]> => {
  try {
    const base64Data = await fileToBase64(pdfFile);
    
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing from environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let excelRefText = "";
    if (excelReference && excelReference.length > 0) {
        excelRefText = "Reference Excel Data (Ground Truth for Comparison):\n" + 
            excelReference.map(inv => 
                `Expected Inv: ${inv.invoiceNumber}, Date: ${inv.invoiceDate}, Base/Taxable: ${inv.taxableAmount}, Total: ${inv.totalAmount}`
            ).join('\n');
    }

    const prompt = `
      You are a high-precision financial auditor performing a strict audit. The PDF contains multiple invoices.
      
      ${excelRefText}

      STRICT EXTRACTION PROTOCOL:
      1. INDEPENDENT VERIFICATION: Treat every invoice (and its set of pages) as a completely separate document. 
      2. PMC GST STRICTURE: 
         - Look for the company name: 'PMC Consultants Private Limited' or 'PMC Consultants Pvt Ltd'.
         - If the company name is found on the current invoice pages, look for its specific 15-digit GSTIN.
         - CRITICAL: If the GSTIN for PMC is NOT explicitly printed on the specific pages of the invoice you are currently extracting, you MUST return an empty string for 'pmc_consultant_gst'. 
         -hallucination warning: DO NOT reuse a PMC GST number found earlier in the PDF if it is missing on the current page (e.g., check Meena Traders invoice carefully; if GST is blank there, return empty string).
      3. EXACT MATCHING: Capture invoice numbers exactly as printed.
      4. DIGITAL SIGNATURES: Check for "Digitally signed by", QR codes, or physical stamps.
      5. DATE FORMAT: Standardize to DD-MM-YYYY.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_SCHEMA,
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const rawText = response.text || "[]";
    const parsedData = JSON.parse(rawText);

    return parsedData.map((item: any) => ({
      vendorName: item.vendor_name || "Unknown",
      gstNumber: item.gst_number || "",
      pmcConsultantGst: item.pmc_consultant_gst || "",
      reverseCharge: item.reverse_charge || "no",
      hsnCode: item.hsn_code || "",
      invoiceType: item.invoice_type || "Tax Invoice",
      hasSignature: item.has_signature || "no",
      invoiceNumber: item.invoice_number || "Unknown",
      invoiceDate: formatDateToDisplay(item.invoice_date || ""),
      taxableAmount: item.taxable_amount || 0,
      gstAmount: item.gst_amount || 0,
      cgstAmount: item.cgst_amount || 0,
      sgstAmount: item.sgst_amount || 0,
      igstAmount: item.igst_amount || 0,
      totalAmount: item.total_amount || 0,
      pageRange: {
        start: item.page_start || 1,
        end: item.page_end || item.page_start || 1
      }
    }));

  } catch (error) {
    console.error("Error processing PDF with Gemini:", error);
    throw error;
  }
};