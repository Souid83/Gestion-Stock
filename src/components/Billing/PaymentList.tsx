import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../../store/invoiceStore';
import { X, Plus, Trash2, CreditCard, Calendar, FileText, DollarSign } from 'lucide-react';
import { Payment, PaymentMethod } from '../../types/billing';

interface PaymentListProps {
  invoiceId: string;
  invoiceTotal: number;
  amountPaid: number;
}

export const PaymentList: React.FC<PaymentListProps> = ({ invoiceId, invoiceTotal, amountPaid }) => {
  const { getPaymentsByInvoiceId, addPayment, isLoading, error } = useInvoiceStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: (invoiceTotal - amountPaid).toFixed(2),
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'card' as PaymentMethod,
    reference: '',
    note: ''
  });

  useEffect(() => {
    loadPayments();
  }, [invoiceId]);

  const loadPayments = async () => {
    console.log('Loading payments for invoice:', invoiceId);
    const paymentsData = await getPaymentsByInvoiceId(invoiceId);
    console.log('Payments loaded:', paymentsData);
    setPayments(paymentsData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPayment(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Adding payment:', newPayment);

    try {
      const payment = await addPayment({
        invoice_id: invoiceId,
        amount: parseFloat(newPayment.amount),
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        reference: newPayment.reference || undefined,
        note: newPayment.note || undefined
      });

      if (payment) {
        console.log('Payment added successfully:', payment);
        setShowAddPaymentForm(false);
        setNewPayment({
          amount: '0.00',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'card',
          reference: '',
          note: ''
        });
        await loadPayments();
      }
    } catch (err) {
      console.error('Error adding payment:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte bancaire';
      case 'transfer': return 'Virement';
      case 'check': return 'Chèque';
      case 'other': return 'Autre';
      default: return method;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold flex items-center">
          <CreditCard size={20} className="mr-2" />
          Paiements
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-600">Total:</span>{' '}
            <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Payé:</span>{' '}
            <span className="font-medium text-green-600">{formatCurrency(amountPaid)}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Reste:</span>{' '}
            <span className="font-medium text-red-600">{formatCurrency(Math.max(0, invoiceTotal - amountPaid))}</span>
          </div>
          {!showAddPaymentForm && (
            <button
              onClick={() => setShowAddPaymentForm(true)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              disabled={invoiceTotal <= amountPaid}
            >
              <Plus size={16} />
              Ajouter un paiement
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {showAddPaymentForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Nouveau paiement</h3>
            <button
              onClick={() => setShowAddPaymentForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="amount"
                  value={newPayment.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  step="0.01"
                  min="0.01"
                  max={Math.max(0, invoiceTotal - amountPaid)}
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de paiement <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="payment_date"
                  value={newPayment.payment_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Méthode de paiement <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method"
                value={newPayment.payment_method}
                onChange={handleInputChange}
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
                value={newPayment.reference}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="N° de transaction, chèque..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                name="note"
                value={newPayment.note}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Informations complémentaires..."
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                disabled={isLoading}
              >
                <Plus size={18} />
                {isLoading ? 'Enregistrement...' : 'Enregistrer le paiement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Méthode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPaymentMethodLabel(payment.payment_method)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.reference || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.note || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                    {formatCurrency(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <CreditCard size={48} className="mx-auto text-gray-300 mb-2" />
          <p>Aucun paiement enregistré</p>
        </div>
      )}
    </div>
  );
};