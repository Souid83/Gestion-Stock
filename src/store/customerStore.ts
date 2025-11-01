/**
 * Customer Store
 * Zustand store for managing customers
 */

import { create } from 'zustand';
import type { Customer } from '../types/supabase';

interface CustomerStore {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    console.log('[CustomerStore] Fetching customers');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ customers: [], isLoading: false });
    } catch (error) {
      console.error('[CustomerStore] Error fetching customers:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des clients',
        isLoading: false,
      });
    }
  },

  addCustomer: async (customer) => {
    console.log('[CustomerStore] Adding customer:', customer);
    // TODO: Implement actual add to Supabase
  },

  updateCustomer: async (id, customer) => {
    console.log('[CustomerStore] Updating customer:', id, customer);
    // TODO: Implement actual update in Supabase
  },

  deleteCustomer: async (id) => {
    console.log('[CustomerStore] Deleting customer:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
