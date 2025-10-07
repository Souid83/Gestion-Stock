import React, { useState, useEffect } from 'react';
import { Edit, Trash2, AlertCircle, Image as ImageIcon, Plus, Package, Eye, ChevronDown, ChevronUp, Battery, Users, ExternalLink, PackagePlus, Pen } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { useLotStore } from '../../store/lotStore';
import { ProductForm } from './ProductForm';
import { useNavigate } from '../../hooks/useNavigate';
import { StockManager } from './StockManager';
import { SerialProductFormModal } from './SerialProductFormModal';
import { EditSerialProductForm } from './EditSerialProductForm';
import { MirrorProductModal } from './MirrorProductModal';
import { LotModal } from '../Lots/LotModal';
import { supabase } from '../../lib/supabase';
import type { ProductWithStock } from '../../types/supabase';
import type { LotWithComponents } from '../../types/lots';
import type { Database } from '../../types/supabase-generated';

type Product = Database['public']['Tables']['products']['Row'] & {
  // Champs additionnels pour la gestion enfant/parent et l'affichage
  parent_id?: string | null | undefined;
  serial_number?: string | null;
  purchase_price_with_fees?: number | null;
  retail_price?: number | null;
  pro_price?: number | null;
  battery_level?: number | null;
  supplier?: string | null;
  product_note?: string | null;
  stock_total?: number | null;
  location?: string | null;
  category?: {
    type: string;
    brand: string;
    model: string;
  } | null;
  stocks?: {
    id: string;
    name: string;
    quantite: number;
    group?: {
      name: string;
      synchronizable: boolean;
    };
  }[];
};

interface ProductListProps {
  products: Product[];
  lots?: LotWithComponents[];
}

const TVA_RATE = 0.20;

