/*
  # Add images array to products table

  1. Changes
    - Add images column to products table to store an array of image URLs
    
  2. Notes
    - Uses text[] type to store multiple image URLs per product
    - Default to empty array if no images provided
*/

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';