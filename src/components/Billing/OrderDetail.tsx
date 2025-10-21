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
  Truck,
  CheckCircle,
  FileOutput
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OrderStatus, OrderWithDetails } from '../../types/billing';
import { EmailSender } from './EmailSender';

interface OrderDetailProps {
  orderId: string;
  onBack?: () => void;
}

// Status badge component
const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'confirmed': return 'bg-blue-200 text-blue-800';
      case 'shipped': return 'bg-yellow-200 text-yellow-800';
      case 'delivered': return 'bg-green-200 text-green-800';
      case 'cancelled': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'confirmed': return 'Confirmée';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
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

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, onBack }) => {
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const orderRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('OrderDetail component mounted, fetching order...');
    fetchOrder();
  }, [orderId]);
  
  const fetchOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching order with ID: ${orderId}`);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          items:order_items(*, product:products(id, name, sku, retail_price, pro_price)),
          quote:quotes(id, quote_number)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      console.log('Order data fetched:', data);
      setOrder(data);
    } catch (error) {
      console.error(`Error fetching order with ID ${orderId}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching order with ID ${orderId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateOrderStatus = async (status: OrderStatus) => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
        
      if (error) throw error;
      
      // Update local state
      setOrder({ ...order, status });
    } catch (error) {
      console.error('Error updating order status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating order status');
    }
  };
  
  const handleSendOrder = async () => {
    if (!order) return;
    
    try {
      // If order is in draft status, update it to confirmed
      if (order.status === 'draft') {
        await updateOrderStatus('confirmed');
      }
      
      // Open email modal
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Error updating order status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating order status');
    }
  };
  
  const handleConfirmOrder = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir confirmer cette commande ?')) {
      await updateOrderStatus('confirmed');
    }
  };
  
  const handleShipOrder = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer cette commande comme expédiée ?')) {
      await updateOrderStatus('shipped');
    }
  };
  
  const handleDeliverOrder = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer cette commande comme livrée ?')) {
      await updateOrderStatus('delivered');
    }
  };
  
  const handleCancelOrder = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      await updateOrderStatus('cancelled');
    }
  };
  
  const handleConvertToInvoice = () => {
    // Redirect to invoice creation page with order ID
    window.location.href = `/invoices/new?fromOrder=${orderId}`;
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDuplicate = () => {
    // Redirect to order creation page with duplicate flag
    window.location.href = `/orders/new?duplicate=${orderId}`;
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
  
  if (!order) {
    return (
      <div className="text-center py-6 text-gray-500">
        Commande non trouvée
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
          <h1 className="text-2xl font-bold">Commande {order.order_number}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendOrder}
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
        
        {order.status === 'draft' && (
          <button
            onClick={handleConfirmOrder}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CheckCircle size={18} />
            Confirmer
          </button>
        )}
        
        {order.status === 'confirmed' && (
          <button
            onClick={handleShipOrder}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            <Truck size={18} />
            Marquer comme expédiée
          </button>
        )}
        
        {order.status === 'shipped' && (
          <button
            onClick={handleDeliverOrder}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CheckCircle size={18} />
            Marquer comme livrée
          </button>
        )}
        
        {(order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') && (
          <button
            onClick={handleConvertToInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <FileOutput size={18} />
            Créer une facture
          </button>
        )}
        
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <button
            onClick={handleCancelOrder}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <X size={18} />
            Annuler
          </button>
        )}
      </div>
      
      {/* Order Document */}
      <div ref={orderRef} className="bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">BON DE COMMANDE</h2>
            <p className="text-gray-600">N° {order.order_number}</p>
            <p className="text-gray-600">Date: {formatDate(order.date_issued)}</p>
            {order.date_delivery && (
              <p className="text-gray-600">Livraison prévue: {formatDate(order.date_delivery)}</p>
            )}
            {order.quote && (
              <p className="text-gray-600">Devis: {order.quote.quote_number}</p>
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
            <p className="font-medium">{order.customer?.name}</p>
            {order.customer?.email && <p>{order.customer.email}</p>}
            {order.customer?.phone && <p>{order.customer.phone}</p>}
            
            {/* Billing Address */}
            {order.billing_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de facturation:</p>
                <p>{order.billing_address_json.line1}</p>
                {order.billing_address_json.line2 && <p>{order.billing_address_json.line2}</p>}
                <p>{order.billing_address_json.zip} {order.billing_address_json.city}</p>
                <p>{order.billing_address_json.country}</p>
              </div>
            )}
            
            {/* Shipping Address */}
            {order.shipping_address_json && (
              <div className="mt-2">
                <p className="font-medium">Adresse de livraison:</p>
                <p>{order.shipping_address_json.line1}</p>
                {order.shipping_address_json.line2 && <p>{order.shipping_address_json.line2}</p>}
                <p>{order.shipping_address_json.zip} {order.shipping_address_json.city}</p>
                <p>{order.shipping_address_json.country}</p>
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
              {order.items?.map((item, index) => (
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
              <span>{formatCurrency(order.total_ht)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">TVA:</span>
              <span>{formatCurrency(order.tva)}</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-lg">
              <span>Total TTC:</span>
              <span>{formatCurrency(order.total_ttc)}</span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        {order.note && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
            <div className="border-t border-gray-200 pt-2">
              <p className="whitespace-pre-line">{order.note}</p>
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
        documentType="order"
        documentId={orderId}
        documentNumber={order.order_number}
        customerName={order.customer?.name || ''}
        customerEmail={order.customer?.email || ''}
        documentRef={orderRef}
        additionalData={{
          totalAmount: order.total_ttc
        }}
      />
    </div>
  );
};