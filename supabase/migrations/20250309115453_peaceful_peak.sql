/*
  # Fix Product Categories RLS Policies

  1. Changes
    - Drop existing policies
    - Create new comprehensive RLS policies for all operations
    - Ensure authenticated users have full access

  2. Security
    - Enable RLS
    - Add policies for all CRUD operations
    - Restrict access to authenticated users only
*/

-- First, drop any existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON product_categories;

-- Create new comprehensive policies
CREATE POLICY "Enable full access for authenticated users"
  ON product_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);