/**
 * Invoice Store
 * Zustand store for managing invoices
 */

import { create } from 'zustand';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_ht: number;
  total_ttc: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  issue_date: string;
  due_date?: string;
  created_at?: string;
}

interface InvoiceStore {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  fetchInvoices: () => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'created_at'>) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceStore>((set) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    console.log('[InvoiceStore] Fetching invoices');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ invoices: [], isLoading: false });
    } catch (error) {
      console.error('[InvoiceStore] Error fetching invoices:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des factures',
        isLoading: false,
      });
    }
  },

  addInvoice: async (invoice) => {
    console.log('[InvoiceStore] Adding invoice:', invoice);
    // TODO: Implement actual add to Supabase
  },

  updateInvoice: async (id, invoice) => {
    console.log('[InvoiceStore] Updating invoice:', id, invoice);
    // TODO: Implement actual update in Supabase
  },

  deleteInvoice: async (id) => {
    console.log('[InvoiceStore] Deleting invoice:', id);
    // TODO: Implement actual delete from Supabase
  },
}));

/**
 * Get document types for invoices
 */
export async function getDocumentTypes() {
  console.log('[InvoiceStore] Getting document types');

  try {
    // TODO: Implement actual fetching from Supabase
    return [];
  } catch (error) {
    console.error('[InvoiceStore] Error getting document types:', error);
    return [];
  }
}
