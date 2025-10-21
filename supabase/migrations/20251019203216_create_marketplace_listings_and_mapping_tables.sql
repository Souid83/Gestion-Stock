/*
  # Create Marketplace Listings and Mapping Tables

  1. New Tables
    - `marketplace_listings`: Stores product listings from external marketplaces (eBay, Amazon, etc.)
      - `id` (uuid, primary key)
      - `provider` (text): Marketplace provider name (e.g., 'ebay')
      - `marketplace_account_id` (uuid): Foreign key to marketplace_accounts
      - `remote_id` (text): External listing ID from marketplace
      - `remote_sku` (text): SKU from marketplace (key for mapping)
      - `title` (text): Product title from marketplace
      - `price_amount` (numeric): Listing price
      - `price_currency` (text): Currency code (e.g., 'EUR', 'USD')
      - `status_sync` (text): Sync status ('ok', 'pending', 'failed', 'unmapped')
      - `metadata` (jsonb): Additional listing data
      - `created_at`, `updated_at` (timestamptz)

    - `marketplace_products_map`: Maps marketplace listings to internal products
      - `id` (uuid, primary key)
      - `provider` (text): Marketplace provider
      - `marketplace_account_id` (uuid): FK to marketplace_accounts
      - `remote_sku` (text): SKU from marketplace
      - `remote_id` (text): Remote listing ID
      - `product_id` (uuid): FK to products table
      - `mapping_status` (text): 'linked' or 'created'
      - `created_at`, `updated_at` (timestamptz)
      - UNIQUE constraint on (provider, marketplace_account_id, remote_sku)

    - `marketplace_ignores`: Tracks listings manually ignored by user
      - `id` (uuid, primary key)
      - `provider` (text): Marketplace provider
      - `marketplace_account_id` (uuid): FK to marketplace_accounts
      - `remote_sku` (text, nullable): SKU to ignore
      - `remote_id` (text, nullable): Remote ID to ignore
      - `reason` (text): Reason for ignoring
      - `created_by` (uuid, nullable): User who created the ignore rule
      - `created_at`, `updated_at` (timestamptz)
      - Unique indexes to prevent duplicate ignores

  2. Security
    - Enable RLS on all tables
    - Users can only access data for their own marketplace accounts
*/

-- Create marketplace_listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  marketplace_account_id uuid NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  remote_id text NOT NULL,
  remote_sku text,
  title text NOT NULL,
  price_amount numeric,
  price_currency text DEFAULT 'EUR',
  status_sync text DEFAULT 'unmapped' CHECK (status_sync IN ('ok', 'pending', 'failed', 'unmapped')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, marketplace_account_id, remote_id)
);

-- Create marketplace_products_map table
CREATE TABLE IF NOT EXISTS marketplace_products_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  marketplace_account_id uuid NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  remote_sku text NOT NULL,
  remote_id text,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  mapping_status text NOT NULL DEFAULT 'linked' CHECK (mapping_status IN ('linked', 'created')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, marketplace_account_id, remote_sku)
);

-- Create marketplace_ignores table
CREATE TABLE IF NOT EXISTS marketplace_ignores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  marketplace_account_id uuid NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  remote_sku text,
  remote_id text,
  reason text NOT NULL DEFAULT 'manual_ignore',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (remote_sku IS NOT NULL OR remote_id IS NOT NULL)
);

-- Add idempotency_key column to sync_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_logs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE sync_logs ADD COLUMN idempotency_key text;
  END IF;
END $$;

-- Add message column to sync_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE sync_logs ADD COLUMN message text;
  END IF;
END $$;

-- Add provider column to sync_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_logs' AND column_name = 'provider'
  ) THEN
    ALTER TABLE sync_logs ADD COLUMN provider text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_ignores ENABLE ROW LEVEL SECURITY;

-- Policies for marketplace_listings (users can access listings for their accounts)
CREATE POLICY "Users can view listings for own accounts"
  ON marketplace_listings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_listings.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert listings"
  ON marketplace_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_listings.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update listings"
  ON marketplace_listings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_listings.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_listings.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

-- Policies for marketplace_products_map
CREATE POLICY "Users can view mappings for own accounts"
  ON marketplace_products_map
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_products_map.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mappings for own accounts"
  ON marketplace_products_map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_products_map.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update mappings for own accounts"
  ON marketplace_products_map
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_products_map.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_products_map.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

-- Policies for marketplace_ignores
CREATE POLICY "Users can view ignores for own accounts"
  ON marketplace_ignores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_ignores.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create ignores for own accounts"
  ON marketplace_ignores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_ignores.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ignores for own accounts"
  ON marketplace_ignores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_ignores.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = marketplace_ignores.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_account ON marketplace_listings(marketplace_account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_sku ON marketplace_listings(provider, marketplace_account_id, remote_sku);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_remote_id ON marketplace_listings(provider, marketplace_account_id, remote_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_map_account ON marketplace_products_map(marketplace_account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_map_product ON marketplace_products_map(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_ignores_account ON marketplace_ignores(marketplace_account_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_idempotency ON sync_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Create unique indexes for marketplace_ignores to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_ignores_unique_sku
  ON marketplace_ignores(provider, marketplace_account_id, remote_sku)
  WHERE remote_sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_ignores_unique_id
  ON marketplace_ignores(provider, marketplace_account_id, remote_id)
  WHERE remote_id IS NOT NULL AND remote_sku IS NULL;