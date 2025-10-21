-- Add product_type (PAU/PAM) to distinguish purchase types on parent products
-- PAU = Prix d'achat unique (parent simple)
-- PAM = Parent Prix d'achat multiple sans numéro de série
-- Children (serialized or mirrors) keep product_type = NULL

-- 1) Add column if not exists
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type text;

-- 2) Backfill existing data
-- 2.a) Mark PAM for parents that either:
--      - have serialized children (child with serial_number IS NOT NULL), or
--      - have variants (JSONB array length > 0), if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'variants'
  ) THEN
    UPDATE products p
    SET product_type = 'PAM'
    WHERE p.parent_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM products c
          WHERE c.parent_id = p.id AND c.serial_number IS NOT NULL
        )
        OR COALESCE(jsonb_array_length(p.variants), 0) > 0
      );
  ELSE
    -- Fallback if 'variants' column doesn't exist: only based on serialized children
    UPDATE products p
    SET product_type = 'PAM'
    WHERE p.parent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM products c
        WHERE c.parent_id = p.id AND c.serial_number IS NOT NULL
      );
  END IF;
END $$;

-- 2.b) Mark PAU for remaining parents (no serialized children, no variants)
UPDATE products
SET product_type = 'PAU'
WHERE parent_id IS NULL
  AND product_type IS NULL;

-- 2.c) Ensure children have NULL product_type (safety)
UPDATE products
SET product_type = NULL
WHERE parent_id IS NOT NULL;

-- 3) Add integrity constraint
--    - Parents (parent_id IS NULL) must have product_type IN ('PAU','PAM')
--    - Children (parent_id IS NOT NULL) must have product_type IS NULL
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_type_check;

ALTER TABLE products ADD CONSTRAINT products_product_type_check
CHECK (
  (parent_id IS NULL AND product_type IN ('PAU','PAM'))
  OR (parent_id IS NOT NULL AND product_type IS NULL)
);

-- 4) Add partial index for filtering on parents by type
CREATE INDEX IF NOT EXISTS idx_products_product_type_parents
  ON products(product_type)
  WHERE parent_id IS NULL;

-- 5) Document the column
COMMENT ON COLUMN products.product_type IS
'PAU: prix d''achat unique (parent); PAM: parent prix d''achat multiple sans n° de série; enfants: NULL.';
