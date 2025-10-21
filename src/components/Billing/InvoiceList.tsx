import React, { useEffect, useState } from 'react';
import { Eye, Edit, Trash2, Send, FileText, Plus, Search, RefreshCw, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InvoiceStatus, InvoiceWithDetails } from '../../types/billing';

// Status badge component
const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'sent': return 'bg-blue-200 text-blue-800';
      case 'paid': return 'bg-green-200 text-green-800';
      case 'partial': return 'bg-yellow-200 text-yellow-800';
      case 'late': return 'bg-red-200 text-red-800';
      case 'cancelled': return 'bg-gray-200 text-gray-800 line-through';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyée';
      case 'paid': return 'Payée';
      case 'partial': return 'Partiel';
      case 'late': return 'En retard';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
};

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceWithDetails[]>([]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Fetching invoices...');
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email, phone, customer_group)
        `)
        .order('date_issued', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      const invoicesData = data as InvoiceWithDetails[] || [];
      console.log(`Fetched ${invoicesData.length} invoices:`, invoicesData);
      setInvoices(invoicesData);
      setFilteredInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching invoices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('InvoiceList component mounted, fetching invoices...');
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredInvoices(invoices);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      setFilteredInvoices(invoices.filter(invoice => 
        (invoice.invoice_number?.toLowerCase().includes(lowercasedSearch) || false) ||
        (invoice.customer?.name?.toLowerCase().includes(lowercasedSearch) || false) ||
        String(invoice.total_ttc || 0).includes(lowercasedSearch)
      ));
    }
  }, [invoices, searchTerm]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      try {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setInvoices(invoices.filter(invoice => invoice.id !== id));
      } catch (error) {
        console.error('Error deleting invoice:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while deleting the invoice');
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Liste des factures</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <button
            onClick={fetchInvoices}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => window.location.href = '/invoices/new'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Nouvelle facture
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredInvoices && filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payé
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.customer?.name}
                        {invoice.customer?.customer_group === 'pro' && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            Pro
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.date_issued)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.date_due)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(invoice.total_ttc || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(invoice.amount_paid || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={invoice.status as InvoiceStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => window.location.href = `/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="Voir"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => window.location.href = `/invoices/${invoice.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => window.location.href = `/invoices/${invoice.id}/send`}
                              className="text-green-600 hover:text-green-900"
                              title="Envoyer"
                            >
                              <Send size={18} />
                            </button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'late') && (
                            <button
                              onClick={() => window.location.href = `/invoices/${invoice.id}/payment`}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Enregistrer un paiement"
                            >
                              <CreditCard size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune facture trouvée</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? "Aucun résultat pour cette recherche." : "Commencez par créer une nouvelle facture."}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => window.location.href = '/invoices/new'}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Nouvelle facture
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};