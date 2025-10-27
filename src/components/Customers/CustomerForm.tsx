import React, { useState, useEffect, useRef } from 'react';
import { useCustomerStore } from '../../store/customerStore';
import { Save, Plus, Trash2, User, MapPin, Phone, Mail, Building, Home, X } from 'lucide-react';
import { CustomerInsert, CustomerAddress, CustomerWithAddresses } from '../../types/customers';
import { supabase } from '../../lib/supabase';

interface CustomerFormProps {
  customerId?: string;
  onSaved?: (id: string) => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ customerId, onSaved }) => {

  // Map French postal codes (CP) to regions (incl. DROM)
  const regionFromPostalCode = (cp: string): string => {
    const s = (cp || '').trim();
    if (!s) return '';
    if (s.startsWith('971')) return 'Guadeloupe';
    if (s.startsWith('972')) return 'Martinique';
    if (s.startsWith('973')) return 'Guyane';
    if (s.startsWith('974')) return 'La Réunion';
    if (s.startsWith('976')) return 'Mayotte';
    const dpt = s.startsWith('20') ? '20' : s.substring(0, 2);
    const map: Record<string, string> = {
      '01': 'Auvergne-Rhône-Alpes','03':'Auvergne-Rhône-Alpes','07':'Auvergne-Rhône-Alpes','15':'Auvergne-Rhône-Alpes','26':'Auvergne-Rhône-Alpes','38':'Auvergne-Rhône-Alpes','42':'Auvergne-Rhône-Alpes','43':'Auvergne-Rhône-Alpes','63':'Auvergne-Rhône-Alpes','69':'Auvergne-Rhône-Alpes','73':'Auvergne-Rhône-Alpes','74':'Auvergne-Rhône-Alpes',
      '21':'Bourgogne-Franche-Comté','25':'Bourgogne-Franche-Comté','39':'Bourgogne-Franche-Comté','58':'Bourgogne-Franche-Comté','70':'Bourgogne-Franche-Comté','71':'Bourgogne-Franche-Comté','89':'Bourgogne-Franche-Comté','90':'Bourgogne-Franche-Comté',
      '22':'Bretagne','29':'Bretagne','35':'Bretagne','56':'Bretagne',
      '18':'Centre-Val de Loire','28':'Centre-Val de Loire','36':'Centre-Val de Loire','37':'Centre-Val de Loire','41':'Centre-Val de Loire','45':'Centre-Val de Loire',
      '2A':'Corse','2B':'Corse','20':'Corse',
      '08':'Grand Est','10':'Grand Est','51':'Grand Est','52':'Grand Est','54':'Grand Est','55':'Grand Est','57':'Grand Est','67':'Grand Est','68':'Grand Est','88':'Grand Est',
      '02':'Hauts-de-France','59':'Hauts-de-France','60':'Hauts-de-France','62':'Hauts-de-France','80':'Hauts-de-France',
      '75':'Île-de-France','77':'Île-de-France','78':'Île-de-France','91':'Île-de-France','92':'Île-de-France','93':'Île-de-France','94':'Île-de-France','95':'Île-de-France',
      '14':'Normandie','27':'Normandie','50':'Normandie','61':'Normandie','76':'Normandie',
      '16':'Nouvelle-Aquitaine','17':'Nouvelle-Aquitaine','19':'Nouvelle-Aquitaine','23':'Nouvelle-Aquitaine','24':'Nouvelle-Aquitaine','33':'Nouvelle-Aquitaine','40':'Nouvelle-Aquitaine','47':'Nouvelle-Aquitaine','64':'Nouvelle-Aquitaine','79':'Nouvelle-Aquitaine','86':'Nouvelle-Aquitaine','87':'Nouvelle-Aquitaine',
      '09':'Occitanie','11':'Occitanie','12':'Occitanie','30':'Occitanie','31':'Occitanie','32':'Occitanie','34':'Occitanie','46':'Occitanie','48':'Occitanie','65':'Occitanie','66':'Occitanie','81':'Occitanie','82':'Occitanie',
      '44':'Pays de la Loire','49':'Pays de la Loire','53':'Pays de la Loire','72':'Pays de la Loire','85':'Pays de la Loire',
      '04':"Provence-Alpes-Côte d'Azur",'05':"Provence-Alpes-Côte d'Azur",'06':"Provence-Alpes-Côte d'Azur",'13':"Provence-Alpes-Côte d'Azur",'83':"Provence-Alpes-Côte d'Azur",'84':"Provence-Alpes-Côte d'Azur"
    };
    return map[dpt] || '';
  };
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
    siren: '',
    notes: ''
  });
  
  // Addresses state
  const [billingAddresses, setBillingAddresses] = useState<CustomerAddress[]>([]);
  const [shippingAddresses, setShippingAddresses] = useState<CustomerAddress[]>([]);

  // Extra contacts (multi emails/phones)
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [extraEmailInput, setExtraEmailInput] = useState<string>('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [extraPhoneInput, setExtraPhoneInput] = useState<string>('');
  const [editAddressId, setEditAddressId] = useState<string | null>(null);
  
  // New address form state
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressType, setNewAddressType] = useState<'billing' | 'shipping'>('billing');
  const [newAddress, setNewAddress] = useState({
    line1: '',
    line2: '',
    zip: '',
    city: '',
    country: 'France',
    region: '',
    is_default: false
  });
  
  // Load customer data if editing
  useEffect(() => {
    if (customerId) {
      const loadCustomer = async () => {
        const customer = await getCustomerById(customerId);
        if (customer) {
          // Set customer data
          const c: any = customer;
          setFormData({
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            customer_group: c.customer_group,
            zone: c.zone || '',
            siren: c.siren || '',
            notes: c.notes || ''
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

  // Load existing contacts (emails/phones) if editing
  useEffect(() => {
    const fetchContacts = async () => {
      if (!customerId) return;
      try {
        // Emails
        const { data: emailRows } = await (supabase as any)
          .from('customer_emails' as any)
          .select('*' as any)
          .eq('customer_id' as any, customerId as any);
        if (Array.isArray(emailRows)) {
          const primary = emailRows.find((r: any) => r.is_primary);
          const others = emailRows.filter((r: any) => !r.is_primary).map((r: any) => r.email);
          if (primary && !formData.email) {
            setFormData((prev: any) => ({ ...prev, email: primary.email }));
          }
          setExtraEmails(others);
        }
        // Phones
        const { data: phoneRows } = await (supabase as any)
          .from('customer_phones' as any)
          .select('*' as any)
          .eq('customer_id' as any, customerId as any);
        if (Array.isArray(phoneRows)) {
          const primary = phoneRows.find((r: any) => r.is_primary);
          const others = phoneRows.filter((r: any) => !r.is_primary).map((r: any) => r.phone);
          if (primary && !formData.phone) {
            setFormData((prev: any) => ({ ...prev, phone: primary.phone }));
          }
          setExtraPhones(others);
        }
      } catch (e) {
        console.warn('fetchContacts failed', e);
      }
    };
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };
  
  // Handle new address input changes
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'zip') {
      const r = regionFromPostalCode(value);
      setNewAddress((prev: any) => ({ ...prev, zip: value, region: r }));
      // Auto-fill customer zone with region
      setFormData((prev: any) => ({ ...prev, zone: r || prev.zone }));
    } else {
      setNewAddress((prev: any) => ({ ...prev, [name]: value }));
    }
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
      let savedCustomerId = customerId as string | undefined;
      
      if (savedCustomerId) {
        // Update existing customer
        const updatedCustomer = await updateCustomer(savedCustomerId, formData as any);
        if (!updatedCustomer) throw new Error('Failed to update customer');
        savedCustomerId = updatedCustomer.id;
      } else {
        // Create new customer
        const newCustomer = await addCustomer(formData as any);
        if (!newCustomer) throw new Error('Failed to create customer');
        savedCustomerId = newCustomer.id;
      }
      
      // Upsert contacts into structured tables (primary = main fields)
      if (savedCustomerId) {
        const emailRows = [
          ...(formData.email ? [{ customer_id: savedCustomerId, email: formData.email, is_primary: true }] : []),
          ...extraEmails.map(e => ({ customer_id: savedCustomerId, email: e, is_primary: false }))
        ];
        if (emailRows.length > 0) {
          await (supabase as any)
            .from('customer_emails' as any)
            .upsert(emailRows as any, { onConflict: 'customer_id,email' } as any);
        }

        const phoneRows = [
          ...(formData.phone ? [{ customer_id: savedCustomerId, phone: formData.phone, is_primary: true }] : []),
          ...extraPhones.map(p => ({ customer_id: savedCustomerId, phone: p, is_primary: false }))
        ];
        if (phoneRows.length > 0) {
          await (supabase as any)
            .from('customer_phones' as any)
            .upsert(phoneRows as any, { onConflict: 'customer_id,phone' } as any);
        }
      }

      // Persist local draft addresses created before the first save (if any)
      if (savedCustomerId) {
        const toPlain = (a: any) => ({
          line1: a.line1,
          line2: a.line2 || '',
          zip: a.zip,
          city: a.city,
          country: a.country || 'France',
          region: (a as any).region || regionFromPostalCode(a.zip),
          is_default: !!a.is_default
        });
        const persistList = async (arr: any[], type: 'billing' | 'shipping') => {
          for (const a of arr) {
            try {
              await addAddress({
                customer_id: savedCustomerId,
                address_type: type,
                ...toPlain(a)
              } as any);
            } catch (e) {
              console.warn('persist draft address failed', type, e);
            }
          }
        };
        const localBills = (billingAddresses as any[]).filter(a => !a?.id || String(a.id).startsWith('local-'));
        const localShips = (shippingAddresses as any[]).filter(a => !a?.id || String(a.id).startsWith('local-'));
        if (localBills.length > 0) await persistList(localBills, 'billing');
        if (localShips.length > 0) await persistList(localShips, 'shipping');
      }

      if (onSaved && savedCustomerId) {
        onSaved(savedCustomerId);
      }
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };
  
  // Handle adding a new address
  const handleAddAddress = async () => {
    if (!newAddress.line1 || !newAddress.zip || !newAddress.city) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Common payload
    const payload: any = {
      line1: newAddress.line1,
      line2: newAddress.line2,
      zip: newAddress.zip,
      city: newAddress.city,
      country: newAddress.country,
      region: newAddress.region || regionFromPostalCode(newAddress.zip),
      is_default: newAddress.is_default
    };

    // If the customer is not yet saved, work in "draft" mode locally
    if (!customerId) {
      if (editAddressId) {
        if (newAddressType === 'billing') {
          setBillingAddresses(prev =>
            prev.map(a => (a.id === editAddressId ? ({ ...a, ...payload, address_type: 'billing' } as any) : a))
          );
        } else {
          setShippingAddresses(prev =>
            prev.map(a => (a.id === editAddressId ? ({ ...a, ...payload, address_type: 'shipping' } as any) : a))
          );
        }
      } else {
        const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry = { id: tempId, address_type: newAddressType, ...payload } as any;
        if (newAddressType === 'billing') {
          setBillingAddresses(prev => {
            const arr = newAddress.is_default ? prev.map(x => ({ ...x, is_default: false })) : prev;
            return [...arr, entry];
          });
        } else {
          setShippingAddresses(prev => {
            const arr = newAddress.is_default ? prev.map(x => ({ ...x, is_default: false })) : prev;
            return [...arr, entry];
          });
        }
      }

      // Reset form and close modal
      setNewAddress({
        line1: '',
        line2: '',
        zip: '',
        city: '',
        country: 'France',
        region: '',
        is_default: false
      });
      setEditAddressId(null);
      setShowNewAddressForm(false);
      return;
    }

    // Persisted customer: use RPCs/services
    try {
      if (editAddressId) {
        const updated = await updateAddress(editAddressId, payload);
        if (updated) {
          if (newAddressType === 'billing') {
            setBillingAddresses(prev => prev.map(a => (a.id === editAddressId ? ({ ...a, ...updated } as any) : a)));
          } else {
            setShippingAddresses(prev => prev.map(a => (a.id === editAddressId ? ({ ...a, ...updated } as any) : a)));
          }
        }
      } else {
        const addressData = {
          customer_id: customerId,
          address_type: newAddressType,
          ...payload
        } as any;
        const newAddr = await addAddress(addressData);
        if (newAddr) {
          if (newAddressType === 'billing') {
            setBillingAddresses(prev => [...prev, newAddr]);
          } else {
            setShippingAddresses(prev => [...prev, newAddr]);
          }
        }
      }

      // Reset and close
      setNewAddress({
        line1: '',
        line2: '',
        zip: '',
        city: '',
        country: 'France',
        region: '',
        is_default: false
      });
      setEditAddressId(null);
      setShowNewAddressForm(false);
    } catch (err) {
      console.error('Error saving address:', err);
    }
  };
  
  // Handle deleting an address
  const handleDeleteAddress = async (id: string, type: 'billing' | 'shipping') => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette adresse ?')) return;

    // Draft/local address (before save) or temp id
    if (!customerId || String(id).startsWith('local-')) {
      if (type === 'billing') {
        setBillingAddresses(prev => prev.filter(addr => addr.id !== id));
      } else {
        setShippingAddresses(prev => prev.filter(addr => addr.id !== id));
      }
      return;
    }

    try {
      await deleteAddress(id);
      if (type === 'billing') {
        setBillingAddresses(prev => prev.filter(addr => addr.id !== id));
      } else {
        setShippingAddresses(prev => prev.filter(addr => addr.id !== id));
      }
    } catch (err) {
      console.error('Error deleting address:', err);
    }
  };
  
  // Handle setting an address as default
  const handleSetDefaultAddress = async (id: string, type: 'billing' | 'shipping') => {
    // Local/draft: toggle in memory
    if (!customerId || String(id).startsWith('local-')) {
      if (type === 'billing') {
        setBillingAddresses(prev =>
          prev.map(addr => ({ ...addr, is_default: addr.id === id }))
        );
      } else {
        setShippingAddresses(prev =>
          prev.map(addr => ({ ...addr, is_default: addr.id === id }))
        );
      }
      return;
    }

    try {
      await setDefaultAddress(customerId, id, type);
      if (type === 'billing') {
        setBillingAddresses(prev =>
          prev.map(addr => ({ ...addr, is_default: addr.id === id }))
        );
      } else {
        setShippingAddresses(prev =>
          prev.map(addr => ({ ...addr, is_default: addr.id === id }))
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

            {formData.customer_group === 'pro' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIREN
                </label>
                <input
                  type="text"
                  name="siren"
                  value={(formData as any).siren || ''}
                  onChange={handleChange}
                  placeholder="9 chiffres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            
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
                  placeholder="Email principal"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>

              {/* Emails supplémentaires */}
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Emails supplémentaires
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={extraEmailInput}
                    onChange={(e) => setExtraEmailInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ajouter un email"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = extraEmailInput.trim();
                      if (!v) return;
                      if ([formData.email, ...extraEmails].includes(v)) return;
                      setExtraEmails(prev => [...prev, v]);
                      setExtraEmailInput('');
                    }}
                    className="px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {extraEmails.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {extraEmails.map((em, idx) => (
                      <li key={em} className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span>{em}</span>
                        <button
                          type="button"
                          onClick={() => setExtraEmails(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                  placeholder="Téléphone principal"
                />
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>

              {/* Téléphones supplémentaires */}
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Téléphones supplémentaires
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={extraPhoneInput}
                    onChange={(e) => setExtraPhoneInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ajouter un téléphone"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = extraPhoneInput.trim();
                      if (!v) return;
                      if ([formData.phone, ...extraPhones].includes(v)) return;
                      setExtraPhones(prev => [...prev, v]);
                      setExtraPhoneInput('');
                    }}
                    className="px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {extraPhones.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {extraPhones.map((ph, idx) => (
                      <li key={`${ph}-${idx}`} className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span>{ph}</span>
                        <button
                          type="button"
                          onClick={() => setExtraPhones(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
        
        {/* Always show address sections (support draft addresses before save) */}
        {true && (
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
                          <button
                            type="button"
                            onClick={() => {
                              setNewAddressType('billing');
                              setNewAddress({
                                line1: address.line1,
                                line2: address.line2 || '',
                                zip: address.zip,
                                city: address.city,
                                country: address.country,
                                region: (address as any).region || regionFromPostalCode(address.zip),
                                is_default: !!address.is_default
                              } as any);
                              setEditAddressId(address.id);
                              setShowNewAddressForm(true);
                            }}
                            className="text-gray-700 hover:text-gray-900 text-sm"
                          >
                            Modifier
                          </button>
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
                          <button
                            type="button"
                            onClick={() => {
                              setNewAddressType('shipping');
                              setNewAddress({
                                line1: address.line1,
                                line2: address.line2 || '',
                                zip: address.zip,
                                city: address.city,
                                country: address.country,
                                region: (address as any).region || regionFromPostalCode(address.zip),
                                is_default: !!address.is_default
                              } as any);
                              setEditAddressId(address.id);
                              setShowNewAddressForm(true);
                            }}
                            className="text-gray-700 hover:text-gray-900 text-sm"
                          >
                            Modifier
                          </button>
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
                {editAddressId
                  ? (newAddressType === 'billing' ? 'Modifier adresse de facturation' : 'Modifier adresse de livraison')
                  : (newAddressType === 'billing' ? 'Nouvelle adresse de facturation' : 'Nouvelle adresse de livraison')}
              </h2>
              <button
                type="button"
                onClick={() => { setEditAddressId(null); setShowNewAddressForm(false); }}
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
                  onClick={() => { setEditAddressId(null); setShowNewAddressForm(false); }}
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
