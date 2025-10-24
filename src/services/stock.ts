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
