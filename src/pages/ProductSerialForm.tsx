import React, { useState, useEffect } from 'react';
import {
  calculateMarginFromSellingPrice_Margin,
  calculateMarginFromPercent_Margin,
  calculateMarginFromValue_Margin
} from '../components/Products/MarginCalculator';


import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';
import { useLocation } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useVariantStore } from '../store/variantStore';
import { ProductSelectionWindow } from '../components/Products/ProductSelectionWindow';
import { supabase } from '../lib/supabase';

interface Stock {
  id: string;
  name: string;
  group: {
    name: string;
    synchronizable: boolean;
  }[];
}

interface FormData {
  name: string;
  sku: string;
  serialNumber: string;
  purchasePrice: string;
  rawPurchasePrice: string;
  supplier: string;
  productNote: string;
  vat_type: '' | 'normal' | 'margin';
  batteryPercentage: string;
  warrantySticker: 'present' | 'absent' | '';
  selectedStock: string;
  retailPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
  proPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
}

const TVA_RATE = 0.20; // 20% TVA

const calculateTTC = (priceHT: number) => {
  return priceHT * (1 + TVA_RATE);
};

const calculateHT = (ttc: number): number => {
  return ttc / (1 + TVA_RATE);
};

const calculateMargin = (purchasePrice: number, sellingPrice: number): number => {
  if (!purchasePrice || !sellingPrice) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
};


