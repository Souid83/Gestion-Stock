/**
 * Search Products Like List Utility
 * Search products with fuzzy matching
 */

import { supabase } from '../lib/supabase';

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  selling_price?: number;
  purchase_price?: number;
  stock_quantity?: number;
}

/**
 * Search products with like/fuzzy matching
 * @param query Search query string
 * @param limit Maximum number of results to return
 * @returns Array of matching products
 */
export async function searchProductsLikeList(
  query: string,
  limit: number = 10
): Promise<ProductSearchResult[]> {
  console.log('[searchProductsLikeList] Searching for:', query, 'limit:', limit);

  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const searchTerm = `%${query.trim()}%`;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, selling_price, purchase_price')
      .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm}`)
      .limit(limit);

    if (error) {
      console.error('[searchProductsLikeList] Error:', error);
      throw error;
    }

    console.log('[searchProductsLikeList] Found', data?.length || 0, 'results');
    return data || [];
  } catch (error) {
    console.error('[searchProductsLikeList] Search failed:', error);
    return [];
  }
}

/**
 * Search products by SKU
 */
export async function searchProductsBySKU(sku: string): Promise<ProductSearchResult | null> {
  console.log('[searchProductsBySKU] Searching for SKU:', sku);

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, selling_price, purchase_price')
      .eq('sku', sku)
      .maybeSingle();

    if (error) {
      console.error('[searchProductsBySKU] Error:', error);
      throw error;
    }

    console.log('[searchProductsBySKU] Result:', data ? 'found' : 'not found');
    return data;
  } catch (error) {
    console.error('[searchProductsBySKU] Search failed:', error);
    return null;
  }
}

/**
 * Search products by name
 */
export async function searchProductsByName(
  name: string,
  limit: number = 10
): Promise<ProductSearchResult[]> {
  console.log('[searchProductsByName] Searching for name:', name);

  try {
    const searchTerm = `%${name.trim()}%`;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, selling_price, purchase_price')
      .ilike('name', searchTerm)
      .limit(limit);

    if (error) {
      console.error('[searchProductsByName] Error:', error);
      throw error;
    }

    console.log('[searchProductsByName] Found', data?.length || 0, 'results');
    return data || [];
  } catch (error) {
    console.error('[searchProductsByName] Search failed:', error);
    return [];
  }
}
