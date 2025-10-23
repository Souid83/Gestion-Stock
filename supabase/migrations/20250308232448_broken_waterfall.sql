/*
  # Ajout de la table des emplacements de stock

  1. Nouvelles Tables
    - `stock_locations`
      - `id` (uuid, clé primaire)
      - `name` (text, nom de l'emplacement)
      - `description` (text, description optionnelle)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Active RLS sur la table `stock_locations`
    - Ajoute des politiques pour les utilisateurs authentifiés
*/

CREATE TABLE IF NOT EXISTS stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON stock_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON stock_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON stock_locations
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_stock_locations_updated_at
  BEFORE UPDATE ON stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insérer quelques emplacements par défaut
INSERT INTO stock_locations (name, description)
VALUES 
  ('Entrepôt Principal', 'Emplacement principal de stockage'),
  ('Zone Expédition', 'Zone de préparation des commandes'),
  ('Stock Réserve', 'Stock de réserve et surplus')
ON CONFLICT DO NOTHING;