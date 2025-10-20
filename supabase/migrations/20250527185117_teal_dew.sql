/*
  # Create Billing Module Tables

  1. New Tables
    - `customers` - Store customer information
    - `customer_addresses` - Store customer addresses (billing/shipping)
    - `quotes` - Store quotes/estimates
    - `quote_items` - Store line items for quotes
    - `orders` - Store orders
    - `order_items` - Store line items for orders
    - `invoices` - Store invoices
    - `invoice_items` - Store line items for invoices
    - `credit_notes` - Store credit notes (avoirs)
    - `credit_note_items` - Store line items for credit notes
    - `payments` - Store payment information

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  customer_group text NOT NULL CHECK (customer_group IN ('pro', 'particulier')),
  zone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_type text NOT NULL CHECK (address_type IN ('billing', 'shipping')),
  line1 text NOT NULL,
  line2 text,
  zip text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'France',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'refused')) DEFAULT 'draft',
  date_issued date NOT NULL DEFAULT CURRENT_DATE,
  date_expiry date NOT NULL,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  tva numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  billing_address_json jsonb,
  shipping_address_json jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_items table
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  total_price numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'draft',
  date_issued date NOT NULL DEFAULT CURRENT_DATE,
  date_delivery date,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  tva numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  billing_address_json jsonb,
  shipping_address_json jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  total_price numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'late', 'cancelled')) DEFAULT 'draft',
  date_issued date NOT NULL DEFAULT CURRENT_DATE,
  date_due date NOT NULL,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  tva numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  billing_address_json jsonb,
  shipping_address_json jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  total_price numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  credit_note_number text NOT NULL UNIQUE,
  date_issued date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'processed')) DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create credit_note_items table
CREATE TABLE IF NOT EXISTS credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES invoice_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  total_price numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'check', 'other')),
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company_settings table for PDF generation
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  zip text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'France',
  phone text,
  email text,
  website text,
  siret text,
  vat_number text,
  logo_url text,
  bank_name text,
  bank_iban text,
  bank_bic text,
  footer_text text,
  terms_and_conditions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mail_settings table
CREATE TABLE IF NOT EXISTS mail_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL,
  smtp_user text NOT NULL,
  smtp_password text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  quote_template text,
  order_template text,
  invoice_template text,
  credit_note_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_counters table for auto-incrementing document numbers
CREATE TABLE IF NOT EXISTS document_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL UNIQUE CHECK (document_type IN ('quote', 'order', 'invoice', 'credit_note')),
  prefix text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate next document number
CREATE OR REPLACE FUNCTION generate_document_number(doc_type text)
RETURNS text AS $$
DECLARE
  counter_record record;
  new_number integer;
  result text;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT * INTO counter_record FROM document_counters 
  WHERE document_type = doc_type
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Insert default if not exists
    INSERT INTO document_counters (document_type, prefix, last_number)
    VALUES (
      doc_type, 
      CASE 
        WHEN doc_type = 'quote' THEN 'DEV'
        WHEN doc_type = 'order' THEN 'CMD'
        WHEN doc_type = 'invoice' THEN 'FAC'
        WHEN doc_type = 'credit_note' THEN 'AVO'
        ELSE 'DOC'
      END,
      0
    )
    RETURNING * INTO counter_record;
  END IF;
  
  -- Increment the counter
  new_number := counter_record.last_number + 1;
  
  -- Update the counter
  UPDATE document_counters 
  SET last_number = new_number
  WHERE document_type = doc_type;
  
  -- Format the result: PREFIX-YEARMONTH-NUMBER (e.g., FAC-202506-0001)
  result := counter_record.prefix || '-' || 
            to_char(current_date, 'YYYYMM') || '-' || 
            lpad(new_number::text, 4, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON customer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_items_updated_at
BEFORE UPDATE ON quote_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
BEFORE UPDATE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_notes_updated_at
BEFORE UPDATE ON credit_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_note_items_updated_at
BEFORE UPDATE ON credit_note_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON company_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mail_settings_updated_at
BEFORE UPDATE ON mail_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_counters_updated_at
BEFORE UPDATE ON document_counters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for auto-generating document numbers
CREATE OR REPLACE FUNCTION set_document_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := generate_document_number('quote');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number
BEFORE INSERT ON quotes
FOR EACH ROW
EXECUTE FUNCTION set_document_number();

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_document_number('order');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_document_number('invoice');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION set_invoice_number();

CREATE OR REPLACE FUNCTION set_credit_note_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_note_number IS NULL OR NEW.credit_note_number = '' THEN
    NEW.credit_note_number := generate_document_number('credit_note');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_credit_note_number
BEFORE INSERT ON credit_notes
FOR EACH ROW
EXECUTE FUNCTION set_credit_note_number();

-- Create function to update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric;
  invoice_total numeric;
  invoice_status text;
  due_date date;
BEGIN
  -- Get total paid amount for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments
  WHERE invoice_id = NEW.invoice_id;
  
  -- Get invoice total and due date
  SELECT total_ttc, date_due, status INTO invoice_total, due_date, invoice_status
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Update amount_paid
  UPDATE invoices SET amount_paid = total_paid WHERE id = NEW.invoice_id;
  
  -- Update status based on payment amount and due date
  IF invoice_status != 'cancelled' THEN
    IF total_paid >= invoice_total THEN
      UPDATE invoices SET status = 'paid' WHERE id = NEW.invoice_id;
    ELSIF total_paid > 0 THEN
      UPDATE invoices SET status = 'partial' WHERE id = NEW.invoice_id;
    ELSIF CURRENT_DATE > due_date THEN
      UPDATE invoices SET status = 'late' WHERE id = NEW.invoice_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_status_on_payment
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_status();

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all access for authenticated users"
ON customers FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON customer_addresses FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON quotes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON quote_items FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON orders FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON order_items FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON invoices FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON invoice_items FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON credit_notes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON credit_note_items FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON payments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON company_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON mail_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users"
ON document_counters FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Insert default document counters
INSERT INTO document_counters (document_type, prefix, last_number)
VALUES 
  ('quote', 'DEV', 0),
  ('order', 'CMD', 0),
  ('invoice', 'FAC', 0),
  ('credit_note', 'AVO', 0)
ON CONFLICT (document_type) DO NOTHING;

-- Insert default company settings
INSERT INTO company_settings (
  company_name, 
  address_line1, 
  zip, 
  city, 
  country, 
  footer_text, 
  terms_and_conditions
)
VALUES (
  'Votre Entreprise', 
  '123 Rue Exemple', 
  '75000', 
  'Paris', 
  'France', 
  'Merci pour votre confiance. Tous les prix sont en euros.', 
  'Conditions générales de vente : Les produits restent la propriété de la société jusqu''au paiement intégral.'
)
ON CONFLICT DO NOTHING;