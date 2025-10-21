import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type ProductCategoryInsert = Database['public']['Tables']['product_categories']['Insert'];

interface CategoryStore {
  categories: ProductCategory[];
  isLoading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  addCategory: (category: Omit<ProductCategoryInsert, 'id'>) => Promise<ProductCategory | null>;
  addCategories: (categories: Omit<ProductCategoryInsert, 'id'>[]) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('type', { ascending: true })
        .order('brand', { ascending: true })
        .order('model', { ascending: true });

      if (error) throw error;

      set({ categories: data || [], isLoading: false });
    } catch (error) {
      console.error('Error in fetchCategories:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des catégories',
        isLoading: false 
      });
    }
  },

  addCategory: async (category) => {
    set({ isLoading: true, error: null });
    try {
      // First check if category already exists
      const { data: existingCategory } = await supabase
        .from('product_categories')
        .select('*')
        .eq('type', category.type.toUpperCase())
        .eq('brand', category.brand.toUpperCase())
        .eq('model', category.model.toUpperCase())
        .maybeSingle();

      // If category exists, return it
      if (existingCategory) {
        set({ isLoading: false });
        return existingCategory;
      }

      // If category doesn't exist, create it
      const { data, error } = await supabase
        .from('product_categories')
        .insert([{
          ...category,
          type: category.type.toUpperCase(),
          brand: category.brand.toUpperCase(),
          model: category.model.toUpperCase()
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      const categories = get().categories;
      set({ 
        categories: [...categories, data],
        isLoading: false 
      });

      return data;
    } catch (error) {
      console.error('Error in addCategory:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de la catégorie',
        isLoading: false 
      });
      return null;
    }
  },

  addCategories: async (categories) => {
    set({ isLoading: true, error: null });
    try {
      // Process categories in batches to avoid conflicts
      for (const category of categories) {
        try {
          await get().addCategory(category);
        } catch (error) {
          console.warn('Error adding category, continuing with next:', error);
        }
      }

      await get().fetchCategories();
    } catch (error) {
      console.error('Error in addCategories:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout des catégories',
        isLoading: false 
      });
    }
  },

  deleteCategory: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const categories = get().categories.filter(category => category.id !== id);
      set({ categories, isLoading: false });
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression de la catégorie',
        isLoading: false 
      });
    }
  },
}));