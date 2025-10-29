-- Create view for credit notes with customer information
CREATE OR REPLACE VIEW credit_notes_with_customer AS
SELECT 
  cn.*,
  i.invoice_number,
  i.customer_id,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.customer_group
FROM 
  credit_notes cn
JOIN 
  invoices i ON cn.invoice_id = i.id
JOIN 
  customers c ON i.customer_id = c.id;