import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { 
  Order, 
  OrderInsert, 
  OrderUpdate, 
  OrderItem, 
  OrderItemInsert, 
  OrderWithDetails,
  DocumentItem
} from '../types/billing';

interface OrderStore {
  orders: OrderWithDetails[];
  currentOrder: OrderWithDetails | null;
  isLoading: boolean;
  error: string | null;
  
  // Order CRUD operations
  fetchOrders: () => Promise<OrderWithDetails[]>;
  getOrderById: (id: string) => Promise<OrderWithDetails | null>;
  createOrder: (order: OrderInsert) => Promise<Order | null>;
  updateOrder: (id: string, updates: OrderUpdate) => Promise<Order | null>;
  deleteOrder: (id: string) => Promise<void>;
  
  // Order items operations
  addOrderItem: (orderId: string, item: Omit<OrderItemInsert, 'order_id'>) => Promise<OrderItem | null>;
  updateOrderItem: (id: string, updates: Partial<OrderItem>) => Promise<OrderItem | null>;
  deleteOrderItem: (id: string, orderId: string) => Promise<void>;
  
  // Bulk operations
  addOrderItems: (orderId: string, items: Omit<OrderItemInsert, 'order_id'>[]) => Promise<OrderItem[]>;
  
  // Order status operations
  confirmOrder: (id: string) => Promise<Order | null>;
  shipOrder: (id: string) => Promise<Order | null>;
  deliverOrder: (id: string) => Promise<Order | null>;
  cancelOrder: (id: string) => Promise<Order | null>;
  
  // Convert operations
  convertToInvoice: (orderId: string) => Promise<string | null>; // Returns invoice ID
  
  // Import operations
  importItemsFromCSV: (orderId: string, csvData: string) => Promise<{ success: boolean, items: OrderItem[], errors: string[] }>;
  
