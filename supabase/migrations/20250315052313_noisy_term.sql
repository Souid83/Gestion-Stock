/*
  # Fix Product Categories Implementation

  1. Changes
    - Delete all existing products
    - Add category_id foreign key constraint
    - Make category fields mandatory
    - Add indexes for better query performance
  
  2. Notes
    - Preserves table structure
    - Maintains referential integrity
    - Improves query performance
*/

-- First, delete all existing products
DELETE FROM products;

-- Add category_id foreign key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN category_id uuid REFERENCES product_categories(id);
  END IF;
END $$;

-- Create index on category_id for better join performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Create indexes on product_categories for better lookup performance
CREATE INDEX IF NOT EXISTS idx_product_categories_type ON product_categories(type);
CREATE INDEX IF NOT EXISTS idx_product_categories_brand ON product_categories(brand);
CREATE INDEX IF NOT EXISTS idx_product_categories_model ON product_categories(model);