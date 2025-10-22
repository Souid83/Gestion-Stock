/*
  # Update Products Table Schema

  1. Changes
    - Add new fields for weight, location, EAN
    - Rename price to purchase_price
    - Add retail_price and pro_price fields
    - Add margin calculation support
  
  2. Security
    - Maintain existing RLS policies
*/

-- Update products table with new fields
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS weight_grams integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS retail_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pro_price numeric(10,2) NOT NULL DEFAULT 0;

-- Rename price to purchase_price
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'price'
  ) THEN
    ALTER TABLE products RENAME COLUMN price TO purchase_price;
  END IF;
END $$;