import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerAddress, CustomerAddressInsert, CustomerWithAddresses } from '../types/customers';

interface CustomerStore {
  customers: CustomerWithAddresses[];
  isLoading: boolean;
  error: string | null;
  
  // Customer CRUD operations
  fetchCustomers: () => Promise<CustomerWithAddresses[]>;
  getCustomerById: (id: string) => Promise<CustomerWithAddresses | null>;
  addCustomer: (customer: CustomerInsert) => Promise<Customer | null>;
  updateCustomer: (id: string, updates: CustomerUpdate) => Promise<Customer | null>;
  deleteCustomer: (id: string) => Promise<void>;
  
  // Address operations
  addAddress: (address: CustomerAddressInsert) => Promise<CustomerAddress | null>;
  updateAddress: (id: string, updates: Partial<CustomerAddress>) => Promise<CustomerAddress | null>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (customerId: string, addressId: string, type: 'billing' | 'shipping') => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching customers...');
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          addresses:customer_addresses(*)
        `)
        .order('name');

      if (error) throw error;
      
      const customers = data as CustomerWithAddresses[] || [];
      console.log(`Fetched ${customers.length} customers`);
      set({ customers, isLoading: false });
      return customers;
    } catch (error) {
      console.error('Error fetching customers:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching customers',
        isLoading: false 
      });
      return [];
    }
  },

  getCustomerById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Fetching customer with ID: ${id}`);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          addresses:customer_addresses(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      set({ isLoading: false });
      return data as CustomerWithAddresses;
    } catch (error) {
      console.error(`Error fetching customer with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while fetching customer with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  addCustomer: async (customer: CustomerInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Adding new customer:', customer);
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single();

      if (error) throw error;
      
      const newCustomer = data as Customer;
      set(state => ({ 
        customers: [...state.customers, { ...newCustomer, addresses: [] }],
        isLoading: false 
      }));
      
      console.log('Customer added successfully:', newCustomer);
      return newCustomer;
    } catch (error) {
      console.error('Error adding customer:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the customer',
        isLoading: false 
      });
      return null;
    }
  },

  updateCustomer: async (id: string, updates: CustomerUpdate) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating customer with ID ${id}:`, updates);
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedCustomer = data as Customer;
      set(state => ({
        customers: state.customers.map(customer => 
          customer.id === id 
            ? { ...customer, ...updatedCustomer }
            : customer
        ),
        isLoading: false
      }));
      
      console.log('Customer updated successfully:', updatedCustomer);
      return updatedCustomer;
    } catch (error) {
      console.error(`Error updating customer with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating customer with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteCustomer: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting customer with ID: ${id}`);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      set(state => ({
        customers: state.customers.filter(customer => customer.id !== id),
        isLoading: false
      }));
      
      console.log(`Customer with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting customer with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting customer with ID ${id}`,
        isLoading: false 
      });
    }
  },

  addAddress: async (address: CustomerAddressInsert) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Adding new address:', address);
      
      // If this is set as default, unset any existing default of the same type
      if (address.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', address.customer_id)
          .eq('address_type', address.address_type);
      }
      
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert([address])
        .select()
        .single();

      if (error) throw error;
      
      const newAddress = data as CustomerAddress;
      
      set(state => ({
        customers: state.customers.map(customer => {
          if (customer.id === address.customer_id) {
            const addresses = customer.addresses || [];
            return {
              ...customer,
              addresses: [...addresses, newAddress]
            };
          }
          return customer;
        }),
        isLoading: false
      }));
      
      console.log('Address added successfully:', newAddress);
      return newAddress;
    } catch (error) {
      console.error('Error adding address:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while adding the address',
        isLoading: false 
      });
      return null;
    }
  },

  updateAddress: async (id: string, updates: Partial<CustomerAddress>) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating address with ID ${id}:`, updates);
      
      // If this is set as default, unset any existing default of the same type
      if (updates.is_default) {
        const { data: addressData } = await supabase
          .from('customer_addresses')
          .select('customer_id, address_type')
          .eq('id', id)
          .single();
          
        if (addressData) {
          await supabase
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('customer_id', addressData.customer_id)
            .eq('address_type', addressData.address_type)
            .neq('id', id);
        }
      }
      
      const { data, error } = await supabase
        .from('customer_addresses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedAddress = data as CustomerAddress;
      
      set(state => ({
        customers: state.customers.map(customer => {
          if (customer.addresses?.some(addr => addr.id === id)) {
            return {
              ...customer,
              addresses: customer.addresses.map(addr => 
                addr.id === id ? updatedAddress : addr
              )
            };
          }
          return customer;
        }),
        isLoading: false
      }));
      
      console.log('Address updated successfully:', updatedAddress);
      return updatedAddress;
    } catch (error) {
      console.error(`Error updating address with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating address with ID ${id}`,
        isLoading: false 
      });
      return null;
    }
  },

  deleteAddress: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Deleting address with ID: ${id}`);
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      set(state => ({
        customers: state.customers.map(customer => {
          if (customer.addresses?.some(addr => addr.id === id)) {
            return {
              ...customer,
              addresses: customer.addresses.filter(addr => addr.id !== id)
            };
          }
          return customer;
        }),
        isLoading: false
      }));
      
      console.log(`Address with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting address with ID ${id}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while deleting address with ID ${id}`,
        isLoading: false 
      });
    }
  },

  setDefaultAddress: async (customerId: string, addressId: string, type: 'billing' | 'shipping') => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Setting address ${addressId} as default ${type} address for customer ${customerId}`);
      
      // First, unset any existing default of this type
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('address_type', type);
      
      // Then set the new default
      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('customer_id', customerId);

      if (error) throw error;
      
      // Update local state
      set(state => ({
        customers: state.customers.map(customer => {
          if (customer.id === customerId && customer.addresses) {
            return {
              ...customer,
              addresses: customer.addresses.map(addr => ({
                ...addr,
                is_default: addr.id === addressId && addr.address_type === type
              }))
            };
          }
          return customer;
        }),
        isLoading: false
      }));
      
      console.log(`Address ${addressId} set as default ${type} address successfully`);
    } catch (error) {
      console.error(`Error setting default address:`, error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while setting the default address',
        isLoading: false 
      });
    }
  },

  clearError: () => set({ error: null })
}));