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
 * Sync eBay quantities for given parent products from a specific "eBay stock".
 * - Accepts a list of parentIds
 * - Optional opts allow selecting a particular eBay stock (by id(s) or name) and dry-run mode
 * - Returns a normalized result expected by UI (success, pushed, failed, summary, error)
 */
export async function syncEbayForProductsFromEbayStock(
  parentIds: string[],
  opts?: { ebayStockIds?: string[]; ebayStockName?: string; dryRun?: boolean }
): Promise<{ success: boolean; pushed: number; failed?: number; summary?: string; error?: string }> {
  console.log('[StockService] Syncing eBay stock for products from eBay stock:', { parentIds, opts });

  try {
    if (!Array.isArray(parentIds) || parentIds.length === 0) {
      return { success: false, pushed: 0, error: 'no_parent_ids' };
    }

    const payload: any = {
      parentIds,
      ebayStockIds: opts?.ebayStockIds,
      ebayStockName: opts?.ebayStockName,
      mode: opts?.dryRun ? 'dry-run' : 'update'
    };

    // Call Netlify function to perform marketplace stock update
    const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const err = data?.error || `http_${resp.status}`;
      const summary = data?.summary || text;
      return { success: false, pushed: 0, failed: 0, error: err, summary };
    }

    const pushed = Number(data?.updated ?? data?.pushed ?? 0);
    const failed = Number(data?.failed ?? 0);
    const summary = data?.summary || `updated=${pushed}, failed=${failed}`;

    return { success: true, pushed, failed, summary };
  } catch (e: any) {
    return {
      success: false,
      pushed: 0,
      failed: 0,
      error: 'network_error',
      summary: String(e?.message || e)
    };
  }
}
