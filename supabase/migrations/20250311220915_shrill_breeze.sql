/*
  # Add Product Variants Table

  1. New Tables
    - `product_variants`
      - `id` (uuid, primary key)
      - `color` (text, not null)
      - `grade` (text, not null)
      - `capacity` (text, not null)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS
    - Add policies for all operations
    - Allow public access for now (matching other tables)

  3. Constraints
    - Unique constraint on color, grade, capacity combination
    - Updated at trigger
*/

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color text NOT NULL,
  grade text NOT NULL,
  capacity text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(color, grade, capacity)
);

-- Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Create simplified policy for all operations
CREATE POLICY "Allow all"
  ON product_variants
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();