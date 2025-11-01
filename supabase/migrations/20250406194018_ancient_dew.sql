/*
  # Fix SKU constraint for parent/child products

  1. Changes
    - Drop existing unique constraint on SKU
    - Add new composite unique constraint on (sku, parent_id)
    - This allows child products to share the same SKU as their parent
  
  2. Notes
    - Parent products have parent_id = NULL
    - Child products have parent_id pointing to their parent
    - The constraint ensures uniqueness within each group
*/

-- Drop the existing unique constraint on SKU
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;

-- Add new composite unique constraint
ALTER TABLE products ADD CONSTRAINT products_sku_parent_id_key UNIQUE (sku, parent_id);