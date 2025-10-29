import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Calendar, 
  DollarSign, 
  Send, 
  Download, 
  Copy, 
  Printer,
  FileOutput
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CreditNoteStatus, CreditNoteWithDetails } from '../../types/billing';
import { EmailSender } from './EmailSender';

interface CreditNoteDetailProps {
  creditNoteId: string;
  onBack?: () => void;
}

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

export const CreditNoteDetail: React.FC<CreditNoteDetailProps> = ({ creditNoteId, onBack }) => {
  const [creditNote, setCreditNote] = useState<CreditNoteWithDetails | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const creditNoteRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('CreditNoteDetail component mounted, fetching credit note...');
    fetchCreditNote();
  }, [creditNoteId]);
  
  const fetchCreditNote = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching credit note with ID: ${creditNoteId}`);
      
      // Fetch credit note with customer details
      const { data: creditNoteData, error: creditNoteError } = await supabase
        .from('credit_notes')
        .select(`
          *,
          invoice:invoices(id, invoice_number, customer:customers(id, name, email)),
          document_type:billing_document_types(*)
        `)
        .eq('id', creditNoteId)
        .single();
        
      if (creditNoteError) throw creditNoteError;
      
      console.log('Credit note data fetched:', creditNoteData);
      setCreditNote(creditNoteData);
      
      // Fetch credit note items
      const { data: itemsData, error: itemsError } = await supabase
        .from('credit_note_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('credit_note_id', creditNoteId);
        
      if (itemsError) throw itemsError;
      
      console.log('Credit note items fetched:', itemsData);
      setItems(itemsData || []);

      // Set invoice from credit note data
      if (creditNoteData.invoice) {
        console.log('Invoice data loaded:', creditNoteData.invoice);
        setInvoice(creditNoteData.invoice);
      }
    } catch (error) {
      console.error(`Error fetching credit note with ID ${creditNoteId}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching credit note with ID ${creditNoteId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateCreditNoteStatus = async (status: CreditNoteStatus) => {
    if (!creditNote) return;
    
    try {
      const { error } = await supabase
        .from('credit_notes')
        .update({ status })
        .eq('id', creditNoteId);
        
      if (error) throw error;
      
      // Update local state
      setCreditNote({ ...creditNote, status });
    } catch (error) {
      console.error('Error updating credit note status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating credit note status');
    }
  };
  
  const handleSendCreditNote = async () => {
    if (!creditNote) return;
    
    try {
      // If credit note is in draft status, update it to sent
      if (creditNote.status === 'draft') {
        await updateCreditNoteStatus('sent');
      }
      
      // Open email modal
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Error updating credit note status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating credit note status');
    }
  };
  
  const handleMarkAsProcessed = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer cet avoir comme traité ?')) {
      await updateCreditNoteStatus('processed');
    }
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDuplicate = () => {
    // Redirect to credit note creation page with duplicate flag
    window.location.href = `/credit-notes/new?duplicate=${creditNoteId}`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        {error}
      </div>
    );
  }
  
  if (!creditNote) {
    return (
      <div className="text-center py-6 text-gray-500">
        Avoir non trouvé
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold">Avoir {creditNote.credit_note_number}</h1>
        </div>
        <StatusBadge status={creditNote.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendCreditNote}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Send size={18} />
          Envoyer par email
        </button>
        
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          <Printer size={18} />
          Imprimer
        </button>
        
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          <Copy size={18} />
          Dupliquer
        </button>
        
        {creditNote.status === 'sent' && (
          <button
            onClick={handleMarkAsProcessed}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CheckCircle size={18} />
            Marquer comme traité
          </button>
        )}
      </div>
      
      {/* Credit Note Document */}
      <div ref={creditNoteRef} className="bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">AVOIR</h2>
            <p className="text-gray-600">N° {creditNote.credit_note_number}</p>
            {creditNote.document_type && (
              <p className="text-gray-600">Type: <span className="font-medium">{creditNote.document_type.label}</span></p>
            )}
            <p className="text-gray-600">Date: {formatDate(creditNote.date_issued)}</p>
            {invoice && (
              <p className="text-gray-600">
                Facture:{' '}
                <button
                  onClick={() => window.location.href = `/invoices/${invoice.id}`}
                  className="text-blue-600 hover:text-blue-900 underline"
                >
                  {invoice.invoice_number}
                </button>
              </p>
            )}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-lg">Votre Entreprise</h3>
            <p>123 Rue Exemple</p>
            <p>75000 Paris</p>
            <p>France</p>
            <p>contact@example.com</p>
            <p>01 23 45 67 89</p>
          </div>
        </div>
        
        {/* Customer Info */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-800 mb-2">Client</h3>
          <div className="border-t border-gray-200 pt-2">
            <p className="font-medium">{invoice?.customer?.name || 'Client non trouvé'}</p>
            {invoice?.customer?.email && <p>{invoice.customer.email}</p>}
          </div>
        </div>
        
        {/* Reason */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-800 mb-2">Motif</h3>
          <div className="border-t border-gray-200 pt-2">
            <p>{creditNote.reason}</p>
          </div>
        </div>
        
        {/* Items Table */}
        <div className="mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantité
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire HT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.tax_rate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Total */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-2 font-bold text-lg">
              <span>Total de l'avoir:</span>
              <span>{formatCurrency(creditNote.total_amount)}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-8 pt-8 border-t">
          <p>Merci pour votre confiance. Tous les prix sont en euros.</p>
          <p>Conditions générales de vente : Les produits restent la propriété de la société jusqu'au paiement intégral.</p>
        </div>
      </div>
      
      {/* Email Modal */}
      <EmailSender
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        documentType="credit_note"
        documentId={creditNoteId}
        documentNumber={creditNote.credit_note_number}
        customerName={invoice?.customer?.name || ''}
        customerEmail={invoice?.customer?.email || ''}
        documentRef={creditNoteRef}
        additionalData={{
          totalAmount: creditNote.total_amount,
          invoiceNumber: creditNote.invoice_number
        }}
      />
    </div>
  );
};