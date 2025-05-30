import React, { useEffect, useState } from 'react';
import { ProductList } from '../components/Products/ProductList';
import { useProductStore } from '../store/productStore';
import { ProductSearch } from '../components/Search/ProductSearch';
import { Download } from 'lucide-react';
import Fuse from 'fuse.js';
import type { Database } from '../types/supabase';

type Product = Database['public']['Tables']['products']['Row'] & {
  category?: {
    type: string;
    brand: string;
    model: string;
  } | null;
};

export const Products: React.FC = () => {
  const { products, fetchProducts } = useProductStore();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      await fetchProducts();
      
      // Check for search query and trigger search if needed
      const savedQuery = sessionStorage.getItem('productSearchQuery');
      const shouldTriggerSearch = sessionStorage.getItem('shouldTriggerSearch');
      
      if (savedQuery && shouldTriggerSearch === 'true') {
        handleSearch(savedQuery);
        setCurrentSearchQuery(savedQuery);
        sessionStorage.removeItem('shouldTriggerSearch');
      }
    };

    loadProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!currentSearchQuery) {
      setFilteredProducts(products);
    } else {
      handleSearch(currentSearchQuery);
    }
  }, [products, currentSearchQuery]);

  const handleSearch = (query: string) => {
    setCurrentSearchQuery(query);

    if (!query.trim()) {
      setFilteredProducts(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'sku', weight: 2 },
        { name: 'ean', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'location', weight: 1 },
        { name: 'category.type', weight: 1.5 },
        { name: 'category.brand', weight: 1.5 },
        { name: 'category.model', weight: 1.5 }
      ],
      threshold: 0.4,
      distance: 200,
      minMatchCharLength: 2,
      ignoreLocation: true,
      findAllMatches: true,
    });

    const results = fuse.search(query);
    setFilteredProducts(results.map(result => result.item));
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
        <h1 className="text-2xl font-bold">Liste des produits</h1>
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
          <div className="relative flex items-center gap-2">
            <div className="w-96">
              <ProductSearch onSearch={handleSearch} initialQuery={currentSearchQuery} />
            </div>
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
      </div>
      <ProductList products={filteredProducts} />
    </div>
  );
};