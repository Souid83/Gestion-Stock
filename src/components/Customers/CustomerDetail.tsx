import React, { useEffect, useState } from 'react';
import { useCustomerStore } from '../../store/customerStore';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Building, 
  Home, 
  Edit, 
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Calendar
} from 'lucide-react';
import { CustomerWithAddresses } from '../../types/customers';
import { supabase } from '../../lib/supabase';

interface CustomerDetailProps {
  customerId: string;
  onBack?: () => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack }) => {
  const { getCustomerById, isLoading, error } = useCustomerStore();
  const [customer, setCustomer] = useState<CustomerWithAddresses | null>(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalInvoices: 0,
    totalSpent: 0,
    lastOrderDate: null as string | null
  });
  
  useEffect(() => {
    const loadCustomer = async () => {
      const data = await getCustomerById(customerId);
      if (data) {
        setCustomer(data);
        loadCustomerStats(data.id);
      }
    };
    
    loadCustomer();
  }, [customerId, getCustomerById]);
  
  const loadCustomerStats = async (id: string) => {
    try {
      // Get total orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, date_issued, total_ttc')
        .eq('customer_id', id)
        .order('date_issued', { ascending: false });
        
      if (ordersError) throw ordersError;
      
      // Get total invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, total_ttc')
        .eq('customer_id', id);
        
      if (invoicesError) throw invoicesError;
      
      // Calculate stats
      const totalOrders = orders?.length || 0;
      const totalInvoices = invoices?.length || 0;
      const totalSpent = invoices?.reduce((sum, invoice) => sum + (invoice.total_ttc || 0), 0) || 0;
      const lastOrderDate = orders && orders.length > 0 ? orders[0].date_issued : null;
      
      setStats({
        totalOrders,
        totalInvoices,
        totalSpent,
        lastOrderDate
      });
    } catch (error) {
      console.error('Error loading customer stats:', error);
    }
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
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
  
  if (!customer) {
    return (
      <div className="text-center py-6 text-gray-500">
        Client non trouvé
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
          <h1 className="text-2xl font-bold">{customer.name}</h1>
        </div>
        <button
          onClick={() => {
            // Store the ID in session storage and navigate to the edit page
            sessionStorage.setItem('editCustomerId', customer.id);
            window.location.href = '/customers/edit';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Edit size={18} />
          Modifier
        </button>
      </div>
      
      {/* Customer Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <User size={20} className="mr-2" />
          Informations du client
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Type de client</h3>
            <p className="mt-1">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                customer.customer_group === 'pro' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {customer.customer_group === 'pro' ? 'Professionnel' : 'Particulier'}
              </span>
            </p>
          </div>
          
          {customer.email && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 flex items-center">
                <Mail size={16} className="mr-1" />
                Email
              </h3>
              <p className="mt-1">{customer.email}</p>
            </div>
          )}
          
          {customer.phone && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 flex items-center">
                <Phone size={16} className="mr-1" />
                Téléphone
              </h3>
              <p className="mt-1">{customer.phone}</p>
            </div>
          )}
          
          {customer.zone && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 flex items-center">
                <MapPin size={16} className="mr-1" />
                Zone géographique
              </h3>
              <p className="mt-1">{customer.zone}</p>
            </div>
          )}
          
          {customer.notes && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-500 flex items-center">
                <FileText size={16} className="mr-1" />
                Notes
              </h3>
              <p className="mt-1 whitespace-pre-line">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Customer Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Statistiques</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center text-blue-600 mb-1">
              <ShoppingBag size={18} className="mr-2" />
              <h3 className="text-sm font-medium">Commandes</h3>
            </div>
            <p className="text-2xl font-bold text-blue-800">{stats.totalOrders}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center text-green-600 mb-1">
              <FileText size={18} className="mr-2" />
              <h3 className="text-sm font-medium">Factures</h3>
            </div>
            <p className="text-2xl font-bold text-green-800">{stats.totalInvoices}</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center text-purple-600 mb-1">
              <CreditCard size={18} className="mr-2" />
              <h3 className="text-sm font-medium">Total dépensé</h3>
            </div>
            <p className="text-2xl font-bold text-purple-800">{formatCurrency(stats.totalSpent)}</p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center text-yellow-600 mb-1">
              <Calendar size={18} className="mr-2" />
              <h3 className="text-sm font-medium">Dernière commande</h3>
            </div>
            <p className="text-lg font-bold text-yellow-800">{formatDate(stats.lastOrderDate)}</p>
          </div>
        </div>
      </div>
      
      {/* Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Billing Addresses */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Building size={20} className="mr-2" />
            Adresses de facturation
          </h2>
          
          {customer.addresses?.filter(addr => addr.address_type === 'billing').length ? (
            <div className="space-y-4">
              {customer.addresses
                .filter(addr => addr.address_type === 'billing')
                .map(address => (
                  <div key={address.id} className={`p-4 border rounded-md ${address.is_default ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    <p>{address.zip} {address.city}</p>
                    <p>{address.country}</p>
                    
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
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Home size={20} className="mr-2" />
            Adresses de livraison
          </h2>
          
          {customer.addresses?.filter(addr => addr.address_type === 'shipping').length ? (
            <div className="space-y-4">
              {customer.addresses
                .filter(addr => addr.address_type === 'shipping')
                .map(address => (
                  <div key={address.id} className={`p-4 border rounded-md ${address.is_default ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    <p>{address.zip} {address.city}</p>
                    <p>{address.country}</p>
                    
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
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Activité récente</h2>
        
        {/* This would be populated with recent orders, invoices, etc. */}
        <div className="text-center py-6 text-gray-500">
          Aucune activité récente
        </div>
      </div>
    </div>
  );
};