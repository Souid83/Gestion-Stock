/**
 * Order Store
 * Zustand store for managing orders
 */

import { create } from 'zustand';

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  total_ht: number;
  total_ttc: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  order_date: string;
  created_at?: string;
}

interface OrderStore {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<Order, 'id' | 'created_at'>) => Promise<void>;
  updateOrder: (id: string, order: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    console.log('[OrderStore] Fetching orders');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ orders: [], isLoading: false });
    } catch (error) {
      console.error('[OrderStore] Error fetching orders:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des commandes',
        isLoading: false,
      });
    }
  },

  addOrder: async (order) => {
    console.log('[OrderStore] Adding order:', order);
    // TODO: Implement actual add to Supabase
  },

  updateOrder: async (id, order) => {
    console.log('[OrderStore] Updating order:', id, order);
    // TODO: Implement actual update in Supabase
  },

  deleteOrder: async (id) => {
    console.log('[OrderStore] Deleting order:', id);
    // TODO: Implement actual delete from Supabase
  },
}));
