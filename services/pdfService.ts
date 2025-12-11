import { PDFDocument } from 'pdf-lib';
import { InvoiceComparisonResult } from '../types';

export const createSortedPdf = async (originalPdfFile: File, results: InvoiceComparisonResult[]): Promise<Uint8Array> => {
  try {
    const originalPdfBytes = await originalPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const newPdfDoc = await PDFDocument.create();

    const totalPages = pdfDoc.getPageCount();

    // Iterate through results in the order of the Excel file
    for (const result of results) {
      // Only process if we have a match or a mismatch found in PDF
      // If it's MISSING_IN_PDF, we can't include it.
      if (result.extractedData && result.extractedData.pageRange) {
        const { start, end } = result.extractedData.pageRange;
        
        // Validate page numbers
        if (start > 0 && start <= totalPages) {
           // pdf-lib is 0-indexed, our data is 1-indexed
           const startIdx = start - 1;
           const endIdx = end ? Math.min(end, totalPages) - 1 : startIdx;

           // Copy pages for this invoice
           // Create an array of indices to copy
           const pageIndices = [];
           for (let i = startIdx; i <= endIdx; i++) {
             pageIndices.push(i);
           }

           if (pageIndices.length > 0) {
             const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
             copiedPages.forEach((page) => newPdfDoc.addPage(page));
           }
        }
      }
    }

    // Optional: Append 'Extra/Missing in Excel' invoices at the very end
    // (This part is optional based on user preference, but generally good to keep them somewhere)
    // For now, we strictly follow the Excel sequence as requested.

    const pdfBytes = await newPdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error("Error creating sorted PDF:", error);
    throw new Error("Failed to generate sorted PDF.");
  }
};
