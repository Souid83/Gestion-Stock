/*
  # Create credit_notes_with_details view

  1. New Views
    - `credit_notes_with_details` - A view that joins credit_notes with invoices and customers
      - Contains all credit_note fields
      - Contains related invoice information (invoice_number, customer_id)
      - Contains related customer information (name, email, phone, customer_group)

  2. Purpose
    - Simplifies querying of credit notes with related data
    - Avoids complex join syntax in application code
    - Provides a clean interface for the frontend
*/

-- Create view for credit notes with details
CREATE OR REPLACE VIEW credit_notes_with_details AS
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