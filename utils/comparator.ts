import { InvoiceData, InvoiceComparisonResult, ComparisonField } from '../types';

// Helper to sanitize strings for loose comparison
const cleanString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

// Specialized helper for Invoice IDs to handle "00123" vs "123"
const normalizeInvoiceId = (id: string): string => {
    const cleaned = cleanString(id);
    // If it's purely numeric, parse it to remove leading zeros for comparison
    // e.g. "00123" -> "123", "123" -> "123"
    if (/^\d+$/.test(cleaned)) {
        return parseInt(cleaned, 10).toString();
    }
    return cleaned;
};

// Helper to compare numbers with a small epsilon for floating point errors
// Tolerates a difference of up to 1.0 (inclusive) to handle rounding issues as requested
const compareNumbers = (num1: number, num2: number, epsilon = 1.0): boolean => {
  return Math.abs(num1 - num2) <= epsilon;
};

// Normalize date strings for comparison
const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    // Basic attempt to handle DD-MM-YYYY vs YYYY-MM-DD or DD/MM/YYYY
    const clean = dateStr.replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length === 3) {
        // If year is last (DD-MM-YYYY)
        if (parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return clean;
};

export const compareInvoices = (excelData: InvoiceData[], pdfData: InvoiceData[]): InvoiceComparisonResult[] => {
  // We use a multi-pass approach to ensure the best matches are claimed first.
  // Result array matches the indices of excelData.
  const results = new Array<InvoiceComparisonResult | null>(excelData.length).fill(null);
  
  // Track which PDF invoices have been matched to avoid duplicates
  const matchedPdfIndices = new Set<number>();

  // Helper to check if two IDs match using our normalization logic
  const isIdMatch = (id1: string, id2: string) => {
      const n1 = normalizeInvoiceId(id1);
      const n2 = normalizeInvoiceId(id2);
      if (n1 === n2) return true;
      
      // Fallback: Check if one raw cleaned ID contains the other (for cases like "INV123" vs "123")
      // Only do this if the contained string is at least 3 chars to avoid matching "1" to "11"
      const c1 = cleanString(id1);
      const c2 = cleanString(id2);
      if (c1.length > 2 && c2.includes(c1)) return true;
      if (c2.length > 2 && c1.includes(c2)) return true;
      
      return false;
  };

  // Helper to build the Comparison Result object
  const buildResult = (excelInv: InvoiceData, pdfInv: InvoiceData, matchMethod: string): InvoiceComparisonResult => {
    const fields: ComparisonField[] = [
      {
        fieldName: 'vendorName',
        label: 'Vendor Name',
        excelValue: excelInv.vendorName,
        pdfValue: pdfInv.vendorName,
        isMatch: cleanString(excelInv.vendorName) === cleanString(pdfInv.vendorName) 
                 || cleanString(excelInv.vendorName).includes(cleanString(pdfInv.vendorName))
                 || cleanString(pdfInv.vendorName).includes(cleanString(excelInv.vendorName))
      },
      {
        fieldName: 'gstNumber',
        label: 'GST Number',
        excelValue: excelInv.gstNumber,
        pdfValue: pdfInv.gstNumber,
        isMatch: cleanString(excelInv.gstNumber) === cleanString(pdfInv.gstNumber)
      },
      {
        fieldName: 'invoiceNumber',
        label: 'Invoice Number',
        excelValue: excelInv.invoiceNumber,
        pdfValue: pdfInv.invoiceNumber,
        isMatch: isIdMatch(excelInv.invoiceNumber, pdfInv.invoiceNumber)
      },
      {
        fieldName: 'invoiceDate',
        label: 'Invoice Date',
        excelValue: excelInv.invoiceDate,
        pdfValue: pdfInv.invoiceDate,
        isMatch: normalizeDate(excelInv.invoiceDate) === normalizeDate(pdfInv.invoiceDate)
      },
      {
        fieldName: 'taxableAmount',
        label: 'Taxable Amount',
        excelValue: excelInv.taxableAmount,
        pdfValue: pdfInv.taxableAmount,
        isMatch: compareNumbers(excelInv.taxableAmount, pdfInv.taxableAmount)
      },
      // Individual Tax components comparison
      // Explicitly setting tolerance to 1.0 to allow difference <= 1.0
      {
        fieldName: 'cgstAmount',
        label: 'CGST',
        excelValue: excelInv.cgstAmount || 0,
        pdfValue: pdfInv.cgstAmount || 0,
        isMatch: compareNumbers(excelInv.cgstAmount || 0, pdfInv.cgstAmount || 0, 1.0)
      },
      {
        fieldName: 'sgstAmount',
        label: 'SGST',
        excelValue: excelInv.sgstAmount || 0,
        pdfValue: pdfInv.sgstAmount || 0,
        isMatch: compareNumbers(excelInv.sgstAmount || 0, pdfInv.sgstAmount || 0, 1.0)
      },
      {
        fieldName: 'igstAmount',
        label: 'IGST',
        excelValue: excelInv.igstAmount || 0,
        pdfValue: pdfInv.igstAmount || 0,
        isMatch: compareNumbers(excelInv.igstAmount || 0, pdfInv.igstAmount || 0, 1.0)
      },
      // Total GST field removed as requested
      {
        fieldName: 'totalAmount',
        label: 'Invoice Amount',
        excelValue: excelInv.totalAmount,
        pdfValue: pdfInv.totalAmount,
        isMatch: compareNumbers(excelInv.totalAmount, pdfInv.totalAmount)
      }
    ];

    const hasMismatch = fields.some(f => !f.isMatch);
    
    return {
      invoiceNumber: excelInv.invoiceNumber,
      status: hasMismatch ? 'MISMATCH' : 'MATCH',
      originalReference: excelInv,
      extractedData: pdfInv,
      fields,
      confidence: matchMethod === 'HEURISTIC' ? 0.8 : 1.0
    };
  };

  // --- PASS 1: Strict Match (Invoice ID AND GST Number) ---
  // This prioritizes differentiating duplicate Invoice IDs by their GST Number.
  excelData.forEach((excelInv, index) => {
    // Candidates matching ID
    const candidates = pdfData.map((pdfInv, idx) => ({ pdfInv, idx }))
      .filter(({ pdfInv, idx }) => 
        !matchedPdfIndices.has(idx) && isIdMatch(excelInv.invoiceNumber, pdfInv.invoiceNumber)
      );
    
    // Check for GST Match among candidates
    if (candidates.length > 0 && excelInv.gstNumber) {
        const strictMatch = candidates.find(({ pdfInv }) => 
           cleanString(excelInv.gstNumber) === cleanString(pdfInv.gstNumber)
        );
        
        if (strictMatch) {
            matchedPdfIndices.add(strictMatch.idx);
            results[index] = buildResult(excelInv, strictMatch.pdfInv, 'STRICT_GST');
        }
    }
  });

  // --- PASS 2: ID Match (Best Remaining Candidate) ---
  // Matches any remaining items by ID. Uses Total Amount as tie-breaker if multiple IDs exist.
  excelData.forEach((excelInv, index) => {
    if (results[index]) return; // Already matched

    const candidates = pdfData.map((pdfInv, idx) => ({ pdfInv, idx }))
      .filter(({ pdfInv, idx }) => 
        !matchedPdfIndices.has(idx) && isIdMatch(excelInv.invoiceNumber, pdfInv.invoiceNumber)
      );

    if (candidates.length > 0) {
        // Tie-breaker: Try to match Total Amount
        let bestCandidate = candidates.find(({ pdfInv }) => 
            compareNumbers(excelInv.totalAmount, pdfInv.totalAmount)
        );
        
        // If no amount match, just take the first one
        if (!bestCandidate) {
            bestCandidate = candidates[0];
        }

        matchedPdfIndices.add(bestCandidate.idx);
        results[index] = buildResult(excelInv, bestCandidate.pdfInv, 'ID_ONLY');
    }
  });

  // --- PASS 3: Heuristic Match (Same Total Amount AND Same Date) ---
  // For invoices where ID might be read incorrectly
  excelData.forEach((excelInv, index) => {
    if (results[index]) return;

    const matchedPdfIndex = pdfData.findIndex((pdfInv, idx) => {
        if (matchedPdfIndices.has(idx)) return false;
        
        const amountMatch = compareNumbers(excelInv.totalAmount, pdfInv.totalAmount);
        // Relaxed date match
        const dateMatch = excelInv.invoiceDate === pdfInv.invoiceDate || 
                          normalizeDate(excelInv.invoiceDate) === normalizeDate(pdfInv.invoiceDate);
        
        return amountMatch && dateMatch;
    });

    if (matchedPdfIndex !== -1) {
        matchedPdfIndices.add(matchedPdfIndex);
        results[index] = buildResult(excelInv, pdfData[matchedPdfIndex], 'HEURISTIC');
    }
  });

  // --- Fill in MISSING_IN_PDF ---
  excelData.forEach((excelInv, index) => {
    if (!results[index]) {
      results[index] = {
        invoiceNumber: excelInv.invoiceNumber,
        status: 'MISSING_IN_PDF',
        originalReference: excelInv,
        fields: [
             { fieldName: 'totalAmount', label: 'Expected Amount', excelValue: excelInv.totalAmount, pdfValue: undefined, isMatch: false },
             { fieldName: 'invoiceDate', label: 'Expected Date', excelValue: excelInv.invoiceDate, pdfValue: undefined, isMatch: false }
        ]
      };
    }
  });

  // --- Collect MISSING_IN_EXCEL (Extras in PDF) ---
  const finalResults: InvoiceComparisonResult[] = results.filter((r): r is InvoiceComparisonResult => r !== null);

  pdfData.forEach((pdfInv, idx) => {
    if (!matchedPdfIndices.has(idx)) {
        finalResults.push({
            invoiceNumber: pdfInv.invoiceNumber,
            status: 'MISSING_IN_EXCEL',
            extractedData: pdfInv,
            fields: [
                { fieldName: 'totalAmount', label: 'Invoice Amount', excelValue: undefined, pdfValue: pdfInv.totalAmount, isMatch: false }
            ]
        });
    }
  });

  return finalResults;
};