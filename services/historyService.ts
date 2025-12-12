import { InvoiceComparisonResult, ProcessingStats, HistoryItem } from '../types';

const BASE_STORAGE_KEY = 'invoice_matcher_history';

const getStorageKey = (userId: string) => `${BASE_STORAGE_KEY}_${userId}`;

export const getHistory = (userId: string): HistoryItem[] => {
  if (!userId) return [];
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveSession = (
  userId: string,
  excelFileName: string, 
  pdfFileName: string, 
  stats: ProcessingStats, 
  results: InvoiceComparisonResult[]
): HistoryItem | null => {
  if (!userId) return null;
  try {
    const history = getHistory(userId);
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
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error("Failed to save history", e);
    // Usually means quota exceeded
    return null;
  }
};

export const deleteSession = (userId: string, id: string): HistoryItem[] => {
    if (!userId) return [];
    try {
        const history = getHistory(userId);
        const updated = history.filter(h => h.id !== id);
        localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.error("Failed to delete history item", e);
        return [];
    }
};

export const clearAllHistory = (userId: string) => {
    if (!userId) return;
    localStorage.removeItem(getStorageKey(userId));
};