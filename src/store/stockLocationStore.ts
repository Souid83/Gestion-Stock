import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type StockLocation = Database['public']['Tables']['stock_locations']['Row'];
type StockLocationInsert = Database['public']['Tables']['stock_locations']['Insert'];

interface StockLocationStore {
  locations: StockLocation[];
  isLoading: boolean;
  error: string | null;
  fetchLocations: () => Promise<void>;
  addLocation: (location: StockLocationInsert) => Promise<void>;
  updateLocation: (id: string, updates: Partial<StockLocation>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
}

export const useStockLocationStore = create<StockLocationStore>((set, get) => ({
  locations: [],
  isLoading: false,
  error: null,

  fetchLocations: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stock_locations')
        .select('*')
        .order('name');

      if (error) throw error;

      set({ locations: data || [], isLoading: false });
    } catch (error) {
      console.error('Error fetching stock locations:', error);
      set({
        error: error instanceof Error ? error.message : 'An error occurred while fetching stock locations',
        isLoading: false
      });
    }
  },

  addLocation: async (location: StockLocationInsert) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stock_locations')
        .insert([location])
        .select()
        .single();

      if (error) throw error;

      const locations = get().locations;
      set({ locations: [...locations, data], isLoading: false });
    } catch (error) {
      console.error('Error adding stock location:', error);
      set({
        error: error instanceof Error ? error.message : 'An error occurred while adding the stock location',
        isLoading: false
      });
    }
  },

  updateLocation: async (id: string, updates: Partial<StockLocation>) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stock_locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const locations = get().locations.map(location =>
        location.id === id ? { ...location, ...data } : location
      );
      set({ locations, isLoading: false });
    } catch (error) {
      console.error('Error updating stock location:', error);
      set({
        error: error instanceof Error ? error.message : 'An error occurred while updating the stock location',
        isLoading: false
      });
    }
  },

  deleteLocation: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('stock_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const locations = get().locations.filter(location => location.id !== id);
      set({ locations, isLoading: false });
    } catch (error) {
      console.error('Error deleting stock location:', error);
      set({
        error: error instanceof Error ? error.message : 'An error occurred while deleting the stock location',
        isLoading: false
      });
    }
  },
}));