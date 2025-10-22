import type { Database } from './supabase-generated';

// Customer types
export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];
export type CustomerAddressInsert = Database['public']['Tables']['customer_addresses']['Insert'];
export type CustomerAddressUpdate = Database['public']['Tables']['customer_addresses']['Update'];

// Quote types
export type Quote = Database['public']['Tables']['quotes']['Row'] & { document_type_id?: string | null };
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'] & { document_type_id?: string | null };
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

export type QuoteItem = Database['public']['Tables']['quote_items']['Row'];
export type QuoteItemInsert = Database['public']['Tables']['quote_items']['Insert'];
export type QuoteItemUpdate = Database['public']['Tables']['quote_items']['Update'];

// Order types
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type OrderUpdate = Database['public']['Tables']['orders']['Update'];

export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];
export type OrderItemUpdate = Database['public']['Tables']['order_items']['Update'];

// Invoice types
export type Invoice = Database['public']['Tables']['invoices']['Row'] & { document_type_id?: string | null };
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'] & { document_type_id?: string | null };
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert'];
export type InvoiceItemUpdate = Database['public']['Tables']['invoice_items']['Update'];

// Credit note types
export type CreditNote = Database['public']['Tables']['credit_notes']['Row'] & { document_type_id?: string | null };
export type CreditNoteInsert = Database['public']['Tables']['credit_notes']['Insert'] & { document_type_id?: string | null };
export type CreditNoteUpdate = Database['public']['Tables']['credit_notes']['Update'];

export type CreditNoteItem = Database['public']['Tables']['credit_note_items']['Row'];
export type CreditNoteItemInsert = Database['public']['Tables']['credit_note_items']['Insert'];
export type CreditNoteItemUpdate = Database['public']['Tables']['credit_note_items']['Update'];

// Payment types
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

// Settings types
export type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
export type MailSettings = Database['public']['Tables']['mail_settings']['Row'];
export type DocumentCounter = Database['public']['Tables']['document_counters']['Row'];

// Document type types
export interface DocumentType {
  id: string;
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}
export type DocumentTypeInsert = Database['public']['Tables']['billing_document_types']['Insert'];
export type DocumentTypeUpdate = Database['public']['Tables']['billing_document_types']['Update'];

// Extended types with joins
export interface CustomerWithAddresses extends Customer {
  addresses?: CustomerAddress[];
}

export interface QuoteWithDetails extends Quote {
  customer?: Customer;
  items?: QuoteItem[];
  document_type?: DocumentType;
}

export interface OrderWithDetails extends Order {
  customer?: Customer;
  items?: OrderItem[];
  quote?: Quote;
  document_type?: DocumentType;
}

export interface InvoiceWithDetails extends Invoice {
  customer?: Customer;
  items?: InvoiceItem[];
  payments?: Payment[];
  order?: Order;
  quote?: Quote;
  document_type?: DocumentType;
}

export interface CreditNoteWithDetails extends CreditNote {
  invoice?: InvoiceWithDetails;
  items?: CreditNoteItem[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_group?: string;
  invoice_number?: string;
  document_type?: DocumentType;
}

// Document item interface (for shared components)
export interface DocumentItem {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
  product?: {
    name?: string;
    sku?: string;
  };
}

// Address interface
export interface Address {
  id?: string;
  line1: string;
  line2?: string;
  zip: string;
  city: string;
  country: string;
}

// Payment methods
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check' | 'other';

// Document statuses
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';
export type OrderStatus = 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'late' | 'cancelled';
export type CreditNoteStatus = 'draft' | 'sent' | 'processed';

// CSV import format for document items
export interface DocumentItemCSV {
  sku: string;
  quantity: number;
  unit_price?: number;
}
