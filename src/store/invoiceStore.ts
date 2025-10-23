import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { ensureDocumentType, getDocumentTypes } from './quoteStore';
import type {
  Invoice,
  InvoiceInsert,
  InvoiceUpdate,
  InvoiceItem,
  InvoiceItemInsert,
  InvoiceWithDetails,
  Payment,
  PaymentInsert,
  DocumentItem
} from '../types/billing';

// Re-export for convenience
export { ensureDocumentType, getDocumentTypes };

interface InvoiceStore {
  invoices: InvoiceWithDetails[];
  currentInvoice: InvoiceWithDetails | null;
  isLoading: boolean;
  error: string | null;
  
  // Invoice CRUD operations
  fetchInvoices: () => Promise<InvoiceWithDetails[]>;
  getInvoiceById: (id: string) => Promise<InvoiceWithDetails | null>;
  createInvoice: (invoice: InvoiceInsert) => Promise<Invoice | null>;
  updateInvoice: (id: string, updates: InvoiceUpdate) => Promise<Invoice | null>;
  deleteInvoice: (id: string) => Promise<void>;
  
  // Invoice items operations
  addInvoiceItem: (invoiceId: string, item: Omit<InvoiceItemInsert, 'invoice_id'>) => Promise<InvoiceItem | null>;
  updateInvoiceItem: (id: string, updates: Partial<InvoiceItem>) => Promise<InvoiceItem | null>;
  deleteInvoiceItem: (id: string, invoiceId: string) => Promise<void>;
  
  // Bulk operations
  addInvoiceItems: (invoiceId: string, items: Omit<InvoiceItemInsert, 'invoice_id'>[]) => Promise<InvoiceItem[]>;
  
  // Invoice status operations
  sendInvoice: (id: string) => Promise<Invoice | null>;
  markAsPaid: (id: string) => Promise<Invoice | null>;
  markAsPartial: (id: string) => Promise<Invoice | null>;
  markAsLate: (id: string) => Promise<Invoice | null>;
  cancelInvoice: (id: string) => Promise<Invoice | null>;
  
  // Payment operations
  addPayment: (payment: PaymentInsert) => Promise<Payment | null>;
  getPaymentsByInvoiceId: (invoiceId: string) => Promise<Payment[]>;
  
  // Import operations
  importItemsFromCSV: (invoiceId: string, csvData: string) => Promise<{ success: boolean, items: InvoiceItem[], errors: string[] }>;
  
