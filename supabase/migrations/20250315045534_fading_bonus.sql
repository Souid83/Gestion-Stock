/*
  # Fix RLS Policies for Stock Management

  1. Changes
    - Drop all existing RLS policies to avoid conflicts
    - Create new RLS policies with proper permissions
    - Ensure authenticated users can perform all operations
    - Fix policy naming conflicts
  
  2. Security
    - Enable RLS on all tables
    - Grant appropriate permissions to authenticated users
*/

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "stock_groups_crud_policy" ON stock_groups;
DROP POLICY IF EXISTS "stocks_crud_policy" ON stocks;
DROP POLICY IF EXISTS "product_stocks_crud_policy" ON product_stocks;

-- Enable RLS on all tables
ALTER TABLE stock_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for stock_groups
CREATE POLICY "stock_groups_crud_policy"
  ON stock_groups
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new RLS policies for stocks
CREATE POLICY "stocks_crud_policy"
  ON stocks
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new RLS policies for product_stocks
CREATE POLICY "product_stocks_crud_policy"
  ON product_stocks
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to authenticated users
GRANT ALL ON stock_groups TO authenticated;
GRANT ALL ON stocks TO authenticated;
GRANT ALL ON product_stocks TO authenticated;