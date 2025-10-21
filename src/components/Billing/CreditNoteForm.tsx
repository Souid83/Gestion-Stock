import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  User, 
  Calendar, 
  FileText, 
  Search,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { 
  CreditNoteInsert, 
  CreditNoteItemInsert, 
  CreditNoteStatus,
  InvoiceWithDetails
} from '../../types/billing';

interface CreditNoteFormProps {
  creditNoteId?: string;
  invoiceId?: string; // Optional: pre-select an invoice
  onSaved?: (id: string) => void;
}

export const CreditNoteForm: React.FC<CreditNoteFormProps> = ({ creditNoteId, invoiceId, onSaved }) => {
  // Form state
  const [formData, setFormData] = useState<Partial<CreditNoteInsert>>({
    invoice_id: invoiceId || '',
    status: 'draft',
    date_issued: new Date().toISOString().split('T')[0],
    reason: '',
    total_amount: 0
  });
  
  // Items state
  const [items, setItems] = useState<Partial<CreditNoteItemInsert>[]>([]);
  
  // UI state
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceWithDetails[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState<Partial<CreditNoteItemInsert>>({
    invoice_item_id: '',
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 20,
    total_price: 0
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load data on mount
  useEffect(() => {
    console.log('CreditNoteForm component mounted');
    fetchInvoices();
    
    if (creditNoteId) {
      console.log(`Loading credit note with ID: ${creditNoteId}`);
      fetchCreditNote(creditNoteId);
    } else if (invoiceId) {
      console.log(`Pre-selecting invoice with ID: ${invoiceId}`);
      fetchInvoice(invoiceId);
    }
  }, [creditNoteId, invoiceId]);
  
  // Fetch credit note data
  const fetchCreditNote = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching credit note with ID: ${id}`);
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          invoice:invoices(*),
          items:credit_note_items(*, product:products(id, name, sku))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      console.log('Credit note data fetched:', data);
      
      // Set form data
      setFormData({
        invoice_id: data.invoice_id,
        status: data.status,
        date_issued: data.date_issued,
        reason: data.reason,
        total_amount: data.total_amount
      });
      
      // Set selected invoice
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
        fetchInvoiceItems(data.invoice_id);
      }
      
      // Set items
      if (data.items) {
        setItems(data.items.map(item => ({
          id: item.id,
          invoice_item_id: item.invoice_item_id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total_price: item.total_price
        })));
      }
    } catch (error) {
      console.error(`Error fetching credit note with ID ${id}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching credit note with ID ${id}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      console.log('Fetching invoices...');
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group)
        `)
        .in('status', ['sent', 'paid', 'partial'])
        .order('date_issued', { ascending: false });

      if (error) throw error;
      
      const invoicesData = data as InvoiceWithDetails[] || [];
      console.log(`Fetched ${invoicesData.length} invoices`);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching invoices');
    }
  };
  
  // Fetch invoice
  const fetchInvoice = async (id: string) => {
    try {
      console.log(`Fetching invoice with ID: ${id}`);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      console.log('Invoice data fetched:', data);
      setSelectedInvoice(data);
      setFormData(prev => ({ ...prev, invoice_id: id }));
      fetchInvoiceItems(id);
    } catch (error) {
      console.error(`Error fetching invoice with ID ${id}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching invoice with ID ${id}`);
    }
  };
  
  // Fetch invoice items
  const fetchInvoiceItems = async (invoiceId: string) => {
    try {
      console.log(`Fetching items for invoice with ID: ${invoiceId}`);
      const { data, error } = await supabase
        .from('invoice_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('invoice_id', invoiceId);

      if (error) throw error;
      
      console.log(`Fetched ${data?.length || 0} invoice items`);
      setInvoiceItems(data || []);
    } catch (error) {
      console.error(`Error fetching items for invoice with ID ${invoiceId}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching invoice items`);
    }
  };
  
  // Filter invoices when search term changes
  useEffect(() => {
    if (invoiceSearchTerm.trim() === '') {
      setFilteredInvoices(invoices);
    } else {
      const lowercasedSearch = invoiceSearchTerm.toLowerCase();
      setFilteredInvoices(
        invoices.filter(invoice => 
          invoice.invoice_number.toLowerCase().includes(lowercasedSearch) ||
          invoice.customer?.name.toLowerCase().includes(lowercasedSearch)
        ).slice(0, 10) // Limit to 10 results
      );
    }
  }, [invoiceSearchTerm, invoices]);
  
  // Calculate total amount when items change
  useEffect(() => {
    const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    setFormData(prev => ({ ...prev, total_amount: totalAmount }));
  }, [items]);
  
  // Handle invoice selection
  const handleInvoiceSelect = (invoice: InvoiceWithDetails) => {
    console.log('Invoice selected:', invoice);
    setSelectedInvoice(invoice);
    setFormData(prev => ({ ...prev, invoice_id: invoice.id }));
    setInvoiceSearchTerm('');
    setShowInvoiceDropdown(false);
    fetchInvoiceItems(invoice.id);
  };
  
  // Handle invoice item selection
  const handleInvoiceItemSelect = (item: any) => {
    console.log('Invoice item selected:', item);
    setNewItem({
      invoice_item_id: item.id,
      product_id: item.product_id,
      description: item.description,
      quantity: 1, // Default to 1, can be adjusted
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      total_price: item.unit_price // Will be recalculated when quantity changes
    });
  };
  
  // Handle adding a new item
  const handleAddItem = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      alert('Veuillez remplir tous les champs de l\'article');
      return;
    }
    
    // Check if quantity is valid (not greater than original invoice item)
    if (newItem.invoice_item_id) {
      const originalItem = invoiceItems.find(item => item.id === newItem.invoice_item_id);
      if (originalItem && (newItem.quantity || 0) > originalItem.quantity) {
        alert(`La quantité ne peut pas dépasser la quantité originale (${originalItem.quantity})`);
        return;
      }
    }
    
    const itemToAdd = {
      ...newItem,
      total_price: (newItem.quantity || 0) * (newItem.unit_price || 0)
    };
    
    setItems(prev => [...prev, itemToAdd]);
    setNewItem({
      invoice_item_id: '',
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 20,
      total_price: 0
    });
  };
  
  // Handle updating an item
  const handleUpdateItem = (index: number, field: keyof CreditNoteItemInsert, value: any) => {
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
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form with data:', formData);
    
    if (!formData.invoice_id) {
      alert('Veuillez sélectionner une facture');
      return;
    }
    
    if (!formData.reason) {
      alert('Veuillez indiquer une raison pour l\'avoir');
      return;
    }
    
    if (items.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (creditNoteId) {
        // Update existing credit note
        console.log('Updating credit note with ID:', creditNoteId);
        const { error: updateError } = await supabase
          .from('credit_notes')
          .update({
            invoice_id: formData.invoice_id,
            status: formData.status,
            date_issued: formData.date_issued,
            reason: formData.reason,
            total_amount: formData.total_amount
          })
          .eq('id', creditNoteId);
          
        if (updateError) throw updateError;
        
        // Handle items - this is more complex as we need to add/update/delete
        // First, get existing items
        const { data: existingItems, error: itemsError } = await supabase
          .from('credit_note_items')
          .select('id')
          .eq('credit_note_id', creditNoteId);
          
        if (itemsError) throw itemsError;
        
        // Items to add (those without an id)
        const itemsToAdd = items.filter(item => !item.id);
        if (itemsToAdd.length > 0) {
          const { error: addError } = await supabase
            .from('credit_note_items')
            .insert(itemsToAdd.map(item => ({
              credit_note_id: creditNoteId,
              invoice_item_id: item.invoice_item_id,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price
            })));
            
          if (addError) throw addError;
        }
        
        // Items to update (those with an id)
        for (const item of items.filter(item => item.id)) {
          const { error: updateItemError } = await supabase
            .from('credit_note_items')
            .update({
              invoice_item_id: item.invoice_item_id,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price
            })
            .eq('id', item.id);
            
          if (updateItemError) throw updateItemError;
        }
        
        // Items to delete (those in existingItems but not in items)
        const existingIds = existingItems?.map(item => item.id) || [];
        const currentIds = items.filter(item => item.id).map(item => item.id);
        const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
        
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('credit_note_items')
            .delete()
            .in('id', idsToDelete);
            
          if (deleteError) throw deleteError;
        }
        
        if (onSaved) onSaved(creditNoteId);
      } else {
        // Create new credit note
        console.log('Creating new credit note');
        const { data: creditNoteData, error: creditNoteError } = await supabase
          .from('credit_notes')
          .insert([{
            invoice_id: formData.invoice_id,
            status: formData.status,
            date_issued: formData.date_issued,
            reason: formData.reason,
            total_amount: formData.total_amount
          }])
          .select()
          .single();
          
        if (creditNoteError) throw creditNoteError;
        
        const newCreditNoteId = creditNoteData.id;
        
        // Add items
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('credit_note_items')
            .insert(items.map(item => ({
              credit_note_id: newCreditNoteId,
              invoice_item_id: item.invoice_item_id,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price
            })));
            
          if (itemsError) throw itemsError;
        }
        
        if (onSaved) onSaved(newCreditNoteId);
      }
    } catch (err) {
      console.error('Error saving credit note:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving the credit note');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {creditNoteId ? 'Modifier l\'avoir' : 'Nouvel avoir'}
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

      <form className="space-y-8">
        {/* Credit Note Details Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Informations de l'avoir
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facture <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={invoiceSearchTerm || (selectedInvoice ? `${selectedInvoice.invoice_number} - ${selectedInvoice.customer?.name}` : '')}
                  onChange={(e) => {
                    setInvoiceSearchTerm(e.target.value);
                    setShowInvoiceDropdown(true);
                    if (selectedInvoice && e.target.value !== `${selectedInvoice.invoice_number} - ${selectedInvoice.customer?.name}`) {
                      setSelectedInvoice(null);
                      setFormData(prev => ({ ...prev, invoice_id: '' }));
                      setInvoiceItems([]);
                    }
                  }}
                  placeholder="Rechercher une facture..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  onFocus={() => setShowInvoiceDropdown(true)}
                  disabled={!!creditNoteId} // Disable if editing existing credit note
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
              
              {showInvoiceDropdown && !creditNoteId && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                  <div className="p-2">
                    <input
                      type="text"
                      value={invoiceSearchTerm}
                      onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      placeholder="Filtrer les factures..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ul className="py-1">
                    {filteredInvoices.map(invoice => (
                      <li 
                        key={invoice.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleInvoiceSelect(invoice)}
                      >
                        <div className="font-medium">{invoice.invoice_number}</div>
                        <div className="text-sm text-gray-500">
                          Client: {invoice.customer?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Montant: {formatCurrency(invoice.total_ttc)}
                          <span className="ml-2">
                            Date: {formatDate(invoice.date_issued)}
                          </span>
                        </div>
                      </li>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <li className="px-4 py-2 text-gray-500">
                        Aucune facture trouvée
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {selectedInvoice && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{selectedInvoice.invoice_number}</p>
                      <p className="text-sm text-gray-500">Client: {selectedInvoice.customer?.name}</p>
                      <p className="text-sm text-gray-500">
                        Montant: {formatCurrency(selectedInvoice.total_ttc)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Date: {formatDate(selectedInvoice.date_issued)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Credit Note Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as CreditNoteStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="processed">Traité</option>
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
            
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Motif de l'avoir"
                required
              />
            </div>
          </div>
        </div>
        
        {/* Items Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Articles
          </h2>
          
          {selectedInvoice && (
            <div className="mb-6">
              <h3 className="text-md font-medium mb-3">Articles de la facture</h3>
              
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
                    {invoiceItems.length > 0 ? (
                      invoiceItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.tax_rate}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.total_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              type="button"
                              onClick={() => handleInvoiceItemSelect(item)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Plus size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Aucun article trouvé pour cette facture
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Add New Item */}
          <div className="mb-6 p-4 border border-gray-200 rounded-md">
            <h3 className="text-md font-medium mb-3">Ajouter un article à l'avoir</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix unitaire HT <span className="text-red-500">*</span>
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
          
          {/* Total */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between font-bold">
                  <span>Total de l'avoir:</span>
                  <span>{formatCurrency(formData.total_amount || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};