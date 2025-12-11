import React, { useState } from 'react';
import { InvoiceComparisonResult } from '../types';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, FileQuestion } from 'lucide-react';

interface Props {
  result: InvoiceComparisonResult;
}

const ComparisonResultRow: React.FC<Props> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'MATCH': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'MISMATCH': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'MISSING_IN_PDF': return <FileQuestion className="w-5 h-5 text-red-500" />;
      case 'MISSING_IN_EXCEL': return <FileQuestion className="w-5 h-5 text-blue-500" />;
      default: return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'MATCH': return 'Perfect Match';
      case 'MISMATCH': return 'Discrepancy Found';
      case 'MISSING_IN_PDF': return 'Missing in PDF';
      case 'MISSING_IN_EXCEL': return 'Extra in PDF';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'MATCH': return 'bg-green-50 border-green-200';
      case 'MISMATCH': return 'bg-amber-50 border-amber-200';
      case 'MISSING_IN_PDF': return 'bg-red-50 border-red-200';
      case 'MISSING_IN_EXCEL': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`mb-3 border rounded-lg overflow-hidden transition-all ${getStatusClass(result.status)}`}>
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-opacity-75"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {getStatusIcon(result.status)}
          <div>
            <h3 className="font-semibold text-gray-800">Invoice #{result.invoiceNumber}</h3>
            <p className="text-sm text-gray-500">{getStatusText(result.status)}</p>
          </div>
        </div>
        
        {result.status === 'MISMATCH' && (
          <div className="flex-1 mx-4 hidden sm:block">
             <div className="flex gap-2">
                {result.fields.filter(f => !f.isMatch).map(f => (
                    <span key={f.fieldName} className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                        {f.label}
                    </span>
                ))}
             </div>
          </div>
        )}

        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {expanded && result.fields.length > 0 && result.status !== 'MISSING_IN_PDF' && result.status !== 'MISSING_IN_EXCEL' && (
        <div className="bg-white border-t p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2 text-blue-700 bg-blue-50">Excel Value</th>
                  <th className="px-4 py-2 text-purple-700 bg-purple-50">PDF Extracted</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.fields.map((field) => (
                  <tr key={field.fieldName} className={!field.isMatch ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-700">{field.label}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{field.excelValue !== undefined ? String(field.excelValue) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{field.pdfValue !== undefined ? String(field.pdfValue) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {field.isMatch ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Mismatch
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {expanded && result.status === 'MISSING_IN_PDF' && (
          <div className="bg-white border-t p-4 text-sm text-gray-600">
              <p className="mb-2">This invoice exists in your Excel file but could not be matched to any invoice in the uploaded PDF.</p>
              <div className="bg-slate-50 p-3 rounded border border-slate-100 inline-block">
                 <p className="text-xs font-semibold text-slate-500 uppercase">Excel Record Details</p>
                 <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-1">
                    <div>
                        <span className="text-slate-500 text-xs">Expected Total:</span> <span className="font-mono font-medium">{result.fields.find(f => f.fieldName === 'totalAmount')?.excelValue}</span>
                    </div>
                     <div>
                        <span className="text-slate-500 text-xs">Expected Date:</span> <span className="font-mono font-medium">{result.fields.find(f => f.fieldName === 'invoiceDate')?.excelValue}</span>
                    </div>
                 </div>
              </div>
          </div>
      )}
      
      {expanded && result.status === 'MISSING_IN_EXCEL' && (
          <div className="bg-white border-t p-4 text-sm text-gray-600">
              This invoice was found in the PDF but does not have a corresponding entry in the Excel file.
              <br />
              <span className="font-mono mt-2 block">Extracted Total: {result.fields.find(f => f.fieldName === 'totalAmount')?.pdfValue}</span>
          </div>
      )}
    </div>
  );
};

export default ComparisonResultRow;
