import React, { useState, useEffect, useRef } from 'react';
import { useCustomerStore } from '../../store/customerStore';
import { Save, Plus, Trash2, User, MapPin, Phone, Mail, Building, Home, X } from 'lucide-react';
import { CustomerInsert, CustomerAddress, CustomerWithAddresses } from '../../types/customers';

interface CustomerFormProps {
  customerId?: string;
  onSaved?: (id: string) => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ customerId, onSaved }) => {
  const { 
    getCustomerById, 
    addCustomer, 
    updateCustomer, 
    addAddress, 
    updateAddress, 
    deleteAddress, 
    setDefaultAddress,
    isLoading, 
    error 
  } = useCustomerStore();
  
  // Form state
  const [formData, setFormData] = useState<CustomerInsert>({
    name: '',
    email: '',
    phone: '',
    customer_group: 'particulier',
    zone: '',
    notes: ''
  });
  
  // Addresses state
  const [billingAddresses, setBillingAddresses] = useState<CustomerAddress[]>([]);
  const [shippingAddresses, setShippingAddresses] = useState<CustomerAddress[]>([]);
  
  // New address form state
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressType, setNewAddressType] = useState<'billing' | 'shipping'>('billing');
  const [newAddress, setNewAddress] = useState({
    line1: '',
    line2: '',
    zip: '',
    city: '',
    country: 'France',
    is_default: false
  });
  
  // Load customer data if editing
  useEffect(() => {
    if (customerId) {
      const loadCustomer = async () => {
        const customer = await getCustomerById(customerId);
        if (customer) {
          // Set customer data
          setFormData({
            name: customer.name,
            email: customer.email || '',
            phone: customer.phone || '',
            customer_group: customer.customer_group,
            zone: customer.zone || '',
            notes: customer.notes || ''
          });
          
          // Set addresses
          if (customer.addresses) {
            setBillingAddresses(customer.addresses.filter(addr => addr.address_type === 'billing'));
            setShippingAddresses(customer.addresses.filter(addr => addr.address_type === 'shipping'));
          }
        }
      };
      
      loadCustomer();
    }
  }, [customerId, getCustomerById]);
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle new address input changes
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAddress(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNewAddress(prev => ({ ...prev, [name]: checked }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let customerId: string;
      
      if (customerId) {
        // Update existing customer
        const updatedCustomer = await updateCustomer(customerId, formData);
        if (!updatedCustomer) throw new Error('Failed to update customer');
        customerId = updatedCustomer.id;
      } else {
        // Create new customer
        const newCustomer = await addCustomer(formData);
        if (!newCustomer) throw new Error('Failed to create customer');
        customerId = newCustomer.id;
      }
      
      if (onSaved) {
        onSaved(customerId);
      }
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };
  
  // Handle adding a new address
  const handleAddAddress = async () => {
    if (!customerId) {
      alert('Veuillez d\'abord enregistrer le client');
      return;
    }
    
    if (!newAddress.line1 || !newAddress.zip || !newAddress.city) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      const addressData = {
        customer_id: customerId,
        address_type: newAddressType,
        line1: newAddress.line1,
        line2: newAddress.line2,
        zip: newAddress.zip,
        city: newAddress.city,
        country: newAddress.country,
        is_default: newAddress.is_default
      };
      
      const newAddr = await addAddress(addressData);
      
      if (newAddr) {
        // Update the appropriate address list
        if (newAddressType === 'billing') {
          setBillingAddresses(prev => [...prev, newAddr]);
        } else {
          setShippingAddresses(prev => [...prev, newAddr]);
        }
        
        // Reset form
        setNewAddress({
          line1: '',
          line2: '',
          zip: '',
          city: '',
          country: 'France',
          is_default: false
        });
        
        setShowNewAddressForm(false);
      }
    } catch (err) {
      console.error('Error adding address:', err);
    }
  };
  
  // Handle deleting an address
  const handleDeleteAddress = async (id: string, type: 'billing' | 'shipping') => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette adresse ?')) {
      try {
        await deleteAddress(id);
        
        // Update the appropriate address list
        if (type === 'billing') {
          setBillingAddresses(prev => prev.filter(addr => addr.id !== id));
        } else {
          setShippingAddresses(prev => prev.filter(addr => addr.id !== id));
        }
      } catch (err) {
        console.error('Error deleting address:', err);
      }
    }
  };
  
  // Handle setting an address as default
  const handleSetDefaultAddress = async (id: string, type: 'billing' | 'shipping') => {
    if (!customerId) return;
    
    try {
      await setDefaultAddress(customerId, id, type);
      
      // Update the appropriate address list
      if (type === 'billing') {
        setBillingAddresses(prev => 
          prev.map(addr => ({
            ...addr,
            is_default: addr.id === id
          }))
        );
      } else {
        setShippingAddresses(prev => 
          prev.map(addr => ({
            ...addr,
            is_default: addr.id === id
          }))
        );
      }
    } catch (err) {
      console.error('Error setting default address:', err);
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {customerId ? 'Modifier le client' : 'Nouveau client'}
        </h1>
        <div>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            <Save size={18} />
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <User size={20} className="mr-2" />
            Informations du client
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de client <span className="text-red-500">*</span>
              </label>
              <select
                name="customer_group"
                value={formData.customer_group}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="particulier">Particulier</option>
                <option value="pro">Professionnel</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zone géographique
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  placeholder="Région, ville, secteur..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Informations complémentaires..."
              />
            </div>
          </div>
        </div>
        
        {/* Only show addresses section if customer is saved (has an ID) */}
        {customerId && (
          <>
            {/* Billing Addresses */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Building size={20} className="mr-2" />
                  Adresses de facturation
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewAddressType('billing');
                    setShowNewAddressForm(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>
              
              {billingAddresses.length > 0 ? (
                <div className="space-y-4">
                  {billingAddresses.map(address => (
                    <div key={address.id} className={`p-4 border rounded-md ${address.is_default ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <div className="flex justify-between">
                        <div>
                          <p>{address.line1}</p>
                          {address.line2 && <p>{address.line2}</p>}
                          <p>{address.zip} {address.city}</p>
                          <p>{address.country}</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          {!address.is_default && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAddress(address.id, 'billing')}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Définir par défaut
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(address.id, 'billing')}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {address.is_default && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                            Adresse par défaut
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  Aucune adresse de facturation
                </div>
              )}
            </div>
            
            {/* Shipping Addresses */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Home size={20} className="mr-2" />
                  Adresses de livraison
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewAddressType('shipping');
                    setShowNewAddressForm(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>
              
              {shippingAddresses.length > 0 ? (
                <div className="space-y-4">
                  {shippingAddresses.map(address => (
                    <div key={address.id} className={`p-4 border rounded-md ${address.is_default ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex justify-between">
                        <div>
                          <p>{address.line1}</p>
                          {address.line2 && <p>{address.line2}</p>}
                          <p>{address.zip} {address.city}</p>
                          <p>{address.country}</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          {!address.is_default && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAddress(address.id, 'shipping')}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              Définir par défaut
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(address.id, 'shipping')}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {address.is_default && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            Adresse par défaut
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  Aucune adresse de livraison
                </div>
              )}
            </div>
          </>
        )}
      </form>
      
      {/* New Address Modal */}
      {showNewAddressForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {newAddressType === 'billing' ? 'Nouvelle adresse de facturation' : 'Nouvelle adresse de livraison'}
              </h2>
              <button
                type="button"
                onClick={() => setShowNewAddressForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAddAddress(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="line1"
                  value={newAddress.line1}
                  onChange={handleAddressChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complément d'adresse
                </label>
                <input
                  type="text"
                  name="line2"
                  value={newAddress.line2}
                  onChange={handleAddressChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code postal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={newAddress.zip}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ville <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={newAddress.city}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pays
                </label>
                <input
                  type="text"
                  name="country"
                  value={newAddress.country}
                  onChange={handleAddressChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_default"
                  name="is_default"
                  checked={newAddress.is_default}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                  Définir comme adresse par défaut
                </label>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewAddressForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};