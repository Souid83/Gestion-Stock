import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

interface ProductVariant {
  id: string;
  color: string;
  grade: string;
  capacity: string;
  created_at: string;
  updated_at: string;
}

interface VariantStore {
  variants: ProductVariant[];
  isLoading: boolean;
  error: string | null;
  fetchVariants: () => Promise<void>;
  addVariant: (variant: Omit<ProductVariant, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  addVariants: (variants: Omit<ProductVariant, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  deleteVariant: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useVariantStore = create<VariantStore>((set, get) => ({
  variants: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchVariants: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .order('color', { ascending: true })
        .order('grade', { ascending: true })
        .order('capacity', { ascending: true });

      if (error) throw error;

      set({ variants: data || [], isLoading: false });
    } catch (error) {
      console.error('Error in fetchVariants:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des variantes',
        isLoading: false 
      });
    }
  },

  addVariant: async (variant) => {
    set({ isLoading: true, error: null });
    try {
      // First check if variant already exists
      const { data: existingVariant } = await supabase
        .from('product_variants')
        .select('id')
        .eq('color', variant.color.toUpperCase())
        .eq('grade', variant.grade.toUpperCase())
        .eq('capacity', variant.capacity.toUpperCase())
        .maybeSingle();

      // If variant exists, just return without error
      if (existingVariant) {
        set({ isLoading: false });
        return;
      }

      // If variant doesn't exist, create it
      const { data, error } = await supabase
        .from('product_variants')
        .insert([{
          ...variant,
          color: variant.color.toUpperCase(),
          grade: variant.grade.toUpperCase(),
          capacity: variant.capacity.toUpperCase()
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // If we somehow still get a duplicate error, just ignore it
          set({ isLoading: false });
          return;
        }
        throw error;
      }

      const variants = get().variants;
      set({ 
        variants: [...variants, data],
        isLoading: false 
      });
    } catch (error) {
      console.error('Error in addVariant:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de la variante',
        isLoading: false 
      });
    }
  },

  addVariants: async (variants) => {
    set({ isLoading: true, error: null });
    try {
      // Process variants in batches to avoid conflicts
      for (const variant of variants) {
        try {
          await get().addVariant(variant);
        } catch (error) {
          console.warn('Error adding variant, continuing with next:', error);
        }
      }

      await get().fetchVariants();
    } catch (error) {
      console.error('Error in addVariants:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout des variantes',
        isLoading: false 
      });
    }
  },

  deleteVariant: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const variants = get().variants.filter(variant => variant.id !== id);
      set({ variants, isLoading: false });
    } catch (error) {
      console.error('Error in deleteVariant:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression de la variante',
        isLoading: false 
      });
    }
  },
}));