/*
  # Add sim_type column to product_variants table

  1. Schema Changes
    - Add `sim_type` column to `product_variants` table
    - Column type: text, nullable
    - Will store SIM type information in uppercase format

  2. Security
    - No changes to existing RLS policies
    - Existing policies will automatically apply to the new column

  3. Notes
    - This is a non-breaking change - existing variants will have NULL sim_type
    - The application will handle NULL values gracefully
    - Values will be stored in uppercase format for consistency
*/

-- Add sim_type column to product_variants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'sim_type'
  ) THEN
    ALTER TABLE product_variants ADD COLUMN sim_type text;
  END IF;
END $$;