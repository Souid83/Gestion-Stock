/*
  # Fix Stock Management Migration

  1. Changes
    - Drop and recreate trigger properly
    - Fix RLS policies for product_stocks table
    - Remove invalid sequence grant
  
  2. Security
    - Enable RLS
    - Add proper policies for authenticated users
*/

-- First drop existing trigger and function to avoid conflicts
DROP TRIGGER IF EXISTS update_product_total_stock ON product_stocks;
DROP FUNCTION IF EXISTS update_product_total_stock();

-- Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION update_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE operation
  IF (TG_OP = 'DELETE') THEN
    UPDATE products
    SET total_stock = COALESCE((
      SELECT SUM(quantity)
      FROM product_stocks
      WHERE product_id = OLD.product_id
    ), 0)
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;

  -- Handle INSERT and UPDATE operations
  UPDATE products
  SET total_stock = COALESCE((
    SELECT SUM(quantity)
    FROM product_stocks
    WHERE product_id = NEW.product_id
  ), 0)
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER update_product_total_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_stocks
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_stock();

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "product_stocks_crud_policy" ON product_stocks;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON product_stocks;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_stocks;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_stocks;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_stocks;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_stocks;

-- Enable RLS
ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;

-- Create new comprehensive policy for product_stocks
CREATE POLICY "product_stocks_access_policy"
  ON product_stocks
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON product_stocks TO authenticated;
GRANT ALL ON products TO authenticated;