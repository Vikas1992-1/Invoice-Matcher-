import React, { useState } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader2, BarChart3, Receipt, FileSpreadsheet, Download, FileStack } from 'lucide-react';
import { parseExcelFile, downloadExcelReport } from './services/excelService';
import { processPdfWithGemini } from './services/geminiService';
import { createSortedPdf } from './services/pdfService';
import { compareInvoices } from './utils/comparator';
import { InvoiceComparisonResult, ProcessingStats } from './types';
import ComparisonResultRow from './components/ComparisonResultRow';

const App: React.FC = () => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [results, setResults] = useState<InvoiceComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
      // Reset results if files change
      setResults([]);
      setStats(null);
      setError(null);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setResults([]);
      setStats(null);
      setError(null);
    }
  };

  const processFiles = async () => {
    if (!excelFile || !pdfFile) {
      setError("Please upload both an Excel file and a PDF file.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Parse Excel
      console.log("Parsing Excel...");
      const excelData = await parseExcelFile(excelFile);
      if (excelData.length === 0) {
        throw new Error("No valid data found in Excel file.");
      }
      console.log("Excel Data:", excelData);

      // 2. Parse PDF with Gemini
      console.log("Processing PDF with Gemini...");
      const pdfData = await processPdfWithGemini(pdfFile);
      console.log("PDF Data:", pdfData);

      // 3. Compare
      console.log("Comparing...");
      const comparisonResults = compareInvoices(excelData, pdfData);
      
      // 4. Calculate Stats
      const newStats: ProcessingStats = {
        totalExcel: excelData.length,
        totalPdf: pdfData.length,
        matched: comparisonResults.filter(r => r.status === 'MATCH').length,
        mismatches: comparisonResults.filter(r => r.status === 'MISMATCH').length,
        missing: comparisonResults.filter(r => r.status === 'MISSING_IN_PDF' || r.status === 'MISSING_IN_EXCEL').length,
      };

      setResults(comparisonResults);
      setStats(newStats);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReport = () => {
    if (results.length > 0) {
        downloadExcelReport(results);
    }
  };

  const handleDownloadSortedPdf = async () => {
    if (!pdfFile || results.length === 0) return;
    
    setIsGeneratingPdf(true);
    try {
      const sortedPdfBytes = await createSortedPdf(pdfFile, results);
      
      // Create blob and download link
      const blob = new Blob([sortedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Sorted_Invoices_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate sorted PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">InvoiceMatcher AI</h1>
          </div>
          <div className="text-sm text-slate-500">
             Powered by Gemini 2.5 Flash
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro / Instructions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-100">
          <h2 className="text-lg font-semibold mb-2">Automated Invoice Reconciliation</h2>
          <p className="text-slate-600 mb-4">
            Upload your master Excel sheet and a combined PDF of invoices. The AI will extract data from the PDF and validate it against your Excel records automatically.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {/* Excel Upload */}
            <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors ${excelFile ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
              <FileSpreadsheet className={`w-10 h-10 mb-3 ${excelFile ? 'text-green-600' : 'text-slate-400'}`} />
              <div className="text-center">
                <p className="font-medium text-slate-900 mb-1">{excelFile ? excelFile.name : "Upload Excel File"}</p>
                <p className="text-xs text-slate-500 mb-4">{excelFile ? `${(excelFile.size / 1024).toFixed(1)} KB` : "Drag & drop or click to browse"}</p>
              </div>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                  {excelFile ? "Change File" : "Select File"}
                </span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
              </label>
            </div>

            {/* PDF Upload */}
            <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors ${pdfFile ? 'border-purple-300 bg-purple-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
              <FileText className={`w-10 h-10 mb-3 ${pdfFile ? 'text-purple-600' : 'text-slate-400'}`} />
              <div className="text-center">
                <p className="font-medium text-slate-900 mb-1">{pdfFile ? pdfFile.name : "Upload PDF Invoices"}</p>
                <p className="text-xs text-slate-500 mb-4">{pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : "Single PDF with multiple invoices"}</p>
              </div>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                  {pdfFile ? "Change File" : "Select File"}
                </span>
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={processFiles}
              disabled={!excelFile || !pdfFile || isProcessing}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-md transition-all
                ${!excelFile || !pdfFile || isProcessing 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'}`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Compare Invoices
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Processed</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalExcel}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Perfect Match</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{stats.matched}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Mismatches</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats.mismatches}</p>
            </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Missing / Extra</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.missing}</p>
            </div>
          </div>
        )}

        {/* Detailed Results */}
        {results.length > 0 && (
          <div className="space-y-4">
             <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-slate-500" />
                    Detailed Comparison
                </h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleDownloadSortedPdf}
                      disabled={isGeneratingPdf}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow transition-colors
                        ${isGeneratingPdf 
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed' 
                          : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                        {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileStack className="w-4 h-4" />}
                        {isGeneratingPdf ? 'Generating...' : 'Download Sorted PDF'}
                    </button>
                    <button 
                      onClick={handleDownloadReport}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Download Report
                    </button>
                </div>
             </div>
            
             {/* Match Section */}
             {results.some(r => r.status === 'MATCH') && (
                 <div className="mb-6">
                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">Matched Records</h4>
                    {results.filter(r => r.status === 'MATCH').map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                    ))}
                 </div>
             )}

             {/* Mismatch Section */}
             {results.some(r => r.status === 'MISMATCH') && (
                 <div className="mb-6">
                    <h4 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">Discrepancies</h4>
                    {results.filter(r => r.status === 'MISMATCH').map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                    ))}
                 </div>
             )}

             {/* Issues Section */}
             {results.some(r => r.status.includes('MISSING')) && (
                 <div className="mb-6">
                    <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3">Missing / Not Found</h4>
                    {results.filter(r => r.status.includes('MISSING')).map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                    ))}
                 </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;