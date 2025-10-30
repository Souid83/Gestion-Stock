/*
  # Fix Stock Groups RLS Policies

  1. Changes
    - Drop existing RLS policies for stock_groups table
    - Create new comprehensive RLS policies
    - Allow authenticated users to perform all operations
  
  2. Security
    - Enable RLS
    - Add policies for all CRUD operations
    - Restrict access to authenticated users
*/

-- First, enable RLS if not already enabled
ALTER TABLE stock_groups ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Allow all" ON stock_groups;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON stock_groups;
DROP POLICY IF EXISTS "Enable read access for all users" ON stock_groups;
DROP POLICY IF EXISTS "Enable insert access for all users" ON stock_groups;
DROP POLICY IF EXISTS "Enable update access for all users" ON stock_groups;
DROP POLICY IF EXISTS "Enable delete access for all users" ON stock_groups;

-- Create new comprehensive RLS policies
CREATE POLICY "Allow authenticated users to read stock groups"
  ON stock_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert stock groups"
  ON stock_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update stock groups"
  ON stock_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete stock groups"
  ON stock_groups
  FOR DELETE
  TO authenticated
  USING (true);