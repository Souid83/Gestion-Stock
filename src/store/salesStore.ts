import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type SalesMetric = Database['public']['Tables']['sales_metrics']['Row'];
type SalesMetricInsert = Database['public']['Tables']['sales_metrics']['Insert'];

interface SalesMetrics {
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  remainingDaily: number;
  remainingWeekly: number;
  remainingMonthly: number;
  totalOrders: number;
  syncedProducts: number;
  monthlyTurnover: number;
  estimatedProfit: number;
}

interface SalesStore {
  metrics: SalesMetrics;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
  addSalesMetric: (metric: Omit<SalesMetricInsert, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

const defaultMetrics = {
  target: 0,
  revenue: 0,
  estimated_profit: 0,
  sales_count: 0,
  product_name: 'N/A',
  period: new Date().toISOString().slice(0, 7), // YYYY-MM format
};

export const useSalesStore = create<SalesStore>((set, get) => ({
  metrics: {
    dailyTarget: 0,
    weeklyTarget: 0,
    monthlyTarget: 0,
    dailyRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    remainingDaily: 0,
    remainingWeekly: 0,
    remainingMonthly: 0,
    totalOrders: 0,
    syncedProducts: 0,
    monthlyTurnover: 0,
    estimatedProfit: 0,
  },
  isLoading: false,
  error: null,

  fetchMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch daily metrics
      const { data: dailyData, error: dailyError } = await supabase
        .from('sales_metrics')
        .select('*')
        .eq('metric_type', 'daily')
        .maybeSingle();

      if (dailyError) throw dailyError;

      // Fetch weekly metrics
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('sales_metrics')
        .select('*')
        .eq('metric_type', 'weekly')
        .maybeSingle();

      if (weeklyError) throw weeklyError;

      // Fetch monthly metrics
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('sales_metrics')
        .select('*')
        .eq('metric_type', 'monthly')
        .maybeSingle();

      if (monthlyError) throw monthlyError;

      // Fetch product stats
      const { data: productStats, error: statsError } = await supabase
        .from('product_stats')
        .select('*')
        .maybeSingle();

      if (statsError) throw statsError;

      const daily = { ...defaultMetrics, ...dailyData };
      const weekly = { ...defaultMetrics, ...weeklyData };
      const monthly = { ...defaultMetrics, ...monthlyData };
      const stats = productStats || { total_orders: 0, synced_products: 0 };

      set({
        metrics: {
          dailyTarget: daily.target,
          weeklyTarget: weekly.target,
          monthlyTarget: monthly.target,
          dailyRevenue: daily.revenue,
          weeklyRevenue: weekly.revenue,
          monthlyRevenue: monthly.revenue,
          remainingDaily: daily.target - daily.revenue,
          remainingWeekly: weekly.target - weekly.revenue,
          remainingMonthly: monthly.target - monthly.revenue,
          totalOrders: stats.total_orders,
          syncedProducts: stats.synced_products,
          monthlyTurnover: monthly.revenue,
          estimatedProfit: monthly.estimated_profit,
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addSalesMetric: async (metric) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('sales_metrics')
        .insert([metric]);

      if (error) throw error;
      await get().fetchMetrics();
    } catch (error) {
      console.error('Error adding sales metric:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));