import React, { useState, useEffect, useRef } from 'react';
import { useVariantStore } from '../store/variantStore';
import { Download, Upload, Trash2, Plus } from 'lucide-react';
import { ImportDialog } from '../components/ImportProgress/ImportDialog';
import { useCSVImport } from '../hooks/useCSVImport';

export const VariantManagement: React.FC = () => {
  const { variants, isLoading, error, fetchVariants, addVariant, addVariants, deleteVariant } = useVariantStore();
  const [newVariant, setNewVariant] = useState({
    color: '',
    grade: '',
    capacity: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadVariants = async () => {
      try {
        await fetchVariants();
      } catch (error) {
        console.error('Failed to load variants:', error);
      }
    };
    
    loadVariants();
  }, [fetchVariants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addVariant(newVariant);
      setNewVariant({ color: '', grade: '', capacity: '' });
    } catch (error) {
      console.error('Error adding variant:', error);
    }
  };

  const handleSelectVariant = (id: string) => {
    setSelectedVariants(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedVariants.size === variants.length) {
      setSelectedVariants(new Set());
    } else {
      setSelectedVariants(new Set(variants.map(v => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedVariants) {
        await deleteVariant(id);
      }
      setSelectedVariants(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting variants:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n').slice(1); // Skip header row
      const variants = rows
        .filter(row => row.trim())
        .map(row => {
          const [color, grade, capacity] = row.split(',').map(field => field.trim());
          return { color, grade, capacity };
        });

      startImport(variants.length);
      const importErrors: { line: number; message: string }[] = [];

      for (let i = 0; i < variants.length; i++) {
        try {
          const variant = variants[i];
          await addVariant(variant);
          incrementProgress();
        } catch (err) {
          console.error('Error importing variant:', err);
          importErrors.push({
            line: i + 2,
            message: `Erreur avec la variante ${variant.color} ${variant.grade} ${variant.capacity}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
          });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (importErrors.length > 0) {
        setImportError(importErrors);
      } else {
        setImportSuccess(`${variants.length} variantes importées avec succès`);
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      setImportError([{
        line: 0,
        message: 'Erreur lors de l\'importation du fichier CSV'
      }]);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = 'Color,Grade,Capacity\nNOIR,A+,128GO\nBLANC,A,256GO';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'variants_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestion des variantes</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download size={18} />
            Télécharger exemple CSV
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            <Upload size={18} />
            Importer CSV
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Add Variant Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Ajouter une variante</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleur
            </label>
            <input
              type="text"
              value={newVariant.color}
              onChange={(e) => setNewVariant(prev => ({ ...prev, color: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md uppercase"
              required
              placeholder="ex: NOIR"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grade
            </label>
            <input
              type="text"
              value={newVariant.grade}
              onChange={(e) => setNewVariant(prev => ({ ...prev, grade: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md uppercase"
              required
              placeholder="ex: A+"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacité
            </label>
            <input
              type="text"
              value={newVariant.capacity}
              onChange={(e) => setNewVariant(prev => ({ ...prev, capacity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md uppercase"
              required
              placeholder="ex: 128GO"
            />
          </div>
          <div className="col-span-3">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isLoading}
            >
              <Plus size={18} />
              {isLoading ? 'Ajout en cours...' : 'Ajouter la variante'}
            </button>
          </div>
        </form>
      </div>

      {/* Variants List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sélecteur</label>
            <input
              type="checkbox"
              checked={selectedVariants.size === variants.length && variants.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
          {selectedVariants.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <Trash2 size={18} />
              Supprimer ({selectedVariants.size})
            </button>
          )}
        </div>
        <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left">
                  <span className="sr-only">Sélectionner</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Couleur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {variants.map((variant) => (
                <tr key={variant.id} className={selectedVariants.has(variant.id) ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedVariants.has(variant.id)}
                      onChange={() => handleSelectVariant(variant.id)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {variant.color}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {variant.grade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {variant.capacity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => deleteVariant(variant.id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={isLoading}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {variants.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucune variante trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-center text-gray-600">Chargement...</p>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer {selectedVariants.size} variante{selectedVariants.size > 1 ? 's' : ''} ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportDialog
        isOpen={importState.isDialogOpen}
        onClose={closeDialog}
        current={importState.current}
        total={importState.total}
        status={importState.status}
        errors={importState.errors}
      />
    </div>
  );
};