import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ProductList } from '../components/Products/ProductList';
import { useProductStore } from '../store/productStore';
import { useLotStore } from '../store/lotStore';
import { useCategoryStore } from '../store/categoryStore';
import { ProductSearch } from '../components/Search/ProductSearch';
import { Download, Upload, X, Filter, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';
import { LotCSVImport } from '../components/Lots/LotCSVImport';
import MirrorCSVImport from '../components/Products/MirrorCSVImport';
import type { ProductWithStock } from '../types/supabase';
import { supabase } from '../lib/supabase';
import { useNavigate } from '../hooks/useNavigate';

// Normalisation locale de la requête de recherche (sans export)
const normalizeQuery = (s: string): string => {
  try {
    return (s || '')
      .normalize('NFD') // décomposer les diacritiques
      .replace(/[\u0300-\u036f]/g, '') // retirer les diacritiques
      .replace(/\u00A0/g, ' ') // remplacer NBSP par espace
      .replace(/\s+/g, ' ') // compacter espaces multiples
      .trim()
      .toLowerCase();
  } catch {
    // Fallback si normalize NFD indisponible
    return (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
};

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
  const [isMirrorCSVImportOpen, setIsMirrorCSVImportOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const { navigateToProduct } = useNavigate();

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
  const [pamStockLocations, setPamStockLocations] = useState<string[]>([]);
  const [filterPAMStockLocation, setFilterPAMStockLocation] = useState<string>('');

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

      // Charger les dépôts (pour filtre PAM par emplacement)
      try {
        const { data: stockRows } = await supabase
          .from('stocks')
          .select('name')
          .order('name');
        if (Array.isArray(stockRows)) {
          const names = (stockRows as any[]).map((r: any) => (r?.name || '').toString().trim()).filter(Boolean);
          setPamStockLocations(names);
          console.log('Loaded PAM stock locations:', names.length);
        }
      } catch (e) {
        console.warn('Unable to load stock names for PAM filter:', e);
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

      // Accumulateur d'IDs (composition AND de filtres spéciaux)
      let idConstraint: Set<string> | null = null;
      const intersectIds = (a: Set<string> | null, b: string[]) => {
        const s = new Set(b.filter(Boolean));
        if (!a) return s;
        const out: string[] = [];
        a.forEach(x => { if (s.has(x)) out.push(x); });
        return new Set(out);
      };

      // Filtre de recherche textuelle
      {
        const normalized = normalizeQuery(query || '');
        // Ne pas déclencher de filtre texte si moins de 2 caractères visibles
        if (normalized.length >= 2) {
          const tokens = normalized.split(' ').filter(Boolean).slice(0, 5);
          if (tokens.length > 0) {
            // Construire un groupe OR qui contient:
            // - and(name ilike %token1%, name ilike %token2%, ...)
            // - sku ilike %normalized%
            // - ean ilike %normalized%
            const andName = tokens.map(t => `name.ilike.%${t}%`).join(',');
            const orGroup = `and(${andName}),sku.ilike.%${normalized}%,ean.ilike.%${normalized}%`;
            queryBuilder = queryBuilder.or(orGroup);
            console.log('Applied tokenized text search (normalizeQuery):', { tokens, normalized });
          } else {
            // Fallback: recherche sur SKU/EAN uniquement si pas de tokens valides
            queryBuilder = queryBuilder.or(`sku.ilike.%${normalized}%,ean.ilike.%${normalized}%`);
            console.log('Applied sku/ean search only (normalizeQuery):', normalized);
          }
        }
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

      // Filtre emplacement (PAU uniquement) - appliqué côté frontend pour ne pas exclure PAM involontairement
      if (filterLocation) {
        console.log('PAU location filter requested (frontend only):', filterLocation);
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

      // Pré-calcul des contraintes par ID (composition AND)
      // 1) Parent miroir → réduire le domaine aux parents qui ont au moins un enfant (non sérialisé)
      if (filterProductType.includes('mirror_parent')) {
        try {
          const { data: mirrorRows } = await supabase
            .from('products')
            .select('parent_id')
            .is('serial_number', null)
            .not('parent_id', 'is', null);
          const mirrorParentIds = Array.from(
            new Set(((mirrorRows as any[]) || []).map((r: any) => r?.parent_id).filter(Boolean))
          );
          if (mirrorParentIds.length >= 0) {
            idConstraint = intersectIds(idConstraint, mirrorParentIds);
          }
        } catch (e) {
          console.warn('mirror_parent prefilter failed:', e);
        }
      }

      // 2) Emplacement stock PAM uniquement → réduire au set des parents présents dans le dépôt choisi
      if (filterPAMStockLocation) {
        const norm = (s: string) => (s || '').replace(/\u00A0/g, ' ').trim().toUpperCase();
        try {
          // Trouver l'ID du dépôt par son nom
          const { data: depotRow, error: depotErr } = await supabase
            .from('stocks')
            .select('id,name')
            .eq('name' as any, filterPAMStockLocation as any)
            .maybeSingle();
          let depot: any = depotRow || null;
          if ((!depot || !depot.id) && !depotErr) {
            const { data: allStocks } = await supabase.from('stocks').select('id,name');
            const match = (Array.isArray(allStocks) ? allStocks : []).find((s: any) => norm(s?.name) === norm(filterPAMStockLocation));
            if (match) depot = { id: match.id, name: match.name };
          }

          let parentIds: string[] = [];
          if (depot?.id) {
            // A) Via stock_produit → enfants → parents
            try {
              const { data: spRows } = await supabase
                .from('stock_produit')
                .select('produit_id, quantite')
                .eq('stock_id' as any, depot.id as any)
                .gt('quantite' as any, 0 as any)
                .limit(50000);
              const childIds = Array.from(new Set(((Array.isArray(spRows) ? spRows : []) as any[]).map((r: any) => r?.produit_id).filter(Boolean)));
              if (childIds.length > 0) {
                const { data: children } = await supabase
                  .from('products')
                  .select('id,parent_id')
                  .in('id', childIds as any);
                const parentSet = new Set<string>();
                (Array.isArray(children) ? (children as any[]) : []).forEach((p: any) => {
                  const pid = (p?.parent_id as string) || (p?.id as string);
                  if (pid) parentSet.add(pid);
                });
                parentIds = Array.from(parentSet);
              }
            } catch (e) {
              console.warn('[PAM prefilter] stock_produit pipeline exception:', e);
            }

            // B) Fallback via vue products_with_stock si rien trouvé
            if (parentIds.length === 0) {
              try {
                const parentIdsSet = new Set<string>();
                const { data: rowsA } = await supabase
                  .from('products_with_stock')
                  .select('parent_id')
                  .eq('stock_id' as any, depot.id as any)
                  .not('parent_id', 'is', null)
                  .limit(50000);
                (Array.isArray(rowsA) ? rowsA as any[] : []).forEach((r: any) => { if (r?.parent_id) parentIdsSet.add(r.parent_id as string); });

                if (parentIdsSet.size === 0) {
                  const { data: rowsB } = await supabase
                    .from('products_with_stock')
                    .select('parent_id')
                    .eq('stock' as any, depot.id as any)
                    .not('parent_id', 'is', null)
                    .limit(50000);
                  (Array.isArray(rowsB) ? rowsB as any[] : []).forEach((r: any) => { if (r?.parent_id) parentIdsSet.add(r.parent_id as string); });
                }
                parentIds = Array.from(parentIdsSet);
              } catch (e) {
                console.warn('[PAM prefilter] products_with_stock fallback exception:', e);
              }
            }
          }

          // Appliquer comme contrainte d’IDs
          idConstraint = intersectIds(idConstraint, parentIds);
        } catch (e) {
          console.error('PAM depot prefilter error:', e);
          idConstraint = intersectIds(idConstraint, []); // aucun résultat
        }
      }

      // 3) Appliquer la contrainte d'ID au queryBuilder (intersection de tous les filtres spéciaux)
      if (idConstraint) {
        if (idConstraint.size === 0) {
          queryBuilder = queryBuilder.eq('id' as any, '00000000-0000-0000-0000-000000000000' as any);
        } else {
          queryBuilder = queryBuilder.in('id' as any, Array.from(idConstraint) as any);
        }
      }

      // Adapter la limite pour garantir que tous les parents de lots soient récupérés
      let limitValue = 50;
      // Recherche active: supprimer ORDER BY côté DB et plafonner la limite à 1000 (tri local prendra le relai)
      const normalizedForLimit = normalizeQuery(query || '');
      const tokensForLimit = normalizedForLimit.split(' ').filter(Boolean).slice(0, 5);
      // Logiques existantes conservées (PAM/lot parents)
      if (false && filterPAMStockLocation) {
        limitValue = 1000;
      }
      if (filterProductType.includes('lot_parent') && lotParentIdsSet.size > 50) {
        limitValue = Math.max(limitValue, lotParentIdsSet.size);
      }
      if (tokensForLimit.length > 0) {
        // Recherche texte active: pas d'ORDER BY côté DB, élargir vraiment la fenêtre
        limitValue = 1000;
        queryBuilder = queryBuilder.limit(limitValue);
      } else {
        // Recherche vide: conserver ORDER BY desc (comportement historique)
        queryBuilder = queryBuilder.order('created_at', { ascending: false }).limit(limitValue);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error applying filters:', error);
        throw error;
      }

      console.log('Filters applied, results:', data?.length);

      // Appliquer les filtres frontend (statut, stock, lot parent, parent miroir)
      let results = (data as any[]) || [];

      // Filtre stock (calcul robuste du stock total: stocks -> stock_total -> stock)
      const resolveTotalStock = (p: any): number => {
        if (Array.isArray(p?.stocks) && p.stocks.length > 0) {
          return p.stocks.reduce((sum: number, s: any) => sum + (s?.quantite || 0), 0);
        }
        if (typeof p?.stock_total === 'number') return p.stock_total;
        if (typeof p?.stock === 'number') return p.stock;
        return 0;
      };

      if (filterStock === 'in_stock') {
        results = results.filter(p => resolveTotalStock(p) >= 1);
        console.log('Applied stock filter: in_stock, results:', results.length);
      } else if (filterStock === 'out_of_stock') {
        results = results.filter(p => resolveTotalStock(p) === 0);
        console.log('Applied stock filter: out_of_stock, results:', results.length);
      } else if (filterStock === 'low_stock') {
        results = results.filter(p => p.stock_alert !== null && resolveTotalStock(p) <= p.stock_alert);
        console.log('Applied stock filter: low_stock, results:', results.length);
      }

      // Filtre statut (frontend uniquement - pas de champ status en DB)
      if (filterStatus.length > 0) {
        console.log('Status filter selected but not implemented (no status field in DB):', filterStatus);
      }

      // Filtres front complémentaires (emplacements PAU/PAM)
      if (filterLocation) {
        const locKey = filterLocation.toUpperCase();
        results = results.filter((p: any) =>
          !p.parent_id &&
          p.product_type === 'PAU' &&
          ((p.location || '').toUpperCase() === locKey)
        );
        console.log('Applied PAU location filter (frontend):', filterLocation, 'results:', results.length);
      }
      if (filterPAMStockLocation) {
        // Nouveau pipeline basé sur la réalité des données:
        // Enfants sérialisés dans products_with_stock, liés aux parents via parent_id et au dépôt via stock_id
        const norm = (s: string) => (s || '').replace(/\u00A0/g, ' ').trim().toUpperCase();

        try {
          // 1) Retrouver l'ID du dépôt par son nom (comparaison stricte sur name)
          const { data: depotRow, error: depotErr } = await supabase
            .from('stocks')
            .select('id,name')
            .eq('name' as any, filterPAMStockLocation as any)
            .maybeSingle();
          let depot = (depotRow as any) as { id?: string; name?: string } | null;
          // Fallback: si la comparaison stricte par name n'a rien renvoyé,
          // tenter une résolution côté client en normalisant les noms
          if ((!depot || !depot.id) && !depotErr) {
            const { data: allStocks, error: allErr } = await supabase
              .from('stocks')
              .select('id,name');
            if (!allErr && Array.isArray(allStocks)) {
              const match = (allStocks as any[]).find((s: any) => norm(s?.name) === norm(filterPAMStockLocation));
              if (match) {
                depot = { id: match.id, name: match.name } as any;
              }
            }
          }
          if (!depot || !depot.id) {
            console.warn('[PAM filter] Depot not found after fallback for name:', filterPAMStockLocation);
          }

          if (depotErr) {
            console.warn('[PAM filter] Depot fetch error:', depotErr);
          }

          let parentIds: string[] = [];

          if (depot?.id) {
            // A) Pipeline direct via stock_produit → children → parents
            try {
              // 1) Récupérer les produits (enfants) qui ont du stock dans ce dépôt
              const { data: spRows, error: spErr } = await supabase
                .from('stock_produit')
                .select('produit_id, quantite')
                .eq('stock_id' as any, depot?.id as any)
                .gt('quantite' as any, 0 as any)
                .limit(50000);

              if (spErr) {
                console.warn('[PAM filter] stock_produit fetch error:', spErr);
              }

              const childIds = Array.from(
                new Set(
                  (Array.isArray(spRows) ? (spRows as any[]) : [])
                    .map((r: any) => r?.produit_id)
                    .filter(Boolean)
                )
              );
              console.info('[PAM filter] stock_produit rows:', (Array.isArray(spRows) ? spRows.length : 0), 'childIds:', childIds.length);

              if (childIds.length > 0) {
                // 2) Convertir ces produits en parents (si parent_id présent, sinon id)
                const { data: children, error: chErr } = await supabase
                  .from('products')
                  .select('id,parent_id')
                  .in('id', childIds as any);

                if (chErr) {
                  console.warn('[PAM filter] products children fetch error:', chErr);
                }

                const parentSet = new Set<string>();
                (Array.isArray(children) ? (children as any[]) : []).forEach((p: any) => {
                  const pid = (p?.parent_id as string) || (p?.id as string);
                  if (pid) parentSet.add(pid);
                });

                parentIds = Array.from(parentSet);
                console.info('[PAM filter] parentIds via stock_produit:', parentIds.length);
              }
            } catch (eSP) {
              console.warn('[PAM filter] stock_produit pipeline exception:', eSP);
            }

            // Si rien trouvé via stock_produit, fallback legacy (inutile si products_with_stock n’a pas d’info dépôt)
            if (parentIds.length === 0) {
            // 2) Récupérer les parents via la vue products_with_stock (source de vérité pour la présence en stock par dépôt)
            // Essai A: utiliser la colonne stock_id (select strict sur parent_id)
            let parentIdsSet = new Set<string>();
            let countA = 0;
            try {
              const { data: rowsA, error: errA } = await supabase
                .from('products_with_stock')
                .select('parent_id')
                .eq('stock_id' as any, depot?.id as any)
                .not('parent_id', 'is', null)
                .limit(50000);
              if (errA) {
                console.warn('[PAM filter] children fetch error (stock_id):', errA);
              }
              const arrA = Array.isArray(rowsA) ? (rowsA as any[]) : [];
              countA = arrA.length;
              arrA.forEach((r: any) => { if (r?.parent_id) parentIdsSet.add(r.parent_id as string); });
            } catch (eA) {
              console.warn('[PAM filter] children fetch exception (stock_id):', eA);
            }
            console.info('[PAM filter] children rows via stock_id:', countA);

            // Essai B si nécessaire: autre nom de colonne possible "stock"
            let countB = 0;
            if (parentIdsSet.size === 0) {
              try {
                const { data: rowsB, error: errB } = await supabase
                  .from('products_with_stock')
                  .select('parent_id')
                  .eq('stock' as any, depot?.id as any)
                  .not('parent_id', 'is', null)
                  .limit(50000);
                if (errB) {
                  console.warn('[PAM filter] children fetch error (stock):', errB);
                }
                const arrB = Array.isArray(rowsB) ? (rowsB as any[]) : [];
                countB = arrB.length;
                arrB.forEach((r: any) => { if (r?.parent_id) parentIdsSet.add(r.parent_id as string); });
              } catch (eB) {
                console.warn('[PAM filter] children fetch exception (stock):', eB);
              }
            }
            console.info('[PAM filter] children rows via stock:', countB);

            parentIds = Array.from(parentIdsSet);
            console.info('[PAM filter] unique parentIds:', parentIds.length);
            }
          } else {
            console.warn('[PAM filter] No depot found with name:', filterPAMStockLocation);
          }

          // 3) Charger les parents correspondants
          if (parentIds.length > 0) {
            const { data: parentRows, error: parentErr } = await supabase
              .from('products')
              .select(`
                *,
                stocks:stock_produit (
                  quantite,
                  stock:stocks ( name )
                ),
                category:product_categories!products_category_id_fkey ( type, brand, model )
              `)
              .in('id', parentIds as any);

            if (!parentErr && Array.isArray(parentRows)) {
              results = parentRows as any[];
            } else {
              results = [];
              console.warn('[PAM filter] Parent rows fetch error or empty:', parentErr);
            }
          } else {
            results = [];
            console.info('[PAM filter] No parents found for depot:', filterPAMStockLocation);
          }

          console.info('[PAM filter] Done', {
            depot: depot?.name,
            depotId: depot?.id,
            parents: parentIds.length
          });
        } catch (e) {
          console.error('[PAM filter] Unexpected error:', e);
          results = [];
        }
      }

      // Filtre type produit supplémentaire (parent miroir, lot parent)
      if (false && filterProductType.includes('mirror_parent')) {
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
            if (mirrorParentIds.length > 0) {
              // Récupérer directement les parents côté DB avec les mêmes colonnes que la requête principale
              const { data: parentRows, error: parentErr2 } = await supabase
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
                `)
                .in('id', mirrorParentIds as any);
              if (!parentErr2 && Array.isArray(parentRows)) {
                results = parentRows as any[];
                console.log('Applied mirror parent filter (DB fetch):', results.length);
              } else {
                results = [];
                console.warn('Mirror parent DB fetch error or no rows:', parentErr2);
              }
            } else {
              results = [];
              console.warn('Mirror parent filter: no parent ids found');
            }
          } else {
            results = [];
            console.warn('Mirror parent filter: child rows error', mirrorErr);
          }
        } catch (e) {
          console.error('Error applying mirror parent filter (DB):', e);
          results = [];
        }
      }

      // Tri local par pertinence (score tokens dans name) puis created_at desc
      {
        const normalizedForSort = normalizeQuery(query || '');
        const tokensForSort = normalizedForSort.split(' ').filter(Boolean).slice(0, 5);
        if (normalizedForSort.length >= 2 && tokensForSort.length > 0) {
          const scored = results.map((p: any) => {
            const nameNorm = normalizeQuery(p?.name || '');
            const words = nameNorm.split(/[^a-z0-9]+/).filter(Boolean);
            const wordSet = new Set(words);

            let base = 0;
            let bonus = 0;

            for (const t of tokensForSort) {
              if (t.length <= 2) {
                // Tokens très courts: n’accepter que les matches “mot entier”
                const wordHit = wordSet.has(t);
                base += wordHit ? 1 : 0;
                bonus += wordHit ? 2 : 0;
              } else {
                const hit = nameNorm.includes(t);
                const wordHit = wordSet.has(t);
                base += hit ? 1 : 0;       // correspondance sous-chaîne
                bonus += wordHit ? 1 : 0;  // bonus si “mot entier”
              }
            }

            // Bonus de proximité “iphone” + modèle (ex: “15” ou “x”)
            let adjacencyBonus = 0;
            const hasIphone = wordSet.has('iphone');
            const modelToken = tokensForSort.find(t => t === 'x' || /^\d{1,2}$/.test(t));
            if (hasIphone && modelToken) {
              const idxIphone = words.indexOf('iphone');
              const idxModel = words.indexOf(modelToken);
              if (idxIphone >= 0 && idxModel >= 0) {
                const distance = Math.abs(idxIphone - idxModel);
                if (distance === 1) {
                  adjacencyBonus += 6; // “iphone 15” adjacent
                } else if (distance > 1) {
                  adjacencyBonus -= Math.min(distance - 1, 3); // petite pénalité si mots intercalés (pro, max…)
                }
              }
            }

            // Pénalité douce pour qualificatifs non demandés
            let qualPenalty = 0;
            const qualifiers = ['pro', 'max', 'promax', 'plus', 'mini', 'ultra'];
            for (const q of qualifiers) {
              if (wordSet.has(q) && !tokensForSort.includes(q)) {
                qualPenalty += 1;
              }
            }

            // Bonus pour qualificatifs explicitement demandés dans la requête
            const requestedQualifiers = qualifiers.filter(q => tokensForSort.includes(q));
            let reqQualBonus = 0;
            for (const rq of requestedQualifiers) {
              if (wordSet.has(rq)) {
                reqQualBonus += (rq === 'max' ? 4 : 3);
              }
            }

            const score = base * 10 + bonus + adjacencyBonus - qualPenalty + reqQualBonus;
            const createdAtMs = Date.parse(p?.created_at || '') || 0;
            const hasMaxReq = tokensForSort.includes('max') && wordSet.has('max');
            const hasProReq = tokensForSort.includes('pro') && wordSet.has('pro');
            return { p, score, createdAtMs, hasMaxReq, hasProReq };
          });
          scored.sort((a, b) => {
            if (a.hasMaxReq !== b.hasMaxReq) return (b.hasMaxReq ? 1 : 0) - (a.hasMaxReq ? 1 : 0);
            if (a.hasProReq !== b.hasProReq) return (b.hasProReq ? 1 : 0) - (a.hasProReq ? 1 : 0);
            if (b.score !== a.score) return b.score - a.score;
            return b.createdAtMs - a.createdAtMs;
          });
          console.table(scored.slice(0, 10).map(({ p, score }) => ({ name: p?.name, score })));
          results = scored.map(x => x.p);
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
    lots,
    filterPAMStockLocation
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
    filterPAMStockLocation,
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
    if (filterPAMStockLocation) count++;
    return count;
  };

  const exportProducts = async (productsToExport: Product[], mode?: 'tous' | 'recherche' | 'selection' | 'parents' | 'miroirs') => {
    // Special CSV export for mirror children (re-importable schema)
    if (mode === 'miroirs') {
      try {
        const children = (productsToExport || []).filter((p: any) => !!p?.parent_id && !p?.serial_number);
        const parentIds = Array.from(new Set(children.map((c: any) => c.parent_id).filter(Boolean)));
        let parentsById: Record<string, any> = {};
        if (parentIds.length > 0) {
          const { data: parentRows } = await supabase
            .from('products')
            .select(`
              id, sku, name, description,
              category:product_categories!products_category_id_fkey ( type, brand, model )
            `)
            .in('id', parentIds as any);
          (Array.isArray(parentRows) ? parentRows as any[] : []).forEach((p: any) => { parentsById[p.id] = p; });
        }
        const enc = (val: any) => {
          const s = val === null || val === undefined ? '' : String(val);
          return (s.includes('"') || s.includes(',') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const headers = [
          'parent_sku',
          'parent_name',
          'child_sku',
          'child_name',
          'description',
          'category_type',
          'category_brand',
          'category_model'
        ].join(',');
        const rows = children.map((child: any) => {
          const parent = parentsById[child.parent_id] || {};
          const cat = child?.category || parent?.category || {};
          const parentSku = (parent?.sku || '').toString().toUpperCase();
          const parentName = parent?.name || '';
          const childSku = (child?.sku || '').toString().toUpperCase();
          const childName = child?.name || '';
          const description = (child?.description || parent?.description || '') || '';
          const type = cat?.type || '';
          const brand = cat?.brand || '';
          const model = cat?.model || '';
          return [
            enc(parentSku),
            enc(parentName),
            enc(childSku),
            enc(childName),
            enc(description),
            enc(type),
            enc(brand),
            enc(model)
          ].join(',');
        });
        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `miroirs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error('Mirror CSV export failed:', e);
        window.alert('Export miroirs échoué. Voir la console pour détails.');
      }
      return;
    }
    // Colonnes identiques à l'export complet existant + parent_id
    // Build headers identical to PAU import sample (base + dynamic stock_* columns)
    // Strict PAU import sample headers (no parent_id)
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

    // Fetch ALL stock names from DB to mirror the import sample columns
    let stockNames: string[] = [];
    try {
      const { data: dbStocks } = await supabase
        .from('stocks')
        .select('name')
        .order('name');
      stockNames = ((dbStocks as any[]) || [])
        .map((r: any) => r?.name)
        .filter((n: any) => typeof n === 'string' && n.length > 0);
    } catch (e) {
      console.warn('Failed to fetch stocks for export; falling back to union from products:', e);
      const stockNamesSet = new Set<string>();
      productsToExport.forEach((p: any) => {
        (p?.stocks || []).forEach((s: any) => {
          const n = s?.stock?.name;
          if (n && typeof n === 'string') stockNamesSet.add(n);
        });
      });
      stockNames = Array.from(stockNamesSet).sort((a, b) => a.localeCompare(b));
    }

    const headers = baseHeaders.concat(stockNames.map(n => `stock_${n}`)).join(',');

    const isParent = (p: Product) => !p.parent_id;

    // Construire la map parent -> miroirs (uniquement miroirs non sérialisés)
    const mirrorsByParent = new Map<string, Product[]>();
    (products as Product[])
      .filter((p: any) => !!p.parent_id && !p.serial_number)
      .forEach((m: any) => {
        const arr = mirrorsByParent.get(m.parent_id as string) || [];
        arr.push(m as Product);
        mirrorsByParent.set(m.parent_id as string, arr);
      });

    // Ordonner: parents puis leurs miroirs (si un parent fait partie de l'export)
    const handled = new Set<string>();
    const ordered: Product[] = [];

    if (mode === 'parents') {
      // Exporter uniquement des parents (aucun miroir) en se basant UNIQUEMENT sur productsToExport
      const parentsMap = new Map<string, Product>();
      const pool = [...filteredProducts, ...(products as Product[])];

      for (const item of productsToExport) {
        let parent: Product | undefined = undefined;
        if (item.parent_id) {
          parent = pool.find(x => x.id === (item.parent_id as string));
        } else {
          parent = item;
        }
        if (parent && !parent.parent_id) {
          parentsMap.set(parent.id, parent);
        }
      }

      // Déduplication + aucun miroir ajouté
      for (const parent of parentsMap.values()) {
        if (!handled.has(parent.id)) {
          ordered.push(parent);
          handled.add(parent.id);
        }
      }
    } else {
      for (const p of productsToExport) {
        if (handled.has(p.id)) continue;
        if (isParent(p)) {
          ordered.push(p);
          handled.add(p.id);
          const children = mirrorsByParent.get(p.id) || [];
          for (const c of children) {
            if (!handled.has(c.id)) {
              ordered.push(c);
              handled.add(c.id);
            }
          }
        } else {
          // Miroir: l'inclure seul sauf si le parent est déjà présent dans productsToExport
          const parentIncluded = productsToExport.some(x => x.id === (p.parent_id as string));
          if (!parentIncluded) {
            ordered.push(p);
            handled.add(p.id);
          }
        }
      }
    }

    const esc = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val);
      return (s.includes('"') || s.includes(',') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const orderedFinal = mode === 'parents' ? ordered.filter(p => !p.parent_id) : ordered;

    const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
    const rows = orderedFinal.map((p: any) => {
      const totalStock = (p?.stocks || []).reduce((sum: number, s: any) => sum + (s?.quantite || 0), 0);
      const base = [
        esc(toStr(p?.name || '')),
        toStr((p?.sku || '').toUpperCase()),
        toStr(p?.purchase_price_with_fees ?? ''),
        toStr(p?.retail_price ?? ''),
        toStr(p?.pro_price ?? ''),
        toStr(p?.weight_grams ?? ''),
        esc(toStr((p?.location || '').toUpperCase())),
        toStr(p?.ean || ''),
        toStr(totalStock),
        toStr(p?.stock_alert ?? ''),
        esc(toStr(p?.description || '')),
        toStr(p?.width_cm ?? ''),
        toStr(p?.height_cm ?? ''),
        toStr(p?.depth_cm ?? ''),
        toStr(p?.category?.type || ''),
        toStr(p?.category?.brand || ''),
        toStr(p?.category?.model || ''),
        toStr(p?.vat_type || ''),
        toStr(p?.margin_percent ?? ''),
        toStr(p?.pro_margin_percent ?? '')
      ];
      // Per-depot stock columns in the same order as headers
      const perStock: Record<string, number> = {};
      stockNames.forEach(n => { perStock[n] = 0; });
      (p?.stocks || []).forEach((s: any) => {
        const n = s?.stock?.name;
        if (n && perStock.hasOwnProperty(n)) {
          perStock[n] = (perStock[n] || 0) + (s?.quantite || 0);
        }
      });
      const stockCells = stockNames.map(n => String(perStock[n] ?? 0));
      return base.concat(stockCells).join(',');
    });

    // Prepend the same warning lines as the PAU import sample
    const warningLine0 = '# ⚠️ FORMAT DÉCIMAL : Utilisez le POINT comme séparateur décimal (ex: 4.96 )';
    const warningLine1 = '# ⚠️ PRIX : Saisir retail_price et pro_price tels quels (pas de conversion automatique valeurs enregistrées comme saisies)';
    const warningLine2 = '# ⚠️ PRIX vs MARGE : Renseigner soit le prix de vente (retail_price/pro_price) soit la marge % (margin_percent/pro_margin_percent) mais PAS les deux';
    const warningLine3 = '# ⚠️ STOCKS : La somme des quantités réparties entre les colonnes de stock doit égaler la quantité totale (colonne stock)';
    const warningLine4 = '# Exemple ligne 1 (TVA normale) : purchase_price=2.18, retail_price=14.99 -> sauvegardé comme 14.99, pro_price=4.96 -> sauvegardé comme 4.96';
    const warningLine5 = '# Exemple ligne 2 (TVA marge) : purchase_price=2.18, retail_price=17.99 -> sauvegardé comme 17.99, pro_price=5.95 -> sauvegardé comme 5.95';
    const warningLine6 = '';

    const csvContent = [
      warningLine0,
      warningLine1,
      warningLine2,
      warningLine3,
      warningLine4,
      warningLine5,
      warningLine6,
      headers,
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const suffix = mode ?? (currentSearchQuery ? 'recherche' : 'tous');
    link.download = `produits-${suffix}-${new Date().toISOString().split('T')[0]}.csv`;
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
          {/* Import dropdown */}
          <div className="relative z-[75]">
            <button
              onClick={() => setIsImportMenuOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              aria-haspopup="menu"
              aria-expanded={isImportMenuOpen}
              title="Importer"
            >
              <Upload size={18} />
              Importer
            </button>
            {isImportMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-[70]">
                <button
                  onClick={() => { setIsImportMenuOpen(false); navigateToProduct('add-product-multiple'); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Importer des PAM (parents multi-prix)
                </button>
                <button
                  onClick={() => { setIsImportMenuOpen(false); navigateToProduct('add-product'); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Importer des PAU (prix d’achat unique)
                </button>
                <button
                  onClick={() => { setIsImportMenuOpen(false); setIsLotCSVImportOpen(true); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Importer des lots CSV
                </button>
                <button
                  onClick={() => { setIsImportMenuOpen(false); setIsMirrorCSVImportOpen(true); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                  title="Importer des miroirs via CSV (parent_sku, parent_name, child_sku, child_name, description, category_type, category_brand, category_model)"
                >
                  Importer des miroirs
                </button>
              </div>
            )}
          </div>

              {/* Bouton Exporter la sélection (sécurisé) */}
              <button
                onClick={async () => {
                  try {
                    const selected = (filteredProducts || []).filter((p: any) => selectedProductIds.includes(p.id) && !p.serial_number);
                    if (!selected || selected.length === 0) {
                      window.alert('Aucun élément sélectionné.');
                      return;
                    }
                    const hasParent = selected.some((p: any) => !p.parent_id);
                    const hasChildMirror = selected.some((p: any) => !!p.parent_id && !p.serial_number);
                    if (hasParent && hasChildMirror) {
                      window.alert('Sélection invalide: impossible d’exporter en même temps des parents et des enfants miroirs. Veuillez ne sélectionner qu’un seul type.');
                      return;
                    }
                    // Autoriser l’export si un seul type est présent
                    // Parents uniquement OU enfants miroirs uniquement
                    await exportProducts(selected as any, hasParent ? 'parents' : 'miroirs');
                  } catch (e) {
                    console.error('Export sélection échoué:', e);
                    window.alert('Export sélection échoué. Voir la console pour plus de détails.');
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md ${selectedProductIds.length > 0 ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                disabled={selectedProductIds.length === 0}
                title="Exporter la sélection (parents OU enfants miroirs uniquement)"
              >
                <Download size={18} />
                Exporter la sélection
              </button>

              {/* Export dropdown */}
          <div className="relative z-[75]">
              <button
                onClick={() => setIsExportMenuOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                title="Exporter totalité base"
              >
                <Download size={18} />
                Exporter totalité base
              </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-[70]">
                {/* Base complète - Parents miroirs */}
                <button
                  onClick={async () => {
                    try {
                      setIsExportMenuOpen(false);
                      const { data: childRows } = await supabase
                        .from('products')
                        .select('parent_id')
                        .is('serial_number', null)
                        .not('parent_id', 'is', null)
                        .limit(50000);
                      const parentIds = Array.from(
                        new Set(((childRows as any[]) || []).map((r: any) => r.parent_id).filter(Boolean))
                      );
                      if (parentIds.length === 0) {
                        window.alert('Aucun parent miroir trouvé dans la base.');
                        return;
                      }
                      const { data: parents, error: parentErr } = await supabase
                        .from('products')
                        .select(`
                          *,
                          stocks:stock_produit (
                            quantite,
                            stock:stocks ( name )
                          ),
                          category:product_categories!products_category_id_fkey ( type, brand, model )
                        `)
                        .in('id', parentIds as any);
                      if (parentErr) {
                        console.error('Erreur export parents base complète:', parentErr);
                        window.alert('Export échoué (parents). Voir console pour détails.');
                        return;
                      }
                      await exportProducts(((parents as any[]) || []) as any, 'parents');
                    } catch (e) {
                      console.error('Export parents base complète échoué:', e);
                      window.alert('Export échoué (parents). Voir console pour détails.');
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Exporter tous les parents miroirs (base complète)
                </button>

                {/* Base complète - Enfants miroirs */}
                <button
                  onClick={async () => {
                    try {
                      setIsExportMenuOpen(false);
                      // 1) Récupérer tous les enfants miroirs (non sérialisés)
                      const { data: children, error: childErr } = await supabase
                        .from('products')
                        .select(`
                          *,
                          category:product_categories!products_category_id_fkey ( type, brand, model )
                        `)
                        .not('parent_id', 'is', null)
                        .is('serial_number', null)
                        .limit(50000);

                      if (childErr) {
                        console.error('Erreur fetch enfants miroirs:', childErr);
                        window.alert('Export échoué (enfants). Voir console pour détails.');
                        return;
                      }
                      const childList = (children as any[]) || [];
                      if (childList.length === 0) {
                        window.alert('Aucun enfant miroir trouvé dans la base.');
                        return;
                      }

                      // 2) Charger les parents correspondants (stocks + catégorie)
                      const parentIds = Array.from(new Set(childList.map((c: any) => c.parent_id).filter(Boolean)));
                      const { data: parentRows, error: parentErr } = await supabase
                        .from('products')
                        .select(`
                          *,
                          stocks:stock_produit (
                            quantite,
                            stock:stocks ( name )
                          ),
                          category:product_categories!products_category_id_fkey ( type, brand, model )
                        `)
                        .in('id', parentIds as any);

                      if (parentErr) {
                        console.error('Erreur fetch parents pour enfants:', parentErr);
                        window.alert('Export échoué (parents pour enfants). Voir console pour détails.');
                        return;
                      }

                      const parentsById: Record<string, any> = {};
                      ((parentRows as any[]) || []).forEach((p: any) => { parentsById[p.id] = p; });

                      // 3) Construire des "produits export" en réutilisant le générateur CSV existant
                      const pseudoProducts = childList.map((child: any) => {
                        const parent = parentsById[child.parent_id] || {};
                        return {
                          ...child,
                          // Valeurs issues du parent (prix, stocks, dimensions, VAT)
                          purchase_price_with_fees: parent.purchase_price_with_fees ?? null,
                          retail_price: parent.retail_price ?? null,
                          pro_price: parent.pro_price ?? null,
                          weight_grams: parent.weight_grams ?? null,
                          location: parent.location ?? null,
                          ean: parent.ean ?? null,
                          stock_alert: parent.stock_alert ?? null,
                          width_cm: parent.width_cm ?? null,
                          height_cm: parent.height_cm ?? null,
                          depth_cm: parent.depth_cm ?? null,
                          vat_type: parent.vat_type ?? null,
                          margin_percent: parent.margin_percent ?? null,
                          pro_margin_percent: parent.pro_margin_percent ?? null,
                          // Catégories: enfant si présent sinon parent
                          category: child.category ?? parent.category ?? null,
                          // Description: enfant prioritaire
                          description: child.description || parent.description || null,
                          // Stocks par dépôt: ceux du parent
                          stocks: parent.stocks || []
                        };
                      });

                      await exportProducts(pseudoProducts as any, 'miroirs');
                    } catch (e) {
                      console.error('Export enfants base complète échoué:', e);
                      window.alert('Export échoué (enfants). Voir console pour détails.');
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Exporter tous les enfants miroirs (base complète)
                </button>

                {/* 2) Exporter le résultat de recherche */}
                {currentSearchQuery && (
                  <button
                    onClick={() => { setIsExportMenuOpen(false); exportProducts(filteredProducts, 'recherche'); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                  >
                    Exporter le résultat de recherche
                  </button>
                )}

                {/* 3) Exporter parents uniquement */}
                <button
                  onClick={async () => {
                    setIsExportMenuOpen(false);
                    if (selectedProductIds.length > 0) {
                      try {
                        const { data: selRows } = await supabase
                          .from('products')
                          .select('id,parent_id')
                          .in('id', selectedProductIds as any);

                        const parentIds = new Set<string>();
                        ((selRows as any[]) || []).forEach((r: any) => {
                          if (r?.parent_id) parentIds.add(r.parent_id as string);
                          else if (r?.id) parentIds.add(r.id as string);
                        });

                        if (parentIds.size > 0) {
                          const { data: parentRows } = await supabase
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
                            `)
                            .in('id', Array.from(parentIds) as any);

                          const parentsOnly = ((parentRows as any[]) || []).filter((p: any) => !p.parent_id) as Product[];
                          if (parentsOnly.length > 0) {
                            exportProducts(parentsOnly, 'parents');
                            return;
                          }
                        }
                      } catch (e) {
                        console.warn('DB fetch parents failed:', e);
                      }
                    }

                    const visibleParents = filteredProducts.filter(p => !p.parent_id);
                    if (visibleParents.length > 0) {
                      exportProducts(visibleParents, 'parents');
                      return;
                    }

                    const storeParents = (products as Product[]).filter(p => !p.parent_id);
                    exportProducts(storeParents, 'parents');
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Exporter parents uniquement
                </button>

                {/* 4) Exporter miroirs uniquement */}
                <button
                  onClick={() => { setIsExportMenuOpen(false); exportProducts(filteredProducts.filter(p => !!p.parent_id), 'miroirs'); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Exporter miroirs uniquement
                </button>

                {/* 5) Exporter tous */}
                <button
                  onClick={() => { setIsExportMenuOpen(false); exportProducts(products, 'tous'); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Exporter tous
                </button>

                {/* 6) Produits à réapprovisionner */}
                <button
                  onClick={() => { setIsExportMenuOpen(false); exportLowStockProducts(); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                >
                  Produits à réapprovisionner (alerte stock)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zone de filtres avancés */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* En-tête cliquable + actions */}
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          {/* Zone gauche cliquable (toggle) */}
          <button
            type="button"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="flex items-center gap-3"
            aria-expanded={isFiltersExpanded}
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
          </button>

          {/* Zone droite (actions) */}
          {isFiltersExpanded && (
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={(e) => { e.stopPropagation(); resetFilters(); }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); applyFilters(currentSearchQuery); }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                title="Appliquer les filtres"
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filtrer</span>
              </button>
            </div>
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
                  Filtrer par disponibilité ou en alerte
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
                  Emplacement de stock PAU uniquement
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emplacement stock PAM uniquement
                </label>
                <select
                  value={filterPAMStockLocation}
                  onChange={(e) => setFilterPAMStockLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les emplacements</option>
                  {pamStockLocations.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}
      </div>

      <ProductList
        products={filteredProducts}
        lots={lots}
        onSelectionChange={setSelectedProductIds}
      />

      <LotCSVImport
        isOpen={isLotCSVImportOpen}
        onClose={() => setIsLotCSVImportOpen(false)}
        onImportComplete={() => {
          setIsLotCSVImportOpen(false);
          fetchLots();
        }}
      />

      <MirrorCSVImport
        isOpen={isMirrorCSVImportOpen}
        onClose={() => setIsMirrorCSVImportOpen(false)}
        onSuccess={() => {
          setIsMirrorCSVImportOpen(false);
          // Rafraîchir l'affichage en réappliquant les filtres/recherche en cours
          applyFilters(currentSearchQuery);
        }}
      />

    </div>
  );
};
