import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";

const INVOICE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The unique invoice number (e.g., INV-001, 10234). Keep alphanumeric characters/hyphens. Do not strip leading zeros." },
      vendor_name: { type: Type.STRING, description: "Name of the vendor/seller." },
      gst_number: { type: Type.STRING, description: "GSTIN or Tax ID of the vendor." },
      pmc_consultant_gst: { type: Type.STRING, description: "The GSTIN/Tax ID specifically labeled for a PMC (Project Management Consultant) or secondary consultant, if present." },
      reverse_charge: { type: Type.STRING, description: "Indicates if reverse charge is applicable. Look for 'Reverse Charge: Yes/No', 'Tax Payable on Reverse Charge', or similar indicators. Return 'Yes' if applicable, otherwise 'No'." },
      hsn_code: { type: Type.STRING, description: "HSN or SAC code found in the invoice line items. If multiple are present, list them separated by commas." },
      invoice_date: { type: Type.STRING, description: "Date of invoice in YYYY-MM-DD format." },
      taxable_amount: { type: Type.NUMBER, description: "The base amount before tax." },
      gst_amount: { type: Type.NUMBER, description: "The total tax/GST amount." },
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
      // Remove Data URI prefix if present (e.g., "data:application/pdf;base64,")
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
    
    // Ensure API Key is available
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing from environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      You are a specialized data extraction AI. The attached PDF contains MULTIPLE DISTINCT INVOICES.
      
      Your Goal: Extract structured data for EVERY SINGLE invoice found in the document.
      
      CRITICAL INSTRUCTIONS:
      1. Scan the entire document from start to finish. Do not stop after the first invoice.
      2. If multiple invoices appear on a single page, extract them as separate entries with the same page numbers.
      3. If an invoice spans multiple pages, combine the data into one entry and record the start and end pages correctly.
      4. For the "Invoice Number", extract the ID exactly as printed.
      5. Standardize dates to YYYY-MM-DD.
      6. Return amounts as numbers.
      7. **IMPORTANT**: Identify the 'page_start' and 'page_end' (1-based) for each invoice based on its location in the file.
      8. Look specifically for a "PMC Consultant GST" or similar field if it exists and extract it.
      9. Look for "Reverse Charge" applicability (Yes/No).
      10. Look for "HSN Code" or "SAC Code" (typically 4-8 digits).
      
      Double check that you have captured ALL invoices in the file before finishing.
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
        // Add thinking budget to encourage thorough scanning of all pages
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    const rawText = response.text || "[]";
    const parsedData = JSON.parse(rawText);

    // Map Gemini response to our internal InvoiceData type
    const mappedData: InvoiceData[] = parsedData.map((item: any) => ({
      vendorName: item.vendor_name || "Unknown",
      gstNumber: item.gst_number || "",
      pmcConsultantGst: item.pmc_consultant_gst || "",
      reverseCharge: item.reverse_charge || "No",
      hsnCode: item.hsn_code || "",
      invoiceNumber: item.invoice_number || "Unknown",
      invoiceDate: item.invoice_date || "",
      taxableAmount: item.taxable_amount || 0,
      gstAmount: item.gst_amount || 0,
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