  // Recalculate totals
  recalculateInvoiceTotals: (invoiceId: string) => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  currentInvoice: null,
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching invoices...');
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group),
          document_type:billing_document_types(*)
        `)
        .order('date_issued', { ascending: false });

      if (error) throw error;
      
      const invoices = data as InvoiceWithDetails[] || [];
      console.log(`Fetched ${invoices.length} invoices`);
      set({ invoices, isLoading: false });
      return invoices;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching invoices',
        isLoading: false 
      });
      return [];
    }
  },

  getInvoiceById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Fetching invoice with ID: ${id}`);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(*, product:products(id, name, sku, retail_price, pro_price)),
          order:orders(id, order_number),
          quote:quotes(id, quote_number),
          document_type:billing_document_types(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const invoice = data as InvoiceWithDetails;
      
      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', id)
        .order('payment_date', { ascending: false });
        
      if (paymentsError) throw paymentsError;
      
      invoice.payments = paymentsData as Payment[];
      
      set({ currentInvoice: invoice, isLoading: false });
      console.log('Invoice fetched successfully:', invoice);
      return invoice;
    } catch (error) {
      console.error(`Error fetching invoice with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while fetching invoice with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  createInvoice: async (invoice: InvoiceInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating new invoice:', invoice);

      // Validation: document_type_id is required
      if (!invoice.document_type_id) {
        throw new Error('Le typage de document est obligatoire');
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert([invoice])
        .select()
        .single();

      if (error) throw error;

      const newInvoice = data as Invoice;
      set(state => ({
        invoices: [newInvoice, ...state.invoices],
        currentInvoice: { ...newInvoice, items: [] },
        isLoading: false
      }));

      console.log('Invoice created successfully:', newInvoice);
      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      set({
        error: error instanceof Error ? error.message : 'An error occurred while creating the invoice',
        isLoading: false
      });
      return null;
    }
  },

  updateInvoice: async (id: string, updates: InvoiceUpdate) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating invoice with ID ${id}:`, updates);
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedInvoice = data as Invoice;
      set(state => ({
        invoices: state.invoices.map(invoice => 
          invoice.id === id 
            ? { ...invoice, ...updatedInvoice }
            : invoice
        ),
        currentInvoice: state.currentInvoice?.id === id 
          ? { ...state.currentInvoice, ...updatedInvoice }
          : state.currentInvoice,
        isLoading: false
      }));
      
      console.log('Invoice updated successfully:', updatedInvoice);
      return updatedInvoice;
    } catch (error) {
      console.error(`Error updating invoice with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating invoice with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteInvoice: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting invoice with ID: ${id}`);
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      set(state => ({
        invoices: state.invoices.filter(invoice => invoice.id !== id),
        currentInvoice: state.currentInvoice?.id === id ? null : state.currentInvoice,
        isLoading: false
      }));
      
      console.log(`Invoice with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting invoice with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting invoice with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addInvoiceItem: async (invoiceId: string, item: Omit<InvoiceItemInsert, 'invoice_id'>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding item to invoice ${invoiceId}:`, item);
      
      // Calculate total price if not provided
      const totalPrice = item.total_price || (item.unit_price * item.quantity);
      
      const invoiceItem: InvoiceItemInsert = {
        ...item,
        invoice_id: invoiceId,
        total_price: totalPrice
      };
      
      const { data, error } = await supabase
        .from('invoice_items')
        .insert([invoiceItem])
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const newItem = data as InvoiceItem & { product: any };
      
      // Update the current invoice in state
      set(state => {
        if (state.currentInvoice && state.currentInvoice.id === invoiceId) {
          const items = state.currentInvoice.items || [];
          return {
            currentInvoice: {
              ...state.currentInvoice,
              items: [...items, newItem]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate invoice totals
      await get().recalculateInvoiceTotals(invoiceId);
      
      console.log('Invoice item added successfully:', newItem);
      return newItem;
    } catch (error) {
      console.error(`Error adding item to invoice ${invoiceId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding item to invoice ${invoiceId}`,
        isLoading: false 
      });
      return null;
    }
  },

  updateInvoiceItem: async (id: string, updates: Partial<InvoiceItem>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating invoice item with ID ${id}:`, updates);
      
      // If quantity or unit_price is updated, recalculate total_price
      if ((updates.quantity !== undefined || updates.unit_price !== undefined) && !updates.total_price) {
        // Get current item
        const { data: currentItem } = await supabase
          .from('invoice_items')
          .select('quantity, unit_price')
          .eq('id', id)
          .single();
          
        if (currentItem) {
          const quantity = updates.quantity !== undefined ? updates.quantity : currentItem.quantity;
          const unitPrice = updates.unit_price !== undefined ? updates.unit_price : currentItem.unit_price;
          updates.total_price = quantity * unitPrice;
        }
      }
      
      const { data, error } = await supabase
        .from('invoice_items')
        .update(updates)
        .eq('id', id)
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const updatedItem = data as InvoiceItem & { product: any };
      
      // Update the current invoice in state
      set(state => {
        if (state.currentInvoice && state.currentInvoice.items) {
          const invoiceId = updatedItem.invoice_id;
          if (state.currentInvoice.id === invoiceId) {
            return {
              currentInvoice: {
                ...state.currentInvoice,
                items: state.currentInvoice.items.map(item => 
                  item.id === id ? updatedItem : item
                )
              },
              isLoading: false
            };
          }
        }
        return { isLoading: false };
      });
      
      // Recalculate invoice totals
      await get().recalculateInvoiceTotals(updatedItem.invoice_id);
      
      console.log('Invoice item updated successfully:', updatedItem);
      return updatedItem;
    } catch (error) {
      console.error(`Error updating invoice item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating invoice item with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteInvoiceItem: async (id: string, invoiceId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting invoice item with ID: ${id}`);
      const { error } = await supabase
        .from('invoice_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update the current invoice in state
      set(state => {
        if (state.currentInvoice && state.currentInvoice.id === invoiceId && state.currentInvoice.items) {
          return {
            currentInvoice: {
              ...state.currentInvoice,
              items: state.currentInvoice.items.filter(item => item.id !== id)
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate invoice totals
      await get().recalculateInvoiceTotals(invoiceId);
      
      console.log(`Invoice item with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting invoice item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting invoice item with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addInvoiceItems: async (invoiceId: string, items: Omit<InvoiceItemInsert, 'invoice_id'>[]) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding ${items.length} items to invoice ${invoiceId}`);
      
      // Prepare items with invoice_id and calculated total_price
      const invoiceItems: InvoiceItemInsert[] = items.map(item => ({
        ...item,
        invoice_id: invoiceId,
        total_price: item.total_price || (item.unit_price * item.quantity)
      }));
      
      const { data, error } = await supabase
        .from('invoice_items')
        .insert(invoiceItems)
        .select(`*, product:products(id, name, sku)`);

      if (error) throw error;
      
      const newItems = data as (InvoiceItem & { product: any })[];
      
      // Update the current invoice in state
      set(state => {
        if (state.currentInvoice && state.currentInvoice.id === invoiceId) {
          const currentItems = state.currentInvoice.items || [];
          return {
            currentInvoice: {
              ...state.currentInvoice,
              items: [...currentItems, ...newItems]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate invoice totals
      await get().recalculateInvoiceTotals(invoiceId);
      
      console.log(`${newItems.length} invoice items added successfully`);
      return newItems;
    } catch (error) {
      console.error(`Error adding items to invoice ${invoiceId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding items to invoice ${invoiceId}`,
        isLoading: false 
      });
      return [];
    }
  },

  sendInvoice: async (id: string) => {
    return await get().updateInvoice(id, { status: 'sent' });
  },

  markAsPaid: async (id: string) => {
    return await get().updateInvoice(id, { status: 'paid' });
  },

  markAsPartial: async (id: string) => {
    return await get().updateInvoice(id, { status: 'partial' });
  },

  markAsLate: async (id: string) => {
    return await get().updateInvoice(id, { status: 'late' });
  },

  cancelInvoice: async (id: string) => {
    return await get().updateInvoice(id, { status: 'cancelled' });
  },

  addPayment: async (payment: PaymentInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Adding payment:', payment);
      
      const { data, error } = await supabase
        .from('payments')
        .insert([payment])
        .select()
        .single();

      if (error) throw error;
      
      const newPayment = data as Payment;
      
      // Update the current invoice in state if it's the one being paid
      set(state => {
        if (state.currentInvoice && state.currentInvoice.id === payment.invoice_id) {
          const payments = state.currentInvoice.payments || [];
          return {
            currentInvoice: {
              ...state.currentInvoice,
              payments: [...payments, newPayment]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      console.log('Payment added successfully:', newPayment);
      return newPayment;
    } catch (error) {
      console.error('Error adding payment:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the payment',
        isLoading: false 
      });
      return null;
    }
  },

  getPaymentsByInvoiceId: async (invoiceId: string) => {
    try {
      console.log(`Fetching payments for invoice ${invoiceId}`);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      
      const payments = data as Payment[];
      console.log(`Fetched ${payments.length} payments for invoice ${invoiceId}`);
      return payments;
    } catch (error) {
      console.error(`Error fetching payments for invoice ${invoiceId}:`, error);
      return [];
    }
  },

  importItemsFromCSV: async (invoiceId: string, csvData: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Importing CSV data to invoice ${invoiceId}`);
      
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate headers
      const requiredHeaders = ['sku', 'quantity'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }
      
      const skuIndex = headers.indexOf('sku');
      const quantityIndex = headers.indexOf('quantity');
      const priceIndex = headers.indexOf('unit_price');
      
      const items: DocumentItem[] = [];
      const errors: string[] = [];
      
      // Process each line (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        const sku = values[skuIndex]?.trim();
        const quantityStr = values[quantityIndex]?.trim();
        const priceStr = priceIndex >= 0 ? values[priceIndex]?.trim() : '';
        
        if (!sku || !quantityStr) {
          errors.push(`Line ${i+1}: Missing SKU or quantity`);
          continue;
        }
        
        const quantity = parseInt(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Line ${i+1}: Invalid quantity "${quantityStr}"`);
          continue;
        }
        
        // Look up product by SKU
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, name, retail_price, pro_price')
          .eq('sku', sku)
          .single();
          
        if (productError || !productData) {
          errors.push(`Line ${i+1}: Product with SKU "${sku}" not found`);
          continue;
        }
        
        // Use provided price or default to retail_price
        let unitPrice = 0;
        if (priceStr && !isNaN(parseFloat(priceStr))) {
          unitPrice = parseFloat(priceStr);
        } else if (productData.retail_price) {
          unitPrice = productData.retail_price;
        } else if (productData.pro_price) {
          unitPrice = productData.pro_price;
        } else {
          errors.push(`Line ${i+1}: No price available for product "${sku}"`);
          continue;
        }
        
        items.push({
          product_id: productData.id,
          description: productData.name || sku,
          quantity,
          unit_price: unitPrice,
          tax_rate: 20, // Default tax rate
          total_price: quantity * unitPrice
        });
      }
      
      // Add items to invoice
      let addedItems: InvoiceItem[] = [];
      if (items.length > 0) {
        const { data, error } = await supabase
          .from('invoice_items')
          .insert(items.map(item => ({
            ...item,
            invoice_id: invoiceId
          })))
          .select(`*, product:products(id, name, sku)`);
          
        if (error) throw error;
        
        addedItems = data as InvoiceItem[];
        
        // Update the current invoice in state
        set(state => {
          if (state.currentInvoice && state.currentInvoice.id === invoiceId) {
            const currentItems = state.currentInvoice.items || [];
            return {
              currentInvoice: {
                ...state.currentInvoice,
                items: [...currentItems, ...addedItems]
              }
            };
          }
          return {};
        });
        
        // Recalculate invoice totals
        await get().recalculateInvoiceTotals(invoiceId);
      }
      
      set({ isLoading: false });
      console.log(`Imported ${addedItems.length} items to invoice ${invoiceId}`);
      return { 
        success: errors.length === 0, 
        items: addedItems, 
        errors 
      };
    } catch (error) {
      console.error(`Error importing CSV data to invoice ${invoiceId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while importing CSV data to invoice ${invoiceId}`,
        isLoading: false 
      });
      return { success: false, items: [], errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  recalculateInvoiceTotals: async (invoiceId: string) => {
    try {
      console.log(`Recalculating totals for invoice ${invoiceId}`);
      
      // Get all items for this invoice
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('unit_price, quantity, tax_rate, total_price')
        .eq('invoice_id', invoiceId);
        
      if (itemsError) throw itemsError;
      
      // Calculate totals
      let totalHT = 0;
      let totalTVA = 0;
      
      items?.forEach(item => {
        const itemTotal = item.total_price || (item.unit_price * item.quantity);
        totalHT += itemTotal;
        totalTVA += itemTotal * (item.tax_rate / 100);
      });
      
      const totalTTC = totalHT + totalTVA;
      
      // Update invoice with new totals
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          total_ht: totalHT,
          total_ttc: totalTTC,
          tva: totalTVA
        })
        .eq('id', invoiceId);
        
      if (updateError) throw updateError;
      
      // Update local state
      set(state => {
        // Update in invoices list
        const updatedInvoices = state.invoices.map(invoice => {
          if (invoice.id === invoiceId) {
            return {
              ...invoice,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            };
          }
          return invoice;
        });
        
        // Update current invoice if it's the one being modified
        const updatedCurrentInvoice = state.currentInvoice?.id === invoiceId
          ? {
              ...state.currentInvoice,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            }
          : state.currentInvoice;
          
        return {
          invoices: updatedInvoices,
          currentInvoice: updatedCurrentInvoice
        };
      });
      
      console.log(`Invoice ${invoiceId} totals recalculated: HT=${totalHT}, TVA=${totalTVA}, TTC=${totalTTC}`);
    } catch (error) {
      console.error(`Error recalculating totals for invoice ${invoiceId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while recalculating totals for invoice ${invoiceId}`
      });
    }
  },

  clearError: () => set({ error: null })
}));