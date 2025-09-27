import React, { useState } from 'react';
import { X, Plus, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProductWithStock } from '../../types/supabase';

interface MirrorProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProduct: ProductWithStock;
  onSuccess: () => void;
}

interface MirrorFormData {
  name: string;
  sku: string;
}

export const MirrorProductModal: React.FC<MirrorProductModalProps> = ({
  isOpen,
  onClose,
  parentProduct,
  onSuccess
}) => {
  const [formData, setFormData] = useState<MirrorFormData>({
    name: '',
    sku: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCSVModal, setShowCSVModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Le nom du produit miroir est requis');
      return;
    }
    if (!formData.sku.trim()) {
      setError('Le SKU du produit miroir est requis');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Creating mirror product for parent:', parentProduct.id);

      // 1) Vérifier si le SKU existe déjà (utiliser maybeSingle pour éviter 406 si aucun résultat)
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .filter('sku', 'eq', formData.sku.trim())
        .maybeSingle();

      if (existingProduct) {
        setError('Ce SKU existe déjà');
        setIsLoading(false);
        return;
      }

      // 2) Utiliser le parent direct tel quel (pas de remontée vers un parent racine)
      let rootParent: any = parentProduct as any;

      // 3) Construire le payload: copier toutes les données du parent sauf sku et name.
      //    Forcer serial_number = NULL. parent_id = rootParent.id
      const payload: any = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        description: rootParent.description,
        purchase_price_with_fees: rootParent.purchase_price_with_fees,
        raw_purchase_price: rootParent.raw_purchase_price,
        retail_price: rootParent.retail_price,
        pro_price: rootParent.pro_price,
        weight_grams: rootParent.weight_grams,
        ean: rootParent.ean,
        stock_alert: rootParent.stock_alert,
        location: rootParent.location,
        vat_type: rootParent.vat_type,
        margin_percent: rootParent.margin_percent,
        margin_value: rootParent.margin_value,
        pro_margin_percent: rootParent.pro_margin_percent,
        pro_margin_value: rootParent.pro_margin_value,
        width_cm: rootParent.width_cm,
        height_cm: rootParent.height_cm,
        depth_cm: rootParent.depth_cm,
        category_id: rootParent.category_id,
        images: rootParent.images,
        variants: rootParent.variants,
        shipping_box_id: rootParent.shipping_box_id,
        parent_id: rootParent.id,
        serial_number: null
      };

      // 4) Créer le miroir
      const { data: mirrorData, error: mirrorError } = await supabase
        .from('products')
        .insert([payload as any])
        .select()
        .single();

      if (mirrorError) {
        console.error('Supabase insertion error:', mirrorError);
        throw new Error('Impossible de créer le miroir. Vérifiez le SKU et réessayez.');
      }

      console.log('Mirror product created successfully:', mirrorData);

      // 5) Rafraîchir la liste et fermer
      onSuccess();
      onClose();
      setFormData({ name: '', sku: '' });
    } catch (err) {
      console.error('Error creating mirror product:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du produit miroir');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Créer un produit miroir</h2>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Produit parent :</strong> {parentProduct.name}
            </p>
            <p className="text-sm text-blue-600">
              Le produit miroir partagera le stock avec le produit parent.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom du produit miroir *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom du produit miroir"
                required
              />
            </div>

            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                SKU du produit miroir *
              </label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SKU unique pour le produit miroir"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Le SKU ne pourra plus être modifié après création
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                {isLoading ? 'Création...' : 'Créer le miroir'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowCSVModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <Upload size={16} />
                CSV
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showCSVModal && (
        <CSVMirrorImportModal
          isOpen={showCSVModal}
          onClose={() => setShowCSVModal(false)}
          parentProduct={parentProduct}
          onSuccess={() => {
            setShowCSVModal(false);
            onSuccess();
            onClose();
          }}
        />
      )}
    </>
  );
};

interface CSVMirrorImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProduct: ProductWithStock;
  onSuccess: () => void;
}

const CSVMirrorImportModal: React.FC<CSVMirrorImportModalProps> = ({
  isOpen,
  onClose,
  parentProduct,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError(null);
      
      // Lire le fichier pour l'aperçu
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        const data = lines.map(line => line.split(',').map(cell => cell.trim()));
        setPreview(data.slice(0, 5)); // Afficher les 5 premières lignes
      };
      reader.readAsText(selectedFile);
    } else {
      setError('Veuillez sélectionner un fichier CSV valide');
      setFile(null);
      setPreview([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Lire le fichier CSV
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csv = event.target?.result as string;
          const lines = csv.split('\n').filter(line => line.trim());
          const data = lines.map(line => line.split(',').map(cell => cell.trim()));
          
          // Supposer que la première ligne contient les en-têtes
          const headers = data[0];
          const nameIndex = headers.findIndex(h => h.toLowerCase().includes('nom') || h.toLowerCase().includes('name'));
          
          if (nameIndex === -1) {
            throw new Error('Colonne "nom" non trouvée dans le fichier CSV');
          }

          // Créer les produits miroirs avec uniquement parent_id et les champs copiés du parent
          const mirrorProducts = data.slice(1).map((row, index) => ({
            name: row[nameIndex] || `Miroir ${index + 1}`,
            sku: `${parentProduct.sku}-MIRROR-${Date.now()}-${index}`,
            description: parentProduct.description,
            purchase_price_with_fees: parentProduct.purchase_price_with_fees,
            raw_purchase_price: parentProduct.raw_purchase_price,
            retail_price: parentProduct.retail_price,
            pro_price: parentProduct.pro_price,
            stock_alert: parentProduct.stock_alert,
            location: parentProduct.location,
            vat_type: parentProduct.vat_type,
            margin_percent: parentProduct.margin_percent,
            margin_value: parentProduct.margin_value,
            pro_margin_percent: parentProduct.pro_margin_percent,
            pro_margin_value: parentProduct.pro_margin_value,
            weight_grams: parentProduct.weight_grams,
            ean: parentProduct.ean,
            width_cm: parentProduct.width_cm,
            height_cm: parentProduct.height_cm,
            depth_cm: parentProduct.depth_cm,
            category_id: parentProduct.category_id,
            images: parentProduct.images,
            variants: parentProduct.variants,
            shipping_box_id: parentProduct.shipping_box_id,
            serial_number: null,
            parent_id: parentProduct.id
          } as any));

          const { error: insertErr } = await supabase
            .from('products')
            .insert(mirrorProducts as any[])
            .select();

          if (insertErr) {
            console.error('Supabase insert error (CSV mirrors):', insertErr);
            throw new Error("Impossible d'insérer les produits miroirs depuis le CSV");
          }

          onSuccess();
        } catch (err) {
          console.error('Error processing CSV:', err);
          setError(err instanceof Error ? err.message : 'Erreur lors du traitement du fichier CSV');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Error importing mirrors:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import des produits miroirs');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Import CSV - Produits miroirs</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Format attendu :</strong> Fichier CSV avec une colonne "nom" ou "name"
          </p>
          <p className="text-sm text-blue-600">
            Tous les produits miroirs partageront les propriétés du produit parent : {parentProduct.name}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 mb-1">
              Fichier CSV
            </label>
            <input
              type="file"
              id="csvFile"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Aperçu (5 premières lignes)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index} className={index === 0 ? 'bg-gray-100 font-medium' : ''}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 border border-gray-300 text-sm">
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

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={!file || isLoading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              {isLoading ? 'Import en cours...' : 'Importer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