export const ProductList: React.FC<ProductListProps> = ({ products: initialProducts, lots = [] }) => {
  const { isLoading, error, deleteProduct, fetchProducts } = useProductStore();
  const { fetchLots, deleteLot } = useLotStore();
  const { navigateToProduct } = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [showImageManager, setShowImageManager] = useState(false);
  const [managingStockProduct, setManagingStockProduct] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedParentForChild, setExpandedParentForChild] = useState<Set<string>>(new Set());
  const [expandedParentForMirror, setExpandedParentForMirror] = useState<Set<string>>(new Set());
  const [parentForMirror, setParentForMirror] = useState<Record<string, Product | null>>({});
  const [childProducts, setChildProducts] = useState<Record<string, Product[]>>({});
  // Stocke les marges % enregistrées pour chaque enfant (id enfant => { marge_percent, pro_marge_percent })
  const [childMargins, setChildMargins] = useState<Record<string, { marge_percent: number | null, pro_marge_percent: number | null }>>({});
  // État pour l'édition d'un produit enfant (numéro de série)
  const [editingSerialProduct, setEditingSerialProduct] = useState<Product | null>(null);
  const [showSerialProductFormModal, setShowSerialProductFormModal] = useState(false);
  const [stocks, setStocks] = useState<any[]>([]);
  // États pour les produits miroirs
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [selectedMirrorParent, setSelectedMirrorParent] = useState<ProductWithStock | null>(null);
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PAU' | 'PAM'>('ALL');

  // Filtrer les produits pour n'afficher que les parents (sans parent_id)
  // Charger la liste des stocks pour le modal
  useEffect(() => {
    const fetchStocks = async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          id,
          name,
          group:stock_groups (
            name,
            synchronizable
          )
        `)
        .order('name');
      if (!error && data) setStocks(data as any[]);
    };
    fetchStocks();
  }, []);

  useEffect(() => {
    const filteredProducts = initialProducts.filter(p => !p.serial_number);
    setProducts(filteredProducts as any);
  }, [initialProducts]);

  useEffect(() => {
    const subscription = supabase
      .channel('stock_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'stock_produit'
        },
        async () => {
          const updatedProducts = await fetchProducts();
          if (updatedProducts) {
            // Afficher parents et miroirs (exclure les sérialisés)
            const listProducts = updatedProducts.filter(p => !p.serial_number);
            setProducts(listProducts as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchProducts]);

  // Vérifier quels produits ont des enfants et précharger ces enfants
  useEffect(() => {
    const checkForChildProducts = async () => {
      for (const product of products) {
        try {
          const { data, count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact' })
            .eq('parent_id', product.id as any);

          if (error) throw error;

          if (count && count > 0 && data) {
            setChildProducts(prev => ({
              ...prev,
              [product.id]: (data as unknown as Product[]) || []
            }));

            // Récupérer les marges % enregistrées pour chaque enfant
            const childIds = data.map((child: any) => child.id);
            if (childIds.length > 0) {
              const { data: marginsData, error: marginsError } = await supabase
                .from('serial_product_margin_last')
                .select('serial_product_id, marge_percent, pro_marge_percent')
                .in('serial_product_id', childIds);

              if (!marginsError && marginsData) {
                const marginsMap: Record<string, { marge_percent: number | null, pro_marge_percent: number | null }> = {};
                for (const m of marginsData as any[]) {
                  marginsMap[m.serial_product_id] = {
                    marge_percent: m.marge_percent ?? null,
                    pro_marge_percent: m.pro_marge_percent ?? null,
                  };
                }
                setChildMargins(prev => ({
                  ...prev,
                  ...marginsMap
                }));
              }
            }
          }
        } catch (err) {
          console.error(`Error checking children for product ${product.id}:`, err);
        }
      }
    };

    checkForChildProducts();
  }, [products]);

  const calculateTTC = (priceHT: number) => {
    return priceHT * (1 + TVA_RATE);
  };

  const calculateMargin = (purchasePrice: number, sellingPrice: number) => {
    if (!purchasePrice || !sellingPrice) return 0;
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setShowDeleteConfirm(null);
      setSelectedProducts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedProducts) {
        await deleteProduct(id);
      }
      setSelectedProducts(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting products:', error);
    }
  };

  const handleEditWithImages = (productId: string) => {
    setEditingProduct(productId);
    setShowImageManager(true);
  };

  const handleStockUpdate = async () => {
    const updatedProducts = await fetchProducts();
    if (updatedProducts) {
      // Afficher parents et miroirs (exclure les sérialisés)
      const listProducts = updatedProducts.filter(p => !p.serial_number);
      setProducts(listProducts as any);
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
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
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const openMirrorModalFor = async (p: Product) => {
    try {
      let parentRef: any = null;
      if (p.parent_id) {
        const inList = products.find(pr => pr.id === p.parent_id);
        if (inList) {
          parentRef = inList;
        } else {
          const { data } = await supabase
            .from('products')
            .select('*')
            .eq('id', p.parent_id as any)
            .maybeSingle();
          if (data) parentRef = data as any;
        }
      } else {
        parentRef = p;
      }
      if (parentRef) {
        setSelectedMirrorParent(parentRef as any);
        setShowMirrorModal(true);
      }
    } catch (err) {
      console.error('Error opening mirror modal:', err);
    }
  };

  const canCreateLot = (product: Product): boolean => {
    // Lots uniquement pour produits à prix d'achat unique (PAU)
    return !product.parent_id && product.product_type === 'PAU';
  };

  const handleCreateLot = (product: Product) => {
    console.log('Create lot for product:', product.id);
    setSelectedProduct(product as any);
    setIsLotModalOpen(true);
  };

  const handleLotModalClose = () => {
    setIsLotModalOpen(false);
    setSelectedProduct(null);
    setEditingLotId(null);
    fetchLots(); // Refresh lots list
  };

  const toggleExpandProduct = async (productId: string) => {
    console.log('Toggling expand for product:', productId);
    
    if (expandedProducts.has(productId)) {
      // Si déjà développé, réduire
      setExpandedProducts(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    } else {
      // Si pas développé, développer et charger les enfants si nécessaire
      setExpandedProducts(prev => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
      
      // Charger les enfants si pas déjà chargés
      if (!childProducts[productId] || childProducts[productId].length === 0) {
        try {
          console.log('Fetching child products for:', productId);
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('parent_id', productId as any);
            
          if (error) throw error;
          console.log('Child products fetched:', data);
          
          setChildProducts(prev => ({
            ...prev,
            [productId]: (data as unknown as Product[]) || []
          }));
        } catch (err) {
          console.error('Error fetching child products:', err);
        }
      }
    }
  };

  const hasChildProducts = (productId: string): boolean => {
    return !!childProducts[productId] && childProducts[productId].length > 0;
  };
  const hasMirrorChildren = (productId: string): boolean => {
    const children = childProducts[productId] || [];
    return children.some((c: any) => !c.serial_number && !!c.parent_id);
  };
  const hasSerialChildren = (productId: string): boolean => {
    const children = childProducts[productId] || [];
    return children.some((c: any) => !!c.serial_number);
  };

  // Combine products and lots for display
  const displayedProducts = typeFilter === 'ALL'
    ? products
    : products.filter((p: Product) => !p.parent_id && p.product_type === typeFilter);
  const allItems = [
    ...displayedProducts.map(p => ({ ...p, itemType: 'product' as const })),
    ...lots.map(l => {
      // Independent margins for lots:
      // - Compute retail (magasin) from margin_retail_percent if present, otherwise derive from DB values
      // - Compute pro from margin_pro_percent if present, otherwise fall back to retail percent
      const base = l.purchase_price_ht || 0;
      const derivedRetailPct =
        base > 0
          ? (typeof l.selling_price_ht === 'number' && l.selling_price_ht > 0
              ? ((l.selling_price_ht - base) / base) * 100
              : 0)
          : 0;
      const retailPct = (l as any).margin_retail_percent ?? derivedRetailPct;
      const proPct = (l as any).margin_pro_percent ?? retailPct;

      const retailPrice = l.vat_type === 'margin'
        ? base + (base * (retailPct / 100)) * 1.2 // TVM when VAT on margin
        : base + base * (retailPct / 100);        // HT when normal VAT
      const proPrice = l.vat_type === 'margin'
        ? base + (base * (proPct / 100)) * 1.2    // TVM when VAT on margin
        : base + base * (proPct / 100);           // HT when normal VAT

      return {
        ...l,
        itemType: 'lot' as const,
        // Map lot fields to product-like structure for consistent display
        id: l.id,
        name: l.name,
        sku: l.sku,
        purchase_price_with_fees: base,
        // Use computed prices so pro/retail can differ
        retail_price: retailPrice,
        pro_price: proPrice,
        stock: l.stock,
        stock_alert: l.stock_alert,
        location: l.location,
        vat_type: l.vat_type,
        // Display percents corresponding to each price
        margin_percent: retailPct,
        pro_margin_percent: proPct,
        is_parent: false,
        serial_number: null,
        mirror_of: null
      };
    })
  ];

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <div className="bg-white rounded-lg shadow flex-1 flex min-h-0">
        <div className="relative min-h-0 overflow-x-auto overflow-y-auto overscroll-contain h-[calc(100vh-220px)]">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
            <label className="text-sm text-gray-600">Filtrer par type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PAU' | 'PAM')}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="ALL">Tous</option>
              <option value="PAU">PAU</option>
              <option value="PAM">PAM</option>
            </select>
          </div>
          <table className="w-full table-auto divide-y divide-gray-200">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-start gap-1">
                      <label className="text-xs font-medium text-gray-500">Sélecteur</label>
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    {selectedProducts.size > 0 && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        <Trash2 size={16} />
                        Supprimer ({selectedProducts.size})
                      </button>
                    )}
                  </div>
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Type
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Image
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  SKU
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Nom
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Prix d'achat (HT/TVM)
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Prix vente pro
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Prix vente magasin
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Stock
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Alerte stock
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Emplacement
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allItems.length > 0 ? (
                allItems.map((item) => {
                  if (item.itemType === 'lot') {
                    return (<>
                      <tr key={`${item.itemType}-${item.id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(item.id)}
                            onChange={() => handleSelectProduct(item.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(item as any).type === 'compose' ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              LOT COMPOSÉ
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              LOT SIMPLE
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-12 w-12 bg-purple-200 rounded-lg flex items-center justify-center">
                            <PackagePlus size={20} className="text-purple-600" />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.sku}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{(item.purchase_price_with_fees || 0).toFixed(2)} €</div>
                          <div className="text-xs text-gray-500">{item.vat_type === 'margin' ? 'TVM' : 'HT'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.vat_type === 'margin' ? (
                            <span>
                              <span className="font-medium">
                                {(item.pro_price || 0).toFixed(2)} € TVM
                              </span>
                              <span
                                className={
                                  "ml-1 " +
                                  (((item as any).pro_margin_percent ?? 0) < 8
                                    ? "text-red-600"
                                    : ((item as any).pro_margin_percent ?? 0) <= 18
                                      ? "text-yellow-500"
                                      : "text-green-600")
                                }
                              >
                                ({(((item as any).pro_margin_percent ?? 0)).toFixed(1)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="flex flex-col">
                              <span>
                                <span className="font-medium">
                                  {((item.pro_price || 0) * 1.2).toFixed(2)} € TTC
                                </span>
                                <span
                                  className={
                                    "ml-1 " +
                                    (((item as any).pro_margin_percent ?? 0) < 8
                                      ? "text-red-600"
                                      : ((item as any).pro_margin_percent ?? 0) <= 18
                                        ? "text-yellow-500"
                                        : "text-green-600")
                                  }
                                >
                                  ({(((item as any).pro_margin_percent ?? 0)).toFixed(1)}%)
                                </span>
                              </span>
                              <span className="text-xs text-gray-500">
                                {(item.pro_price || 0).toFixed(2)} € HT
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.vat_type === 'margin' ? (
                            <span>
                              <span className="font-medium">
                                {(item.retail_price || 0).toFixed(2)} € TVM
                              </span>
                              <span
                                className={
                                  "ml-1 " +
                                  ((item.margin_percent ?? 0) < 20
                                    ? "text-red-600"
                                    : (item.margin_percent ?? 0) <= 25
                                      ? "text-yellow-500"
                                      : "text-green-600")
                                }
                              >
                                ({(item.margin_percent ?? 0).toFixed(1)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="flex flex-col">
                              <span>
                                <span className="font-medium">
                                  {((item.retail_price || 0) * 1.2).toFixed(2)} € TTC
                                </span>
                                <span
                                  className={
                                    "ml-1 " +
                                    ((item.margin_percent ?? 0) < 20
                                      ? "text-red-600"
                                      : (item.margin_percent ?? 0) <= 25
                                        ? "text-yellow-500"
                                        : "text-green-600")
                                  }
                                >
                                  ({(item.margin_percent ?? 0).toFixed(1)}%)
                                </span>
                              </span>
                              <span className="text-xs text-gray-500">
                                {(item.retail_price || 0).toFixed(2)} € HT
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const alertVal = (item as any).stock_alert ?? null;
                            const isLow = alertVal !== null && (item.stock ?? 0) <= alertVal;
                            const iconColor = isLow ? "text-red-600" : "text-gray-500";
                            return (
                              <span className="flex items-center gap-2 text-sm">
                                <Package size={16} className={iconColor} />
                                <span className="text-gray-900">{item.stock || 0}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.stock_alert ?? '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.location ?? '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingLotId(item.id as string);
                                setIsLotModalOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Modifier le lot"
                            >
                              <Edit size={18} />
                            </button>
                            
                            <button
                              onClick={async () => {
                                if (window.confirm('Supprimer ce lot ?')) {
                                  try {
                                    await deleteLot(item.id as string);
                                    await fetchLots();
                                  } catch (e) {
                                    console.error('Erreur suppression lot:', e);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer le lot"
                            >
                              <Trash2 size={18} />
                            </button>
                            
                            {(item as any).type === 'compose' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedLots(prev => {
                                    const next = new Set(prev);
                                    const id = item.id as string;
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                  });
                                }}
                                className="text-purple-600 hover:text-purple-900"
                                title={expandedLots.has(item.id as string) ? 'Masquer les composants' : 'Voir les composants'}
                              >
                                <Eye size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {(item as any).type === 'compose' && expandedLots.has(item.id as string) && (
                        <tr className="bg-gray-50">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="pl-8">
                              <h4 className="font-medium text-gray-700 mb-2">Composants du lot</h4>
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stock dispo</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantité</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Dépôts</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(((item as any).components || []).length > 0) ? (
                                    ((item as any).components || []).map((c: any) => (
                                      <tr key={c.id}>
                                        <td className="px-4 py-2 text-sm">{c.product_name}</td>
                                        <td className="px-4 py-2 text-sm">{c.product_sku}</td>
                                        <td className="px-4 py-2 text-sm">{c.product_stock}</td>
                                        <td className="px-4 py-2 text-sm">{c.quantity}</td>
                                        <td className="px-4 py-2 text-sm">
                                          {(() => {
                                            // Map depot IDs to names; hide raw IDs like "10" if no mapping found
                                            const names = Array.isArray(c.depots_utilises)
                                              ? c.depots_utilises
                                                  .map((id: any) => {
                                                    const s = (stocks as any[]).find((st: any) => String(st.id) === String(id));
                                                    return s?.name || null;
                                                  })
                                                  .filter(Boolean)
                                              : [];
                                            return names.length > 0 ? (names as string[]).join(', ') : '-';
                                          })()}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={5} className="px-4 py-2 text-center text-gray-500 text-sm">Aucun composant</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>);
                  }

                  // Product row
                  const product = item as Product & { itemType: 'product' };
                  const purchasePrice = product.purchase_price_with_fees || 0;
                  const retailPrice = product.retail_price || 0;
                  const proPrice = product.pro_price || 0;
                  const retailMargin = calculateMargin(purchasePrice, retailPrice);
                  const proMargin = calculateMargin(purchasePrice, proPrice);
                  const alertVal = product.stock_alert ?? null;
                  const isLowStock = alertVal !== null && (product.stock_total ?? 0) <= alertVal;
                  const totalStock = (product.stocks || []).reduce((sum, s: any) => sum + (s.quantite || 0), 0);
                  const hasChildren = hasChildProducts(product.id);
                  const isExpanded = expandedProducts.has(product.id);
                  const parentInline = parentForMirror[product.id] as any;
                  const showParentInline = !!(product.parent_id && expandedParentForMirror.has(product.id) && parentInline);
                  const parentTotalStock = showParentInline ? (parentInline?.stocks || []).reduce((sum: number, s: any) => sum + (s.quantite || 0), 0) : 0;
                  const parentAlertVal = showParentInline ? (parentInline?.stock_alert ?? null) : null;
                  const parentIsLowStock = showParentInline ? (parentAlertVal !== null && (parentInline?.stock_total ?? parentTotalStock) <= parentAlertVal) : false;

                  return (
                    <React.Fragment key={product.id}>
                      <tr className={`${isLowStock ? 'bg-red-50' : ''} ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.parent_id ? (
                            <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                              MIROIR
                            </span>
                          ) : product.product_type === 'PAM' ? (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                              PAM
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              PAU
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="relative group">
                            {product.images?.[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
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
                            <button
                              onClick={() => handleEditWithImages(product.id)}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-blue-500 text-white rounded-full p-1 shadow-lg hover:bg-blue-600"
                              title="Modifier les images"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-2">
                            <span className="text-sm font-medium text-gray-900">{product.sku}</span>
                            {product.parent_id ? (
                              !product.serial_number ? (
                                // ENFANT MIROIR: boutons réservés aux miroirs
                                <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    (async () => {
                                      if (expandedParentForMirror.has(product.id)) {
                                        setExpandedParentForMirror(prev => {
                                          const next = new Set(prev);
                                          next.delete(product.id);
                                          return next;
                                        });
                                      } else {
                                        let parentRef: any = products.find(pr => pr.id === product.parent_id) || null;
                                        if (!parentRef) {
                                          const { data } = await supabase
                                            .from('products')
                                            .select('*')
                                            .eq('id', product.parent_id as any)
                                            .maybeSingle();
                                          parentRef = data || null;
                                        }
                                        setParentForMirror(prev => ({ ...prev, [product.id]: parentRef as any }));
                                        setExpandedParentForMirror(prev => {
                                          const next = new Set(prev);
                                          next.add(product.id);
                                          return next;
                                        });
                                      }
                                    })();
                                  }}
                                  className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                                  title="Voir le parent"
                                >
                                  <ExternalLink size={12} />
                                  Voir parent
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    // Développer le parent pour afficher ses miroirs
                                    toggleExpandProduct(product.parent_id as string);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                  title="Voir autres miroirs"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  Voir autres miroirs
                                </button>
                              </div>
                            ) : null
                            ) : (
                              // PRODUIT RACINE: afficher soit "Voir numéros de série" soit "Voir miroirs" (pas les deux)
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const hasSerial = hasSerialChildren(product.id);
                                  const hasMirror = hasMirrorChildren(product.id);
                                  if (hasSerial) {
                                    return (
                                      <button
                                        onClick={() => toggleExpandProduct(product.id)}
                                        className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                                        title="Voir numéros de série"
                                      >
                                        <ExternalLink size={12} />
                                        Voir numéros de série
                                      </button>
                                    );
                                  }
                                  if (hasMirror) {
                                    return (
                                      <button
                                        onClick={() => toggleExpandProduct(product.id)}
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                        title="Voir miroirs"
                                      >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        Voir miroirs
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => {
                            const children = (childProducts[product.id] || []).filter((c: any) => !!c.serial_number);
                            if (children.length === 0) {
                              return <span>{purchasePrice.toFixed(2)} € {product.vat_type === "margin" ? "TVM" : "HT"}</span>;
                            }
                            // Grouper par type de TVA
                            const tvaGroups: Record<string, { achat: number, count: number }> = {};
                            children.forEach(child => {
                              const tva = child.vat_type === "margin" ? "TVM" : "TTC";
                              if (!tvaGroups[tva]) tvaGroups[tva] = { achat: 0, count: 0 };
                              tvaGroups[tva].achat += child.purchase_price_with_fees ?? 0;
                              tvaGroups[tva].count += 1;
                            });
                            return (
                              <div className="flex flex-col gap-1 text-xs">
                                {["TTC", "TVM"].map(tva => tvaGroups[tva]).map((vals, idx) => {
                                  const isTVM = idx !== 0;
                                  if (!vals) return null;
                                  const achat = vals.achat / vals.count;
                                  // Correction : afficher "HT" pour TVA normale, "TVM" pour marge
                                  const keyStr = idx === 0 ? "TTC" : "TVM";
                                  const tvaLabel = isTVM ? "TVM" : "HT";
                                  return (
                                    <span key={keyStr}>
                                      <span className="font-bold text-gray-900">{achat.toFixed(2)} € {tvaLabel}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Prix vente pro pondéré par type de TVA */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const children = (childProducts[product.id] || []).filter((c: any) => !!c.serial_number);
                            if (children.length === 0) {
                              // Affichage pour produit à prix d'achat unique
                              if (product.vat_type === "margin") {
                                // TVA sur marge : afficher XX.XX € TVM (YY%)
                                let color = "text-blue-600";
                                const proMarginPercent = product.pro_margin_percent ?? 0;
                                if (proMarginPercent < 8) color = "text-red-600";
                                else if (proMarginPercent >= 8 && proMarginPercent <= 18) color = "text-yellow-500";
                                else if (proMarginPercent > 18) color = "text-green-600";
                                return (
                                  <span>
                                    <span className="font-bold text-blue-600">{proPrice.toFixed(2)} € TVM</span>
                                    <span className={`ml-1 ${color}`}>({proMarginPercent.toFixed(1)}%)</span>
                                  </span>
                                );
                              } else {
                                // TVA normale : affichage classique
                                let color = "text-gray-500";
                                const proMarginPercent = product.pro_margin_percent ?? 0;
                                if (proMarginPercent < 8) color = "text-red-600";
                                else if (proMarginPercent >= 8 && proMarginPercent <= 18) color = "text-yellow-500";
                                else if (proMarginPercent > 18) color = "text-green-600";
                                return (
                                  <span className="flex flex-col">
                                    <span>
                                      <span className="font-bold text-gray-900">{(proPrice * 1.2).toFixed(2)} € TTC</span>
                                      <span className={`ml-1 ${color}`}>({proMarginPercent.toFixed(1)}%)</span>
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {proPrice.toFixed(2)} € HT
                                    </span>
                                  </span>
                                );
                              }
                            }
                            // Grouper par type de TVA
                            // Correction finale : pour TVA sur marge, utiliser la marge % enregistrée (champ pro_marge_percent dans childMargins)
                            const tvaGroups: Record<string, { total: number, pro: number, achat: number, count: number, pro_marge_percent_sum?: number, pro_marge_percent_count?: number }> = {};
                            children.forEach(child => {
                              const tva = child.vat_type === "margin" ? "TVM" : "TTC";
                              if (!tvaGroups[tva]) tvaGroups[tva] = { total: 0, pro: 0, achat: 0, count: 0, pro_marge_percent_sum: 0, pro_marge_percent_count: 0 };
                              tvaGroups[tva].total += 1;
                              tvaGroups[tva].pro += child.pro_price ?? 0;
                              tvaGroups[tva].achat += child.purchase_price_with_fees ?? 0;
                              tvaGroups[tva].count += 1;
                              if (tva === "TVM" && childMargins[child.id]?.pro_marge_percent !== undefined && childMargins[child.id]?.pro_marge_percent !== null) {
                                tvaGroups[tva].pro_marge_percent_sum! += childMargins[child.id].pro_marge_percent!;
                                tvaGroups[tva].pro_marge_percent_count! += 1;
                              }
                            });
                            return (
                              <div className="flex flex-col gap-1 text-xs">
                                {["TTC", "TVM"].map(tva => tvaGroups[tva]).map((vals, idx) => {
                                  const tva = idx === 0 ? "TTC" : "TVM";
                                  const isTVM = idx !== 0;
                                  if (!vals) return null;
                                  // Correction finale : pour TVA normale, utiliser le prix HT enregistré (child.pro_price / 1.2 n'est pas fiable si déjà HT)
                                  let prix = 0;
                                  let achat = 0;
                                  let marge = 0;
                                  if (isTVM) {
                                    // Affichage parent TVA marge (pro): calcul live avec la formule demandée
                                    // marge_% = ((prix_vente - prix_achat) / 1.2) / prix_achat * 100
                                    prix = vals.pro / vals.count;
                                    achat = vals.achat / vals.count;
                                    const percent = achat > 0 ? (((prix - achat) / 1.2) / achat) * 100 : 0;
                                    let color = "text-gray-500";
                                    if (percent < 8) color = "text-red-600";
                                    else if (percent >= 8 && percent <= 18) color = "text-yellow-500";
                                    else color = "text-green-600";
                                      return (
                                        <span key={tva} className="flex flex-col">
                                          <span>
                                            <span className="font-bold text-blue-600">{prix.toFixed(2)} € TVM</span>
                                            <span className={`ml-1 ${color}`}>({isFinite(percent) ? percent.toFixed(1) : "0.0"}%)</span>
                                          </span>
                                          <span className="font-bold text-blue-600">Marge Numéraire {(achat > 0 ? ((prix - achat) / 1.2) : 0).toFixed(2)} €</span>
                                        </span>
                                      );
                                  } else if (!isTVM) {
                                    // Correction : prix TTC stocké, prix HT = prix TTC / 1.2
                                    const childrenTTC = children.filter((c: any) => c.vat_type === "normal");
                                    if (childrenTTC.length > 0) {
                                      const prixTTC = childrenTTC.reduce((sum: number, c: any) => sum + (c.pro_price ?? 0), 0) / childrenTTC.length;
                                      prix = prixTTC / 1.2;
                                      achat = childrenTTC.reduce((sum: number, c: any) => sum + (c.purchase_price_with_fees ?? 0), 0) / childrenTTC.length;
                                      marge = achat > 0 ? ((prix - achat) / achat) * 100 : 0;
                                    }
                                  } else {
                                    prix = vals.pro / vals.count;
                                    achat = vals.achat / vals.count;
                                    marge = achat > 0 ? ((prix - achat) / achat) * 100 : 0;
                                  }
                                  let color = "text-gray-500";
                                  if (marge < 8) color = "text-red-600";
                                  else if (marge >= 8 && marge <= 18) color = "text-yellow-500";
                                  else if (marge > 18) color = "text-green-600";
                                  const tvaLabel = isTVM ? "TVM" : "HT";
                                  if (!isTVM) {
                                    // Afficher TTC en principal puis HT
                                    return (
                                      <span key={tva} className="flex flex-col">
                                        <span>
                                          <span className="font-bold text-gray-900">{(prix * 1.2).toFixed(2)} € TTC</span>
                                          <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {prix.toFixed(2)} € HT
                                        </span>
                                      </span>
                                    );
                                  } else if (isTVM) {
                                    // Déjà géré plus haut
                                    return null;
                                  } else {
                                    // Afficher TVM + marge (corrigé)
                                    return (
                                      <span key={tva}>
                                        <span className="font-bold text-gray-900">{prix.toFixed(2)} € TVM</span>
                                        <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                      </span>
                                    );
                                  }
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Prix vente magasin pondéré par type de TVA */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const children = (childProducts[product.id] || []).filter((c: any) => !!c.serial_number);
                            if (children.length === 0) {
                              // Affichage pour produit à prix d'achat unique
                              if (product.vat_type === "margin") {
                                // TVA sur marge : afficher XX.XX € TVM (YY%)
                                let color = "text-blue-600";
                                const retailMarginPercent = product.margin_percent ?? 0;
                                if (retailMarginPercent < 20) color = "text-red-600";
                                else if (retailMarginPercent >= 20 && retailMarginPercent <= 25) color = "text-yellow-500";
                                else if (retailMarginPercent > 25) color = "text-green-600";
                                return (
                                  <span>
                                    <span className="font-bold text-blue-600">{retailPrice.toFixed(2)} € TVM</span>
                                    <span className={`ml-1 ${color}`}>({retailMarginPercent.toFixed(1)}%)</span>
                                  </span>
                                );
                              } else {
                                // TVA normale : affichage classique
                                let color = "text-gray-500";
                                const retailMarginPercent = product.margin_percent ?? 0;
                                if (retailMarginPercent < 20) color = "text-red-600";
                                else if (retailMarginPercent >= 20 && retailMarginPercent <= 25) color = "text-yellow-500";
                                else if (retailMarginPercent > 25) color = "text-green-600";
                                return (
                                  <span className="flex flex-col">
                                    <span>
                                      <span className="font-bold text-gray-900">{(retailPrice * 1.2).toFixed(2)} € TTC</span>
                                      <span className={`ml-1 ${color}`}>({retailMarginPercent.toFixed(1)}%)</span>
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {retailPrice.toFixed(2)} € HT
                                    </span>
                                  </span>
                                );
                              }
                            }
                            // Grouper par type de TVA
                            // Correction finale : pour TVA sur marge, utiliser la marge % enregistrée (champ marge_percent dans childMargins)
                            const tvaGroups: Record<string, { total: number, mag: number, achat: number, count: number, marge_percent_sum?: number, marge_percent_count?: number }> = {};
                            children.forEach(child => {
                              const tva = child.vat_type === "margin" ? "TVM" : "TTC";
                              if (!tvaGroups[tva]) tvaGroups[tva] = { total: 0, mag: 0, achat: 0, count: 0, marge_percent_sum: 0, marge_percent_count: 0 };
                              tvaGroups[tva].total += 1;
                              tvaGroups[tva].mag += child.retail_price ?? 0;
                              tvaGroups[tva].achat += child.purchase_price_with_fees ?? 0;
                              tvaGroups[tva].count += 1;
                              if (tva === "TVM" && childMargins[child.id]?.marge_percent !== undefined && childMargins[child.id]?.marge_percent !== null) {
                                tvaGroups[tva].marge_percent_sum! += childMargins[child.id].marge_percent!;
                                tvaGroups[tva].marge_percent_count! += 1;
                              }
                            });
                            return (
                              <div className="flex flex-col gap-1 text-xs">
                                {Object.entries(tvaGroups).map(([tva, vals]) => {
                                  // Correction finale : pour TVA normale, utiliser le prix HT enregistré (child.retail_price / 1.2 n'est pas fiable si déjà HT)
                                  let prix = 0;
                                  let achat = 0;
                                  let marge = 0;
                                  if (tva === "TVM") {
                                    // Affichage parent TVA marge (magasin): calcul live avec la formule demandée
                                    // marge_% = ((prix_vente - prix_achat) / 1.2) / prix_achat * 100
                                    prix = vals.mag / vals.count;
                                    achat = vals.achat / vals.count;
                                    const percent = achat > 0 ? (((prix - achat) / 1.2) / achat) * 100 : 0;
                                    let color = "text-gray-500";
                                    if (percent < 20) color = "text-red-600";
                                    else if (percent >= 20 && percent <= 25) color = "text-yellow-500";
                                    else color = "text-green-600";
                                    return (
                                      <span key={tva} className="flex flex-col">
                                        <span>
                                          <span className="font-bold text-blue-600">{prix.toFixed(2)} € TVM</span>
                                          <span className={`ml-1 ${color}`}>({isFinite(percent) ? percent.toFixed(1) : "0.0"}%)</span>
                                        </span>
                                        <span className="font-bold text-blue-600">Marge Numéraire {(achat > 0 ? ((prix - achat) / 1.2) : 0).toFixed(2)} €</span>
                                      </span>
                                    );
                                  } else if (tva === "TTC") {
                                    // Correction : prix TTC stocké, prix HT = prix TTC / 1.2
                                    const childrenTTC = children.filter((c: any) => c.vat_type === "normal");
                                    if (childrenTTC.length > 0) {
                                      const prixTTC = childrenTTC.reduce((sum: number, c: any) => sum + (c.retail_price ?? 0), 0) / childrenTTC.length;
                                      prix = prixTTC / 1.2;
                                      achat = childrenTTC.reduce((sum: number, c: any) => sum + (c.purchase_price_with_fees ?? 0), 0) / childrenTTC.length;
                                      marge = achat > 0 ? ((prix - achat) / achat) * 100 : 0;
                                    }
                                  } else {
                                    prix = vals.mag / vals.count;
                                    achat = vals.achat / vals.count;
                                    marge = achat > 0 ? ((prix - achat) / achat) * 100 : 0;
                                  }
                                  let color = "text-gray-500";
                                  if (marge < 20) color = "text-red-600";
                                  else if (marge >= 20 && marge <= 25) color = "text-yellow-500";
                                  else if (marge > 25) color = "text-green-600";
                                  const tvaLabel = tva === "TVM" ? "TVM" : "HT";
                                  if (tva === "TTC") {
                                    // Afficher TTC en principal puis HT
                                    return (
                                      <span key={tva} className="flex flex-col">
                                        <span>
                                          <span className="font-bold text-gray-900">{(prix * 1.2).toFixed(2)} € TTC</span>
                                          <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {prix.toFixed(2)} € HT
                                        </span>
                                      </span>
                                    );
                                  } else if (tva === "TVM") {
                                    // Déjà géré plus haut
                                    return null;
                                  } else {
                                    // Afficher TVM + marge (corrigé)
                                    return (
                                      <span key={tva}>
                                        <span className="font-bold text-gray-900">{prix.toFixed(2)} € TVM</span>
                                        <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                      </span>
                                    );
                                  }
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const serialChildren = (childProducts[product.id] || []).filter((c: any) => !!c.serial_number);
                            if (serialChildren.length > 0) {
                              const normalCount = serialChildren.filter((c: any) => c.vat_type === "normal").length;
                              const marginCount = serialChildren.filter((c: any) => c.vat_type === "margin").length;
                              const aggregate = normalCount + marginCount;
                              const alertValSer = product.stock_alert ?? null;
                              const isLowSer = alertValSer !== null && aggregate <= alertValSer;
                              const iconColorSer = isLowSer ? "text-red-600" : "text-gray-500";
                              return (
                                <div className="flex flex-col gap-1">
                                  <span className="flex items-center gap-2">
                                    <Package size={16} className={iconColorSer} />
                                    <span className="text-gray-900 font-bold">{normalCount} TTC</span>
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <Package size={16} className={iconColorSer} />
                                    <span className="text-blue-600 font-bold">{marginCount} TVM</span>
                                  </span>
                                </div>
                              );
                            }
                            // Fallback for produits simples / miroirs (pas d'enfants sérialisés)
                            const alertVal = product.stock_alert ?? null;
                            const isLow = alertVal !== null && totalStock < alertVal;
                            const iconColor = isLow ? "text-red-600" : "text-gray-500";
                            return (
                              <div className="flex flex-col">
                                <span className="flex items-center gap-2">
                                  <Package size={16} className={iconColor} />
                                    <span className="text-gray-900 font-bold">{totalStock}</span>
                                </span>
                                <div className="mt-1 space-y-0.5">
                                  {(product.stocks || []).map((s: any, idx: number) => (
                                    <div key={(s.stock && s.stock.id) || s.stock_id || idx} className="text-xs text-gray-500">
                                      {s.stock?.name} ({s.quantite})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                {product.stock_alert ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                          {product.location || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingProduct(product.id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Modifier"
                            >
                              <Pen size={18} />
                            </button>
                            {/* Bouton Créer un miroir - disponible pour parents et miroirs (toujours rattaché au parent) */}
                            <button
                              onClick={async () => {
                                await openMirrorModalFor(product);
                              }}
                              className="text-green-600 hover:text-green-800"
                              title="Créer un produit miroir"
                            >
                              <Users size={18} />
                            </button>
                            {canCreateLot(product) && (
                              <button
                                type="button"
                                onClick={() => handleCreateLot(product)}
                                className="text-purple-600 hover:text-purple-900"
                                title="Créer un lot"
                              >
                                <PackagePlus size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => setShowDeleteConfirm(product.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Affichage du parent inline pour un miroir */}
                      {showParentInline && (
                        <tr className={`${parentIsLowStock ? 'bg-red-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedProducts.has(parentInline.id)}
                              onChange={() => handleSelectProduct(parentInline.id)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              PRODUIT
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="relative group">
                              {parentInline?.images?.[0] ? (
                                <img
                                  src={parentInline.images[0]}
                                  alt={parentInline.name}
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
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-2">
                              <span className="text-sm font-medium text-gray-900">{parentInline?.sku}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parentInline?.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parentInline?.vat_type === "margin"
                              ? ((parentInline?.purchase_price_with_fees ?? 0).toFixed(2) + " € TVM")
                              : ((parentInline?.purchase_price_with_fees ?? 0).toFixed(2) + " € HT")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {parentInline?.vat_type === "margin" ? (
                              <span>
                                <span className="font-bold text-blue-600">
                                  {parentInline?.pro_price !== undefined && parentInline?.pro_price !== null ? parentInline.pro_price.toFixed(2) : "-"} € TVM
                                </span>
                                <span
                                  className={
                                    "ml-1 " +
                                    (((parentInline?.pro_margin_percent ?? 0) < 8)
                                      ? "text-red-600"
                                      : ((parentInline?.pro_margin_percent ?? 0) <= 18)
                                        ? "text-yellow-500"
                                        : "text-green-600")
                                  }
                                >
                                  ({(parentInline?.pro_margin_percent ?? 0).toFixed(1)}%)
                                </span>
                              </span>
                            ) : (
                              <span className="flex flex-col">
                                <span>
                                  <span className="font-medium">
                                    {parentInline?.pro_price !== undefined && parentInline?.pro_price !== null ? (parentInline.pro_price * 1.2).toFixed(2) : "-"} € TTC
                                  </span>
                                  <span
                                    className={
                                      "ml-1 " +
                                      (((parentInline?.pro_margin_percent ?? 0) < 8)
                                        ? "text-red-600"
                                        : ((parentInline?.pro_margin_percent ?? 0) <= 18)
                                          ? "text-yellow-500"
                                          : "text-green-600")
                                    }
                                  >
                                    ({(parentInline?.pro_margin_percent ?? 0).toFixed(1)}%)
                                  </span>
                                </span>
                                <span className="text-xs text-gray-500">
                                  {parentInline?.pro_price !== undefined && parentInline?.pro_price !== null ? parentInline.pro_price.toFixed(2) : "-"} € HT
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {parentInline?.vat_type === "margin" ? (
                              <span>
                                <span className="font-bold text-blue-600">
                                  {parentInline?.retail_price !== undefined && parentInline?.retail_price !== null ? parentInline.retail_price.toFixed(2) : "-"} € TVM
                                </span>
                                <span
                                  className={
                                    "ml-1 " +
                                    (((parentInline?.margin_percent ?? 0) < 20)
                                      ? "text-red-600"
                                      : ((parentInline?.margin_percent ?? 0) <= 25)
                                        ? "text-yellow-500"
                                        : "text-green-600")
                                  }
                                >
                                  ({(parentInline?.margin_percent ?? 0).toFixed(1)}%)
                                </span>
                              </span>
                            ) : (
                              <span className="flex flex-col">
                                <span>
                                  <span className="font-medium">
                                    {parentInline?.retail_price !== undefined && parentInline?.retail_price !== null ? (parentInline.retail_price * 1.2).toFixed(2) : "-"} € TTC
                                  </span>
                                  <span
                                    className={
                                      "ml-1 " +
                                      (((parentInline?.margin_percent ?? 0) < 20)
                                        ? "text-red-600"
                                        : ((parentInline?.margin_percent ?? 0) <= 25)
                                          ? "text-yellow-500"
                                          : "text-green-600")
                                    }
                                  >
                                    ({(parentInline?.margin_percent ?? 0).toFixed(1)}%)
                                  </span>
                                </span>
                                <span className="text-xs text-gray-500">
                                  {parentInline?.retail_price !== undefined && parentInline?.retail_price !== null ? parentInline.retail_price.toFixed(2) : "-"} € HT
                                </span>
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${parentIsLowStock ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            <div className="flex flex-col">
                              <span className="flex items-center gap-2">
                                <Package size={16} />
                                <span>{parentTotalStock}</span>
                              </span>
                              <div className="mt-1 space-y-0.5">
                                {(parentInline?.stocks || []).map((s: any, idx: number) => (
                                  <div key={(s.stock && s.stock.id) || s.stock_id || idx} className="text-xs text-gray-500">
                                    {s.stock?.name} ({s.quantite})
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parentInline?.stock_alert ?? '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parentInline?.location || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingProduct(parentInline.id)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Modifier"
                              >
                                <Pen size={18} />
                              </button>
                              <button
                                onClick={async () => {
                                  await openMirrorModalFor(parentInline as any);
                                }}
                                className="text-green-600 hover:text-green-800"
                                title="Créer un produit miroir"
                              >
                                <Users size={18} />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(parentInline.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Affichage des produits enfants (numéros de série) */}
                      {isExpanded && childProducts[product.id] && childProducts[product.id].length > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="pl-8">
                              {/* Sous-tableau des miroirs enfants (distinct des numéros de série) */}
                                {(() => {
                                if (!(product.purchase_price_with_fees && !product.serial_number)) return null;
                                const children = childProducts[product.id] || [];
                                const mirrorChildren = children.filter((c: any) => !c.serial_number);
                                if (mirrorChildren.length === 0) return null;
                                return (
                                  <div className="mb-6">
                                    <h4 className="font-medium text-gray-700 mb-2">Miroirs enfants</h4>
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead>
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Image</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nom</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix d'achat</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix vente pro</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix vente magasin</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Alerte stock</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Emplacement</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {mirrorChildren.map((child: any) => {
                                          return (
                                            <React.Fragment key={child.id}>
                                              <tr className="hover:bg-gray-100">
                                            <td className="px-4 py-2">
                                              <div className="relative group">
                                                {child.images?.[0] ? (
                                                  <img
                                                    src={child.images[0]}
                                                    alt={child.name}
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
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                              <div className="flex flex-col gap-1 whitespace-normal break-all">
                                                <span className="font-medium">{child.sku}</span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm">{child.name}</td>
                                            <td className="px-4 py-2 text-sm">
                                              {child.vat_type === "margin"
                                                ? (child.purchase_price_with_fees?.toFixed(2) || '-') + " € TVM"
                                                : (child.purchase_price_with_fees?.toFixed(2) || '-') + " € HT"}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                              {child.vat_type === "margin" ? (
                                                <span>
                                                  <span className="font-medium">
                                                    {child.pro_price !== undefined && child.pro_price !== null ? child.pro_price.toFixed(2) : "-"} € TVM
                                                  </span>
                                                  <span
                                                    className={
                                                      "ml-1 " +
                                                      (((child.pro_margin_percent ?? 0) < 8)
                                                        ? "text-red-600"
                                                        : ((child.pro_margin_percent ?? 0) <= 18)
                                                          ? "text-yellow-500"
                                                          : "text-green-600")
                                                    }
                                                  >
                                                    ({(child.pro_margin_percent ?? 0).toFixed(1)}%)
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="flex flex-col">
                                                  <span>
                                                    <span className="font-medium">
                                                      {child.pro_price !== undefined && child.pro_price !== null ? (child.pro_price * 1.2).toFixed(2) : "-"} € TTC
                                                    </span>
                                                    <span
                                                      className={
                                                        "ml-1 " +
                                                        (((child.pro_margin_percent ?? 0) < 8)
                                                          ? "text-red-600"
                                                          : ((child.pro_margin_percent ?? 0) <= 18)
                                                            ? "text-yellow-500"
                                                            : "text-green-600")
                                                      }
                                                    >
                                                      ({(child.pro_margin_percent ?? 0).toFixed(1)}%)
                                                    </span>
                                                  </span>
                                                  <span className="text-xs text-gray-500">
                                                    {child.pro_price !== undefined && child.pro_price !== null ? child.pro_price.toFixed(2) : "-"} € HT
                                                  </span>
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                              {child.vat_type === "margin" ? (
                                                <span>
                                                  <span className="font-medium">
                                                    {child.retail_price !== undefined && child.retail_price !== null ? child.retail_price.toFixed(2) : "-"} € TVM
                                                  </span>
                                                  <span
                                                    className={
                                                      "ml-1 " +
                                                      (((child.margin_percent ?? 0) < 20)
                                                        ? "text-red-600"
                                                        : ((child.margin_percent ?? 0) <= 25)
                                                          ? "text-yellow-500"
                                                          : "text-green-600")
                                                    }
                                                  >
                                                    ({(child.margin_percent ?? 0).toFixed(1)}%)
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="flex flex-col">
                                                  <span>
                                                    <span className="font-medium">
                                                      {child.retail_price !== undefined && child.retail_price !== null ? (child.retail_price * 1.2).toFixed(2) : "-"} € TTC
                                                    </span>
                                                    <span
                                                      className={
                                                        "ml-1 " +
                                                        (((child.margin_percent ?? 0) < 20)
                                                          ? "text-red-600"
                                                          : ((child.margin_percent ?? 0) <= 25)
                                                            ? "text-yellow-500"
                                                            : "text-green-600")
                                                      }
                                                    >
                                                      ({(child.margin_percent ?? 0).toFixed(1)}%)
                                                    </span>
                                                  </span>
                                                  <span className="text-xs text-gray-500">
                                                    {child.retail_price !== undefined && child.retail_price !== null ? child.retail_price.toFixed(2) : "-"} € HT
                                                  </span>
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                              <div className="flex flex-col">
                                                <span className="flex items-center gap-1">
                                                  <Package size={16} className="text-gray-500" />
                                                  <span>
                                                    {(product.stocks || []).reduce((sum: number, s: any) => sum + (s.quantite || 0), 0)}
                                                  </span>
                                                </span>
                                                <div className="mt-1 space-y-0.5">
                                                  {(product.stocks || []).map((s: any, idx: number) => (
                                                    <div key={(s.stock && s.stock.id) || s.stock_id || idx} className="text-xs text-gray-500">
                                                      {s.stock?.name} ({s.quantite})
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-500">
                                              {child.stock_alert ?? '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-500">
                                              {child.location || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                              <div className="flex space-x-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    setEditingProduct(child.id);
                                                  }}
                                                  className="text-blue-600 hover:text-blue-800"
                                                  title="Modifier"
                                                >
                                                  <Edit size={18} />
                                                </button>
                                                <button
                                                  onClick={async () => {
                                                    await openMirrorModalFor(child as any);
                                                  }}
                                                  className="text-green-600 hover:text-green-800"
                                                  title="Créer un produit miroir"
                                                >
                                                  <Users size={18} />
                                                </button>
                                                <button
                                                  onClick={async () => {
                                                    if (window.confirm('Voulez-vous vraiment supprimer ce produit miroir ?')) {
                                                      try {
                                                        const { error } = await supabase
                                                          .from('products')
                                                          .delete()
                                                          .eq('id', child.id as any);
                                                        if (error) {
                                                          console.error('Erreur suppression miroir :', error);
                                                        } else {
                                                          // Rafraîchir les enfants du parent
                                                          const { data } = await supabase
                                                            .from('products')
                                                            .select('*')
                                                            .eq('parent_id', product.id as any);
                                                          setChildProducts(prev => ({
                                                            ...prev,
                                                            [product.id]: (data as unknown as Product[]) || []
                                                          }));
                                                          // Rafraîchir la liste principale (parents + miroirs, sans sérialisés)
                                                          const updatedProducts = await fetchProducts();
                                                          if (updatedProducts) {
                                                            const listProducts = updatedProducts.filter(p => !p.serial_number);
                                                            setProducts(listProducts as any);
                                                          }
                                                        }
                                                      } catch (err) {
                                                        console.error('Erreur lors de la suppression du produit miroir :', err);
                                                      }
                                                    }
                                                  }}
                                                  className="text-red-600 hover:text-red-800"
                                                  title="Supprimer"
                                                >
                                                  <Trash2 size={18} />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                          {expandedParentForChild.has(child.id) && (
                                            <tr className="bg-white">
                                              <td className="px-4 py-2">
                                                <div className="relative group">
                                                  {product.images?.[0] ? (
                                                    <img
                                                      src={product.images[0]}
                                                      alt={product.name}
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
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 text-sm">
                                                <span className="font-medium">{product.sku}</span>
                                              </td>
                                              <td className="px-4 py-2 text-sm">{product.name}</td>
                                              <td className="px-4 py-2 text-sm">
                                                {product.vat_type === "margin"
                                                  ? (product.purchase_price_with_fees?.toFixed(2) || '-') + " € TVM"
                                                  : (product.purchase_price_with_fees?.toFixed(2) || '-') + " € HT"}
                                              </td>
                                              <td className="px-4 py-2 text-sm">
                                                {product.vat_type === "margin" ? (
                                                  <span>
                                                    <span className="font-medium">
                                                      {product.pro_price !== undefined && product.pro_price !== null ? product.pro_price.toFixed(2) : "-"} € TVM
                                                    </span>
                                                    <span
                                                      className={`ml-1 ${
                                                        ((product.pro_margin_percent ?? 0) < 8)
                                                          ? "text-red-600"
                                                          : ((product.pro_margin_percent ?? 0) <= 18)
                                                            ? "text-yellow-500"
                                                            : "text-green-600"
                                                      }`}
                                                    >
                                                      ({(product.pro_margin_percent ?? 0).toFixed(1)}%)
                                                    </span>
                                                  </span>
                                                ) : (
                                                  <span className="flex flex-col">
                                                    <span>
                                                      <span className="font-medium">
                                                        {product.pro_price !== undefined && product.pro_price !== null ? (product.pro_price * 1.2).toFixed(2) : "-"} € TTC
                                                      </span>
                                                      <span
                                                        className={`ml-1 ${
                                                          ((product.pro_margin_percent ?? 0) < 8)
                                                            ? "text-red-600"
                                                            : ((product.pro_margin_percent ?? 0) <= 18)
                                                              ? "text-yellow-500"
                                                              : "text-green-600"
                                                        }`}
                                                      >
                                                        ({(product.pro_margin_percent ?? 0).toFixed(1)}%)
                                                      </span>
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                      {product.pro_price !== undefined && product.pro_price !== null ? product.pro_price.toFixed(2) : "-"} € HT
                                                    </span>
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2 text-sm">
                                                {product.vat_type === "margin" ? (
                                                  <span>
                                                    <span className="font-medium">
                                                      {product.retail_price !== undefined && product.retail_price !== null ? product.retail_price.toFixed(2) : "-"} € TVM
                                                    </span>
                                                    <span
                                                      className={`ml-1 ${
                                                        ((product.margin_percent ?? 0) < 20)
                                                          ? "text-red-600"
                                                          : ((product.margin_percent ?? 0) <= 25)
                                                            ? "text-yellow-500"
                                                            : "text-green-600"
                                                      }`}
                                                    >
                                                      ({(product.margin_percent ?? 0).toFixed(1)}%)
                                                    </span>
                                                  </span>
                                                ) : (
                                                  <span className="flex flex-col">
                                                    <span>
                                                      <span className="font-medium">
                                                        {product.retail_price !== undefined && product.retail_price !== null ? (product.retail_price * 1.2).toFixed(2) : "-"} € TTC
                                                      </span>
                                                      <span
                                                        className={`ml-1 ${
                                                          ((product.margin_percent ?? 0) < 20)
                                                            ? "text-red-600"
                                                            : ((product.margin_percent ?? 0) <= 25)
                                                              ? "text-yellow-500"
                                                              : "text-green-600"
                                                        }`}
                                                      >
                                                        ({(product.margin_percent ?? 0).toFixed(1)}%)
                                                      </span>
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                      {product.retail_price !== undefined && product.retail_price !== null ? product.retail_price.toFixed(2) : "-"} € HT
                                                    </span>
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2 text-sm">
                                                <div className="flex flex-col">
                                                  <span className="flex items-center gap-1">
                                                    <Package size={16} className="text-gray-500" />
                                                    <span>
                                                      {(product.stocks || []).reduce((sum: number, s: any) => sum + (s.quantite || 0), 0)}
                                                    </span>
                                                  </span>
                                                  <div className="mt-1 space-y-0.5">
                                                    {(product.stocks || []).map((s: any, idx: number) => (
                                                      <div key={(s.stock && s.stock.id) || s.stock_id || idx} className="text-xs text-gray-500">
                                                        {s.stock?.name} ({s.quantite})
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-500">
                                                {product.stock_alert ?? '-'}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-500">
                                                {product.location || '-'}
                                              </td>
                                              <td className="px-4 py-2 text-sm">
                                                <div className="flex space-x-2">
                                                  <button
                                                    onClick={() => setEditingProduct(product.id)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Modifier"
                                                  >
                                                    <Edit size={18} />
                                                  </button>
                                                  <button
                                                    onClick={async () => {
                                                      await openMirrorModalFor(product as any);
                                                    }}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Créer un produit miroir"
                                                  >
                                                    <Users size={18} />
                                                  </button>
                                                  <button
                                                    onClick={() => setShowDeleteConfirm(product.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Supprimer"
                                                  >
                                                    <Trash2 size={18} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                              </React.Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                              {/* Sous-tableau des numéros de série (parents avec enfants sérialisés) */}
                              {(() => {
                                const serialChildren = (childProducts[product.id] || []).filter((c: any) => !!c.serial_number);
                                if (serialChildren.length === 0) return null;
                                return (
                                  <>
                                  <h4 className="font-medium text-gray-700 mb-2">Numéros de série pour {product.name}</h4>
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Numéro de série</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix d'achat</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix vente pro</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Prix vente magasin</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Batterie</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fournisseur</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Note</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {serialChildren
                                    .sort((a, b) => {
                                      // TVA normale d'abord, puis TVA sur marge, ordre d'origine sinon
                                      if (a.vat_type === b.vat_type) return 0;
                                      if (a.vat_type === "normal") return -1;
                                      return 1;
                                    })
                                    .map(child => (
                                    <tr key={child.id} className={child.vat_type === "margin" ? "hover:bg-gray-100 text-blue-600 font-bold" : "hover:bg-gray-100 text-gray-900 font-bold"}>
                                      <td className="px-4 py-2 text-sm">
                                        <div className="flex flex-col gap-1 whitespace-normal break-all">
                                          <span>
                                            <strong>{child.serial_number || '-'}</strong>
                                          </span>
                                          <span>
                                            {child.vat_type === "margin" ? "TVA sur marge" : "TVA normale"}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {child.vat_type === "margin"
                                          ? (child.purchase_price_with_fees?.toFixed(2) || '-') + " € TVM"
                                          : (child.purchase_price_with_fees?.toFixed(2) || '-') + " € HT"
                                        }
                                      </td>
                                      {/* Prix vente pro HT + marge % */}
                                      <td className="px-4 py-2 text-sm">
                                        {(() => {
                                          const pro = child.pro_price ?? 0;
                                          const achat = child.purchase_price_with_fees ?? 0;
                                          let proMargin = 0;
                                          if (achat > 0 && pro > 0) proMargin = ((pro - achat) / achat) * 100;
                                          let proColor = "text-gray-500";
                                          if (proMargin < 8) proColor = "text-red-600";
                                          else if (proMargin >= 8 && proMargin <= 18) proColor = "text-yellow-500";
                                          else if (proMargin > 18) proColor = "text-green-600";
                                          if (child.vat_type === "margin") {
                                            // Pour TVA marge: marge_% = ((prix_vente - prix_achat) / 1.2) / prix_achat * 100
                                            const achat = child.purchase_price_with_fees ?? 0;
                                            const prix = child.pro_price ?? 0;
                                            const percent = achat > 0 ? (((prix - achat) / 1.2) / achat) * 100 : 0;
                                            let color = "text-gray-500";
                                            if (percent < 8) color = "text-red-600";
                                            else if (percent <= 18) color = "text-yellow-500";
                                            else color = "text-green-600";
                                            return (
                                              <span className="flex flex-col">
                                                <span>
                                                  <span className="font-bold text-blue-600">
                                                    {child.pro_price !== undefined && child.pro_price !== null
                                                      ? child.pro_price.toFixed(2)
                                                      : "-"
                                                    } € TVM
                                                  </span>
                                                  <span className={`ml-1 ${color}`}>({isFinite(percent) ? percent.toFixed(1) : "0.0"}%)</span>
                                                </span>
                                                <span className="font-bold text-blue-600">
                                                  Marge Numéraire {(achat > 0 ? ((prix - achat) / 1.2) : 0).toFixed(2)} €
                                                </span>
                                              </span>
                                            );
                                          } else {
                                            // Afficher TTC en principal, HT en secondaire, marge % inchangée (basée sur HT)
                                            const prixHT = child.pro_price !== undefined && child.pro_price !== null ? child.pro_price / 1.2 : 0;
                                            const prixTTC = child.pro_price !== undefined && child.pro_price !== null ? child.pro_price : 0;
                                            const achat = child.purchase_price_with_fees ?? 0;
                                            const marge = achat > 0 ? ((prixHT - achat) / achat) * 100 : 0;
                                            let color = "text-gray-500";
                                            if (marge < 8) color = "text-red-600";
                                            else if (marge >= 8 && marge <= 18) color = "text-yellow-500";
                                            else if (marge > 18) color = "text-green-600";
                                            return (
                                              <span className="flex flex-col">
                                                <span>
                                                  <span className="font-bold text-gray-900">{prixTTC.toFixed(2)} € TTC</span>
                                                  <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                                </span>
                                                <span className="font-bold text-black">
                                                  Marge Numéraire {(prixHT - achat).toFixed(2)} €
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {prixHT.toFixed(2)} € HT
                                                </span>
                                              </span>
                                            );
                                          }
                                        })()}
                                      </td>
                                      {/* Prix vente magasin HT + marge % */}
                                      <td className="px-4 py-2 text-sm">
                                        {(() => {
                                          const mag = child.retail_price ?? 0;
                                          const achat = child.purchase_price_with_fees ?? 0;
                                          let magMargin = 0;
                                          if (achat > 0 && mag > 0) magMargin = ((mag - achat) / achat) * 100;
                                          let magColor = "text-gray-500";
                                          if (magMargin < 20) magColor = "text-red-600";
                                          else if (magMargin >= 20 && magMargin <= 25) magColor = "text-yellow-500";
                                          else if (magMargin > 25) magColor = "text-green-600";
                                          if (child.vat_type === "margin") {
                                            // Pour TVA marge: marge_% = ((prix_vente - prix_achat) / 1.2) / prix_achat * 100
                                            const achat = child.purchase_price_with_fees ?? 0;
                                            const prix = child.retail_price ?? 0;
                                            const percent = achat > 0 ? (((prix - achat) / 1.2) / achat) * 100 : 0;
                                            let color = "text-gray-500";
                                            if (percent < 20) color = "text-red-600";
                                            else if (percent <= 25) color = "text-yellow-500";
                                            else color = "text-green-600";
                                            return (
                                              <span className="flex flex-col">
                                                <span>
                                                  <span className="font-bold text-blue-600">
                                                    {child.retail_price !== undefined && child.retail_price !== null
                                                      ? child.retail_price.toFixed(2)
                                                      : "-"
                                                    } € TVM
                                                  </span>
                                                  <span className={`ml-1 ${color}`}>({isFinite(percent) ? percent.toFixed(1) : "0.0"}%)</span>
                                                </span>
                                                <span className="font-bold text-blue-600">
                                                  Marge Numéraire {(achat > 0 ? ((prix - achat) / 1.2) : 0).toFixed(2)} €
                                                </span>
                                              </span>
                                            );
                                          } else {
                                            // Afficher TTC en principal, HT en secondaire, marge % inchangée (basée sur HT)
                                            const prixHT = child.retail_price !== undefined && child.retail_price !== null ? child.retail_price / 1.2 : 0;
                                            const prixTTC = child.retail_price !== undefined && child.retail_price !== null ? child.retail_price : 0;
                                            const achat = child.purchase_price_with_fees ?? 0;
                                            const marge = achat > 0 ? ((prixHT - achat) / achat) * 100 : 0;
                                            let color = "text-gray-500";
                                            if (marge < 20) color = "text-red-600";
                                            else if (marge >= 20 && marge <= 25) color = "text-yellow-500";
                                            else if (marge > 25) color = "text-green-600";
                                            return (
                                              <span className="flex flex-col">
                                                <span>
                                                  <span className="font-bold text-gray-900">{prixTTC.toFixed(2)} € TTC</span>
                                                  <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                                </span>
                                                <span className="font-bold text-black">
                                                  Marge Numéraire {(prixHT - achat).toFixed(2)} €
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {prixHT.toFixed(2)} € HT
                                                </span>
                                              </span>
                                            );
                                          }
                                        })()}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {(() => {
                                          const level = child.battery_level ?? null;
                                          let color = "text-gray-500";
                                          if (typeof level === "number") {
                                            if (level < 80) color = "text-red-600";
                                            else if (level >= 80 && level <= 84) color = "text-yellow-500";
                                            else if (level >= 85) color = "text-green-600";
                                          }
                                          return (
                                            <span className="flex items-center gap-1">
                                              <Battery size={16} className={color} />
                                              <span className={color}>
                                                {level !== null && level !== undefined ? `${level}%` : "-"}
                                              </span>
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-4 py-2 text-sm">{child.supplier || '-'}</td>
                                      <td className="px-4 py-2 text-sm">{child.product_note || '-'}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setEditingSerialProduct(child);
                                              setShowSerialProductFormModal(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Modifier"
                                          >
                                            <Edit size={18} />
                                          </button>
                                          <button
                                            onClick={async () => {
                                              console.log('Demande suppression produit enfant :', child.id);
                                              if (window.confirm('Voulez-vous vraiment supprimer ce produit enfant ?')) {
                                                try {
                                                  const { error } = await supabase
                                                    .from('products')
                                                    .delete()
                                                    .eq('id', child.id as any);
                                                  if (error) {
                                                    console.error('Erreur lors de la suppression du produit enfant :', error);
                                                  } else {
                                                    console.log('Produit enfant supprimé :', child.id);
                                                    // Rafraîchir la liste des enfants
                                                    const { data } = await supabase
                                                      .from('products')
                                                      .select('*')
                                                      .eq('parent_id', product.id as any);
                                                    setChildProducts(prev => ({
                                                      ...prev,
                                                      [product.id]: (data as unknown as Product[]) || []
                                                    }));
                                                  }
                                                } catch (err) {
                                                  console.error('Erreur lors de la suppression du produit enfant :', err);
                                                }
                                              }
                                            }}
                                            className="text-red-600 hover:text-red-800"
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
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit ou lot trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Modifier le produit</h2>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowImageManager(false);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
              <ProductForm
                initialProduct={products.find(p => p.id === editingProduct) as any}
                onSubmitSuccess={() => {
                  const edited = products.find(p => p.id === editingProduct);
                  setEditingProduct(null);
                  setShowImageManager(false);
                  // Si c'est un parent (pas de parent_id), ouvrir le modal de répartition des stocks
                  if (edited && !edited.parent_id) {
                    setManagingStockProduct(edited.id);
                  }
                }}
                showImageManager={showImageManager}
              />
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle size={24} className="mr-2" />
              <h3 className="text-lg font-semibold">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle size={24} className="mr-2" />
              <h3 className="text-lg font-semibold">Confirmer la suppression multiple</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer {selectedProducts.size} élément{selectedProducts.size > 1 ? 's' : ''} ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-4">
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

      {/* Stock Manager Modal */}
      {managingStockProduct && (
        <StockManager
          isOpen={true}
          onClose={() => setManagingStockProduct(null)}
          productId={managingStockProduct}
          onStockUpdate={handleStockUpdate}
        />
      )}

      {/* Modal édition produit enfant (numéro de série) */}
      {editingSerialProduct && showSerialProductFormModal && (
        <SerialProductFormModal
          initialValues={{
            id: editingSerialProduct.id,
            name: editingSerialProduct.name,
            sku: editingSerialProduct.sku,
            serial_number: editingSerialProduct.serial_number || "",
            purchase_price_with_fees: editingSerialProduct.purchase_price_with_fees ?? null,
            raw_purchase_price: editingSerialProduct.raw_purchase_price ?? null,
            retail_price: editingSerialProduct.retail_price ?? null,
            pro_price: editingSerialProduct.pro_price ?? null,
            battery_level: editingSerialProduct.battery_level ?? null,
            warranty_sticker: editingSerialProduct.warranty_sticker ?? "",
            supplier: editingSerialProduct.supplier ?? "",
            stock_id: editingSerialProduct.stock_id ?? "",
            product_note: editingSerialProduct.product_note ?? "",
            vat_type: (editingSerialProduct.vat_type as "normal" | "margin") ?? "normal",
          }}
          stocks={stocks}
          onClose={() => {
            setEditingSerialProduct(null);
            setShowSerialProductFormModal(false);
          }}
          onUpdated={async () => {
            setEditingSerialProduct(null);
            setShowSerialProductFormModal(false);
            // Rafraîchir la liste des produits enfants pour le parent concerné
            if (editingSerialProduct.parent_id) {
              const { data } = await supabase
                .from('products')
                .select('*')
                .eq('parent_id', editingSerialProduct.parent_id as any);
              setChildProducts(prev => ({
                ...prev,
                [editingSerialProduct.parent_id!]: (data as unknown as Product[]) || []
              }));
            }
          }}
        />
      )}

      {/* Mirror Product Modal */}
      {showMirrorModal && selectedMirrorParent && (
        <MirrorProductModal
          isOpen={showMirrorModal}
          onClose={() => {
            setShowMirrorModal(false);
            setSelectedMirrorParent(null);
          }}
          parentProduct={selectedMirrorParent}
          onSuccess={async () => {
            // Rafraîchir la liste des produits
            const updatedProducts = await fetchProducts();
            if (updatedProducts) {
              // Afficher parents et miroirs (exclure les sérialisés)
              const listProducts = updatedProducts.filter(p => !p.serial_number);
              setProducts(listProducts as any);
            }
          }}
        />
      )}

      {/* Lot Modal */}
      <LotModal
        isOpen={isLotModalOpen}
        onClose={handleLotModalClose}
        parentProduct={editingLotId ? undefined : (selectedProduct || undefined)}
        lotId={editingLotId || undefined}
      />
    </div>
  );
};
