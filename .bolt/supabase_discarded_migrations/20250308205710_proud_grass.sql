/*
  # Initial Database Schema Setup

  1. New Tables
    - `shipping_boxes`
      - `id` (uuid, primary key)
      - `name` (text)
      - `width_cm` (numeric)
      - `height_cm` (numeric)
      - `depth_cm` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add to `products`:
      - `images` (text array)
      - `width_cm` (numeric)
      - `height_cm` (numeric)
      - `depth_cm` (numeric)
      - `shipping_box_id` (uuid, foreign key)

  3. Security
    - Enable RLS on shipping_boxes
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

-- Enable RLS on shipping_boxes
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for shipping_boxes
CREATE POLICY "Enable read access for all users" ON shipping_boxes
  FOR SELECT TO public USING (true);

CREATE POLICY "Enable insert for authenticated users" ON shipping_boxes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON shipping_boxes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON shipping_boxes
  FOR DELETE TO authenticated USING (true);

-- Add new columns to products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'images'
  ) THEN
    ALTER TABLE products ADD COLUMN images text[] DEFAULT '{}';
  END IF;

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