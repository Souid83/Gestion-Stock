import React, { useState, useEffect } from 'react';
import { Edit, Trash2, AlertCircle, Image as ImageIcon, Plus, Package, Eye, ChevronDown, ChevronUp, Battery } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { ProductForm } from './ProductForm';
import { useNavigate } from '../../hooks/useNavigate';
import { StockManager } from './StockManager';
import { SerialNumberListModal } from './SerialNumberListModal';
import { SerialProductFormModal } from './SerialProductFormModal';
import { EditSerialProductForm } from './EditSerialProductForm';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

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
}

const TVA_RATE = 0.20;

export const ProductList: React.FC<ProductListProps> = ({ products: initialProducts }) => {
  const { isLoading, error, deleteProduct, fetchProducts } = useProductStore();
  const { navigateToProduct } = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [showImageManager, setShowImageManager] = useState(false);
  const [managingStockProduct, setManagingStockProduct] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [childProducts, setChildProducts] = useState<Record<string, Product[]>>({});
  // Stocke les marges % enregistrées pour chaque enfant (id enfant => { marge_percent, pro_marge_percent })
  const [childMargins, setChildMargins] = useState<Record<string, { marge_percent: number | null, pro_marge_percent: number | null }>>({});
  // État pour l'édition d'un produit enfant (numéro de série)
  const [editingSerialProduct, setEditingSerialProduct] = useState<Product | null>(null);
  const [showSerialProductFormModal, setShowSerialProductFormModal] = useState(false);
  const [stocks, setStocks] = useState<any[]>([]);

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
    console.log('Initial products:', initialProducts);
    const parentProducts = initialProducts.filter(p => !p.parent_id);
    console.log('Filtered parent products:', parentProducts);
    setProducts(parentProducts);
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
            const parentProducts = updatedProducts.filter(p => !p.parent_id);
            setProducts(parentProducts);
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
            .eq('parent_id', product.id);

          if (error) throw error;

          if (count && count > 0 && data) {
            setChildProducts(prev => ({
              ...prev,
              [product.id]: data || []
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
                for (const m of marginsData) {
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
      const parentProducts = updatedProducts.filter(p => !p.parent_id);
      setProducts(parentProducts);
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
            .eq('parent_id', productId);
            
          if (error) throw error;
          console.log('Child products fetched:', data);
          
          setChildProducts(prev => ({
            ...prev,
            [productId]: data || []
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

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="relative">
      <div className="bg-white rounded-lg shadow">
        <div className="max-h-[70vh] overflow-y-auto relative">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left">
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
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix d'achat (HT/TVM)
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente pro
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente magasin
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alerte stock
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Emplacement
                </th>
                <th className="sticky top-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const purchasePrice = product.purchase_price_with_fees || 0;
                const retailPrice = product.retail_price || 0;
                const proPrice = product.pro_price || 0;
                const retailMargin = calculateMargin(purchasePrice, retailPrice);
                const proMargin = calculateMargin(purchasePrice, proPrice);
                const isLowStock = product.stock_alert !== null && (product.stock_total ?? 0) <= product.stock_alert;
                // Correction : parser le champ stocks si c'est une string JSON
                let stocksArray: any[] = [];
                if (product.stocks) {
                  if (typeof product.stocks === "string") {
                    try {
                      stocksArray = JSON.parse(product.stocks);
                    } catch {
                      stocksArray = [];
                    }
                  } else {
                    stocksArray = product.stocks;
                  }
                }
                const totalStock = stocksArray.reduce((sum, stock) => sum + (stock.quantite || 0), 0);
                const hasChildren = hasChildProducts(product.id);
                const isExpanded = expandedProducts.has(product.id);

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
                          {hasChildren && (
                            <button
                              onClick={() => toggleExpandProduct(product.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? 'Masquer' : 'Voir'} les numéros de série
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                          const children = childProducts[product.id] || [];
                          if (children.length === 0) {
                            return <span>{purchasePrice.toFixed(2)} €</span>;
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
                                const tva = idx === 0 ? "TTC" : "TVM";
                                if (!vals) return null;
                                const achat = vals.achat / vals.count;
                                // Correction : afficher "HT" pour TVA normale, "TVM" pour marge
                                const tvaLabel = tva === "TVM" ? "TVM" : "HT";
                                return (
                                  <span key={tva}>
                                    <span className="font-medium">{achat.toFixed(2)} € {tvaLabel}</span>
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
                          const children = childProducts[product.id] || [];
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
                                  <span className="font-medium">{proPrice.toFixed(2)} € TVM</span>
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
                                    <span className="font-medium">{proPrice.toFixed(2)} € HT</span>
                                    <span className={`ml-1 ${color}`}>({proMarginPercent.toFixed(1)}%)</span>
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(proPrice * 1.2).toFixed(2)} €
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
                                if (!vals) return null;
                                // Correction finale : pour TVA normale, utiliser le prix HT enregistré (child.pro_price / 1.2 n'est pas fiable si déjà HT)
                                let prix = 0;
                                let achat = 0;
                                let marge = 0;
                                if (tva === "TVM" && vals.pro_marge_percent_count && vals.pro_marge_percent_count > 0) {
                                  prix = vals.pro / vals.count;
                                  achat = vals.achat / vals.count;
                                  marge = vals.pro_marge_percent_sum! / vals.pro_marge_percent_count!;
                                  // Affichage spécifique pour TVA sur marge : prix TVM + marge % enregistrée, pas de HT/TTC
                                  let color = "text-blue-600";
                                  return (
                                    <span key={tva}>
                                      <span className="font-medium">{prix.toFixed(2)} € TVM</span>
                                      <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                    </span>
                                  );
                                } else if (tva === "TTC") {
                                  // Correction : prix TTC stocké, prix HT = prix TTC / 1.2
                                  const childrenTTC = children.filter(child => child.vat_type === "normal");
                                  if (childrenTTC.length > 0) {
                                    const prixTTC = childrenTTC.reduce((sum, child) => sum + (child.pro_price ?? 0), 0) / childrenTTC.length;
                                    prix = prixTTC / 1.2;
                                    achat = childrenTTC.reduce((sum, child) => sum + (child.purchase_price_with_fees ?? 0), 0) / childrenTTC.length;
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
                                const tvaLabel = tva === "TVM" ? "TVM" : "HT";
                                if (tva === "TTC") {
                                  // Afficher HT + marge, puis TTC
                                  return (
                                    <span key={tva} className="flex flex-col">
                                      <span>
                                        <span className="font-medium">{prix.toFixed(2)} € HT</span>
                                        <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {(prix * 1.2).toFixed(2)} € TTC
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
                                      <span className="font-medium">{prix.toFixed(2)} € TVM</span>
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
                          const children = childProducts[product.id] || [];
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
                                  <span className="font-medium">{retailPrice.toFixed(2)} € TVM</span>
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
                                    <span className="font-medium">{retailPrice.toFixed(2)} € HT</span>
                                    <span className={`ml-1 ${color}`}>({retailMarginPercent.toFixed(1)}%)</span>
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(retailPrice * 1.2).toFixed(2)} € TTC
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
                                if (tva === "TVM" && vals.marge_percent_count && vals.marge_percent_count > 0) {
                                  prix = vals.mag / vals.count;
                                  achat = vals.achat / vals.count;
                                  marge = vals.marge_percent_sum! / vals.marge_percent_count!;
                                  // Affichage spécifique pour TVA sur marge : prix TVM + marge % enregistrée, pas de HT/TTC
                                  let color = "text-blue-600";
                                  return (
                                    <span key={tva}>
                                      <span className="font-medium">{prix.toFixed(2)} € TVM</span>
                                      <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                    </span>
                                  );
                                } else if (tva === "TTC") {
                                  // Correction : prix TTC stocké, prix HT = prix TTC / 1.2
                                  const childrenTTC = children.filter(child => child.vat_type === "normal");
                                  if (childrenTTC.length > 0) {
                                    const prixTTC = childrenTTC.reduce((sum, child) => sum + (child.retail_price ?? 0), 0) / childrenTTC.length;
                                    prix = prixTTC / 1.2;
                                    achat = childrenTTC.reduce((sum, child) => sum + (child.purchase_price_with_fees ?? 0), 0) / childrenTTC.length;
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
                                  // Afficher HT + marge, puis TTC
                                  return (
                                    <span key={tva} className="flex flex-col">
                                      <span>
                                        <span className="font-medium">{prix.toFixed(2)} € HT</span>
                                        <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {(prix * 1.2).toFixed(2)} € TTC
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
                                      <span className="font-medium">{prix.toFixed(2)} € TVM</span>
                                      <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                    </span>
                                  );
                                }
                              })}
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isLowStock ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {childProducts[product.id] && childProducts[product.id].length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {/* Correction : afficher le stock par type de TVA */}
                            {(() => {
                              const children = childProducts[product.id] || [];
                              const tvaStock: Record<string, number> = { "TTC": 0, "TVM": 0 };
                              children.forEach(child => {
                                const tva = child.vat_type === "margin" ? "TVM" : "TTC";
                                tvaStock[tva] = (tvaStock[tva] || 0) + 1;
                              });
                              return (
                                <>
                                  {tvaStock["TTC"] > 0 && (
                                    <span>
                                      <Package size={16} className="text-gray-500 inline" /> {tvaStock["TTC"]} <span className="text-xs text-gray-500">TVA NORMALE</span>
                                    </span>
                                  )}
                                  {tvaStock["TVM"] > 0 && (
                                    <span>
                                      <Package size={16} className="text-gray-500 inline" /> {tvaStock["TVM"]} <span className="text-xs text-gray-500">TVA MARGE</span>
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          // Produit à prix d'achat unique : afficher le stock global et la liste des stocks
                          <>
                            <button
                              onClick={() => setManagingStockProduct(product.id)}
                              className="flex items-center gap-2 hover:text-blue-600"
                            >
                              <Package size={16} />
                              <span>
                                {stocksArray.length > 0
                                  ? stocksArray.reduce((sum, stock) => sum + (stock.quantite || 0), 0)
                                  : 0}
                              </span>
                            </button>
                            {/* Affichage détaillé des stocks, toujours visible sous le chiffre */}
                            <div className="mt-1 space-y-0.5">
                              {stocksArray.length > 0 && stocksArray.map(stock => (
                                <div key={stock.id} className="text-xs text-gray-500">
                                  {stock.name} ({stock.quantite})
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.stock_alert || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingProduct(product.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(product.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Affichage des produits enfants (numéros de série) */}
                    {isExpanded && childProducts[product.id] && childProducts[product.id].length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={11} className="px-6 py-4">
                          <div className="pl-8">
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
                                {[...childProducts[product.id]]
                                  .sort((a, b) => {
                                    // TVA normale d'abord, puis TVA sur marge, ordre d'origine sinon
                                    if (a.vat_type === b.vat_type) return 0;
                                    if (a.vat_type === "normal") return -1;
                                    return 1;
                                  })
                                  .map(child => (
                                  <tr key={child.id} className="hover:bg-gray-100">
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
                                          // Afficher le prix ttc (marge numéraire) déjà stocké + pourcentage enregistré
                                          let percent = childMargins[child.id]?.pro_marge_percent;
                                          // Si pas trouvé, essayer marge_percent (fallback)
                                          if (percent === undefined || percent === null) {
                                            percent = childMargins[child.id]?.marge_percent;
                                          }
                                          let color = "text-gray-500";
                                          if (percent !== undefined && percent !== null) {
                                            if (percent < 8) color = "text-red-600";
                                            else if (percent >= 8 && percent <= 18) color = "text-yellow-500";
                                            else if (percent > 18) color = "text-green-600";
                                          }
                                          return (
                                            <span>
                                              <span className="font-medium">
                                                {child.pro_price !== undefined && child.pro_price !== null
                                                  ? child.pro_price.toFixed(2)
                                                  : "-"
                                                } € TVM
                                              </span>
                                              {percent !== undefined && percent !== null && (
                                                <span className={`ml-1 ${color}`}>({percent.toFixed(1)}%)</span>
                                              )}
                                            </span>
                                          );
                                        } else {
                                          // Correction : afficher HT = pro_price / 1.2, TTC = pro_price, marge % sur HT
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
                                                <span className="font-medium">{prixHT.toFixed(2)} € HT</span>
                                                <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {prixTTC.toFixed(2)} € TTC
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
                                          // Afficher le prix ttc (marge numéraire) déjà stocké + pourcentage enregistré
                                          let percent = childMargins[child.id]?.marge_percent;
                                          // Si pas trouvé, essayer pro_marge_percent (fallback)
                                          if (percent === undefined || percent === null) {
                                            percent = childMargins[child.id]?.pro_marge_percent;
                                          }
                                          let color = "text-gray-500";
                                          if (percent !== undefined && percent !== null) {
                                            if (percent < 20) color = "text-red-600";
                                            else if (percent >= 20 && percent <= 25) color = "text-yellow-500";
                                            else if (percent > 25) color = "text-green-600";
                                          }
                                          return (
                                            <span>
                                              <span className="font-medium">
                                                {child.retail_price !== undefined && child.retail_price !== null
                                                  ? child.retail_price.toFixed(2)
                                                  : "-"
                                                } € TVM
                                              </span>
                                              {percent !== undefined && percent !== null && (
                                                <span className={`ml-1 ${color}`}>({percent.toFixed(1)}%)</span>
                                              )}
                                            </span>
                                          );
                                        } else {
                                          // Correction : afficher HT = retail_price / 1.2, TTC = retail_price, marge % sur HT
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
                                                <span className="font-medium">{prixHT.toFixed(2)} € HT</span>
                                                <span className={`ml-1 ${color}`}>({marge.toFixed(1)}%)</span>
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {prixTTC.toFixed(2)} € TTC
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
                                                  .eq('id', child.id);
                                                if (error) {
                                                  console.error('Erreur lors de la suppression du produit enfant :', error);
                                                } else {
                                                  console.log('Produit enfant supprimé :', child.id);
                                                  // Rafraîchir la liste des enfants
                                                  const { data } = await supabase
                                                    .from('products')
                                                    .select('*')
                                                    .eq('parent_id', product.id);
                                                  setChildProducts(prev => ({
                                                    ...prev,
                                                    [product.id]: data || []
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
                                {childProducts[product.id].length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-2 text-sm text-center text-gray-500">
                                      Aucun numéro de série associé
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
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
                setEditingProduct(null);
                setShowImageManager(false);
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

      {/* Serial Numbers Modal */}
      {selectedProduct && (
        <SerialNumberListModal
          isOpen={showSerialModal}
          onClose={() => setShowSerialModal(false)}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          serialProducts={initialProducts.filter(p => p.parent_id === selectedProduct.id)}
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
                .eq('parent_id', editingSerialProduct.parent_id);
              setChildProducts(prev => ({
                ...prev,
                [editingSerialProduct.parent_id!]: (data || []) as Product[]
              }));
            }
          }}
        />
      )}
    </div>
  );
};
