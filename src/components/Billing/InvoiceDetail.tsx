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
  CreditCard,
  FileOutput
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InvoiceStatus, InvoiceWithDetails, Payment } from '../../types/billing';
import { EmailSender } from './EmailSender';

interface InvoiceDetailProps {
  invoiceId: string;
  onBack?: () => void;
}

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

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoiceId, onBack }) => {
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('InvoiceDetail component mounted, fetching invoice...');
    fetchInvoice();
  }, [invoiceId]);
  
  const fetchInvoice = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching invoice with ID: ${invoiceId}`);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(*, product:products(id, name, sku, retail_price, pro_price)),
          order:orders(id, order_number),
          quote:quotes(id, quote_number),
          document_type:billing_document_types(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      
      console.log('Invoice data fetched:', data);
      setInvoice(data);
      
      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });
        
      if (paymentsError) throw paymentsError;
      
      console.log('Payments data fetched:', paymentsData);
      setPayments(paymentsData || []);
    } catch (error) {
      console.error(`Error fetching invoice with ID ${invoiceId}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching invoice with ID ${invoiceId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendInvoice = async () => {
    if (!invoice) return;
    
    try {
      // If invoice is in draft status, update it to sent
      if (invoice.status === 'draft') {
        const { error } = await supabase
          .from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceId);
          
        if (error) throw error;
        
        // Update local state
        setInvoice({ ...invoice, status: 'sent' });
      }
      
      // Open email modal
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating invoice status');
    }
  };
  
  const handleCreateCreditNote = () => {
    // Redirect to credit note creation page with invoice ID
    window.location.href = `/credit-notes/new?fromInvoice=${invoiceId}`;
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDuplicate = () => {
    // Redirect to invoice creation page with duplicate flag
    window.location.href = `/invoices/new?duplicate=${invoiceId}`;
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
  
  if (!invoice) {
    return (
      <div className="text-center py-6 text-gray-500">
        Facture non trouvée
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
          <h1 className="text-2xl font-bold">Facture {invoice.invoice_number}</h1>
        </div>
        <StatusBadge status={invoice.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendInvoice}
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
        
        {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'late') && (
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CreditCard size={18} />
            Enregistrer un paiement
          </button>
        )}
        
        {invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
          <button
            onClick={handleCreateCreditNote}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            <FileOutput size={18} />
            Créer un avoir
          </button>
        )}
      </div>
      
      {/* Invoice Document */}
      <div ref={invoiceRef} className="bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">FACTURE</h2>
            <p className="text-gray-600">N° {invoice.invoice_number}</p>
            {invoice.document_type && (
              <p className="text-gray-600">Type: <span className="font-medium">{invoice.document_type.label}</span></p>
            )}
            <p className="text-gray-600">Date: {formatDate(invoice.date_issued)}</p>
            <p className="text-gray-600">Échéance: {formatDate(invoice.date_due)}</p>
            {invoice.order && (
              <p className="text-gray-600">Commande: {invoice.order.order_number}</p>
            )}
            {invoice.quote && (
              <p className="text-gray-600">Devis: {invoice.quote.quote_number}</p>
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
            <p className="font-medium">{invoice.customer?.name}</p>
            {invoice.customer?.email && <p>{invoice.customer.email}</p>}
            {invoice.customer?.phone && <p>{invoice.customer.phone}</p>}
            
            {/* Billing Address */}
            {invoice.billing_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de facturation:</p>
                <p>{invoice.billing_address_json.line1}</p>
                {invoice.billing_address_json.line2 && <p>{invoice.billing_address_json.line2}</p>}
                <p>{invoice.billing_address_json.zip} {invoice.billing_address_json.city}</p>
                <p>{invoice.billing_address_json.country}</p>
              </div>
            )}
            
            {/* Shipping Address */}
            {invoice.shipping_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de livraison:</p>
                <p>{invoice.shipping_address_json.line1}</p>
                {invoice.shipping_address_json.line2 && <p>{invoice.shipping_address_json.line2}</p>}
                <p>{invoice.shipping_address_json.zip} {invoice.shipping_address_json.city}</p>
                <p>{invoice.shipping_address_json.country}</p>
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
              {invoice.items?.map((item, index) => (
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
              <span>{formatCurrency(invoice.total_ht)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">TVA:</span>
              <span>{formatCurrency(invoice.tva)}</span>
            </div>
            <div className="flex justify-between py-2 border-b font-bold text-lg">
              <span>Total TTC:</span>
              <span>{formatCurrency(invoice.total_ttc)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between py-2 border-b text-green-600">
                  <span className="font-medium">Montant payé:</span>
                  <span>{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-lg">
                  <span>Reste à payer:</span>
                  <span>{formatCurrency(Math.max(0, invoice.total_ttc - invoice.amount_paid))}</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Payments */}
        {payments.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2">Paiements</h3>
            <div className="border-t border-gray-200 pt-2">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Méthode
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.payment_method === 'cash' && 'Espèces'}
                        {payment.payment_method === 'card' && 'Carte bancaire'}
                        {payment.payment_method === 'transfer' && 'Virement'}
                        {payment.payment_method === 'check' && 'Chèque'}
                        {payment.payment_method === 'other' && 'Autre'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.reference || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Notes */}
        {invoice.note && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
            <div className="border-t border-gray-200 pt-2">
              <p className="whitespace-pre-line">{invoice.note}</p>
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
        documentType="invoice"
        documentId={invoiceId}
        documentNumber={invoice.invoice_number}
        customerName={invoice.customer?.name || ''}
        customerEmail={invoice.customer?.email || ''}
        documentRef={invoiceRef}
        additionalData={{
          dueDate: formatDate(invoice.date_due),
          totalAmount: invoice.total_ttc
        }}
      />
      
      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <PaymentForm
          invoiceId={invoiceId}
          invoiceNumber={invoice.invoice_number}
          totalAmount={invoice.total_ttc}
          amountPaid={invoice.amount_paid}
          onClose={() => {
            setIsPaymentModalOpen(false);
            fetchInvoice(); // Refresh data after payment
          }}
        />
      )}
    </div>
  );
};

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  onClose: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  invoiceId,
  invoiceNumber,
  totalAmount,
  amountPaid,
  onClose
}) => {
  const [formData, setFormData] = useState({
    amount: Math.max(0, totalAmount - amountPaid).toFixed(2),
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'card',
    reference: '',
    note: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('payments')
        .insert([{
          invoice_id: invoiceId,
          amount: parseFloat(formData.amount),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference: formData.reference || null,
          note: formData.note || null
        }]);
        
      if (error) throw error;
      
      onClose();
    } catch (error) {
      console.error('Error adding payment:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while adding the payment');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800">
            <span className="font-medium">Facture:</span> {invoiceNumber}
          </p>
          <p className="text-blue-800">
            <span className="font-medium">Montant total:</span> {formatCurrency(totalAmount)}
          </p>
          <p className="text-blue-800">
            <span className="font-medium">Déjà payé:</span> {formatCurrency(amountPaid)}
          </p>
          <p className="text-blue-800 font-medium">
            Reste à payer: {formatCurrency(Math.max(0, totalAmount - amountPaid))}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              step="0.01"
              min="0.01"
              max={Math.max(0, totalAmount - amountPaid)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de paiement <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Méthode de paiement <span className="text-red-500">*</span>
            </label>
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="cash">Espèces</option>
              <option value="card">Carte bancaire</option>
              <option value="transfer">Virement</option>
              <option value="check">Chèque</option>
              <option value="other">Autre</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Référence
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Numéro de transaction, chèque, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Informations complémentaires..."
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Annuler
            </button>
            
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};