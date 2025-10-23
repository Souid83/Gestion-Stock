import { supabase } from "../lib/supabase";

/**
 * Met à jour le stock partagé d'un produit.
 * @param productId L'ID du produit concerné
 * @param delta Le nombre à ajouter (positif) ou retirer (négatif) du stock
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export async function updateStock(productId: string, delta: number): Promise<{ success: boolean; error?: string }> {
  // 1. Récupérer le shared_stock_id du produit
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("shared_stock_id")
    .eq("id", productId)
    .single();

  // Vérification stricte du type et de la présence du champ
  if (
    productError ||
    !product ||
    typeof product !== "object" ||
    "code" in product ||
    !("shared_stock_id" in product) ||
    !product.shared_stock_id
  ) {
    return { success: false, error: "Produit ou shared_stock_id introuvable" };
  }

  // 2. Récupérer la quantité actuelle
  const { data: stock, error: stockError } = await supabase
    .from("shared_stocks")
    .select("quantity")
    .eq("id", product.shared_stock_id)
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
    .from("shared_stocks")
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq("id", product.shared_stock_id);

  if (updateError) {
    return { success: false, error: "Erreur lors de la mise à jour du stock" };
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
    .from("products")
    .select("shared_stock_id")
    .eq("sku", sku)
    .single();

  if (
    error ||
    !data ||
    typeof data !== "object" ||
    "code" in data ||
    !("shared_stock_id" in data) ||
    !data.shared_stock_id
  ) {
    return null;
  }
  return data.shared_stock_id;
}
