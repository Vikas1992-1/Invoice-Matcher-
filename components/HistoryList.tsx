import React from 'react';
import { HistoryItem } from '../types';
import { Calendar, FileSpreadsheet, FileText, Trash2, ArrowRight, Clock } from 'lucide-react';

interface Props {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

const HistoryList: React.FC<Props> = ({ items, onSelect, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center">
        <div className="bg-slate-50 p-6 rounded-2xl mb-6 shadow-inner">
            <Clock className="w-12 h-12 text-slate-200" />
        </div>
        <h3 className="text-xl font-black text-[#1c2434] tracking-tight">The archive is empty</h3>
        <p className="text-slate-400 mt-1.5 font-black uppercase tracking-[0.3em] text-[9px]">No historical data found</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {items.map((item) => (
        <div 
          key={item.id} 
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative flex flex-col"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest border border-slate-100 shadow-inner">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                title="Purge Audit"
            >
                <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 mb-8">
             <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-emerald-50 rounded-xl shadow-sm border border-emerald-100">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reference Dataset</p>
                    <p className="text-sm font-black text-[#1c2434] truncate" title={item.excelFileName}>{item.excelFileName}</p>
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-[#1c2434]/5 rounded-xl shadow-sm border border-[#1c2434]/10">
                    <FileText className="w-5 h-5 text-[#1c2434]" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Source Material</p>
                    <p className="text-sm font-black text-[#1c2434] truncate" title={item.pdfFileName}>{item.pdfFileName}</p>
                 </div>
             </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-8 mt-auto bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
             {[
                 { label: "All", val: item.stats.totalExcel, bg: "text-slate-600" },
                 { label: "OK", val: item.stats.matched, bg: "text-emerald-600" },
                 { label: "Diff", val: item.stats.mismatches, bg: "text-amber-600" },
                 { label: "Gap", val: item.stats.missing, bg: "text-red-600" },
             ].map((stat, i) => (
                 <div key={i} className="text-center">
                    <span className="block text-[7px] font-black uppercase tracking-[0.1em] opacity-40 leading-tight mb-1">{stat.label}</span>
                    <span className={`font-black text-base tracking-tighter ${stat.bg}`}>{stat.val}</span>
                 </div>
             ))}
          </div>

          <button 
            onClick={() => onSelect(item)}
            className="w-full h-12 bg-[#1c2434] text-white hover:bg-[#1c2434]/95 font-black rounded-xl transition-all flex items-center justify-center gap-4 shadow-xl shadow-[#1c2434]/15 group-hover:scale-[1.01] active:scale-[0.99]"
          >
             <span className="text-xs text-[#f4cc2a] uppercase tracking-widest">Restore Audit</span>
             <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default HistoryList;