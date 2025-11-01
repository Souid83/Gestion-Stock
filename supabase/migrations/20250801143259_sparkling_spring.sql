/*
  # Fix UUID types and foreign key constraints for stock_produit table

  1. Column Type Fixes
    - Ensure `produit_id` is of type `uuid`
    - Ensure `stock_id` is of type `uuid`
    - Convert existing data safely without loss

  2. Foreign Key Constraints
    - Drop existing foreign key constraints if they exist
    - Recreate foreign key constraints with proper UUID types
    - Add ON DELETE CASCADE for data integrity
*/

-- First, check and fix column types if needed
DO $$
BEGIN
  -- Fix produit_id column type if it's not uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_produit' 
    AND column_name = 'produit_id' 
    AND data_type != 'uuid'
  ) THEN
    ALTER TABLE stock_produit 
    ALTER COLUMN produit_id TYPE uuid USING produit_id::uuid;
  END IF;

  -- Fix stock_id column type if it's not uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_produit' 
    AND column_name = 'stock_id' 
    AND data_type != 'uuid'
  ) THEN
    ALTER TABLE stock_produit 
    ALTER COLUMN stock_id TYPE uuid USING stock_id::uuid;
  END IF;
END $$;

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
  -- Drop foreign key constraint for produit_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'stock_produit' 
    AND constraint_name = 'stock_produit_produit_id_fkey'
  ) THEN
    ALTER TABLE stock_produit DROP CONSTRAINT stock_produit_produit_id_fkey;
  END IF;

  -- Drop foreign key constraint for stock_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'stock_produit' 
    AND constraint_name = 'stock_produit_stock_id_fkey'
  ) THEN
    ALTER TABLE stock_produit DROP CONSTRAINT stock_produit_stock_id_fkey;
  END IF;
END $$;

-- Recreate foreign key constraints with proper types and CASCADE
ALTER TABLE stock_produit 
ADD CONSTRAINT stock_produit_produit_id_fkey 
FOREIGN KEY (produit_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE stock_produit 
ADD CONSTRAINT stock_produit_stock_id_fkey 
FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE;