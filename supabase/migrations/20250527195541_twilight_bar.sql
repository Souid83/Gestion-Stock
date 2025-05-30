/*
  # Create Customer Management System

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Company or person name
      - `email` (text, nullable)
      - `phone` (text, nullable)
      - `customer_group` (text, enum: 'pro', 'particulier')
      - `zone` (text, nullable) - Region or city
      - `notes` (text, nullable)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

    - `customer_addresses`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `address_type` (text, enum: 'billing', 'shipping')
      - `line1` (text, not null)
      - `line2` (text, nullable)
      - `zip` (text, not null)
      - `city` (text, not null)
      - `country` (text, not null, default: 'France')
      - `is_default` (boolean, default: false)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  customer_group text NOT NULL CHECK (customer_group IN ('pro', 'particulier')),
  zone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_type text NOT NULL CHECK (address_type IN ('billing', 'shipping')),
  line1 text NOT NULL,
  line2 text,
  zip text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'France',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON customer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users"
ON customers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable write access for authenticated users"
ON customers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
ON customer_addresses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable write access for authenticated users"
ON customer_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);