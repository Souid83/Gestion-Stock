/*
  # Fix Product Categories RLS

  1. Changes
    - Enable RLS on product_categories table
    - Add policies for authenticated users to:
      - Select their own categories
      - Insert new categories
      - Update their categories
      - Delete their categories
*/

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all categories
CREATE POLICY "Allow authenticated users to read categories"
ON product_categories
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert categories
CREATE POLICY "Allow authenticated users to insert categories"
ON product_categories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update categories
CREATE POLICY "Allow authenticated users to update categories"
ON product_categories
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete categories
CREATE POLICY "Allow authenticated users to delete categories"
ON product_categories
FOR DELETE
TO authenticated
USING (true);