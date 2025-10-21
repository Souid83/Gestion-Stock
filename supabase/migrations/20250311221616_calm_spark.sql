/*
  # Add variants column to products table

  1. Changes
    - Add JSONB column 'variants' to products table to store variant information
    - This allows storing an array of variant objects with color, grade, and capacity
  
  2. Notes
    - Using JSONB for flexible variant storage
    - Default to empty array if no variants
*/

-- Add variants column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN products.variants IS 'Array of product variants with color, grade, and capacity';