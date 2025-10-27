/**
 * Sales Store
 * Zustand store for managing sales metrics and data
 */

import { create } from 'zustand';

interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
  }>;
}

interface SalesStore {
  metrics: SalesMetrics | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useSalesStore = create<SalesStore>((set) => ({
  metrics: null,
  isLoading: false,
  error: null,

  fetchMetrics: async () => {
    console.log('[SalesStore] Fetching metrics');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual metrics fetching from Supabase
      // For now, return mock data
      const mockMetrics: SalesMetrics = {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        topProducts: [],
      };

      console.log('[SalesStore] Metrics fetched:', mockMetrics);
      set({ metrics: mockMetrics, isLoading: false });
    } catch (error) {
      console.error('[SalesStore] Error fetching metrics:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des métriques',
        isLoading: false,
      });
    }
  },
}));
