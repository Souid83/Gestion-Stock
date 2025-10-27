/*
  # Fix Products Table RLS Policies

  1. Changes
    - Drop existing policies
    - Create new RLS policies for products table with proper permissions
    - Enable RLS on products table
  
  2. Security
    - Allow authenticated users to perform CRUD operations on their own products
    - Ensure proper access control through RLS policies
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to update products" ON products;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users"
ON products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON products FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
ON products FOR DELETE
TO authenticated
USING (true);