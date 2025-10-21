/*
  # Update product_categories RLS policies

  1. Changes
    - Enable RLS on product_categories table
    - Add policies for CRUD operations:
      - Allow all users to read categories
      - Allow all users to create categories
      - Allow all users to update categories
      - Allow all users to delete categories

  2. Security
    - Enable RLS
    - Add permissive policies for all operations
*/

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_categories;

-- Create new policies
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