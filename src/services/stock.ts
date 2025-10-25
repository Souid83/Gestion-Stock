import { supabase } from "../lib/supabase";

/**
 * Pousse les quantités App (mirror_stock) vers eBay pour les produits donnés.
 * - Regroupe par compte eBay déjà mappé (marketplace_products_map)
 * - Lit mirror_stock depuis la vue clear_products_with_stock
 * - Appelle la Netlify function marketplaces-stock-update par lots
 */
export async function syncEbayForProducts(productIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return { success: true };
    }

    // Charger mirror_stock et sku
    const { data: clearRows, error: clearErr } = await supabase
      .from('clear_products_with_stock' as any)
      .select('id, mirror_stock')
      .in('id', productIds as any);

    if (clearErr) {
      console.warn('syncEbayForProducts: clear_products_with_stock error', clearErr);
    }

    const mirrorById: Record<string, number> = {};
    (clearRows || []).forEach((r: any) => {
      if (r && r.id && typeof r.mirror_stock === 'number') {
        mirrorById[r.id] = r.mirror_stock;
      }
    });

    // Récupérer mapping eBay (SKU distant + comptes)
    const { data: maps, error: mapErr } = await supabase
      .from('marketplace_products_map' as any)
      .select('product_id, remote_sku, marketplace_account_id')
      .eq('provider' as any, 'ebay' as any)
      .in('product_id', productIds as any);

    if (mapErr) {
      console.warn('syncEbayForProducts: marketplace_products_map error', mapErr);
      return { success: false, error: mapErr.message || 'map_error' };
    }

    // Grouper par compte
    const byAccount: Record<string, { sku: string; quantity: number }[]> = {};
    (maps || []).forEach((m: any) => {
      const q = mirrorById[m.product_id];
      if (m?.marketplace_account_id && m?.remote_sku && typeof q === 'number') {
        if (!byAccount[m.marketplace_account_id]) byAccount[m.marketplace_account_id] = [];
        byAccount[m.marketplace_account_id].push({ sku: m.remote_sku, quantity: q });
      }
    });

    const accounts = Object.keys(byAccount);
    for (const accId of accounts) {
      const items = byAccount[accId];
      // Batch par 100
      for (let i = 0; i < items.length; i += 100) {
        const chunk = items.slice(i, i + 100);
        const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accId, items: chunk })
        });
        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          console.warn('syncEbayForProducts: stock-update failed', accId, resp.status, t.substring(0, 200));
          // Continuer avec les autres comptes/batches
        }
      }
    }

    return { success: true };
  } catch (e: any) {
    console.warn('syncEbayForProducts exception', e?.message || e);
    return { success: false, error: e?.message || 'unknown' };
  }
}

/**
 * Met à jour le stock partagé d'un produit.
 * @param productId L'ID du produit concerné
 * @param delta Le nombre à ajouter (positif) ou retirer (négatif) du stock
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export async function updateStock(productId: string, delta: number): Promise<{ success: boolean; error?: string }> {
  // 1. Récupérer le shared_stock_id du produit
  const { data: product, error: productError } = await supabase
    .from("products" as any)
    .select("shared_stock_id")
    .eq("id" as any, productId as any)
    .single();
  const productRow: any = product;

  // Vérification stricte du type et de la présence du champ
  if (
    productError ||
    !productRow ||
    typeof productRow !== "object" ||
    "code" in (productRow as any) ||
    !(productRow && productRow.shared_stock_id)
  ) {
    return { success: false, error: "Produit ou shared_stock_id introuvable" };
  }

  // 2. Récupérer la quantité actuelle
  const { data: stock, error: stockError } = await supabase
    .from("shared_stocks")
    .select("quantity")
    .eq("id", (productRow as any).shared_stock_id)
    .single();

  if (
    stockError ||
    !stock ||
    typeof stock !== "object" ||
    "code" in stock ||
    !("quantity" in stock) ||
    typeof stock.quantity !== "number"
  ) {
    return { success: false, error: "Stock partagé introuvable" };
  }

  const newQuantity = stock.quantity + delta;
  if (newQuantity < 0) {
    return { success: false, error: "Stock insuffisant" };
  }

  // 3. Mettre à jour la quantité
  const { error: updateError } = await supabase
    .from("shared_stocks" as any)
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() } as any)
    .eq("id" as any, productRow.shared_stock_id as any);

  if (updateError) {
    return { success: false, error: "Erreur lors de la mise à jour du stock" };
  }

  // 4. Sync eBay auto (si le produit est déjà mappé) — best effort
  try {
    await syncEbayForProducts([productId]);
  } catch {
    // ignorer silencieusement
  }

  return { success: true };
}

/**
 * Récupère le shared_stock_id à partir d'un SKU produit.
 * @param sku
 * @returns {Promise<string | null>}
 */
export async function getSharedStockIdFromSku(sku: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("products" as any)
    .select("shared_stock_id")
    .eq("sku" as any, sku as any)
    .single();

  const dataRow: any = data;
  if (
    error ||
    !dataRow ||
    typeof dataRow !== "object" ||
    "code" in dataRow ||
    !(dataRow && dataRow.shared_stock_id)
  ) {
    return null;
  }
  return dataRow.shared_stock_id;
}

/**
 * Pousse vers eBay la quantité issue EXCLUSIVEMENT du stock EBAY (multi-stocks) pour des parents donnés.
 * - parentOnly: on lit stock_produit uniquement sur le parent (les miroirs n'ont pas de lignes stock_produit)
 * - On pousse la même qty du parent pour tout le mapping eBay de la "famille" (parent + miroirs non sérialisés)
 * - Regroupe par compte eBay (marketplace_account_id) et envoie par lots de 100 vers /.netlify/functions/marketplaces-stock-update
 */
export async function syncEbayForProductsFromEbayStock(
  parentIds: string[],
  opts?: { ebayStockIds?: string[]; ebayStockName?: string }
): Promise<{ success: boolean; pushed: number; error?: string }> {
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
            body: JSON.stringify({ account_id: accId, items: chunk })
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
                if (ok) totalUpdated += 1;
                else {
                  totalFailed += 1;
                  const errs = Array.isArray(r?.errors) ? r.errors : [];
                  if (errs.some((e: any) => String(e?.message || '').includes('token_expired'))) {
                    sawTokenExpired = true;
                  }
                }
              });
            } else {
              // Considérer tout le batch en échec
              totalFailed += chunk.length;
            }
            console.warn('syncEbayForProductsFromEbayStock: stock-update failed', accId, resp.status, raw?.substring(0, 200));
          } else {
            // OK: compter updated/failed depuis le payload
            const updated = Number(json?.updated || 0);
            const failed = Number(json?.failed || 0);
            totalUpdated += isFinite(updated) ? updated : 0;
            totalFailed += isFinite(failed) ? failed : 0;

            const arr = Array.isArray(json?.results) ? json.results : [];
            if (arr.length > 0) {
              if (arr.some((r: any) => Array.isArray(r?.errors) && r.errors.some((e: any) => String(e?.message || '').includes('token_expired')))) {
                sawTokenExpired = true;
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

    return { success, pushed: totalUpdated, error };
  } catch (e: any) {
    console.warn('syncEbayForProductsFromEbayStock exception', e?.message || e);
    return { success: false, pushed: 0, error: e?.message || 'unknown' };
  }
}
