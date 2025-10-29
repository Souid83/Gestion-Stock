/**
 * Quote Store
 * Zustand store for managing quotes/devis
 */

import { create } from 'zustand';

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  customer_name?: string;
  total_ht: number;
  total_ttc: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  quote_date: string;
  valid_until?: string;
  created_at?: string;
}

interface QuoteStore {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  fetchQuotes: () => Promise<void>;
  addQuote: (quote: Omit<Quote, 'id' | 'created_at'>) => Promise<void>;
  updateQuote: (id: string, quote: Partial<Quote>) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
}

export const useQuoteStore = create<QuoteStore>((set) => ({
  quotes: [],
  isLoading: false,
  error: null,

  fetchQuotes: async () => {
    console.log('[QuoteStore] Fetching quotes');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ quotes: [], isLoading: false });
    } catch (error) {
      console.error('[QuoteStore] Error fetching quotes:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des devis',
        isLoading: false,
      });
    }
  },

  addQuote: async (quote) => {
    console.log('[QuoteStore] Adding quote:', quote);
    // TODO: Implement actual add to Supabase
  },

  updateQuote: async (id, quote) => {
    console.log('[QuoteStore] Updating quote:', id, quote);
    // TODO: Implement actual update in Supabase
  },

  deleteQuote: async (id) => {
    console.log('[QuoteStore] Deleting quote:', id);
    // TODO: Implement actual delete from Supabase
  },
}));

/**
 * Get document types for quotes
 */
export async function getDocumentTypes() {
  console.log('[QuoteStore] Getting document types');

  try {
    // TODO: Implement actual fetching from Supabase
    return [];
  } catch (error) {
    console.error('[QuoteStore] Error getting document types:', error);
    return [];
  }
}
