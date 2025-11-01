/*
  # Enforce uppercase names for stocks and stock groups

  1. Changes
    - Add triggers to enforce uppercase names for stock_groups and stocks tables
    - Convert existing names to uppercase
  
  2. Notes
    - Applies to both manual input and CSV imports
    - Maintains data consistency
*/

-- Convert existing names to uppercase
UPDATE stock_groups SET name = UPPER(name);
UPDATE stocks SET name = UPPER(name);

-- Create function to enforce uppercase for stock groups
CREATE OR REPLACE FUNCTION enforce_uppercase_stock_groups()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name := UPPER(NEW.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to enforce uppercase for stocks
CREATE OR REPLACE FUNCTION enforce_uppercase_stocks()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name := UPPER(NEW.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS stock_groups_uppercase_trigger ON stock_groups;
CREATE TRIGGER stock_groups_uppercase_trigger
    BEFORE INSERT OR UPDATE ON stock_groups
    FOR EACH ROW
    EXECUTE FUNCTION enforce_uppercase_stock_groups();

DROP TRIGGER IF EXISTS stocks_uppercase_trigger ON stocks;
CREATE TRIGGER stocks_uppercase_trigger
    BEFORE INSERT OR UPDATE ON stocks
    FOR EACH ROW
    EXECUTE FUNCTION enforce_uppercase_stocks();