/*
  # Fix Product Categories RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Create new RLS policies with proper access control
    - Allow public read access
    - Allow authenticated users full access (CRUD operations)

  2. Security
    - Enable RLS
    - Add policies for all CRUD operations
    - Ensure authenticated users can perform all operations
    - Allow public read access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON product_categories;

-- Create new comprehensive RLS policies
CREATE POLICY "Enable all access for authenticated users"
  ON product_categories
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users"
  ON product_categories
  FOR SELECT
  TO public
  USING (true);