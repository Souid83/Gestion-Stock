import React, { useState, useRef } from 'react';
import { X, Plus, Upload, Download, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProductStore } from '../../store/productStore';

interface CreateMirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProduct: {
    id: string;
    name: string;
    sku: string;
    shared_stock_id: string | null;
  };
  onMirrorCreated: () => void;
}

interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  validRows: number;
  errors: string[];
}

export const CreateMirrorModal: React.FC<CreateMirrorModalProps> = ({
  isOpen,
  onClose,
  parentProduct,
  onMirrorCreated
}) => {
  const { addProduct } = useProductStore();
  
  // Single mirror form
  const [mirrorName, setMirrorName] = useState('');
  const [mirrorSku, setMirrorSku] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // CSV import
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateSingleMirror = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating single mirror for parent:', parentProduct.id);
    
    if (!mirrorName.trim() || !mirrorSku.trim()) {
      setError('Le nom et le SKU du miroir sont obligatoires');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Check if SKU already exists
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', mirrorSku.trim())
        .single();

      if (existingProduct) {
        setError('Ce SKU existe déjà');
        setIsCreating(false);
        return;
      }

      // Get parent product data
      const { data: parentData, error: parentError } = await supabase
        .from('products')
        .select('*')
        .eq('id', parentProduct.id)
        .single();

      if (parentError) throw parentError;

      // Create mirror product
      const mirrorData = {
        ...parentData,
        id: undefined, // Let Supabase generate new ID
        name: mirrorName.trim(),
        sku: mirrorSku.trim(),
        mirror_of: parentProduct.id,
        shared_stock_id: parentProduct.shared_stock_id || parentProduct.id,
        created_at: undefined,
        updated_at: undefined
      };

      const { error: createError } = await supabase
        .from('products')
        .insert([mirrorData]);

      if (createError) throw createError;

      // Update parent to have shared_stock_id if not set
      if (!parentProduct.shared_stock_id) {
        await supabase
          .from('products')
          .update({ shared_stock_id: parentProduct.id })
          .eq('id', parentProduct.id);
      }

      console.log('Mirror created successfully');
      setMirrorName('');
      setMirrorSku('');
      onMirrorCreated();
      onClose();
    } catch (err) {
      console.error('Error creating mirror:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du miroir');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['mirror_name', 'mirror_sku'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        setError(`Colonnes manquantes: ${missingHeaders.join(', ')}`);
        return;
      }

      const nameIndex = headers.indexOf('mirror_name');
      const skuIndex = headers.indexOf('mirror_sku');
      
      const rows: string[][] = [];
      const errors: string[] = [];
      let validRows = 0;

      for (let i = 1; i < Math.min(lines.length, 6); i++) { // Preview first 5 rows
        const values = lines[i].split(',').map(v => v.trim());
        rows.push(values);
        
        const name = values[nameIndex];
        const sku = values[skuIndex];
        
        if (!name || !sku) {
          errors.push(`Ligne ${i + 1}: Nom ou SKU manquant`);
        } else {
          validRows++;
        }
      }

      setCsvPreview({
        headers,
        rows,
        validRows: validRows + Math.max(0, lines.length - 6), // Total valid rows
        errors
      });
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Erreur lors de la lecture du fichier CSV');
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile) return;

    setIsImporting(true);
    setError(null);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const nameIndex = headers.indexOf('mirror_name');
      const skuIndex = headers.indexOf('mirror_sku');

      // Get parent product data
      const { data: parentData, error: parentError } = await supabase
        .from('products')
        .select('*')
        .eq('id', parentProduct.id)
        .single();

      if (parentError) throw parentError;

      const mirrorsToCreate = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const name = values[nameIndex];
        const sku = values[skuIndex];

        if (!name || !sku) {
          errors.push(`Ligne ${i + 1}: Nom ou SKU manquant`);
          continue;
        }

        // Check if SKU already exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('sku', sku)
          .single();

        if (existingProduct) {
          errors.push(`Ligne ${i + 1}: SKU "${sku}" existe déjà`);
          continue;
        }

        mirrorsToCreate.push({
          ...parentData,
          id: undefined,
          name: name,
          sku: sku,
          mirror_of: parentProduct.id,
          shared_stock_id: parentProduct.shared_stock_id || parentProduct.id,
          created_at: undefined,
          updated_at: undefined
        });
      }

      if (mirrorsToCreate.length === 0) {
        setError('Aucun miroir valide à créer');
        setIsImporting(false);
        return;
      }

      // Create all mirrors
      const { error: createError } = await supabase
        .from('products')
        .insert(mirrorsToCreate);

      if (createError) throw createError;

      // Update parent to have shared_stock_id if not set
      if (!parentProduct.shared_stock_id) {
        await supabase
          .from('products')
          .update({ shared_stock_id: parentProduct.id })
          .eq('id', parentProduct.id);
      }

      console.log(`${mirrorsToCreate.length} mirrors created successfully`);
      
      if (errors.length > 0) {
        setError(`${mirrorsToCreate.length} miroirs créés avec succès. Erreurs: ${errors.join(', ')}`);
      }

      setCsvFile(null);
      setCsvPreview(null);
      setShowCSVImport(false);
      onMirrorCreated();
      onClose();
    } catch (err) {
      console.error('Error importing mirrors:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import des miroirs');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = 'mirror_name,mirror_sku\n"iPhone 14 Pro Max Reconditionné","IPH14PM-RECON"\n"iPhone 14 Pro Max Occasion","IPH14PM-OCC"';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_miroirs.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Créer un produit miroir</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-blue-900">Produit parent</h3>
          <p className="text-blue-800">{parentProduct.name}</p>
          <p className="text-blue-600 text-sm">SKU: {parentProduct.sku}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <AlertTriangle size={20} className="mr-2" />
            {error}
          </div>
        )}

        {!showCSVImport ? (
          <div className="space-y-6">
            {/* Single Mirror Form */}
            <form onSubmit={handleCreateSingleMirror} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du miroir <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mirrorName}
                  onChange={(e) => setMirrorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nom du produit miroir"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU du miroir <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mirrorSku}
                  onChange={(e) => setMirrorSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="SKU unique du miroir"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ Le SKU ne pourra plus être modifié après création
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowCSVImport(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  <Upload size={18} />
                  Créer plusieurs miroirs via CSV
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={isCreating}
                >
                  <Plus size={18} />
                  {isCreating ? 'Création...' : 'Créer le miroir'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* CSV Import Section */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Import CSV de miroirs</h3>
              <button
                onClick={() => {
                  setShowCSVImport(false);
                  setCsvFile(null);
                  setCsvPreview(null);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Retour
              </button>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-yellow-800 text-sm mb-2">
                <strong>Format requis:</strong> mirror_name, mirror_sku
              </p>
              <button
                onClick={downloadCSVTemplate}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <Download size={16} />
                Télécharger le modèle CSV
              </button>
            </div>

            {!csvFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCSVFileChange}
                  accept=".csv"
                  className="hidden"
                />
                <Upload size={40} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Glissez-déposez votre fichier CSV ici</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Parcourir
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center bg-blue-50 p-4 rounded-lg">
                  <CheckCircle size={24} className="text-blue-600 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium">{csvFile.name}</p>
                    {csvPreview && (
                      <p className="text-sm text-gray-600">
                        {csvPreview.validRows} miroirs valides trouvés
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setCsvFile(null);
                      setCsvPreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                </div>

                {csvPreview && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-3 border-b">
                      <h4 className="font-medium flex items-center">
                        <Eye size={18} className="mr-2" />
                        Aperçu des données
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {csvPreview.headers.map((header, index) => (
                              <th 
                                key={index}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {csvPreview.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td 
                                  key={cellIndex}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {csvPreview && csvPreview.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2">Erreurs détectées:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {csvPreview.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleImportCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    disabled={isImporting || !csvPreview || csvPreview.validRows === 0}
                  >
                    {isImporting ? 'Import en cours...' : `Importer ${csvPreview?.validRows || 0} miroirs`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};