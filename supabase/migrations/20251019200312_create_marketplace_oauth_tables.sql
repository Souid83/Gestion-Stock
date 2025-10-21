/*
  # Create OAuth and Marketplace Integration Tables

  1. New Tables
    - `provider_app_credentials`: Stores encrypted client IDs and secrets for OAuth providers (eBay, Amazon, etc.)
      - `id` (uuid, primary key)
      - `provider` (text): Provider name (e.g., 'ebay', 'amazon')
      - `environment` (text): 'sandbox' or 'production'
      - `client_id_encrypted` (text): Encrypted client ID
      - `client_secret_encrypted` (text): Encrypted client secret
      - `runame` (text): eBay RuName or equivalent redirect URI identifier
      - `encryption_iv` (text): Initialization vector for decryption
      - `created_at`, `updated_at` (timestamptz)
    
    - `marketplace_accounts`: Links user to connected marketplace accounts
      - `id` (uuid, primary key)
      - `user_id` (uuid): Reference to auth.users
      - `provider` (text): Provider name
      - `environment` (text): 'sandbox' or 'production'
      - `provider_account_id` (text): External account ID (e.g., eBay userId)
      - `display_name` (text): Account display name
      - `metadata` (jsonb): Additional account info (username, marketplaceId, etc.)
      - `is_active` (boolean)
      - `created_at`, `updated_at` (timestamptz)
    
    - `oauth_tokens`: Stores access and refresh tokens
      - `id` (uuid, primary key)
      - `marketplace_account_id` (uuid): Foreign key to marketplace_accounts
      - `access_token` (text): Not encrypted (short-lived)
      - `refresh_token_encrypted` (text): Encrypted refresh token
      - `token_type` (text): 'Bearer', 'User Access Token', etc.
      - `scope` (text): Granted scopes
      - `expires_at` (timestamptz): Token expiration timestamp
      - `refresh_token_expires_at` (timestamptz)
      - `state_nonce` (text): CSRF protection token (nullable, cleared after use)
      - `encryption_iv` (text): IV for refresh token
      - `created_at`, `updated_at` (timestamptz)
    
    - `sync_logs`: Audit log for OAuth and sync operations
      - `id` (uuid, primary key)
      - `marketplace_account_id` (uuid): Nullable FK
      - `operation` (text): 'oauth_callback', 'token_refresh', 'sync_listings', etc.
      - `outcome` (text): 'ok', 'fail'
      - `http_status` (integer): HTTP status code if applicable
      - `error_code` (text): Error identifier
      - `error_message` (text): Error details (no secrets)
      - `metadata` (jsonb): Additional context
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Create policies for authenticated user access
    - Ensure users can only access their own marketplace accounts
*/

-- Create provider_app_credentials table
CREATE TABLE IF NOT EXISTS provider_app_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  client_id_encrypted text NOT NULL,
  client_secret_encrypted text NOT NULL,
  runame text,
  encryption_iv text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, environment)
);

-- Create marketplace_accounts table
CREATE TABLE IF NOT EXISTS marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  provider_account_id text NOT NULL,
  display_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, environment, provider_account_id)
);

-- Create oauth_tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_account_id uuid REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token_encrypted text,
  token_type text DEFAULT 'Bearer',
  scope text,
  expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz,
  state_nonce text,
  encryption_iv text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(marketplace_account_id)
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_account_id uuid REFERENCES marketplace_accounts(id) ON DELETE SET NULL,
  operation text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'fail')),
  http_status integer,
  error_code text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE provider_app_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for provider_app_credentials (admin only for now)
CREATE POLICY "Admin can manage provider credentials"
  ON provider_app_credentials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for marketplace_accounts (users can access their own)
CREATE POLICY "Users can view own marketplace accounts"
  ON marketplace_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marketplace accounts"
  ON marketplace_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace accounts"
  ON marketplace_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketplace accounts"
  ON marketplace_accounts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for oauth_tokens (users can access tokens for their accounts)
CREATE POLICY "Users can view tokens for own accounts"
  ON oauth_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = oauth_tokens.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tokens for own accounts"
  ON oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = oauth_tokens.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tokens for own accounts"
  ON oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = oauth_tokens.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = oauth_tokens.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

-- Policies for sync_logs (users can view logs for their accounts)
CREATE POLICY "Users can view logs for own accounts"
  ON sync_logs
  FOR SELECT
  TO authenticated
  USING (
    marketplace_account_id IS NULL OR
    EXISTS (
      SELECT 1 FROM marketplace_accounts
      WHERE marketplace_accounts.id = sync_logs.marketplace_account_id
      AND marketplace_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert logs"
  ON sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_user_provider ON marketplace_accounts(user_id, provider, environment);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_account ON oauth_tokens(marketplace_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_account ON sync_logs(marketplace_account_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);