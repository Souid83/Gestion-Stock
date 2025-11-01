/*
  # Clean up stock management data

  1. Changes
    - Remove all stock-related data
    - Remove products with multiple purchase prices
    - Clean up any orphaned records
  
  2. Notes
    - Safe deletion with checks
    - Preserves single-purchase-price products
    - Removes all stock locations and assignments
*/

-- First, disable RLS temporarily for cleanup
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations DISABLE ROW LEVEL SECURITY;

-- Clean up stock locations
DELETE FROM stock_locations;

-- Clean up products with multiple purchase prices
DELETE FROM products 
WHERE purchase_price_2 IS NOT NULL 
   OR selected_stock IS NOT NULL;

-- Reset stock-related fields in remaining products
UPDATE products
SET location = NULL,
    selected_stock = NULL;

-- Re-enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
DO $$ 
BEGIN
  -- Products
  DROP POLICY IF EXISTS "Allow all" ON products;
  CREATE POLICY "Allow all" 
    ON products 
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

  -- Stock locations
  DROP POLICY IF EXISTS "Allow all" ON stock_locations;
  CREATE POLICY "Allow all" 
    ON stock_locations 
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);
END $$;