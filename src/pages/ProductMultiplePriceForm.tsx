import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, ArrowRight } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';
import { useProductStore } from '../store/productStore';
import { useCategoryStore } from '../store/categoryStore';
import { useVariantStore } from '../store/variantStore';
import { ImageManager } from '../components/Products/ImageManager';
import { ImportDialog } from '../components/ImportProgress/ImportDialog';
import { useCSVImport } from '../hooks/useCSVImport';
import { supabase } from '../lib/supabase';

export const ProductMultiplePriceForm: React.FC = () => {
  const { addProduct } = useProductStore();
  const { categories, fetchCategories, addCategory } = useCategoryStore();
  const { variants, fetchVariants, addVariant } = useVariantStore();
  const { navigateToProduct } = useNavigate();
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const serialFileInputRef = React.useRef<HTMLInputElement>(null);
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  // État pour le produit parent en cours d'édition
  const [initialProduct, setInitialProduct] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [stocks, setStocks] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    weight_grams: '',
    ean: '',
    description: '',
    width_cm: '',
    height_cm: '',
    depth_cm: ''
  });

  const [selectedCategory, setSelectedCategory] = useState({
    type: '',
    brand: '',
    model: ''
  });

  const [selectedVariants, setSelectedVariants] = useState<{
    color: string;
    grade: string;
    capacity: string;
    sim_type: string;
  }[]>([{
    color: '',
    grade: '',
    capacity: '',
    sim_type: ''
  }]);

  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchVariants();
    fetchStocks();
    
    // Vérifier si on édite un produit parent existant
    const editProductId = sessionStorage.getItem('editProductId');
    if (editProductId) {
      setIsEditMode(true);
      loadProductForEdit(editProductId);
    }
  }, [fetchCategories, fetchVariants]);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setStocks(data || []);
    } catch (err) {
      console.error('Error fetching stocks:', err);
    }
  };

  const loadProductForEdit = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(type, brand, model)
        `)
        .eq('id', productId)
        .single();
      
      if (error) throw error;
      
      setInitialProduct(data);
      
      // Pré-remplir le formulaire avec les données existantes
      setFormData({
        name: data.name || '',
        sku: data.sku || '',
        weight_grams: data.weight_grams?.toString() || '',
        ean: data.ean || '',
        description: data.description || '',
        width_cm: data.width_cm?.toString() || '',
        height_cm: data.height_cm?.toString() || '',
        depth_cm: data.depth_cm?.toString() || ''
      });
      
      if (data.category) {
        setSelectedCategory({
          type: data.category.type || '',
          brand: data.category.brand || '',
          model: data.category.model || ''
        });
      }
      
      if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
        setSelectedVariants(data.variants);
      }
      
      if (data.images) {
        setProductImages(data.images);
      }
    } catch (err) {
      console.error('Error loading product for edit:', err);
      setError('Erreur lors du chargement du produit');
    }
  };
  // Get unique values for category dropdowns
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

  // Get unique values for variant dropdowns
  const uniqueColors = Array.from(new Set(variants.map(v => v.color))).sort();
  const uniqueGrades = Array.from(new Set(variants.map(v => v.grade))).sort();
  const uniqueCapacities = Array.from(new Set(variants.map(v => v.capacity))).sort();
  const uniqueSimTypes = Array.from(new Set(variants.map(v => v.sim_type).filter(Boolean))).sort();

  // Vérifier si c'est un produit parent qui accueille des numéros de série
  const isSerialHostingParent = isEditMode && initialProduct && 
    initialProduct.is_parent && 
    initialProduct.variants && 
    Array.isArray(initialProduct.variants) && 
    initialProduct.variants.length > 0;
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

  const handleVariantChange = (index: number, field: keyof (typeof selectedVariants)[0], value: string) => {
    const newVariants = [...selectedVariants];
    value = value.toUpperCase();
    newVariants[index] = {
      ...newVariants[index],
      [field]: value
    };
    setSelectedVariants(newVariants);
  };

  const downloadSampleCSV = (isSerialImport = false) => {
    console.log('downloadSampleCSV called with:', {
      isSerialImport,
      isEditMode,
      hasInitialProduct: !!initialProduct,
      initialProductId: initialProduct?.id,
      initialProductName: initialProduct?.name,
      initialProductSku: initialProduct?.sku,
      initialProductIsParent: initialProduct?.is_parent,
      initialProductVariants: initialProduct?.variants
    });
    
    if (isSerialImport && isEditMode && initialProduct) {
      // CSV dynamique pour l'import de numéros de série (colonnes imposées + SKU parent prérempli)
      const headers = [
        'sku_parent',
        'purchase_price_with_fees',
        'retail_price',
        'pro_price',
        'raw_purchase_price',
        'stock_id',
        'stock_alert',
        'vat_type',
        'warranty_sticker',
        'supplier',
        'battery_percentage',
        'serial_number',
        'product_note'
      ];

      const sampleData = [
        initialProduct.sku,
        '900.00',
        '1200.00',
        '1100.00',
        '850.00',
        'STOCK-A1',
        '1',
        'normal',
        'present',
        'FOURNISSEUR-EXEMPLE',
        '85',
        'SN123456789',
        'Notes optionnelles'
      ];

      const csvContent = [
        headers.join(','),
        sampleData.join(',')
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `serial_numbers_template_${initialProduct.sku.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Serial numbers CSV template downloaded');
      return;
    }

    // CSV générique pour les produits parents (logique existante)
    const headers = [
      'name',
      'sku',
      'weight_grams',
      'ean',
      'description',
      'width_cm',
      'height_cm',
      'depth_cm',
      'category_type',
      'category_brand',
      'category_model',
      'color',
      'grade',
      'capacity',
      'sim_type'
    ];

    const sampleData = [
      'iPhone 14 Pro Max 128Go Noir Grade A+',
      'IPH14PM-128-BLK',
      '240',
      '123456789012',
      'iPhone 14 Pro Max 128Go Noir Grade A+',
      '7.85',
      '16.07',
      '0.78',
      'SMARTPHONE',
      'APPLE',
      'IPHONE 14 PRO MAX',
      'NOIR',
      'A+',
      '128GO',
      '1 SIM'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'produits_parents_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isSerialImport = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isSerialImport && isSerialHostingParent && initialProduct) {
      // Import de numéros de série pour le produit parent
      try {
        const text = await file.text();
        const rows = text.split('\n')
          .map(row => row.trim())
          .filter(row => row && !row.startsWith('sku_parent')); // Skip header and empty rows

        if (rows.length === 0) {
          throw new Error('Le fichier CSV est vide');
        }

        startImport(rows.length);
        const importErrors: { line: number; message: string }[] = [];

        for (let i = 0; i < rows.length; i++) {
          try {
            const [
              sku_parent, purchase_price_with_fees, retail_price, pro_price, raw_purchase_price,
              stock_id, stock_alert, vat_type, warranty_sticker, supplier, battery_percentage,
              serial_number, product_note
            ] = rows[i].split(',').map(field => field?.trim() || '');
            
            if (!serial_number || !purchase_price_with_fees || !supplier) {
              throw new Error(`Champs obligatoires manquants: ${rows[i]}`);
            }

            // Récupérer l'ID du stock par son nom
            let stockId = null;
            if (stock_id) {
              const stock = stocks.find(s => s.name === stock_id.toUpperCase());
              if (stock) {
                stockId = stock.id;
              } else {
                throw new Error(`Stock "${stock_id}" non trouvé`);
              }
            }

            // Créer le produit enfant avec numéro de série
            const serialProductData = {
              name: initialProduct.name,
              sku: `${initialProduct.sku}-${serial_number}`,
              serial_number: serial_number,
              purchase_price_with_fees: parseFloat(purchase_price_with_fees),
              retail_price: retail_price ? parseFloat(retail_price) : null,
              pro_price: pro_price ? parseFloat(pro_price) : null,
              raw_purchase_price: raw_purchase_price ? parseFloat(raw_purchase_price) : null,
              stock_id: stockId,
              stock_alert: stock_alert ? parseInt(stock_alert) : null,
              vat_type: vat_type || 'normal',
              warranty_sticker: warranty_sticker || null,
              supplier: supplier,
              battery_level: battery_percentage ? parseInt(battery_percentage) : null,
              product_note: product_note || null,
              parent_id: initialProduct.id,
              is_parent: false,
              stock: 1,
              // Copier les attributs du parent
              category_id: initialProduct.category_id,
              weight_grams: initialProduct.weight_grams,
              width_cm: initialProduct.width_cm,
              height_cm: initialProduct.height_cm,
              depth_cm: initialProduct.depth_cm,
              description: initialProduct.description,
              ean: initialProduct.ean,
              variants: initialProduct.variants,
              images: initialProduct.images
            };

            await addProduct(serialProductData);
            incrementProgress();
          } catch (err) {
            console.error('Error importing serial product:', err);
            importErrors.push({
              line: i + 2,
              message: `Erreur avec le numéro de série ${rows[i]}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
            });
          }
        }

        if (serialFileInputRef.current) {
          serialFileInputRef.current.value = '';
        }

        if (importErrors.length > 0) {
          setImportError(importErrors);
        } else {
          setImportSuccess(`${rows.length} numéros de série importés avec succès`);
        }
        
        return;
      } catch (error) {
        console.error('Import error:', error);
        setImportError([{
          line: 0,
          message: error instanceof Error ? error.message : 'Erreur lors de l\'importation'
        }]);
        return;
      }
    }

    // Import de produits parents (logique existante)
    try {
      const text = await file.text();
      const rows = text.split('\n')
        .map(row => row.trim())
        .filter(row => row && !row.startsWith('name')); // Skip header and empty rows

      if (rows.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }

      startImport(rows.length);
      const importErrors: { line: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        try {
          const [
            name, sku, weight_grams, ean, description, width_cm, height_cm, depth_cm,
            category_type, category_brand, category_model,
            color, grade, capacity, sim_type
          ] = rows[i].split(',').map(field => field?.trim() || '');
          
          if (!name || !sku || !category_type || !category_brand || !category_model || 
              !color || !grade || !capacity) {
            throw new Error(`Champs obligatoires manquants: ${rows[i]}`);
          }

          // Créer ou récupérer la catégorie
          const category = await addCategory({
            type: category_type.toUpperCase(),
            brand: category_brand.toUpperCase(),
            model: category_model.toUpperCase()
          });

          // Créer ou récupérer la variante
          await addVariant({
            color: color.toUpperCase(),
            grade: grade.toUpperCase(),
            capacity: capacity.toUpperCase(),
            sim_type: (sim_type || '').toUpperCase()
          });

          // Créer le produit parent
          const productData = {
            name: name,
            sku: sku,
            weight_grams: parseInt(weight_grams) || 0,
            ean: ean || null,
            description: description || null,
            width_cm: parseFloat(width_cm) || null,
            height_cm: parseFloat(height_cm) || null,
            depth_cm: parseFloat(depth_cm) || null,
            images: [],
            category_id: category?.id || null,
            variants: [{
              color: color.toUpperCase(),
              grade: grade.toUpperCase(),
              capacity: capacity.toUpperCase(),
              sim_type: (sim_type || '').toUpperCase()
            }],
            // PAM = Parent Prix d'achat multiple sans numéro de série
            product_type: 'PAM' as 'PAM',
            is_parent: true,
            stock: 0,
            stock_alert: 0
          };

          await addProduct(productData);
          incrementProgress();
        } catch (err) {
          console.error('Error importing product:', err);
          importErrors.push({
            line: i + 2,
            message: `Erreur avec le produit ${rows[i]}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
          });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (importErrors.length > 0) {
        setImportError(importErrors);
      } else {
        setImportSuccess(`${rows.length} produits parents importés avec succès`);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportError([{
        line: 0,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'importation'
      }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all required fields
    const requiredFields = [
      { field: 'name', label: 'Nom du produit' },
      { field: 'sku', label: 'SKU' },
      { field: 'weight_grams', label: 'Poids' },
      { field: 'ean', label: 'EAN' },
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
        weight_grams: parseInt(formData.weight_grams),
        ean: formData.ean,
        description: formData.description,
        width_cm: parseFloat(formData.width_cm),
        height_cm: parseFloat(formData.height_cm),
        depth_cm: parseFloat(formData.depth_cm),
        images: productImages,
        category_id: categoryId,
        variants: selectedVariants,
        // PAM = Parent Prix d'achat multiple sans numéro de série
        product_type: 'PAM' as 'PAM',
        is_parent: true,
        stock: 0,
        stock_alert: 0
      };

      await addProduct(productData);
      navigateToProduct('product-list');
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Une erreur est survenue lors de l\'enregistrement du produit.');
    }
  };

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

      {/* CSV Import Section pour numéros de série (si produit parent en édition) */}
      {isSerialHostingParent && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-blue-700">Ajouter plusieurs numéros de série au parent ? 📦</p>
              <ArrowRight className="text-blue-500 animate-bounce" size={20} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => downloadSampleCSV(true)}
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
                  onChange={(e) => handleFileUpload(e, true)}
                  accept=".csv"
                  className="hidden"
                  ref={serialFileInputRef}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Section pour produits parents (si création) */}
      {!isEditMode && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-blue-700">Vous avez plusieurs produits parents à créer ? 📦</p>
              <ArrowRight className="text-blue-500 animate-bounce" size={20} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => downloadSampleCSV(false)}
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
                  onChange={(e) => handleFileUpload(e, false)}
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {isEditMode ? 'Modifier le produit parent' : 'Ajouter un produit (prix d\'achat multiple sans numéro de série)'}
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

        {/* Variantes du produit */}
        <div className="bg-gray-50 p-4 rounded-lg mt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Variantes du produit</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Couleur <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVariants[0].color}
                onChange={(e) => handleVariantChange(0, 'color', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              >
                <option value="">Sélectionner une couleur</option>
                {uniqueColors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVariants[0].grade}
                onChange={(e) => handleVariantChange(0, 'grade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              >
                <option value="">Sélectionner un grade</option>
                {uniqueGrades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacité en GO <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVariants[0].capacity}
                onChange={(e) => handleVariantChange(0, 'capacity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              >
                <option value="">Sélectionner une capacité</option>
                {uniqueCapacities.map(capacity => (
                  <option key={capacity} value={capacity}>{capacity}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de SIM <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedVariants[0].sim_type}
                onChange={(e) => handleVariantChange(0, 'sim_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              >
                <option value="">Sélectionner un type</option>
                {uniqueSimTypes.map(simType => (
                  <option key={simType} value={simType}>{simType}</option>
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
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              placeholder="SKU"
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
              onChange={(e) => setFormData(prev => ({ ...prev, ean: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, weight_grams: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              placeholder="Poids en grammes"
            />
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
                onChange={(e) => setFormData(prev => ({ ...prev, width_cm: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, depth_cm: e.target.value }))}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
            Gestion des images ({productImages.length})
          </button>
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigateToProduct('add-product-pam')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Retour
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isEditMode ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <ImageManager
        isOpen={isImageManagerOpen}
        onClose={() => setIsImageManagerOpen(false)}
        onImagesChange={setProductImages}
        currentImages={productImages}
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
