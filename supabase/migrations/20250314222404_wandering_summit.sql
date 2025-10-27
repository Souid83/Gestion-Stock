/*
  # Add raw purchase price field to products table

  1. Changes
    - Add raw_purchase_price column to products table
    - Rename purchase_price to purchase_price_with_fees for clarity
    - Update comments to clarify pricing fields
  
  2. Notes
    - Both fields use numeric(10,2) for consistent decimal handling
    - raw_purchase_price is the base price before fees
    - purchase_price_with_fees is used for margin calculations
*/

-- Add raw_purchase_price column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS raw_purchase_price numeric(10,2) DEFAULT 0;

-- Rename purchase_price to purchase_price_with_fees for clarity
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE products RENAME COLUMN purchase_price TO purchase_price_with_fees;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN products.raw_purchase_price IS 'Base purchase price before fees';
COMMENT ON COLUMN products.purchase_price_with_fees IS 'Purchase price including all fees, used for margin calculations';