import React, { useEffect, useState } from 'react';
import { Eye, Edit, Trash2, Send, FileText, Plus, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CreditNoteStatus, CreditNoteWithDetails, DocumentType } from '../../types/billing';
import { getDocumentTypes } from '../../store/quoteStore';

// Status badge component
const StatusBadge: React.FC<{ status: CreditNoteStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'sent': return 'bg-blue-200 text-blue-800';
      case 'processed': return 'bg-green-200 text-green-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyé';
      case 'processed': return 'Traité';
      default: return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
};

export const CreditNoteList: React.FC = () => {
  const [creditNotes, setCreditNotes] = useState<CreditNoteWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCreditNotes, setFilteredCreditNotes] = useState<CreditNoteWithDetails[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');

  const fetchCreditNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Fetching credit notes...');

      let query = supabase
        .from('credit_notes')
        .select(`
          *,
          invoice:invoices(id, invoice_number, document_type:billing_document_types(*)),
          document_type:billing_document_types(*)
        `)
        .order('date_issued', { ascending: false });

      // Apply document type filter if selected
      if (selectedTypeFilter) {
        console.log('Applying document type filter:', selectedTypeFilter);
        query = query.eq('document_type_id', selectedTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      const creditNotesData = data as CreditNoteWithDetails[] || [];
      console.log(`Fetched ${creditNotesData.length} credit notes:`, creditNotesData);
      setCreditNotes(creditNotesData);
      setFilteredCreditNotes(creditNotesData);
    } catch (error) {
      console.error('Error fetching credit notes:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while fetching credit notes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('CreditNoteList component mounted, fetching credit notes...');
    fetchCreditNotes();
  }, [selectedTypeFilter]);

  useEffect(() => {
    const loadDocumentTypes = async () => {
      console.log('Loading document types...');
      const types = await getDocumentTypes();
      console.log(`Loaded ${types.length} document types`);
      setDocumentTypes(types);
    };
    loadDocumentTypes();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCreditNotes(creditNotes);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      setFilteredCreditNotes(creditNotes.filter(creditNote => 
        (creditNote.credit_note_number?.toLowerCase().includes(lowercasedSearch) || false) ||
        (creditNote.invoice_number?.toLowerCase().includes(lowercasedSearch) || false) ||
        (creditNote.customer_name?.toLowerCase().includes(lowercasedSearch) || false) ||
        String(creditNote.total_amount || 0).includes(lowercasedSearch)
      ));
    }
  }, [creditNotes, searchTerm]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet avoir ?')) {
      try {
        const { error } = await supabase
          .from('credit_notes')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setCreditNotes(creditNotes.filter(creditNote => creditNote.id !== id));
      } catch (error) {
        console.error('Error deleting credit note:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while deleting the credit note');
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
        <h1 className="text-2xl font-bold">Liste des avoirs</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Tous les types</option>
            {documentTypes.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
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
            onClick={fetchCreditNotes}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => {
              console.log('Navigating to new credit note page');
              if ((window as any).__setCurrentPage) {
                (window as any).__setCurrentPage('credit-notes-new');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Nouvel avoir
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
          {filteredCreditNotes && filteredCreditNotes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Facture
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
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
                  {filteredCreditNotes.map((creditNote) => (
                    <tr key={creditNote.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {creditNote.credit_note_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-900">
                        <button
                          onClick={() => {
                            if (creditNote.invoice?.id) {
                              console.log('Viewing invoice from credit note:', creditNote.invoice.id);
                              sessionStorage.setItem('viewInvoiceId', creditNote.invoice.id);
                              if ((window as any).__setCurrentPage) {
                                (window as any).__setCurrentPage('invoices-view');
                              }
                            }
                          }}
                          className="underline"
                        >
                          {creditNote.invoice?.invoice_number || '-'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {creditNote.customer_name}
                        {creditNote.customer_group === 'pro' && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            Pro
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {creditNote.document_type?.label || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(creditNote.date_issued)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(creditNote.total_amount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={creditNote.status as CreditNoteStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              console.log('Viewing credit note:', creditNote.id);
                              sessionStorage.setItem('viewCreditNoteId', creditNote.id);
                              if ((window as any).__setCurrentPage) {
                                (window as any).__setCurrentPage('credit-notes-view');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Voir"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              console.log('Editing credit note:', creditNote.id);
                              sessionStorage.setItem('editCreditNoteId', creditNote.id);
                              if ((window as any).__setCurrentPage) {
                                (window as any).__setCurrentPage('credit-notes-edit');
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(creditNote.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                          {creditNote.status === 'draft' && (
                            <button
                              onClick={() => {
                                console.log('Sending credit note:', creditNote.id);
                                sessionStorage.setItem('sendCreditNoteId', creditNote.id);
                                if ((window as any).__setCurrentPage) {
                                  (window as any).__setCurrentPage('credit-notes-send');
                                }
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Envoyer"
                            >
                              <Send size={18} />
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun avoir trouvé</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? "Aucun résultat pour cette recherche." : "Commencez par créer un nouvel avoir."}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    console.log('Navigating to new credit note page (empty state)');
                    if ((window as any).__setCurrentPage) {
                      (window as any).__setCurrentPage('credit-notes-new');
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Nouvel avoir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};