import { Database } from './supabase';

// Customer types
export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

// Customer Address types
export type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];
export type CustomerAddressInsert = Database['public']['Tables']['customer_addresses']['Insert'];
export type CustomerAddressUpdate = Database['public']['Tables']['customer_addresses']['Update'];

// Extended types with joins
export interface CustomerWithAddresses extends Customer {
  addresses?: CustomerAddress[];
}