/**
 * Product Store
 * Zustand store for managing products
 */

import { create } from 'zustand';
import type { Product, ProductWithStock } from '../types/supabase';

interface ProductStore {
  products: ProductWithStock[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    console.log('[ProductStore] Fetching products');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ products: [], isLoading: false });
    } catch (error) {
      console.error('[ProductStore] Error fetching products:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des produits',
        isLoading: false,
      });
    }
  },

  addProduct: async (product) => {
    console.log('[ProductStore] Adding product:', product);
    // TODO: Implement actual add to Supabase
  },

  updateProduct: async (id, product) => {
    console.log('[ProductStore] Updating product:', id, product);
    // TODO: Implement actual update in Supabase
  },

  deleteProduct: async (id) => {
    console.log('[ProductStore] Deleting product:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
