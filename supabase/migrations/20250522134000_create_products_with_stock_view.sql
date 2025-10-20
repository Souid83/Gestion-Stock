-- Vue pour afficher tous les produits avec leur stock partagé (shared_quantity si présent, sinon null)
CREATE OR REPLACE VIEW products_with_stock AS
SELECT
  p.*,
  s.quantity as shared_quantity
FROM products p
LEFT JOIN shared_stocks s ON p.shared_stock_id = s.id;
