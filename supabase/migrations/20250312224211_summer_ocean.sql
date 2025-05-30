/*
  # Add new product fields

  1. Changes
    - Add purchase_price_2 for second purchase price
    - Add imei for device identification
    - Add supplier field
    - Add product_note field
    - Add selected_stock field
    - Add vat_type field with check constraint
  
  2. Notes
    - All new fields are nullable
    - vat_type is restricted to 'normal' or 'margin'
    - Added comments for documentation
*/

-- Add new columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS purchase_price_2 numeric(10,2),
ADD COLUMN IF NOT EXISTS imei text,
ADD COLUMN IF NOT EXISTS supplier text,
ADD COLUMN IF NOT EXISTS product_note text,
ADD COLUMN IF NOT EXISTS selected_stock text,
ADD COLUMN IF NOT EXISTS vat_type text CHECK (vat_type IN ('normal', 'margin'));

-- Add comments for documentation
COMMENT ON COLUMN products.purchase_price_2 IS 'Second purchase price for products with multiple acquisition costs';
COMMENT ON COLUMN products.imei IS 'IMEI number for devices';
COMMENT ON COLUMN products.supplier IS 'Product supplier/vendor';
COMMENT ON COLUMN products.product_note IS 'Additional notes about the product';
COMMENT ON COLUMN products.selected_stock IS 'Selected stock location';
COMMENT ON COLUMN products.vat_type IS 'VAT type: normal or margin';