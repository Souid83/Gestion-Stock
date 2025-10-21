import { Database } from '../types/supabase';

interface MockResponse<T> {
  data: T | null;
  error: Error | null;
}

class MockDataService {
  private data = {
    sales_metrics: [
      {
        id: '1',
        metric_type: 'daily',
        target: 1000,
        revenue: 750,
        estimated_profit: 250,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        metric_type: 'weekly',
        target: 7000,
        revenue: 5250,
        estimated_profit: 1750,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        metric_type: 'monthly',
        target: 30000,
        revenue: 22500,
        estimated_profit: 7500,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    product_stats: [
      {
        id: '1',
        total_orders: 150,
        synced_products: 3000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };

  from(table: string) {
    const query = {
      data: this.data[table as keyof typeof this.data] || [],
      filters: [] as Array<(item: any) => boolean>,
      select: function() {
        return this;
      },
      eq: function(column: string, value: any) {
        this.filters.push((item: any) => item[column] === value);
        return this;
      },
      single: function(): MockResponse<any> {
        try {
          let result = this.data;
          for (const filter of this.filters) {
            result = result.filter(filter);
          }
          return { 
            data: result[0] || null, 
            error: null 
          };
        } catch (error) {
          return { 
            data: null, 
            error: error as Error 
          };
        }
      }
    };
    
    return query;
  }
}

export const mockData = new MockDataService();