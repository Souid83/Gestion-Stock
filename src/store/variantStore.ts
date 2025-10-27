/**
 * Variant Store
 * Zustand store for managing product variants
 */

import { create } from 'zustand';

interface Variant {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

interface VariantStore {
  variants: Variant[];
  isLoading: boolean;
  error: string | null;
  fetchVariants: () => Promise<void>;
  addVariant: (variant: Omit<Variant, 'id' | 'created_at'>) => Promise<void>;
  updateVariant: (id: string, variant: Partial<Variant>) => Promise<void>;
  deleteVariant: (id: string) => Promise<void>;
}

export const useVariantStore = create<VariantStore>((set) => ({
  variants: [],
  isLoading: false,
  error: null,

  fetchVariants: async () => {
    console.log('[VariantStore] Fetching variants');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ variants: [], isLoading: false });
    } catch (error) {
      console.error('[VariantStore] Error fetching variants:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des variantes',
        isLoading: false,
      });
    }
  },

  addVariant: async (variant) => {
    console.log('[VariantStore] Adding variant:', variant);
    // TODO: Implement actual add to Supabase
  },

  updateVariant: async (id, variant) => {
    console.log('[VariantStore] Updating variant:', id, variant);
    // TODO: Implement actual update in Supabase
  },

  deleteVariant: async (id) => {
    console.log('[VariantStore] Deleting variant:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
