/*
  # Update RLS Policies for Public Access

  1. Changes
    - Drop existing policies
    - Create new public access policies for all operations
    - Apply to all tables
  
  2. Security
    - Allow public access for all operations (SELECT, INSERT, UPDATE, DELETE)
    - Remove authentication requirements
*/

-- Products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;

CREATE POLICY "Enable read access for all users"
  ON products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON products FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON products FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON products FOR DELETE
  TO public
  USING (true);

-- Product Categories table
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_categories;

CREATE POLICY "Enable read access for all users"
  ON product_categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON product_categories FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON product_categories FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON product_categories FOR DELETE
  TO public
  USING (true);

-- Stock Locations table
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable update access for all users" ON stock_locations;
DROP POLICY IF EXISTS "Enable delete access for all users" ON stock_locations;

CREATE POLICY "Enable read access for all users"
  ON stock_locations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON stock_locations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON stock_locations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON stock_locations FOR DELETE
  TO public
  USING (true);

-- Shipping Boxes table
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable update access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON shipping_boxes;

CREATE POLICY "Enable read access for all users"
  ON shipping_boxes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON shipping_boxes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON shipping_boxes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON shipping_boxes FOR DELETE
  TO public
  USING (true);

-- Sales Metrics table
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable insert access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable update access for all users" ON sales_metrics;
DROP POLICY IF EXISTS "Enable delete access for all users" ON sales_metrics;

CREATE POLICY "Enable read access for all users"
  ON sales_metrics FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON sales_metrics FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON sales_metrics FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON sales_metrics FOR DELETE
  TO public
  USING (true);

-- Product Stats table
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_stats;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_stats;

CREATE POLICY "Enable read access for all users"
  ON product_stats FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON product_stats FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON product_stats FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON product_stats FOR DELETE
  TO public
  USING (true);

-- Admin Users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable update access for all users" ON admin_users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON admin_users;

CREATE POLICY "Enable read access for all users"
  ON admin_users FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON admin_users FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON admin_users FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON admin_users FOR DELETE
  TO public
  USING (true);