export const ProductSerialForm: React.FC = () => {
  const location = useLocation();
  const productId = location?.state?.productId;
  if (!productId) {
    console.error("Aucun productId fourni dans le state de navigation.");
  }
  const { navigateToProduct } = useNavigate();
  const { categories, fetchCategories } = useCategoryStore();
  const { variants, fetchVariants } = useVariantStore();
  
  const [selectedCategory, setSelectedCategory] = useState({
    type: '',
    brand: '',
    model: ''
  });
  
  const [selectedVariant, setSelectedVariant] = useState({
    color: '',
    grade: '',
    capacity: '',
    sim_type: ''
  });
  
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    sku: string;
  } | null>(null);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    sku: '',
    serialNumber: '',
    purchasePrice: '',
    rawPurchasePrice: '',
    supplier: '',
    productNote: '',
    vat_type: '',
    batteryPercentage: '',
    warrantySticker: '',
    selectedStock: '',
    retailPrice: {
      ht: '',
      margin: '',
      ttc: ''
    },
    proPrice: {
      ht: '',
      margin: '',
      ttc: ''
    }
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchVariants();
    fetchStocks();

    // Mode édition : charger le produit si un id est présent dans le state
    if (productId) {
      setIsEditMode(true);
      setLoadingProduct(true);
      supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
        .then(({ data, error }) => {
          setLoadingProduct(false);
          const prod = data as any;
          if (error || !prod || typeof prod !== 'object' || !('id' in prod)) {
            setError("Impossible de charger le produit à éditer");
            return;
          }
          setFormData({
            name: prod.name || '',
            sku: prod.sku ? prod.sku.replace(/-\w+$/, '') : '',
            serialNumber: prod.serial_number || '',
            purchasePrice: prod.purchase_price_with_fees?.toString() || '',
            rawPurchasePrice: prod.raw_purchase_price?.toString() || '',
            supplier: prod.supplier || '',
            productNote: prod.product_note || '',
            vat_type: prod.vat_type || '',
            batteryPercentage: prod.battery_level?.toString() || '',
            warrantySticker: prod.warranty_sticker || '',
            selectedStock: prod.stock_id || '',
            retailPrice: {
              ht: prod.retail_price?.toString() || '',
              margin: '',
              ttc: ''
            },
            proPrice: {
              ht: prod.pro_price?.toString() || '',
              margin: '',
              ttc: ''
            }
          });
        });
    }

    // Vérifier si un parentProductId est stocké dans sessionStorage
    const parentProductId = sessionStorage.getItem('parentProductId');
    console.log('Parent product ID from sessionStorage:', parentProductId);
  }, [fetchCategories, fetchVariants]);

  useEffect(() => {
    console.log('Checking fields for product selection window:', {
      category: selectedCategory,
      variant: selectedVariant
    });
    
    if (
      selectedCategory.type && 
      selectedCategory.brand && 
      selectedCategory.model &&
      selectedVariant.color && 
      selectedVariant.grade && 
      selectedVariant.capacity &&
      selectedVariant.sim_type
    ) {
      console.log('Opening product selection window');
      setShowProductSelection(true);
    }
  }, [selectedCategory, selectedVariant]);

  const fetchStocks = async () => {
    try {
      console.log('Fetching stocks...');
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

      if (error) throw error;
      console.log('Stocks fetched successfully:', data);
      setStocks((data as unknown as Stock[]) || []);
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setError('Erreur lors de la récupération des stocks');
    }
  };

  const handleCategoryChange = (field: keyof typeof selectedCategory, value: string) => {
    console.log('handleCategoryChange:', field, value);
    const upperValue = value.toUpperCase();
    setSelectedCategory(prev => {
      const newData = { ...prev, [field]: upperValue };
      if (field === 'type') {
        newData.brand = '';
        newData.model = '';
      } else if (field === 'brand') {
        newData.model = '';
      }
      return newData;
    });
  };

  const handleVariantChange = (field: keyof typeof selectedVariant, value: string) => {
    console.log('handleVariantChange:', field, value);
    const upperValue = value.toUpperCase();
    setSelectedVariant(prev => ({ ...prev, [field]: upperValue }));
  };

  const handleProductSelect = (product: { id: string; name: string; sku: string }) => {
    console.log('Product selected:', product);
    setSelectedProduct(product);
    setShowProductSelection(false);
    setFormData(prev => ({
      ...prev,
      name: product.name,
      sku: product.sku
    }));
  };

  const handleVATTypeChange = (type: 'normal' | 'margin') => {
    console.log('VAT type changed to:', type);
    setFormData(prev => ({
      ...prev,
      vat_type: type
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    
    // Validation
    if (!formData.serialNumber) {
      setError('Le numéro de série est requis');
      console.log('Validation error: Le numéro de série est requis');
      return;
    }
    
    if (!formData.selectedStock) {
      setError('Veuillez sélectionner un stock');
      console.log('Validation error: Veuillez sélectionner un stock');
      return;
    }
    
    if (!formData.purchasePrice) {
      setError('Le prix d\'achat est requis');
      console.log('Validation error: Le prix d\'achat est requis');
      return;
    }
    
    if (!formData.retailPrice.ht) {
      setError('Le prix de vente magasin est requis');
      console.log('Validation error: Le prix de vente magasin est requis');
      return;
    }
    
    if (!formData.proPrice.ht) {
      setError('Le prix de vente pro est requis');
      console.log('Validation error: Le prix de vente pro est requis');
      return;
    }
    
    try {
      // Récupérer le parentProductId de sessionStorage s'il existe
      const parentProductId = sessionStorage.getItem('parentProductId');
      console.log('Preparing to submit with parent ID:', parentProductId);

      // Préparer les données pour l'insertion/mise à jour
      // Ne garder que les champs attendus par Supabase
      // Correction : enregistrer le prix TTC pour la TVA normale, HT pour TVA marge
      const isTVANormale = formData.vat_type === "normal";
      const retailPrice = parseFloat(formData.retailPrice.ht);
      const proPrice = parseFloat(formData.proPrice.ht);

      const productData: any = {
        name: formData.name,
        sku: `${formData.sku}-${formData.serialNumber}`,
        serial_number: formData.serialNumber,
        purchase_price_with_fees: parseFloat(formData.purchasePrice),
        raw_purchase_price: parseFloat(formData.rawPurchasePrice || formData.purchasePrice),
        retail_price: isTVANormale ? (isNaN(retailPrice) ? null : Number((retailPrice * 1.2).toFixed(2))) : retailPrice,
        pro_price: isTVANormale ? (isNaN(proPrice) ? null : Number((proPrice * 1.2).toFixed(2))) : proPrice,
        stock: 1,
        stock_id: formData.selectedStock,
        battery_level: parseInt(formData.batteryPercentage || '0'),
        warranty_sticker: formData.warrantySticker,
        supplier: formData.supplier,
        product_note: formData.productNote,
        vat_type: formData.vat_type,
        parent_id: parentProductId || null,
        is_parent: false
      };

      let data, error;
      if (isEditMode) {
        // Update
        if (!productId) {
          setError("ID produit manquant pour la modification");
          return;
        }
        ({ data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', productId)
          .select());
      } else {
        // Insert
        ({ data, error } = await supabase
          .from('products')
          .insert([productData])
          .select());

        // Correction : enregistrer la marge % et nette dans serial_product_margin_last pour TVA sur marge
        if (
          !error &&
          Array.isArray(data) &&
          data[0] &&
          typeof data[0] === "object" &&
          "id" in data[0] &&
          formData.vat_type === "margin"
        ) {
          const productId = data[0].id;
          const purchase = parseFloat(formData.purchasePrice);
          const retailPrice = parseFloat(formData.retailPrice.ht);
          const proPrice = parseFloat(formData.proPrice.ht);
          let marge_percent = null, marge_numeraire = null, pro_marge_percent = null, pro_marge_numeraire = null;
          if (!isNaN(purchase) && !isNaN(retailPrice) && purchase !== 0) {
            const result = calculateMarginFromSellingPrice_Margin(purchase, retailPrice);
            marge_percent = result.marginPercent;
            marge_numeraire = result.marginValue;
          }
          if (!isNaN(purchase) && !isNaN(proPrice) && purchase !== 0) {
            const result = calculateMarginFromSellingPrice_Margin(purchase, proPrice);
            pro_marge_percent = result.marginPercent;
            pro_marge_numeraire = result.marginValue;
          }
          await supabase
            .from("serial_product_margin_last")
            .upsert([{
              serial_product_id: productId,
              marge_percent,
              marge_numeraire,
              pro_marge_percent,
              pro_marge_numeraire,
              modified_at: new Date().toISOString()
            }] as any);
        } else if (formData.vat_type === "margin") {
          console.error("Impossible d'enregistrer la marge : produit non créé ou id manquant", { data, error });
        }
      }

      console.log('Supabase response - data:', data, 'error:', error);

      if (error) throw error;

      // Nettoyer sessionStorage
      sessionStorage.removeItem('parentProductId');

      // Rediriger vers la liste des produits
      navigateToProduct('product-list');
      console.log('Navigation to product list successful');
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la création ou modification du produit');
    }

    console.log('Form submission process completed');
  };

  if (isEditMode && !productId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 mt-12">
          <h2 className="text-xl font-semibold mb-4 text-red-600">Erreur</h2>
          <p>Impossible d’éditer ce produit : identifiant manquant.</p>
          <button
            onClick={() => navigateToProduct('product-list')}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retour à la liste des produits
          </button>
        </div>
      </div>
    );
  }

  if (!selectedProduct) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigateToProduct('add-product-pam')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour
          </button>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Category and Variant Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Choisissez Catégorie et variante pour sélectionner votre produit parent auquel vous souhaitez ajouter des numéros de série</h2>

            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Catégorie</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nature du produit
                  </label>
                  <select
                    value={selectedCategory.type}
                    onChange={(e) => handleCategoryChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner la nature</option>
                    {Array.from(new Set(categories.map(c => c.type))).sort().map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marque
                  </label>
                  <select
                    value={selectedCategory.brand}
                    onChange={(e) => handleCategoryChange('brand', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.type}
                    required
                  >
                    <option value="">Sélectionner la marque</option>
                    {Array.from(new Set(categories
                      .filter(c => !selectedCategory.type || c.type === selectedCategory.type)
                      .map(c => c.brand)
                    )).sort().map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modèle
                  </label>
                  <select
                    value={selectedCategory.model}
                    onChange={(e) => handleCategoryChange('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    disabled={!selectedCategory.brand}
                    required
                  >
                    <option value="">Sélectionner le modèle</option>
                    {Array.from(new Set(categories
                      .filter(c => 
                        (!selectedCategory.type || c.type === selectedCategory.type) && 
                        (!selectedCategory.brand || c.brand === selectedCategory.brand)
                      )
                      .map(c => c.model)
                    )).sort().map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Variante</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur
                  </label>
                  <select
                    value={selectedVariant.color}
                    onChange={(e) => handleVariantChange('color', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une couleur</option>
                    {Array.from(new Set(variants.map(v => v.color))).sort().map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade
                  </label>
                  <select
                    value={selectedVariant.grade}
                    onChange={(e) => handleVariantChange('grade', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner un grade</option>
                    {Array.from(new Set(variants.map(v => v.grade))).sort().map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacité
                  </label>
                  <select
                    value={selectedVariant.capacity}
                    onChange={(e) => handleVariantChange('capacity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner une capacité</option>
                    {Array.from(new Set(variants.map(v => v.capacity))).sort().map(capacity => (
                      <option key={capacity} value={capacity}>{capacity}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de SIM
                  </label>
                  <select
                    value={selectedVariant.sim_type}
                    onChange={(e) => handleVariantChange('sim_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    required
                  >
                    <option value="">Sélectionner un type de SIM</option>
                    {Array.from(new Set(variants.map(v => v.sim_type).filter(Boolean))).sort().map(simType => (
                      <option key={simType} value={simType}>{simType}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection Window */}
        {showProductSelection && (
          <ProductSelectionWindow
            isOpen={showProductSelection}
            onClose={() => setShowProductSelection(false)}
            onSelect={handleProductSelect}
            category={selectedCategory}
            variant={selectedVariant}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-8">
        <button
          onClick={() => setSelectedProduct(null)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Retour
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Association du numéro de série</h2>

          {/* Product Info and VAT Selection */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit
                </label>
                <input
                  type="text"
                  value={formData.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* VAT Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de TVA <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleVATTypeChange('normal')}
                className={`px-4 py-2 rounded-md border ${
                  formData.vat_type === 'normal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA normale
              </button>
              <button
                type="button"
                onClick={() => handleVATTypeChange('margin')}
                className={`px-4 py-2 rounded-md border ${
                  formData.vat_type === 'margin'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                TVA sur marge
              </button>
            </div>
          </div>

          {/* Rest of the form - Only shown after VAT type selection */}
          {formData.vat_type && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de série <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    maxLength={15}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.serialNumber.length} / 15
                  </div>
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.selectedStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, selectedStock: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Sélectionner un stock</option>
                  {stocks.map(stock => (
                    <option key={stock.id} value={stock.id}>
                      {stock.name} {stock.group.length > 0 ? `(${stock.group[0].name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pourcentage de batterie <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="batteryPercentage"
                      value={formData.batteryPercentage}
                      onChange={(e) => {
                        const value = e.target.value;
                        // N'autoriser que les chiffres
                        if (/^\d*$/.test(value)) {
                          const numValue = parseInt(value, 10);
                          // Bloquer si > 100 ou si vide
                          if (value === '' || (numValue >= 0 && numValue <= 100)) {
                            setFormData(prev => ({ ...prev, batteryPercentage: value }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setFormData(prev => ({ ...prev, batteryPercentage: '0' }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      max="100"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sticker de garantie <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="warrantySticker"
                      value="present"
                      checked={formData.warrantySticker === 'present'}
                      onChange={(e) => setFormData(prev => ({ ...prev, warrantySticker: 'present' }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      required
                    />
                    <span className="ml-2">Présent</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="warrantySticker"
                      value="absent"
                      checked={formData.warrantySticker === 'absent'}
                      onChange={(e) => setFormData(prev => ({ ...prev, warrantySticker: 'absent' }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      required
                    />
                    <span className="ml-2">Absent</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix d'achat avec frais <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix d'achat brut <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="rawPurchasePrice"
                      value={formData.rawPurchasePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, rawPurchasePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix de vente magasin <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                    </label>
                    <input
  type="text"
  value={formData.retailPrice.ht}
  required
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Prix HT (ou Prix de vente)
      const result = calculateMarginFromSellingPrice_Margin(purchase, input);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: input.toString(),
          margin: result.marginPercent.toFixed(2),
          ttc: result.marginValue.toFixed(2)
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ttc = (input * 1.2).toFixed(2);
      const margin = purchase > 0 ? (((input - purchase) / purchase) * 100).toFixed(2) : "";
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: value,
          margin: margin,
          ttc: ttc
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ...prev.retailPrice,
          ht: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Marge %
                    </label>
                    <input
  type="text"
  value={formData.retailPrice.margin}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Marge %
      const result = calculateMarginFromPercent_Margin(purchase, input);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: input.toString(),
          ttc: result.marginValue.toFixed(2)
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ht = (purchase + (purchase * input / 100)).toFixed(2);
      const ttc = (parseFloat(ht) * 1.2).toFixed(2);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: ht,
          margin: value,
          ttc: ttc
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ...prev.retailPrice,
          margin: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
/>

                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                      %
                    </span>
                  </div>
                  {formData.vat_type === 'normal' ? (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Prix TTC
                      </label>
                      <input
  type="text"
  value={formData.retailPrice.ttc}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Marge numéraire net (ou TTC)
      const result = calculateMarginFromValue_Margin(purchase, input);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: result.marginPercent.toFixed(2),
          ttc: input.toString()
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ht = (purchase + input).toFixed(2);
      const margin = purchase > 0 ? ((input / purchase) * 100).toFixed(2) : "";
      const ttc = (parseFloat(ht) * 1.2).toFixed(2);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: ht,
          margin: margin,
          ttc: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ...prev.retailPrice,
          ttc: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Marge numéraire net
                      </label>
                      <input
  type="text"
  value={formData.retailPrice.ttc}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      const result = calculateFromMarginValue(purchase, input);
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: result.marginPercent.toFixed(2),
          ttc: input.toString()
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        retailPrice: {
          ...prev.retailPrice,
          ttc: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix de vente pro <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                    </label>
                    <input
  type="text"
  value={formData.proPrice.ht}
  required
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Prix HT (ou Prix de vente) pour pro
      const result = calculateFromSellingPrice(purchase, input);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: input.toString(),
          margin: result.marginPercent.toFixed(2),
          ttc: result.marginValue.toFixed(2)
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ttc = (input * 1.2).toFixed(2);
      const margin = purchase > 0 ? (((input - purchase) / purchase) * 100).toFixed(2) : "";
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: value,
          margin: margin,
          ttc: ttc
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ...prev.proPrice,
          ht: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Marge %
                    </label>
                    <input
  type="text"
  value={formData.proPrice.margin}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Marge % pour pro
      const result = calculateFromMarginPercent(purchase, input);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: input.toString(),
          ttc: result.marginValue.toFixed(2)
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ht = (purchase + (purchase * input / 100)).toFixed(2);
      const ttc = (parseFloat(ht) * 1.2).toFixed(2);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: ht,
          margin: value,
          ttc: ttc
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ...prev.proPrice,
          margin: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
/>

                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                      %
                    </span>
                  </div>
                  {formData.vat_type === 'normal' ? (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Prix TTC
                      </label>
                      <input
  type="text"
  value={formData.proPrice.ttc}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      // Champ Marge numéraire net (ou TTC) pour pro
      const result = calculateFromMarginValue(purchase, input);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: result.marginPercent.toFixed(2),
          ttc: input.toString()
        }
      }));
    } else if (formData.vat_type === 'normal' && !isNaN(purchase) && !isNaN(input)) {
      // Calcul dynamique pour TVA normale
      const ht = (purchase + input).toFixed(2);
      const margin = purchase > 0 ? ((input / purchase) * 100).toFixed(2) : "";
      const ttc = (parseFloat(ht) * 1.2).toFixed(2);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: ht,
          margin: margin,
          ttc: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ...prev.proPrice,
          ttc: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Marge numéraire net
                      </label>
                      <input
  type="text"
  value={formData.proPrice.ttc}
  onChange={(e) => {
    const value = e.target.value;
    const purchase = parseFloat(formData.purchasePrice);
    const input = parseFloat(value);

    if (formData.vat_type === 'margin' && !isNaN(purchase) && !isNaN(input)) {
      const result = calculateFromMarginValue(purchase, input);
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ht: result.sellingPrice.toFixed(2),
          margin: result.marginPercent.toFixed(2),
          ttc: input.toString()
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        proPrice: {
          ...prev.proPrice,
          ttc: value
        }
      }));
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
/>

                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        €
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  name="productNote"
                  value={formData.productNote}
                  onChange={(e) => setFormData(prev => ({ ...prev, productNote: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {isEditMode ? "Enregistrer les modifications" : "Associer le numéro de série"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
