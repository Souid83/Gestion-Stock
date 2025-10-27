-- Drop the existing unique constraint on SKU
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;

-- Add new composite unique constraint
ALTER TABLE products ADD CONSTRAINT products_sku_parent_id_key UNIQUE (sku, parent_id);