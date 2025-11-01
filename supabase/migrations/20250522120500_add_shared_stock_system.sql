-- Création de la table pour les stocks partagés
CREATE TABLE IF NOT EXISTS shared_stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ajout de la colonne shared_stock_id dans products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shared_stock_id UUID REFERENCES shared_stocks(id);

-- Création de la vue pour afficher les produits avec leur stock partagé
CREATE OR REPLACE VIEW products_with_stock AS
SELECT
  p.*,
  s.quantity as shared_quantity
FROM products p
JOIN shared_stocks s ON p.shared_stock_id = s.id;
