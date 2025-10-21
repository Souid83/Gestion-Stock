/*
  # Système de lots pour produits

  1. Nouvelles tables
    - `lots`
      - `id` (uuid, primary key)
      - `name` (text, nom du lot)
      - `sku` (text, SKU unique du lot)
      - `type` (text, 'simple' ou 'compose')
      - `quantity_per_lot` (integer, quantité par lot)
      - `margin_ht` (numeric, marge HT souhaitée)
      - `purchase_price_ht` (numeric, prix d'achat HT calculé)
      - `selling_price_ht` (numeric, prix de vente HT)
      - `selling_price_ttc` (numeric, prix de vente TTC)
      - `stock` (integer, stock disponible du lot)
      - `stock_alert` (integer, seuil d'alerte)
      - `location` (text, emplacement)
      - `vat_type` (text, type de TVA)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `lot_components`
      - `id` (uuid, primary key)
      - `lot_id` (uuid, FK vers lots)
      - `product_id` (uuid, FK vers products)
      - `quantity` (integer, quantité du composant par lot)
      - `depots_utilises` (jsonb, array des dépôts utilisés)
      - `created_at` (timestamp)

  2. Sécurité
    - Enable RLS sur les nouvelles tables
    - Politiques pour les utilisateurs authentifiés
*/

-- Table des lots
CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('simple', 'compose')),
  quantity_per_lot integer NOT NULL DEFAULT 1,
  margin_ht numeric(10,2) NOT NULL DEFAULT 0,
  purchase_price_ht numeric(10,2) NOT NULL DEFAULT 0,
  selling_price_ht numeric(10,2) NOT NULL DEFAULT 0,
  selling_price_ttc numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  stock_alert integer DEFAULT 0,
  location text,
  vat_type text DEFAULT 'normal' CHECK (vat_type IN ('normal', 'margin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des composants de lots
CREATE TABLE IF NOT EXISTS lot_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  depots_utilises jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_lot_components_lot_id ON lot_components(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_components_product_id ON lot_components(product_id);
CREATE INDEX IF NOT EXISTS idx_lots_sku ON lots(sku);
CREATE INDEX IF NOT EXISTS idx_lots_type ON lots(type);

-- Enable RLS
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_components ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour lots
CREATE POLICY "Allow all access for authenticated users on lots"
  ON lots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour lot_components
CREATE POLICY "Allow all access for authenticated users on lot_components"
  ON lot_components
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger pour updated_at sur lots
CREATE OR REPLACE FUNCTION update_lots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_lots_updated_at();

-- Vue pour les lots avec leurs composants
CREATE OR REPLACE VIEW lots_with_components AS
SELECT 
  l.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', lc.id,
        'product_id', lc.product_id,
        'quantity', lc.quantity,
        'depots_utilises', lc.depots_utilises,
        'product_name', p.name,
        'product_sku', p.sku,
        'product_stock', p.stock
      )
    ) FILTER (WHERE lc.id IS NOT NULL),
    '[]'::json
  ) as components
FROM lots l
LEFT JOIN lot_components lc ON l.id = lc.lot_id
LEFT JOIN products p ON lc.product_id = p.id
GROUP BY l.id;