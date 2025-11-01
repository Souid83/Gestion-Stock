/*
  # Add vat_regime column to products table

  1. Changes
    - Add `vat_regime` column to `products` table
      - Type: vat_regime enum (NORMAL, MARGE)
      - Nullable: true (existing products won't have this value initially)
      - Default: NULL

  2. Purpose
    - Allows storing VAT regime information directly on products
    - Fixes error "column products_1.vat_regime does not exist"
    - Enables direct querying of VAT regime without complex joins
    - Supports consignments system integration

  3. Notes
    - The vat_regime enum type already exists (created by consignments_system migration)
    - Existing products will have NULL value until populated
    - New products can specify their VAT regime at creation
    - This field can be populated from consignment_moves history if needed
*/

-- Add vat_regime column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'vat_regime'
  ) THEN
    ALTER TABLE products ADD COLUMN vat_regime public.vat_regime DEFAULT NULL;
    
    -- Add index for query performance
    CREATE INDEX IF NOT EXISTS idx_products_vat_regime ON products(vat_regime) WHERE vat_regime IS NOT NULL;
    
    -- Log the change
    RAISE NOTICE 'Added vat_regime column to products table';
  END IF;
END $$;