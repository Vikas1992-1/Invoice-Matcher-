import React, { useState } from 'react';
import { InvoiceComparisonResult } from '../types';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, FileQuestion, ArrowRight } from 'lucide-react';
import { formatReportValue } from '../services/excelService';

interface Props {
  result: InvoiceComparisonResult;
}

const ComparisonResultRow: React.FC<Props> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'MATCH': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'MISMATCH': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'MISSING_IN_PDF': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'MISSING_IN_EXCEL': return <FileQuestion className="w-5 h-5 text-[#1c2434]" />;
      default: return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'MATCH': return 'Perfect Match';
      case 'MISMATCH': return 'There is a difference';
      case 'MISSING_IN_PDF': return 'Not in the PDF';
      case 'MISSING_IN_EXCEL': return 'Extra Invoice';
      default: return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'MATCH': return 'hover:border-emerald-200';
      case 'MISMATCH': return 'hover:border-amber-200';
      case 'MISSING_IN_PDF': return 'hover:border-red-200';
      case 'MISSING_IN_EXCEL': return 'hover:border-[#1c2434]/20';
      default: return 'hover:border-slate-300';
    }
  };

  return (
    <div className={`mb-3 bg-white border border-slate-100 rounded-2xl overflow-hidden transition-all shadow-sm ${expanded ? 'shadow-xl border-slate-200' : getStatusClass(result.status)}`}>
      <div 
        className="p-5 flex items-center justify-between cursor-pointer group select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-inner ${
              result.status === 'MATCH' ? 'bg-emerald-50' : 
              result.status === 'MISMATCH' ? 'bg-amber-50' : 
              'bg-slate-50'
          }`}>
            {getStatusIcon(result.status)}
          </div>
          <div>
            <h3 className="text-base font-black text-[#1c2434] tracking-tight">Invoice #{result.invoiceNumber}</h3>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${
                 result.status === 'MATCH' ? 'text-emerald-500' : 
                 result.status === 'MISMATCH' ? 'text-amber-600' : 
                 'text-slate-400'
            }`}>{getStatusText(result.status)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
            {result.status === 'MISMATCH' && !expanded && (
                <div className="hidden lg:flex gap-1.5">
                    {result.fields.filter(f => !f.isMatch).slice(0, 2).map(f => (
                        <span key={f.fieldName} className="px-2.5 py-1 text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-100 rounded-lg uppercase tracking-tight">
                            {f.label}
                        </span>
                    ))}
                </div>
            )}

            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${expanded ? 'bg-[#1c2434] text-[#f4cc2a] shadow-lg shadow-[#1c2434]/15' : 'bg-slate-50 text-slate-400 group-hover:bg-[#1c2434] group-hover:text-[#f4cc2a]'}`}>
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-slate-50/50 border-t border-slate-100 p-6 animate-in slide-in-from-top-4 duration-300">
          {result.extractedData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">HSN Code (PDF)</p>
                   <p className="text-sm font-black text-brand">{formatReportValue(result.extractedData.hsnCode, 'N/a', 'upper')}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reverse Charge (PDF)</p>
                   <p className="text-sm font-black text-brand">{formatReportValue(result.extractedData.reverseCharge, 'N/a', 'capitalize')}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Signature Found (PDF)</p>
                   <p className="text-sm font-black text-brand">{formatReportValue(result.extractedData.hasSignature, 'No', 'capitalize')}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Page Range</p>
                   <p className="text-sm font-black text-brand">{result.extractedData.pageRange?.start || 'N/a'} - {result.extractedData.pageRange?.end || result.extractedData.pageRange?.start || 'N/a'}</p>
                </div>
              </div>
          )}

          {result.fields.length > 0 && result.status !== 'MISSING_IN_PDF' && result.status !== 'MISSING_IN_EXCEL' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                <table className="min-w-full text-sm divide-y divide-slate-100">
                <thead className="bg-[#1c2434]">
                    <tr className="text-left text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
                    <th className="px-6 py-4">Checking</th>
                    <th className="px-6 py-4 text-[#f4cc2a]">Excel List</th>
                    <th className="px-6 py-4 text-[#f4cc2a]">PDF Data</th>
                    <th className="px-6 py-4 text-center">Result</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {result.fields.map((field) => (
                    <tr key={field.fieldName} className={`transition-all ${!field.isMatch ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4 font-black text-[#1c2434] text-xs">{field.label}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">{field.excelValue !== undefined ? String(field.excelValue) : '—'}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-[10px] font-black">{field.pdfValue !== undefined ? String(field.pdfValue) : '—'}</td>
                        <td className="px-6 py-4 text-center">
                        {field.isMatch ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-tight border border-emerald-100">
                            OK
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black bg-red-100 text-red-800 uppercase tracking-tight border border-red-100">
                            Mismatch
                            </span>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          ) : (
             <div className="flex flex-col items-center py-8 text-center">
                <div className="p-6 bg-slate-50 rounded-2xl mb-6 shadow-inner">
                    <ArrowRight className="w-8 h-8 text-slate-300 rotate-90" />
                </div>
                <h4 className="text-lg font-black text-[#1c2434] tracking-tighter mb-2">Item Missing</h4>
                <p className="text-xs text-slate-500 max-w-xs font-medium leading-relaxed">
                    {result.status === 'MISSING_IN_PDF' 
                        ? "This item is in your Excel list, but we could not find it in the PDF." 
                        : "We found this invoice in the PDF, but it is not in your Excel list."}
                </p>
                
                {result.status === 'MISSING_IN_PDF' && (
                    <div className="mt-8 flex gap-4">
                         <div className="text-left px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amount Expected</p>
                            <p className="font-mono text-sm font-black text-[#1c2434] tracking-tighter">{String(result.fields.find(f => f.fieldName === 'totalAmount')?.excelValue)}</p>
                         </div>
                         <div className="text-left px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date Expected</p>
                            <p className="font-mono text-sm font-black text-[#1c2434] tracking-tighter">{String(result.fields.find(f => f.fieldName === 'invoiceDate')?.excelValue)}</p>
                         </div>
                    </div>
                )}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonResultRow;