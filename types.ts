export interface InvoiceData {
  vendorName: string;
  gstNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  // Extra fields from Excel for reference, not comparison
  id?: string;
  branch?: string;
  description?: string;
  soNumber?: string;
  wdCode?: string;
  // Extracted specific fields
  pmcConsultantGst?: string;
  reverseCharge?: string;
  hsnCode?: string;
  hasSignature?: string;
  invoiceType?: string;
  // PDF Location
  pageRange?: {
    start: number;
    end: number;
  };
}

export interface ComparisonField {
  fieldName: string;
  label: string;
  excelValue: string | number | undefined;
  pdfValue: string | number | undefined;
  isMatch: boolean;
}

export interface InvoiceComparisonResult {
  invoiceNumber: string;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_PDF' | 'MISSING_IN_EXCEL';
  fields: ComparisonField[];
  confidence?: number;
  // References for export
  originalReference?: InvoiceData;
  extractedData?: InvoiceData;
}

export interface ProcessingStats {
  totalExcel: number;
  totalPdf: number;
  matched: number;
  mismatches: number;
  missing: number;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  excelFileName: string;
  pdfFileName: string;
  stats: ProcessingStats;
  results: InvoiceComparisonResult[];
}