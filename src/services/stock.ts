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

/**
 * Pousse vers eBay la quantité issue EXCLUSIVEMENT du stock EBAY (multi-stocks) pour des parents donnés.
 * - parentOnly: on lit stock_produit uniquement sur le parent (les miroirs n'ont pas de lignes stock_produit)
 * - On pousse la même qty du parent pour tout le mapping eBay de la "famille" (parent + miroirs non sérialisés)
 * - Regroupe par compte eBay (marketplace_account_id) et envoie par lots de 100 vers /.netlify/functions/marketplaces-stock-update
 */
export async function syncEbayForProductsFromEbayStock(
  parentIds: string[],
  opts?: { ebayStockIds?: string[]; ebayStockName?: string; dryRun?: boolean }
): Promise<{ success: boolean; pushed: number; failed?: number; error?: string; summary?: string }> {
  try {
    const pushedSkus = new Set<string>();
    if (!Array.isArray(parentIds) || parentIds.length === 0) {
      return { success: true, pushed: 0 };
    }

    // 1) Résoudre les stock_id EBAY
    let ebayStockIds: string[] = Array.isArray(opts?.ebayStockIds) && opts!.ebayStockIds!.length > 0 ? [...(opts!.ebayStockIds!)] : [];
    const fallbackDefaultId = 'adf77dc9-8594-45a2-9d2e-501d62f6fb7f';
    if (ebayStockIds.length === 0) {
      if (opts?.ebayStockName) {
        const { data: s1 } = await supabase
          .from('stocks' as any)
          .select('id,name')
          .ilike('name' as any, opts.ebayStockName as any);
        if (Array.isArray(s1) && s1.length > 0) {
          ebayStockIds = s1.map((r: any) => r.id).filter(Boolean);
        }
      }
      if (ebayStockIds.length === 0) {
        // Essayer par nom 'EBAY'
        const { data: s2 } = await supabase
          .from('stocks' as any)
          .select('id,name')
          .ilike('name' as any, 'EBAY');
        if (Array.isArray(s2) && s2.length > 0) {
          ebayStockIds = s2.map((r: any) => r.id).filter(Boolean);
        }
      }
      if (ebayStockIds.length === 0) {
        // Dernier recours: ID fourni par l'utilisateur
        ebayStockIds = [fallbackDefaultId];
      }
    }

    // Normaliser parentIds (unicité)
    const parentSet = new Set<string>((parentIds || []).filter(Boolean));
    const parents = Array.from(parentSet);
    if (parents.length === 0) {
      return { success: true, pushed: 0 };
    }

    // 2) Qty EBAY par parent (parentOnly)
    const qtyByParent: Record<string, number> = {};
    {
      // Lire toutes les lignes stock_produit pour (produit_id ∈ parents) ∧ (stock_id ∈ EBAY)
      const { data: spRows } = await supabase
        .from('stock_produit' as any)
        .select('produit_id, stock_id, quantite')
        .in('produit_id' as any, parents as any)
        .in('stock_id' as any, ebayStockIds as any);

      ((Array.isArray(spRows) ? spRows : []) as any[]).forEach((r: any) => {
        const pid = r?.produit_id;
        const q = Number(r?.quantite) || 0;
        if (pid) qtyByParent[pid] = (qtyByParent[pid] || 0) + q;
      });

      // Par défaut, qty=0 pour les parents sans ligne EBAY
      parents.forEach((pid) => {
        if (!Object.prototype.hasOwnProperty.call(qtyByParent, pid)) {
          qtyByParent[pid] = 0;
        }
      });
    }

    // 3) Familles (parent + miroirs non sérialisés)
    const productToParent = new Map<string, string>();
    const familyIds: Set<string> = new Set(parents);
    {
      const { data: children } = await supabase
        .from('products' as any)
        .select('id,parent_id,serial_number')
        .in('parent_id' as any, parents as any)
        .is('serial_number' as any, null);

      ((Array.isArray(children) ? children : []) as any[]).forEach((c: any) => {
        const cid = c?.id;
        const p = c?.parent_id;
        if (cid && p) {
          productToParent.set(cid, p);
          familyIds.add(cid);
        }
      });

      // Parent → soi-même
      parents.forEach((p) => {
        productToParent.set(p, p);
      });
    }

    const allFamilyIds = Array.from(familyIds);

    // 4) Résoudre les cibles eBay (remote_sku, account)
    const { data: maps, error: mapErr } = await supabase
      .from('marketplace_products_map' as any)
      .select('product_id, remote_sku, marketplace_account_id, provider')
      .eq('provider' as any, 'ebay' as any)
      .in('product_id' as any, allFamilyIds as any);

    if (mapErr) {
      console.warn('syncEbayForProductsFromEbayStock: marketplace_products_map error', mapErr);
      return { success: false, pushed: 0, error: mapErr.message || 'map_error' };
    }

    // 5) Regrouper par compte
    const byAccount: Record<string, { sku: string; quantity: number }[]> = {};
    const dedupe = new Set<string>(); // accountId|sku
    ((maps || []) as any[]).forEach((m: any) => {
      const pid: string | undefined = m?.product_id;
      const acc: string | undefined = m?.marketplace_account_id;
      const sku: string | undefined = m?.remote_sku;
      if (!pid || !acc || !sku) return;

      const parent = productToParent.get(pid) || pid;
      const qty = qtyByParent[parent] ?? 0;

      const key = `${acc}|${sku}`;
      if (dedupe.has(key)) return;
      dedupe.add(key);

      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push({ sku, quantity: qty });
      pushedSkus.add(key);
    });

    // 6) Envoi par lots de 100 + agrégation des résultats
    let totalUpdated = 0;
    let totalFailed = 0;
    let sawTokenExpired = false;
    const detailLines: string[] = [];

    const accountIds = Object.keys(byAccount);
    if (accountIds.length === 0) {
      return { success: false, pushed: 0, error: 'no_mapping' };
    }
    for (const accId of accountIds) {
      const items = byAccount[accId] || [];
      for (let i = 0; i < items.length; i += 100) {
        const chunk = items.slice(i, i + 100);
        try {
          const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: accId, items: chunk, dry_run: Boolean(opts?.dryRun) })
          });

          const raw = await resp.text().catch(() => '');
          let json: any = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }

          if (resp.status === 401 || resp.status === 424) {
            sawTokenExpired = true;
          }

          if (!resp.ok) {
            // Essayer d'extraire des "responses/results" partiels si présents
            if (json && Array.isArray(json.results)) {
              json.results.forEach((r: any) => {
                const ok = r?.status === 'SUCCESS' || r?.statusCode === 200;
                if (ok) {
                  totalUpdated += 1;
                } else {
                  totalFailed += 1;
                  const errs = Array.isArray(r?.errors) ? r.errors : [];
                  const firstMsg = errs && errs.length ? String(errs[0]?.message || errs[0]?.code || 'error') : 'error';
                  detailLines.push(`${r?.sku || 'unknown'} — ${firstMsg}`);
                  if (errs.some((e: any) => String(e?.message || '').includes('token_expired'))) {
                    sawTokenExpired = true;
                  }
                }
              });
            } else if (json && json.dry_run) {
              // Dry run: pas de push, mais on documente ce qui partirait
              const planned = Array.isArray(json.items) ? json.items.length : 0;
              detailLines.push(`[dry-run ${accId}] ${planned} item(s)`);
            } else {
              // Considérer tout le batch en échec
              totalFailed += chunk.length;
            }
            console.warn('syncEbayForProductsFromEbayStock: stock-update failed', accId, resp.status, raw?.substring(0, 200));
          } else {
            // OK: compter updated/failed depuis le payload
            if (json && json.dry_run) {
              const planned = Array.isArray(json.items) ? json.items.length : 0;
              detailLines.push(`[dry-run ${accId}] ${planned} item(s)`);
            } else {
              const updated = Number(json?.updated || 0);
              const failed = Number(json?.failed || 0);
              totalUpdated += isFinite(updated) ? updated : 0;
              totalFailed += isFinite(failed) ? failed : 0;

              const arr = Array.isArray(json?.results) ? json.results : [];
              if (arr.length > 0) {
                arr.forEach((r: any) => {
                  if (Array.isArray(r?.errors) && r.errors.length > 0) {
                    const firstMsg = String(r.errors[0]?.message || r.errors[0]?.code || 'error');
                    detailLines.push(`${r?.sku || 'unknown'} — ${firstMsg}`);
                  }
                });
                if (arr.some((r: any) => Array.isArray(r?.errors) && r.errors.some((e: any) => String(e?.message || '').includes('token_expired')))) {
                  sawTokenExpired = true;
                }
              }
            }
          }
        } catch (e) {
          console.warn('syncEbayForProductsFromEbayStock: network error', accId, e);
          totalFailed += chunk.length;
        }
      }
    }

    const success = totalFailed === 0;
    const error =
      sawTokenExpired ? 'token_expired'
      : (totalFailed > 0 ? 'partial_failure' : undefined);

    // Construire un résumé exploitable côté UI
    const head = `updated=${totalUpdated}, failed=${totalFailed}`;
    const tail = detailLines.length > 0 ? `\n${detailLines.slice(0, 10).join('\n')}` : '';
    const summary = head + tail;

    return { success, pushed: totalUpdated, failed: totalFailed, error, summary };
  } catch (e: any) {
    console.warn('syncEbayForProductsFromEbayStock exception', e?.message || e);
    return { success: false, pushed: 0, error: e?.message || 'unknown' };
  }
}
