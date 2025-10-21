/*
  # Fix SKU constraint for parent-child products

  1. Changes
    - Drop existing unique constraint on SKU
    - Add new composite unique constraint on (sku, parent_id)
    - This allows child products to share the same SKU as their parent
  
  2. Notes
    - Child products must have parent_id set
    - Parent products have null parent_id
    - This maintains data integrity while allowing SKU reuse
*/

-- First, drop the existing unique constraint on SKU
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;

-- Create a new composite unique constraint
-- This allows the same SKU to be used multiple times as long as parent_id is different
ALTER TABLE products 
ADD CONSTRAINT products_sku_parent_id_key UNIQUE (sku, COALESCE(parent_id, id));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);