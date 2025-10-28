/*
  # Fix RLS Policies for Public Access

  1. Changes
    - Drop and recreate RLS policies with correct permissions
    - Ensure public access is properly granted
    - Fix policy syntax and permissions
  
  2. Security
    - Allow public access without authentication requirements
    - Simplify policy structure
*/

-- First disable RLS to reset the state
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_boxes DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Then re-enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;

DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_categories;

DROP POLICY IF EXISTS "Enable read access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable update access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable delete access for all users" ON stock_locations;

DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable update access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON shipping_boxes;

DROP POLICY IF EXISTS "Enable read access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable insert access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable update access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable delete access for all users" ON sales_metrics;

DROP POLICY IF EXISTS "Enable read access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_stats;

DROP POLICY IF EXISTS "Enable read access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable update access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON admin_users;

-- Create simplified policies for each table
DO $$ 
BEGIN
  -- Products
  EXECUTE 'CREATE POLICY "Allow all" ON products FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Product Categories
  EXECUTE 'CREATE POLICY "Allow all" ON product_categories FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Stock Locations
  EXECUTE 'CREATE POLICY "Allow all" ON stock_locations FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Shipping Boxes
  EXECUTE 'CREATE POLICY "Allow all" ON shipping_boxes FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Sales Metrics
  EXECUTE 'CREATE POLICY "Allow all" ON sales_metrics FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Product Stats
  EXECUTE 'CREATE POLICY "Allow all" ON product_stats FOR ALL TO public USING (true) WITH CHECK (true)';
  
  -- Admin Users
  EXECUTE 'CREATE POLICY "Allow all" ON admin_users FOR ALL TO public USING (true) WITH CHECK (true)';
END $$;