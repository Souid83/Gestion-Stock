/*
  # Add location field to products table

  1. Changes
    - Add location column to products table
    - Update existing storage_location data to new location field
    - Drop old storage_location column
  
  2. Notes
    - Preserves existing location data
    - Ensures data is stored in uppercase
*/

-- Add new location column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS location text;

-- Update existing data if storage_location exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'storage_location'
  ) THEN
    UPDATE products 
    SET location = UPPER(storage_location)
    WHERE storage_location IS NOT NULL;
    
    ALTER TABLE products DROP COLUMN storage_location;
  END IF;
END $$;