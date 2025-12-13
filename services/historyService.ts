import { InvoiceComparisonResult, ProcessingStats, HistoryItem } from '../types';

const STORAGE_KEY = 'invoice_matcher_history_local';

export const getHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveSession = (
  excelFileName: string, 
  pdfFileName: string, 
  stats: ProcessingStats, 
  results: InvoiceComparisonResult[]
): HistoryItem | null => {
  try {
    const history = getHistory();
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      excelFileName,
      pdfFileName,
      stats,
      results
    };
    
    // Prepend new item, keep max 20 to avoid quota issues
    const updated = [newItem, ...history].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error("Failed to save history", e);
    // Usually means quota exceeded
    return null;
  }
};

export const deleteSession = (id: string): HistoryItem[] => {
    try {
        const history = getHistory();
        const updated = history.filter(h => h.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.error("Failed to delete history item", e);
        return [];
    }
};

export const clearAllHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
};