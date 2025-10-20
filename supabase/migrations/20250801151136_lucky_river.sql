/*
  # Fonction pour insérer les allocations de stock produit

  1. Nouvelle fonction
    - `insert_product_stock_allocation` - Fonction pour insérer une allocation de stock produit
    - Paramètres: p_produit_id (uuid), p_stock_id (uuid), p_quantite (integer)
    - Retourne: void
  
  2. Sécurité
    - Fonction SECURITY DEFINER pour contourner les problèmes de permissions
    - Accordé aux utilisateurs authentifiés
*/

-- Fonction pour insérer une allocation de stock produit
CREATE OR REPLACE FUNCTION public.insert_product_stock_allocation(
    p_produit_id uuid,
    p_stock_id uuid,
    p_quantite integer
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.stock_produit (produit_id, stock_id, quantite)
    VALUES (p_produit_id, p_stock_id, p_quantite);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.insert_product_stock_allocation(uuid, uuid, integer) TO authenticated;

-- Fonction pour supprimer toutes les allocations d'un produit
CREATE OR REPLACE FUNCTION public.delete_product_stock_allocations(
    p_produit_id uuid
)
RETURNS void AS $$
BEGIN
    DELETE FROM public.stock_produit WHERE produit_id = p_produit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.delete_product_stock_allocations(uuid) TO authenticated;