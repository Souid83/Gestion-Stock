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
  const isParentProduct = (initialProduct as any)?.product_type === 'PAM';
  const isChildProduct = initialProduct?.is_parent === false && initialProduct?.parent_id;
  const isMirrorChild = !!(initialProduct?.parent_id) && !initialProduct?.serial_number;
  const isEditing = !!initialProduct;
  
  console.log('ProductForm - Product type analysis:', {
    isParentProduct,
    isChildProduct,
    is_parent: initialProduct?.is_parent,
    parent_id: initialProduct?.parent_id,
    serial_number: initialProduct?.serial_number
  });

  const { addProduct, addSerialChild, updateProduct } = useProductStore();
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

  // Empêcher l'ouverture du modal de répartition pendant l'import CSV
  const isCSVImporting = useRef(false);

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
  const [nameTouched, setNameTouched] = useState(false);
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

  // Sentinelle: fermer le modal de répartition dès qu'un import est en cours
  useEffect(() => {
    if (importState.isDialogOpen) {
      setIsStockModalOpen(false);
    }
  }, [importState.isDialogOpen]);

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

  const isPAMParent = !!(initialProduct && initialProduct.is_parent && (initialProduct as any).product_type === 'PAM');

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

  // Auto-fill derived fields on open/import: complete missing values with 2 decimals
  useEffect(() => {
    const vat = (formData.vat_type || 'normal').toLowerCase();
    const purchaseStr = (formData.purchase_price_with_fees || '').toString().trim();
    const purchase = parseFloat(purchaseStr.replace(',', '.'));
    if (!isFinite(purchase) || purchase <= 0) return;

    const fmt2 = (n: number) => {
      if (!isFinite(n)) return '';
      return Number(n).toFixed(2);
    };

    const onlyOneProvided = (a?: string, b?: string, c?: string) => {
      const nums = [a, b, c].map(v => {
        const s = (v || '').toString().trim();
        const n = parseFloat(s.replace(',', '.'));
        return s !== '' && !isNaN(n);
      });
      return nums.filter(Boolean).length === 1;
    };

    const parse = (s?: string) => {
      const t = (s || '').toString().trim();
      const n = parseFloat(t.replace(',', '.'));
      return !isNaN(n) ? n : NaN;
    };

    const fillRetail = () => {
      const pStr = retailPrice.ht;
      const pctStr = retailPrice.margin;
      const thirdStr = retailPrice.ttc; // TVA normale: TTC; TVM: Marge nette €

      if (vat === 'margin') {
        // TVM: champs = Prix (TVM), Marge %, Marge nette (€)
        const price = parse(pStr);
        const pct = parse(pctStr);
        const net = parse(thirdStr);

        let newPrice: number | undefined;
        let newPct: number | undefined;
        let newNet: number | undefined;

        const hasPrice = isFinite(price);
        const hasPct = isFinite(pct);
        const hasNet = isFinite(net);
        const priceEmpty = (pStr ?? '').toString().trim() === '';
        const pctEmpty = (pctStr ?? '').toString().trim() === '';
        const netEmpty = (thirdStr ?? '').toString().trim() === '';

        if (hasPrice) {
          if (netEmpty) {
            const netVal = (price - purchase) / 1.2;
            newNet = netVal;
          }
          if (pctEmpty) {
            const netVal = hasNet ? net : ((price - purchase) / 1.2);
            const pctVal = purchase > 0 ? (netVal / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasNet) {
          if (priceEmpty) {
            const priceVal = purchase + net * 1.2;
            newPrice = priceVal;
          }
          if (pctEmpty) {
            const pctVal = purchase > 0 ? (net / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasPct) {
          if (netEmpty) {
            const netVal = (purchase * pct) / 100;
            newNet = netVal;
          }
          if (priceEmpty) {
            const baseNet = netEmpty ? (purchase * pct) / 100 : net;
            const priceVal = purchase + baseNet * 1.2;
            newPrice = priceVal;
          }
        }

        if (newPrice !== undefined || newPct !== undefined || newNet !== undefined) {
          setRetailPrice(prev => ({
            ht: newPrice !== undefined ? fmt2(newPrice) : prev.ht,
            margin: newPct !== undefined ? fmt2(newPct) : prev.margin,
            ttc: newNet !== undefined ? fmt2(newNet) : prev.ttc
          }));
        }
      } else {
        // TVA normale: champs = Prix HT, Marge %, Prix TTC
        const ht = parse(pStr);
        const pct = parse(pctStr);
        const ttc = parse(thirdStr);

        let newHT: number | undefined;
        let newPct: number | undefined;
        let newTTC: number | undefined;

        const hasHT = isFinite(ht);
        const hasPct = isFinite(pct);
        const hasTTC = isFinite(ttc);
        const htEmpty = (pStr ?? '').toString().trim() === '';
        const pctEmpty = (pctStr ?? '').toString().trim() === '';
        const ttcEmpty = (thirdStr ?? '').toString().trim() === '';

        if (hasHT) {
          if (ttcEmpty) {
            newTTC = ht * 1.2;
          }
          if (pctEmpty) {
            const pctVal = purchase > 0 ? ((ht - purchase) / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasTTC) {
          if (htEmpty) {
            const htVal = ttc / 1.2;
            newHT = htVal;
            if (pctEmpty) {
              const pctVal = purchase > 0 ? ((htVal - purchase) / purchase) * 100 : 0;
              newPct = pctVal;
            }
          }
        } else if (hasPct) {
          // Si seule la marge est présente
          const htVal = purchase * (1 + pct / 100);
          if (htEmpty) newHT = htVal;
          if (ttcEmpty) newTTC = htVal * 1.2;
        }

        if (newHT !== undefined || newPct !== undefined || newTTC !== undefined) {
          setRetailPrice(prev => ({
            ht: newHT !== undefined ? fmt2(newHT) : prev.ht,
            margin: newPct !== undefined ? fmt2(newPct) : prev.margin,
            ttc: newTTC !== undefined ? fmt2(newTTC) : prev.ttc
          }));
        }
      }
    };

    const fillPro = () => {
      const pStr = proPrice.ht;
      const pctStr = proPrice.margin;
      const thirdStr = proPrice.ttc; // TVA normale: TTC; TVM: Marge nette €

      if (vat === 'margin') {
        // TVM
        const price = parse(pStr);
        const pct = parse(pctStr);
        const net = parse(thirdStr);

        let newPrice: number | undefined;
        let newPct: number | undefined;
        let newNet: number | undefined;

        const hasPrice = isFinite(price);
        const hasPct = isFinite(pct);
        const hasNet = isFinite(net);
        const priceEmpty = (pStr ?? '').toString().trim() === '';
        const pctEmpty = (pctStr ?? '').toString().trim() === '';
        const netEmpty = (thirdStr ?? '').toString().trim() === '';

        if (hasPrice) {
          if (netEmpty) {
            const netVal = (price - purchase) / 1.2;
            newNet = netVal;
          }
          if (pctEmpty) {
            const netVal = hasNet ? net : ((price - purchase) / 1.2);
            const pctVal = purchase > 0 ? (netVal / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasNet) {
          if (priceEmpty) {
            const priceVal = purchase + net * 1.2;
            newPrice = priceVal;
          }
          if (pctEmpty) {
            const pctVal = purchase > 0 ? (net / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasPct) {
          if (netEmpty) {
            const netVal = (purchase * pct) / 100;
            newNet = netVal;
          }
          if (priceEmpty) {
            const baseNet = netEmpty ? (purchase * pct) / 100 : net;
            const priceVal = purchase + baseNet * 1.2;
            newPrice = priceVal;
          }
        }

        if (newPrice !== undefined || newPct !== undefined || newNet !== undefined) {
          setProPrice(prev => ({
            ht: newPrice !== undefined ? fmt2(newPrice) : prev.ht,
            margin: newPct !== undefined ? fmt2(newPct) : prev.margin,
            ttc: newNet !== undefined ? fmt2(newNet) : prev.ttc
          }));
        }
      } else {
        // TVA normale
        const ht = parse(pStr);
        const pct = parse(pctStr);
        const ttc = parse(thirdStr);

        let newHT: number | undefined;
        let newPct: number | undefined;
        let newTTC: number | undefined;

        const hasHT = isFinite(ht);
        const hasPct = isFinite(pct);
        const hasTTC = isFinite(ttc);
        const htEmpty = (pStr ?? '').toString().trim() === '';
        const pctEmpty = (pctStr ?? '').toString().trim() === '';
        const ttcEmpty = (thirdStr ?? '').toString().trim() === '';

        if (hasHT) {
          if (ttcEmpty) {
            newTTC = ht * 1.2;
          }
          if (pctEmpty) {
            const pctVal = purchase > 0 ? ((ht - purchase) / purchase) * 100 : 0;
            newPct = pctVal;
          }
        } else if (hasTTC) {
          if (htEmpty) {
            const htVal = ttc / 1.2;
            newHT = htVal;
            if (pctEmpty) {
              const pctVal = purchase > 0 ? ((htVal - purchase) / purchase) * 100 : 0;
              newPct = pctVal;
            }
          }
        } else if (hasPct) {
          const htVal = purchase * (1 + pct / 100);
          if (htEmpty) newHT = htVal;
          if (ttcEmpty) newTTC = htVal * 1.2;
        }

        if (newHT !== undefined || newPct !== undefined || newTTC !== undefined) {
          setProPrice(prev => ({
            ht: newHT !== undefined ? fmt2(newHT) : prev.ht,
            margin: newPct !== undefined ? fmt2(newPct) : prev.margin,
            ttc: newTTC !== undefined ? fmt2(newTTC) : prev.ttc
          }));
        }
      }
    };

    fillRetail();
    fillPro();
  // Only run on initial open or when base inputs change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct, formData.vat_type, formData.purchase_price_with_fees]);

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
    // L'utilisateur tape le nom manuellement -> on désactive l'auto-composition
    if (name === 'name') {
      setNameTouched(true);
      setFormData(prev => ({ ...prev, name: value }));
      return;
    }
    // Forcer l'UPPERCASE pour les SKU dès la saisie
    if (name === 'sku') {
      setFormData(prev => ({ ...prev, sku: (value || '').toUpperCase() }));
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
        // N'auto-compléter le nom que lors de la création ET si le champ Nom n'a pas encore été saisi
        setFormData(prev => {
          if (!isEditing && !nameTouched && ((prev.name || '').trim() === '')) {
            return { ...prev, name: parts.join(' ') };
          }
          return prev;
        });
      }
    }
  };

  // Fonction utilitaire pour normaliser les noms de colonnes CSV
  const normalizeColumnName = (name: string): string => {
    console.log('Normalisation de la colonne:', { original: name });
    // Retirer BOM éventuel, espaces insécables, guillemets englobants
    let normalized = name.replace(/^\uFEFF/, '').replace(/\u00A0/g, ' ');
    normalized = normalized.replace(/^"+|"+$/g, '');
    normalized = normalized.trim();
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.toLowerCase();
    console.log('Colonne normalisée:', { original: name, normalized });
    return normalized;
  };

  // Ligne "structurellement vide" (uniquement séparateurs, guillemets et espaces)
  const isStructuralEmpty = (line: string): string | false => {
    const stripped = (line || '').replace(/["\s,;]+/g, '');
    return stripped.length === 0 ? (line || '') : false;
  };

  // Clef robuste pour matcher les noms de stocks (ignore espaces/ponctuation/accents/casse)
  const normalizeStockKey = (s: string): string => {
    if (!s) return '';
    const noNbsp = s.replace(/\u00A0/g, ' ');
    const lower = noNbsp.toLowerCase();
    // NFKD pour décomposer les accents, puis enlever tout sauf a-z0-9
    return lower.normalize('NFKD').replace(/[^a-z0-9]/g, '');
  };

  const detectCSVSeparator = (text: string): string => {
    // Retirer BOM et trouver la première vraie ligne d'en-tête (non vide, non commentée)
    const lines = text.replace(/^\uFEFF/, '').split('\n');
    const headerLineRaw = (lines.find(l => l && !l.trim().startsWith('#') && !isStructuralEmpty(l)) || '').trim();
    console.log('Détection du séparateur CSV pour (header réel):', headerLineRaw.substring(0, 120));

    const candidates: Array<',' | ';'> = [',', ';'];

    const scoreFor = (sep: ',' | ';') => {
      const fields = parseCSVLine(headerLineRaw, sep).map(h => normalizeColumnName(h));
      const baseExpected = new Set<string>([
        'name','sku','purchase_price_with_fees','retail_price','pro_price',
        'weight_grams','location','ean','stock','stock_alert','description',
        'width_cm','height_cm','depth_cm',
        'category_type','category_brand','category_model',
        'vat_type','margin_percent','pro_margin_percent'
      ]);
      let matches = 0;
      for (const f of fields) {
        if (baseExpected.has(f)) matches++;
      }
      const stockCols = fields.filter(f => f.startsWith('stock_')).length;
      return matches + stockCols;
    };

    // Heuristique: choisir le séparateur qui matche le plus d'en-têtes attendues
    const scores = candidates.map(sep => ({ sep, score: scoreFor(sep) }));
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // En cas d'égalité, fallback au comptage brut sur la ligne d'en-tête
    if (scores.length > 1 && best.score === scores[1].score) {
      const commaCount = (headerLineRaw.match(/,/g) || []).length;
      const semicolonCount = (headerLineRaw.match(/;/g) || []).length;
      const sep = semicolonCount > commaCount ? ';' : ',';
      console.log('Séparateur détecté (fallback counts):', { sep, commaCount, semicolonCount });
      return sep;
    }

    const sep = best?.sep || ',';
    console.log('Séparateur détecté (heuristique):', { sep, score: best?.score });
    return sep;
  };

  const parseCSVLine = (line: string, separator: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);

    console.log(`Parsing CSV line - Champs extraits: ${result.length}`);
    return result;
  };

  // Robust CSV parser (RFC 4180-like) - handles quotes, escaped quotes, commas and newlines inside cells
  const parseCSV = (csvText: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(cell.trim());
          cell = '';
        } else if (ch === '\n') {
          row.push(cell.trim());
          if (row.some(c => c !== '')) rows.push(row);
          row = [];
          cell = '';
        } else if (ch === '\r') {
          // ignore
        } else {
          cell += ch;
        }
      }
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell.trim());
      if (row.some(c => c !== '')) rows.push(row);
    }

    return rows;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Bloquer le modal de répartition de stock pendant l'import
    isCSVImporting.current = true;
    setIsStockModalOpen(false);

    try {
      const raw = await file.text();
      const content = raw.replace(/^\uFEFF/, '');
      const firstLineNonComment = (content.split('\n').find(l => l && !l.trim().startsWith('#')) || '').trim().toLowerCase();
      if (firstLineNonComment.includes('serial_number')) {
        try {
          const lines = content.split('\n').map((r: string) => r.trim()).filter(Boolean);
          const header = (lines[0] as string).split(',').map((h: string) => h.trim());
          const headerLower = header.map((h: string) => h.toLowerCase());
          // Champs requis minimaux
          const required = ['serial_number', 'purchase_price_with_fees', 'supplier', 'stock_name'];
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
      let createdCount = 0;
      let updatedCount = 0;
          let successCount = 0;
          const normDec = (v: string) => (v || '').replace(/,/g, '.');

          for (let i = 0; i < rows.length; i++) {
            try {
              const fields = rows[i].split(',').map((field: string) => field?.trim() || '');
              const get = (ix: number) => (ix >= 0 ? (fields[ix] ?? '').trim() : '');
              const sku_parent = get(col.sku_parent);
              const purchase_price_with_fees = normDec(get(col.purchase_price_with_fees));
              const retail_price = normDec(get(col.retail_price));
              const pro_price = normDec(get(col.pro_price));
              const raw_purchase_price = normDec(get(col.raw_purchase_price));
              const stock_name_val = get(col.stock_name);
              const vat_type = get(col.vat_type) || 'normal';
              const warranty_sticker = get(col.warranty_sticker);
              const supplier = get(col.supplier);
              const battery_percentage = normDec(get(col.battery_percentage));
              const serial_number = get(col.serial_number);
              const product_note = get(col.product_note);

              if (!serial_number || !purchase_price_with_fees || !supplier || !stock_name_val) {
                throw new Error(`Champs obligatoires manquants (serial_number, purchase_price_with_fees, supplier, stock_name) à la ligne ${i + 2}`);
              }

              // Résoudre le parent cible (multi-parent via sku_parent)
              const parentSkuWanted = (sku_parent || '').trim();
              let parentUsed: any = initialProduct;
              if (parentSkuWanted && parentSkuWanted.toUpperCase() !== ((initialProduct?.sku || '').toUpperCase())) {
                const { data: parentRow } = await supabase
                  .from('products')
                  .select('id, sku, name, is_parent, product_type, category_id, weight_grams, width_cm, height_cm, depth_cm, description, ean, images, variants')
                  .eq('sku', parentSkuWanted as any)
                  .maybeSingle();
                if (!parentRow || !(parentRow as any).is_parent) {
                  throw new Error(`Parent introuvable pour sku_parent="${parentSkuWanted}"`);
                }
                parentUsed = parentRow as any;
              }

              // Résoudre le stock: utiliser stock_id direct si fourni, sinon stock_name
              let stockId: string | null = null;
              if (stock_name_val) {
                const stk = stocks.find(s => normalizeStockKey(s.name) === normalizeStockKey(stock_name_val));
                if (stk) {
                  stockId = stk.id;
                } else {
                  throw new Error(`Stock "${stock_name_val}" non trouvé`);
                }
              } else {
                throw new Error('Champ stock_name manquant');
              }

              const serialProductData: any = {
                name: (parentUsed?.name ?? initialProduct?.name),
                sku: `${((parentUsed?.sku || initialProduct?.sku || '') as string).toUpperCase()}-${serial_number}`,
                serial_number,
                purchase_price_with_fees: parseFloat(purchase_price_with_fees),
                retail_price: (vat_type || 'normal') === 'normal'
                  ? (retail_price ? Number((parseFloat(retail_price) * 1.2).toFixed(2)) : null)
                  : (retail_price ? parseFloat(retail_price) : null),
                pro_price: (vat_type || 'normal') === 'normal'
                  ? (pro_price ? Number((parseFloat(pro_price) * 1.2).toFixed(2)) : null)
                  : (pro_price ? parseFloat(pro_price) : null),
                raw_purchase_price: raw_purchase_price ? parseFloat(raw_purchase_price) : parseFloat(purchase_price_with_fees),
                vat_type: vat_type || 'normal',
                warranty_sticker: warranty_sticker || null,
                supplier,
                battery_level: battery_percentage ? parseInt(battery_percentage) : null,
                product_note: product_note || null,
                parent_id: (parentUsed?.id ?? initialProduct?.id),
                is_parent: false,
                stock: 1,
                // Copier les attributs du parent résolu (fallback initialProduct)
                category_id: (parentUsed?.category_id ?? initialProduct?.category_id),
                weight_grams: (parentUsed?.weight_grams ?? initialProduct?.weight_grams),
                width_cm: (parentUsed?.width_cm ?? initialProduct?.width_cm),
                height_cm: (parentUsed?.height_cm ?? initialProduct?.height_cm),
                depth_cm: (parentUsed?.depth_cm ?? initialProduct?.depth_cm),
                description: (parentUsed?.description ?? initialProduct?.description),
                ean: (parentUsed?.ean ?? initialProduct?.ean),
                variants: (parentUsed?.variants ?? (initialProduct as any)?.variants),
                images: (parentUsed?.images ?? initialProduct?.images)
              };

              // Vérifier doublon éventuel sur le SKU enfant avant insertion
              const childSku = `${((parentUsed?.sku || initialProduct?.sku || '') as string).toUpperCase()}-${serial_number}`;
              const { data: existingChild } = await supabase
                .from('products')
                .select('id')
                .eq('sku', childSku as any)
                .maybeSingle();

              if ((existingChild as any)?.id || (Array.isArray(existingChild) && existingChild.length > 0)) {
                throw new Error(`SKU enfant déjà existant: ${childSku}`);
              }

              const created = await addSerialChild(serialProductData as any);
              const newChildId = (created as any)?.id;
              if (!newChildId) {
                throw new Error('Création du produit sérialisé échouée');
              }

              // Allocation directe 1 unité dans stock_produit
              const { error: stockInsertError } = await supabase
                .from('stock_produit')
                .insert([{ produit_id: newChildId as any, stock_id: stockId as any, quantite: 1 } as any]);

              if (stockInsertError) {
                throw new Error(`Échec insertion stock_produit: ${stockInsertError.message}`);
              }
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

          if (importErrors.length > 0) {
            setImportError(importErrors);
          } else {
            setImportSuccess(`${successCount} produits sérialisés importés avec succès`);
          }

          if (!isCSVImporting.current && onSubmitSuccess) {
            onSubmitSuccess();
          }
          // Fin d'import sérialisé: s'assurer que le modal n'est pas affiché
          isCSVImporting.current = false;
          setIsStockModalOpen(false);
          return;
        } catch (e) {
          console.error('Error importing serial CSV:', e);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setImportError([{
            line: 0,
            message: 'Erreur lors de l\'importation des numéros de série'
          }]);
          // Fin d'import sérialisé (erreur): s'assurer que le modal n'est pas affiché
          isCSVImporting.current = false;
          setIsStockModalOpen(false);
          return;
        }
      }

      // Parse robustly the whole CSV (handles quotes, commas and newlines in cells)
      const table = (() => {
        try {
          return parseCSV(content);
        } catch (e) {
          console.error('CSV parse error:', e);
          throw new Error('CSV invalide: guillemets/virgules mal formés');
        }
      })();

      // Filter out comments (rows starting with #) and empty rows
      const rows = table.filter(r =>
        Array.isArray(r) &&
        r.some(c => String(c ?? '').trim() !== '') &&
        !(String((r[0] ?? '')).trim().startsWith('#'))
      );

      console.log('CSV Import - Nombre de lignes après parsing:', rows.length);
      if (rows.length < 2) {
        throw new Error('Aucune ligne de données trouvée');
      }

      const headers = rows[0].map(h => String(h ?? '').trim());
      console.log('CSV Import - En-têtes détectés:', headers);

      const reservedColumns = ['stock_alert'];
      console.log('CSV Import - Colonnes réservées exclues:', reservedColumns);

      const expectedStockColumns = stocks.map(s => ({
        normalizedName: normalizeColumnName(`stock_${s.name}`),
        originalStockName: s.name,
        stockId: s.id
      }));
      console.log('CSV Import - Colonnes de stock attendues:', expectedStockColumns);

      const stockColumns: { index: number; stockName: string; normalizedStockName: string }[] = [];
      const unknownStockColumns: string[] = [];

      headers.forEach((header, index) => {
        const normalizedHeader = normalizeColumnName(header);
        console.log(`CSV Import - Analyse de la colonne ${index}: "${header}" (normalisé: "${normalizedHeader}")`);

        if (normalizedHeader.startsWith('stock_')) {
          const isReserved = reservedColumns.some(reserved => normalizeColumnName(reserved) === normalizedHeader);
          if (isReserved) {
            console.log(`  -> Colonne réservée ignorée: "${header}"`);
            return;
          }

          const stockNamePart = normalizedHeader.substring(6);
          const stockKey = normalizeStockKey(stockNamePart);

          const matchingStock = expectedStockColumns.find(expected =>
            expected.normalizedName === normalizedHeader ||
            normalizeStockKey(expected.originalStockName) === stockKey
          );

          if (matchingStock) {
            stockColumns.push({
              index,
              stockName: matchingStock.originalStockName,
              normalizedStockName: normalizedHeader
            });
            console.log(`  ✓ Colonne de stock valide détectée: "${header}" -> Stock: "${matchingStock.originalStockName}" (ID: ${matchingStock.stockId})`);
          } else {
            unknownStockColumns.push(header);
            console.log(`  ✗ Colonne de stock inconnue: "${header}"`);
          }
        }
      });

      if (unknownStockColumns.length > 0) {
        const errorMsg = `Erreur : colonnes de stock inconnues détectées dans le CSV : ${unknownStockColumns.join(', ')}. Stocks disponibles : ${stocks.map(s => s.name).join(', ')}`;
        console.error('CSV Import - Erreur de validation:', errorMsg);
        throw new Error(errorMsg);
      }

      const hasStockColumns = stockColumns.length > 0;
      const hasGlobalStockColumn = headers.some(h => normalizeColumnName(h) === 'stock');

      console.log('CSV Import - Mode d\'import:', {
        hasStockColumns,
        hasGlobalStockColumn,
        stockColumnsCount: stockColumns.length,
        detectedStockColumns: stockColumns.map(sc => sc.stockName),
        mode: hasStockColumns ? 'Stocks dynamiques' : 'Stock global (compatibilité)'
      });

      const products = rows.slice(1).map(values => {
        const product: any = {};
        headers.forEach((header, index) => {
          product[String(header).trim()] = String(values[index] ?? '').trim();
        });
        // Normaliser le SKU importé en UPPERCASE
        if (typeof product.sku === 'string') {
          product.sku = product.sku.toUpperCase();
        }
        return product;
      });

      startImport(products.length);
      setError(null);
      const importErrors: { line: number; message: string }[] = [];
      let createdCount = 0;
      let updatedCount = 0;
      // Choix du mode d'import: OK = Additionner, Annuler = Écraser
      const importMode: 'ADD' | 'REPLACE' = window.confirm('Additionner les quantités importées aux stocks existants ?\nOK = Additionner (PAU pondéré)\nAnnuler = Écraser (remplace les quantités)') ? 'ADD' : 'REPLACE';

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        let didChange = false;

        // Fail-fast: SKU manquant => arrêter immédiatement l'import et reporter la ligne
        {
          const lineNumber = i + 2; // +2 si la 1re ligne = en-têtes
          const skuStr = product?.sku ? String(product.sku).trim() : '';
          if (!skuStr) {
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setImportError([{
              line: lineNumber,
              message: `SKU manquant à la ligne ${lineNumber}. Import interrompu.`
            }]);
            isCSVImporting.current = false;
            setIsStockModalOpen(false);
            return;
          }
        }

        try {
          console.log(`\n=== Import du produit ${i + 1}/${products.length}: ${product.sku} ===`);

          let stockAllocations: { stockName: string; quantity: number }[] = [];
          let totalStockFromColumns = 0;

          if (hasStockColumns) {
            console.log(`\n=== Extraction des quantités de stock pour le produit: ${product.sku} ===`);

            stockColumns.forEach(({ index, stockName }) => {
              const header = headers[index];
              const quantityStr = product[header] || '0';
              const quantity = parseInt(quantityStr) || 0;

              console.log(`  - Colonne: "${header}" -> Stock "${stockName}": ${quantity} unités`);

              if (quantity > 0) {
                stockAllocations.push({ stockName, quantity });
                totalStockFromColumns += quantity;
              } else if (quantity === 0) {
                console.log(`    (quantité 0, non ajoutée aux allocations)`);
              }
            });

            console.log(`Total des quantités réparties (somme): ${totalStockFromColumns}`);

            if (hasGlobalStockColumn) {
              const globalStock = parseInt(product.stock) || 0;
              console.log(`Colonne stock globale fournie: ${globalStock}`);

              if (globalStock !== totalStockFromColumns) {
                const errorMsg = `Erreur : la somme des quantités réparties entre les colonnes de stock (${totalStockFromColumns}) ne correspond pas à la quantité totale du produit (${globalStock}) pour le SKU: ${product.sku}`;
                console.error('✗ Erreur de validation:', errorMsg);
                throw new Error(errorMsg);
              }

              console.log('✓ Validation réussie: somme des stocks = stock global');
            } else {
              console.log(`Pas de colonne stock globale, utilisation de la somme: ${totalStockFromColumns}`);
            }
          }

          // Lookup robuste par SKU (détection doublons + merge/update)
          const { data: existingRows, error: existingErr } = await supabase
            .from('products')
            .select('id, stock, ean, parent_id, category_id', { count: 'exact' })
            .eq('sku', product.sku as any);

          if (existingErr) {
            throw existingErr;
          }

          const existingCount = Array.isArray(existingRows) ? existingRows.length : 0;

          // Si plusieurs produits existent déjà avec le même SKU -> arrêter pour éviter de créer d'autres doublons
          if (existingCount > 1) {
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setImportError([{
              line: i + 2,
              message: `SKU dupliqué existant: ${product.sku} (${existingCount} produits). Import interrompu. Veuillez dédoublonner avant de ré-importer.`
            }]);
            isCSVImporting.current = false;
            setIsStockModalOpen(false);
            return;
          }

          const existingProductAny = existingCount === 1 ? (existingRows as any[])[0] : null;

          // Gestion des miroirs via CSV: si parent_id est renseigné, mise à jour limitée (name/sku) ou création miroir
          const parentIdCSV = (product.parent_id || '').toString().trim();
          if (parentIdCSV) {
            // Vérifier que le parent existe
            const { data: parentRow } = await supabase
              .from('products')
              .select('id')
              .eq('id', parentIdCSV as any)
              .maybeSingle();

            if (!parentRow) {
              throw new Error(`Parent introuvable pour parent_id=${parentIdCSV}`);
            }

            if (existingProductAny) {
              await updateProduct(existingProductAny.id, {
                name: product.name,
                sku: (product.sku || '').toUpperCase()
              } as any);
              updatedCount += 1;
              didChange = true;
            } else {
              const created = await addProduct({
                name: product.name,
                sku: (product.sku || '').toUpperCase(),
                parent_id: parentIdCSV
              } as any);
              if ((created as any)?.id) {
                createdCount += 1;
                didChange = true;
              }
            }

            incrementProgress();
            continue;
          }

          // Validation des colonnes de catégorie
          // - Création: category_* obligatoires
          // - Mise à jour: category_* optionnelles (si absentes, on ne touche pas category_id)
          if (!existingProductAny) {
            if (!product.category_type || product.category_type.trim() === '') {
              throw new Error(`Erreur ligne ${i + 2}, produit ${product.sku} : la colonne category_type est manquante ou vide.`);
            }
            if (!product.category_brand || product.category_brand.trim() === '') {
              throw new Error(`Erreur ligne ${i + 2}, produit ${product.sku} : la colonne category_brand est manquante ou vide.`);
            }
            if (!product.category_model || product.category_model.trim() === '') {
              throw new Error(`Erreur ligne ${i + 2}, produit ${product.sku} : la colonne category_model est manquante ou vide.`);
            }
          }

          console.log('Validation des catégories:', {
            type: product.category_type,
            brand: product.category_brand,
            model: product.category_model
          });

          let category;
          // Résoudre/Créer la catégorie uniquement si les colonnes sont renseignées
          if (product.category_type && product.category_brand && product.category_model) {
            try {
              category = await addCategory({
                type: product.category_type.toUpperCase(),
                brand: product.category_brand.toUpperCase(),
                model: product.category_model.toUpperCase()
              });
            } catch (err) {
              throw new Error(`Erreur ligne ${i + 2}, produit ${product.sku} : impossible de créer ou trouver la catégorie. ${err instanceof Error ? err.message : ''}`);
            }
          }

          const finalStock = hasStockColumns ? totalStockFromColumns : parseInt(product.stock);

          // === NORMALISATION DES NOMBRES DÉCIMAUX ===
          // Fonction helper pour convertir les virgules en points (format européen vers format JS)
          const normalizeDecimal = (value: string): number => {
            const normalized = (value || '').replace(',', '.');
            const result = parseFloat(normalized);
            console.log(`CSV Import - Normalisation décimale: "${value}" -> "${normalized}" -> ${result}`);
            return result;
          };

          // === CALCUL AUTOMATIQUE PRIX/MARGE RETAIL ===
          const purchasePrice = normalizeDecimal(product.purchase_price_with_fees) || 0;
          const vatType = product.vat_type || 'normal';
          const retailPriceStr = (product.retail_price || '').trim();
          const marginPercentStr = (product.margin_percent || '').trim();

          console.log(`CSV Import - Produit ${product.sku} (ligne ${i + 2}) - Valeurs brutes retail:`, {
            purchase_price_with_fees_brut: product.purchase_price_with_fees,
            purchase_price_with_fees_normalise: purchasePrice,
            retail_price_brut: retailPriceStr,
            margin_percent_brut: marginPercentStr,
            vat_type: vatType
          });

          let finalRetailPrice: number;
          let finalMarginPercent: number;

          const hasRetailPrice = retailPriceStr !== '' && normalizeDecimal(retailPriceStr) !== 0;
          const hasMarginPercent = marginPercentStr !== '' && normalizeDecimal(marginPercentStr) !== 0;

          if (hasRetailPrice && hasMarginPercent) {
            console.error(`CSV Import - CONFLIT ligne ${i + 2} (SKU: ${product.sku}):`, {
              retail_price: retailPriceStr,
              margin_percent: marginPercentStr,
              conflit: 'Les deux sont renseignés'
            });
            throw new Error(`Erreur ligne ${i + 2} (SKU: ${product.sku}) : renseignez soit retail_price, soit margin_percent, mais pas les deux.`);
          } else if (hasRetailPrice && !hasMarginPercent) {
            const retailPriceNormalized = normalizeDecimal(retailPriceStr);
            console.log(`CSV Import - Produit ${product.sku} - retail_price normalisé: ${retailPriceNormalized}`);

            // Les prix dans le CSV sont saisis tels quels (pas de conversion automatique)
            finalRetailPrice = retailPriceNormalized;
            console.log(`CSV Import - Prix retail utilisé tel quel (pas de conversion): ${finalRetailPrice}`);

            finalMarginPercent = parseFloat(calculateMargin(purchasePrice, finalRetailPrice, vatType).toFixed(2));
            console.log(`CSV Import - Produit ${product.sku} - Calcul margin_percent:`, {
              methode: 'calculateMargin depuis retail_price',
              retail_price_final_TTC: finalRetailPrice,
              margin_percent_calcule: finalMarginPercent
            });
          } else if (!hasRetailPrice && hasMarginPercent) {
            finalMarginPercent = normalizeDecimal(marginPercentStr);
            finalRetailPrice = parseFloat(calculatePriceFromMargin(purchasePrice, finalMarginPercent, vatType).toFixed(2));
            console.log(`CSV Import - Produit ${product.sku} - Calcul retail_price:`, {
              methode: 'calculatePriceFromMargin depuis margin_percent',
              margin_percent: finalMarginPercent,
              retail_price_calcule: finalRetailPrice
            });
          } else {
            throw new Error(`Erreur ligne ${i + 2} (SKU: ${product.sku}) : vous devez renseigner soit retail_price, soit margin_percent.`);
          }

          // === CALCUL AUTOMATIQUE PRIX/MARGE PRO ===
          const proPriceStr = (product.pro_price || '').trim();
          const proMarginPercentStr = (product.pro_margin_percent || '').trim();

          console.log(`CSV Import - Produit ${product.sku} (ligne ${i + 2}) - Valeurs brutes pro:`, {
            pro_price_brut: proPriceStr,
            pro_margin_percent_brut: proMarginPercentStr
          });

          let finalProPrice: number;
          let finalProMarginPercent: number;

          const hasProPrice = proPriceStr !== '' && normalizeDecimal(proPriceStr) !== 0;
          const hasProMarginPercent = proMarginPercentStr !== '' && normalizeDecimal(proMarginPercentStr) !== 0;

          if (hasProPrice && hasProMarginPercent) {
            console.error(`CSV Import - CONFLIT ligne ${i + 2} (SKU: ${product.sku}):`, {
              pro_price: proPriceStr,
              pro_margin_percent: proMarginPercentStr,
              conflit: 'Les deux sont renseignés'
            });
            throw new Error(`Erreur ligne ${i + 2} (SKU: ${product.sku}) : renseignez soit pro_price, soit pro_margin_percent, mais pas les deux.`);
          } else if (hasProPrice && !hasProMarginPercent) {
            const proPriceNormalized = normalizeDecimal(proPriceStr);
            console.log(`CSV Import - Produit ${product.sku} - pro_price normalisé: ${proPriceNormalized}`);

            // Les prix dans le CSV sont saisis tels quels (pas de conversion automatique)
            finalProPrice = proPriceNormalized;
            console.log(`CSV Import - Prix pro utilisé tel quel (pas de conversion): ${finalProPrice}`);

            finalProMarginPercent = parseFloat(calculateMargin(purchasePrice, finalProPrice, vatType).toFixed(2));
            console.log(`CSV Import - Produit ${product.sku} - Calcul pro_margin_percent:`, {
              methode: 'calculateMargin depuis pro_price',
              pro_price_final_TTC: finalProPrice,
              pro_margin_percent_calcule: finalProMarginPercent
            });
          } else if (!hasProPrice && hasProMarginPercent) {
            finalProMarginPercent = normalizeDecimal(proMarginPercentStr);
            finalProPrice = parseFloat(calculatePriceFromMargin(purchasePrice, finalProMarginPercent, vatType).toFixed(2));
            console.log(`CSV Import - Produit ${product.sku} - Calcul pro_price:`, {
              methode: 'calculatePriceFromMargin depuis pro_margin_percent',
              pro_margin_percent: finalProMarginPercent,
              pro_price_calcule: finalProPrice
            });
          } else {
            throw new Error(`Erreur ligne ${i + 2} (SKU: ${product.sku}) : vous devez renseigner soit pro_price, soit pro_margin_percent.`);
          }

          console.log(`CSV Import - Produit ${product.sku} - Valeurs finales avant sauvegarde:`, {
            vat_type: vatType,
            purchase_price: purchasePrice,
            retail_price_TTC: finalRetailPrice,
            margin_percent: finalMarginPercent,
            pro_price_TTC: finalProPrice,
            pro_margin_percent: finalProMarginPercent
          });

          const computedCategoryId = (category && (category as any).id)
            ? (category as any).id
            : (existingProductAny?.category_id ?? null);

          const productData = {
            name: product.name,
            sku: product.sku,
            purchase_price_with_fees: purchasePrice,
            retail_price: finalRetailPrice,
            pro_price: finalProPrice,
            weight_grams: parseInt(product.weight_grams),
            location: (product.location || '').toUpperCase(),
            ean: existingProductAny?.ean || product.ean,
            stock: finalStock,
            stock_alert: product.stock_alert ? parseInt(product.stock_alert) : null,
            description: product.description || null,
            width_cm: product.width_cm ? parseFloat(product.width_cm) : null,
            height_cm: product.height_cm ? parseFloat(product.height_cm) : null,
            depth_cm: product.depth_cm ? parseFloat(product.depth_cm) : null,
            category_id: computedCategoryId,
            vat_type: vatType,
            margin_percent: finalMarginPercent,
            pro_margin_percent: finalProMarginPercent,
            product_type: 'PAU' as 'PAU'
          };

          console.log(`CSV Import - ProductData final pour sauvegarde (SKU: ${product.sku}):`, productData);

          let productId: string;

          if (existingProductAny) {
            // Calcul PAU pondéré si on additionne
            let newPurchasePrice = productData.purchase_price_with_fees;
            let newStockTotal = finalStock;
            try {
              const { data: existingStockRows } = await supabase
                .from('stock_produit')
                .select('quantite')
                .eq('produit_id', existingProductAny.id as any);
              const stAncien = (existingStockRows || []).reduce((sum: number, r: any) => sum + (Number(r.quantite) || 0), 0);
              const stNouveau = Number.isFinite(finalStock) ? finalStock : 0;
              const paAncien = Number(existingProductAny.purchase_price_with_fees || 0);
              const paNouveau = Number(productData.purchase_price_with_fees || 0);
              if (importMode === 'ADD' && (stAncien + stNouveau) > 0) {
                const pond = ((stAncien * paAncien) + (stNouveau * paNouveau)) / (stAncien + stNouveau);
                newPurchasePrice = Number.isFinite(pond) ? Number(pond.toFixed(2)) : paNouveau;
                newStockTotal = (existingProductAny.stock || 0) + stNouveau;
              } else if (importMode === 'REPLACE') {
                // on remplace: le stock total devient le stock importé
                newStockTotal = stNouveau;
              }
            } catch (e) {
              console.warn('Impossible de calculer le PAU pondéré, fallback sur valeur CSV:', e);
              newPurchasePrice = productData.purchase_price_with_fees;
              newStockTotal = (importMode === 'ADD') ? ((existingProductAny.stock || 0) + finalStock) : finalStock;
            }

            await updateProduct(existingProductAny.id, {
              ...productData,
              purchase_price_with_fees: newPurchasePrice,
              stock: newStockTotal
            });
            updatedCount += 1;
            didChange = true;
            productId = existingProductAny.id;
            console.log(`Produit existant mis à jour: ${productId}`);
          } else {
            const newProduct = await addProduct(productData);
            productId = (newProduct as any)?.id;
            if (productId) {
              createdCount += 1;
              didChange = true;
            }
            console.log(`Nouveau produit créé: ${productId}`);
          }

          // Propager les champs verrouillés vers les miroirs liés (non sérialisés)
          try {
            await supabase
              .from('products')
              .update({
                purchase_price_with_fees: productData.purchase_price_with_fees,
                retail_price: productData.retail_price,
                pro_price: productData.pro_price,
                vat_type: productData.vat_type,
                margin_percent: productData.margin_percent,
                pro_margin_percent: productData.pro_margin_percent,
                description: productData.description,
                width_cm: productData.width_cm,
                height_cm: productData.height_cm,
                depth_cm: productData.depth_cm,
                location: productData.location,
                ean: productData.ean,
                category_id: productData.category_id
              } as any)
              .eq('parent_id', productId as any)
              .is('serial_number', null);
          } catch (e) {
            console.warn('Propagation vers miroirs échouée:', e);
          }

          if (hasStockColumns && productId) {
            console.log(`\n=== Mise à jour des stocks pour ${product.sku} (mode ${importMode}) ===`);

            // REPLACE: purger puis insérer exactement les quantités fournies (>0)
            if (importMode === 'REPLACE') {
              const { error: delErr } = await supabase
                .from('stock_produit')
                .delete()
                .eq('produit_id', productId as any);
              if (delErr) console.warn('Purge stock_produit échouée:', delErr);
            }

            for (const allocation of stockAllocations) {
              const stock = stocks.find(s =>
                normalizeColumnName(s.name) === normalizeColumnName(allocation.stockName) ||
                s.name.toLowerCase() === allocation.stockName.toLowerCase()
              );
              if (!stock) {
                const errorMsg = `Stock inconnu dans le CSV : "${allocation.stockName}" (ligne ${i + 2}, SKU ${product.sku}). Vérifiez l'orthographe ou créez le stock dans l'application.`;
                console.error(`  ✗ ${errorMsg}`);
                throw new Error(errorMsg);
              }

              if (importMode === 'ADD') {
                // ADD: incrémenter les quantités existantes
                const { data: existingRow } = await supabase
                  .from('stock_produit')
                  .select('id, quantite')
                  .eq('produit_id', productId as any)
                  .eq('stock_id', stock.id as any)
                  .maybeSingle();

                if (existingRow) {
                  const { error: upErr } = await supabase
                    .from('stock_produit')
                    .update({ quantite: (existingRow as any).quantite + allocation.quantity } as any)
                    .eq('id', (existingRow as any).id as any);
                  if (upErr) {
                    console.error('Erreur update stock_produit (ADD):', upErr);
                    throw upErr;
                  }
                } else if (allocation.quantity > 0) {
                  const { error: insErr } = await supabase
                    .from('stock_produit')
                    .insert([{ produit_id: productId as any, stock_id: stock.id as any, quantite: allocation.quantity } as any]);
                  if (insErr) {
                    console.error('Erreur insert stock_produit (ADD):', insErr);
                    throw insErr;
                  }
                }
              } else {
                // REPLACE: insérer uniquement les quantités > 0
                if (allocation.quantity > 0) {
                  const { error: insErr } = await supabase
                    .from('stock_produit')
                    .insert([{ produit_id: productId as any, stock_id: stock.id as any, quantite: allocation.quantity } as any]);
                  if (insErr) {
                    console.error('Erreur insert stock_produit (REPLACE):', insErr);
                    throw insErr;
                  }
                }
              }
            }

            console.log(`✓ Stocks mis à jour (${importMode}) pour ${product.sku}`);
          } else if (!hasStockColumns) {
            console.log('Mode compatibilité: pas de colonnes de stock dynamiques, pas d\'allocation créée');
          } else {
            console.log('Aucune allocation de stock (toutes les quantités sont à 0)');
          }

          if (!didChange) {
            importErrors.push({
              line: i + 2,
              message: `Aucune opération appliquée (SKU ${product.sku}).`
            });
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

      const summary = `Import terminé: ${createdCount} créé(s), ${updatedCount} mis à jour, ${importErrors.length} rejet(s).`;
      if (importErrors.length > 0) {
        setImportError([{ line: 0, message: summary }, ...importErrors]);
      } else {
        setImportSuccess(summary);
      }

      if (!isCSVImporting.current && onSubmitSuccess) {
        onSubmitSuccess();
      }
      // Fin d'import PAU: s'assurer que le modal n'est pas affiché
      isCSVImporting.current = false;
      setIsStockModalOpen(false);
    } catch (error) {
      console.error('Error importing CSV:', error);
      setImportError([{
        line: 0,
        message: 'Erreur lors de l\'importation du fichier CSV'
      }]);
    }
  };

  const downloadSampleCSV = async (isSerialImport = false) => {
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
          'serial_number',
          'purchase_price_with_fees',
          'retail_price',
          'pro_price',
          'raw_purchase_price',
          'vat_type',
          'stock_name',
          'supplier',
          'battery_percentage',
          'warranty_sticker',
          'product_note'
        ];

        const firstStockName = (stocks[0]?.name) || 'STOCK-NAME-1';
        const secondStockName = (stocks[1]?.name) || firstStockName;

        // Ligne A: Exemple avec prix saisis tels quels (pas de conversion)
        const rowA = [
          initialProduct?.sku || '',
          'SN123456789',
          '900.00',
          '1200.00',
          '1100.00',
          '850.00',
          'normal',
          firstStockName,
          'FOURNISSEUR-EXEMPLE',
          '85',
          'present',
          'Notes optionnelles'
        ];

        // Ligne B: TVA sur marge, retail/pro tels quels
        const rowB = [
          initialProduct?.sku || '',
          'SN987654321',
          '900.00',
          '1150.00',
          '1050.00',
          '',
          'margin',
          secondStockName,
          'FOURNISSEUR-EXEMPLE',
          '80',
          'absent',
          ''
        ];

        // Annexes dynamiques
        const stocksSection = [
          '',
          '# Stocks disponibles (stock_name)',
          ...stocks.map(s => s.name)
        ];

        // Essayer de lister dynamiquement les fournisseurs existants (fallback exemple)
        let supplierNames: string[] = [];
        try {
          const { data: supplierRows, error: supplierErr } = await supabase
            .from('products')
            .select('supplier');
          if (!supplierErr && Array.isArray(supplierRows)) {
            const set = new Set(
              supplierRows
                .map((r: any) => (r?.supplier || '').toString().trim())
                .filter((v: string) => v.length > 0)
            );
            supplierNames = Array.from(set).sort((a, b) => a.localeCompare(b));
          }
        } catch (e) {
          // ignore and use fallback
        }
        const suppliersSection = [
          '',
          '# Suppliers disponibles (supplier)',
          ...(supplierNames.length ? supplierNames : ['FOURNISSEUR-EXEMPLE'])
        ];

        const csvContent = [
          headers.join(','),
          rowA.join(','),
          rowB.join(','),
          ...stocksSection,
          ...suppliersSection
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
    const baseHeaders = [
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
      'pro_margin_percent'
    ];

    console.log('Generating product CSV with stocks:', stocks);

    // Ajouter les colonnes dynamiques de stocks
    const stockColumns = stocks.map(s => `stock_${s.name}`);
    const headers = [...baseHeaders, ...stockColumns];

    // Ligne 1 : Câble USB (TVA normale) - Prix saisis tels quels dans le CSV
    const cableUSB = [
      'Câble USB Type-C',
      'CABLE-USBC-001',
      '',
      '2.18',
      '14.99',
      '4.96',
      '50',
      'STOCK-A1',
      '3401234567890',
      '10',
      '3',
      'Câble USB Type-C 1m Noir',
      '12',
      '0.5',
      '0.5',
      'ACCESSOIRE',
      'GENERIQUE',
      'CABLE USB-C',
      'normal',
      '',
      ''
    ];

    // Ligne 2 : Coque de téléphone (TVA sur marge) - Prix en TTC dans le CSV
    const coquePhone = [
      'Coque de téléphone universelle',
      'COQUE-UNI-001',
      '',
      '2.18',
      '17.99',
      '5.95',
      '30',
      'STOCK-B2',
      '3401987654321',
      '20',
      '5',
      'Coque de protection universelle silicone',
      '15',
      '1',
      '0.8',
      'ACCESSOIRE',
      'GENERIQUE',
      'COQUE',
      'margin',
      '',
      ''
    ];

    // Répartir les quantités entre les stocks disponibles
    const cableStockAllocation = stocks.length >= 2
      ? stocks.map((s, idx) => idx === 0 ? '5' : idx === 1 ? '5' : '0')
      : stocks.length === 1
        ? ['10']
        : [];

    const coqueStockAllocation = stocks.length >= 3
      ? stocks.map((s, idx) => idx === 2 ? '10' : idx === 0 ? '5' : idx === 1 ? '5' : '0')
      : stocks.length >= 2
        ? stocks.map((s, idx) => idx === 0 ? '10' : idx === 1 ? '10' : '0')
        : stocks.length === 1
          ? ['20']
          : [];

    const sampleData1 = [...cableUSB, ...cableStockAllocation];
    const sampleData2 = [...coquePhone, ...coqueStockAllocation];

    const warningLine0 = '# ⚠️ FORMAT DÉCIMAL : Utilisez le POINT comme séparateur décimal (ex: 4.96 )';
    const warningLine1 = '# ⚠️ PRIX : Saisir retail_price et pro_price tels quels (pas de conversion automatique valeurs enregistrées comme saisies)';
    const warningLine2 = '# ⚠️ PRIX vs MARGE : Renseigner soit le prix de vente (retail_price/pro_price) soit la marge % (margin_percent/pro_margin_percent) mais PAS les deux';
    const warningLine3 = '# ⚠️ STOCKS : La somme des quantités réparties entre les colonnes de stock doit égaler la quantité totale (colonne stock)';
    const warningLine4 = '# Exemple ligne 1 (TVA normale) : purchase_price=2.18 / retail_price=14.99 -> sauvegardé comme 14.99 / pro_price=4.96 -> sauvegardé comme 4.96';
    const warningLine5 = '# Exemple ligne 2 (TVA marge) : purchase_price=2.18 / retail_price=17.99 -> sauvegardé comme 17.99 / pro_price=5.95 -> sauvegardé comme 5.95';
    const warningLine6 = '';

    const csvContent = [
      warningLine0,
      warningLine1,
      warningLine2,
      warningLine3,
      warningLine4,
      warningLine5,
      warningLine6,
      headers.join(','),
      sampleData1.join(','),
      sampleData2.join(',')
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

    // Miroir: seule la mise à jour du nom et du SKU est autorisée
    if (isMirrorChild && initialProduct) {
      if (!formData.name || !formData.sku) {
        setError('Les champs "Nom du produit" et "SKU" sont obligatoires pour un produit miroir');
        return;
      }
      try {
        await updateProduct(initialProduct.id, {
          name: formData.name,
          sku: (formData.sku || '').toUpperCase()
        } as any);
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } catch (err) {
        console.error('Failed to update mirror product:', err);
        setError('Échec de la mise à jour du produit miroir.');
      }
      return;
    }

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
        sku: (formData.sku || '').toUpperCase(),
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
        is_parent: true,
        product_type: 'PAU' as 'PAU'
      };

      if (initialProduct) {
        await updateProduct(initialProduct.id, productData);

        // Cascade: if parent stock_alert changed, propagate to mirror children (non serialized)
        try {
          const prevAlert = (initialProduct as any)?.stock_alert ?? null;
          const nextAlert = Number.isFinite(parseInt(formData.stock_alert)) ? parseInt(formData.stock_alert) : null;
          if (prevAlert !== nextAlert && !initialProduct.parent_id) {
            await supabase
              .from('products')
              .update({ stock_alert: nextAlert } as any)
              .eq('parent_id', initialProduct.id as any)
              .is('serial_number', null);
          }
        } catch (e) {
          console.error('Cascade update of stock_alert to mirror children failed:', e);
        }
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        const result = await addProduct(productData);
        if (result?.id) {
          setNewProductId(result.id);
          setNewProductName(result.name);
          setGlobalStock(parseInt(formData.stock));
          // N'ouvrir le modal de répartition que si ce n'est PAS un import CSV et qu'aucun import n'est en cours
          if (!isCSVImporting.current && !importState.isDialogOpen) {
            setIsStockModalOpen(true);
          }
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
            <p className="text-blue-700">
              {isPAMParent ? "Ajouter plusieurs produits avec numéro de série ?" : "Ajouter plusieurs produits à prix d'achat unique ?"} 📦
            </p>
            <ArrowRight className="text-blue-500 animate-bounce" size={20} />
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => downloadSampleCSV(isSerialHostingParent)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download size={18} />
              {isSerialHostingParent ? 'Télécharger modèle CSV numéros de série 📥' : 'Télécharger un modèle CSV (prix d\'achat unique) 📥'}
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
              <Upload size={18} />
              {isSerialHostingParent ? 'Importer numéros de série CSV 📂' : 'Importer un fichier CSV (prix d\'achat unique) 📂'}
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

        {isMirrorChild && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            Les miroirs ne peuvent être modifiés que sur le nom et le SKU. Les autres champs dépendent du parent.
          </div>
        )}

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
                disabled={isMirrorChild}
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
                  disabled={isMirrorChild}
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
                  disabled={isMirrorChild}
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
                  disabled={isMirrorChild}
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
                    disabled={isMirrorChild}
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
                    disabled={isMirrorChild}
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
                    disabled={isMirrorChild}
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
                    disabled={isMirrorChild}
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

      {!isCSVImporting.current && !importState.isDialogOpen && isStockModalOpen && (
        <StockAllocationModal
          isOpen={true}
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
      )}

      <ImportDialog
        isOpen={importState.isDialogOpen}
        onClose={closeDialog}
        current={importState.current}
        total={importState.total}
        status={importState.status}
        errors={importState.errors}
        successMessage={importState.successMessage}
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
