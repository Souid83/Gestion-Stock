import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Package } from 'lucide-react';
import { useCategoryStore } from '../../store/categoryStore';
import { useProductStore } from '../../store/productStore';
import { supabase } from '../../lib/supabase';

interface MirrorChildEditModalProps {
  isOpen: boolean;
  child: any; // miroir enfant (products row)
  parent?: any | null; // parent préchargé (facultatif)
  onClose: () => void;
  onUpdated: () => void;
  onOpenParentStock: (parentId: string) => void;
  onOpenParentEdit: (parentId: string) => void;
}

export const MirrorChildEditModal: React.FC<MirrorChildEditModalProps> = ({
  isOpen,
  child,
  parent,
  onClose,
  onUpdated,
  onOpenParentStock,
  onOpenParentEdit
}) => {
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const { updateProduct } = useProductStore();

  const [loading, setLoading] = useState(false);
  const [parentInfo, setParentInfo] = useState<any | null>(parent ?? null);
  const [name, setName] = useState(child?.name ?? '');
  const [sku, setSku] = useState(child?.sku ?? '');
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState({
    type: child?.category?.type || '',
    brand: child?.category?.brand || '',
    model: child?.category?.model || ''
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setName(child?.name ?? '');
    setSku(child?.sku ?? '');
    setSelectedCategory({
      type: child?.category?.type || '',
      brand: child?.category?.brand || '',
      model: child?.category?.model || ''
    });
  }, [child]);

  // Précharger le parent (avec stocks) si absent
  useEffect(() => {
    const loadParent = async () => {
      try {
        if (parent) {
          setParentInfo(parent);
          return;
        }
        if (!child?.parent_id) return;
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            stocks:stock_produit (
              quantite,
              stock:stocks (
                name
              )
            )
          `)
          .eq('id', child.parent_id as any)
          .maybeSingle();
        if (!error) setParentInfo(data);
      } catch (e) {
        // ignore
      }
    };
    loadParent();
  }, [child?.parent_id, parent]);

  const uniqueTypes = useMemo(() => Array.from(new Set(categories.map(c => c.type))).sort(), [categories]);
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
    const upperValue = value.toUpperCase();
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

  const parentTotalStock = useMemo(() => {
    if (!parentInfo?.stocks) return 0;
    return (parentInfo.stocks || []).reduce((sum: number, s: any) => sum + (s.quantite || 0), 0);
  }, [parentInfo]);

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!name || !sku) {
        setError('Nom et SKU sont obligatoires.');
        setLoading(false);
        return;
      }
      if (!selectedCategory.type || !selectedCategory.brand || !selectedCategory.model) {
        setError('Tous les champs de catégorie sont obligatoires.');
        setLoading(false);
        return;
      }

      // Créer/trouver la catégorie
      let categoryId: string | null = null;
      try {
        const cat = await addCategory({
          type: selectedCategory.type,
          brand: selectedCategory.brand,
          model: selectedCategory.model
        });
        categoryId = cat?.id ?? null;
      } catch (e) {
        // même si la création échoue, on n'empêche pas l'update du reste
      }

      await updateProduct(child.id, {
        name,
        sku,
        category_id: categoryId ?? child.category_id
      });

      setLoading(false);
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to update mirror child:', e);
      setError('Une erreur est survenue lors de la sauvegarde.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Modifier le miroir enfant</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{error}</div>
        )}

        <div className="space-y-4">
          {/* Identité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nom du miroir"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="SKU du miroir"
              />
            </div>
          </div>

          {/* Catégorie */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Catégorie</h3>
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
                <select
                  value={selectedCategory.model}
                  onChange={(e) => handleCategoryChange('model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  disabled={!selectedCategory.brand}
                >
                  <option value="">Sélectionner</option>
                  {filteredModels.map(model => (<option key={model} value={model}>{model}</option>))}
                </select>
              </div>
            </div>
          </div>

          {/* Stock parent (lecture seule) */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-blue-900">Stock parent (lecture seule)</h3>
              <div className="flex gap-2">
                {parentInfo?.id && (
                  <>
                    <button
                      onClick={() => onOpenParentStock(parentInfo.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Gérer le stock parent
                    </button>
                    <button
                      onClick={() => onOpenParentEdit(parentInfo.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                    >
                      Modifier autres champs (parent)
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2">
              {parentInfo ? (
                <div className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <Package size={16} className="text-blue-700" />
                    <span className="text-blue-900 font-semibold">{parentTotalStock}</span>
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {(parentInfo.stocks || []).map((s: any, idx: number) => (
                      <div key={(s.stock && s.stock.id) || s.stock_id || idx} className="text-xs text-blue-700">
                        {s.stock?.name} ({s.quantite})
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-blue-800">Chargement du stock parent…</div>
              )}
            </div>
          </div>

          {/* Aperçu parent (optionnel) */}
          {parentInfo && (
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="flex items-center gap-3">
                {parentInfo.images?.[0] ? (
                  <img
                    src={parentInfo.images[0]}
                    alt={parentInfo.name}
                    className="w-12 h-12 object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/48?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon size={24} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">{parentInfo.name}</div>
                  <div className="text-xs text-gray-500">{parentInfo.sku}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MirrorChildEditModal;
