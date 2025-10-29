/*
  # Update RLS Policies for Public Access

  1. Changes
    - Allow public access for products and categories
    - Keep admin-only access for other tables
    - Drop existing policies to avoid conflicts
  
  2. Security
    - Products and categories: public access
    - Other tables: admin-only access with RLS
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "products_read_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;
DROP POLICY IF EXISTS "categories_read_policy" ON product_categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON product_categories;
DROP POLICY IF EXISTS "categories_update_policy" ON product_categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON product_categories;

-- Products: Allow public access
CREATE POLICY "Enable read access for all users"
  ON products
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON products
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON products
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON products
  FOR DELETE
  TO public
  USING (true);

-- Categories: Allow public access
CREATE POLICY "Enable read access for all users"
  ON product_categories
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON product_categories
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON product_categories
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON product_categories
  FOR DELETE
  TO public
  USING (true);

-- Keep other tables secure with admin-only access

-- Stock Locations
DROP POLICY IF EXISTS "locations_read_policy" ON stock_locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON stock_locations;
DROP POLICY IF EXISTS "locations_update_policy" ON stock_locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON stock_locations;

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

-- Shipping Boxes
DROP POLICY IF EXISTS "boxes_read_policy" ON shipping_boxes;
DROP POLICY IF EXISTS "boxes_insert_policy" ON shipping_boxes;
DROP POLICY IF EXISTS "boxes_update_policy" ON shipping_boxes;
DROP POLICY IF EXISTS "boxes_delete_policy" ON shipping_boxes;

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

-- Sales Metrics
DROP POLICY IF EXISTS "metrics_read_policy" ON sales_metrics;
DROP POLICY IF EXISTS "metrics_insert_policy" ON sales_metrics;
DROP POLICY IF EXISTS "metrics_update_policy" ON sales_metrics;
DROP POLICY IF EXISTS "metrics_delete_policy" ON sales_metrics;

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

-- Product Stats
DROP POLICY IF EXISTS "stats_read_policy" ON product_stats;
DROP POLICY IF EXISTS "stats_insert_policy" ON product_stats;
DROP POLICY IF EXISTS "stats_update_policy" ON product_stats;
DROP POLICY IF EXISTS "stats_delete_policy" ON product_stats;

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