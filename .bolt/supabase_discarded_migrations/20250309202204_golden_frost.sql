/*
  # Secure products and categories tables

  1. Changes
    - Enable RLS on both tables
    - Add policies for authenticated users with admin role
    - Add policies for regular users (read-only)

  2. Security
    - Admin users can perform all operations
    - Regular users can only view data
    - Unauthenticated users have no access
*/

-- Create an admin_users table to store admin status
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin
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

-- Products table policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products read access" ON products;
DROP POLICY IF EXISTS "Products admin access" ON products;

CREATE POLICY "Products read access"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Products admin access"
  ON products
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Categories table policies
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories read access" ON product_categories;
DROP POLICY IF EXISTS "Categories admin access" ON product_categories;

CREATE POLICY "Categories read access"
  ON product_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Categories admin access"
  ON product_categories
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insert initial admin user (replace with your user's ID)
INSERT INTO admin_users (id, is_admin)
VALUES ('00000000-0000-0000-0000-000000000000', true)
ON CONFLICT (id) DO UPDATE SET is_admin = true;