import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Power, X, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DocumentType } from '../../types/billing';

export const DocumentTypesPage: React.FC = () => {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTypes, setFilteredTypes] = useState<DocumentType[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    description: '',
    is_active: true
  });

  // Fetch document types
  const fetchTypes = async () => {
    console.log('Fetching document types...');
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('billing_document_types')
        .select('*')
        .order('label');

      if (error) {
        console.error('Error fetching document types:', error);
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} document types`);
      setTypes(data || []);
      setFilteredTypes(data || []);
    } catch (err) {
      console.error('Error in fetchTypes:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  // Filter types when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTypes(types);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      setFilteredTypes(
        types.filter(type =>
          type.label.toLowerCase().includes(lowercasedSearch) ||
          (type.description?.toLowerCase().includes(lowercasedSearch) || false)
        )
      );
    }
  }, [searchTerm, types]);

  // Open modal for new type
  const handleNew = () => {
    console.log('Opening modal for new document type');
    setEditingType(null);
    setFormData({
      label: '',
      description: '',
      is_active: true
    });
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (type: DocumentType) => {
    console.log('Opening modal for editing:', type);
    setEditingType(type);
    setFormData({
      label: type.label,
      description: type.description || '',
      is_active: type.is_active
    });
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Saving document type:', formData);

    if (!formData.label.trim()) {
      alert('Le libellé est obligatoire');
      return;
    }

    setError(null);

    try {
      if (editingType) {
        // Update existing type
        console.log('Updating type with id:', editingType.id);
        const { error } = await supabase
          .from('billing_document_types')
          .update({
            label: formData.label.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active
          })
          .eq('id', editingType.id);

        if (error) throw error;
        console.log('Type updated successfully');
      } else {
        // Create new type
        console.log('Creating new type');
        const { error } = await supabase
          .from('billing_document_types')
          .insert([{
            label: formData.label.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active
          }]);

        if (error) throw error;
        console.log('Type created successfully');
      }

      setShowModal(false);
      fetchTypes();
    } catch (err) {
      console.error('Error saving type:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    }
  };

  // Toggle active status
  const handleToggleActive = async (type: DocumentType) => {
    console.log('Toggling active status for:', type);

    try {
      const { error } = await supabase
        .from('billing_document_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);

      if (error) throw error;

      console.log('Active status toggled successfully');
      fetchTypes();
    } catch (err) {
      console.error('Error toggling active status:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification');
    }
  };

  // Delete type
  const handleDelete = async (type: DocumentType) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le type "${type.label}" ?`)) {
      return;
    }

    console.log('Deleting type:', type);

    try {
      const { error } = await supabase
        .from('billing_document_types')
        .delete()
        .eq('id', type.id);

      if (error) throw error;

      console.log('Type deleted successfully');
      fetchTypes();
    } catch (err) {
      console.error('Error deleting type:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression. Ce type est peut-être utilisé par des documents.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Typages de documents</h1>
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
            onClick={fetchTypes}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Nouveau typage
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Libellé
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
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
                  {filteredTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{type.label}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{type.description || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {type.is_active ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(type)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(type)}
                            className={`${type.is_active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                            title={type.is_active ? 'Désactiver' : 'Activer'}
                          >
                            <Power size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(type)}
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
              <p className="text-gray-500">
                {searchTerm ? 'Aucun résultat pour cette recherche.' : 'Aucun typage de document trouvé.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingType ? 'Modifier le typage' : 'Nouveau typage'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Libellé <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Facture Voiture"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Description optionnelle..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Actif
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
