import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";

const INVOICE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The unique invoice number extracted exactly as it appears on the document. Do not strip prefixes, suffixes, special characters, or leading zeros. Capture the full literal string." },
      vendor_name: { type: Type.STRING, description: "Name of the vendor/seller." },
      gst_number: { type: Type.STRING, description: "GSTIN or tax ID of the vendor." },
      pmc_consultant_gst: { type: Type.STRING, description: "The GSTIN/tax ID specifically labeled for a PMC (Project Management Consultant) or secondary consultant, if present." },
      reverse_charge: { type: Type.STRING, description: "Indicates if reverse charge is applicable. Return 'yes' or 'no'." },
      hsn_code: { type: Type.STRING, description: "HSN or SAC code found in line items. If not explicitly stated for an invoice, leave as an empty string." },
      invoice_type: { type: Type.STRING, description: "Document type (e.g., tax invoice, e-invoice, credit note)." },
      has_signature: { type: Type.STRING, description: "Return 'yes' if there is a handwritten signature, stamp, or digital signature (e.g., 'digitally signed by', 'ds', digital certificate markers, or signature QR codes). Otherwise 'no'." },
      invoice_date: { type: Type.STRING, description: "Date of invoice in YYYY-MM-DD format." },
      taxable_amount: { type: Type.NUMBER, description: "Taxable amount, often labeled as 'base amount', 'subtotal', or 'value of supply' before tax." },
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
                `Expected Inv: ${inv.invoiceNumber}, Date: ${inv.invoiceDate}, Base/Taxable: ${inv.taxableAmount}, Total: ${inv.totalAmount}, CGST: ${inv.cgstAmount || 0}, SGST: ${inv.sgstAmount || 0}, IGST: ${inv.igstAmount || 0}`
            ).join('\n');
    }

    const prompt = `
      You are a high-precision financial auditor. The PDF contains multiple invoices.
      
      ${excelRefText}

      Instructions:
      1. Extract All: Find every invoice in the PDF.
      2. Exact Invoice Number: Capture the invoice ID literal string exactly.
      3. Digital Signatures: Mark 'has_signature' as 'yes' if you see handwritten signatures, physical stamps, or digital signatures (text like "digitally signed by", "DS", or QR code signatures).
      4. Taxable Amount: Identify the 'Taxable Amount' which is also often called 'Base Amount' or 'Gross Amount (excluding tax)'. It is the sum of items before GST.
      5. HSN Code: Only extract HSN/SAC codes if they are explicitly printed on the document. If they are not present, return an empty string. Do not invent or guess HSN codes.
      6. Precision: Ensure no numbers are skipped. If you are comparing against reference data, ensure your extraction is as accurate as possible.
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
        thinkingConfig: { thinkingBudget: 2048 }
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
      invoiceDate: item.invoice_date || "",
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