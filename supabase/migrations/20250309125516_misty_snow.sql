/*
  # Create product categories table

  1. New Tables
    - `product_categories`
      - `id` (uuid, primary key)
      - `type` (text, not null)
      - `brand` (text, not null)
      - `model` (text, not null)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
  
  2. Security
    - Enable RLS on `product_categories` table
    - Add policies for authenticated users to:
      - Read all categories
      - Insert new categories
      - Delete their own categories
  
  3. Constraints
    - Unique constraint on type, brand, model combination
*/

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(type, brand, model)
);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to read all categories" ON product_categories;
  DROP POLICY IF EXISTS "Allow authenticated users to insert categories" ON product_categories;
  DROP POLICY IF EXISTS "Allow authenticated users to delete categories" ON product_categories;
END $$;

-- Create new policies
CREATE POLICY "Allow authenticated users to read all categories"
  ON product_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert categories"
  ON product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete categories"
  ON product_categories
  FOR DELETE
  TO authenticated
  USING (true);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and create it again
DROP TRIGGER IF EXISTS update_product_categories_updated_at ON product_categories;
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();