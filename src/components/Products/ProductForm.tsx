import React, { useState, useEffect, useRef } from 'react';
import { Package, Bell, DollarSign, Settings, Users, ShoppingBag, Cloud, PenTool as Tool, Box, Layers, Image as ImageIcon, Download, Upload, ArrowDown, Plus } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { useCategoryStore } from '../../store/categoryStore';
import { ImageManager } from './ImageManager';
import { StockAllocationModal } from './StockAllocationModal';
import { supabase } from '../../lib/supabase';
import { ImportDialog } from '../ImportProgress/ImportDialog';
import { useCSVImport } from '../../hooks/useCSVImport';

const TVA_RATE = 0.20;

interface PriceInputs {
  ht: string;
  margin: string;
  ttc: string;
}

interface ProductFormProps {
  initialProduct?: {
    id: string;
    name: string;
    sku: string;
    purchase_price_with_fees: number;
    retail_price: number;
    pro_price: number;
    weight_grams: number;
    location?: string;
    ean: string | null;
    stock: number;
    stock_alert: number | null;
    description: string | null;
    width_cm?: number | null;
    height_cm?: number | null;
    depth_cm?: number | null;
    images?: string[];
    category?: {
      type: string;
      brand: string;
      model: string;
    } | null;
    category_id?: string;
    vat_type?: string;
    margin_percent?: number;
    margin_value?: number;
    pro_margin_percent?: number;
    pro_margin_value?: number;
    shared_stock_id?: string;
  };
  onSubmitSuccess?: () => void;
  showImageManager?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialProduct,
  onSubmitSuccess,
  showImageManager = false
}) => {
  const { addProduct, updateProduct } = useProductStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  const [formData, setFormData] = useState({
    name: initialProduct?.name || '',
    sku: initialProduct?.sku || '',
    purchase_price_with_fees: initialProduct?.purchase_price_with_fees?.toString() || '',
    weight_grams: initialProduct?.weight_grams?.toString() || '',
    location: initialProduct?.location || '',
    ean: initialProduct?.ean || '',
    stock: initialProduct?.stock?.toString() || '',
    stock_alert: initialProduct?.stock_alert?.toString() || '',
    description: initialProduct?.description || '',
    width_cm: initialProduct?.width_cm?.toString() || '',
    height_cm: initialProduct?.height_cm?.toString() || '',
    depth_cm: initialProduct?.depth_cm?.toString() || '',
    vat_type: initialProduct?.vat_type || 'normal'
  });

  const [selectedCategory, setSelectedCategory] = useState({
    type: initialProduct?.category?.type || '',
    brand: initialProduct?.category?.brand || '',
    model: initialProduct?.category?.model || ''
  });

  const [retailPrice, setRetailPrice] = useState<PriceInputs>({
    ht: initialProduct?.retail_price?.toString() || '',
    margin: initialProduct?.margin_percent?.toString() || '',
    ttc: initialProduct?.margin_value?.toString() || ''
  });

  const [proPrice, setProPrice] = useState<PriceInputs>({
    ht: initialProduct?.pro_price?.toString() || '',
    margin: initialProduct?.pro_margin_percent?.toString() || '',
    ttc: initialProduct?.pro_margin_value?.toString() || ''
  });

  const [isImageManagerOpen, setIsImageManagerOpen] = useState(showImageManager);
  const [productImages, setProductImages] = useState<string[]>(initialProduct?.images || []);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [globalStock, setGlobalStock] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (initialProduct?.category_id && categories.length > 0) {
      const matched = categories.find(cat => cat.id === initialProduct.category_id);
      if (matched) {
        setSelectedCategory({
          type: matched.type,
          brand: matched.brand,
          model: matched.model
        });
      }
    }
  }, [initialProduct?.category_id, categories]);

  useEffect(() => {
    setIsImageManagerOpen(showImageManager);
  }, [showImageManager]);

  // Ne pas recalculer dynamiquement les marges à l'ouverture d'un produit existant : on affiche ce qui est en base
  // Cette logique est volontairement désactivée pour éviter d'écraser la valeur enregistrée par l'utilisateur
  // useEffect(() => {
  //   const purchasePrice = parseFloat(formData.purchase_price_with_fees);
  //   if (!isNaN(purchasePrice) && purchasePrice > 0) {
  //     if (retailPrice.ht) {
  //       const retailHT = parseFloat(retailPrice.ht);
  //       if (!isNaN(retailHT)) {
  //         setRetailPrice(prev => ({
  //           ...prev,
  //           margin: calculateMargin(purchasePrice, retailHT).toFixed(2),
  //           ttc: calculateTTC(retailHT).toFixed(2)
  //         }));
  //       }
  //     }
  //     if (proPrice.ht) {
  //       const proHT = parseFloat(proPrice.ht);
  //       if (!isNaN(proHT)) {
  //         setProPrice(prev => ({
  //           ...prev,
  //           margin: calculateMargin(purchasePrice, proHT).toFixed(2),
  //           ttc: calculateTTC(proHT).toFixed(2)
  //         }));
  //       }
  //     }
  //   }
  // }, [formData.purchase_price_with_fees]);

  const uniqueTypes = Array.from(new Set(categories.map(c => c.type))).sort();
  const uniqueBrands = Array.from(new Set(categories
    .filter(c => !selectedCategory.type || c.type === selectedCategory.type)
    .map(c => c.brand)
  )).sort();
  const uniqueModels = Array.from(new Set(categories
    .filter(c => 
      (!selectedCategory.type || c.type === selectedCategory.type) && 
      (!selectedCategory.brand || c.brand === selectedCategory.brand)
    )
    .map(c => c.model)
  )).sort();

  // --- LOGIQUE DYNAMIQUE TVA ---
  const calculateHT = (ttc: number, vatType: string, purchase: number): number => {
    if (vatType === "margin") {
      // Pour TVA sur marge, ttc = achat + (marge nette * 1.2) => marge nette = (ttc - achat) / 1.2
      return purchase + ((ttc - purchase) / 1.2);
    }
    return ttc / (1 + TVA_RATE);
  };

  const calculateTTC = (ht: number, vatType: string, purchase: number): number => {
    if (vatType === "margin") {
      // Pour TVA sur marge, ttc = achat + (marge nette * 1.2), marge nette = ht - achat
      return purchase + ((ht - purchase) * 1.2);
    }
    return ht * (1 + TVA_RATE);
  };

  const calculatePriceFromMargin = (purchasePrice: number, margin: number, vatType: string): number => {
    if (vatType === "margin") {
      // Prix de vente TTC = prix achat + (marge nette * 1.2)
      const margeNette = (purchasePrice * margin) / 100;
      return purchasePrice + (margeNette * 1.2);
    }
    return purchasePrice * (1 + margin / 100);
  };

  const calculateMargin = (purchasePrice: number, sellingPrice: number, vatType: string): number => {
    if (vatType === "margin") {
      // Marge nette = (prix vente TTC - prix achat) / 1.2
      const margeNette = (sellingPrice - purchasePrice) / 1.2;
      return (margeNette / purchasePrice) * 100;
    }
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'description') {
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

    const numericFields = [
      'ean',
      'weight_grams',
      'stock',
      'stock_alert',
      'width_cm',
      'height_cm',
      'depth_cm',
      'purchase_price_with_fees'
    ];

    if (numericFields.includes(name)) {
      if (/^\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (field: keyof typeof selectedCategory, value: string) => {
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

    if (value) {
      const parts = [
        field === 'type' ? upperValue : selectedCategory.type,
        field === 'brand' ? upperValue : selectedCategory.brand,
        field === 'model' ? upperValue : selectedCategory.model
      ].filter(Boolean);
      
      if (parts.length > 0) {
        setFormData(prev => ({
          ...prev,
          name: parts.join(' ')
        }));
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split(',').map(h => h.trim());
      const products = rows.slice(1).map(row => {
        const values = row.split(',');
        const product: any = {};
        headers.forEach((header, index) => {
          product[header.trim()] = values[index]?.trim() || '';
        });
        return product;
      });

      startImport(products.length);
      setError(null);
      const importErrors: { line: number; message: string }[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        try {
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id, stock')
            .eq('sku', product.sku)
            .single();

          const category = await addCategory({
            type: product.category_type.toUpperCase(),
            brand: product.category_brand.toUpperCase(),
            model: product.category_model.toUpperCase()
          });

          const productData = {
            name: product.name,
            sku: product.sku,
            purchase_price_with_fees: parseFloat(product.purchase_price_with_fees),
            retail_price: parseFloat(product.retail_price),
            pro_price: parseFloat(product.pro_price),
            weight_grams: parseInt(product.weight_grams),
            location: (product.location || '').toUpperCase(),
            ean: existingProduct?.ean || product.ean,
            stock: parseInt(product.stock),
            stock_alert: product.stock_alert ? parseInt(product.stock_alert) : null,
            description: product.description || null,
            width_cm: product.width_cm ? parseFloat(product.width_cm) : null,
            height_cm: product.height_cm ? parseFloat(product.height_cm) : null,
            depth_cm: product.depth_cm ? parseFloat(product.depth_cm) : null,
            category_id: category?.id || null,
            vat_type: product.vat_type || 'normal',
            margin_percent: product.margin_percent ? parseFloat(product.margin_percent) : null,
            margin_value: product.margin_value ? parseFloat(product.margin_value) : null,
            pro_margin_percent: product.pro_margin_percent ? parseFloat(product.pro_margin_percent) : null,
            pro_margin_value: product.pro_margin_value ? parseFloat(product.pro_margin_value) : null
          };

          if (existingProduct) {
            await updateProduct(existingProduct.id, {
              ...productData,
              stock: existingProduct.stock + parseInt(product.stock)
            });
          } else {
            await addProduct(productData);
          }

          incrementProgress();
        } catch (err) {
          console.error('Error processing product:', product.sku, err);
          importErrors.push({
            line: i + 2,
            message: `Erreur avec le produit ${product.sku}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
          });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (importErrors.length > 0) {
        setImportError(importErrors);
      } else {
        setImportSuccess(`${products.length} produits importés avec succès`);
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      setImportError([{
        line: 0,
        message: 'Erreur lors de l\'importation du fichier CSV'
      }]);
    }
  };

  const downloadSampleCSV = () => {
    const headers = [
      'name',
      'sku',
      'purchase_price_with_fees',
      'retail_price',
      'pro_price',
      'weight_grams',
      'location',
      'ean',
      'stock',
      'stock_alert',
      'description',
      'width_cm',
      'height_cm',
      'depth_cm',
      'category_type',
      'category_brand',
      'category_model',
      'vat_type',
      'margin_percent',
      'margin_value',
      'pro_margin_percent',
      'pro_margin_value'
    ];

    const sampleData = [
      'iPhone 14 Pro Max',
      'IP14PM-128-BLK',
      '900',
      '1200',
      '1100',
      '240',
      'STOCK-A1',
      '123456789012',
      '10',
      '3',
      'iPhone 14 Pro Max 128Go Noir',
      '7.85',
      '16.07',
      '0.78',
      'SMARTPHONE',
      'APPLE',
      'IPHONE 14 PRO MAX',
      'normal',
      '25',
      '300',
      '18',
      '200'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all required fields
    const requiredFields = [
      { field: 'name', label: 'Nom du produit' },
      { field: 'sku', label: 'SKU' },
      { field: 'purchase_price_with_fees', label: "Prix d'achat" },
      { field: 'weight_grams', label: 'Poids' },
      { field: 'location', label: 'Localisation' },
      { field: 'ean', label: 'EAN' },
      { field: 'stock', label: 'Stock' },
      { field: 'stock_alert', label: "Alerte stock" },
      { field: 'description', label: 'Description' },
      { field: 'width_cm', label: 'Largeur' },
      { field: 'height_cm', label: 'Hauteur' },
      { field: 'depth_cm', label: 'Profondeur' }
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field as keyof typeof formData]) {
        setError(`Le champ "${label}" est obligatoire`);
        return;
      }
    }

    // Validate category selection
    if (!selectedCategory.type || !selectedCategory.brand || !selectedCategory.model) {
      setError('Tous les champs de catégorie sont obligatoires');
      return;
    }

    // Validate prices
    if (!retailPrice.ht || !proPrice.ht) {
      setError('Les prix de vente magasin et pro sont obligatoires');
      return;
    }

    try {
      let categoryId = null;
      
      const category = await addCategory({
        type: selectedCategory.type,
        brand: selectedCategory.brand,
        model: selectedCategory.model
      });
      
      if (category) {
        categoryId = category.id;
      }

      const productData = {
        name: formData.name,
        sku: formData.sku,
        purchase_price_with_fees: parseFloat(formData.purchase_price_with_fees),
        retail_price: parseFloat(retailPrice.ht || '0'),
        pro_price: parseFloat(proPrice.ht || '0'),
        weight_grams: parseInt(formData.weight_grams),
        location: formData.location.toUpperCase(),
        ean: formData.ean,
        stock: parseInt(formData.stock),
        stock_alert: parseInt(formData.stock_alert),
        description: formData.description,
        width_cm: parseFloat(formData.width_cm),
        height_cm: parseFloat(formData.height_cm),
        depth_cm: parseFloat(formData.depth_cm),
        images: productImages,
        category_id: categoryId,
        vat_type: formData.vat_type,
        margin_percent: retailPrice.margin ? parseFloat(retailPrice.margin) : null,
        margin_value: retailPrice.ttc ? parseFloat(retailPrice.ttc) : null,
        pro_margin_percent: proPrice.margin ? parseFloat(proPrice.margin) : null,
        pro_margin_value: proPrice.ttc ? parseFloat(proPrice.ttc) : null
      };

      if (initialProduct) {
        await updateProduct(initialProduct.id, productData);
        
        // Synchronisation des produits miroirs
        const updateMirrorProducts = async (updatedFields: any) => {
          if (initialProduct.shared_stock_id) {
            console.log('Updating mirror products with shared_stock_id:', initialProduct.shared_stock_id);
            const { error } = await supabase
              .from('products')
              .update(updatedFields)
              .eq('shared_stock_id', initialProduct.shared_stock_id)
              .neq('id', initialProduct.id);
            
            if (error) {
              console.error('Error updating mirror products:', error);
            } else {
              console.log('Mirror products updated successfully');
            }
          }
        };
        
        // Champs à synchroniser entre les produits miroirs
        await updateMirrorProducts({
          purchase_price_with_fees: productData.purchase_price_with_fees,
          retail_price: productData.retail_price,
          pro_price: productData.pro_price,
          vat_type: productData.vat_type,
          margin_percent: productData.margin_percent,
          margin_value: productData.margin_value,
          pro_margin_percent: productData.pro_margin_percent,
          pro_margin_value: productData.pro_margin_value
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        const result = await addProduct(productData);
        if (result?.id) {
          setNewProductId(result.id);
          setNewProductName(result.name);
          setGlobalStock(parseInt(formData.stock));
          setIsStockModalOpen(true);
        }
      }

      if (!initialProduct) {
        setFormData({
          name: '',
          sku: '',
          purchase_price_with_fees: '',
          weight_grams: '',
          location: '',
          ean: '',
          stock: '',
          stock_alert: '',
          description: '',
          width_cm: '',
          height_cm: '',
          depth_cm: '',
          vat_type: 'normal'
        });
        setSelectedCategory({ type: '', brand: '', model: '' });
        setRetailPrice({ ht: '', margin: '', ttc: '' });
        setProPrice({ ht: '', margin: '', ttc: '' });
        setProductImages([]);
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Une erreur est survenue lors de l\'enregistrement du produit.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-blue-700">Vous avez plusieurs produits à créer ? 📦</p>
            <ArrowDown className="text-blue-500 animate-bounce" size={20} />
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={downloadSampleCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download size={18} />
              Télécharger un modèle CSV 📥
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
              <Upload size={18} />
              Importer un fichier CSV 📂
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {initialProduct ? 'Modifier le produit' : 'Ajouter un produit'}
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Catégorie du produit</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nature du produit <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategory.type}
                onChange={(e) => handleCategoryChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              >
                <option value="">Sélectionner la nature</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marque <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategory.brand}
                onChange={(e) => handleCategoryChange('brand', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                disabled={!selectedCategory.type}
                required
              >
                <option value="">Sélectionner la marque</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modèle <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategory.model}
                onChange={(e) => handleCategoryChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                disabled={!selectedCategory.brand}
                required
              >
                <option value="">Sélectionner le modèle</option>
                {uniqueModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du produit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              placeholder="Nom du produit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              placeholder="SKU"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Localisation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                location: e.target.value.toUpperCase() 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="EMPLACEMENT"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              EAN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ean"
              value={formData.ean}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Code EAN"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poids (grammes) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="weight_grams"
              value={formData.weight_grams}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              placeholder="Poids en grammes"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de TVA <span className="text-red-500">*</span>
            </label>
            <select
              name="vat_type"
              value={formData.vat_type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="normal">TVA normale</option>
              <option value="margin">TVA sur marge</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix d'achat HT <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="purchase_price_with_fees"
                value={formData.purchase_price_with_fees}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                placeholder="Prix d'achat"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                HT
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dimensions du produit <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="number"
                name="width_cm"
                value={formData.width_cm}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                placeholder="Largeur"
                step="0.1"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                cm
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                name="height_cm"
                value={formData.height_cm}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                placeholder="Hauteur"
                step="0.1"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                cm
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                name="depth_cm"
                value={formData.depth_cm}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md"
                placeholder="Profondeur"
                step="0.1"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                cm
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prix de vente magasin <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="text"
                value={retailPrice.ht}
                onChange={(e) => {
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  const ht = parseFloat(e.target.value) || 0;
                  if (formData.vat_type === "margin") {
                    // Marge brute = prix vente TTC - prix achat
                    const pv = ht;
                    const margeBrute = pv - purchase;
                    const margeNette = margeBrute / 1.2;
                    const margePercent = purchase > 0 ? (margeNette / purchase) * 100 : 0;
                    setRetailPrice({
                      ht: e.target.value,
                      margin: margePercent.toFixed(2),
                      ttc: margeNette.toFixed(2)
                    });
                  } else {
                    setRetailPrice(prev => ({
                      ...prev,
                      ht: e.target.value,
                      margin: calculateMargin(
                        purchase,
                        ht,
                        formData.vat_type
                      ).toFixed(2),
                      ttc: calculateTTC(ht, formData.vat_type, purchase).toFixed(2)
                    }));
                  }
                }}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md"
                placeholder={formData.vat_type === 'margin' ? "Prix TVM" : "Prix HT"}
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                {formData.vat_type === 'margin' ? "TVM" : "HT"}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={retailPrice.margin}
                onChange={(e) => {
                  const margin = parseFloat(e.target.value) || 0;
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  if (formData.vat_type === "margin") {
                    // Marge nette = (prix achat * marge %) / 100
                    const margeNette = (purchase * margin) / 100;
                    // Prix de vente TTC = prix achat + (marge nette * 1.2)
                    const pv = purchase + (margeNette * 1.2);
                    setRetailPrice({
                      ht: pv.toFixed(2),
                      margin: e.target.value,
                      ttc: margeNette.toFixed(2)
                    });
                  } else {
                    const ht = calculatePriceFromMargin(purchase, margin, formData.vat_type);
                    setRetailPrice({
                      ht: ht.toFixed(2),
                      margin: e.target.value,
                      ttc: calculateTTC(ht, formData.vat_type, purchase).toFixed(2)
                    });
                  }
                }}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-green-600"
                placeholder="Marge"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                %
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={retailPrice.ttc}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  if (formData.vat_type === "margin") {
                    // Prix de vente TTC = prix achat + (marge nette * 1.2)
                    const pv = purchase + (value * 1.2);
                    // Marge % = (marge nette / prix achat) * 100
                    const percent = purchase > 0 ? (value / purchase) * 100 : 0;
                    setRetailPrice({
                      ht: pv.toFixed(2),
                      margin: percent.toFixed(2),
                      ttc: e.target.value
                    });
                  } else {
                    const ttc = value;
                    const ht = calculateHT(ttc, formData.vat_type, purchase);
                    setRetailPrice({
                      ht: ht.toFixed(2),
                      margin: calculateMargin(
                        purchase,
                        ht,
                        formData.vat_type
                      ).toFixed(2),
                      ttc: e.target.value
                    });
                  }
                }}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                placeholder={formData.vat_type === 'margin' ? "Marge nette" : "Prix TTC"}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                {formData.vat_type === 'margin' ? "€" : "TTC"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prix de vente pro <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="text"
                value={proPrice.ht}
                onChange={(e) => {
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  const ht = parseFloat(e.target.value) || 0;
                  if (formData.vat_type === "margin") {
                    // Marge brute = prix vente TTC - prix achat
                    const pv = ht;
                    const margeBrute = pv - purchase;
                    const margeNette = margeBrute / 1.2;
                    const margePercent = purchase > 0 ? (margeNette / purchase) * 100 : 0;
                    setProPrice({
                      ht: e.target.value,
                      margin: margePercent.toFixed(2),
                      ttc: margeNette.toFixed(2)
                    });
                  } else {
                    setProPrice(prev => ({
                      ...prev,
                      ht: e.target.value,
                      margin: calculateMargin(
                        purchase,
                        ht,
                        formData.vat_type
                      ).toFixed(2),
                      ttc: calculateTTC(ht, formData.vat_type, purchase).toFixed(2)
                    }));
                  }
                }}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md"
                placeholder={formData.vat_type === 'margin' ? "Prix TVM" : "Prix HT"}
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                {formData.vat_type === 'margin' ? "TVM" : "HT"}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={proPrice.margin}
                onChange={(e) => {
                  const margin = parseFloat(e.target.value) || 0;
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  if (formData.vat_type === "margin") {
                    // Marge nette = (prix achat * marge %) / 100
                    const margeNette = (purchase * margin) / 100;
                    // Prix de vente TTC = prix achat + (marge nette * 1.2)
                    const pv = purchase + (margeNette * 1.2);
                    setProPrice({
                      ht: pv.toFixed(2),
                      margin: e.target.value,
                      ttc: margeNette.toFixed(2)
                    });
                  } else {
                    const ht = calculatePriceFromMargin(purchase, margin, formData.vat_type);
                    setProPrice({
                      ht: ht.toFixed(2),
                      margin: e.target.value,
                      ttc: calculateTTC(ht, formData.vat_type, purchase).toFixed(2)
                    });
                  }
                }}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-green-600"
                placeholder="Marge"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                %
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={proPrice.ttc}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const purchase = parseFloat(formData.purchase_price_with_fees) || 0;
                  if (formData.vat_type === "margin") {
                    // Prix de vente TTC = prix achat + (marge nette * 1.2)
                    const pv = purchase + (value * 1.2);
                    // Marge % = (marge nette / prix achat) * 100
                    const percent = purchase > 0 ? (value / purchase) * 100 : 0;
                    setProPrice({
                      ht: pv.toFixed(2),
                      margin: percent.toFixed(2),
                      ttc: e.target.value
                    });
                  } else {
                    const ttc = value;
                    const ht = calculateHT(ttc, formData.vat_type, purchase);
                    setProPrice({
                      ht: ht.toFixed(2),
                      margin: calculateMargin(
                        purchase,
                        ht,
                        formData.vat_type
                      ).toFixed(2),
                      ttc: e.target.value
                    });
                  }
                }}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                placeholder={formData.vat_type === 'margin' ? "Marge nette" : "Prix TTC"}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                {formData.vat_type === 'margin' ? "€" : "TTC"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock global <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alerte stock <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="stock_alert"
              value={formData.stock_alert}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              min="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            required
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsImageManagerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ImageIcon size={20} />
            Gestion des images ({productImages.length})
          </button>
        </div>

        <div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {initialProduct ? 'Mettre à jour' : 'Ajouter le produit'}
          </button>
        </div>
      </form>

      <ImageManager
        isOpen={isImageManagerOpen}
        onClose={() => setIsImageManagerOpen(false)}
        onImagesChange={setProductImages}
        currentImages={productImages}
      />

      <StockAllocationModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          if (onSubmitSuccess) {
            onSubmitSuccess();
          }
        }}
        productId={newProductId || ''}
        productName={newProductName}
        globalStock={globalStock}
      />

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
