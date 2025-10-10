import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ProductList } from '../components/Products/ProductList';
import { useProductStore } from '../store/productStore';
import { useLotStore } from '../store/lotStore';
import { useCategoryStore } from '../store/categoryStore';
import { ProductSearch } from '../components/Search/ProductSearch';
import { Download, Upload, X, Filter, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';
import { LotCSVImport } from '../components/Lots/LotCSVImport';
import type { ProductWithStock } from '../types/supabase';
import { supabase } from '../lib/supabase';

type Product = ProductWithStock & {
  category?: {
    type: string;
    brand: string;
    model: string;
  } | null;
};

export const Products: React.FC = () => {
  const { products, fetchProducts } = useProductStore();
  const { lots, fetchLots } = useLotStore();
  const { categories, fetchCategories } = useCategoryStore();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [isLotCSVImportOpen, setIsLotCSVImportOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // États des filtres
  const [filterType, setFilterType] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterProductType, setFilterProductType] = useState<string[]>([]);
  const [filterStock, setFilterStock] = useState<string>('');
  const [filterPurchasePriceMin, setFilterPurchasePriceMin] = useState<string>('');
  const [filterPurchasePriceMax, setFilterPurchasePriceMax] = useState<string>('');
  const [filterSalePriceMin, setFilterSalePriceMin] = useState<string>('');
  const [filterSalePriceMax, setFilterSalePriceMax] = useState<string>('');
  const [filterMarginPercentMin, setFilterMarginPercentMin] = useState<string>('');
  const [filterMarginPercentMax, setFilterMarginPercentMax] = useState<string>('');
  const [filterMarginEuroMin, setFilterMarginEuroMin] = useState<string>('');
  const [filterMarginEuroMax, setFilterMarginEuroMax] = useState<string>('');
  const [filterVAT, setFilterVAT] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

  // Listes pour auto-complétion
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // Listes dynamiques filtrées pour les trois niveaux hiérarchiques
  const uniqueTypes = Array.from(new Set(categories.map(c => c.type))).sort();
  const filteredBrands = Array.from(new Set(categories
    .filter(c => !filterType || c.type === filterType)
    .map(c => c.brand)
  )).sort();
  const filteredModels = Array.from(new Set(categories
    .filter(c =>
      (!filterType || c.type === filterType) &&
      (!filterBrand || c.brand === filterBrand)
    )
    .map(c => c.model)
  )).sort();

  // Réinitialiser les champs dépendants lors d'un changement
  const handleTypeChange = (value: string) => {
    console.log('Type selected:', value);
    setFilterType(value);
    setFilterBrand('');
    setFilterModel('');
  };

  const handleBrandChange = (value: string) => {
    console.log('Brand selected:', value);
    setFilterBrand(value);
    setFilterModel('');
  };

  const handleModelChange = (value: string) => {
    console.log('Model selected:', value);
    setFilterModel(value);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchLots();
      await fetchCategories();

      // Charger les fournisseurs distincts
      const { data: suppliersData } = await supabase
        .from('products')
        .select('supplier')
        .not('supplier', 'is', null);
      if (suppliersData) {
        const rows = (suppliersData as any[]) || [];
        const uniqueSuppliers = [...new Set(rows.map((p: any) => p.supplier).filter(Boolean))] as string[];
        setSuppliers(uniqueSuppliers);
        console.log('Loaded suppliers:', uniqueSuppliers.length);
      }

      // Charger les emplacements distincts
      const { data: locationsData } = await supabase
        .from('products')
        .select('location')
        .not('location', 'is', null);
      if (locationsData) {
        const rows = (locationsData as any[]) || [];
        const uniqueLocations = [...new Set(rows.map((p: any) => p.location).filter(Boolean))] as string[];
        setLocations(uniqueLocations);
        console.log('Loaded locations:', uniqueLocations.length);
      }

      // Check for search query and trigger search if needed
      const savedQuery = sessionStorage.getItem('productSearchQuery');
      const shouldTriggerSearch = sessionStorage.getItem('shouldTriggerSearch');

      if (savedQuery && shouldTriggerSearch === 'true') {
        handleSearch(savedQuery);
        setCurrentSearchQuery(savedQuery);
        sessionStorage.removeItem('shouldTriggerSearch');
      } else {
        // Load initial 50 products
        applyFilters('');
      }
    };

    loadInitialData();
  }, []);

  const applyFilters = useCallback(async (query: string) => {
    console.log('applyFilters called with query:', query);
    setIsSearching(true);

    try {
      let queryBuilder = supabase
        .from('products')
        .select(`
          *,
          stocks:stock_produit (
            quantite,
            stock:stocks (
              name
            )
          ),
          category:product_categories!products_category_id_fkey (
            type,
            brand,
            model
          )
        `);

      // Filtre de recherche textuelle
      if (query.trim()) {
        const searchTerm = query.trim();
        queryBuilder = queryBuilder.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,ean.ilike.%${searchTerm}%`);
        console.log('Applied text search filter:', searchTerm);
      }

      // Filtre catégorie (type/brand/model)
      if (filterType || filterBrand || filterModel) {
        // Récupérer les IDs de catégories correspondant aux filtres
        let categoryQuery = supabase
          .from('product_categories')
          .select('id');

        if (filterType) {
          categoryQuery = categoryQuery.eq('type' as any, filterType as any);
          console.log('Filtering categories by type:', filterType);
        }
        if (filterBrand) {
          categoryQuery = categoryQuery.eq('brand' as any, filterBrand as any);
          console.log('Filtering categories by brand:', filterBrand);
        }
        if (filterModel) {
          categoryQuery = categoryQuery.eq('model' as any, filterModel as any);
          console.log('Filtering categories by model:', filterModel);
        }

        const { data: categoryData, error: categoryError } = await categoryQuery;

        if (categoryError) {
          console.error('Error fetching category IDs:', categoryError);
        } else if (categoryData && categoryData.length > 0) {
          const categoryIds = (categoryData as any[]).map((cat: any) => cat.id);
          console.log('Found category IDs:', categoryIds.length);
          queryBuilder = queryBuilder.in('category_id', categoryIds as any);
        } else {
          console.log('No categories found matching filters, will return empty results');
          // Aucune catégorie trouvée, forcer un résultat vide
          queryBuilder = queryBuilder.eq('id', '00000000-0000-0000-0000-000000000000' as any);
        }
      }

      // Filtre TVA (inclure aussi les parents PAM dont au moins un enfant a cette TVA)
      if (filterVAT) {
        let parentIds: string[] = [];
        try {
          const { data: childVatRows, error: childVatErr } = await supabase
            .from('products')
            .select('parent_id')
            .eq('vat_type' as any, filterVAT as any)
            .not('parent_id', 'is', null);

          if (!childVatErr && childVatRows) {
            parentIds = Array.from(
              new Set(
                (childVatRows as any[])
                  .map((r: any) => r.parent_id)
                  .filter(Boolean)
              )
            );
          }
        } catch (e) {
          console.error('Error fetching child VAT parents:', e);
        }

        if (parentIds.length > 0) {
          const idList = parentIds.join(',');
          // Inclure: (1) produits avec vat_type direct (PAU) OU (2) parents PAM listés
          queryBuilder = queryBuilder.or(`vat_type.eq.${filterVAT},id.in.(${idList})`);
        } else {
          // Fallback: filtre simple (cas PAU)
          queryBuilder = queryBuilder.eq('vat_type' as any, filterVAT as any);
        }
        console.log('Applied VAT filter (incl. PAM via children):', filterVAT, 'parents:', parentIds.length);
      }

      // Filtre fournisseur (inclure aussi les parents PAM dont au moins un enfant a ce fournisseur)
      if (filterSupplier) {
        let parentIdsSupplier: string[] = [];
        try {
          const { data: childSupplierRows, error: childSupplierErr } = await supabase
            .from('products')
            .select('parent_id')
            .eq('supplier' as any, filterSupplier as any)
            .not('parent_id', 'is', null);

          if (!childSupplierErr && childSupplierRows) {
            parentIdsSupplier = Array.from(
              new Set(
                (childSupplierRows as any[])
                  .map((r: any) => r.parent_id)
                  .filter(Boolean)
              )
            );
          }
        } catch (e) {
          console.error('Error fetching child supplier parents:', e);
        }

        if (parentIdsSupplier.length > 0) {
          const idList = parentIdsSupplier.join(',');
          queryBuilder = queryBuilder.or(`supplier.eq.${filterSupplier},id.in.(${idList})`);
        } else {
          queryBuilder = queryBuilder.eq('supplier' as any, filterSupplier as any);
        }
        console.log('Applied supplier filter (incl. PAM via children):', filterSupplier, 'parents:', parentIdsSupplier.length);
      }

      // Filtre emplacement
      if (filterLocation) {
        queryBuilder = queryBuilder.eq('location' as any, filterLocation as any);
        console.log('Applied location filter:', filterLocation);
      }

      // Filtre type de produit (PAU/PAM) - n'envoie au serveur que PAU/PAM
      if (filterProductType.length > 0) {
        const typesForDB = filterProductType.filter(t => t === 'PAU' || t === 'PAM');
        if (typesForDB.length > 0) {
          queryBuilder = queryBuilder.in('product_type' as any, typesForDB as any);
          console.log('Applied product type filter:', typesForDB);
        } else {
          console.log('No DB-level product_type filter applied (only frontend types selected):', filterProductType);
        }
      }

      // Filtre prix d'achat min
      if (filterPurchasePriceMin) {
        const min = parseFloat(filterPurchasePriceMin);
        if (!isNaN(min)) {
          queryBuilder = queryBuilder.gte('purchase_price_with_fees', min);
          console.log('Applied purchase price min filter:', min);
        }
      }

      // Filtre prix d'achat max
      if (filterPurchasePriceMax) {
        const max = parseFloat(filterPurchasePriceMax);
        if (!isNaN(max)) {
          queryBuilder = queryBuilder.lte('purchase_price_with_fees', max);
          console.log('Applied purchase price max filter:', max);
        }
      }

      // Filtre prix de vente min
      if (filterSalePriceMin) {
        const min = parseFloat(filterSalePriceMin);
        if (!isNaN(min)) {
          queryBuilder = queryBuilder.gte('retail_price', min);
          console.log('Applied sale price min filter:', min);
        }
      }

      // Filtre prix de vente max
      if (filterSalePriceMax) {
        const max = parseFloat(filterSalePriceMax);
        if (!isNaN(max)) {
          queryBuilder = queryBuilder.lte('retail_price', max);
          console.log('Applied sale price max filter:', max);
        }
      }

      // Filtre marge % min
      if (filterMarginPercentMin) {
        const min = parseFloat(filterMarginPercentMin);
        if (!isNaN(min)) {
          queryBuilder = queryBuilder.gte('margin_percent', min);
          console.log('Applied margin percent min filter:', min);
        }
      }

      // Filtre marge % max
      if (filterMarginPercentMax) {
        const max = parseFloat(filterMarginPercentMax);
        if (!isNaN(max)) {
          queryBuilder = queryBuilder.lte('margin_percent', max);
          console.log('Applied margin percent max filter:', max);
        }
      }

      // Filtre marge € min
      if (filterMarginEuroMin) {
        const min = parseFloat(filterMarginEuroMin);
        if (!isNaN(min)) {
          queryBuilder = queryBuilder.gte('margin_value', min);
          console.log('Applied margin euro min filter:', min);
        }
      }

      // Filtre marge € max
      if (filterMarginEuroMax) {
        const max = parseFloat(filterMarginEuroMax);
        if (!isNaN(max)) {
          queryBuilder = queryBuilder.lte('margin_value', max);
          console.log('Applied margin euro max filter:', max);
        }
      }

      // Construire la liste des parents de lots directement en base (ne dépend pas du store)
      let lotParentIdsSet = new Set<string>();
      if (filterProductType.includes('lot_parent')) {
        try {
          const { data: parentRows, error: parentErr } = await supabase
            .from('lot_components')
            .select('product_id')
            .not('product_id', 'is', null);
          if (!parentErr && parentRows) {
            (parentRows as any[]).forEach((r: any) => {
              if (r && r.product_id) lotParentIdsSet.add(r.product_id as string);
            });
          } else if (parentErr) {
            console.error('Error fetching lot parent ids from lot_components:', parentErr);
          }
        } catch (e) {
          console.error('Exception fetching lot parent ids:', e);
        }

        // Appliquer le filtre côté DB
        if (lotParentIdsSet.size === 0) {
          // Forcer résultat vide si aucun parent trouvé
          queryBuilder = queryBuilder.eq('id', '00000000-0000-0000-0000-000000000000' as any);
        } else {
          queryBuilder = queryBuilder.in('id', Array.from(lotParentIdsSet) as any);
        }
      }

      // Adapter la limite pour garantir que tous les parents de lots soient récupérés
      let limitValue = 50;
      if (filterProductType.includes('lot_parent') && lotParentIdsSet.size > 50) {
        limitValue = lotParentIdsSet.size;
      }
      queryBuilder = queryBuilder.order('created_at', { ascending: false }).limit(limitValue);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error applying filters:', error);
        throw error;
      }

      console.log('Filters applied, results:', data?.length);

      // Appliquer les filtres frontend (statut, stock, lot parent, parent miroir)
      let results = (data as any[]) || [];

      // Filtre stock
      if (filterStock === 'in_stock') {
        results = results.filter(p => (p.stock || 0) >= 1);
        console.log('Applied stock filter: in_stock, results:', results.length);
      } else if (filterStock === 'out_of_stock') {
        results = results.filter(p => (p.stock || 0) === 0);
        console.log('Applied stock filter: out_of_stock, results:', results.length);
      } else if (filterStock === 'low_stock') {
        results = results.filter(p => p.stock_alert !== null && (p.stock || 0) <= p.stock_alert);
        console.log('Applied stock filter: low_stock, results:', results.length);
      }

      // Filtre statut (frontend uniquement - pas de champ status en DB)
      if (filterStatus.length > 0) {
        console.log('Status filter selected but not implemented (no status field in DB):', filterStatus);
      }

      // Filtre type produit supplémentaire (parent miroir, lot parent)
      if (filterProductType.includes('mirror_parent')) {
        try {
          const { data: mirrorRows, error: mirrorErr } = await supabase
            .from('products')
            .select('parent_id')
            .is('serial_number', null)
            .not('parent_id', 'is', null);
          if (!mirrorErr && mirrorRows) {
            const mirrorParentIds = Array.from(
              new Set(((mirrorRows as any[]) || []).map((r: any) => r.parent_id).filter(Boolean))
            );
            results = results.filter((p: any) => mirrorParentIds.includes(p.id));
            console.log('Applied mirror parent filter (frontend via children):', mirrorParentIds.length);
          } else {
            results = [];
            console.warn('Mirror parent filter: no rows or error', mirrorErr);
          }
        } catch (e) {
          console.error('Error applying mirror parent filter:', e);
        }
      }

      setFilteredProducts(results);
    } catch (error) {
      console.error('Error in applyFilters:', error);
      setFilteredProducts([]);
    } finally {
      setIsSearching(false);
    }
  }, [
    filterType,
    filterBrand,
    filterModel,
    filterStatus,
    filterProductType,
    filterStock,
    filterPurchasePriceMin,
    filterPurchasePriceMax,
    filterSalePriceMin,
    filterSalePriceMax,
    filterMarginPercentMin,
    filterMarginPercentMax,
    filterMarginEuroMin,
    filterMarginEuroMax,
    filterVAT,
    filterSupplier,
    filterLocation,
    lots
  ]);

  // Appliquer les filtres automatiquement quand ils changent
  useEffect(() => {
    console.log('Filters changed, applying filters automatically');
    applyFilters(currentSearchQuery);
  }, [
    filterType,
    filterBrand,
    filterModel,
    filterStatus,
    filterProductType,
    filterStock,
    filterPurchasePriceMin,
    filterPurchasePriceMax,
    filterSalePriceMin,
    filterSalePriceMax,
    filterMarginPercentMin,
    filterMarginPercentMax,
    filterMarginEuroMin,
    filterMarginEuroMax,
    filterVAT,
    filterSupplier,
    filterLocation,
    applyFilters
  ]);

  const handleSearch = async (query: string) => {
    console.log('handleSearch called with query:', query);
    setCurrentSearchQuery(query);
    applyFilters(query);
  };

  const resetFilters = () => {
    console.log('Resetting all filters');
    setFilterType('');
    setFilterBrand('');
    setFilterModel('');
    setFilterStatus([]);
    setFilterProductType([]);
    setFilterStock('');
    setFilterPurchasePriceMin('');
    setFilterPurchasePriceMax('');
    setFilterSalePriceMin('');
    setFilterSalePriceMax('');
    setFilterMarginPercentMin('');
    setFilterMarginPercentMax('');
    setFilterMarginEuroMin('');
    setFilterMarginEuroMax('');
    setFilterVAT('');
    setFilterSupplier('');
    setFilterLocation('');
  };

  const countActiveFilters = (): number => {
    let count = 0;
    if (filterType) count++;
    if (filterBrand) count++;
    if (filterModel) count++;
    if (filterStatus.length > 0) count++;
    if (filterProductType.length > 0) count++;
    if (filterStock) count++;
    if (filterPurchasePriceMin || filterPurchasePriceMax) count++;
    if (filterSalePriceMin || filterSalePriceMax) count++;
    if (filterMarginPercentMin || filterMarginPercentMax) count++;
    if (filterMarginEuroMin || filterMarginEuroMax) count++;
    if (filterVAT) count++;
    if (filterSupplier) count++;
    if (filterLocation) count++;
    return count;
  };

  const exportProducts = (productsToExport: Product[]) => {
    const headers = [
      'SKU',
      'Nom',
      'Type',
      'Marque',
      'Modèle',
      'Prix d\'achat HT',
      'Prix magasin HT',
      'Prix pro HT',
      'Stock',
      'Alerte stock',
      'Emplacement',
      'EAN',
      'Poids (g)',
      'Largeur (cm)',
      'Hauteur (cm)',
      'Profondeur (cm)',
      'Description'
    ].join(',');

    const csvContent = [
      headers,
      ...productsToExport.map(product => [
        product.sku,
        `"${product.name.replace(/"/g, '""')}"`,
        product.category?.type || '',
        product.category?.brand || '',
        product.category?.model || '',
        product.purchase_price_with_fees,
        product.retail_price,
        product.pro_price,
        product.stock,
        product.stock_alert || '',
        product.location || '',
        product.ean || '',
        product.weight_grams,
        product.width_cm || '',
        product.height_cm || '',
        product.depth_cm || '',
        `"${(product.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produits-${currentSearchQuery ? 'recherche' : 'tous'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportLowStockProducts = () => {
    const lowStockProducts = products.filter(product =>
      product.stock_alert !== null &&
      product.stock <= product.stock_alert
    );

    if (lowStockProducts.length === 0) {
      alert('Aucun produit n\'a besoin d\'être réapprovisionné pour le moment.');
      return;
    }

    const csvContent = [
      ['SKU', 'Nom', 'Type', 'Marque', 'Modèle', 'Stock actuel', 'Seuil d\'alerte', 'Emplacement', 'EAN'].join(','),
      ...lowStockProducts.map(product => [
        product.sku,
        `"${product.name.replace(/"/g, '""')}"`,
        product.category?.type || '',
        product.category?.brand || '',
        product.category?.model || '',
        product.stock,
        product.stock_alert,
        product.location || '',
        product.ean || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produits-a-reapprovisionner-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Liste des produits</h1>
          <div className="relative flex items-center gap-2">
            <div className="w-96">
              <ProductSearch onSearch={handleSearch} initialQuery={currentSearchQuery} />
            </div>
            {currentSearchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 whitespace-nowrap"
              >
                <X size={16} />
                Effacer
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => exportProducts(products)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download size={18} />
            Exporter tous les produits
          </button>
          <button
            onClick={exportLowStockProducts}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Download size={18} />
            Produits à réapprovisionner
          </button>
          <button
            onClick={() => setIsLotCSVImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <Upload size={18} />
            Importer des lots CSV
          </button>
          {currentSearchQuery && (
            <button
              onClick={() => exportProducts(filteredProducts)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 whitespace-nowrap"
            >
              <Download size={18} />
              Exporter la recherche
            </button>
          )}
        </div>
      </div>

      {/* Zone de filtres avancés */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* En-tête cliquable */}
        <div
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {isFiltersExpanded ? (
            <ChevronDown size={20} className="text-blue-600 transition-transform" />
          ) : (
            <ChevronRight size={20} className="text-blue-600 transition-transform" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">Filtres avancés</h2>
          {countActiveFilters() > 0 && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {countActiveFilters()}
            </span>
          )}
        </div>

        {/* Contenu des filtres */}
        {isFiltersExpanded && (
          <div className="p-6 pt-2 space-y-4 border-t border-gray-200">
            {/* Ligne 1 - Filtres généraux */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Select Nature du produit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nature du produit
                </label>
                <select
                  value={filterType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toutes les catégories</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Select Marque */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marque
                </label>
                <select
                  value={filterBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  disabled={!filterType}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Toutes les marques</option>
                  {filteredBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              {/* Select Modèle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle
                </label>
                <select
                  value={filterModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!filterBrand}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Tous les modèles</option>
                  {filteredModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 1bis - Statut du produit */}
            <div className="grid grid-cols-1 gap-3">
              {/* Multi-select Statut du produit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut du produit
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setFilterStatus(prev =>
                        prev.includes('online')
                          ? prev.filter(s => s !== 'online')
                          : [...prev, 'online']
                      );
                    }}
                    className={`px-3 py-1 text-sm rounded-md border ${
                      filterStatus.includes('online')
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    En ligne
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus(prev =>
                        prev.includes('offline')
                          ? prev.filter(s => s !== 'offline')
                          : [...prev, 'offline']
                      );
                    }}
                    className={`px-3 py-1 text-sm rounded-md border ${
                      filterStatus.includes('offline')
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Pas en ligne
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus(prev =>
                        prev.includes('obsolete')
                          ? prev.filter(s => s !== 'obsolete')
                          : [...prev, 'obsolete']
                      );
                    }}
                    className={`px-3 py-1 text-sm rounded-md border ${
                      filterStatus.includes('obsolete')
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Obsolète
                  </button>
                </div>
              </div>
            </div>

            {/* Ligne 2 - Type de produit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de produit
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setFilterProductType(prev =>
                      prev.includes('PAM')
                        ? prev.filter(t => t !== 'PAM')
                        : [...prev, 'PAM']
                    );
                  }}
                  className={`px-4 py-2 text-sm rounded-md border font-medium ${
                    filterProductType.includes('PAM')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  PAM
                </button>
                <button
                  onClick={() => {
                    setFilterProductType(prev =>
                      prev.includes('PAU')
                        ? prev.filter(t => t !== 'PAU')
                        : [...prev, 'PAU']
                    );
                  }}
                  className={`px-4 py-2 text-sm rounded-md border font-medium ${
                    filterProductType.includes('PAU')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  PAU
                </button>
                <button
                  onClick={() => {
                    setFilterProductType(prev =>
                      prev.includes('mirror_parent')
                        ? prev.filter(t => t !== 'mirror_parent')
                        : [...prev, 'mirror_parent']
                    );
                  }}
                  className={`px-4 py-2 text-sm rounded-md border font-medium ${
                    filterProductType.includes('mirror_parent')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Parent miroir
                </button>
                <button
                  onClick={() => {
                    setFilterProductType(prev =>
                      prev.includes('lot_parent')
                        ? prev.filter(t => t !== 'lot_parent')
                        : [...prev, 'lot_parent']
                    );
                  }}
                  className={`px-4 py-2 text-sm rounded-md border font-medium ${
                    filterProductType.includes('lot_parent')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Lot parent
                </button>
              </div>
            </div>

            {/* Ligne 3 - Filtres stock et prix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Select Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock
                </label>
                <select
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les stocks</option>
                  <option value="in_stock">En stock (≥1)</option>
                  <option value="out_of_stock">Rupture (= 0)</option>
                  <option value="low_stock">Sous alerte</option>
                </select>
              </div>

              {/* Prix d'achat / Prix de vente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix d'achat (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterPurchasePriceMin}
                    onChange={(e) => setFilterPurchasePriceMin(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterPurchasePriceMax}
                    onChange={(e) => setFilterPurchasePriceMax(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix de vente (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterSalePriceMin}
                    onChange={(e) => setFilterSalePriceMin(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterSalePriceMax}
                    onChange={(e) => setFilterSalePriceMax(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Ligne 3bis - Marges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marge (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterMarginPercentMin}
                    onChange={(e) => setFilterMarginPercentMin(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterMarginPercentMax}
                    onChange={(e) => setFilterMarginPercentMax(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marge (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterMarginEuroMin}
                    onChange={(e) => setFilterMarginEuroMin(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterMarginEuroMax}
                    onChange={(e) => setFilterMarginEuroMax(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div></div>
            </div>

            {/* Ligne 4 - Filtres avancés */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Select TVA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TVA
                </label>
                <select
                  value={filterVAT}
                  onChange={(e) => setFilterVAT(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les types</option>
                  <option value="normal">Normale</option>
                  <option value="margin">Marge</option>
                </select>
              </div>

              {/* Searchable select Fournisseur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les fournisseurs</option>
                  {suppliers.map(supplier => (
                    <option key={supplier} value={supplier}>{supplier}</option>
                  ))}
                </select>
              </div>

              {/* Select Emplacement de stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emplacement de stock
                </label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les emplacements</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 5 - Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {countActiveFilters() > 0 && (
                  <span className="font-medium">{countActiveFilters()} filtre{countActiveFilters() > 1 ? 's' : ''} actif{countActiveFilters() > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  <RotateCcw size={16} />
                  Réinitialiser
                </button>
                <button
                  onClick={() => applyFilters(currentSearchQuery)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Filter size={16} />
                  Filtrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ProductList
        products={filteredProducts}
        lots={lots}
      />

      <LotCSVImport
        isOpen={isLotCSVImportOpen}
        onClose={() => setIsLotCSVImportOpen(false)}
        onImportComplete={() => {
          setIsLotCSVImportOpen(false);
          fetchLots();
        }}
      />

    </div>
  );
};
