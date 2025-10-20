import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { 
  Quote, 
  QuoteInsert, 
  QuoteUpdate, 
  QuoteItem, 
  QuoteItemInsert, 
  QuoteWithDetails,
  DocumentItem
} from '../types/billing';

interface QuoteStore {
  quotes: QuoteWithDetails[];
  currentQuote: QuoteWithDetails | null;
  isLoading: boolean;
  error: string | null;
  
  // Quote CRUD operations
  fetchQuotes: () => Promise<QuoteWithDetails[]>;
  getQuoteById: (id: string) => Promise<QuoteWithDetails | null>;
  createQuote: (quote: QuoteInsert) => Promise<Quote | null>;
  updateQuote: (id: string, updates: QuoteUpdate) => Promise<Quote | null>;
  deleteQuote: (id: string) => Promise<void>;
  
  // Quote items operations
  addQuoteItem: (quoteId: string, item: Omit<QuoteItemInsert, 'quote_id'>) => Promise<QuoteItem | null>;
  updateQuoteItem: (id: string, updates: Partial<QuoteItem>) => Promise<QuoteItem | null>;
  deleteQuoteItem: (id: string, quoteId: string) => Promise<void>;
  
  // Bulk operations
  addQuoteItems: (quoteId: string, items: Omit<QuoteItemInsert, 'quote_id'>[]) => Promise<QuoteItem[]>;
  
  // Quote status operations
  sendQuote: (id: string) => Promise<Quote | null>;
  acceptQuote: (id: string) => Promise<Quote | null>;
  refuseQuote: (id: string) => Promise<Quote | null>;
  
  // Convert operations
  convertToOrder: (quoteId: string) => Promise<string | null>; // Returns order ID
  convertToInvoice: (quoteId: string) => Promise<string | null>; // Returns invoice ID
  
  // Import operations
  importItemsFromCSV: (quoteId: string, csvData: string) => Promise<{ success: boolean, items: QuoteItem[], errors: string[] }>;
  
  // Recalculate totals
  recalculateQuoteTotals: (quoteId: string) => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  currentQuote: null,
  isLoading: false,
  error: null,

