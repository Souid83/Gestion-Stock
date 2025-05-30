/*
  # Create Product Categories Table with RLS

  1. New Tables
    - `product_categories`
      - `id` (uuid, primary key)
      - `type` (text, not null) - Product type (e.g., SMARTPHONE)
      - `brand` (text, not null) - Brand name (e.g., APPLE)
      - `model` (text, not null) - Model name (e.g., IPHONE 14)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `product_categories` table
    - Add policies for all CRUD operations
    - Allow public access for read operations
    - Allow authenticated users for write operations

  3. Constraints
    - Unique constraint on type, brand, model combination
    - Updated at trigger
*/

-- Create the product_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(type, brand, model)
);

-- Enable Row Level Security
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON product_categories;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON product_categories;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON product_categories;

-- Create RLS Policies
CREATE POLICY "Enable read access for all users"
  ON product_categories
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON product_categories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
  ON product_categories
  FOR DELETE
  TO authenticated
  USING (true);

-- Create or replace the updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_product_categories_updated_at ON product_categories;

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();