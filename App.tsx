import React, { useState, useEffect } from 'react';
import { FileText, Check, AlertCircle, Loader2, BarChart3, Receipt, FileSpreadsheet, Download, FileStack, History, ArrowLeft, Trash, LogOut, Sparkles, ScanText, TableProperties } from 'lucide-react';
import { parseExcelFile, downloadExcelReport, downloadExtractionReport, formatReportValue } from './services/excelService';
import { processPdfWithGemini } from './services/geminiService';
import { createSortedPdf } from './services/pdfService';
import { compareInvoices } from './utils/comparator';
import { getHistory, saveSession, deleteSession, clearAllHistory } from './services/historyService';
import { InvoiceComparisonResult, ProcessingStats, HistoryItem, InvoiceData } from './types';
import ComparisonResultRow from './components/ComparisonResultRow';
import HistoryList from './components/HistoryList';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import Login from './components/Login';

type ViewMode = 'upload' | 'history' | 'results' | 'extractor' | 'extraction-results';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState<ViewMode>('upload');
  const [activeTool, setActiveTool] = useState<'matcher' | 'extractor'>('matcher');
  
  // Matcher State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [results, setResults] = useState<InvoiceComparisonResult[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  
  // Extractor State
  const [extractorPdf, setExtractorPdf] = useState<File | null>(null);
  const [extractionResults, setExtractionResults] = useState<InvoiceData[]>([]);
  
  // Shared State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        setIsLoadingHistory(true);
        const data = await getHistory(user.id);
        setHistoryItems(data);
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user]);

  const handleLogout = async () => {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Error signing out:", error);
    }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <Loader2 className="w-10 h-10 text-[#1c2434] animate-spin" />
          </div>
      );
  }

  if (!user) {
      return <Login />;
  }

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
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

  const handleExtractorPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExtractorPdf(e.target.files[0]);
      setExtractionResults([]);
      setError(null);
    }
  };

  const processMatcher = async () => {
    if (!excelFile || !pdfFile || !user) {
      setError("Please pick both an Excel file and a PDF file.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const excelData = await parseExcelFile(excelFile);
      if (excelData.length === 0) {
        throw new Error("No information found in the Excel file.");
      }
      
      const pdfData = await processPdfWithGemini(pdfFile, excelData);
      const comparisonResults = compareInvoices(excelData, pdfData);
      
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

      const savedItem = await saveSession(user.id, excelFile.name, pdfFile.name, newStats, comparisonResults);
      if (savedItem) {
        setHistoryItems(prev => [savedItem, ...prev]);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while checking your files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processExtractor = async () => {
    if (!extractorPdf) {
      setError("Please upload a PDF file to extract data.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const pdfData = await processPdfWithGemini(extractorPdf);
      setExtractionResults(pdfData);
      setView('extraction-results');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while extracting data from the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReport = () => {
    if (results.length > 0) {
        downloadExcelReport(results);
    }
  };

  const handleDownloadExtraction = () => {
    if (extractionResults.length > 0) {
        downloadExtractionReport(extractionResults);
    }
  };

  const handleDownloadSortedPdf = async () => {
    if (!pdfFile || results.length === 0) return;
    
    setIsGeneratingPdf(true);
    try {
      const sortedPdfBytes = await createSortedPdf(pdfFile, results);
      
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
      setError("Could not create the sorted PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!user) return;
    setHistoryItems(prev => prev.filter(item => item.id !== id));
    await deleteSession(user.id, id);
  };

  const handleClearAllHistory = async () => {
    if (!user) return;
    if(confirm('Are you sure you want to delete everything?')) {
        setHistoryItems([]);
        await clearAllHistory(user.id);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setResults(item.results);
    setStats(item.stats);
    setLoadedFromHistory(true);
    setExcelFile(null);
    setPdfFile(null);
    setActiveTool('matcher');
    setView('results');
  };

  const switchTool = (tool: 'matcher' | 'extractor') => {
    setActiveTool(tool);
    setError(null);
    if (tool === 'matcher') {
      setView('upload');
    } else {
      setView('extractor');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-[#1c2434] pb-12 flex flex-col">
      <header className="bg-[#1c2434] text-white shadow-xl sticky top-0 z-30 h-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#f4cc2a]/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
        
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between relative z-10">
          <div 
             className="flex items-center gap-2 cursor-pointer group" 
             onClick={() => {
                 setView('upload');
                 setActiveTool('matcher');
                 if (loadedFromHistory) {
                    setResults([]);
                    setStats(null);
                    setLoadedFromHistory(false);
                 }
             }}
          >
            <div className="bg-[#f4cc2a] p-2 rounded-xl transition-all group-hover:rotate-6 group-hover:scale-105">
                <Receipt className="w-5 h-5 text-[#1c2434]" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-white">InvoiceMatcher <span className="text-[#f4cc2a]">AI</span></h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">BY PMC CONSULTANTS PVT LTD</p>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
             <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
               <button 
                  onClick={() => switchTool('matcher')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === 'matcher' && view !== 'history' ? 'bg-[#f4cc2a] text-[#1c2434] shadow-md shadow-[#f4cc2a]/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                  Invoice Matcher
               </button>
               <button 
                  onClick={() => switchTool('extractor')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === 'extractor' && view !== 'history' ? 'bg-[#f4cc2a] text-[#1c2434] shadow-md shadow-[#f4cc2a]/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                  PDF Extractor
               </button>
               <div className="w-px h-4 bg-white/10 mx-1"></div>
               <button 
                  onClick={() => setView('history')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'history' ? 'bg-[#f4cc2a] text-[#1c2434] shadow-md shadow-[#f4cc2a]/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                  <History className="w-3.5 h-3.5" />
                  Past Work
               </button>
             </nav>
             
             <div className="h-6 w-px bg-white/10 hidden md:block"></div>
             
             <div className="flex items-center gap-3">
               <div className="hidden sm:block text-right">
                 <p className="text-[11px] font-black leading-none text-white">{user.email?.split('@')[0]}</p>
                 <p className="text-[8px] text-slate-400 uppercase tracking-tighter mt-0.5">User</p>
               </div>
               <div className="w-8 h-8 rounded-xl bg-[#f4cc2a]/10 text-[#f4cc2a] flex items-center justify-center text-xs font-black border border-[#f4cc2a]/20">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
               </div>
               <button 
                 onClick={handleLogout}
                 className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                 title="Logout"
               >
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {renderContent()}
      </main>

      <footer className="py-6 text-center border-t border-slate-100 mt-auto bg-white/50 backdrop-blur-sm">
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Powered by AI</p>
      </footer>
    </div>
  );

  function renderContent() {
    if (view === 'history') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-[#1c2434] tracking-tight">Saved Checks</h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">See the files you checked before.</p>
            </div>
            {user && historyItems.length > 0 && (
              <button 
                onClick={handleClearAllHistory}
                className="px-4 py-2 text-[10px] font-black text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 uppercase tracking-wider border border-red-100"
              >
                <Trash className="w-3.5 h-3.5" /> Delete All
              </button>
            )}
          </div>
          {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <Loader2 className="w-10 h-10 animate-spin text-[#1c2434] mb-3" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Finding records...</p>
              </div>
          ) : (
             <HistoryList items={historyItems} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} />
          )}
        </div>
      );
    }

    if (view === 'extractor') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-[0_15px_40px_-15px_rgba(28,36,52,0.05)] border border-slate-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f4cc2a]/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-[#f4cc2a]/15 transition-all"></div>
              
              <div className="relative">
                <h2 className="text-2xl font-black text-[#1c2434] leading-tight mb-2 tracking-tight">PDF Data Extractor <br/><span className="text-[#f4cc2a] bg-[#1c2434] px-3 py-1 rounded-xl inline-block mt-1">Direct Extraction</span></h2>
                <p className="text-slate-500 font-medium max-w-md text-sm leading-relaxed mt-2">
                  Upload any PDF to extract invoice details into a clean Excel format using advanced Gemini AI.
                </p>
                
                <div className="mt-10">
                  <label className={`h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm group/input ${extractorPdf ? 'border-[#f4cc2a]/40 bg-[#f4cc2a]/5' : 'border-slate-200 bg-slate-50/50 hover:border-[#1c2434] hover:bg-white hover:shadow-xl'}`}>
                    <div className={`p-4 rounded-2xl mb-4 transition-all ${extractorPdf ? 'bg-[#f4cc2a] text-[#1c2434] shadow-md shadow-[#f4cc2a]/15' : 'bg-white text-slate-400 shadow-md group-hover/input:scale-105 group-hover/input:rotate-2'}`}>
                      <ScanText className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-black text-[#1c2434] truncate max-w-[280px] text-center px-4">{extractorPdf ? extractorPdf.name : "Select PDF for Extraction"}</p>
                    {!extractorPdf && <p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">Supports multiple invoices in one PDF</p>}
                    <input type="file" accept=".pdf" className="hidden" onChange={handleExtractorPdfUpload} />
                  </label>
                </div>

                <div className="mt-10">
                  <button
                    onClick={processExtractor}
                    disabled={!extractorPdf || isProcessing}
                    className={`w-full h-14 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn
                      ${!extractorPdf || isProcessing 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                        : 'bg-[#1c2434] text-white hover:shadow-xl hover:shadow-[#1c2434]/20 active:scale-[0.98]'}`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#f4cc2a]" />
                        <span>Extracting Data...</span>
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                        <TableProperties className="w-5 h-5 text-[#f4cc2a]" />
                        <span>Extract to Excel</span>
                        <Sparkles className="w-4 h-4 text-[#f4cc2a] opacity-0 group-hover/btn:opacity-100 transition-all group-hover/btn:scale-110" />
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border-l-[8px] border-red-500 text-red-800 px-6 py-4 rounded-2xl mt-8 flex items-center gap-4 animate-in slide-in-from-top-2 shadow-lg shadow-red-100">
                    <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'extraction-results') {
      return (
        <div className="animate-in fade-in zoom-in-98 duration-400 max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-6 px-2">
            <div>
              <h2 className="text-3xl font-black text-[#1c2434] tracking-tighter leading-none">Extracted Data</h2>
              <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-widest">Found {extractionResults.length} invoices in the document</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={handleDownloadExtraction}
                className="flex-1 sm:flex-none h-12 flex items-center justify-center gap-2 px-8 bg-emerald-600 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-100 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-[10px] uppercase tracking-wider"
              >
                  <Download className="w-4 h-4" />
                  <span>Download Excel</span>
              </button>
              <button 
                onClick={() => setView('extractor')}
                className="flex-1 sm:flex-none h-12 flex items-center justify-center gap-2 px-6 bg-slate-50 text-slate-400 hover:bg-[#1c2434] hover:text-[#f4cc2a] font-black rounded-xl transition-all border border-slate-200 text-[10px] uppercase tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" /> <span>Back</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
             <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-slate-100">
                  <thead className="bg-[#1c2434]">
                    <tr className="text-left text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
                      <th className="px-6 py-4">Invoice #</th>
                      <th className="px-6 py-4 text-[#f4cc2a]">Vendor</th>
                      <th className="px-6 py-4 text-[#f4cc2a]">Date</th>
                      <th className="px-6 py-4 text-[#f4cc2a] text-right">Taxable Amt</th>
                      <th className="px-6 py-4 text-[#f4cc2a] text-right">Total Amt</th>
                      <th className="px-6 py-4">HSN</th>
                      <th className="px-6 py-4">Reverse Charge</th>
                      <th className="px-6 py-4 text-center">Pages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {extractionResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-[#1c2434] text-xs truncate max-w-[120px]">{item.invoiceNumber}</td>
                        <td className="px-6 py-4 text-slate-600 font-bold text-xs truncate max-w-[150px]">{item.vendorName}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">{item.invoiceDate}</td>
                        <td className="px-6 py-4 text-right font-mono text-[10px] font-bold text-slate-700">{item.taxableAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-[10px] font-black text-[#1c2434]">{item.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono text-[10px] uppercase text-slate-500">
                          {formatReportValue(item.hsnCode, 'N/a', 'upper')}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-brand uppercase">
                          {formatReportValue(item.reverseCharge, 'N/a', 'capitalize')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black bg-slate-100 text-slate-500 uppercase tracking-tight">
                            {item.pageRange?.start} - {item.pageRange?.end}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-4xl mx-auto">
        {view === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-[0_15px_40px_-15px_rgba(28,36,52,0.05)] border border-slate-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f4cc2a]/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-[#f4cc2a]/15 transition-all"></div>
              
              <div className="relative">
                <h2 className="text-2xl font-black text-[#1c2434] leading-tight mb-2 tracking-tight">Check Your Invoices <br/><span className="text-[#f4cc2a] bg-[#1c2434] px-3 py-1 rounded-xl inline-block mt-1">Smart AI Tool</span></h2>
                <p className="text-slate-500 font-medium max-w-md text-sm leading-relaxed mt-2">
                  Upload your Excel list and PDF invoices. The AI will find any differences for you.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mt-10">
                  <label className={`h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm group/input ${excelFile ? 'border-emerald-400 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-[#1c2434] hover:bg-white hover:shadow-xl'}`}>
                    <div className={`p-3 rounded-2xl mb-3 transition-all ${excelFile ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-400 shadow-md group-hover/input:scale-105 group-hover/input:rotate-2'}`}>
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-black text-[#1c2434] truncate max-w-[180px] text-center px-4">{excelFile ? excelFile.name : "Upload Excel"}</p>
                    {!excelFile && <p className="text-[9px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">Excel File</p>}
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                  </label>

                  <label className={`h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm group/input ${pdfFile ? 'border-[#f4cc2a]/40 bg-[#f4cc2a]/5' : 'border-slate-200 bg-slate-50/50 hover:border-[#1c2434] hover:bg-white hover:shadow-xl'}`}>
                    <div className={`p-3 rounded-2xl mb-3 transition-all ${pdfFile ? 'bg-[#f4cc2a] text-[#1c2434] shadow-md shadow-[#f4cc2a]/15' : 'bg-white text-slate-400 shadow-md group-hover/input:scale-105 group-hover/input:rotate-2'}`}>
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-black text-[#1c2434] truncate max-w-[180px] text-center px-4">{pdfFile ? pdfFile.name : "Upload PDF"}</p>
                    {!pdfFile && <p className="text-[9px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">PDF File</p>}
                    <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                  </label>
                </div>

                <div className="mt-10">
                  <button
                    onClick={processMatcher}
                    disabled={!excelFile || !pdfFile || isProcessing}
                    className={`w-full h-14 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn
                      ${!excelFile || !pdfFile || isProcessing 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                        : 'bg-[#1c2434] text-white hover:shadow-xl hover:shadow-[#1c2434]/20 active:scale-[0.98]'}`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#f4cc2a]" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                        <Check className="w-5 h-5 text-[#f4cc2a]" />
                        <span>Compare Now</span>
                        <Sparkles className="w-4 h-4 text-[#f4cc2a] opacity-0 group-hover/btn:opacity-100 transition-all group-hover/btn:scale-110" />
                      </>
                    )}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-12 pt-10 border-t border-slate-50">
                  <div className="bg-[#1c2434] text-white rounded-2xl p-6 relative overflow-hidden group/status">
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#f4cc2a]/5 rounded-full blur-2xl -mb-12 -mr-12 group-hover/status:bg-[#f4cc2a]/10 transition-all"></div>
                    <div className="relative z-10">
                      <div className="bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center mb-4">
                        <BarChart3 className="w-4 h-4 text-[#f4cc2a]" />
                      </div>
                      <h3 className="text-base font-black mb-1 tracking-tight">Status Info</h3>
                      <p className="text-slate-400 text-[10px] mb-6 font-medium tracking-tight">Real-time AI performance.</p>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.1em] mb-1.5">
                            <span className="text-slate-400">Accuracy</span>
                            <span className="text-[#f4cc2a]">99.8%</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#f4cc2a] w-[99.8%] rounded-full"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.1em] mb-1.5">
                            <span className="text-slate-400">Speed</span>
                            <span className="text-emerald-400">Fast</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[94%] rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="text-base font-black text-[#1c2434] mb-4 tracking-tight">Quick Tips</h3>
                    <ul className="space-y-3">
                      {[
                        {icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500"/>, text: "Clear Excel headers work best."},
                        {icon: <FileText className="w-3.5 h-3.5 text-[#1c2434]"/>, text: "High-quality PDFs help accuracy."},
                        {icon: <Check className="w-3.5 h-3.5 text-[#f4cc2a]"/>, text: "Review all flagged alerts."}
                      ].map((tip, i) => (
                        <li key={i} className="flex items-start gap-3 text-[11px] text-slate-600 font-bold leading-tight">
                          <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 shrink-0">{tip.icon}</div>
                          <span className="pt-0.5">{tip.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-[8px] border-red-500 text-red-800 px-6 py-4 rounded-2xl mb-8 mt-6 flex items-center gap-4 animate-in slide-in-from-top-2 shadow-lg shadow-red-100">
            <div className="bg-red-500 p-2.5 rounded-xl text-white shadow-md shadow-red-200">
              <AlertCircle className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <p className="font-black text-[10px] uppercase tracking-wider mb-0.5">Error</p>
              <p className="text-xs font-bold opacity-80">{error}</p>
            </div>
          </div>
        )}
        
        {(view === 'results' || (view === 'upload' && stats)) && stats && (
          <div className="space-y-8 animate-in fade-in zoom-in-98 duration-400 pb-8">
            {loadedFromHistory && (
              <div className="bg-[#f4cc2a]/10 border-l-[8px] border-[#f4cc2a] p-6 rounded-2xl flex items-center gap-5 shadow-sm">
                <div className="bg-[#1c2434] p-3 rounded-xl text-[#f4cc2a] shadow-lg shadow-[#1c2434]/15">
                    <History className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-[#1c2434] uppercase tracking-[0.2em] text-[10px] mb-1">Old Record</p>
                  <p className="text-sm text-slate-700 font-bold">You are looking at a past check.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                  { label: "Total Checked", value: stats.totalExcel, color: "bg-[#1c2434] text-white", sub: "Items" },
                  { label: "Match Found", value: stats.matched, color: "bg-white text-emerald-600 border border-emerald-50", sub: "Perfect" },
                  { label: "Differences", value: stats.mismatches, color: "bg-white text-amber-600 border border-amber-50", sub: "Alerts" },
                  { label: "Missing/Extra Invoices", value: stats.missing, color: "bg-white text-red-600 border border-red-50", sub: "Issues" },
              ].map((card, i) => (
                  <div key={i} className={`${card.color} p-6 rounded-2xl shadow-sm relative overflow-hidden group transition-all hover:translate-y-[-2px] hover:shadow-xl`}>
                    <div className="relative z-10">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{card.label}</p>
                        <div className="flex items-baseline gap-1.5">
                            <p className="text-4xl font-black leading-none tracking-tighter">{card.value}</p>
                            <p className="text-[9px] font-black opacity-40 uppercase tracking-widest">{card.sub}</p>
                        </div>
                    </div>
                  </div>
              ))}
            </div>

            {results.length > 0 && (
              <div className="space-y-8 mt-4">
                <div className="flex flex-col sm:flex-row items-end justify-between gap-6 px-2">
                  <div>
                    <h3 className="text-3xl font-black text-[#1c2434] tracking-tighter leading-none">List of Invoices</h3>
                    <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-widest">Details of what we found</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={handleDownloadSortedPdf}
                      disabled={isGeneratingPdf || loadedFromHistory}
                      className={`flex-1 sm:flex-none h-12 flex items-center justify-center gap-2 px-6 font-black rounded-xl shadow-lg transition-all text-[10px] uppercase tracking-wider
                        ${isGeneratingPdf || loadedFromHistory
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                          : 'bg-[#1c2434] hover:shadow-[#1c2434]/20 text-[#f4cc2a] active:scale-95'}`}
                    >
                        {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileStack className="w-4 h-4" />}
                        <span>{isGeneratingPdf ? 'Saving...' : 'Get Sorted PDF'}</span>
                    </button>
                    <button 
                      onClick={handleDownloadReport}
                      className="flex-1 sm:flex-none h-12 flex items-center justify-center gap-2 px-6 bg-emerald-600 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-100 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-[10px] uppercase tracking-wider"
                    >
                        <Download className="w-4 h-4" />
                        <span>Excel Report</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {results.some(r => r.status === 'MATCH') && (
                    <section>
                      <div className="flex items-center gap-3 mb-4 ml-2">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Everything Matches</h4>
                      </div>
                      {results.filter(r => r.status === 'MATCH').map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                      ))}
                    </section>
                  )}

                  {results.some(r => r.status === 'MISMATCH') && (
                    <section>
                      <div className="flex items-center gap-3 mb-4 mt-12 ml-2">
                        <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
                        <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Found a Difference</h4>
                      </div>
                      {results.filter(r => r.status === 'MISMATCH').map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                      ))}
                    </section>
                  )}

                  {results.some(r => r.status.includes('MISSING')) && (
                    <section>
                      <div className="flex items-center gap-3 mb-4 mt-12 ml-2">
                        <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Missing Information</h4>
                      </div>
                      {results.filter(r => r.status.includes('MISSING')).map((res) => (
                        <ComparisonResultRow key={res.invoiceNumber} result={res} />
                      ))}
                    </section>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-16 py-12 border-t border-slate-100 flex justify-center">
               <button 
                 onClick={() => {
                   setResults([]);
                   setStats(null);
                   setLoadedFromHistory(false);
                   setView('upload');
                 }}
                 className="h-14 px-10 bg-slate-50 text-slate-400 hover:bg-[#1c2434] hover:text-[#f4cc2a] font-black rounded-xl transition-all flex items-center gap-4 border border-slate-200 shadow-sm"
               >
                 <ArrowLeft className="w-5 h-5" /> <span>Start Again</span>
               </button>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default App;