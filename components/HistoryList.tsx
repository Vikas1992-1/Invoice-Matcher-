import React from 'react';
import { HistoryItem } from '../types';
import { Calendar, FileSpreadsheet, FileText, Trash2, ArrowRight, BarChart3 } from 'lucide-react';

interface Props {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

const HistoryList: React.FC<Props> = ({ items, onSelect, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
        <div className="bg-slate-50 p-4 rounded-full inline-block mb-3">
            <Calendar className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700">No History Yet</h3>
        <p className="text-slate-500 mt-1">Processed invoices will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div 
          key={item.id} 
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>{new Date(item.timestamp).toLocaleString()}</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                title="Delete from history"
            >
                <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-6 mb-4">
             <div className="flex items-center gap-2">
                 <FileSpreadsheet className="w-4 h-4 text-green-600" />
                 <span className="text-sm font-medium text-slate-800 truncate max-w-[150px]" title={item.excelFileName}>{item.excelFileName}</span>
             </div>
             <div className="flex items-center gap-2">
                 <FileText className="w-4 h-4 text-purple-600" />
                 <span className="text-sm font-medium text-slate-800 truncate max-w-[150px]" title={item.pdfFileName}>{item.pdfFileName}</span>
             </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-5">
             <div className="bg-slate-50 p-2 rounded text-center">
                <span className="block text-xs text-slate-500 uppercase">Total</span>
                <span className="font-bold text-slate-700">{item.stats.totalExcel}</span>
             </div>
             <div className="bg-green-50 p-2 rounded text-center">
                <span className="block text-xs text-green-600 uppercase">Match</span>
                <span className="font-bold text-green-700">{item.stats.matched}</span>
             </div>
             <div className="bg-amber-50 p-2 rounded text-center">
                <span className="block text-xs text-amber-600 uppercase">Mismatch</span>
                <span className="font-bold text-amber-700">{item.stats.mismatches}</span>
             </div>
             <div className="bg-red-50 p-2 rounded text-center">
                <span className="block text-xs text-red-600 uppercase">Missing</span>
                <span className="font-bold text-red-700">{item.stats.missing}</span>
             </div>
          </div>

          <button 
            onClick={() => onSelect(item)}
            className="w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
             <BarChart3 className="w-4 h-4" />
             View Report
             <ArrowRight className="w-4 h-4 ml-1 opacity-60" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default HistoryList;