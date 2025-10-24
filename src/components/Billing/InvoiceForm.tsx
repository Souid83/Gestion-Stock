import React, { useState, useEffect } from 'react';
import { useCustomerStore } from '../../store/customerStore';
import { useProductStore } from '../../store/productStore';
import { getDocumentTypes } from '../../store/invoiceStore';
import {
  Save,
  Plus,
  Trash2,
  User,
  Calendar,
  FileText,
  MapPin,
  CreditCard,
  Search,
  X,
  Upload
} from 'lucide-react';
import {
  InvoiceInsert,
  InvoiceItemInsert,
  CustomerWithAddresses,
  Address,
  InvoiceStatus,
  DocumentItem,
  DocumentType
} from '../../types/billing';
import { ProductWithStock } from '../../types/supabase';
import { supabase } from '../../lib/supabase';
import { CSVImportArticles } from './CSVImportArticles';
import { ProductSearch } from '../Search/ProductSearch';
import { searchProductsLikeList } from '../../utils/searchProductsLikeList';

interface InvoiceFormProps {
  invoiceId?: string;
  onSaved?: (id: string) => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoiceId, onSaved }) => {
  const { customers, fetchCustomers, addCustomer, addAddress } = useCustomerStore();
  const { products, fetchProducts } = useProductStore();
  
  // Form state
  const [formData, setFormData] = useState<Partial<InvoiceInsert>>({
    customer_id: '',
    status: 'draft',
    date_issued: new Date().toISOString().split('T')[0],
    date_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    note: '',
    billing_address_json: null,
    shipping_address_json: null,
    amount_paid: 0,
    document_type_id: ''
  });

  // Document types
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  
  // Items state
  const [items, setItems] = useState<Partial<InvoiceItemInsert>[]>([]);
  
  // UI state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InvoiceItemInsert>>({
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 20,
    total_price: 0
  });

  // Contexte du document
  const [docCustomerType, setDocCustomerType] = useState<'pro' | 'particulier'>('particulier');
  const [docVatRegime, setDocVatRegime] = useState<'normal' | 'margin'>('normal');
  const [selectedProductForNewItem, setSelectedProductForNewItem] = useState<ProductWithStock | null>(null);
  const [viewAfterSave, setViewAfterSave] = useState<boolean>(false);

  // Quick customer creation
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState<any>({
    name: '',
    email: '',
    phone: '',
    customer_group: 'particulier',
    billing: { line1: '', line2: '', zip: '', city: '', country: 'FR' },
    shippingSameAsBilling: true,
    shipping: { line1: '', line2: '', zip: '', city: '', country: 'FR' }
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Totals
  const [totals, setTotals] = useState({
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0
  });
  
  // Load data on mount
  useEffect(() => {
    console.log('InvoiceForm component mounted');

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        console.log('Loading initial data...');

        // Load customers and products
        await Promise.all([
          fetchCustomers(),
          fetchProducts()
        ]);

        // Load document types
        console.log('Loading document types...');
        const types = await getDocumentTypes();
        console.log(`Loaded ${types.length} document types:`, types);

        if (types.length === 0) {
          console.warn('No document types found. Please create at least one document type.');
          // Ne pas bloquer le formulaire, juste afficher un avertissement
        }

        setDocumentTypes(types);

        // Load invoice if editing
        if (invoiceId) {
          console.log(`Loading invoice with ID: ${invoiceId}`);
          await fetchInvoice(invoiceId);
        }

        console.log('Initial data loaded successfully');
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [invoiceId, fetchCustomers, fetchProducts]);
  
  // Fetch invoice data
  const fetchInvoice = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching invoice with ID: ${id}`);
      const { data, error } = await (supabase as any)
        .from('invoices' as any)
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(*, product:products(id, name, sku, retail_price, pro_price))
        ` as any)
        .eq('id' as any, id as any)
        .single();

      if (error) throw error;
      
      console.log('Invoice data fetched:', data);
      
      // Set form data
      const row: any = data as any;
      setFormData({
        customer_id: row.customer_id,
        status: row.status,
        date_issued: row.date_issued,
        date_due: row.date_due,
        note: row.note || '',
        billing_address_json: row.billing_address_json,
        shipping_address_json: row.shipping_address_json,
        amount_paid: row.amount_paid || 0,
        document_type_id: row.document_type_id || ''
      });
      
      // Find and set the selected customer
      const customer: any = (customers as any[]).find((c: any) => c.id === row.customer_id);
      if (customer) {
        setSelectedCustomer(customer);
      }
      
      // Set items
      const itemsArr: any[] = Array.isArray(row.items) ? (row.items as any[]) : [];
      if (itemsArr.length > 0) {
        setItems(itemsArr.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total_price: item.total_price
        })));
      }
    } catch (error) {
      console.error(`Error fetching invoice with ID ${id}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching invoice with ID ${id}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter products when search term changes (reuse the same engine as product listing)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = productSearchTerm.trim();
      if (q === '') {
        setFilteredProducts([]);
        return;
      }
      try {
        const res = await searchProductsLikeList(q, 20);
        if (!cancelled) {
          setFilteredProducts(res as any);
        }
      } catch {
        if (!cancelled) setFilteredProducts([]);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [productSearchTerm]);

  // Toggle dropdown visibility in sync with search results (filtered by VAT regime)
  useEffect(() => {
    const list = filteredProducts.filter((p: any) => (p as any).vat_type === docVatRegime);
    setShowProductDropdown(productSearchTerm.trim() !== '' && list.length > 0);
  }, [productSearchTerm, filteredProducts, docVatRegime]);
  
  // Calculate totals when items change
  useEffect(() => {
    let totalHT = 0;
    let totalTVA = 0;
    
    items.forEach(item => {
      if (item.total_price) {
        totalHT += item.total_price;
        totalTVA += item.total_price * ((item.tax_rate || 20) / 100);
      }
    });
    
    const totalTTC = totalHT + totalTVA;
    
    setTotals({
      totalHT,
      totalTVA,
      totalTTC
    });
    
    // Update form data with new totals
    setFormData(prev => ({
      ...prev,
      total_ht: totalHT,
      total_ttc: totalTTC,
      tva: totalTVA
    }));
  }, [items]);
  
  // Handle customer selection
  const handleCustomerSelect = (customer: CustomerWithAddresses) => {
    console.log('Customer selected:', customer);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer_id: customer.id }));
    // Type doc pré-rempli depuis le client choisi
    const cg = ((customer as any)?.customer_group || '').toLowerCase() === 'pro' ? 'pro' : 'particulier';
    setDocCustomerType(cg as 'pro' | 'particulier');
    setCustomerSearchTerm('');
    setShowCustomerDropdown(false);
    
    // Set default addresses if available
    if (customer.addresses && customer.addresses.length > 0) {
      const billingAddress = (customer.addresses || []).find((addr: any) => addr.address_type === 'billing' && addr.is_default);
      const shippingAddress = (customer.addresses || []).find((addr: any) => addr.address_type === 'shipping' && addr.is_default);
      
      if (billingAddress) {
        const addressJson: Address = {
          line1: billingAddress.line1,
          line2: billingAddress.line2 || '',
          zip: billingAddress.zip,
          city: billingAddress.city,
          country: billingAddress.country
        };
        setFormData(prev => ({ ...prev, billing_address_json: addressJson }));
      }
      
      if (shippingAddress) {
        const addressJson: Address = {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || '',
          zip: shippingAddress.zip,
          city: shippingAddress.city,
          country: shippingAddress.country
        };
        setFormData(prev => ({ ...prev, shipping_address_json: addressJson }));
      }
    }
  };
  
  // Handle product selection
  const handleProductSelect = (product: ProductWithStock) => {
    console.log('Product selected:', product);

    // Règles prix selon type client et régime TVA du document
    const isMargin = docVatRegime === 'margin';
    const base =
      docCustomerType === 'pro'
        ? Number((product as any).pro_price || 0)
        : Number(product.retail_price || 0);
    const unit = base;
    const taxRate = isMargin ? 0 : 20;

    setSelectedProductForNewItem(product);
    setNewItem({
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: unit,
      tax_rate: taxRate,
      total_price: unit
    });

    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  // Create customer quickly and bind to form
  const createAndSelectCustomer = async (): Promise<boolean> => {
    try {
      const name = (newCustomer?.name || '').trim();
      const email = (newCustomer?.email || '').trim();
      const phone = (newCustomer?.phone || '').trim();
      if (!name) {
        alert('Nom du client requis pour créer un client.');
        return false;
      }
      const baseCustomer: any = {
        name,
        email: email || null,
        phone: phone || null,
        customer_group: (newCustomer?.customer_group || 'particulier').toLowerCase() === 'pro' ? 'pro' : 'particulier'
      };
      const created = await addCustomer(baseCustomer);
      if (!created || !(created as any).id) {
        alert('Création du client échouée.');
        return false;
      }
      const cid = (created as any).id as string;

      // Billing address
      const b = newCustomer?.billing || {};
      if (b.line1 && b.zip && b.city) {
        await addAddress({
          customer_id: cid,
          address_type: 'billing',
          line1: b.line1,
          line2: b.line2 || null,
          zip: b.zip,
          city: b.city,
          country: b.country || 'FR',
          is_default: true
        } as any);
      }

      // Shipping address (same as billing by default)
      const useBilling = !!newCustomer?.shippingSameAsBilling;
      const s = useBilling ? b : (newCustomer?.shipping || {});
      if (s.line1 && s.zip && s.city) {
        await addAddress({
          customer_id: cid,
          address_type: 'shipping',
          line1: s.line1,
          line2: s.line2 || null,
          zip: s.zip,
          city: s.city,
          country: s.country || 'FR',
          is_default: true
        } as any);
      }

      setFormData(prev => ({ ...prev, customer_id: cid }));
      setSelectedCustomer({
        id: cid,
        name,
        email,
        phone,
        customer_group: baseCustomer.customer_group,
        addresses: []
      } as any);
      setShowNewCustomerForm(false);
      return true;
    } catch (e) {
      console.error('createAndSelectCustomer failed:', e);
      alert('Création du client échouée (voir console).');
      return false;
    }
  };
  
  // Handle adding a new item
  const handleAddItem = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      alert('Veuillez remplir tous les champs de l\'article');
      return;
    }
    
    const itemToAdd = {
      ...newItem,
      total_price: (newItem.quantity || 0) * (newItem.unit_price || 0)
    };
    
    setItems(prev => [...prev, itemToAdd]);
    setNewItem({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 20,
      total_price: 0
    });
    setProductSearchTerm('');
  };
  
  // Handle updating an item
  const handleUpdateItem = (index: number, field: keyof InvoiceItemInsert, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate total price if quantity or unit price changes
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? value : updated[index].quantity;
        const unitPrice = field === 'unit_price' ? value : updated[index].unit_price;
        updated[index].total_price = quantity * unitPrice;
      }
      
      return updated;
    });
  };
  
  // Handle removing an item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // Handle CSV import
  const handleImportedItems = (importedItems: DocumentItem[]) => {
    console.log('Imported items:', importedItems);
    // Add imported items to the current items list
    setItems(prev => [
      ...prev,
      ...importedItems.map(item => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total_price: item.total_price
      }))
    ]);
  };
  
  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    console.log('Submitting form with data:', formData);
    const openAfter = viewAfterSave;
    if (viewAfterSave) setViewAfterSave(false);

    if (!formData.customer_id) {
      // Try to create a customer on the fly if quick form has a name
      if ((newCustomer?.name || '').trim().length > 0) {
        const ok = await createAndSelectCustomer();
        if (!ok) return;
      } else {
        alert('Veuillez sélectionner un client ou créer un client.');
        return;
      }
    }

    if (!formData.document_type_id) {
      alert('Veuillez sélectionner un type de document');
      return;
    }

    if (items.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (invoiceId) {
        // Update existing invoice
        console.log('Updating invoice with ID:', invoiceId);
        const { error: updateError } = await (supabase as any)
          .from('invoices' as any)
          .update({
            customer_id: (formData as any).customer_id,
            status: (formData as any).status,
            date_issued: (formData as any).date_issued,
            date_due: (formData as any).date_due,
            note: (formData as any).note,
            billing_address_json: (formData as any).billing_address_json,
            shipping_address_json: (formData as any).shipping_address_json,
            total_ht: totals.totalHT,
            total_ttc: totals.totalTTC,
            tva: totals.totalTVA,
            document_type_id: (formData as any).document_type_id
          } as any)
          .eq('id' as any, invoiceId as any);

        if (updateError) throw updateError;

        console.log('Invoice updated successfully');
        
        // Handle items - this is more complex as we need to add/update/delete
        // First, get existing items
        const { data: existingItems, error: itemsError } = await (supabase as any)
          .from('invoice_items' as any)
          .select('id' as any)
          .eq('invoice_id' as any, invoiceId as any);
          
        if (itemsError) throw itemsError;
        
        // Items to add (those without an id)
        const itemsToAdd = items.filter(item => !item.id);
        if (itemsToAdd.length > 0) {
          const { error: addError } = await (supabase as any)
            .from('invoice_items' as any)
            .insert(itemsToAdd.map((item: any) => ({
              invoice_id: invoiceId,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price
            })) as any);
            
          if (addError) throw addError;
        }
        
        // Items to update (those with an id)
        for (const item of items.filter(item => item.id)) {
          const { error: updateItemError } = await (supabase as any)
            .from('invoice_items' as any)
            .update({
              product_id: (item as any).product_id,
              description: (item as any).description,
              quantity: (item as any).quantity,
              unit_price: (item as any).unit_price,
              tax_rate: (item as any).tax_rate,
              total_price: (item as any).total_price
            } as any)
            .eq('id' as any, (item as any).id as any);
            
          if (updateItemError) throw updateItemError;
        }
        
        // Items to delete (those in existingItems but not in items)
        const existingIds = ((existingItems as any[]) || []).map((item: any) => item.id) || [];
        const currentIds = (items as any[]).filter((item: any) => item.id).map((item: any) => item.id);
        const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
        
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await (supabase as any)
            .from('invoice_items' as any)
            .delete()
            .in('id' as any, idsToDelete as any);
            
          if (deleteError) throw deleteError;
        }

        console.log('Invoice updated successfully');

        // Post-save navigation
        if (openAfter) {
          try {
            sessionStorage.setItem('viewInvoiceId', invoiceId);
          } catch {}
          if ((window as any).__setCurrentPage) {
            (window as any).__setCurrentPage('invoice-detail');
          }
        } else if (onSaved) {
          onSaved(invoiceId);
        } else {
          console.log('Redirecting to invoice list');
          if ((window as any).__setCurrentPage) {
            (window as any).__setCurrentPage('invoices-list');
          }
        }
      } else {
        // Create new invoice
        console.log('Creating new invoice');
        const { data: invoiceData, error: invoiceError } = await (supabase as any)
          .from('invoices' as any)
          .insert([{
            customer_id: (formData as any).customer_id,
            status: (formData as any).status,
            date_issued: (formData as any).date_issued,
            date_due: (formData as any).date_due,
            note: (formData as any).note,
            billing_address_json: (formData as any).billing_address_json,
            shipping_address_json: (formData as any).shipping_address_json,
            total_ht: totals.totalHT,
            total_ttc: totals.totalTTC,
            tva: totals.totalTVA,
            amount_paid: 0,
            document_type_id: (formData as any).document_type_id
          }] as any)
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        const newInvoiceId = invoiceData.id;
        console.log('Invoice created successfully with ID:', newInvoiceId);
        
        // Add items
        if (items.length > 0) {
          const { error: itemsError } = await (supabase as any)
            .from('invoice_items' as any)
            .insert(items.map((item: any) => ({
              invoice_id: newInvoiceId,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price
            })) as any);
            
          if (itemsError) throw itemsError;
        }

        console.log('Invoice and items saved successfully');

        // Post-save navigation
        if (openAfter) {
          try {
            sessionStorage.setItem('viewInvoiceId', newInvoiceId);
          } catch {}
          if ((window as any).__setCurrentPage) {
            (window as any).__setCurrentPage('invoice-detail');
          }
        } else if (onSaved) {
          onSaved(newInvoiceId);
        } else {
          console.log('Redirecting to invoice list');
          if ((window as any).__setCurrentPage) {
            (window as any).__setCurrentPage('invoices-list');
          }
        }
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'enregistrement de la facture');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  // Show loading state
  if (isLoading && !formData.customer_id) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du formulaire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {invoiceId ? 'Modifier la facture' : 'Nouvelle facture'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              console.log('Retour à la liste des factures');
              if ((window as any).__setCurrentPage) {
                (window as any).__setCurrentPage('invoices-list');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            <Save size={18} />
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => { setViewAfterSave(true); handleSubmit(); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            disabled={isLoading}
            title="Enregistrer puis ouvrir la visualisation"
          >
            <Save size={18} />
            {isLoading ? 'Ouverture…' : 'Enregistrer et visualiser'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="absolute top-2 right-2 text-red-700 hover:text-red-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {documentTypes.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <p className="font-medium">Attention: Aucun type de document disponible</p>
          <p className="text-sm mt-1">
            Vous devez créer au moins un type de document avant de pouvoir créer une facture.
            <button
              type="button"
              onClick={() => {
                console.log('Navigation vers la page des types de documents');
                if ((window as any).__setCurrentPage) {
                  (window as any).__setCurrentPage('document-types');
                }
              }}
              className="ml-2 underline font-medium hover:text-yellow-900"
            >
              Gérer les types de documents
            </button>
          </p>
        </div>
      )}

      <form className="space-y-8">
        {/* Customer and Invoice Details Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <User size={20} className="mr-2" />
            Informations client et facture
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearchTerm || (selectedCustomer ? selectedCustomer.name : '')}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setShowCustomerDropdown(true);
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                      setFormData(prev => ({ ...prev, customer_id: '' }));
                    }
                  }}
                  placeholder="Rechercher un client..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
              
              {showCustomerDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                  <div className="p-2">
                    <input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      placeholder="Filtrer les clients..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ul className="py-1">
                    {(customers as any[])
                      .filter((customer: any) => 
                        (customer?.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        (customer?.email && (customer.email as string).toLowerCase().includes(customerSearchTerm.toLowerCase()))
                      )
                      .map((customer: any) => (
                        <li 
                          key={customer.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.email && <div className="text-sm text-gray-500">{customer.email}</div>}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            customer.customer_group === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {customer.customer_group === 'pro' ? 'Pro' : 'Particulier'}
                          </span>
                        </li>
                      ))}
                    {(customers as any[]).filter((customer: any) => 
                      (customer?.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                      (customer?.email && (customer.email as string).toLowerCase().includes(customerSearchTerm.toLowerCase()))
                    ).length === 0 && (
                      <li className="px-4 py-2 text-gray-500">
                        Aucun client trouvé
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {selectedCustomer && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      {selectedCustomer.email && <p className="text-sm text-gray-500">{selectedCustomer.email}</p>}
                      {selectedCustomer.phone && <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>}
                    </div>
                    <span className={`h-fit px-2 py-1 rounded-full text-xs ${
                      selectedCustomer.customer_group === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedCustomer.customer_group === 'pro' ? 'Pro' : 'Particulier'}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick create customer */}
              {!selectedCustomer && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerForm(v => !v)}
                    className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    {showNewCustomerForm ? 'Masquer le formulaire client' : 'Créer un client'}
                  </button>

                  {showNewCustomerForm && (
                    <div className="mt-3 p-3 border rounded-md bg-gray-50 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Nom complet</label>
                          <input
                            type="text"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="NOM Prénom / Raison sociale"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Groupe</label>
                          <select
                            value={newCustomer.customer_group}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, customer_group: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="particulier">Particulier</option>
                            <option value="pro">Pro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={newCustomer.email}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, email: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="client@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Téléphone</label>
                          <input
                            type="tel"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, phone: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="+33 ..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse facturation</label>
                          <input className="w-full px-3 py-2 border rounded-md mb-2" placeholder="Ligne 1"
                            value={newCustomer.billing.line1}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, billing: { ...p.billing, line1: e.target.value } }))} />
                          <input className="w-full px-3 py-2 border rounded-md mb-2" placeholder="Ligne 2"
                            value={newCustomer.billing.line2}
                            onChange={(e) => setNewCustomer((p: any) => ({ ...p, billing: { ...p.billing, line2: e.target.value } }))} />
                          <div className="grid grid-cols-3 gap-2">
                            <input className="px-3 py-2 border rounded-md" placeholder="Code postal"
                              value={newCustomer.billing.zip}
                              onChange={(e) => setNewCustomer((p: any) => ({ ...p, billing: { ...p.billing, zip: e.target.value } }))} />
                            <input className="px-3 py-2 border rounded-md" placeholder="Ville"
                              value={newCustomer.billing.city}
                              onChange={(e) => setNewCustomer((p: any) => ({ ...p, billing: { ...p.billing, city: e.target.value } }))} />
                            <input className="px-3 py-2 border rounded-md" placeholder="Pays"
                              value={newCustomer.billing.country}
                              onChange={(e) => setNewCustomer((p: any) => ({ ...p, billing: { ...p.billing, country: e.target.value } }))} />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse livraison</label>
                          <label className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={newCustomer.shippingSameAsBilling}
                              onChange={(e) => setNewCustomer((p: any) => ({ ...p, shippingSameAsBilling: e.target.checked }))} />
                            <span className="text-sm text-gray-700">Identique à la facturation</span>
                          </label>
                          {!newCustomer.shippingSameAsBilling && (
                            <>
                              <input className="w-full px-3 py-2 border rounded-md mb-2" placeholder="Ligne 1"
                                value={newCustomer.shipping.line1}
                                onChange={(e) => setNewCustomer((p: any) => ({ ...p, shipping: { ...p.shipping, line1: e.target.value } }))} />
                              <input className="w-full px-3 py-2 border rounded-md mb-2" placeholder="Ligne 2"
                                value={newCustomer.shipping.line2}
                                onChange={(e) => setNewCustomer((p: any) => ({ ...p, shipping: { ...p.shipping, line2: e.target.value } }))} />
                              <div className="grid grid-cols-3 gap-2">
                                <input className="px-3 py-2 border rounded-md" placeholder="Code postal"
                                  value={newCustomer.shipping.zip}
                                  onChange={(e) => setNewCustomer((p: any) => ({ ...p, shipping: { ...p.shipping, zip: e.target.value } }))} />
                                <input className="px-3 py-2 border rounded-md" placeholder="Ville"
                                  value={newCustomer.shipping.city}
                                  onChange={(e) => setNewCustomer((p: any) => ({ ...p, shipping: { ...p.shipping, city: e.target.value } }))} />
                                <input className="px-3 py-2 border rounded-md" placeholder="Pays"
                                  value={newCustomer.shipping.country}
                                  onChange={(e) => setNewCustomer((p: any) => ({ ...p, shipping: { ...p.shipping, country: e.target.value } }))} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={createAndSelectCustomer}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Créer et associer le client
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Invoice Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="partial">Partiellement payée</option>
                <option value="late">En retard</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>

            {/* Type de client du document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de client du document
              </label>
              <select
                value={docCustomerType}
                onChange={(e) => setDocCustomerType((e.target.value as 'pro' | 'particulier'))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pro">Professionnel</option>
                <option value="particulier">Particulier</option>
              </select>
            </div>

            {/* Régime TVA du document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Régime TVA du document
              </label>
              <select
                value={docVatRegime}
                onChange={(e) => setDocVatRegime((e.target.value as 'normal' | 'margin'))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                title="Une facture ne peut pas mélanger les régimes de TVA"
              >
                <option value="normal">Normale</option>
                <option value="margin">Marge</option>
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de document <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.document_type_id || ''}
                onChange={(e) => {
                  console.log('Document type selected:', e.target.value);
                  setFormData(prev => ({ ...prev, document_type_id: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">-- Sélectionner un type --</option>
                {documentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Date Issued */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'émission
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.date_issued}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_issued: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            {/* Date Due */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'échéance
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.date_due}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_due: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
          </div>
          
          {/* Addresses Section */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Billing Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse de facturation
              </label>
              {selectedCustomer && selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                <select
                  onChange={(e) => {
                    const addressId = e.target.value;
                    if (addressId) {
                      const address = (selectedCustomer?.addresses as any[])?.find((a: any) => a.id === addressId);
                      if (address) {
                        const addressJson: Address = {
                          line1: address.line1,
                          line2: address.line2 || '',
                          zip: address.zip,
                          city: address.city,
                          country: address.country
                        };
                        setFormData(prev => ({ ...prev, billing_address_json: addressJson }));
                      }
                    } else {
                      setFormData(prev => ({ ...prev, billing_address_json: null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={(selectedCustomer.addresses as any[]).find((a: any) => a.address_type === 'billing' && a.is_default)?.id || ''}
                >
                  <option value="">Sélectionner une adresse</option>
                  {(selectedCustomer.addresses as any[])
                    .filter((address: any) => address.address_type === 'billing')
                    .map((address: any) => (
                      <option key={address.id} value={address.id}>
                        {address.line1}, {address.zip} {address.city}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Aucune adresse de facturation disponible
                </div>
              )}
              
              {formData.billing_address_json && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p>{formData.billing_address_json.line1}</p>
                  {formData.billing_address_json.line2 && <p>{formData.billing_address_json.line2}</p>}
                  <p>{formData.billing_address_json.zip} {formData.billing_address_json.city}</p>
                  <p>{formData.billing_address_json.country}</p>
                </div>
              )}
            </div>
            
            {/* Shipping Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse de livraison
              </label>
              {selectedCustomer && selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                <select
                  onChange={(e) => {
                    const addressId = e.target.value;
                    if (addressId) {
                      const address = (selectedCustomer?.addresses as any[])?.find((a: any) => a.id === addressId);
                      if (address) {
                        const addressJson: Address = {
                          line1: address.line1,
                          line2: address.line2 || '',
                          zip: address.zip,
                          city: address.city,
                          country: address.country
                        };
                        setFormData(prev => ({ ...prev, shipping_address_json: addressJson }));
                      }
                    } else {
                      setFormData(prev => ({ ...prev, shipping_address_json: null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={(selectedCustomer.addresses as any[]).find((a: any) => a.address_type === 'shipping' && a.is_default)?.id || ''}
                >
                  <option value="">Sélectionner une adresse</option>
                  {(selectedCustomer.addresses as any[])
                    .filter((address: any) => address.address_type === 'shipping')
                    .map((address: any) => (
                      <option key={address.id} value={address.id}>
                        {address.line1}, {address.zip} {address.city}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Aucune adresse de livraison disponible
                </div>
              )}
              
              {formData.shipping_address_json && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p>{formData.shipping_address_json.line1}</p>
                  {formData.shipping_address_json.line2 && <p>{formData.shipping_address_json.line2}</p>}
                  <p>{formData.shipping_address_json.zip} {formData.shipping_address_json.city}</p>
                  <p>{formData.shipping_address_json.country}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Note */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notes ou informations supplémentaires..."
            />
          </div>
        </div>
        
        {/* Items Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText size={20} className="mr-2" />
              Articles
            </h2>
            
            {/* CSV Import Button */}
            <CSVImportArticles 
              onImportComplete={handleImportedItems}
              documentType="invoice"
            />
          </div>
          
          {/* Add New Item */}
          <div className="mb-6 p-4 border border-gray-200 rounded-md">
            <h3 className="text-md font-medium mb-3">Ajouter un article</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Product Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit
                </label>
                <div className="relative">
                  <ProductSearch onSearch={setProductSearchTerm} initialQuery={productSearchTerm} />
                </div>
                
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                    <ul className="py-1">
                      {filteredProducts
                        .filter((p: any) => (p as any).vat_type === docVatRegime)
                        .map(product => (
                          <li 
                            key={product.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleProductSelect(product)}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            <div className="text-sm text-gray-500">
                              Prix: {formatCurrency(
                                (docCustomerType === 'pro'
                                  ? (product as any).pro_price || 0
                                  : product.retail_price || 0
                                )
                              )}
                              {product.stock !== undefined && (
                                <span className={`ml-2 ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Stock: {product.stock}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description de l'article"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => {
                    const quantity = parseInt(e.target.value);
                    setNewItem(prev => ({
                      ...prev,
                      quantity,
                      total_price: quantity * (prev.unit_price || 0)
                    }));
                  }}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix unitaire {docVatRegime === 'margin' ? 'TVM' : 'HT'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newItem.unit_price}
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value);
                    setNewItem(prev => ({
                      ...prev,
                      unit_price: unitPrice,
                      total_price: (prev.quantity || 0) * unitPrice
                    }));
                  }}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {/* Marge live */}
                {selectedProductForNewItem && (
                  <div className="mt-1 text-xs text-gray-600">
                    {(() => {
                      const achat = Number((selectedProductForNewItem as any).purchase_price_with_fees || 0);
                      const pu = Number(newItem.unit_price || 0);
                      if (achat > 0 && pu > 0) {
                        const margeEuro = docVatRegime === 'margin' ? (pu - achat) / 1.2 : (pu - achat);
                        const margePct = achat > 0 ? (margeEuro / achat) * 100 : 0;
                        return (
                          <span>
                            Marge: {margePct.toFixed(1)}% ({formatCurrency(margeEuro)})
                          </span>
                        );
                      }
                      return <span>Marge: —</span>;
                    })()}
                  </div>
                )}
              </div>
              
              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux TVA (%)
                </label>
                <select
                  value={newItem.tax_rate}
                  onChange={(e) => setNewItem(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="5.5">5.5%</option>
                  <option value="2.1">2.1%</option>
                  <option value="0">0%</option>
                </select>
              </div>
              
              {/* Total Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total HT
                </label>
                <input
                  type="number"
                  value={newItem.total_price}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Plus size={18} />
                Ajouter l'article
              </button>
            </div>
          </div>
          
          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire HT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TVA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total HT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value))}
                          min="1"
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={item.tax_rate}
                          onChange={(e) => handleUpdateItem(index, 'tax_rate', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="20">20%</option>
                          <option value="10">10%</option>
                          <option value="5.5">5.5%</option>
                          <option value="2.1">2.1%</option>
                          <option value="0">0%</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatCurrency(item.total_price || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucun article ajouté
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total HT:</span>
                  <span className="font-medium">{formatCurrency(totals.totalHT)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">TVA:</span>
                  <span className="font-medium">{formatCurrency(totals.totalTVA)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total TTC:</span>
                  <span>{formatCurrency(totals.totalTTC)}</span>
                </div>
                {invoiceId && formData.amount_paid && formData.amount_paid > 0 && (
                  <>
                    <div className="border-t border-gray-300 my-2 pt-2 flex justify-between">
                      <span className="text-gray-600">Montant payé:</span>
                      <span className="font-medium text-green-600">{formatCurrency(formData.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Reste à payer:</span>
                      <span>{formatCurrency(Math.max(0, totals.totalTTC - (formData.amount_paid || 0)))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
