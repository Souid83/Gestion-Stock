import React, { useState, useEffect, useRef } from 'react';
import { useQuoteStore } from '../../store/quoteStore';
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
  CheckCircle,
  XCircle,
  FileOutput
} from 'lucide-react';
import { QuoteStatus } from '../../types/billing';
import { EmailSender } from './EmailSender';

interface QuoteDetailProps {
  quoteId: string;
  onBack?: () => void;
}

// Status badge component
const StatusBadge: React.FC<{ status: QuoteStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'sent': return 'bg-blue-200 text-blue-800';
      case 'accepted': return 'bg-green-200 text-green-800';
      case 'refused': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyé';
      case 'accepted': return 'Accepté';
      case 'refused': return 'Refusé';
      default: return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
};

export const QuoteDetail: React.FC<QuoteDetailProps> = ({ quoteId, onBack }) => {
  const { currentQuote, isLoading, error, getQuoteById, sendQuote, acceptQuote, refuseQuote } = useQuoteStore();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('QuoteDetail component mounted, fetching quote...');
    getQuoteById(quoteId);
  }, [quoteId, getQuoteById]);
  
  const handleSendQuote = async () => {
    if (currentQuote?.status === 'draft') {
      await sendQuote(quoteId);
    }
    setIsEmailModalOpen(true);
  };
  
  const handleAcceptQuote = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer ce devis comme accepté ?')) {
      await acceptQuote(quoteId);
    }
  };
  
  const handleRefuseQuote = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer ce devis comme refusé ?')) {
      await refuseQuote(quoteId);
    }
  };
  
  const handleConvertToOrder = () => {
    // Redirect to order creation page with quote ID
    window.location.href = `/orders/new?fromQuote=${quoteId}`;
  };
  
  const handleConvertToInvoice = () => {
    // Redirect to invoice creation page with quote ID
    window.location.href = `/invoices/new?fromQuote=${quoteId}`;
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDuplicate = () => {
    // Redirect to quote creation page with duplicate flag
    window.location.href = `/quotes/new?duplicate=${quoteId}`;
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
  
  if (!currentQuote) {
    return (
      <div className="text-center py-6 text-gray-500">
        Devis non trouvé
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
          <h1 className="text-2xl font-bold">Devis {currentQuote.quote_number}</h1>
        </div>
        <StatusBadge status={currentQuote.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendQuote}
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
        
        {currentQuote.status === 'sent' && (
          <>
            <button
              onClick={handleAcceptQuote}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <CheckCircle size={18} />
              Accepter
            </button>
            
            <button
              onClick={handleRefuseQuote}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <XCircle size={18} />
              Refuser
            </button>
          </>
        )}
        
        {currentQuote.status === 'accepted' && (
          <>
            <button
              onClick={handleConvertToOrder}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              <FileOutput size={18} />
              Convertir en commande
            </button>
            
            <button
              onClick={handleConvertToInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <FileOutput size={18} />
              Convertir en facture
            </button>
          </>
        )}
      </div>
      
      {/* Quote Document */}
      <div ref={quoteRef} className="bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">DEVIS</h2>
            <p className="text-gray-600">N° {currentQuote.quote_number}</p>
            <p className="text-gray-600">Date: {formatDate(currentQuote.date_issued)}</p>
            <p className="text-gray-600">Validité: {formatDate(currentQuote.date_expiry)}</p>
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
            <p className="font-medium">{currentQuote.customer?.name}</p>
            {currentQuote.customer?.email && <p>{currentQuote.customer.email}</p>}
            {currentQuote.customer?.phone && <p>{currentQuote.customer.phone}</p>}
            
            {/* Billing Address */}
            {currentQuote.billing_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de facturation:</p>
                <p>{currentQuote.billing_address_json.line1}</p>
                {currentQuote.billing_address_json.line2 && <p>{currentQuote.billing_address_json.line2}</p>}
                <p>{currentQuote.billing_address_json.zip} {currentQuote.billing_address_json.city}</p>
                <p>{currentQuote.billing_address_json.country}</p>
              </div>
            )}
            
            {/* Shipping Address */}
            {currentQuote.shipping_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de livraison:</p>
                <p>{currentQuote.shipping_address_json.line1}</p>
                {currentQuote.shipping_address_json.line2 && <p>{currentQuote.shipping_address_json.line2}</p>}
                <p>{currentQuote.shipping_address_json.zip} {currentQuote.shipping_address_json.city}</p>
                <p>{currentQuote.shipping_address_json.country}</p>
              </div>
            )}
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
              {currentQuote.items?.map((item, index) => (
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
        
        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">Total HT:</span>
              <span>{formatCurrency(currentQuote.total_ht)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">TVA:</span>
              <span>{formatCurrency(currentQuote.tva)}</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-lg">
              <span>Total TTC:</span>
              <span>{formatCurrency(currentQuote.total_ttc)}</span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        {currentQuote.note && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
            <div className="border-t border-gray-200 pt-2">
              <p className="whitespace-pre-line">{currentQuote.note}</p>
            </div>
          </div>
        )}
        
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
        documentType="quote"
        documentId={quoteId}
        documentNumber={currentQuote.quote_number}
        customerName={currentQuote.customer?.name || ''}
        customerEmail={currentQuote.customer?.email || ''}
        documentRef={quoteRef}
        additionalData={{
          expiryDate: formatDate(currentQuote.date_expiry),
          totalAmount: currentQuote.total_ttc
        }}
      />
    </div>
  );
};