  // Recalculate totals
  recalculateOrderTotals: (orderId: string) => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  currentOrder: null,
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching orders...');
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group)
        `)
        .order('date_issued', { ascending: false });

      if (error) throw error;
      
      const orders = data as OrderWithDetails[] || [];
      console.log(`Fetched ${orders.length} orders`);
      set({ orders, isLoading: false });
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching orders',
        isLoading: false 
      });
      return [];
    }
  },

  getOrderById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Fetching order with ID: ${id}`);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          items:order_items(*, product:products(id, name, sku, retail_price, pro_price)),
          quote:quotes(id, quote_number)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const order = data as OrderWithDetails;
      set({ currentOrder: order, isLoading: false });
      console.log('Order fetched successfully:', order);
      return order;
    } catch (error) {
      console.error(`Error fetching order with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while fetching order with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  createOrder: async (order: OrderInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating new order:', order);
      
      const { data, error } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single();

      if (error) throw error;
      
      const newOrder = data as Order;
      set(state => ({ 
        orders: [newOrder, ...state.orders],
        currentOrder: { ...newOrder, items: [] },
        isLoading: false 
      }));
      
      console.log('Order created successfully:', newOrder);
      return newOrder;
    } catch (error) {
      console.error('Error creating order:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while creating the order',
        isLoading: false 
      });
      return null;
    }
  },

  updateOrder: async (id: string, updates: OrderUpdate) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating order with ID ${id}:`, updates);
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedOrder = data as Order;
      set(state => ({
        orders: state.orders.map(order => 
          order.id === id 
            ? { ...order, ...updatedOrder }
            : order
        ),
        currentOrder: state.currentOrder?.id === id 
          ? { ...state.currentOrder, ...updatedOrder }
          : state.currentOrder,
        isLoading: false
      }));
      
      console.log('Order updated successfully:', updatedOrder);
      return updatedOrder;
    } catch (error) {
      console.error(`Error updating order with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating order with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteOrder: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting order with ID: ${id}`);
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      set(state => ({
        orders: state.orders.filter(order => order.id !== id),
        currentOrder: state.currentOrder?.id === id ? null : state.currentOrder,
        isLoading: false
      }));
      
      console.log(`Order with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting order with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting order with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addOrderItem: async (orderId: string, item: Omit<OrderItemInsert, 'order_id'>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding item to order ${orderId}:`, item);
      
      // Calculate total price if not provided
      const totalPrice = item.total_price || (item.unit_price * item.quantity);
      
      const orderItem: OrderItemInsert = {
        ...item,
        order_id: orderId,
        total_price: totalPrice
      };
      
      const { data, error } = await supabase
        .from('order_items')
        .insert([orderItem])
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const newItem = data as OrderItem & { product: any };
      
      // Update the current order in state
      set(state => {
        if (state.currentOrder && state.currentOrder.id === orderId) {
          const items = state.currentOrder.items || [];
          return {
            currentOrder: {
              ...state.currentOrder,
              items: [...items, newItem]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate order totals
      await get().recalculateOrderTotals(orderId);
      
      console.log('Order item added successfully:', newItem);
      return newItem;
    } catch (error) {
      console.error(`Error adding item to order ${orderId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding item to order ${orderId}`,
        isLoading: false 
      });
      return null;
    }
  },

  updateOrderItem: async (id: string, updates: Partial<OrderItem>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating order item with ID ${id}:`, updates);
      
      // If quantity or unit_price is updated, recalculate total_price
      if ((updates.quantity !== undefined || updates.unit_price !== undefined) && !updates.total_price) {
        // Get current item
        const { data: currentItem } = await supabase
          .from('order_items')
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
        .from('order_items')
        .update(updates)
        .eq('id', id)
        .select(`*, product:products(id, name, sku)`)
        .single();

      if (error) throw error;
      
      const updatedItem = data as OrderItem & { product: any };
      
      // Update the current order in state
      set(state => {
        if (state.currentOrder && state.currentOrder.items) {
          const orderId = updatedItem.order_id;
          if (state.currentOrder.id === orderId) {
            return {
              currentOrder: {
                ...state.currentOrder,
                items: state.currentOrder.items.map(item => 
                  item.id === id ? updatedItem : item
                )
              },
              isLoading: false
            };
          }
        }
        return { isLoading: false };
      });
      
      // Recalculate order totals
      await get().recalculateOrderTotals(updatedItem.order_id);
      
      console.log('Order item updated successfully:', updatedItem);
      return updatedItem;
    } catch (error) {
      console.error(`Error updating order item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating order item with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteOrderItem: async (id: string, orderId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting order item with ID: ${id}`);
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update the current order in state
      set(state => {
        if (state.currentOrder && state.currentOrder.id === orderId && state.currentOrder.items) {
          return {
            currentOrder: {
              ...state.currentOrder,
              items: state.currentOrder.items.filter(item => item.id !== id)
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate order totals
      await get().recalculateOrderTotals(orderId);
      
      console.log(`Order item with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting order item with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting order item with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addOrderItems: async (orderId: string, items: Omit<OrderItemInsert, 'order_id'>[]) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Adding ${items.length} items to order ${orderId}`);
      
      // Prepare items with order_id and calculated total_price
      const orderItems: OrderItemInsert[] = items.map(item => ({
        ...item,
        order_id: orderId,
        total_price: item.total_price || (item.unit_price * item.quantity)
      }));
      
      const { data, error } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select(`*, product:products(id, name, sku)`);

      if (error) throw error;
      
      const newItems = data as (OrderItem & { product: any })[];
      
      // Update the current order in state
      set(state => {
        if (state.currentOrder && state.currentOrder.id === orderId) {
          const currentItems = state.currentOrder.items || [];
          return {
            currentOrder: {
              ...state.currentOrder,
              items: [...currentItems, ...newItems]
            },
            isLoading: false
          };
        }
        return { isLoading: false };
      });
      
      // Recalculate order totals
      await get().recalculateOrderTotals(orderId);
      
      console.log(`${newItems.length} order items added successfully`);
      return newItems;
    } catch (error) {
      console.error(`Error adding items to order ${orderId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while adding items to order ${orderId}`,
        isLoading: false 
      });
      return [];
    }
  },

  confirmOrder: async (id: string) => {
    return await get().updateOrder(id, { status: 'confirmed' });
  },

  shipOrder: async (id: string) => {
    return await get().updateOrder(id, { status: 'shipped' });
  },

  deliverOrder: async (id: string) => {
    return await get().updateOrder(id, { status: 'delivered' });
  },

  cancelOrder: async (id: string) => {
    return await get().updateOrder(id, { status: 'cancelled' });
  },

  convertToInvoice: async (orderId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Converting order ${orderId} to invoice`);
      
      // Get the order with items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('id', orderId)
        .single();
        
      if (orderError) throw orderError;
      
      const order = orderData as OrderWithDetails;
      
      // Set due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      // Create the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          customer_id: order.customer_id,
          order_id: orderId,
          quote_id: order.quote_id,
          invoice_number: '', // Will be auto-generated
          status: 'draft',
          date_issued: new Date().toISOString().split('T')[0],
          date_due: dueDate.toISOString().split('T')[0],
          total_ht: order.total_ht,
          total_ttc: order.total_ttc,
          tva: order.tva,
          amount_paid: 0,
          note: order.note,
          billing_address_json: order.billing_address_json,
          shipping_address_json: order.shipping_address_json,
          created_by: order.created_by
        }])
        .select()
        .single();
        
      if (invoiceError) throw invoiceError;
      
      const invoice = invoiceData as any;
      
      // Create invoice items from order items
      if (order.items && order.items.length > 0) {
        const invoiceItems = order.items.map(item => ({
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
      
      // Update order status to confirmed if it's still draft
      if (order.status === 'draft') {
        await get().confirmOrder(orderId);
      }
      
      set({ isLoading: false });
      console.log(`Order ${orderId} converted to invoice ${invoice.id} successfully`);
      return invoice.id;
    } catch (error) {
      console.error(`Error converting order ${orderId} to invoice:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while converting order ${orderId} to invoice`,
        isLoading: false 
      });
      return null;
    }
  },

  importItemsFromCSV: async (orderId: string, csvData: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Importing CSV data to order ${orderId}`);
      
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
      
      // Add items to order
      let addedItems: OrderItem[] = [];
      if (items.length > 0) {
        const { data, error } = await supabase
          .from('order_items')
          .insert(items.map(item => ({
            ...item,
            order_id: orderId
          })))
          .select(`*, product:products(id, name, sku)`);
          
        if (error) throw error;
        
        addedItems = data as OrderItem[];
        
        // Update the current order in state
        set(state => {
          if (state.currentOrder && state.currentOrder.id === orderId) {
            const currentItems = state.currentOrder.items || [];
            return {
              currentOrder: {
                ...state.currentOrder,
                items: [...currentItems, ...addedItems]
              }
            };
          }
          return {};
        });
        
        // Recalculate order totals
        await get().recalculateOrderTotals(orderId);
      }
      
      set({ isLoading: false });
      console.log(`Imported ${addedItems.length} items to order ${orderId}`);
      return { 
        success: errors.length === 0, 
        items: addedItems, 
        errors 
      };
    } catch (error) {
      console.error(`Error importing CSV data to order ${orderId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while importing CSV data to order ${orderId}`,
        isLoading: false 
      });
      return { success: false, items: [], errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  },

  recalculateOrderTotals: async (orderId: string) => {
    try {
      console.log(`Recalculating totals for order ${orderId}`);
      
      // Get all items for this order
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('unit_price, quantity, tax_rate, total_price')
        .eq('order_id', orderId);
        
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
      
      // Update order with new totals
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          total_ht: totalHT,
          total_ttc: totalTTC,
          tva: totalTVA
        })
        .eq('id', orderId);
        
      if (updateError) throw updateError;
      
      // Update local state
      set(state => {
        // Update in orders list
        const updatedOrders = state.orders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            };
          }
          return order;
        });
        
        // Update current order if it's the one being modified
        const updatedCurrentOrder = state.currentOrder?.id === orderId
          ? {
              ...state.currentOrder,
              total_ht: totalHT,
              total_ttc: totalTTC,
              tva: totalTVA
            }
          : state.currentOrder;
          
        return {
          orders: updatedOrders,
          currentOrder: updatedCurrentOrder
        };
      });
      
      console.log(`Order ${orderId} totals recalculated: HT=${totalHT}, TVA=${totalTVA}, TTC=${totalTTC}`);
    } catch (error) {
      console.error(`Error recalculating totals for order ${orderId}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while recalculating totals for order ${orderId}`
      });
    }
  },

  clearError: () => set({ error: null })
}));