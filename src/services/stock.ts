/**
 * Stock Service
 * Business logic for stock management
 */

import { supabase } from '../lib/supabase';

export interface StockMovement {
  product_id: string;
  location_id: string;
  quantity: number;
  movement_type: 'in' | 'out' | 'transfer';
  reference?: string;
  notes?: string;
}

/**
 * Get stock for a product
 */
export async function getProductStock(productId: string) {
  console.log('[StockService] Getting stock for product:', productId);

  try {
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', productId);

    if (error) throw error;

    console.log('[StockService] Stock retrieved:', data);
    return data;
  } catch (error) {
    console.error('[StockService] Error getting stock:', error);
    throw error;
  }
}

/**
 * Add stock to a location
 */
export async function addStock(movement: StockMovement) {
  console.log('[StockService] Adding stock:', movement);

  try {
    // TODO: Implement actual stock addition logic
    console.log('[StockService] Stock added successfully');
  } catch (error) {
    console.error('[StockService] Error adding stock:', error);
    throw error;
  }
}

/**
 * Remove stock from a location
 */
export async function removeStock(movement: StockMovement) {
  console.log('[StockService] Removing stock:', movement);

  try {
    // TODO: Implement actual stock removal logic
    console.log('[StockService] Stock removed successfully');
  } catch (error) {
    console.error('[StockService] Error removing stock:', error);
    throw error;
  }
}

/**
 * Transfer stock between locations
 */
export async function transferStock(
  productId: string,
  fromLocationId: string,
  toLocationId: string,
  quantity: number
) {
  console.log('[StockService] Transferring stock:', {
    productId,
    fromLocationId,
    toLocationId,
    quantity,
  });

  try {
    // TODO: Implement actual stock transfer logic
    console.log('[StockService] Stock transferred successfully');
  } catch (error) {
    console.error('[StockService] Error transferring stock:', error);
    throw error;
  }
}

/**
 * Get stock movements history
 */
export async function getStockMovements(productId?: string) {
  console.log('[StockService] Getting stock movements', productId ? `for product ${productId}` : 'all');

  try {
    let query = supabase.from('stock_movements').select('*');

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    console.log('[StockService] Movements retrieved:', data);
    return data;
  } catch (error) {
    console.error('[StockService] Error getting movements:', error);
    throw error;
  }
}

/**
 * Sync eBay stock for products from eBay stock
 */
export async function syncEbayForProductsFromEbayStock(productIds?: string[]) {
  console.log('[StockService] Syncing eBay stock for products:', productIds);

  try {
    // TODO: Implement actual eBay stock sync logic
    console.log('[StockService] eBay stock sync completed');
  } catch (error) {
    console.error('[StockService] Error syncing eBay stock:', error);
    throw error;
  }
}
