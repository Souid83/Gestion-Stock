/*
  # Add category relationship to products table

  1. Changes
    - Add category_id column to products table
    - Add foreign key constraint to product_categories table
    
  2. Notes
    - Makes category_id nullable to support existing products
    - Maintains existing RLS policies
*/

-- Add category_id column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES product_categories(id);

-- Add foreign key constraint
ALTER TABLE products
ADD CONSTRAINT products_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES product_categories(id);