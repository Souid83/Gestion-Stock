import { ProductWithStock } from '../types/supabase';

/**
 * Vérifie si un produit peut avoir des miroirs
 * Seuls les produits parents à prix d'achat unique (sans variantes) peuvent avoir des miroirs
 */
export const canHaveMirrors = (product: ProductWithStock): boolean => {
  const isParent = !!product.is_parent;
  const isNotMirrorChild = !product.mirror_of;
  // Vérifie si product.variants est null, undefined, ou un tableau vide
  const hasNoVariants = !product.variants || (Array.isArray(product.variants) && product.variants.length === 0);
  
  console.log(`Checking canHaveMirrors for product: ${product.name} (ID: ${product.id})`);
  console.log(`  - isParent: ${isParent}`);
  console.log(`  - isNotMirrorChild: ${isNotMirrorChild}`);
  console.log(`  - hasNoVariants: ${hasNoVariants} (variants: ${JSON.stringify(product.variants)})`);
  console.log(`  - Result: ${isParent && isNotMirrorChild && hasNoVariants}`);
  
  return isParent && isNotMirrorChild && hasNoVariants;
};

/**
 * Vérifie si un produit est un parent miroir
 */
export const isMirrorParent = (product: ProductWithStock): boolean => {
  return canHaveMirrors(product) && !!product.shared_stock_id;
};

/**
 * Vérifie si un produit est un enfant miroir
 */
export const isMirrorChild = (product: ProductWithStock): boolean => {
  return !!product.mirror_of;
};

/**
 * Compte le nombre de miroirs d'un produit parent
 */
export const getMirrorCount = async (parentId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('mirror_of', parentId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error counting mirrors:', error);
    return 0;
  }
};

/**
 * Formate l'affichage du stock avec le lieu
 */
export const formatStockDisplay = (product: ProductWithStock): string => {
  const stock = product.shared_quantity || product.stock || 0;
  const location = product.location || product.selected_stock || 'Non défini';
  return `${stock} en stock - ${location}`;
};

/**
 * Vérifie si un produit peut être modifié (pas un miroir enfant)
 */
export const canEditProduct = (product: ProductWithStock): boolean => {
  return !isMirrorChild(product);
};

/**
 * Retourne le message d'alerte pour les miroirs enfants
 */
export const getMirrorEditAlert = (parentName: string): string => {
  return `Ce produit est un miroir de "${parentName}". Seul le nom peut être modifié. Pour modifier les autres propriétés, veuillez éditer le produit parent.`;
};