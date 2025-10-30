/*
  # Secure database permissions

  1. Changes
    - Remove all public access
    - Enable RLS on all tables
    - Add strict policies for authenticated users only
    - Set up admin role management

  2. Security
    - Only authenticated users can read data
    - Only admins can modify data (create, update, delete)
    - No public access allowed
    - All operations require authentication
*/

-- Create admin users table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Products read access" ON products;
DROP POLICY IF EXISTS "Products admin access" ON products;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;

-- Add new strict policies
CREATE POLICY "Allow read for authenticated users only"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON products
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON products
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure product_categories table
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Categories read access" ON product_categories;
DROP POLICY IF EXISTS "Categories admin access" ON product_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete categories" ON product_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read all categories" ON product_categories;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_categories;
DROP POLICY IF EXISTS "allow_insert_authenticated" ON product_categories;
DROP POLICY IF EXISTS "allow_select_authenticated" ON product_categories;

-- Add new strict policies
CREATE POLICY "Allow read for authenticated users only"
  ON product_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON product_categories
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON product_categories
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure stock_locations table
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON stock_locations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stock_locations;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON stock_locations;

-- Add new strict policies
CREATE POLICY "Allow read for authenticated users only"
  ON stock_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON stock_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON stock_locations
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON stock_locations
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure shipping_boxes table
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_boxes;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON shipping_boxes;

-- Add new strict policies
CREATE POLICY "Allow read for authenticated users only"
  ON shipping_boxes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON shipping_boxes
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON shipping_boxes
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON shipping_boxes
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure sales_metrics table
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert sales metrics" ON sales_metrics;
DROP POLICY IF EXISTS "Allow authenticated users to read sales metrics" ON sales_metrics;

-- Add new strict policies
CREATE POLICY "Allow read for authenticated users only"
  ON sales_metrics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON sales_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON sales_metrics
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON sales_metrics
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure product_stats table
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users only"
  ON product_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for admins only"
  ON product_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow update for admins only"
  ON product_stats
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow delete for admins only"
  ON product_stats
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Secure admin_users table itself
CREATE POLICY "Allow admins to manage admin users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add policy to allow initial admin creation
CREATE POLICY "Allow first admin creation"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM admin_users));