  fetchQuotes: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching quotes...');
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group)
        `)
        .order('date_issued', { ascending: false });

      if (error) throw error;
      
      const quotes = data as QuoteWithDetails[] || [];
      console.log(`Fetched ${quotes.length} quotes`);
      set({ quotes, isLoading: false });
      return quotes;
    } catch (error) {
      console.error('Error fetching quotes:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching quotes',
        isLoading: false 
      });
      return [];
    }
  },

  getQuoteById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Fetching quote with ID: ${id}`);
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*),
          items:quote_items(*, product:products(id, name, sku, retail_price, pro_price))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const quote = data as QuoteWithDetails;
      set({ currentQuote: quote, isLoading: false });
      console.log('Quote fetched successfully:', quote);
      return quote;
    } catch (error) {
      console.error(`Error fetching quote with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while fetching quote with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  createQuote: async (quote: QuoteInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating new quote:', quote);
      
      const { data, error } = await supabase
        .from('quotes')
        .insert([quote])
        .select()
        .single();

      if (error) throw error;
      
      const newQuote = data as Quote;
      set(state => ({ 
        quotes: [newQuote, ...state.quotes],
        currentQuote: { ...newQuote, items: [] },
        isLoading: false 
      }));
      
      console.log('Quote created successfully:', newQuote);
      return newQuote;
    } catch (error) {
      console.error('Error creating quote:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while creating the quote',
        isLoading: false 
      });
      return null;
    }
  },

  updateQuote: async (id: string, updates: QuoteUpdate) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating quote with ID ${id}:`, updates);
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedQuote = data as Quote;
      set(state => ({
        quotes: state.quotes.map(quote => 
          quote.id === id 
            ? { ...quote, ...updatedQuote }
            : quote
        ),
        currentQuote: state.currentQuote?.id === id 
          ? { ...state.currentQuote, ...updatedQuote }
          : state.currentQuote,
        isLoading: false
      }));
      
      console.log('Quote updated successfully:', updatedQuote);
      return updatedQuote;
    } catch (error) {
      console.error(`Error updating quote with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating quote with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteQuote: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting quote with ID: ${id}`);
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      set(state => ({
        quotes: state.quotes.filter(quote => quote.id !== id),
        currentQuote: state.currentQuote?.id === id ? null : state.currentQuote,
        isLoading: false
      }));
      
      console.log(`Quote with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting quote with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting quote with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addQuoteItem: async (quoteId: string, item: Omit<QuoteItemInsert, 'quote_id'>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding item to quote ${quoteId}:`, item);
      
      // Calculate total price if not provided
      const totalPrice = item.total_price || (item.unit_price * item.quantity);
      
      const quoteItem: QuoteItemInsert = {
        ...item,
        quote_id: quoteId,
        total_price: totalPrice
      };
      
      const { data, error } = await supabase
        .from('quote_items')
        .insert([quoteItem])
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const newItem = data as QuoteItem & { product: any };
      
      // Update the current quote in state
      set(state => {
        if (state.currentQuote && state.currentQuote.id === quoteId) {
          const items = state.currentQuote.items || [];
          return {
            currentQuote: {
              ...state.currentQuote,
              items: [...items, newItem]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate quote totals
      await get().recalculateQuoteTotals(quoteId);
      
      console.log('Quote item added successfully:', newItem);
      return newItem;
    } catch (error) {
      console.error(`Error adding item to quote ${quoteId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding item to quote ${quoteId}`,
        isLoading: false 
      });
      return null;
    }
  },

  updateQuoteItem: async (id: string, updates: Partial<QuoteItem>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating quote item with ID ${id}:`, updates);
      
      // If quantity or unit_price is updated, recalculate total_price
      if ((updates.quantity !== undefined || updates.unit_price !== undefined) && !updates.total_price) {
        // Get current item
        const { data: currentItem } = await supabase
          .from('quote_items')
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
        .from('quote_items')
        .update(updates)
        .eq('id', id)
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const updatedItem = data as QuoteItem & { product: any };
      
      // Update the current quote in state
      set(state => {
        if (state.currentQuote && state.currentQuote.items) {
          const quoteId = updatedItem.quote_id;
          if (state.currentQuote.id === quoteId) {
            return {
              currentQuote: {
                ...state.currentQuote,
                items: state.currentQuote.items.map(item => 
                  item.id === id ? updatedItem : item
                )
              },
              isLoading: false
            };
          }
        }
        return { isLoading: false };
      });
      
      // Recalculate quote totals
      await get().recalculateQuoteTotals(updatedItem.quote_id);
      
      console.log('Quote item updated successfully:', updatedItem);
      return updatedItem;
    } catch (error) {
      console.error(`Error updating quote item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating quote item with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteQuoteItem: async (id: string, quoteId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting quote item with ID: ${id}`);
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update the current quote in state
      set(state => {
        if (state.currentQuote && state.currentQuote.id === quoteId && state.currentQuote.items) {
          return {
            currentQuote: {
              ...state.currentQuote,
              items: state.currentQuote.items.filter(item => item.id !== id)
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate quote totals
      await get().recalculateQuoteTotals(quoteId);
      
      console.log(`Quote item with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting quote item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting quote item with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addQuoteItems: async (quoteId: string, items: Omit<QuoteItemInsert, 'quote_id'>[]) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding ${items.length} items to quote ${quoteId}`);
      
      // Prepare items with quote_id and calculated total_price
      const quoteItems: QuoteItemInsert[] = items.map(item => ({
        ...item,
        quote_id: quoteId,
        total_price: item.total_price || (item.unit_price * item.quantity)
      }));
      
      const { data, error } = await supabase
        .from('quote_items')
        .insert(quoteItems)
        .select(`*, product:products(id, name, sku)`);

      if (error) throw error;
      
      const newItems = data as (QuoteItem & { product: any })[];
      
      // Update the current quote in state
      set(state => {
        if (state.currentQuote && state.currentQuote.id === quoteId) {
          const currentItems = state.currentQuote.items || [];
          return {
            currentQuote: {
              ...state.currentQuote,
              items: [...currentItems, ...newItems]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate quote totals
      await get().recalculateQuoteTotals(quoteId);
      
      console.log(`${newItems.length} quote items added successfully`);
      return newItems;
    } catch (error) {
      console.error(`Error adding items to quote ${quoteId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding items to quote ${quoteId}`,
        isLoading: false 
      });
      return [];
    }
  },

  sendQuote: async (id: string) => {
    return await get().updateQuote(id, { status: 'sent' });
  },

  acceptQuote: async (id: string) => {
    return await get().updateQuote(id, { status: 'accepted' });
  },

  refuseQuote: async (id: string) => {
    return await get().updateQuote(id, { status: 'refused' });
  },

  convertToOrder: async (quoteId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Converting quote ${quoteId} to order`);
      
      // Get the quote with items
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          items:quote_items(*)
        `)
        .eq('id', quoteId)
        .single();
        
      if (quoteError) throw quoteError;
      
      const quote = quoteData as QuoteWithDetails;
      
      // Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: quote.customer_id,
          quote_id: quoteId,
          order_number: '', // Will be auto-generated
          status: 'draft',
          date_issued: new Date().toISOString().split('T')[0],
          total_ht: quote.total_ht,
          total_ttc: quote.total_ttc,
          tva: quote.tva,
          note: quote.note,
          billing_address_json: quote.billing_address_json,
          shipping_address_json: quote.shipping_address_json,
          created_by: quote.created_by
        }])
        .select()
        .single();
        
      if (orderError) throw orderError;
      
      const order = orderData as any;
      
      // Create order items from quote items
      if (quote.items && quote.items.length > 0) {
        const orderItems = quote.items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total_price: item.total_price
        }));
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);
          
        if (itemsError) throw itemsError;
      }
      
      // Update quote status to accepted if not already
      if (quote.status !== 'accepted') {
        await get().acceptQuote(quoteId);
      }
      
      set({ isLoading: false });
      console.log(`Quote ${quoteId} converted to order ${order.id} successfully`);
      return order.id;
    } catch (error) {
      console.error(`Error converting quote ${quoteId} to order:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while converting quote ${quoteId} to order`,
        isLoading: false 
      });
      return null;
    }
  },

  convertToInvoice: async (quoteId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Converting quote ${quoteId} to invoice`);
      
      // Get the quote with items
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          items:quote_items(*)
        `)
        .eq('id', quoteId)
        .single();
        
      if (quoteError) throw quoteError;
      
      const quote = quoteData as QuoteWithDetails;
      
      // Set due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      // Create the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          customer_id: quote.customer_id,
          quote_id: quoteId,
          invoice_number: '', // Will be auto-generated
          status: 'draft',
          date_issued: new Date().toISOString().split('T')[0],
          date_due: dueDate.toISOString().split('T')[0],
          total_ht: quote.total_ht,
          total_ttc: quote.total_ttc,
          tva: quote.tva,
          amount_paid: 0,
          note: quote.note,
          billing_address_json: quote.billing_address_json,
          shipping_address_json: quote.shipping_address_json,
          created_by: quote.created_by
        }])
        .select()
        .single();
        
      if (invoiceError) throw invoiceError;
      
      const invoice = invoiceData as any;
      
      // Create invoice items from quote items
      if (quote.items && quote.items.length > 0) {
        const invoiceItems = quote.items.map(item => ({
          invoice_id: invoice.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total_price: item.total_price
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);
          
        if (itemsError) throw itemsError;
      }
      
      // Update quote status to accepted if not already
      if (quote.status !== 'accepted') {
        await get().acceptQuote(quoteId);
      }
      
      set({ isLoading: false });
      console.log(`Quote ${quoteId} converted to invoice ${invoice.id} successfully`);
      return invoice.id;
    } catch (error) {
      console.error(`Error converting quote ${quoteId} to invoice:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while converting quote ${quoteId} to invoice`,
        isLoading: false 
      });
      return null;
    }
  },

  importItemsFromCSV: async (quoteId: string, csvData: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Importing CSV data to quote ${quoteId}`);
      
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
      
      // Add items to quote
      let addedItems: QuoteItem[] = [];
      if (items.length > 0) {
        const { data, error } = await supabase
          .from('quote_items')
          .insert(items.map(item => ({
            ...item,
            quote_id: quoteId
          })))
          .select(`*, product:products(id, name, sku)`);
          
        if (error) throw error;
        
        addedItems = data as QuoteItem[];
        
        // Update the current quote in state
        set(state => {
          if (state.currentQuote && state.currentQuote.id === quoteId) {
            const currentItems = state.currentQuote.items || [];
            return {
              currentQuote: {
                ...state.currentQuote,
                items: [...currentItems, ...addedItems]
              }
            };
          }
          return {};
        });
        
        // Recalculate quote totals
        await get().recalculateQuoteTotals(quoteId);
      }
      
      set({ isLoading: false });
      console.log(`Imported ${addedItems.length} items to quote ${quoteId}`);
      return { 
        success: errors.length === 0, 
        items: addedItems, 
        errors 
      };
    } catch (error) {
      console.error(`Error importing CSV data to quote ${quoteId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while importing CSV data to quote ${quoteId}`,
        isLoading: false 
      });
      return { success: false, items: [], errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  recalculateQuoteTotals: async (quoteId: string) => {
    try {
      console.log(`Recalculating totals for quote ${quoteId}`);
      
      // Get all items for this quote
      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('unit_price, quantity, tax_rate, total_price')
        .eq('quote_id', quoteId);
        
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
      
      // Update quote with new totals
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          total_ht: totalHT,
          total_ttc: totalTTC,
          tva: totalTVA
        })
        .eq('id', quoteId);
        
      if (updateError) throw updateError;
      
      // Update local state
      set(state => {
        // Update in quotes list
        const updatedQuotes = state.quotes.map(quote => {
          if (quote.id === quoteId) {
            return {
              ...quote,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            };
          }
          return quote;
        });
        
        // Update current quote if it's the one being modified
        const updatedCurrentQuote = state.currentQuote?.id === quoteId
          ? {
              ...state.currentQuote,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            }
          : state.currentQuote;
          
        return {
          quotes: updatedQuotes,
          currentQuote: updatedCurrentQuote
        };
      });
      
      console.log(`Quote ${quoteId} totals recalculated: HT=${totalHT}, TVA=${totalTVA}, TTC=${totalTTC}`);
    } catch (error) {
      console.error(`Error recalculating totals for quote ${quoteId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while recalculating totals for quote ${quoteId}`
      });
    }
  },

  clearError: () => set({ error: null })
}));