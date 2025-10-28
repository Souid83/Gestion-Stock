/**
 * Variant Store
 * Zustand store for managing product variants from Supabase (product_variants)
 *
 * Table: product_variants
 * Columns used: id (uuid), color (text), grade (text), capacity (text), sim_type (text), created_at, updated_at
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Variant {
  id: string;
  color: string;
  grade: string;
  capacity: string;
  sim_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface VariantStore {
  variants: Variant[];
  isLoading: boolean;
  error: string | null;

  fetchVariants: () => Promise<void>;
  addVariant: (variant: { color: string; grade: string; capacity: string; sim_type?: string }) => Promise<Variant | null>;
  updateVariant: (id: string, variant: Partial<Variant>) => Promise<boolean>;
  deleteVariant: (id: string) => Promise<boolean>;
}

const normalize = (v: { color: string; grade: string; capacity: string; sim_type?: string }) => ({
  color: (v.color || '').toString().trim().toUpperCase(),
  grade: (v.grade || '').toString().trim().toUpperCase(),
  capacity: (v.capacity || '').toString().trim().toUpperCase(),
  sim_type: (v.sim_type || '').toString().trim().toUpperCase() || null
});

export const useVariantStore = create<VariantStore>((set, get) => ({
  variants: [],
  isLoading: false,
  error: null,

  fetchVariants: async () => {
    console.log('[VariantStore] Fetching variants from product_variants');
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id,color,grade,capacity,sim_type,created_at,updated_at')
        .order('color', { ascending: true })
        .order('grade', { ascending: true })
        .order('capacity', { ascending: true })
        .order('sim_type', { ascending: true });

      if (error) throw error;

      const variants: Variant[] = (data || []).map((row: any) => ({
        id: row.id,
        color: row.color,
        grade: row.grade,
        capacity: row.capacity,
        sim_type: row.sim_type ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null
      }));

      set({ variants, isLoading: false, error: null });
      console.log('[VariantStore] Loaded variants:', variants.length);
    } catch (err: any) {
      console.error('[VariantStore] Error fetching variants:', err?.message || err);
      set({
        error: err?.message || 'Erreur lors de la récupération des variantes',
        isLoading: false
      });
    }
  },

  addVariant: async (variant) => {
    const n = normalize(variant);
    console.log('[VariantStore] Adding variant:', n);

    try {
      // Avoid duplicates if no unique constraint is set in DB
      const { data: existing } = await supabase
        .from('product_variants')
        .select('id')
        .eq('color', n.color as any)
        .eq('grade', n.grade as any)
        .eq('capacity', n.capacity as any)
        .eq('sim_type', (n.sim_type ?? null) as any)
        .maybeSingle();

      if (existing?.id) {
        console.log('[VariantStore] Variant already exists:', existing.id);
        return {
          id: existing.id,
          color: n.color,
          grade: n.grade,
          capacity: n.capacity,
          sim_type: n.sim_type
        } as Variant;
      }

      const { data, error } = await supabase
        .from('product_variants')
        .insert([{ color: n.color, grade: n.grade, capacity: n.capacity, sim_type: n.sim_type }] as any)
        .select('id,color,grade,capacity,sim_type,created_at,updated_at')
        .single();

      if (error) throw error;

      const created: Variant = {
        id: data.id,
        color: data.color,
        grade: data.grade,
        capacity: data.capacity,
        sim_type: data.sim_type ?? null,
        created_at: data.created_at ?? null,
        updated_at: data.updated_at ?? null
      };

      set((state) => ({
        variants: [...state.variants, created].sort((a, b) =>
          a.color.localeCompare(b.color) ||
          a.grade.localeCompare(b.grade) ||
          a.capacity.localeCompare(b.capacity) ||
          (a.sim_type || '').localeCompare(b.sim_type || '')
        )
      }));

      return created;
    } catch (err: any) {
      console.error('[VariantStore] Error adding variant:', err?.message || err);
      set({ error: err?.message || 'Erreur lors de l\'ajout de variante' });
      return null;
    }
  },

  updateVariant: async (id, variant) => {
    const patch = normalize({
      color: (variant.color ?? '') as string,
      grade: (variant.grade ?? '') as string,
      capacity: (variant.capacity ?? '') as string,
      sim_type: (variant.sim_type ?? '') as string
    });

    try {
      const payload: any = {};
      if (variant.color !== undefined) payload.color = patch.color;
      if (variant.grade !== undefined) payload.grade = patch.grade;
      if (variant.capacity !== undefined) payload.capacity = patch.capacity;
      if (variant.sim_type !== undefined) payload.sim_type = patch.sim_type;

      if (Object.keys(payload).length === 0) return true;

      const { error } = await supabase
        .from('product_variants')
        .update(payload)
        .eq('id', id as any);

      if (error) throw error;

      set((state) => ({
        variants: state.variants.map((v) =>
          v.id === id ? { ...v, ...payload } : v
        )
      }));
      return true;
    } catch (err: any) {
      console.error('[VariantStore] Error updating variant:', err?.message || err);
      set({ error: err?.message || 'Erreur lors de la mise à jour de la variante' });
      return false;
    }
  },

  deleteVariant: async (id) => {
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id as any);

      if (error) throw error;

      set((state) => ({
        variants: state.variants.filter((v) => v.id !== id)
      }));
      return true;
    } catch (err: any) {
      console.error('[VariantStore] Error deleting variant:', err?.message || err);
      set({ error: err?.message || 'Erreur lors de la suppression de la variante' });
      return false;
    }
  }
}));
