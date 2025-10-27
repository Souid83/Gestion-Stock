/**
 * Category Store
 * Zustand store for managing product categories
 */

import { create } from 'zustand';

interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at?: string;
}

interface CategoryStore {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    console.log('[CategoryStore] Fetching categories');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ categories: [], isLoading: false });
    } catch (error) {
      console.error('[CategoryStore] Error fetching categories:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des catégories',
        isLoading: false,
      });
    }
  },

  addCategory: async (category) => {
    console.log('[CategoryStore] Adding category:', category);
    // TODO: Implement actual add to Supabase
  },

  updateCategory: async (id, category) => {
    console.log('[CategoryStore] Updating category:', id, category);
    // TODO: Implement actual update in Supabase
  },

  deleteCategory: async (id) => {
    console.log('[CategoryStore] Deleting category:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
