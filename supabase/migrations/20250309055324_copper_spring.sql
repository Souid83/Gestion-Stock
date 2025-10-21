/*
  # Ajout du champ alerte stock

  1. Modifications
    - Ajout de la colonne `stock_alert` à la table `products`
      - Type: integer
      - Nullable: true
      - Description: Seuil d'alerte pour le stock bas
*/

ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_alert integer;

COMMENT ON COLUMN products.stock_alert IS 'Seuil d''alerte pour le stock bas';