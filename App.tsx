import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader2, BarChart3, Receipt, FileSpreadsheet, Download, FileStack, History, ArrowLeft, Trash, LogOut } from 'lucide-react';
import { parseExcelFile, downloadExcelReport } from './services/excelService';
import { processPdfWithGemini } from './services/geminiService';
import { createSortedPdf } from './services/pdfService';
import { compareInvoices } from './utils/comparator';
import { getHistory, saveSession, deleteSession, clearAllHistory } from './services/historyService';
import { InvoiceComparisonResult, ProcessingStats, HistoryItem } from './types';
import ComparisonResultRow from './components/ComparisonResultRow';
import HistoryList from './components/HistoryList';

type ViewMode = 'upload' | 'history' | 'results';

// Constant ID for local usage since auth is removed
const GUEST_ID = 'guest_user';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('upload');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [results, setResults] = useState<InvoiceComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);

  useEffect(() => {
    // Load history immediately for guest user
    setHistoryItems(getHistory(GUEST_ID));
  }, []);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
      // If we are currently viewing results, reset to upload mode essentially but keep files
      if (view === 'results' && loadedFromHistory) {
         setResults([]);
         setStats(null);
         setLoadedFromHistory(false);
         setView('upload');
      } else {
         setResults([]);
         setStats(null);
      }
      setError(null);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      if (view === 'results' && loadedFromHistory) {
         setResults([]);
         setStats(null);
         setLoadedFromHistory(false);
         setView('upload');
      } else {
         setResults([]);
         setStats(null);
      }
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
      setLoadedFromHistory(false);
      setView('results');

      // 5. Save to History
      const savedItem = saveSession(GUEST_ID, excelFile.name, pdfFile.name, newStats, comparisonResults);
      if (savedItem) {
        setHistoryItems(prev => [savedItem, ...prev].slice(0, 20));
      } else {
        // Optional: warn user that history is full
        console.warn("Could not save to history - storage full");
      }

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

  const handleDeleteHistory = (id: string) => {
    const updated = deleteSession(GUEST_ID, id);
    setHistoryItems(updated);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setResults(item.results);
    setStats(item.stats);
    setLoadedFromHistory(true);
    // We cannot restore File objects from local storage, so we clear them to indicate this is a history view
    // Users must re-upload PDF to use PDF features like sorting
    setExcelFile(null);
    setPdfFile(null);
    setView('results');
  };

  const renderContent = () => {
    if (view === 'history') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="w-6 h-6 text-blue-600" />
              Processing History
            </h2>
            {historyItems.length > 0 && (
              <button 
                onClick={() => {
                  if(confirm('Are you sure you want to clear all history?')) {
                    clearAllHistory(GUEST_ID);
                    setHistoryItems([]);
                  }
                }}
                className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
          <HistoryList items={historyItems} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} />
        </div>
      );
    }

    // Default View (Upload or Results)
    return (
      <div className="max-w-5xl mx-auto">
        {/* Intro / Instructions */}
        {view === 'upload' && (
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
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {/* Results View - Shared by both Live Processing and History Viewing */}
        {(view === 'results' || (view === 'upload' && stats)) && stats && (
          <>
            {/* History Warning Banner */}
            {loadedFromHistory && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-amber-700">
                      <span className="font-bold">Viewing Historical Data.</span> You are viewing a previously processed report. 
                      PDF-specific features (like sorting) are disabled until you re-upload the original PDF file.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Dashboard */}
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
                          disabled={isGeneratingPdf || loadedFromHistory}
                          title={loadedFromHistory ? "Please re-upload PDF to use this feature" : "Download PDF with pages sorted by Excel order"}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow transition-colors
                            ${isGeneratingPdf || loadedFromHistory
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
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
            
            {/* Back Button for Results View */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex justify-center">
               <button 
                 onClick={() => {
                   setResults([]);
                   setStats(null);
                   setLoadedFromHistory(false);
                   setView('upload');
                 }}
                 className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2"
               >
                 <ArrowLeft className="w-4 h-4" /> Start New Analysis
               </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
             className="flex items-center gap-2 cursor-pointer" 
             onClick={() => {
                 // Reset to home
                 setView('upload');
                 if (loadedFromHistory) {
                    setResults([]);
                    setStats(null);
                    setLoadedFromHistory(false);
                 }
             }}
          >
            <div className="bg-blue-600 p-2 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">InvoiceMatcher AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setView(view === 'history' ? 'upload' : 'history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'history' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
             >
                <History className="w-4 h-4" />
                History
             </button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;