import React, { useEffect, useState } from 'react';
import { useCustomerStore } from '../../store/customerStore';
import { Eye, Edit, Trash2, Plus, Search, RefreshCw, MapPin, Phone, Mail } from 'lucide-react';

interface CustomerListProps {
  onNew?: () => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onNew, onEdit, onView }) => {
  const { customers, isLoading, error, fetchCustomers, deleteCustomer } = useCustomerStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>(customers as any[]);
  const [groupFilter, setGroupFilter] = useState<'all' | 'pro' | 'particulier'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [uniqueZones, setUniqueZones] = useState<string[]>([]);

  useEffect(() => {
    console.log('CustomerList component mounted, fetching customers...');
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    // Extract unique zones from customers
    const zones = (customers as any[])
      .map((customer: any) => customer.zone)
      .filter((zone: any): zone is string => !!zone)
      .filter((zone: string, index: number, self: string[]) => self.indexOf(zone) === index)
      .sort();
    
    setUniqueZones(zones);
  }, [customers]);

  useEffect(() => {
    // Apply filters
    let filtered: any[] = [...(customers as any[])];
    
    // Apply group filter
    if (groupFilter !== 'all') {
      filtered = filtered.filter((customer: any) => customer.customer_group === groupFilter);
    }
    
    // Apply zone filter
    if (zoneFilter) {
      filtered = filtered.filter((customer: any) => customer.zone === zoneFilter);
    }
    
    // Apply search term
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        (customer.name || '').toLowerCase().includes(lowercasedSearch) ||
        (customer.email && (customer.email as string).toLowerCase().includes(lowercasedSearch)) ||
        (customer.phone && (customer.phone as string).toLowerCase().includes(lowercasedSearch))
      );
    }
    
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, groupFilter, zoneFilter]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      await deleteCustomer(id);
    }
  };

  const handleEditCustomer = (id: string) => {
    if (onEdit) return onEdit(id);
    // Fallback legacy navigation
    sessionStorage.setItem('editCustomerId', id);
    window.location.href = '/customers/edit';
  };

  const handleViewCustomer = (id: string) => {
    if (onView) return onView(id);
    // Fallback legacy navigation
    sessionStorage.setItem('viewCustomerId', id);
    window.location.href = '/customers/view';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Liste des clients</h1>
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
            onClick={() => fetchCustomers()}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => (onNew ? onNew() : (window.location.href = '/customers/new'))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Nouveau client
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de client
          </label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as 'all' | 'pro' | 'particulier')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tous</option>
            <option value="pro">Professionnels</option>
            <option value="particulier">Particuliers</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zone géographique
          </label>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Toutes les zones</option>
            {[...new Set([
              'Auvergne-Rhône-Alpes',
              'Bourgogne-Franche-Comté',
              'Bretagne',
              'Centre-Val de Loire',
              'Corse',
              'Grand Est',
              'Hauts-de-France',
              'Île-de-France',
              'Normandie',
              'Nouvelle-Aquitaine',
              'Occitanie',
              'Pays de la Loire',
              "Provence-Alpes-Côte d'Azur",
              'Guadeloupe',
              'Martinique',
              'Guyane',
              'La Réunion',
              'Mayotte',
              ...uniqueZones
            ])].map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
        
        <div className="ml-auto flex items-end">
          <span className="text-sm text-gray-500">
            {filteredCustomers.length} client{filteredCustomers.length !== 1 ? 's' : ''} trouvé{filteredCustomers.length !== 1 ? 's' : ''}
          </span>
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
          {filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adresses
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          {customer.email && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail size={14} className="mr-1" />
                              {customer.email}
                            </div>
                          )}
                          {customer.phone && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone size={14} className="mr-1" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.customer_group === 'pro' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {customer.customer_group === 'pro' ? 'Professionnel' : 'Particulier'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.zone ? (
                          <div className="flex items-center">
                            <MapPin size={14} className="mr-1" />
                            {customer.zone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <div>
                            Facturation: {customer.addresses?.some((a: any) => a.address_type === 'billing') ? 
                              <span className="text-green-600">Oui</span> : 
                              <span className="text-red-600">Non</span>}
                          </div>
                          <div>
                            Livraison: {customer.addresses?.some((a: any) => a.address_type === 'shipping') ? 
                              <span className="text-green-600">Oui</span> : 
                              <span className="text-red-600">Non</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewCustomer(customer.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Voir"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleEditCustomer(customer.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => alert("Envoi d'email bientôt disponible")}
                            className="text-gray-600 hover:text-gray-900"
                            title="Envoi d'email bientôt disponible"
                          >
                            <Mail size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun client trouvé</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || groupFilter !== 'all' || zoneFilter 
                  ? "Aucun résultat pour ces critères de recherche." 
                  : "Commencez par créer un nouveau client."}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => (onNew ? onNew() : (window.location.href = '/customers/new'))}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Nouveau client
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
