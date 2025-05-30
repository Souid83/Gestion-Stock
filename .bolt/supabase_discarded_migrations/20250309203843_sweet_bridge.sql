/*
  # Fix RLS Policies and Admin System

  1. Changes
    - Drop existing policies to avoid conflicts
    - Enable RLS on all tables
    - Add proper RLS policies for all tables
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read
    - Add policies for admins to manage data
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow first admin creation" ON admin_users;
DROP POLICY IF EXISTS "Allow admins to manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON products;
DROP POLICY IF EXISTS "Allow insert for admins only" ON products;
DROP POLICY IF EXISTS "Allow update for admins only" ON products;
DROP POLICY IF EXISTS "Allow delete for admins only" ON products;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON product_categories;
DROP POLICY IF EXISTS "Allow insert for admins only" ON product_categories;
DROP POLICY IF EXISTS "Allow update for admins only" ON product_categories;
DROP POLICY IF EXISTS "Allow delete for admins only" ON product_categories;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON stock_locations;
DROP POLICY IF EXISTS "Allow insert for admins only" ON stock_locations;
DROP POLICY IF EXISTS "Allow update for admins only" ON stock_locations;
DROP POLICY IF EXISTS "Allow delete for admins only" ON stock_locations;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON shipping_boxes;
DROP POLICY IF EXISTS "Allow insert for admins only" ON shipping_boxes;
DROP POLICY IF EXISTS "Allow update for admins only" ON shipping_boxes;
DROP POLICY IF EXISTS "Allow delete for admins only" ON shipping_boxes;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON sales_metrics;
DROP POLICY IF EXISTS "Allow insert for admins only" ON sales_metrics;
DROP POLICY IF EXISTS "Allow update for admins only" ON sales_metrics;
DROP POLICY IF EXISTS "Allow delete for admins only" ON sales_metrics;
DROP POLICY IF EXISTS "Allow read for authenticated users only" ON product_stats;
DROP POLICY IF EXISTS "Allow insert for admins only" ON product_stats;
DROP POLICY IF EXISTS "Allow update for admins only" ON product_stats;
DROP POLICY IF EXISTS "Allow delete for admins only" ON product_stats;

-- Secure products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read_policy"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "products_insert_policy"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "products_update_policy"
  ON products
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "products_delete_policy"
  ON products
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure product_categories table
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_read_policy"
  ON product_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "categories_insert_policy"
  ON product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "categories_update_policy"
  ON product_categories
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "categories_delete_policy"
  ON product_categories
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure stock_locations table
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_read_policy"
  ON stock_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "locations_insert_policy"
  ON stock_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "locations_update_policy"
  ON stock_locations
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "locations_delete_policy"
  ON stock_locations
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure shipping_boxes table
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boxes_read_policy"
  ON shipping_boxes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "boxes_insert_policy"
  ON shipping_boxes
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "boxes_update_policy"
  ON shipping_boxes
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "boxes_delete_policy"
  ON shipping_boxes
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure sales_metrics table
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metrics_read_policy"
  ON sales_metrics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "metrics_insert_policy"
  ON sales_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "metrics_update_policy"
  ON sales_metrics
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "metrics_delete_policy"
  ON sales_metrics
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure product_stats table
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_read_policy"
  ON product_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stats_insert_policy"
  ON product_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "stats_update_policy"
  ON product_stats
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "stats_delete_policy"
  ON product_stats
  FOR DELETE
  TO authenticated
  USING (is_admin());