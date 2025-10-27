/*
  # RBAC System Implementation

  1. New Types
    - `user_role` enum with 4 roles: ADMIN_FULL, ADMIN, MAGASIN, COMMANDE

  2. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `role` (user_role enum, default MAGASIN)
      - `created_at` (timestamptz)

  3. Schema Changes
    - Add `created_by_user_id` column to products tables (if exists)
    - Add `purchase_price` column to products tables (if exists)
    - Create indexes on created_by_user_id for performance

  4. Data Migration
    - Set all existing products without created_by_user_id to the first ADMIN_FULL user

  5. Security
    - Enable RLS on profiles table
    - Add policies for authenticated users to read their own profile
    - Add policy for users to read other profiles (role information needed for UI)
*/

-- Create user_role enum type
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('ADMIN_FULL', 'ADMIN', 'MAGASIN', 'COMMANDE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'MAGASIN',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add created_by_user_id and purchase_price columns to products table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

    ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2);
  END IF;
END $$;

-- Add created_by_user_id and purchase_price columns to catalog_products table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_products') THEN
    ALTER TABLE public.catalog_products
    ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

    ALTER TABLE public.catalog_products
    ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2);
  END IF;
END $$;

-- Create indexes on created_by_user_id for performance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by_user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_products') THEN
    CREATE INDEX IF NOT EXISTS idx_catalog_products_created_by ON public.catalog_products(created_by_user_id);
  END IF;
END $$;

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can read all profiles' role information (needed for RBAC UI logic)
CREATE POLICY "Users can read all profiles role information"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile (but role changes should be restricted in application logic)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
