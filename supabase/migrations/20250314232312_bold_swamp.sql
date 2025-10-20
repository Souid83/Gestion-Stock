/*
  # Clean Database Data

  1. Changes
    - Safely delete all product data
    - Safely delete all category data
    - Preserve table structures and sequences
  
  2. Notes
    - Uses safe deletion methods
    - Maintains referential integrity
    - Preserves table structures
*/

-- First delete products to maintain referential integrity
DELETE FROM products;

-- Then delete categories
DELETE FROM product_categories;

-- No need to reset sequences as they are UUID-based