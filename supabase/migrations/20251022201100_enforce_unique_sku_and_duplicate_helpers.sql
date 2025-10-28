-- Enforce global uniqueness of products.sku and provide helpers to find and clean duplicates
-- This migration is SAFE even if duplicates currently exist (uses trigger-based guards).
-- After cleanup, you can optionally add a physical UNIQUE INDEX on (sku).

BEGIN;

-- 1) Guard against creating new duplicates and mirrors reusing parent's SKU
CREATE OR REPLACE FUNCTION public.prevent_duplicate_sku()
RETURNS trigger AS $$
BEGIN
  -- SKU must be non-empty
  IF NEW.sku IS NULL OR length(btrim(NEW.sku)) = 0 THEN
    RAISE EXCEPTION 'SKU cannot be null or empty';
  END IF;

  -- Global uniqueness guard (ignores current row on update)
  IF EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.sku = NEW.sku
      AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'SKU "%" already exists', NEW.sku;
  END IF;

  -- Mirror must not reuse its parent''s SKU
  IF NEW.mirror_of IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.mirror_of AND p.sku = NEW.sku
    ) THEN
      RAISE EXCEPTION 'Mirror SKU must differ from parent SKU';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_sku ON public.products;
CREATE TRIGGER trg_prevent_duplicate_sku
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_sku();


-- 2) Helper: compute an "effective stock" for a product using multiple sources without double counting.
-- We use GREATEST of each known source to detect zero/non-zero stock robustly.
CREATE OR REPLACE FUNCTION public.effective_stock(p_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $func$
WITH sp AS (
  SELECT COALESCE(SUM(quantite),0) AS q
  FROM public.stock_produit
  WHERE produit_id = p_id
),
vw AS (
  SELECT shared_quantity
  FROM public.products_with_stock
  WHERE id = p_id
)
SELECT GREATEST(
  COALESCE((SELECT stock_total FROM public.products WHERE id = p_id), 0),
  COALESCE((SELECT stock FROM public.products WHERE id = p_id), 0),
  COALESCE((SELECT q FROM sp), 0),
  COALESCE((SELECT shared_quantity FROM vw), 0)
);
$func$;


-- 3) Views to help list and clean duplicates

-- 3a) Simple duplicate summary by SKU
CREATE OR REPLACE VIEW public.duplicate_skus AS
SELECT sku, COUNT(*) AS cnt
FROM public.products
GROUP BY sku
HAVING COUNT(*) > 1
ORDER BY cnt DESC, sku;

-- 3b) Detailed duplicate rows with stock hints
CREATE OR REPLACE VIEW public.duplicate_skus_detailed AS
WITH d AS (
  SELECT sku FROM public.products GROUP BY sku HAVING COUNT(*) > 1
)
SELECT
  p.id,
  p.sku,
  p.name,
  p.is_parent,
  p.parent_id,
  p.mirror_of,
  p.serial_number,
  COALESCE(p.stock_total, 0)  AS stock_total,
  COALESCE(p.stock, 0)        AS stock,
  COALESCE((SELECT COALESCE(SUM(quantite),0) FROM public.stock_produit WHERE produit_id = p.id), 0) AS stock_produit,
  COALESCE((SELECT shared_quantity FROM public.products_with_stock WHERE id = p.id), 0) AS shared_quantity,
  public.effective_stock(p.id) AS effective_stock,
  p.created_at,
  p.updated_at
FROM public.products p
JOIN d USING (sku)
ORDER BY p.sku, p.created_at;

-- 3c) Duplicate rows that look safe to delete (no stock and no references)
CREATE OR REPLACE VIEW public.duplicate_skus_zero_candidates AS
WITH d AS (
  SELECT sku FROM public.products GROUP BY sku HAVING COUNT(*) > 1
)
SELECT
  p.id,
  p.sku,
  p.name,
  public.effective_stock(p.id) AS effective_stock,
  p.created_at
FROM public.products p
JOIN d USING (sku)
WHERE public.effective_stock(p.id) = 0
  AND NOT EXISTS (SELECT 1 FROM public.products ch WHERE ch.parent_id = p.id OR ch.mirror_of = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.marketplace_products_map m WHERE m.product_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.lot_components lc WHERE lc.product_id = p.id)
ORDER BY p.sku, p.created_at;

COMMIT;

-- Notes:
-- - The trigger prevents any future insertion or update that would introduce a duplicate SKU.
-- - Use duplicate_skus / duplicate_skus_detailed to audit, and duplicate_skus_zero_candidates to safely delete zero-stock duplicates.
-- - After cleanup, you may enforce a physical unique index:
--     CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_sku ON public.products(sku);
--   (Only run once no duplicates remain, otherwise it will fail.)
