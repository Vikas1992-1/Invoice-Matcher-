import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";

const INVOICE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The unique invoice number extracted EXACTLY as it appears on the document. Do not strip prefixes (like 'INV'), suffixes, special characters (like '/'), or leading zeros. Capture the full string." },
      vendor_name: { type: Type.STRING, description: "Name of the vendor/seller." },
      gst_number: { type: Type.STRING, description: "GSTIN or Tax ID of the vendor." },
      pmc_consultant_gst: { type: Type.STRING, description: "The GSTIN/Tax ID specifically labeled for a PMC (Project Management Consultant) or secondary consultant, if present." },
      reverse_charge: { type: Type.STRING, description: "Indicates if reverse charge is applicable. Look for 'Reverse Charge: Yes/No', 'Tax Payable on Reverse Charge', or similar indicators. Return 'Yes' if applicable, otherwise 'No'." },
      hsn_code: { type: Type.STRING, description: "HSN or SAC code found in the invoice line items. If multiple are present, list them separated by commas." },
      invoice_type: { type: Type.STRING, description: "The document type declared on the page. Examples: 'Tax Invoice', 'E-Invoice', 'Bill of Supply', 'Credit Note', 'Debit Note', 'Cash Memo', 'Delivery Challan'. If not explicitly stated, infer 'Tax Invoice'." },
      has_signature: { type: Type.STRING, description: "Indicates if the invoice is signed. Return 'Yes' if there is a handwritten signature, an official stamp, OR a digital signature (e.g. 'Digitally Signed by', 'DS', digital certificates, or QR code signatures). Otherwise return 'No'." },
      invoice_date: { type: Type.STRING, description: "Date of invoice in YYYY-MM-DD format." },
      taxable_amount: { type: Type.NUMBER, description: "The base amount before tax." },
      cgst_amount: { type: Type.NUMBER, description: "Central Goods and Services Tax amount. Return 0 if not present." },
      sgst_amount: { type: Type.NUMBER, description: "State Goods and Services Tax amount. Return 0 if not present." },
      igst_amount: { type: Type.NUMBER, description: "Integrated Goods and Services Tax amount. Return 0 if not present." },
      gst_amount: { type: Type.NUMBER, description: "The total tax/GST amount (Sum of CGST, SGST, and IGST)." },
      total_amount: { type: Type.NUMBER, description: "The final total invoice amount including tax." },
      page_start: { type: Type.INTEGER, description: "The page number (1-based index) where this invoice STARTS in the PDF file." },
      page_end: { type: Type.INTEGER, description: "The page number (1-based index) where this invoice ENDS." }
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

export const processPdfWithGemini = async (pdfFile: File): Promise<InvoiceData[]> => {
  try {
    const base64Data = await fileToBase64(pdfFile);
    
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing from environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      You are a specialized data extraction AI for auditing financial documents. The attached PDF contains MULTIPLE DISTINCT INVOICES.
      
      Your Goal: Extract structured data for EVERY SINGLE invoice found in the document with 100% precision.
      
      CRITICAL EXTRACTION RULES:
      1. SCAN ALL PAGES: Look at every corner of every page. Do not miss any invoice.
      2. EXACT INVOICE NUMBER: Extract the invoice number EXACTLY as printed. If it says "INV/00123/24", you MUST return "INV/00123/24". Do not shorten, do not remove zeros.
      3. DIGITAL SIGNATURE DETECTION: Look specifically for digital signatures. Phrases like "Digitally Signed by", "DS [Name]", "Signed by...", or visible digital certificate boxes and QR codes representing signatures MUST be marked as 'Yes' in the 'has_signature' field.
      4. PAGE TRACKING: Accurately record 'page_start' and 'page_end' for each document.
      5. TAX COMPONENTS: Extract CGST, SGST, and IGST separately. If one is zero or not mentioned, return 0.
      
      SELF-VERIFICATION STEP (RECHECK MISMASH DATA):
      - After your initial extraction, RE-READ the image specifically for the Invoice Number and Total Amount.
      - If you see any ambiguity (e.g., '8' looking like 'B' or '0' looking like 'O'), verify with surrounding context.
      - Ensure the sum of (Taxable Amount + CGST + SGST + IGST) equals the Total Amount. If it doesn't, re-extract the values carefully.
      
      Ensure you capture all details: PMC Consultant GST, Reverse Charge, HSN Codes, and Invoice Type.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
        // Increased thinking budget to allow for the self-verification step
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });

    const rawText = response.text || "[]";
    const parsedData = JSON.parse(rawText);

    const mappedData: InvoiceData[] = parsedData.map((item: any) => ({
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

    return mappedData;

  } catch (error) {
    console.error("Error processing PDF with Gemini:", error);
    throw error;
  }
};