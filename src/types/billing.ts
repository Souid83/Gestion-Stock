// Lightweight billing types decoupled from generated Supabase Database schema.
// Goal: avoid compile errors while the generated schema (supabase-generated.ts) does not list billing tables yet.
// These types are intentionally permissive (any-based) except for DocumentType and a few common fields.
// When you regenerate supabase types including billing tables, you can replace these with strict table-mapped types.

export type AnyRecord = Record<string, any>;

// Customers
export type Customer = AnyRecord;
export type CustomerInsert = AnyRecord;
export type CustomerUpdate = AnyRecord;

export type CustomerAddress = AnyRecord;
export type CustomerAddressInsert = AnyRecord;
export type CustomerAddressUpdate = AnyRecord;

// Quotes
export interface Quote extends AnyRecord {
  id?: string;
  document_type_id?: string | null;
}
export interface QuoteInsert extends AnyRecord {
  document_type_id?: string | null; // Required at UI level; optional in TS for backward compat
}
export type QuoteUpdate = AnyRecord;

export type QuoteItem = AnyRecord;
export type QuoteItemInsert = AnyRecord;
export type QuoteItemUpdate = AnyRecord;

// Orders
export type Order = AnyRecord;
export type OrderInsert = AnyRecord;
export type OrderUpdate = AnyRecord;

export type OrderItem = AnyRecord;
export type OrderItemInsert = AnyRecord;
export type OrderItemUpdate = AnyRecord;

// Invoices
export interface Invoice extends AnyRecord {
  id?: string;
  document_type_id?: string | null;
}
export interface InvoiceInsert extends AnyRecord {
  document_type_id?: string | null; // Required at UI level; optional in TS for backward compat
}
export type InvoiceUpdate = AnyRecord;

export type InvoiceItem = AnyRecord;
export type InvoiceItemInsert = AnyRecord;
export type InvoiceItemUpdate = AnyRecord;

// Credit notes
export interface CreditNote extends AnyRecord {
  id?: string;
  document_type_id?: string | null;
}
export interface CreditNoteInsert extends AnyRecord {
  document_type_id?: string | null; // Required at UI level; optional in TS for backward compat
}
export type CreditNoteUpdate = AnyRecord;

export type CreditNoteItem = AnyRecord;
export type CreditNoteItemInsert = AnyRecord;
export type CreditNoteItemUpdate = AnyRecord;

// Payments
export type Payment = AnyRecord;
export type PaymentInsert = AnyRecord;
export type PaymentUpdate = AnyRecord;

// Settings
export type CompanySettings = AnyRecord;
export type MailSettings = AnyRecord;
export type DocumentCounter = AnyRecord;

// Document Types (strict)
export interface DocumentType {
  id: string;
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}
export type DocumentTypeInsert = {
  id?: string;
  label: string;
  description?: string | null;
  is_active?: boolean;
};
export type DocumentTypeUpdate = Partial<DocumentTypeInsert>;

// Extended “WithDetails” shapes (kept permissive; consumers can refine as needed)
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

// Shared document item shape (for UI)
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

// Address interface (UI)
export interface Address {
  id?: string;
  line1: string;
  line2?: string;
  zip: string;
  city: string;
  country: string;
}

// Enums
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check' | 'other';
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
