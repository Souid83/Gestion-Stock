/*
  # Add Serial Number Fields to Products Table

  1. Changes
    - Add purchase_price_2 for second purchase price
    - Add imei for IMEI tracking
    - Add supplier field
    - Add product_note for additional information
    - Add selected_stock for stock management
    - Add vat_type for VAT handling
  
  2. Notes
    - All new fields are nullable except vat_type
    - purchase_price_2 uses same precision as purchase_price
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