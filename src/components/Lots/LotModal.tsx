import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Package, Search, Calculator, Minus } from 'lucide-react';
import { useLotStore } from '../../store/lotStore';
import { useProductStore } from '../../store/productStore';
import { supabase } from '../../lib/supabase';
import type { LotFormData } from '../../types/lots';
import type { ProductWithStock } from '../../types/supabase';

interface LotModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProduct?: ProductWithStock;
  lotId?: string;
}

interface LotComponent {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_stock: number;
  quantity: number;
  depots_utilises: string[];
}

interface Stock {
  id: string;
  name: string;
}

export const LotModal: React.FC<LotModalProps> = ({ isOpen, onClose, parentProduct, lotId }) => {
  const { createLot, updateLot, getLotById, calculateLotStock, calculateLotPrices, isLoading, error, fetchLots: refreshLots } = useLotStore();
  const { products, fetchProducts } = useProductStore();

  const [lotType, setLotType] = useState<'simple' | 'compose'>('simple');
  const [formData, setFormData] = useState<LotFormData>({
    name: '',
    sku: '',
    type: 'simple',
    quantity_per_lot: 1,
    stock_alert: 0,
    location: '',
    vat_type: 'normal',
    margin_pro_percent: 0,
    margin_retail_percent: 0,
    components: []
  });

  const [components, setComponents] = useState<LotComponent[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [calculatedStock, setCalculatedStock] = useState(0);
  const [calculatedBase, setCalculatedBase] = useState({
    purchasePriceHT: 0
  });

  // Dual margins and computed prices
  const [marginProPercent, setMarginProPercent] = useState<number | null>(null);
  const [marginRetailPercent, setMarginRetailPercent] = useState<number | null>(null);
  const [calculatedPro, setCalculatedPro] = useState({ sellingPriceHT: 0, sellingPriceTTC: 0 });
  const [calculatedRetail, setCalculatedRetail] = useState({ sellingPriceHT: 0, sellingPriceTTC: 0 });

  // Product search for composed lots
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep formData.type in sync with UI selection
  useEffect(() => {
    setFormData(prev => ({ ...prev, type: lotType }));
  }, [lotType]);

  useEffect(() => {
    if (isOpen) {
      fetchStocks();
      try {
        // Précharger la liste produits pour la recherche si nécessaire, seulement si vide
        if (typeof fetchProducts === 'function' && (!products || products.length === 0)) {
          fetchProducts();
        }
      } catch (e) {
        console.warn('fetchProducts failed in LotModal open:', e);
      }

      if (lotId) {
        // Load existing lot for editing
        loadLot(lotId);
      } else if (parentProduct) {
        // Initialize for simple lot
        setLotType('simple');
        const quantity = 1;
        const suggestedSku = `LOT${quantity}-${parentProduct.sku}`;
        const suggestedName = `Lot de ${quantity} ${parentProduct.name}`;

        const defaultProPct = typeof parentProduct.pro_margin_percent === 'number' ? parentProduct.pro_margin_percent : 0;
        const defaultRetailPct = typeof parentProduct.margin_percent === 'number' ? parentProduct.margin_percent : 0;

        setFormData({
          name: suggestedName,
          sku: suggestedSku,
          type: 'simple',
          quantity_per_lot: quantity,
          stock_alert: 0,
          location: parentProduct.location || '',
          vat_type: 'normal',
          margin_pro_percent: defaultProPct,
          margin_retail_percent: defaultRetailPct,
          components: [{
            product_id: parentProduct.id,
            quantity: quantity,
            depots_utilises: []
          }]
        });

        setComponents([{
          product_id: parentProduct.id,
          product_name: parentProduct.name,
          product_sku: parentProduct.sku,
          product_stock: parentProduct.stock || 0,
          quantity: quantity,
          depots_utilises: []
        }]);

        setMarginProPercent(defaultProPct);
        setMarginRetailPercent(defaultRetailPct);
      }
    }
  }, [isOpen, parentProduct, lotId]);

  // Debounce du terme de recherche
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(productSearchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [productSearchTerm]);

  // Filtrage des produits (nom + SKU)
  useEffect(() => {
    if (debouncedSearchTerm.trim() === '') {
      setFilteredProducts([]);
      setHighlightedIndex(-1);
    } else {
      const lowercasedSearch = debouncedSearchTerm.toLowerCase();
      setFilteredProducts(
        products
          .filter(product =>
            // Autoriser tous les produits non sérialisés et non miroirs (ne pas exiger is_parent)
            !product.serial_number &&
            !(product as any).mirror_of &&
            (
              (product.name || '').toLowerCase().includes(lowercasedSearch) ||
              (product.sku || '').toLowerCase().includes(lowercasedSearch)
            )
          )
          .slice(0, 10)
      );
      setHighlightedIndex(0);
    }
  }, [debouncedSearchTerm, products]);

  useEffect(() => {
    // Recalculate stock and prices when components, margins or VAT type change
    if (components.length > 0) {
      recalculateLot();
    }
  }, [components, marginProPercent, marginRetailPercent, formData.vat_type]);

  // Auto-génération du nom pour lot composé si l'utilisateur n'a pas modifié manuellement
  useEffect(() => {
    if (lotType === 'compose' && !nameManuallyEdited) {
      const autoName = components.map(c => c.product_name).filter(Boolean).join(' + ');
      // Ne pas déclencher de setState si rien ne change (évite les boucles de rendu)
      setFormData(prev => {
        if (autoName && autoName !== prev.name) {
          return { ...prev, name: autoName };
        }
        return prev;
      });
    }
  }, [components, lotType, nameManuallyEdited]);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('id, name')
        .order('name');

      if (error) throw error;
      const rows = (data as any[] | null)?.map((r) => ({ id: String(r.id), name: String(r.name) })) ?? [];
      setStocks(rows);
    } catch (err) {
      console.error('Error fetching stocks:', err);
    }
  };

  const loadLot = async (id: string) => {
    try {
      const lot = await getLotById(id);
      if (lot) {
        // Derive percents from stored values (fallback: make both equal)
        const basePurchase = lot.purchase_price_ht || 0;
        const storedHT = lot.selling_price_ht || 0;
        const derivedPercent = basePurchase > 0 ? ((storedHT - basePurchase) / basePurchase) * 100 : 0;

        setFormData({
          name: lot.name,
          sku: lot.sku,
          type: lot.type,
          quantity_per_lot: lot.quantity_per_lot,
          stock_alert: lot.stock_alert || 0,
          location: lot.location || '',
          vat_type: lot.vat_type,
          margin_pro_percent: lot.margin_pro_percent ?? derivedPercent,
          margin_retail_percent: lot.margin_retail_percent ?? derivedPercent,
          components: lot.components?.map(c => ({
            product_id: c.product_id,
            quantity: c.quantity,
            depots_utilises: c.depots_utilises
          })) || []
        });

        setLotType(lot.type);
        setComponents(lot.components || []);
        setCalculatedStock(lot.stock);

        // Set base and calculated prices for display
        setCalculatedBase({ purchasePriceHT: basePurchase });
        // Initialize UI with derived percents
        setMarginProPercent(lot.margin_pro_percent ?? derivedPercent);
        setMarginRetailPercent(lot.margin_retail_percent ?? derivedPercent);

        // Compute display prices using derived percents
        const comp = (lot.components || []).map(c => ({ product_id: c.product_id, quantity: c.quantity }));
        const proMarginHT = basePurchase * ((lot.margin_pro_percent ?? derivedPercent) / 100);
        const retailMarginHT = basePurchase * ((lot.margin_retail_percent ?? derivedPercent) / 100);

        const proPrices = await calculateLotPrices(comp, proMarginHT, lot.vat_type);
        const retailPrices = await calculateLotPrices(comp, retailMarginHT, lot.vat_type);

        setCalculatedPro({ sellingPriceHT: proPrices.sellingPriceHT, sellingPriceTTC: proPrices.sellingPriceTTC });
        setCalculatedRetail({ sellingPriceHT: retailPrices.sellingPriceHT, sellingPriceTTC: retailPrices.sellingPriceTTC });
      }
    } catch (err) {
      console.error('Error loading lot:', err);
    }
  };

  const recalculateLot = async () => {
    if (components.length === 0) {
      setCalculatedStock(0);
      setCalculatedBase({ purchasePriceHT: 0 });
      setCalculatedPro({ sellingPriceHT: 0, sellingPriceTTC: 0 });
      setCalculatedRetail({ sellingPriceHT: 0, sellingPriceTTC: 0 });
      return;
    }
    try {
      const comp = components.map(c => ({ product_id: c.product_id, quantity: c.quantity }));
      const stock = await calculateLotStock(comp);

      // Get base totals with 0€ margin to derive purchase price
      const base = await calculateLotPrices(comp, 0, formData.vat_type);
      const proPct = marginProPercent ?? 0;
      const retailPct = marginRetailPercent ?? 0;

      const proMarginHT = base.purchasePriceHT * (proPct / 100);
      const retailMarginHT = base.purchasePriceHT * (retailPct / 100);

      const proPrices = await calculateLotPrices(comp, proMarginHT, formData.vat_type);
      const retailPrices = await calculateLotPrices(comp, retailMarginHT, formData.vat_type);

      setCalculatedStock(stock);
      setCalculatedBase({ purchasePriceHT: base.purchasePriceHT });
      setCalculatedPro({ sellingPriceHT: proPrices.sellingPriceHT, sellingPriceTTC: proPrices.sellingPriceTTC });
      setCalculatedRetail({ sellingPriceHT: retailPrices.sellingPriceHT, sellingPriceTTC: retailPrices.sellingPriceTTC });
    } catch (err) {
      console.error('Error recalculating lot:', err);
    }
  };

  const handleQuantityChange = (quantity: number) => {
    if (lotType === 'simple' && parentProduct) {
      const suggestedSku = `LOT${quantity}-${parentProduct.sku}`;
      const suggestedName = `Lot de ${quantity} ${parentProduct.name}`;

      setFormData(prev => ({
        ...prev,
        quantity_per_lot: quantity,
        sku: suggestedSku,
        name: suggestedName,
        components: [{
          product_id: parentProduct.id,
          quantity: quantity,
          depots_utilises: []
        }]
      }));

      setComponents([{
        product_id: parentProduct.id,
        product_name: parentProduct.name,
        product_sku: parentProduct.sku,
        product_stock: parentProduct.stock || 0,
        quantity: quantity,
        depots_utilises: []
      }]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showProductDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setShowProductDropdown(true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((idx) => {
        const next = idx < filteredProducts.length - 1 ? idx + 1 : filteredProducts.length - 1;
        return next < 0 ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((idx) => (idx > 0 ? idx - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = filteredProducts[highlightedIndex >= 0 ? highlightedIndex : 0];
      if (sel) {
        handleAddComponent(sel);
      }
    } else if (e.key === 'Escape') {
      setShowProductDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  const handleAddComponent = (product: ProductWithStock) => {
    // Check if product is already in components
    if (components.some(c => c.product_id === product.id)) {
      alert('Ce produit est déjà dans le lot');
      return;
    }

    const newComponent: LotComponent = {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      product_stock: product.stock || 0,
      quantity: 1,
      depots_utilises: []
    };

    setComponents(prev => [...prev, newComponent]);
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, {
        product_id: product.id,
        quantity: 1,
        depots_utilises: []
      }]
    }));

    setProductSearchTerm('');
    setShowProductDropdown(false);
    setHighlightedIndex(-1);
    setTimeout(() => { productSearchInputRef.current?.focus(); }, 0);
  };

  const handleRemoveComponent = (productId: string) => {
    setComponents(prev => prev.filter(c => c.product_id !== productId));
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter(c => c.product_id !== productId)
    }));
  };

  const handleComponentQuantityChange = (productId: string, quantity: number) => {
    setComponents(prev =>
      prev.map(c =>
        c.product_id === productId ? { ...c, quantity } : c
      )
    );

    setFormData(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.product_id === productId ? { ...c, quantity } : c
      )
    }));
  };

  const incrementComponentQuantity = (productId: string) => {
    setComponents(prev => prev.map(c =>
      c.product_id === productId ? { ...c, quantity: (c.quantity || 1) + 1 } : c
    ));
    setFormData(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.product_id === productId ? { ...c, quantity: (c.quantity || 1) + 1 } : c
      )
    }));
  };

  const decrementComponentQuantity = (productId: string) => {
    setComponents(prev => prev.map(c =>
      c.product_id === productId ? { ...c, quantity: Math.max(1, (c.quantity || 1) - 1) } : c
    ));
    setFormData(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.product_id === productId ? { ...c, quantity: Math.max(1, (c.quantity || 1) - 1) } : c
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!formData.name || !formData.sku) {
      alert('Le nom et le SKU sont obligatoires');
      setIsSubmitting(false);
      return;
    }

    if (components.length === 0) {
      alert('Veuillez ajouter au moins un composant');
      setIsSubmitting(false);
      return;
    }

    try {
      // Persist independent percents; store computes prices from percents
      const retailPct = marginRetailPercent ?? 0;

      if (lotId) {
        await updateLot(lotId, {
          name: formData.name,
          sku: formData.sku,
          stock_alert: formData.stock_alert || 0,
          location: formData.location,
          vat_type: formData.vat_type,
          // Persist dual margins on update as well
          margin_pro_percent: marginProPercent ?? 0,
          margin_retail_percent: retailPct
        });
      } else {
        await createLot({
          ...formData,
          stock_alert: formData.stock_alert || 0,
          margin_pro_percent: marginProPercent ?? 0,
          margin_retail_percent: retailPct
        });
      }

      // Sécurité: forcer un rafraîchissement des lots après sauvegarde
      if (typeof refreshLots === 'function') {
        try {
          await refreshLots();
        } catch (e) {
          console.warn('refreshLots after save failed:', e);
        }
      }

      onClose();
    } catch (err) {
      console.error('Error saving lot:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const isSimple = lotType === 'simple';
  const isFormValid = Boolean(
    (formData.name && formData.name.trim()) &&
    (formData.sku && formData.sku.trim()) &&
    (isSimple ? formData.quantity_per_lot >= 1 : components.length > 0)
  );

  const colorForProMargin = (pct: number) => {
    if (pct < 8) return 'text-red-600';
    if (pct <= 18) return 'text-yellow-500';
    return 'text-green-600';
  };

  const colorForRetailMargin = (pct: number) => {
    if (pct < 20) return 'text-red-600';
    if (pct <= 25) return 'text-yellow-500';
    return 'text-green-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {lotId ? 'Modifier le lot' : 'Créer un lot'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lot Type Selection (only for new lots) */}
          {!lotId && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Type de lot</h3>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="simple"
                    checked={lotType === 'simple'}
                    onChange={(e) => setLotType(e.target.value as 'simple')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">Lot simple (un seul produit)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="compose"
                    checked={lotType === 'compose'}
                    onChange={(e) => setLotType(e.target.value as 'compose')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">Lot composé (plusieurs produits)</span>
                </label>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du lot <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => { setNameManuallyEdited(true); setFormData(prev => ({ ...prev, name: e.target.value })); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU du lot <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Marge Pro (%) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marge Pro (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={marginProPercent ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const val = v === '' ? null : (parseFloat(v) || 0);
                    setMarginProPercent(val);
                    setFormData(prev => ({ ...prev, margin_pro_percent: val ?? 0 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  step="0.01"
                  min="0"
                  placeholder="Entrer une marge pro en %"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>

            {/* Marge Magasin (%) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marge Magasin (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={marginRetailPercent ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const val = v === '' ? null : (parseFloat(v) || 0);
                    setMarginRetailPercent(val);
                    setFormData(prev => ({ ...prev, margin_retail_percent: val ?? 0 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  step="0.01"
                  min="0"
                  placeholder="Entrer une marge magasin en %"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de TVA
              </label>
              <select
                value={formData.vat_type}
                onChange={(e) => setFormData(prev => ({ ...prev, vat_type: e.target.value as 'normal' | 'margin' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="normal">TVA normale</option>
                <option value="margin">TVA sur marge</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alerte stock
              </label>
              <input
                type="number"
                value={formData.stock_alert === 0 ? '' : formData.stock_alert}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_alert: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="0"
                placeholder="Alerte stock (optionnel)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emplacement
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Simple Lot Quantity */}
          {lotType === 'simple' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité par lot <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity_per_lot}
                onChange={(e) => {
                  const quantity = parseInt(e.target.value) || 1;
                  setFormData(prev => ({ ...prev, quantity_per_lot: quantity }));
                  handleQuantityChange(quantity);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1"
                required
              />
              <p className="mt-1 text-xs text-gray-600">
                Disponible: {calculatedStock} lot(s)
              </p>
            </div>
          )}

          {/* Components Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Package size={20} className="mr-2" />
                Composants du lot
              </h3>

              {lotType === 'compose' && (
                <div className="relative">
                  <input
                    ref={productSearchInputRef}
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Rechercher un produit..."
                    className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    onFocus={() => setShowProductDropdown(true)}
                    autoComplete="off"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />

                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                      <ul className="py-1">
                        {filteredProducts.map((product, idx) => (
                          <li
                            key={product.id}
                            className={`px-4 py-2 cursor-pointer ${idx === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
                            onClick={() => handleAddComponent(product)}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            <div className="text-sm text-gray-500">
                              Stock: {product.stock || 0}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Components Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock disponible
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité par lot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dépôts utilisés
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {components.length > 0 ? (
                    components.map((component) => (
                      <tr key={component.product_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {component.product_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {component.product_sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {component.product_stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decrementComponentQuantity(component.product_id)}
                              className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                              title="Diminuer"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={component.quantity}
                              onChange={(e) => handleComponentQuantityChange(component.product_id, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              min="1"
                            />
                            <button
                              type="button"
                              onClick={() => incrementComponentQuantity(component.product_id)}
                              className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                              title="Augmenter"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lotType === 'compose' && (
                            <select
                              multiple
                              value={component.depots_utilises}
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                                setComponents(prev => prev.map(c => c.product_id === component.product_id ? { ...c, depots_utilises: selected } : c));
                                setFormData(prev => ({
                                  ...prev,
                                  components: prev.components.map(c => c.product_id === component.product_id ? { ...c, depots_utilises: selected } : c)
                                }));
                              }}
                              className="w-48 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              {stocks.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lotType === 'compose' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(component.product_id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Aucun composant ajouté
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Calculated Values */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Calculator size={20} className="mr-2" />
              Calculs automatiques
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Stock disponible</label>
                <p className="text-lg font-semibold text-blue-600">{calculatedStock}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Prix d'achat HT</label>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(calculatedBase.purchasePriceHT)}</p>
              </div>

              {/* Prix vente Pro */ }
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix vente Pro</label>
                {formData.vat_type === 'margin' ? (
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(calculatedPro.sellingPriceTTC)} &nbsp; TVM
                    <span className={`ml-2 text-sm ${colorForProMargin((marginProPercent ?? 0))}`}>
                      ({(marginProPercent ?? 0).toFixed(1)}%)
                    </span>
                  </p>
                ) : (
                  <div className="flex flex-col">
                    <span>
                      <span className="text-lg font-semibold text-gray-900">{formatCurrency(calculatedPro.sellingPriceTTC)}</span> &nbsp; TTC
                      <span className={`ml-2 text-sm ${colorForProMargin((marginProPercent ?? 0))}`}>
                        ({(marginProPercent ?? 0).toFixed(1)}%)
                      </span>
                    </span>
                    <span className="text-xs text-gray-500">{formatCurrency(calculatedPro.sellingPriceHT)} HT</span>
                  </div>
                )}
              </div>

              {/* Prix vente Magasin */ }
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix vente Magasin</label>
                {formData.vat_type === 'margin' ? (
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(calculatedRetail.sellingPriceTTC)} &nbsp; TVM
                    <span className={`ml-2 text-sm ${colorForRetailMargin((marginRetailPercent ?? 0))}`}>
                      ({(marginRetailPercent ?? 0).toFixed(1)}%)
                    </span>
                  </p>
                ) : (
                  <div className="flex flex-col">
                    <span>
                      <span className="text-lg font-semibold text-gray-900">{formatCurrency(calculatedRetail.sellingPriceTTC)}</span> &nbsp; TTC
                      <span className={`ml-2 text-sm ${colorForRetailMargin((marginRetailPercent ?? 0))}`}>
                        ({(marginRetailPercent ?? 0).toFixed(1)}%)
                      </span>
                    </span>
                    <span className="text-xs text-gray-500">{formatCurrency(calculatedRetail.sellingPriceHT)} HT</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isLoading || isSubmitting || !isFormValid}
              >
              {isLoading ? 'Enregistrement...' : (lotId ? 'Modifier' : 'Créer le lot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
