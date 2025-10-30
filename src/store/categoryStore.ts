/**
 * Category Store
 * Zustand store for managing product categories from Supabase (product_categories)
 *
 * Table: product_categories
 * Columns used: id (uuid), type (text), brand (text), model (text), created_at, updated_at
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Category {
  id: string;
  type: string;
  brand: string;
  model: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CategoryStore {
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  fetchCategories: () => Promise<void>;
  addCategory: (category: { type: string; brand: string; model: string }) => Promise<Category | null>;
  addCategories: (items: Array<{ type: string; brand: string; model: string }>) => Promise<number>;
  deleteCategory: (id: string) => Promise<boolean>;
}

function normalize({ type, brand, model }: { type: string; brand: string; model: string }) {
  return {
    type: (type || '').toString().trim().toUpperCase(),
    brand: (brand || '').toString().trim().toUpperCase(),
    model: (model || '').toString().trim().toUpperCase(),
  };
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    console.log('[CategoryStore] Fetching categories from product_categories');
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id,type,brand,model,created_at,updated_at')
        .order('type', { ascending: true })
        .order('brand', { ascending: true })
        .order('model', { ascending: true });

      if (error) throw error;

      const categories: Category[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        brand: row.brand,
        model: row.model,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
      }));

      set({ categories, isLoading: false, error: null });
      console.log('[CategoryStore] Loaded categories:', categories.length);
    } catch (err: any) {
      console.error('[CategoryStore] Error fetching categories:', err?.message || err);
      set({
        error: err?.message || 'Erreur lors de la récupération des catégories',
        isLoading: false,
      });
    }
  },

  addCategory: async (category) => {
    const { type, brand, model } = normalize(category);
    console.log('[CategoryStore] Adding category:', { type, brand, model });

    try {
      // Check existence to avoid duplicates if no unique constraint exists
      const { data: existing } = await supabase
        .from('product_categories')
        .select('id')
        .eq('type', type as any)
        .eq('brand', brand as any)
        .eq('model', model as any)
        .maybeSingle();

      if (existing?.id) {
        console.log('[CategoryStore] Category already exists, returning existing:', existing.id);
        return {
          id: existing.id,
          type,
          brand,
          model,
        } as Category;
      }

      const { data, error } = await supabase
        .from('product_categories')
        .insert([{ type, brand, model }] as any)
        .select('id,type,brand,model,created_at,updated_at')
        .single();

      if (error) throw error;

      const created: Category = {
        id: data.id,
        type: data.type,
        brand: data.brand,
        model: data.model,
        created_at: data.created_at ?? null,
        updated_at: data.updated_at ?? null,
      };

      // Update local state
      set((state) => ({
        categories: [...state.categories, created].sort((a, b) =>
          a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)
        ),
      }));

      return created;
    } catch (err: any) {
      console.error('[CategoryStore] Error adding category:', err?.message || err);
      set({ error: err?.message || 'Erreur lors de l\'ajout de catégorie' });
      return null;
    }
  },

  addCategories: async (items) => {
    console.log('[CategoryStore] Bulk adding categories:', items.length);
    if (!Array.isArray(items) || items.length === 0) return 0;

    // Normalize and de-duplicate by composite key
    const dedup = new Map<string, { type: string; brand: string; model: string }>();
    for (const it of items) {
      const n = normalize(it);
      const key = `${n.type}||${n.brand}||${n.model}`;
      if (!dedup.has(key)) dedup.set(key, n);
    }
    const toInsert = Array.from(dedup.values());

    let insertedCount = 0;

    // We do an existence check per item to avoid unique constraint dependency
    for (const it of toInsert) {
      try {
        const { data: existing } = await supabase
          .from('product_categories')
          .select('id')
          .eq('type', it.type as any)
          .eq('brand', it.brand as any)
          .eq('model', it.model as any)
          .maybeSingle();

        if (existing?.id) {
          continue;
        }

        const { error } = await supabase
          .from('product_categories')
          .insert([{ type: it.type, brand: it.brand, model: it.model }] as any);

        if (!error) insertedCount += 1;
      } catch (e: any) {
        console.warn('[CategoryStore] Skipping category on error:', it, e?.message || e);
      }
    }

    // Refresh list
    await get().fetchCategories();
    console.log('[CategoryStore] Bulk add completed. Inserted:', insertedCount);

    return insertedCount;
  },

  deleteCategory: async (id) => {
    console.log('[CategoryStore] Deleting category:', id);
    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id as any);

      if (error) throw error;

      // Update local state
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));

      return true;
    } catch (err: any) {
      console.error('[CategoryStore] Error deleting category:', err?.message || err);
      set({ error: err?.message || 'Erreur lors de la suppression de catégorie' });
      return false;
    }
  },
}));
