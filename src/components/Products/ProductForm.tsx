import React, { useState, useEffect, useRef } from 'react';
import { Package, Bell, DollarSign, Settings, Users, ShoppingBag, Cloud, PenTool as Tool, Box, Layers, Image as ImageIcon, Download, Upload, ArrowRight, Plus } from 'lucide-react';
import { useProductStore } from '../../store/productStore';
import { useCategoryStore } from '../../store/categoryStore';
import { ImageManager } from './ImageManager';
import { StockAllocationModal } from './StockAllocationModal';
import { supabase } from '../../lib/supabase';
import { ImportDialog } from '../ImportProgress/ImportDialog';
import { useCSVImport } from '../../hooks/useCSVImport';
import { Toast } from '../Notifications/Toast';

interface Stock {
  id: string;
  name: string;
}

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
    // Champs supplémentaires utilisés par la logique du formulaire
    is_parent?: boolean;
    parent_id?: string | null;
    serial_number?: string | null;
    variants?: any[];
  };
  onSubmitSuccess?: () => void;
  showImageManager?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialProduct,
  onSubmitSuccess,
  showImageManager = false
}) => {
  // Différenciation parent/enfant
  const isParentProduct = initialProduct?.is_parent === true;
  const isChildProduct = initialProduct?.is_parent === false && initialProduct?.parent_id;
  
  console.log('ProductForm - Product type analysis:', {
    isParentProduct,
    isChildProduct,
    is_parent: initialProduct?.is_parent,
    parent_id: initialProduct?.parent_id,
    serial_number: initialProduct?.serial_number
  });

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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchStocks();
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

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setStocks(((data as any[]) || []).map((s: any) => ({ id: s.id, name: s.name })) as Stock[]);
    } catch (err) {
      console.error('Error fetching stocks:', err);
    }
  };

  // Détecter si c'est un produit parent qui peut accueillir des numéros de série
  const isSerialHostingParent = initialProduct && 
    initialProduct.is_parent && 
    initialProduct.variants && 
    Array.isArray(initialProduct.variants) && 
    initialProduct.variants.length > 0;

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
      // Détection d'un import de numéros de série si l'en-tête contient "serial_number"
      const firstLine = text.split('\n')[0]?.trim().toLowerCase() || '';
      if (isSerialHostingParent && firstLine.includes('serial_number')) {
        try {
          const lines = text.split('\n').map(r => r.trim()).filter(Boolean);
          const header = lines[0].split(',').map(h => h.trim());
          const headerLower = header.map(h => h.toLowerCase());
          // Champs requis minimaux
          const required = ['sku_parent', 'purchase_price_with_fees', 'supplier', 'serial_number'];
          const missing = required.filter(h => !headerLower.includes(h));
          if (missing.length) {
            throw new Error('En-têtes CSV invalides. Champs requis manquants: ' + missing.join(','));
          }
          // Indices de colonnes (accepte stock_name en plus de stock_id)
          const idx = (name: string) => headerLower.indexOf(name);
          const col = {
            sku_parent: idx('sku_parent'),
            purchase_price_with_fees: idx('purchase_price_with_fees'),
            retail_price: idx('retail_price'),
            pro_price: idx('pro_price'),
            raw_purchase_price: idx('raw_purchase_price'),
            stock_id: idx('stock_id'),
            stock_name: idx('stock_name'),
            stock_alert: idx('stock_alert'),
            vat_type: idx('vat_type'),
            warranty_sticker: idx('warranty_sticker'),
            supplier: idx('supplier'),
            battery_percentage: idx('battery_percentage'),
            serial_number: idx('serial_number'),
            product_note: idx('product_note')
          };
          const rows = lines.slice(1);
          if (rows.length === 0) {
            throw new Error('Le fichier CSV est vide');
          }
          startImport(rows.length);
          const importErrors: { line: number; message: string }[] = [];
          let successCount = 0;

          for (let i = 0; i < rows.length; i++) {
            try {
              const fields = rows[i].split(',').map(field => field?.trim() || '');
              const get = (ix: number) => (ix >= 0 ? (fields[ix] ?? '').trim() : '');
              const sku_parent = get(col.sku_parent);
              const purchase_price_with_fees = get(col.purchase_price_with_fees);
              const retail_price = get(col.retail_price);
              const pro_price = get(col.pro_price);
              const raw_purchase_price = get(col.raw_purchase_price);
              const stock_id_val = get(col.stock_id);
              const stock_name_val = get(col.stock_name);
              const stock_alert = get(col.stock_alert);
              const vat_type = get(col.vat_type) || 'normal';
              const warranty_sticker = get(col.warranty_sticker);
              const supplier = get(col.supplier);
              const battery_percentage = get(col.battery_percentage);
              const serial_number = get(col.serial_number);
              const product_note = get(col.product_note);

              if (!serial_number || !purchase_price_with_fees || !supplier) {
                throw new Error(`Champs obligatoires manquants: ${rows[i]}`);
              }

              // Valider que le SKU parent correspond au parent courant (si renseigné)
              if (initialProduct?.sku && sku_parent && sku_parent !== initialProduct.sku) {
                throw new Error(`SKU parent "${sku_parent}" ne correspond pas au parent courant "${initialProduct.sku}"`);
              }

              // Résoudre le stock: utiliser stock_id direct si fourni, sinon stock_name
              let stockId: string | null = null;
              if (stock_id_val) {
                stockId = stock_id_val;
              } else if (stock_name_val) {
                const stk = stocks.find(s => s.name.toLowerCase() === stock_name_val.toLowerCase());
                if (stk) {
                  stockId = stk.id;
                } else {
                  throw new Error(`Stock "${stock_name_val}" non trouvé`);
                }
              }

              const serialProductData: any = {
                name: initialProduct?.name,
                sku: `${initialProduct?.sku}-${serial_number}`,
                serial_number,
                purchase_price_with_fees: parseFloat(purchase_price_with_fees),
                retail_price: retail_price ? parseFloat(retail_price) : null,
                pro_price: pro_price ? parseFloat(pro_price) : null,
                raw_purchase_price: raw_purchase_price ? parseFloat(raw_purchase_price) : null,
                stock_id: stockId,
                stock_alert: stock_alert ? parseInt(stock_alert) : null,
                vat_type: vat_type || 'normal',
                warranty_sticker: warranty_sticker || null,
                supplier,
                battery_level: battery_percentage ? parseInt(battery_percentage) : null,
                product_note: product_note || null,
                parent_id: initialProduct?.id,
                is_parent: false,
                stock: 1,
                // Copier les attributs du parent
                category_id: initialProduct?.category_id,
                weight_grams: initialProduct?.weight_grams,
                width_cm: initialProduct?.width_cm,
                height_cm: initialProduct?.height_cm,
                depth_cm: initialProduct?.depth_cm,
                description: initialProduct?.description,
                ean: initialProduct?.ean,
                variants: (initialProduct as any)?.variants,
                images: initialProduct?.images
              };

              await addProduct(serialProductData);
              successCount++;
              incrementProgress();
            } catch (err) {
              console.error('Error importing serial product:', err);
              importErrors.push({
                line: i + 2,
                message: `Erreur avec la ligne ${rows[i]}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
              });
            }
          }

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          setToast({
            type: importErrors.length > 0 ? 'error' : 'success',
            message: `Import numéros de série terminé : ${successCount} succès, ${importErrors.length} erreurs.`
          });

          // Ne pas afficher de message via ImportDialog, uniquement un toast récapitulatif
          closeDialog();

          if (onSubmitSuccess) {
            onSubmitSuccess();
          }
          return;
        } catch (e) {
          console.error('Error importing serial CSV:', e);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // Toast récapitulatif uniquement
          setToast({
            type: 'error',
            message: `Import numéros de série terminé : 0 succès, 1 erreurs.`
          });
          // Fermer la boîte de progression si ouverte
          closeDialog();
          return;
        }
      }

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
            .select('id, stock, ean')
            .eq('sku', product.sku)
            .single();
          const existingProductAny = existingProduct as any;

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
            ean: existingProductAny?.ean || product.ean,
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

          if (existingProductAny) {
            await updateProduct(existingProductAny.id, {
              ...productData,
              stock: (existingProductAny.stock || 0) + parseInt(product.stock)
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

  const downloadSampleCSV = (isSerialImport = false) => {
    console.log('downloadSampleCSV called with:', {
      isSerialImport,
      isSerialHostingParent,
      hasInitialProduct: !!initialProduct,
      initialProductId: initialProduct?.id,
      initialProductName: initialProduct?.name,
      initialProductSku: initialProduct?.sku,
      initialProductIsParent: initialProduct?.is_parent,
      initialProductVariants: initialProduct?.variants
    });
    
      if (isSerialImport && isSerialHostingParent) {
        // CSV pour l'import de numéros de série (avec colonnes imposées et SKU parent prérempli)
        const headers = [
          'sku_parent',
          'purchase_price_with_fees',
          'retail_price',
          'pro_price',
          'raw_purchase_price',
          'stock_id',
          'stock_name',
          'stock_alert',
          'vat_type',
          'warranty_sticker',
          'supplier',
          'battery_percentage',
          'serial_number',
          'product_note'
        ];

        const firstStock = stocks[0] || { id: 'STOCK_ID_1', name: 'STOCK-NAME-1' };
        const secondStock = stocks[1] || firstStock;

        // Ligne exemple avec TVA normale
        const row1 = [
          initialProduct?.sku || '',
          '900.00',
          '1200.00',
          '1100.00',
          '850.00',
          firstStock.id,
          firstStock.name,
          '1',
          'normal',
          'present',
          'FOURNISSEUR-EXEMPLE',
          '85',
          'SN123456789',
          'Notes optionnelles'
        ];

        // Ligne exemple avec TVA sur marge
        const row2 = [
          initialProduct?.sku || '',
          '900.00',
          '',
          '',
          '',
          secondStock.id,
          secondStock.name,
          '1',
          'margin',
          'present',
          'FOURNISSEUR-EXEMPLE',
          '80',
          'SN987654321',
          ''
        ];

        // Annexe: liste des stocks disponibles (id + nom)
        const stockReferenceLines = [
          '',
          'stock_id,stock_name',
          ...stocks.map(s => `${s.id},${s.name}`)
        ];

        const csvContent = [
          headers.join(','),
          row1.join(','),
          row2.join(','),
          ...stockReferenceLines
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

    // CSV générique pour les produits (logique existante)
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
        pro_margin_value: proPrice.ttc ? parseFloat(proPrice.ttc) : null,
        parent_id: null,
        is_parent: true
      };

      if (initialProduct) {
        await updateProduct(initialProduct.id, productData);
        
        
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
            <p className="text-blue-700">Ajouter plusieurs numéros de série au parent ? 📦</p>
            <ArrowRight className="text-blue-500 animate-bounce" size={20} />
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => downloadSampleCSV(isSerialHostingParent)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download size={18} />
              {isSerialHostingParent ? 'Télécharger modèle CSV numéros de série 📥' : 'Télécharger un modèle CSV 📥'}
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
              <Upload size={18} />
              {isSerialHostingParent ? 'Importer numéros de série CSV 📂' : 'Importer un fichier CSV 📂'}
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
          {!isParentProduct && (
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
          )}
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
          {!isParentProduct && (
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
          )}
          {!isParentProduct && (
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
          )}
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

        {!isParentProduct && (
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
          )}

          {!isParentProduct && (
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
          )}

          {!isParentProduct && (
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
          )}

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
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
