/*
  # Système de dépôt-vente sous-traitants (PAM)

  1. Nouveaux types
    - `vat_regime` enum: NORMAL, MARGE

  2. Nouvelles tables
    - `consignment_stock_customer_map` - Lie un stock sous-traitant à un client
      - `id` (uuid, primary key)
      - `stock_id` (uuid, references stocks)
      - `customer_id` (uuid, references customers)
      - `created_at` (timestamptz)
      - Index unique sur (stock_id, customer_id)

    - `consignments` - Registre des dépôts par stock/produit
      - `id` (uuid, primary key)
      - `stock_id` (uuid, references stocks)
      - `product_id` (uuid, references products)
      - `customer_id` (uuid, references customers, nullable)
      - `created_at` (timestamptz)
      - Index unique sur (stock_id, product_id)

    - `consignment_moves` - Mouvements de dépôt-vente
      - `id` (uuid, primary key)
      - `consignment_id` (uuid, references consignments)
      - `type` (text: OUT, RETURN, INVOICE, PAYMENT)
      - `qty` (numeric, strictement positif)
      - `unit_price_ht` (numeric)
      - `vat_rate` (numeric)
      - `vat_regime` (vat_regime enum)
      - `invoice_id` (uuid, nullable)
      - `invoice_item_id` (uuid, nullable)
      - `created_at` (timestamptz)
      - Index sur consignment_id, invoice_id, invoice_item_id
      - Index unique partiel sur (invoice_item_id, type) pour idempotence

  3. Modifications de schéma
    - Ajouter `stock_id` à `invoice_items` pour tracer l'origine du stock
    - Ajouter groupe de stock "SOUS-TRAITANT" si absent

  4. Vues
    - `consignment_lines_view` - Calcul par stock/produit
    - `consignment_summary_by_stock` - Agrégation par stock sous-traitant

  5. Sécurité
    - Enable RLS sur toutes les tables
    - Policies pour utilisateurs authentifiés
*/

