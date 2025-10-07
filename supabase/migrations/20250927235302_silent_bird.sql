/*
  # Système de calcul de réparation

  1. Nouvelles tables
    - `repair_settings` - Paramètres globaux pour les calculs de réparation
    - `repair_models` - Modèles de produits pour les réparations
    - `repair_services` - Services/prestations pour chaque modèle

  2. Sécurité
    - Enable RLS sur toutes les tables
    - Politiques pour les utilisateurs authentifiés

  3. Contraintes
    - Clés étrangères correctement définies
    - Triggers pour updated_at
*/

-- Table des paramètres globaux de réparation
CREATE TABLE IF NOT EXISTS repair_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_charges numeric(10,2) NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  profit_tax numeric(5,2) NOT NULL DEFAULT 0,
  revenue_tax numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des modèles de réparation (liés aux produits)
CREATE TABLE IF NOT EXISTS repair_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  value numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

-- Table des services de réparation
CREATE TABLE IF NOT EXISTS repair_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_model_id uuid NOT NULL REFERENCES repair_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_time numeric(10,2) NOT NULL DEFAULT 0,
  repair_price numeric(10,2) NOT NULL DEFAULT 0,
  purchase_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_repair_models_product_id ON repair_models(product_id);
CREATE INDEX IF NOT EXISTS idx_repair_services_repair_model_id ON repair_services(repair_model_id);

-- Créer les triggers pour updated_at
CREATE TRIGGER update_repair_settings_updated_at
  BEFORE UPDATE ON repair_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repair_models_updated_at
  BEFORE UPDATE ON repair_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repair_services_updated_at
  BEFORE UPDATE ON repair_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS sur toutes les tables
ALTER TABLE repair_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_services ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Allow all access for authenticated users"
  ON repair_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
  ON repair_models
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
  ON repair_services
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insérer des paramètres par défaut
INSERT INTO repair_settings (
  fixed_charges,
  hourly_rate,
  vat_rate,
  profit_tax,
  revenue_tax
)
VALUES (
  1500.00,
  50.00,
  20.00,
  30.00,
  12.80
)
ON CONFLICT DO NOTHING;