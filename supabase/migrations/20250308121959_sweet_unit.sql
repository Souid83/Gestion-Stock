/*
  # Add product images support

  1. New Tables
    - `product_images`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to products)
      - `url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `product_images` table
    - Add policies for authenticated users to manage their product images
*/

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
  ON product_images
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_product_images_updated_at
  BEFORE UPDATE ON product_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();