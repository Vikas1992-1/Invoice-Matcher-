import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";

const INVOICE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The unique invoice number extracted EXACTLY as it appears on the document. Do not strip prefixes, suffixes, special characters, or leading zeros. Capture the full literal string." },
      vendor_name: { type: Type.STRING, description: "Name of the vendor/seller." },
      gst_number: { type: Type.STRING, description: "GSTIN or Tax ID of the vendor." },
      pmc_consultant_gst: { type: Type.STRING, description: "The GSTIN/Tax ID specifically labeled for a PMC (Project Management Consultant) or secondary consultant, if present." },
      reverse_charge: { type: Type.STRING, description: "Indicates if reverse charge is applicable. Return 'Yes' or 'No'." },
      hsn_code: { type: Type.STRING, description: "HSN or SAC code found in line items." },
      invoice_type: { type: Type.STRING, description: "Document type (e.g., Tax Invoice, E-Invoice, Credit Note)." },
      has_signature: { type: Type.STRING, description: "Return 'Yes' if there is a handwritten signature, stamp, OR digital signature (e.g., 'Digitally Signed by', 'DS', digital certificate markers, or signature QR codes). Otherwise 'No'." },
      invoice_date: { type: Type.STRING, description: "Date of invoice in YYYY-MM-DD format." },
      taxable_amount: { type: Type.NUMBER, description: "Taxable amount, often labeled as 'Base Amount', 'Subtotal', or 'Value of Supply' before tax." },
      cgst_amount: { type: Type.NUMBER, description: "Central GST amount." },
      sgst_amount: { type: Type.NUMBER, description: "State GST amount." },
      igst_amount: { type: Type.NUMBER, description: "Integrated GST amount." },
      gst_amount: { type: Type.NUMBER, description: "Total tax (Sum of CGST, SGST, IGST)." },
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

export const processPdfWithGemini = async (pdfFile: File, excelReference: InvoiceData[]): Promise<InvoiceData[]> => {
  try {
    const base64Data = await fileToBase64(pdfFile);
    
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing from environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Format Excel data into a compact reference for Gemini to cross-check
    const excelRefText = excelReference.map(inv => 
        `Expected Inv: ${inv.invoiceNumber}, Date: ${inv.invoiceDate}, Base/Taxable: ${inv.taxableAmount}, Total: ${inv.totalAmount}, CGST: ${inv.cgstAmount || 0}, SGST: ${inv.sgstAmount || 0}, IGST: ${inv.igstAmount || 0}`
    ).join('\n');

    const prompt = `
      You are a high-precision financial auditor. The PDF contains multiple invoices.
      
      REFERENCE EXCEL DATA (Ground Truth for comparison):
      ${excelRefText}

      INSTRUCTIONS:
      1. EXTRACT ALL: Find every invoice in the PDF.
      2. EXACT INVOICE NUMBER: Capture the invoice ID literal string exactly.
      3. DIGITAL SIGNATURES: Mark 'has_signature' as 'Yes' if you see handwritten signatures, physical stamps, or DIGITAL signatures (text like "Digitally Signed by", "DS", or QR code signatures).
      4. TAXABLE AMOUNT: Identify the 'Taxable Amount' which is also often called 'Base Amount' or 'Gross Amount (excluding tax)'. It is the sum of items before GST.
      5. RECHECK MISMASH DATA: 
         - Compare your extracted data against the REFERENCE EXCEL DATA. 
         - If extracted 'Taxable Amount' (Base Amount) or 'Total Amount' differs from reference, RE-READ carefully.
         - Pay special attention to tax components (CGST, SGST, IGST).
      6. PRECISION: Ensure no numbers are skipped.
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
      reverseCharge: item.reverse_charge || "No",
      hsnCode: item.hsn_code || "",
      invoiceType: item.invoice_type || "Tax Invoice",
      hasSignature: item.has_signature || "No",
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