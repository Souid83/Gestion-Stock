/*
  # Add product dimensions and shipping boxes

  1. New Tables
    - shipping_boxes: Stores predefined shipping box formats
      - id (uuid, primary key)
      - name (text)
      - width_cm (numeric)
      - height_cm (numeric)
      - depth_cm (numeric)
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Changes to products table
    - Add dimensions columns (width_cm, height_cm, depth_cm)
    - Add shipping_box_id reference to shipping_boxes table
    
  3. Security
    - Enable RLS on shipping_boxes table
    - Add policies for authenticated users
*/

-- Create shipping_boxes table
CREATE TABLE IF NOT EXISTS shipping_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  width_cm numeric(10,2) NOT NULL,
  height_cm numeric(10,2) NOT NULL,
  depth_cm numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add dimensions to products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'width_cm'
  ) THEN
    ALTER TABLE products ADD COLUMN width_cm numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'height_cm'
  ) THEN
    ALTER TABLE products ADD COLUMN height_cm numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'depth_cm'
  ) THEN
    ALTER TABLE products ADD COLUMN depth_cm numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'shipping_box_id'
  ) THEN
    ALTER TABLE products ADD COLUMN shipping_box_id uuid REFERENCES shipping_boxes(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON shipping_boxes;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON shipping_boxes;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON shipping_boxes;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON shipping_boxes;
END $$;

-- Create policies
CREATE POLICY "Enable read access for all users" ON shipping_boxes
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON shipping_boxes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON shipping_boxes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON shipping_boxes
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_shipping_boxes_updated_at ON shipping_boxes;
CREATE TRIGGER update_shipping_boxes_updated_at
  BEFORE UPDATE ON shipping_boxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default shipping box formats
INSERT INTO shipping_boxes (name, width_cm, height_cm, depth_cm) VALUES
  ('Petit', 20, 15, 10),
  ('Moyen', 30, 25, 20),
  ('Grand', 40, 35, 30),
  ('Très Grand', 60, 40, 40)
ON CONFLICT DO NOTHING;