/*
  # Correction de la fonction update_stock_total

  1. Problème résolu
    - Erreur "operator does not exist: text = uuid" lors de l'insertion dans stock_produit
    - Problème de syntaxe dans la fonction trigger update_stock_total
    - Gestion incorrecte des variables NEW/OLD selon le type d'opération

  2. Corrections apportées
    - Déclaration explicite de _product_id comme uuid
    - Gestion correcte des retours OLD/NEW selon l'opération (DELETE/INSERT/UPDATE)
    - Comparaisons UUID = UUID dans toutes les clauses WHERE
    - Syntaxe robuste pour les triggers AFTER

  3. Sécurité
    - Maintien des permissions pour le rôle authenticated
    - Fonction SECURITY DEFINER pour l'exécution avec les privilèges du propriétaire
*/

-- Correction de la fonction update_stock_total
CREATE OR REPLACE FUNCTION public.update_stock_total()
RETURNS trigger AS $$
DECLARE
    _product_id uuid; -- Déclare la variable comme UUID
BEGIN
    -- Déterminer l'ID du produit affecté
    IF TG_OP = 'DELETE' THEN
        _product_id := OLD.produit_id;
    ELSE -- TG_OP est 'INSERT' ou 'UPDATE'
        _product_id := NEW.produit_id;
    END IF;

    -- Recalculer le stock total pour ce produit dans la table 'products'
    -- Assurez-vous que la comparaison est entre UUID et UUID
    UPDATE public.products
    SET stock_total = (
        SELECT COALESCE(SUM(sp.quantite), 0)
        FROM public.stock_produit sp
        WHERE sp.produit_id = _product_id -- Comparaison UUID = UUID
    )
    WHERE id = _product_id; -- Comparaison UUID = UUID

    -- Retourne la valeur appropriée pour un trigger AFTER
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assurez-vous que le rôle 'authenticated' a les droits d'exécution sur cette fonction
GRANT EXECUTE ON FUNCTION public.update_stock_total() TO authenticated;

-- Recréer le trigger pour s'assurer qu'il utilise la fonction corrigée
DROP TRIGGER IF EXISTS stock_total_update ON public.stock_produit;
CREATE TRIGGER stock_total_update 
    AFTER INSERT OR DELETE OR UPDATE ON public.stock_produit 
    FOR EACH ROW 
    EXECUTE FUNCTION update_stock_total();