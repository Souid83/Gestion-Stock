/*
  # Rename period column to metric_type

  1. Changes
    - Rename column `period` to `metric_type` in `sales_metrics` table
    - Preserve existing data and constraints
*/

DO $$ 
BEGIN
  -- Check if the column exists before trying to rename it
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'sales_metrics' 
    AND column_name = 'period'
  ) THEN
    ALTER TABLE sales_metrics 
    RENAME COLUMN period TO metric_type;
  END IF;
END $$;