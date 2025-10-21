/*
  # Create sales metrics tables

  1. New Tables
    - `sales_metrics`
      - `id` (uuid, primary key)
      - `period` (text, enum: daily, weekly, monthly)
      - `target` (numeric)
      - `revenue` (numeric)
      - `estimated_profit` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `product_stats`
      - `id` (uuid, primary key)
      - `total_orders` (integer)
      - `synced_products` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create sales_metrics table
CREATE TABLE IF NOT EXISTS sales_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  target numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  estimated_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_stats table
CREATE TABLE IF NOT EXISTS product_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_orders integer NOT NULL DEFAULT 0,
  synced_products integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read sales metrics"
  ON sales_metrics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read product stats"
  ON product_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sales_metrics_updated_at
  BEFORE UPDATE ON sales_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_stats_updated_at
  BEFORE UPDATE ON product_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();