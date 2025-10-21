/*
  # Fix UUID types in stock_produit table

  1. Schema Changes
    - Ensure produit_id and stock_id are properly typed as UUID
    - Fix any text/uuid type conflicts

  2. Data Integrity
    - Preserve existing data during type conversion
    - Ensure foreign key constraints remain valid
*/

-- First, check if we need to convert the column types
DO $$
BEGIN
  -- Fix produit_id column type if it's not UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_produit' 
    AND column_name = 'produit_id' 
    AND data_type != 'uuid'
  ) THEN
    -- Convert produit_id to UUID type
    ALTER TABLE stock_produit 
    ALTER COLUMN produit_id TYPE uuid USING produit_id::uuid;
  END IF;

  -- Fix stock_id column type if it's not UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_produit' 
    AND column_name = 'stock_id' 
    AND data_type != 'uuid'
  ) THEN
    -- Convert stock_id to UUID type
    ALTER TABLE stock_produit 
    ALTER COLUMN stock_id TYPE uuid USING stock_id::uuid;
  END IF;
END $$;

-- Ensure foreign key constraints are properly set with UUID types
DO $$
BEGIN
  -- Drop existing foreign key constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stock_produit_produit_id_fkey' 
    AND table_name = 'stock_produit'
  ) THEN
    ALTER TABLE stock_produit DROP CONSTRAINT stock_produit_produit_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stock_produit_stock_id_fkey' 
    AND table_name = 'stock_produit'
  ) THEN
    ALTER TABLE stock_produit DROP CONSTRAINT stock_produit_stock_id_fkey;
  END IF;

  -- Re-add foreign key constraints with proper UUID types
  ALTER TABLE stock_produit 
  ADD CONSTRAINT stock_produit_produit_id_fkey 
  FOREIGN KEY (produit_id) REFERENCES products(id) ON DELETE CASCADE;

  ALTER TABLE stock_produit 
  ADD CONSTRAINT stock_produit_stock_id_fkey 
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE;
END $$;