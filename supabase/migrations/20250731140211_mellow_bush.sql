/*
  # Système de produits miroirs

  1. Nouvelles colonnes
    - `mirror_of` (uuid) - Référence vers le produit parent pour les miroirs
    - Mise à jour de `shared_stock_id` pour gérer le stock partagé

  2. Contraintes
    - Un miroir ne peut pas être parent d'un autre miroir
    - Un produit sérialisé ne peut pas être un miroir
    - Le SKU d'un miroir doit être unique

  3. Index
    - Index sur `mirror_of` pour les requêtes de miroirs
    - Index sur `shared_stock_id` pour le stock partagé

  4. Triggers
    - Synchronisation automatique des données entre parent et miroirs
    - Mise à jour du stock partagé
*/

-- Ajouter la colonne mirror_of si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'mirror_of'
  ) THEN
    ALTER TABLE products ADD COLUMN mirror_of uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Créer l'index sur mirror_of
CREATE INDEX IF NOT EXISTS idx_products_mirror_of ON products(mirror_of);

-- Créer l'index sur shared_stock_id s'il n'existe pas
CREATE INDEX IF NOT EXISTS idx_products_shared_stock_id ON products(shared_stock_id);

-- Contrainte: un produit sérialisé ne peut pas être un miroir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'products_mirror_serial_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_mirror_serial_check 
    CHECK (
      (mirror_of IS NULL) OR 
      (mirror_of IS NOT NULL AND serial_number IS NULL AND is_parent = false)
    );
  END IF;
END $$;

-- Contrainte: un miroir ne peut pas avoir de miroirs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'products_mirror_hierarchy_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_mirror_hierarchy_check 
    CHECK (
      (mirror_of IS NULL) OR 
      (mirror_of IS NOT NULL AND shared_stock_id IS NULL)
    );
  END IF;
END $$;

-- Fonction pour synchroniser les données entre parent et miroirs
CREATE OR REPLACE FUNCTION sync_mirror_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Si c'est un produit parent qui est modifié, synchroniser avec ses miroirs
  IF OLD.mirror_of IS NULL AND NEW.mirror_of IS NULL THEN
    UPDATE products 
    SET 
      purchase_price_with_fees = NEW.purchase_price_with_fees,
      raw_purchase_price = NEW.raw_purchase_price,
      retail_price = NEW.retail_price,
      pro_price = NEW.pro_price,
      weight_grams = NEW.weight_grams,
      ean = NEW.ean,
      description = NEW.description,
      width_cm = NEW.width_cm,
      height_cm = NEW.height_cm,
      depth_cm = NEW.depth_cm,
      images = NEW.images,
      category_id = NEW.category_id,
      variants = NEW.variants,
      location = NEW.location,
      supplier = NEW.supplier,
      product_note = NEW.product_note,
      vat_type = NEW.vat_type,
      stock_alert = NEW.stock_alert,
      updated_at = NOW()
    WHERE mirror_of = NEW.id
    AND (
      -- Ne synchroniser que si les champs ont vraiment changé
      purchase_price_with_fees IS DISTINCT FROM NEW.purchase_price_with_fees OR
      raw_purchase_price IS DISTINCT FROM NEW.raw_purchase_price OR
      retail_price IS DISTINCT FROM NEW.retail_price OR
      pro_price IS DISTINCT FROM NEW.pro_price OR
      weight_grams IS DISTINCT FROM NEW.weight_grams OR
      ean IS DISTINCT FROM NEW.ean OR
      description IS DISTINCT FROM NEW.description OR
      width_cm IS DISTINCT FROM NEW.width_cm OR
      height_cm IS DISTINCT FROM NEW.height_cm OR
      depth_cm IS DISTINCT FROM NEW.depth_cm OR
      images IS DISTINCT FROM NEW.images OR
      category_id IS DISTINCT FROM NEW.category_id OR
      variants IS DISTINCT FROM NEW.variants OR
      location IS DISTINCT FROM NEW.location OR
      supplier IS DISTINCT FROM NEW.supplier OR
      product_note IS DISTINCT FROM NEW.product_note OR
      vat_type IS DISTINCT FROM NEW.vat_type OR
      stock_alert IS DISTINCT FROM NEW.stock_alert
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la synchronisation des miroirs
DROP TRIGGER IF EXISTS sync_mirror_data_trigger ON products;
CREATE TRIGGER sync_mirror_data_trigger
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_mirror_data();

-- Fonction pour mettre à jour le stock partagé
CREATE OR REPLACE FUNCTION update_shared_stock()
RETURNS TRIGGER AS $$
DECLARE
  shared_id uuid;
BEGIN
  -- Déterminer l'ID du stock partagé
  IF TG_OP = 'DELETE' THEN
    shared_id := OLD.shared_stock_id;
  ELSE
    shared_id := NEW.shared_stock_id;
  END IF;

  -- Si le produit utilise un stock partagé, mettre à jour tous les produits liés
  IF shared_id IS NOT NULL THEN
    UPDATE products 
    SET shared_quantity = (
      SELECT SUM(stock) 
      FROM products 
      WHERE shared_stock_id = shared_id OR id = shared_id
    )
    WHERE shared_stock_id = shared_id OR id = shared_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la mise à jour du stock partagé
DROP TRIGGER IF EXISTS update_shared_stock_trigger ON products;
CREATE TRIGGER update_shared_stock_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_stock();