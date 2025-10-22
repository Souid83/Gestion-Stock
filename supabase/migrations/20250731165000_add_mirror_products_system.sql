/*
  # Add Mirror Products System

  1. Changes to products table
    - Add mirror_of column to link mirror products to their parent
    - Add is_mirror_parent column to identify products that can have mirrors
    - Add constraint to ensure only single-price products can be mirrors or have mirrors

  2. New view
    - Create clear_products_with_stock view for the frontend
    - Include mirror information and stock data

  3. Functions
    - Function to check if a product can have mirrors (single price only)
    - Function to sync stock between mirror products

  4. Security
    - Update RLS policies
*/

-- Add mirror columns to products table
DO $$ 
BEGIN
  -- Add mirror_of column (references the parent product)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'mirror_of'
  ) THEN
    ALTER TABLE products ADD COLUMN mirror_of uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  -- Add is_mirror_parent column (indicates if product can have mirrors)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_mirror_parent'
  ) THEN
    ALTER TABLE products ADD COLUMN is_mirror_parent boolean DEFAULT false;
  END IF;
END $$;

-- Create index for mirror relationships
CREATE INDEX IF NOT EXISTS idx_products_mirror_of ON products(mirror_of);
CREATE INDEX IF NOT EXISTS idx_products_is_mirror_parent ON products(is_mirror_parent);

-- Function to check if a product can have mirrors (single price products only)
CREATE OR REPLACE FUNCTION can_have_mirrors(product_id uuid)
RETURNS boolean AS $$
DECLARE
  product_record RECORD;
BEGIN
  SELECT * INTO product_record FROM products WHERE id = product_id;
  
  -- Only products with single price (not serial products with parent_id) can have mirrors
  RETURN product_record.parent_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to sync shared stock between mirror products
CREATE OR REPLACE FUNCTION sync_mirror_stock()
RETURNS TRIGGER AS $$
DECLARE
  parent_product_id uuid;
  mirror_shared_stock_id uuid;
BEGIN
  -- If this is a mirror product, get the parent
  IF NEW.mirror_of IS NOT NULL THEN
    parent_product_id := NEW.mirror_of;
  -- If this is a parent product, use its ID
  ELSIF NEW.is_mirror_parent = true THEN
    parent_product_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  -- Get the shared_stock_id from the parent product
  SELECT shared_stock_id INTO mirror_shared_stock_id 
  FROM products 
  WHERE id = parent_product_id;

  -- If parent has shared stock, assign it to the mirror
  IF mirror_shared_stock_id IS NOT NULL AND NEW.mirror_of IS NOT NULL THEN
    NEW.shared_stock_id := mirror_shared_stock_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mirror stock synchronization
DROP TRIGGER IF EXISTS sync_mirror_stock_trigger ON products;
CREATE TRIGGER sync_mirror_stock_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_mirror_stock();

-- Create comprehensive view for products with stock and mirror information
CREATE OR REPLACE VIEW clear_products_with_stock AS
SELECT 
  p.*,
  -- Stock information
  s.quantity as shared_quantity,
  COALESCE(p.stock_total, 0) as stock_total,
  -- Mirror information
  CASE 
    WHEN p.mirror_of IS NOT NULL THEN 'mirror'
    WHEN p.is_mirror_parent = true THEN 'parent'
    ELSE 'normal'
  END as mirror_type,
  -- Parent product info for mirrors
  parent_p.id as mirror_parent_id,
  parent_p.name as mirror_parent_name,
  parent_p.sku as mirror_parent_sku,
  -- Count of mirror children for parents
  (
    SELECT COUNT(*) 
    FROM products mirror_children 
    WHERE mirror_children.mirror_of = p.id
  ) as mirror_children_count,
  -- Stock data as JSON for compatibility
  (
    SELECT json_agg(
      json_build_object(
        'id', sp.stock_id,
        'name', st.name,
        'quantite', sp.quantite,
        'group', json_build_object(
          'name', COALESCE(sg.name, 'Default'),
          'synchronizable', COALESCE(sg.synchronizable, false)
        )
      )
    )
    FROM stock_produit sp
    JOIN stocks st ON sp.stock_id = st.id
    LEFT JOIN stock_groups sg ON st.group_id = sg.id
    WHERE sp.produit_id = p.id
  ) as stocks
FROM products p
LEFT JOIN shared_stocks s ON p.shared_stock_id = s.id
LEFT JOIN products parent_p ON p.mirror_of = parent_p.id
ORDER BY p.created_at DESC;

-- Add constraint to ensure only single-price products can be mirrors or have mirrors
ALTER TABLE products ADD CONSTRAINT check_mirror_single_price 
  CHECK (
    (mirror_of IS NULL AND is_mirror_parent IS NULL) OR 
    (parent_id IS NULL)
  );

-- Update RLS policies to handle mirror products
DO $$
BEGIN
  -- Allow users to read mirror relationships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Allow authenticated users to read mirror products'
  ) THEN
    CREATE POLICY "Allow authenticated users to read mirror products"
      ON products
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Allow users to create and manage mirror products
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Allow authenticated users to manage mirror products'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage mirror products"
      ON products
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
