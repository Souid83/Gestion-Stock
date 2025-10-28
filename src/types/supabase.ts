/**
 * Supabase Types
 * TypeScript type definitions for database entities
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  category_id?: string;
  purchase_price?: number;
  selling_price?: number;
  tax_rate?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  product_type?: string;
  is_obsolete?: boolean;
}

export interface StockLocation {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Stock {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductWithStock extends Product {
  stock?: Stock[];
  total_quantity?: number;
  available_quantity?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  role: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}