-- =====================================================================
-- 1. Types et enums
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.vat_regime AS ENUM ('NORMAL', 'MARGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 2. Ajouter groupe de stock SOUS-TRAITANT
-- =====================================================================

INSERT INTO stock_groups (name, synchronizable)
VALUES ('SOUS-TRAITANT', false)
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- 3. Ajouter stock_id à invoice_items
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'stock_id'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN stock_id uuid REFERENCES stocks(id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_stock_id ON invoice_items(stock_id);
  END IF;
END $$;

-- =====================================================================
-- 4. Table de mapping stock ↔ client/sous-traitant
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.consignment_stock_customer_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_customer_map
  ON public.consignment_stock_customer_map(stock_id, customer_id);

-- =====================================================================
-- 5. Table consignments (registre des dépôts)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.consignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_consignments_stock_product
  ON public.consignments(stock_id, product_id);

CREATE INDEX IF NOT EXISTS idx_consignments_stock ON public.consignments(stock_id);
CREATE INDEX IF NOT EXISTS idx_consignments_product ON public.consignments(product_id);
CREATE INDEX IF NOT EXISTS idx_consignments_customer ON public.consignments(customer_id);

-- =====================================================================
-- 6. Table consignment_moves (mouvements)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.consignment_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id uuid NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('OUT', 'RETURN', 'INVOICE', 'PAYMENT')),
  qty numeric(12,3) NOT NULL CHECK (qty > 0 AND qty <= 999999),
  unit_price_ht numeric(12,4) CHECK (unit_price_ht >= 0),
  vat_rate numeric(6,4) CHECK (vat_rate >= 0 AND vat_rate <= 1),
  vat_regime public.vat_regime,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consignment_moves_consignment
  ON public.consignment_moves(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_moves_invoice
  ON public.consignment_moves(invoice_id);
CREATE INDEX IF NOT EXISTS idx_consignment_moves_invoice_item
  ON public.consignment_moves(invoice_item_id);

-- Index unique partiel pour idempotence sur les factures
CREATE UNIQUE INDEX IF NOT EXISTS ux_consignment_moves_invoice_item_type
  ON public.consignment_moves(invoice_item_id, type)
  WHERE invoice_item_id IS NOT NULL;

-- =====================================================================
-- 7. Vue consignment_lines_view (par stock/produit)
-- =====================================================================

CREATE OR REPLACE VIEW public.consignment_lines_view AS
SELECT
  c.id as consignment_id,
  c.stock_id,
  c.product_id,
  c.customer_id,
  s.name as stock_name,
  p.name as product_name,
  p.sku as product_sku,
  cust.name as customer_name,
  -- Quantité en dépôt (OUT - RETURN)
  COALESCE(SUM(CASE
    WHEN m.type = 'OUT' THEN m.qty
    WHEN m.type = 'RETURN' THEN -m.qty
    ELSE 0
  END), 0) AS qty_en_depot,
  -- Quantité facturée non payée (INVOICE - PAYMENT)
  COALESCE(SUM(CASE
    WHEN m.type = 'INVOICE' THEN m.qty
    WHEN m.type = 'PAYMENT' THEN -m.qty
    ELSE 0
  END), 0) AS qty_facture_non_payee,
  -- Montant HT (uniquement sur OUT, INVOICE, PAYMENT)
  COALESCE(SUM(CASE
    WHEN m.type = 'OUT' THEN m.unit_price_ht * m.qty
    WHEN m.type = 'INVOICE' THEN m.unit_price_ht * m.qty
    WHEN m.type = 'PAYMENT' THEN -m.unit_price_ht * m.qty
    ELSE 0
  END), 0) AS montant_ht,
  -- TVA normale
  COALESCE(SUM(CASE
    WHEN m.type IN ('OUT', 'INVOICE') AND m.vat_regime = 'NORMAL'
    THEN m.unit_price_ht * m.qty * COALESCE(m.vat_rate, 0)
    WHEN m.type = 'PAYMENT' AND m.vat_regime = 'NORMAL'
    THEN -m.unit_price_ht * m.qty * COALESCE(m.vat_rate, 0)
    ELSE 0
  END), 0) AS tva_normal,
  -- TVA marge
  COALESCE(SUM(CASE
    WHEN m.type IN ('OUT', 'INVOICE') AND m.vat_regime = 'MARGE'
    THEN m.unit_price_ht * m.qty * COALESCE(m.vat_rate, 0)
    WHEN m.type = 'PAYMENT' AND m.vat_regime = 'MARGE'
    THEN -m.unit_price_ht * m.qty * COALESCE(m.vat_rate, 0)
    ELSE 0
  END), 0) AS tva_marge,
  -- Dernier mouvement
  MAX(m.created_at) as last_move_at
FROM public.consignments c
LEFT JOIN public.consignment_moves m ON m.consignment_id = c.id
LEFT JOIN public.stocks s ON s.id = c.stock_id
LEFT JOIN public.products p ON p.id = c.product_id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
GROUP BY c.id, c.stock_id, c.product_id, c.customer_id, s.name, p.name, p.sku, cust.name;

-- =====================================================================
-- 8. Vue consignment_summary_by_stock (agrégation par stock)
-- =====================================================================

CREATE OR REPLACE VIEW public.consignment_summary_by_stock AS
SELECT
  stock_id,
  stock_name,
  customer_id,
  customer_name,
  -- Totaux quantités
  SUM(qty_en_depot) AS total_en_depot,
  GREATEST(SUM(qty_facture_non_payee), 0) AS total_facture_non_payee,
  -- Totaux montants
  GREATEST(SUM(montant_ht), 0) AS total_ht,
  GREATEST(SUM(tva_normal), 0) AS total_tva_normal,
  GREATEST(SUM(tva_marge), 0) AS total_tva_marge,
  GREATEST(SUM(montant_ht + tva_normal + tva_marge), 0) AS total_ttc,
  -- Dernier mouvement global
  MAX(last_move_at) AS last_move_at
FROM public.consignment_lines_view
GROUP BY stock_id, stock_name, customer_id, customer_name;

-- =====================================================================
-- 9. Sécurité RLS
-- =====================================================================

ALTER TABLE public.consignment_stock_customer_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_moves ENABLE ROW LEVEL SECURITY;

-- Policies: accès complet pour utilisateurs authentifiés
CREATE POLICY "Allow all access for authenticated users"
  ON public.consignment_stock_customer_map
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
  ON public.consignments
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
  ON public.consignment_moves
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 10. Commentaires et documentation
-- =====================================================================

COMMENT ON TABLE public.consignments IS 'Registre des dépôts de produits chez les sous-traitants';
COMMENT ON TABLE public.consignment_moves IS 'Mouvements de dépôt-vente: OUT (sortie), RETURN (retour), INVOICE (facturé), PAYMENT (payé)';
COMMENT ON TABLE public.consignment_stock_customer_map IS 'Association entre un stock sous-traitant et un client/sous-traitant';
COMMENT ON COLUMN invoice_items.stock_id IS 'Stock d''origine de la ligne de facture (pour détecter dépôts-vente)';
