/*
  # Create app_settings table

  1. New Tables
    - `app_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all access for authenticated users"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default settings
INSERT INTO app_settings (key, value)
VALUES 
  ('logo_url', ''),
  ('footer_text', 'Merci pour votre confiance. Tous les prix sont en euros.'),
  ('terms_and_conditions', 'Conditions générales de vente : Les produits restent la propriété de la société jusqu''au paiement intégral.'),
  ('bank_info', 'IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX
BIC: XXXXXXXX
Banque: Exemple Banque')
ON CONFLICT (key) DO NOTHING;