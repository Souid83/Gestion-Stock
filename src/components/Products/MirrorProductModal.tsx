import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProductWithStock } from '../../types/supabase';
import { useCategoryStore } from '../../store/categoryStore';
import { useCSVImport } from '../../hooks/useCSVImport';
import { ImportDialog } from '../ImportProgress/ImportDialog';

interface MirrorProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProduct: ProductWithStock;
  onSuccess: () => void;
}

interface MirrorFormData {
  name: string;
  sku: string;
  description: string;
}

export const MirrorProductModal: React.FC<MirrorProductModalProps> = ({
  isOpen,
  onClose,
  parentProduct,
  onSuccess
}) => {
  const [formData, setFormData] = useState<MirrorFormData>({
    name: '',
    sku: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catégories enfant (facultatives): si fournies, exiger les 3 niveaux
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const [selectedCategory, setSelectedCategory] = useState({
    type: '',
    brand: '',
    model: ''
  });

  const uniqueTypes = useMemo(
    () => Array.from(new Set(categories.map(c => c.type))).sort(),
    [categories]
  );
  const filteredBrands = useMemo(
    () => Array.from(new Set(categories.filter(c => !selectedCategory.type || c.type === selectedCategory.type).map(c => c.brand))).sort(),
    [categories, selectedCategory.type]
  );
  const filteredModels = useMemo(
    () => Array.from(new Set(categories.filter(c =>
      (!selectedCategory.type || c.type === selectedCategory.type) &&
      (!selectedCategory.brand || c.brand === selectedCategory.brand)
    ).map(c => c.model))).sort(),
    [categories, selectedCategory.type, selectedCategory.brand]
  );

  const handleCategoryChange = (field: keyof typeof selectedCategory, value: string) => {
    const upperValue = (value || '').toUpperCase();
    setSelectedCategory(prev => {
      const next = { ...prev, [field]: upperValue };
      if (field === 'type') {
        next.brand = '';
        next.model = '';
      } else if (field === 'brand') {
        next.model = '';
      }
      return next;
    });
  };

  const downloadSampleCSV = () => {
    try {
      const parentSku = (parentProduct?.sku || 'PARENT')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const headers = ['parent_sku', 'name', 'sku'];
      const rows = [
        [parentSku, 'lcd iphone 12 original', 'LCDIPHONE120001'],
        [parentSku, 'lcd iphone 8 générique', 'lcdiphone80002']
      ];
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeSku = (parentProduct?.sku || 'parent')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `mirrors_template_${safeSku}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error generating sample CSV:', e);
      alert('Impossible de générer le modèle CSV.');
    }
  };
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

    const skuUpper = formData.sku.trim().toUpperCase();

    try {
      console.log('Creating mirror product for parent:', parentProduct.id);

      // 1) Vérifier si le SKU existe déjà (utiliser maybeSingle pour éviter 406 si aucun résultat)
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .ilike('sku', skuUpper)
        .maybeSingle();

      if (existingProduct) {
        setError('Ce SKU existe déjà');
        setIsLoading(false);
        return;
      }

      // 2) Sécuriser le parent cible:
      //    Si jamais on reçoit un miroir enfant par erreur, remonter au parent d'origine
      let rootParent: any = parentProduct as any;
      if ((parentProduct as any)?.parent_id) {
        const { data: trueParent } = await supabase
          .from('products')
          .select('*')
          .eq('id', (parentProduct as any).parent_id as any)
          .maybeSingle();
        if (trueParent) {
          rootParent = trueParent as any;
        }
      }

      // 3) Résoudre la catégorie enfant si 3 niveaux fournis; sinon hériter du parent
      const hasAnyCategory =
        !!selectedCategory.type || !!selectedCategory.brand || !!selectedCategory.model;
      const hasFullCategory =
        !!selectedCategory.type && !!selectedCategory.brand && !!selectedCategory.model;

      if (hasAnyCategory && !hasFullCategory) {
        setError('Pour la catégorie enfant, renseignez les 3 champs (Nature, Marque, Modèle) ou laissez vide pour hériter du parent');
        setIsLoading(false);
        return;
      }

      let childCategoryId = rootParent.category_id;
      if (hasFullCategory) {
        try {
          const cat = await addCategory({
            type: selectedCategory.type.toUpperCase(),
            brand: selectedCategory.brand.toUpperCase(),
            model: selectedCategory.model.toUpperCase()
          });
          childCategoryId = cat?.id ?? childCategoryId;
        } catch (e) {
          console.warn('Impossible de résoudre/ajouter la catégorie enfant, fallback parent:', e);
        }
      }

      // 4) Construire le payload: copier parent, mais surcharger name/sku/description/category_id
      //    Forcer serial_number = NULL, parent_id = rootParent.id
      const payload: any = {
        name: formData.name.trim(),
        sku: skuUpper,
        description: (formData.description || '').trim() || rootParent.description,
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
        category_id: childCategoryId,
        images: rootParent.images,
        variants: rootParent.variants,
          shipping_box_id: rootParent.shipping_box_id,
          mirror_of: rootParent.id,
          serial_number: null,
          is_parent: false
      };

      // 4) Créer le miroir
      const { data: mirrorData, error: mirrorError } = await supabase
        .from('products')
        .insert([payload as any])
        .select()
        .single();

      if (mirrorError) {
        console.error('Supabase insertion error:', mirrorError);
        throw new Error(mirrorError.message || 'Impossible de créer le miroir. Vérifiez le SKU et réessayez.');
      }

      console.log('Mirror product created successfully:', mirrorData);

      // 5) Rafraîchir la liste et fermer
      onSuccess();
      onClose();
      setFormData({ name: '', sku: '', description: '' });
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

            {/* Description enfant (optionnelle) */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description du produit miroir
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description spécifique au produit miroir (optionnel)"
                rows={3}
              />
            </div>

            {/* Catégorie enfant (optionnelle) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Catégorie du produit miroir (optionnelle)</h3>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Si vous ne renseignez pas ces champs, la catégorie du parent sera utilisée.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nature</label>
                  <select
                    value={selectedCategory.type}
                    onChange={(e) => handleCategoryChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">Sélectionner</option>
                    {uniqueTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Marque</label>
                  <select
                    value={selectedCategory.brand}
                    onChange={(e) => handleCategoryChange('brand', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.type}
                  >
                    <option value="">Sélectionner</option>
                    {filteredBrands.map(brand => (<option key={brand} value={brand}>{brand}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Modèle</label>
                  <input
                    type="text"
                    value={selectedCategory.model}
                    onChange={(e) => handleCategoryChange('model', e.target.value)}
                    list="models-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    placeholder="Saisir ou choisir (MAJUSCULE)"
                    disabled={!selectedCategory.brand}
                  />
                  <datalist id="models-list">
                    {filteredModels.map(model => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>
              </div>
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

/**
 * Parse CSV conforme RFC 4180 - gère les guillemets et virgules à l'intérieur des cellules
 * @param csvText - Le contenu brut du fichier CSV
 * @returns Tableau 2D des cellules parsées
 */
const parseCSV = (csvText: string): string[][] => {
  console.log('[parseCSV] Début du parsing CSV');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      // À l'intérieur des guillemets
      if (char === '"') {
        if (nextChar === '"') {
          // Double guillemet échappé -> ajouter un seul guillemet
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Fin des guillemets
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        // Caractère normal à l'intérieur des guillemets (y compris virgules et retours ligne)
        currentCell += char;
        i++;
      }
    } else {
      // À l'extérieur des guillemets
      if (char === '"') {
        // Début des guillemets
        insideQuotes = true;
        i++;
      } else if (char === ',') {
        // Séparateur de cellule
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
      } else if (char === '\n') {
        // Fin de ligne
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        }
        i++;
      } else if (char === '\r') {
        // Ignorer les \r (Windows line endings)
        i++;
      } else {
        // Caractère normal
        currentCell += char;
        i++;
      }
    }
  }

  // Ajouter la dernière cellule et ligne si nécessaire
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  console.log(`[parseCSV] Parsing terminé: ${rows.length} lignes trouvées`);
  console.log('[parseCSV] Aperçu des premières lignes:', rows.slice(0, 3));
  return rows;
};

/**
 * Encode une cellule CSV en ajoutant des guillemets si nécessaire
 * @param cell - La valeur de la cellule
 * @returns La cellule encodée pour CSV
 */
const encodeCSVCell = (cell: string): string => {
  // Si la cellule contient une virgule, un guillemet, ou un retour ligne, on l'encapsule
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
    // Échapper les guillemets en les doublant
    const escaped = cell.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return cell;
};

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
  const { addCategory } = useCategoryStore();
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  // Téléchargement du modèle CSV (local à ce modal)
  const handleDownloadMirrorCSV = () => {
    try {
      console.log('[handleDownloadMirrorCSV] Génération du modèle CSV');
      const parentSku = (parentProduct?.sku || 'PARENT')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      // Nouveau schéma réimportable: parent_sku, parent_name, child_sku, child_name, description, category_type, category_brand, category_model
      const headers = ['parent_sku', 'parent_name', 'child_sku', 'child_name', 'description', 'category_type', 'category_brand', 'category_model'];
      const rows = [
        [parentSku, parentProduct?.name || 'Parent Example', 'CHILD001', 'Nom Enfant 1', 'Description enfant 1', 'SMARTPHONE', 'APPLE', 'IPHONE 12'],
        [parentSku, parentProduct?.name || 'Parent Example', 'CHILD002', 'Nom Enfant 2', 'Description enfant 2 avec, virgule', 'SMARTPHONE', 'APPLE', 'IPHONE 12']
      ];
      // Utiliser encodeCSVCell pour encoder correctement les cellules
      const csvLines = [
        headers.map(h => encodeCSVCell(h)).join(','),
        ...rows.map(r => r.map(cell => encodeCSVCell(cell)).join(','))
      ];
      const csv = csvLines.join('\n');
      console.log('[handleDownloadMirrorCSV] CSV généré:', csv);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeSku = (parentProduct?.sku || 'parent')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `mirrors_template_${safeSku}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[handleDownloadMirrorCSV] Téléchargement du modèle terminé');
    } catch (e) {
      console.error('[handleDownloadMirrorCSV] Erreur:', e);
      alert('Impossible de générer le modèle CSV.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (
      selectedFile &&
      (
        (selectedFile.type && selectedFile.type.toLowerCase().includes('csv')) ||
        (selectedFile.name && selectedFile.name.toLowerCase().endsWith('.csv'))
      )
    ) {
      setFile(selectedFile);
      setError(null);
      
      // Lire le fichier pour l'aperçu
      console.log('[handleFileChange] Fichier sélectionné:', selectedFile.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csv = event.target?.result as string;
          console.log('[handleFileChange] Contenu CSV brut (premiers 500 caractères):', csv.substring(0, 500));
          const data = parseCSV(csv);
          console.log('[handleFileChange] Données parsées:', data.length, 'lignes');
          console.log('[handleFileChange] Première ligne (headers):', data[0]);
          if (data.length > 1) {
            console.log('[handleFileChange] Deuxième ligne (exemple):', data[1]);
          }
          setPreview(data.slice(0, 5)); // Afficher les 5 premières lignes
        } catch (err) {
          console.error('[handleFileChange] Erreur lors du parsing:', err);
          setError('Erreur lors de la lecture du fichier CSV');
          setPreview([]);
        }
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
          console.log('[handleImport] Début du traitement du fichier CSV');
          console.log('[handleImport] Taille du fichier:', csv.length, 'caractères');

          const data = parseCSV(csv);
          console.log('[handleImport] Données parsées:', data.length, 'lignes au total');
          startImport(Math.max(data.length - 1, 0));

          if (data.length === 0) {
            throw new Error('Le fichier CSV est vide');
          }

          // En-têtes attendus (case-insensitive)
          const headers = (data[0] || []).map((h: string) => (h || '').trim());
          console.log('[handleImport] En-têtes détectés:', headers);

          // Résolution robuste des colonnes:
          // 1) priorité à l'égalité stricte (lowercased)
          // 2) sinon, fuzzy bornée avec frontières (délimiteurs espace/underscore/tiret)
          // 3) possibilité d'exclure certains headers contenant un motif (ex: éviter que "parent_name" matche "name")
          const hIndex = (keys: string[], opts?: { excludeContains?: string[] }) => {
            const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // exact match
            for (let i = 0; i < headers.length; i++) {
              const hLower = headers[i].toLowerCase();
              for (const k of keys) {
                if (hLower === k) return i;
              }
            }
            // bounded fuzzy with exclusions
            for (let i = 0; i < headers.length; i++) {
              const hLower = headers[i].toLowerCase();
              if (opts?.excludeContains && opts.excludeContains.some(ex => hLower.includes(ex))) continue;
              for (const k of keys) {
                const re = new RegExp(`(^|[ _-])${escape(k)}($|[ _-])`);
                if (re.test(hLower)) return i;
              }
            }
            return -1;
          };

          const idxParentSku = hIndex(['parent_sku', 'parent sku']);
          const idxParentName = hIndex(['parent_name', 'parent name']); // informatif
          const idxChildSku = hIndex(['child_sku', 'child sku', 'sku_enfant', 'sku enfant']);
          // IMPORTANT: exclure tout header contenant "parent_" ou "parent " pour éviter le mauvais mapping
          const idxChildName = hIndex(['child_name', 'child name', 'name', 'nom'], { excludeContains: ['parent_', 'parent '] });
          const idxDesc = hIndex(['description', 'desc']);
          const idxCatType = hIndex(['category_type', 'type']);
          const idxCatBrand = hIndex(['category_brand', 'brand', 'marque']);
          const idxCatModel = hIndex(['category_model', 'model', 'modèle', 'modele']);

          if (idxChildSku === -1) {
            throw new Error('Colonne "child_sku" manquante.');
          }

          // Caches
          const parentCache: Record<string, any> = {};
          const categoryCache: Record<string, string> = {}; // key: TYPE|BRAND|MODEL -> id

          const resolveParentBySku = async (skuUpper: string) => {
            if (!skuUpper) return null;
            if (parentCache[skuUpper]) return parentCache[skuUpper];
            const { data: found } = await supabase
              .from('products')
              .select('id, sku, name, parent_id')
              .ilike('sku', skuUpper)
              .maybeSingle();
            if (!found) {
              parentCache[skuUpper] = null;
              return null;
            }
            // remonter au parent racine si nécessaire
            let root: any = found;
            while (root && root.parent_id) {
              const { data: next } = await supabase
                .from('products')
                .select('id, sku, name, parent_id')
                .eq('id', root.parent_id as any)
                .maybeSingle();
              if (!next) break;
              root = next;
            }
            parentCache[skuUpper] = root;
            return root;
          };

          const resolveCategoryId = async (type: string, brand: string, model: string): Promise<string | null> => {
            const key = `${type}|${brand}|${model}`;
            if (categoryCache[key]) return categoryCache[key];
            try {
              const cat = await addCategory({
                type,
                brand,
                model
              });
              const id = (cat as any)?.id ?? null;
              if (id) categoryCache[key] = id;
              return id;
            } catch (e) {
              console.warn('[handleImport] addCategory failed, trying direct lookup', e);
              const { data } = await supabase
                .from('product_categories')
                .select('id')
                .eq('type', type as any)
                .eq('brand', brand as any)
                .eq('model', model as any)
                .maybeSingle();
              const id = (data as any)?.id ?? null;
              if (id) categoryCache[key] = id;
              return id;
            }
          };

          const results = { created: 0, updated: 0, rejected: 0 };
          const rejections: string[] = [];

          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.every(c => (c || '').trim() === '')) {
              console.log(`[handleImport] Ligne ${i}: vide -> ignorée`);
              continue;
            }

            const parentSkuRaw = idxParentSku !== -1 ? (row[idxParentSku] || '') : '';
            const childSkuRaw = (row[idxChildSku] || '');
            const childNameRaw = idxChildName !== -1 ? (row[idxChildName] || '') : '';
            const descRaw = idxDesc !== -1 ? (row[idxDesc] || '') : '';
            const catTypeRaw = idxCatType !== -1 ? (row[idxCatType] || '') : '';
            const catBrandRaw = idxCatBrand !== -1 ? (row[idxCatBrand] || '') : '';
            const catModelRaw = idxCatModel !== -1 ? (row[idxCatModel] || '') : '';

            const parentSku = parentSkuRaw.toString().trim().toUpperCase();
            const childSku = childSkuRaw.toString().trim().toUpperCase();
            const childName = childNameRaw.toString().trim();
            const description = descRaw.toString().trim();
            const catType = catTypeRaw.toString().trim().toUpperCase();
            const catBrand = catBrandRaw.toString().trim().toUpperCase();
            const catModel = catModelRaw.toString().trim().toUpperCase();

            if (!childSku) {
              rejections.push(`Ligne ${i}: child_sku manquant`);
              continue;
            }

            // Chercher un produit existant par SKU enfant
            const { data: existingChild } = await supabase
              .from('products')
              .select('id, sku, name, mirror_of, serial_number, category_id')
              .ilike('sku', childSku)
              .maybeSingle();

            if (existingChild) {
              const existingChildAny = existingChild as any;
              // Doit être un miroir non sérialisé
              if (!(existingChildAny.mirror_of && !existingChildAny.serial_number)) {
                rejections.push(`Ligne ${i} (${childSku}): le SKU existe mais ne correspond pas à un miroir`);
                continue;
              }
              // Si parent_sku fourni, vérifier qu'il correspond au parent actuel
              if (parentSku) {
                // Récupérer le parent actuel pour comparer les SKU
                const { data: currentParent } = await supabase
                  .from('products')
                  .select('id, sku')
                  .eq('id', existingChildAny.mirror_of as any)
                  .maybeSingle();
                const currentParentSku = (((currentParent as any)?.sku || '') as string).toString().trim().toUpperCase();
                if (currentParentSku && parentSku && currentParentSku !== parentSku) {
                  rejections.push(`Ligne ${i} (${childSku}): changement de parent interdit (parent actuel ${currentParentSku} ≠ import ${parentSku})`);
                  continue;
                }
              }

              // Préparer updates autorisés
              const updates: any = {};
              if (childName) updates.name = childName;
              if (description) updates.description = description;
              if (catType && catBrand && catModel) {
                const catId = await resolveCategoryId(catType, catBrand, catModel);
                if (catId) updates.category_id = catId;
              }

              if (Object.keys(updates).length === 0) {
                console.log(`[handleImport] Ligne ${i} (${childSku}): aucune mise à jour à appliquer -> ignorée`);
              } else {
                const { error: upErr } = await supabase
                  .from('products')
                  .update(updates as any)
                  .eq('id', (existingChildAny as any).id as any);
                if (upErr) {
                  rejections.push(`Ligne ${i} (${childSku}): erreur update (${upErr.message})`);
                  continue;
                }
                results.updated += 1;
              }
              continue;
            }

            // Création d'un nouveau miroir
            if (!parentSku) {
              rejections.push(`Ligne ${i} (${childSku}): parent_sku requis pour créer un nouveau miroir`);
              continue;
            }
            if (!childName) {
              rejections.push(`Ligne ${i} (${childSku}): child_name requis pour créer un nouveau miroir`);
              continue;
            }

            const parent = await resolveParentBySku(parentSku);
            if (!parent) {
              rejections.push(`Ligne ${i} (${childSku}): parent_sku introuvable (${parentSku})`);
              continue;
            }

            // Construire le payload de création (héritage du parent)
            let categoryId: string | null = parent.category_id ?? null;
            if (catType && catBrand && catModel) {
              const catId = await resolveCategoryId(catType, catBrand, catModel);
              categoryId = catId ?? categoryId;
            }

            const payload: any = {
              name: childName,
              sku: childSku,
              description: description || parent.description || null,
              purchase_price_with_fees: parent.purchase_price_with_fees,
              raw_purchase_price: parent.raw_purchase_price,
              retail_price: parent.retail_price,
              pro_price: parent.pro_price,
              stock_alert: parent.stock_alert,
              location: parent.location,
              vat_type: parent.vat_type,
              margin_percent: parent.margin_percent,
              margin_value: parent.margin_value,
              pro_margin_percent: parent.pro_margin_percent,
              pro_margin_value: parent.pro_margin_value,
              weight_grams: parent.weight_grams,
              ean: parent.ean,
              width_cm: parent.width_cm,
              height_cm: parent.height_cm,
              depth_cm: parent.depth_cm,
              category_id: categoryId,
              images: parent.images,
              variants: parent.variants,
              shipping_box_id: parent.shipping_box_id,
              serial_number: null,
              mirror_of: parent.id
            };

            const { error: insertErr } = await supabase
              .from('products')
              .insert([payload as any])
              .select('id')
              .single();

            if (insertErr) {
              rejections.push(`Ligne ${i} (${childSku}): erreur création (${insertErr.message})`);
              continue;
            }
            results.created += 1;
          }

          // Récapitulatif
          const summary = `Import terminé: ${results.created} créé(s), ${results.updated} mis à jour, ${rejections.length} rejet(s).`;
          console.log('[handleImport]', summary);
          if (rejections.length > 0) {
            console.warn('[handleImport] Rejets:', rejections);
          }
          if (rejections.length > 0) {
            setError([summary, ...rejections.slice(0, 10)].join('\n')); // afficher un aperçu des rejets
            setImportError([{ line: 0, message: summary }, ...rejections.map((m, idx) => ({ line: idx + 2, message: m }))]);
          } else {
            setError(null);
            setImportSuccess(summary);
          }
          onSuccess();
        } catch (err) {
          console.error('[handleImport] Erreur lors du traitement:', err);
          setError(err instanceof Error ? err.message : 'Erreur lors du traitement du fichier CSV');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('[handleImport] Erreur générale:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import des produits miroirs');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
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
            <strong>Format attendu :</strong> parent_sku, parent_name, child_sku, child_name, description, category_type, category_brand, category_model
          </p>
          <p className="text-sm text-blue-600">
            Les cellules contenant des virgules doivent être encapsulées par des guillemets
          </p>
          <p className="text-sm text-blue-600">
            Produit parent actuel : {parentProduct.name}
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
              type="button"
              onClick={handleDownloadMirrorCSV}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Modèle CSV
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

          <ImportDialog
            isOpen={importState.isDialogOpen}
            onClose={closeDialog}
            current={importState.current}
            total={importState.total}
            status={importState.status}
            errors={importState.errors}
            successMessage={importState.successMessage}
          />
        </div>
      </div>
    </div>
  );
};
