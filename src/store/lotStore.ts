/**
 * Lot Store
 * Zustand store for managing product lots
 */

import { create } from 'zustand';

interface Lot {
  id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  purchase_date?: string;
  expiry_date?: string;
  created_at?: string;
}

interface LotStore {
  lots: Lot[];
  isLoading: boolean;
  error: string | null;
  fetchLots: (productId?: string) => Promise<void>;
  addLot: (lot: Omit<Lot, 'id' | 'created_at'>) => Promise<void>;
  updateLot: (id: string, lot: Partial<Lot>) => Promise<void>;
  deleteLot: (id: string) => Promise<void>;
}

export const useLotStore = create<LotStore>((set) => ({
  lots: [],
  isLoading: false,
  error: null,

  fetchLots: async (productId?: string) => {
    console.log('[LotStore] Fetching lots', productId ? `for product ${productId}` : 'all');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ lots: [], isLoading: false });
    } catch (error) {
      console.error('[LotStore] Error fetching lots:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des lots',
        isLoading: false,
      });
    }
  },

  addLot: async (lot) => {
    console.log('[LotStore] Adding lot:', lot);
    // TODO: Implement actual add to Supabase
  },

  updateLot: async (id, lot) => {
    console.log('[LotStore] Updating lot:', id, lot);
    // TODO: Implement actual update in Supabase
  },

  deleteLot: async (id) => {
    console.log('[LotStore] Deleting lot:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
