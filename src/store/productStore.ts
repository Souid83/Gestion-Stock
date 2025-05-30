import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database, ProductWithStock } from '../types/supabase';

type Product = ProductWithStock;

type ProductInsert = Database['public']['Tables']['products']['Insert'];

interface ProductStore {
  products: ProductWithStock[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<ProductWithStock[] | null>;
  addProduct: (product: ProductInsert) => Promise<ProductWithStock | null>;
  addProducts: (products: ProductInsert[]) => Promise<void>;
  updateProduct: (id: string, updates: Partial<ProductWithStock>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products_with_stock')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cast explicite pour éviter les erreurs de typage
      set({ products: (data as any as ProductWithStock[]) || [], isLoading: false });
      return (data as any as ProductWithStock[]) || [];
    } catch (error) {
      console.error('Error in fetchProducts:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching products',
        isLoading: false 
      });
      return null;
    }
  },

  addProduct: async (product: ProductInsert) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select(`
          *,
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .single();

      if (error) throw error;

      const products = get().products;
      set({ products: [data, ...products], isLoading: false });
      return data;
    } catch (error) {
      console.error('Error in addProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the product',
        isLoading: false 
      });
      return null;
    }
  },

  addProducts: async (products: ProductInsert[]) => {
    set({ isLoading: true, error: null });
    try {
      for (const product of products) {
        try {
          const { error } = await supabase
            .from('products')
            .insert([product]);

          if (error) {
            console.warn(`Failed to add product with SKU "${product.sku}":`, error);
          }
        } catch (error) {
          console.warn(`Error adding product with SKU "${product.sku}":`, error);
        }
      }

      await get().fetchProducts();
      set({ isLoading: false });
    } catch (error) {
      console.error('Error in addProducts:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding products',
        isLoading: false 
      });
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          category:product_categories(
            type,
            brand,
            model
          )
        `)
        .single();

      if (error) throw error;

      const products = get().products.map(product => 
        product.id === id ? { ...product, ...data } : product
      );
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Error in updateProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while updating the product',
        isLoading: false 
      });
    }
  },

  deleteProduct: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const products = get().products.filter(product => product.id !== id);
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while deleting the product',
        isLoading: false 
      });
    }
  },
}));
