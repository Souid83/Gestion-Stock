/*
  # Système de typage de documents de facturation

  1. Nouvelle table
    - `billing_document_types` - Gestion des types de documents (Facture Voiture, Magasin, Pro Téléphone, etc.)
      - `id` (uuid, primary key)
      - `label` (text, unique, not null) - Libellé du type
      - `description` (text) - Description optionnelle
      - `is_active` (boolean, default true) - Statut actif/inactif
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications tables existantes
    - Ajout colonne `document_type_id` (FK nullable phase 1) sur `quotes`, `invoices`, `credit_notes`
    - Index pour performance

  3. Vue récapitulatif
    - `billing_sales_recaps_by_type` - Agrégation ventes par type et mois

  4. Sécurité
    - Enable RLS sur billing_document_types
    - Policies pour authenticated users
    - Trigger updated_at

  5. Données initiales
    - Types par défaut : Magasin, Facture Voiture, Pro Téléphone, E-commerce

  Note: Phase 2 (NOT NULL) sera appliquée après backfill manuel
*/

-- 1) Table des typages de documents
CREATE TABLE IF NOT EXISTS billing_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Colonnes de typage (phase 1 - nullable pour backfill)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS document_type_id uuid REFERENCES billing_document_types(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type_id uuid REFERENCES billing_document_types(id);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS document_type_id uuid REFERENCES billing_document_types(id);

-- 3) Index pour performance
CREATE INDEX IF NOT EXISTS idx_quotes_document_type ON quotes(document_type_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_document_type ON credit_notes(document_type_id);

-- 4) Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_billing_document_types_updated_at') THEN
    CREATE TRIGGER update_billing_document_types_updated_at
    BEFORE UPDATE ON billing_document_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 5) Vue récapitulatif par typage et mois
CREATE OR REPLACE VIEW billing_sales_recaps_by_type AS
SELECT
  date_trunc('month', i.date_issued)::date as month,
  i.document_type_id,
  dt.label as document_type_label,
  SUM(COALESCE(i.total_ht, 0)) as total_ht,
  SUM(COALESCE(i.tva, 0)) as total_tva,
  SUM(COALESCE(i.total_ttc, 0)) as total_ttc,
  COUNT(*) as doc_count
FROM invoices i
LEFT JOIN billing_document_types dt ON dt.id = i.document_type_id
WHERE i.status != 'cancelled'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 3;

-- 6) RLS policies
ALTER TABLE billing_document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access for authenticated users" ON billing_document_types;

CREATE POLICY "Allow all access for authenticated users"
ON billing_document_types FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 7) Données initiales
INSERT INTO billing_document_types (label, description) VALUES
  ('Magasin', 'Ventes en magasin physique'),
  ('Facture Voiture', 'Ventes de véhicules'),
  ('Pro Téléphone', 'Ventes professionnelles téléphones'),
  ('E-commerce', 'Ventes en ligne directes')
ON CONFLICT (label) DO NOTHING;

-- Phase 2 (à appliquer après backfill manuel) :
-- ALTER TABLE quotes ALTER COLUMN document_type_id SET NOT NULL;
-- ALTER TABLE invoices ALTER COLUMN document_type_id SET NOT NULL;
-- ALTER TABLE credit_notes ALTER COLUMN document_type_id SET NOT NULL;