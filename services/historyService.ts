import { supabase } from './supabase';
import { InvoiceComparisonResult, ProcessingStats, HistoryItem } from '../types';

export const getHistory = async (userId: string): Promise<HistoryItem[]> => {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    // Map Supabase snake_case columns to TypeScript camelCase types
    return data.map((item: any) => ({
      id: item.id,
      timestamp: item.created_at,
      excelFileName: item.excel_file_name,
      pdfFileName: item.pdf_file_name,
      stats: item.stats,
      results: item.results
    }));
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveSession = async (
  userId: string,
  excelFileName: string, 
  pdfFileName: string, 
  stats: ProcessingStats, 
  results: InvoiceComparisonResult[]
): Promise<HistoryItem | null> => {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('history')
      .insert([
        {
          user_id: userId,
          excel_file_name: excelFileName,
          pdf_file_name: pdfFileName,
          stats: stats,
          results: results
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving session:', error);
      return null;
    }

    return {
      id: data.id,
      timestamp: data.created_at,
      excelFileName: data.excel_file_name,
      pdfFileName: data.pdf_file_name,
      stats: data.stats,
      results: data.results
    };
  } catch (e) {
    console.error("Failed to save history", e);
    return null;
  }
};

export const deleteSession = async (userId: string, id: string): Promise<void> => {
    if (!userId) return;
    try {
        const { error } = await supabase
          .from('history')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('Error deleting session:', error);
        }
    } catch (e) {
        console.error("Failed to delete history item", e);
    }
};

export const clearAllHistory = async (userId: string): Promise<void> => {
    if (userId) {
        try {
          // RLS ensures users only delete their own rows
          const { error } = await supabase
            .from('history')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows matching RLS
          
          if (error) console.error('Error clearing history:', error);
        } catch (e) {
          console.error("Failed to clear history", e);
        }
    }
};