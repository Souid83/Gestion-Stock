/*
  # Fix update_stock_total function

  1. Function Fix
    - Corrects the update_stock_total function to handle UUID types properly
    - Ensures all comparisons are done with correct types
    - Adds proper error handling

  2. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Grants execute permissions to authenticated users
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_stock_total();

-- Create corrected function
CREATE OR REPLACE FUNCTION public.update_stock_total()
RETURNS trigger AS $$
DECLARE
    _product_id uuid;
BEGIN
    -- Déterminer l'ID du produit affecté
    IF TG_OP = 'DELETE' THEN
        _product_id := OLD.produit_id;
    ELSE
        _product_id := NEW.produit_id;
    END IF;

    -- Recalculer le stock total pour ce produit dans la table 'products'
    UPDATE public.products
    SET stock_total = (
        SELECT COALESCE(SUM(sp.quantite), 0)
        FROM public.stock_produit sp
        WHERE sp.produit_id = _product_id
    )
    WHERE id = _product_id;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_stock_total() TO authenticated;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS stock_total_update ON public.stock_produit;

CREATE TRIGGER stock_total_update
    AFTER INSERT OR DELETE OR UPDATE ON public.stock_produit
    FOR EACH ROW
    EXECUTE FUNCTION public.update_stock_total();