import * as XLSX from 'xlsx';
import { InvoiceData, InvoiceComparisonResult } from '../types';

// Helper to normalize strings for cleaner keys
const normalizeKey = (key: string) => key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

/**
 * Helper to format date strings to DD-MM-YYYY
 */
export const formatDateToDisplay = (dateStr: string): string => {
  if (!dateStr || dateStr === 'Unknown') return '';
  const clean = dateStr.trim().replace(/\//g, '-');
  
  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}-${m}-${y}`;
  }

  // Handle general parts split
  const parts = clean.split('-');
  if (parts.length === 3) {
    // case: D-M-YYYY or DD-MM-YYYY
    if (parts[2].length === 4) {
      return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
    }
    // case: YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
  }

  return clean;
};

/**
 * Helper to format values for reports.
 * Handles placeholders and string transformations.
 */
export const formatReportValue = (
  value: any, 
  placeholder: string = 'N/a', 
  transform: 'none' | 'upper' | 'capitalize' = 'none'
): string => {
  if (value === undefined || value === null) return placeholder;
  let strVal = String(value).trim();
  if (strVal === '' || strVal.toLowerCase() === 'unknown' || strVal.toLowerCase() === 'none') return placeholder;
  
  if (transform === 'upper') return strVal.toUpperCase();
  if (transform === 'capitalize') {
    return strVal.charAt(0).toUpperCase() + strVal.slice(1).toLowerCase();
  }
  return strVal;
};

export const parseExcelFile = async (file: File): Promise<InvoiceData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with raw headers
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        const invoices: InvoiceData[] = jsonData.map((row: any) => {
            // Helper to find value by loosely matching key (contains)
            const findVal = (keywords: string[]): any => {
                const key = Object.keys(row).find(k => keywords.some(kw => normalizeKey(k).includes(normalizeKey(kw))));
                return key ? row[key] : undefined;
            };

            const findValStrict = (keywords: string[]): any => {
                const key = Object.keys(row).find(k => {
                    const normK = normalizeKey(k);
                    return keywords.some(kw => normalizeKey(kw) === normK);
                });
                return key ? row[key] : undefined;
            };

            const invoiceDateRaw = findVal(['invoice date', 'date']);
            let invoiceDateStr = '';
            
            if (typeof invoiceDateRaw === 'number') {
                const date = XLSX.SSF.parse_date_code(invoiceDateRaw);
                invoiceDateStr = `${String(date.d).padStart(2, '0')}-${String(date.m).padStart(2, '0')}-${date.y}`;
            } else {
                invoiceDateStr = formatDateToDisplay(String(invoiceDateRaw || ''));
            }

            return {
                id: String(findValStrict(['id', 'sr no', 's.no', 'serial no']) || '').trim(),
                vendorName: String(findVal(['vendor name', 'vendor', 'wd name']) || '').trim(),
                gstNumber: String(findVal(['gst number', 'gst']) || '').trim(),
                invoiceNumber: String(findVal(['invoice number', 'inv no', 'invoice #']) || '').trim(),
                invoiceDate: invoiceDateStr,
                taxableAmount: parseFloat(String(findVal(['base amount', 'taxable amount', 'gross amount', 'taxable']) || '0').replace(/,/g, '')),
                gstAmount: parseFloat(String(findVal(['gst amount', 'tax amount', 'total tax']) || '0').replace(/,/g, '')),
                cgstAmount: parseFloat(String(findVal(['cgst', 'cgst amount', 'central tax']) || '0').replace(/,/g, '')),
                sgstAmount: parseFloat(String(findVal(['sgst', 'sgst amount', 'state tax', 'utgst']) || '0').replace(/,/g, '')),
                igstAmount: parseFloat(String(findVal(['igst', 'igst amount', 'integrated tax']) || '0').replace(/,/g, '')),
                totalAmount: parseFloat(String(findVal(['invoice amount', 'total amount', 'total']) || '0').replace(/,/g, '')),
                branch: String(findVal(['branch']) || ''),
                description: String(findVal(['description']) || ''),
                soNumber: String(findVal(['so', 'so number']) || ''),
                wdCode: String(findVal(['wd code', 'wd']) || ''),
            };
        });

        resolve(invoices);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const downloadExcelReport = (results: InvoiceComparisonResult[]) => {
  const exportData = results.map(r => {
    const excel = r.originalReference || {} as Partial<InvoiceData>;
    const pdf = r.extractedData || {} as Partial<InvoiceData>;
    
    const getMatchStatus = (fieldName: string) => {
        if (r.status === 'MISSING_IN_PDF' || r.status === 'MISSING_IN_EXCEL') return 'N/A';
        const field = r.fields.find(f => f.fieldName === fieldName);
        return field?.isMatch ? 'Match' : 'MISMATCH';
    };

    let statusDisplay = r.status as string;
    if (r.status === 'MATCH') statusDisplay = '✅ MATCH';
    else if (r.status === 'MISMATCH') statusDisplay = '⚠️ MISMATCH';
    else if (r.status === 'MISSING_IN_PDF') statusDisplay = '❌ MISSING IN PDF';
    else if (r.status === 'MISSING_IN_EXCEL') statusDisplay = '🔵 EXTRA IN PDF';

    return {
      "Comparison Status": statusDisplay,
      "Discrepancy Notes": r.status === 'MISMATCH' ? r.fields.filter(f => !f.isMatch).map(f => f.label).join(', ') : '',
      "ID": excel.id || '', 
      "Branch": excel.branch || '',
      "WD Code": excel.wdCode || '',
      "SO Number": excel.soNumber || '',
      "Description": excel.description || '',

      "Vendor Name (Excel)": excel.vendorName,
      "Vendor Name (PDF)": pdf.vendorName,
      "Vendor Match": getMatchStatus('vendorName'),

      "GST Number (Excel)": excel.gstNumber,
      "GST Number (PDF)": pdf.gstNumber,
      "GST Match": getMatchStatus('gstNumber'),
      
      "PMC Consultant GST (PDF)": pdf.pmcConsultantGst || '',
      "Reverse Charge (PDF)": formatReportValue(pdf.reverseCharge, 'N/a', 'capitalize'),
      "HSN Code (PDF)": formatReportValue(pdf.hsnCode, 'N/a', 'upper'),
      "Invoice Type (PDF)": pdf.invoiceType || '',
      "Signature Present (PDF)": formatReportValue(pdf.hasSignature, 'N/a', 'capitalize'),

      "Invoice Number (Excel)": excel.invoiceNumber || (r.status === 'MISSING_IN_PDF' ? r.invoiceNumber : ''),
      "Invoice Number (PDF)": pdf.invoiceNumber || (r.status === 'MISSING_IN_EXCEL' ? r.invoiceNumber : ''),
      "Invoice Number Match": getMatchStatus('invoiceNumber'),

      "Invoice Date (Excel)": excel.invoiceDate,
      "Invoice Date (PDF)": pdf.invoiceDate,
      "Date Match": getMatchStatus('invoiceDate'),

      "Taxable (Base) Amount (Excel)": excel.taxableAmount,
      "Taxable (Base) Amount (PDF)": pdf.taxableAmount,
      "Taxable Match": getMatchStatus('taxableAmount'),

      "CGST (Excel)": excel.cgstAmount,
      "CGST (PDF)": pdf.cgstAmount,
      "CGST Match": getMatchStatus('cgstAmount'),

      "SGST (Excel)": excel.sgstAmount,
      "SGST (PDF)": pdf.sgstAmount,
      "SGST Match": getMatchStatus('sgstAmount'),

      "IGST (Excel)": excel.igstAmount,
      "IGST (PDF)": pdf.igstAmount,
      "IGST Match": getMatchStatus('igstAmount'),

      "Total Amount (Excel)": excel.totalAmount,
      "Total Amount (PDF)": pdf.totalAmount,
      "Total Amt Match": getMatchStatus('totalAmount'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: key.length + 8 }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciliation Report");

  XLSX.writeFile(workbook, `Invoice_Reconciliation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const downloadExtractionReport = (data: InvoiceData[]) => {
  const exportData = data.map(item => ({
    "Vendor Name": item.vendorName,
    "GST Number": item.gstNumber,
    "PMC/Consultant GST": item.pmcConsultantGst || '',
    "Invoice Number": item.invoiceNumber,
    "Invoice Date": item.invoiceDate,
    "Taxable (Base) Amount": item.taxableAmount,
    "CGST": item.cgstAmount || 0,
    "SGST": item.sgstAmount || 0,
    "IGST": item.igstAmount || 0,
    "GST Amount": item.gstAmount || 0,
    "Total Amount": item.totalAmount,
    "Reverse Charge": formatReportValue(item.reverseCharge, 'N/a', 'capitalize'),
    "HSN Code": formatReportValue(item.hsnCode, 'N/a', 'upper'),
    "Invoice Type": item.invoiceType || '',
    "Signature Present": formatReportValue(item.hasSignature, 'N/a', 'capitalize'),
    "Pages": `${item.pageRange?.start || 1} - ${item.pageRange?.end || 1}`
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: key.length + 8 }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Extraction Report");

  XLSX.writeFile(workbook, `PDF_Extraction_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
};