import React, { useEffect, useState } from 'react';
import { ProductList } from '../components/Products/ProductList';
import { useProductStore } from '../store/productStore';
import { useLotStore } from '../store/lotStore';
import { ProductSearch } from '../components/Search/ProductSearch';
import { Download, Upload, X } from 'lucide-react';
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
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [isLotCSVImportOpen, setIsLotCSVImportOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
    
  useEffect(() => {
    const loadProducts = async () => {
      await fetchLots();

      // Check for search query and trigger search if needed
      const savedQuery = sessionStorage.getItem('productSearchQuery');
      const shouldTriggerSearch = sessionStorage.getItem('shouldTriggerSearch');

      if (savedQuery && shouldTriggerSearch === 'true') {
        handleSearch(savedQuery);
        setCurrentSearchQuery(savedQuery);
        sessionStorage.removeItem('shouldTriggerSearch');
      } else {
        // Load initial 50 products
        handleSearch('');
      }
    };

    loadProducts();
  }, []);


  const handleSearch = async (query: string) => {
    console.log('handleSearch called with query:', query);
    setCurrentSearchQuery(query);
    setIsSearching(true);

    try {
      if (!query.trim()) {
        console.log('Empty query, loading first 50 products');
        // Load first 50 products
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            stocks:stock_produit (
              quantite,
              stock:stocks (
                name
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading initial products:', error);
          throw error;
        }

        console.log('Loaded products:', data?.length);
        setFilteredProducts((data as any[]) || []);
      } else {
        console.log('Searching Supabase for:', query);
        // Search in Supabase directly
        const searchTerm = query.trim();
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            stocks:stock_produit (
              quantite,
              stock:stocks (
                name
              )
            )
          `)
          .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,ean.ilike.%${searchTerm}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error searching products:', error);
          throw error;
        }

        console.log('Search results:', data?.length);
        setFilteredProducts((data as any[]) || []);
      }
    } catch (error) {
      console.error('Error in handleSearch:', error);
      setFilteredProducts([]);
    } finally {
      setIsSearching(false);
    }
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
