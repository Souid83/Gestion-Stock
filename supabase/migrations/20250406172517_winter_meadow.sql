/*
  # Add Parent/Child Relationship to Products

  1. Changes
    - Add parent_id column referencing products table
    - Add is_parent boolean flag
    - Add serial_number column for child products
    - Add battery_level column for child products
    - Add stock_id reference for location tracking
    - Add warranty_sticker status
  
  2. Notes
    - parent_id is nullable (not all products are children)
    - is_parent defaults to false
    - battery_level is integer percentage
    - warranty_sticker can be 'present' or 'absent'
*/

-- Add new columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES products(id),
ADD COLUMN IF NOT EXISTS is_parent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS serial_number text,
ADD COLUMN IF NOT EXISTS battery_level integer,
ADD COLUMN IF NOT EXISTS stock_id uuid REFERENCES stocks(id),
ADD COLUMN IF NOT EXISTS warranty_sticker text CHECK (warranty_sticker IN ('present', 'absent'));

-- Add comments for documentation
COMMENT ON COLUMN products.parent_id IS 'Reference to parent product for serialized items';
COMMENT ON COLUMN products.is_parent IS 'Indicates if this is a parent product that can have serialized children';
COMMENT ON COLUMN products.serial_number IS 'Serial number for child products';
COMMENT ON COLUMN products.battery_level IS 'Battery level percentage for child products';
COMMENT ON COLUMN products.stock_id IS 'Reference to the stock location where this product is stored';
COMMENT ON COLUMN products.warranty_sticker IS 'Indicates if warranty sticker is present or absent';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_parent_id ON products(parent_id);