import { InvoiceData, InvoiceComparisonResult, ComparisonField } from '../types';
import { formatDateToDisplay } from '../services/excelService';

// Helper to sanitize strings for loose comparison
const cleanString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

// Specialized helper for Invoice IDs to handle "00123" vs "123"
const normalizeInvoiceId = (id: string): string => {
    const cleaned = cleanString(id);
    if (/^\d+$/.test(cleaned)) {
        return parseInt(cleaned, 10).toString();
    }
    return cleaned;
};

// Helper to compare numbers with tolerance
const compareNumbers = (num1: number, num2: number, epsilon = 1.0): boolean => {
  return Math.abs(num1 - num2) <= epsilon;
};

// Normalize date strings for comparison by converting to DD-MM-YYYY string for strict matching
const normalizeDateForComparison = (dateStr: string): string => {
    return formatDateToDisplay(dateStr);
};

export const compareInvoices = (excelData: InvoiceData[], pdfData: InvoiceData[]): InvoiceComparisonResult[] => {
  const results = new Array<InvoiceComparisonResult | null>(excelData.length).fill(null);
  const matchedPdfIndices = new Set<number>();

  const isIdMatch = (id1: string, id2: string) => {
      const n1 = normalizeInvoiceId(id1);
      const n2 = normalizeInvoiceId(id2);
      if (n1 === n2) return true;
      const c1 = cleanString(id1);
      const c2 = cleanString(id2);
      if (c1.length > 2 && c2.includes(c1)) return true;
      if (c2.length > 2 && c1.includes(c2)) return true;
      return false;
  };

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
        excelValue: excelInv.invoiceDate, // Already formatted in parseExcelFile
        pdfValue: pdfInv.invoiceDate,   // Already formatted in geminiService
        isMatch: normalizeDateForComparison(excelInv.invoiceDate) === normalizeDateForComparison(pdfInv.invoiceDate)
      },
      {
        fieldName: 'taxableAmount',
        label: 'Taxable (Base) Amount',
        excelValue: excelInv.taxableAmount,
        pdfValue: pdfInv.taxableAmount,
        isMatch: compareNumbers(excelInv.taxableAmount, pdfInv.taxableAmount)
      },
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

  excelData.forEach((excelInv, index) => {
    const candidates = pdfData.map((pdfInv, idx) => ({ pdfInv, idx }))
      .filter(({ pdfInv, idx }) => 
        !matchedPdfIndices.has(idx) && isIdMatch(excelInv.invoiceNumber, pdfInv.invoiceNumber)
      );
    
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

  excelData.forEach((excelInv, index) => {
    if (results[index]) return;
    const candidates = pdfData.map((pdfInv, idx) => ({ pdfInv, idx }))
      .filter(({ pdfInv, idx }) => 
        !matchedPdfIndices.has(idx) && isIdMatch(excelInv.invoiceNumber, pdfInv.invoiceNumber)
      );
    if (candidates.length > 0) {
        let bestCandidate = candidates.find(({ pdfInv }) => 
            compareNumbers(excelInv.totalAmount, pdfInv.totalAmount)
        );
        if (!bestCandidate) bestCandidate = candidates[0];
        matchedPdfIndices.add(bestCandidate.idx);
        results[index] = buildResult(excelInv, bestCandidate.pdfInv, 'ID_ONLY');
    }
  });

  excelData.forEach((excelInv, index) => {
    if (results[index]) return;
    const matchedPdfIndex = pdfData.findIndex((pdfInv, idx) => {
        if (matchedPdfIndices.has(idx)) return false;
        const amountMatch = compareNumbers(excelInv.totalAmount, pdfInv.totalAmount);
        const dateMatch = normalizeDateForComparison(excelInv.invoiceDate) === normalizeDateForComparison(pdfInv.invoiceDate);
        return amountMatch && dateMatch;
    });
    if (matchedPdfIndex !== -1) {
        matchedPdfIndices.add(matchedPdfIndex);
        results[index] = buildResult(excelInv, pdfData[matchedPdfIndex], 'HEURISTIC');
    }
  });

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