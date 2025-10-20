import React, { useState, useEffect, useRef } from 'react';
import { useProductStore } from '../store/productStore';
import { Download, Upload, Plus, X, Settings, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Define marketplace types
interface Marketplace {
  id: string;
  name: string;
  icon: string;
  shippingFee: number;
  fixedFee: number;
  commission: number;
  vat: number;
  lossEstimation: number;
}

// Define product price configuration
interface ProductPriceConfig {
  productId: string;
  marketplaceId: string;
  price: number;
}

export const MarketplaceSimulator: React.FC = () => {
  const { products, fetchProducts } = useProductStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([
    { 
      id: 'amazon-fba', 
      name: 'Amazon FBA', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1024px-Amazon_logo.svg.png',
      shippingFee: 5,
      fixedFee: 0.99,
      commission: 15,
      vat: 20,
      lossEstimation: 2
    },
    { 
      id: 'amazon', 
      name: 'Amazon', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1024px-Amazon_logo.svg.png',
      shippingFee: 0,
      fixedFee: 0.99,
      commission: 12,
      vat: 20,
      lossEstimation: 1
    },
    { 
      id: 'ebay', 
      name: 'eBay', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/EBay_logo.svg/1200px-EBay_logo.svg.png',
      shippingFee: 0,
      fixedFee: 0.35,
      commission: 10,
      vat: 20,
      lossEstimation: 1
    },
    { 
      id: 'acheaper', 
      name: 'Acheaper', 
      icon: 'https://acheaper.com/wp-content/uploads/2022/01/logo-acheaper.png',
      shippingFee: 0,
      fixedFee: 0,
      commission: 8,
      vat: 20,
      lossEstimation: 0.5
    }
  ]);
  
  const [productPrices, setProductPrices] = useState<Record<string, Record<string, string>>>({});
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [currentMarketplace, setCurrentMarketplace] = useState<Marketplace | null>(null);
  const [currentProduct, setCurrentProduct] = useState<string | null>(null);
  const [newMarketplaceName, setNewMarketplaceName] = useState('');
  const [newMarketplaceIcon, setNewMarketplaceIcon] = useState('');
  const [addMarketplaceModalOpen, setAddMarketplaceModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      await fetchProducts();
      setIsLoading(false);
    };
    
    loadProducts();
  }, [fetchProducts]);

  // Initialize product prices
  useEffect(() => {
    const initialPrices: Record<string, Record<string, string>> = {};
    
    products.forEach(product => {
      initialPrices[product.id] = {};
      marketplaces.forEach(marketplace => {
        initialPrices[product.id][marketplace.id] = '';
      });
    });
    
    setProductPrices(initialPrices);
  }, [products, marketplaces]);

  const handlePriceChange = (productId: string, marketplaceId: string, value: string) => {
    setProductPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [marketplaceId]: value
      }
    }));
  };

  const openConfigModal = (product: any, marketplace: Marketplace) => {
    console.log('Opening config modal for product:', product.id, 'and marketplace:', marketplace.id);
    setCurrentProduct(product.id);
    setCurrentMarketplace({...marketplace}); // Clone the marketplace object to avoid direct state mutation
    setConfigModalOpen(true);
  };

  const handleMarketplaceConfigChange = (field: keyof Marketplace, value: string) => {
    console.log(`Updating ${field} to ${value}`);
    if (!currentMarketplace) return;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) && value !== '') return;
    
    setCurrentMarketplace(prev => {
      if (!prev) return null;
      return { ...prev, [field]: numValue };
    });
  };

  const saveMarketplaceConfig = () => {
    if (!currentMarketplace) return;
    
    console.log('Saving marketplace config:', currentMarketplace);
    
    setMarketplaces(prev => 
      prev.map(m => 
        m.id === currentMarketplace.id 
          ? { ...currentMarketplace } 
          : m
      )
    );
    
    setConfigModalOpen(false);
  };

  const calculateMargin = (product: any, price: string, marketplace: Marketplace) => {
    if (!price || isNaN(parseFloat(price))) return { marginNet: 0, marginPercent: 0 };
    
    const sellingPrice = parseFloat(price);
    const purchasePrice = product.purchase_price_with_fees || 0;
    
    // Calculate fees
    const shippingFee = marketplace.shippingFee;
    const fixedFee = marketplace.fixedFee;
    const commissionAmount = (sellingPrice * marketplace.commission) / 100;
    const lossAmount = (sellingPrice * marketplace.lossEstimation) / 100;
    
    const totalFees = shippingFee + fixedFee + commissionAmount + lossAmount;
    
    let marginNet = 0;
    let marginPercent = 0;
    
    if (product.vat_type === 'normal') {
      // TVA normale: Prix HT = prix TTC / 1.2
      const priceHT = sellingPrice / 1.2;
      marginNet = priceHT - (purchasePrice + totalFees);
      marginPercent = (marginNet * 100) / purchasePrice;
    } else {
      // TVA marge: 
      // Marge brute = prix TTC - prix d'achat avec frais
      const margeBrute = sellingPrice - purchasePrice;
      // TVA à payer = marge brute / 1.2 × 0.2
      const tvaAPayer = (margeBrute / 1.2) * 0.2;
      // Marge nette = prix TTC - TVA à payer - prix d'achat avec frais - total des frais
      marginNet = sellingPrice - tvaAPayer - purchasePrice - totalFees;
      // Marge % = (marge nette × 100) / prix d'achat avec frais
      marginPercent = (marginNet * 100) / purchasePrice;
    }
    
    return { marginNet, marginPercent };
  };

  const handleAddMarketplace = () => {
    if (!newMarketplaceName.trim()) {
      setError('Le nom de la marketplace est obligatoire');
      return;
    }
    
    if (!newMarketplaceIcon.trim()) {
      setError('L\'icône de la marketplace est obligatoire');
      return;
    }
    
    const newId = `custom-${Date.now()}`;
    const newMarketplace: Marketplace = {
      id: newId,
      name: newMarketplaceName,
      icon: newMarketplaceIcon,
      shippingFee: 0,
      fixedFee: 0,
      commission: 0,
      vat: 20,
      lossEstimation: 0
    };
    
    setMarketplaces(prev => [...prev, newMarketplace]);
    
    // Add the new marketplace to all product prices
    setProductPrices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(productId => {
        updated[productId][newId] = '';
      });
      return updated;
    });
    
    setNewMarketplaceName('');
    setNewMarketplaceIcon('');
    setAddMarketplaceModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewMarketplaceIcon(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadSampleCSV = () => {
    const headers = ['sku', 'amazon_fba_price', 'amazon_price', 'ebay_price', 'acheaper_price'];
    const rows = products.map(product => {
      return [
        product.sku,
        productPrices[product.id]?.['amazon-fba'] || '',
        productPrices[product.id]?.['amazon'] || '',
        productPrices[product.id]?.['ebay'] || '',
        productPrices[product.id]?.['acheaper'] || ''
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'marketplace_prices.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        // Map marketplace columns to IDs
        const marketplaceColumns: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (index === 0) return; // Skip SKU column
          
          if (header === 'amazon_fba_price') marketplaceColumns[index] = 'amazon-fba';
          else if (header === 'amazon_price') marketplaceColumns[index] = 'amazon';
          else if (header === 'ebay_price') marketplaceColumns[index] = 'ebay';
          else if (header === 'acheaper_price') marketplaceColumns[index] = 'acheaper';
          else {
            // Custom marketplace
            const customId = `custom-${header.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            marketplaceColumns[index] = customId;
            
            // Check if this custom marketplace already exists
            if (!marketplaces.some(m => m.id === customId)) {
              setMarketplaces(prev => [
                ...prev,
                {
                  id: customId,
                  name: header,
                  icon: 'https://via.placeholder.com/50?text=' + encodeURIComponent(header),
                  shippingFee: 0,
                  fixedFee: 0,
                  commission: 0,
                  vat: 20,
                  lossEstimation: 0
                }
              ]);
            }
          }
        });
        
        // Process data rows
        const newPrices = { ...productPrices };
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',');
          const sku = values[0];
          
          // Find product by SKU
          const product = products.find(p => p.sku === sku);
          if (!product) continue;
          
          // Update prices
          for (let j = 1; j < values.length; j++) {
            const marketplaceId = marketplaceColumns[j];
            if (marketplaceId && newPrices[product.id]) {
              newPrices[product.id][marketplaceId] = values[j];
            }
          }
        }
        
        setProductPrices(newPrices);
        
      } catch (err) {
        console.error('Error parsing CSV:', err);
        setError('Erreur lors de l\'importation du fichier CSV');
      }
    };
    
    reader.readAsText(file);
  };

  if (isLoading) {
    return <div className="p-6 text-center">Chargement des produits...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Simulateur Marketplace</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download size={18} />
            Exemple CSV
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            <Upload size={18} />
            Importer CSV
            <input
              type="file"
              onChange={handleImportCSV}
              accept=".csv"
              className="hidden"
            />
          </label>
          <button
            onClick={() => setAddMarketplaceModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <Plus size={18} />
            Ajouter une marketplace
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type de TVA
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom du produit
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix d'achat brut
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix d'achat avec frais
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix de vente magasin
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix de vente pro
              </th>
              {marketplaces.map(marketplace => (
                <th key={marketplace.id} className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-center">
                  <div className="flex flex-col items-center">
                    <img 
                      src={marketplace.icon} 
                      alt={marketplace.name} 
                      className="w-8 h-8 object-contain mb-2" 
                    />
                    <span className="text-xs font-medium text-gray-500 uppercase">{marketplace.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map(product => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.vat_type || 'Non défini'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.sku}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.raw_purchase_price?.toFixed(2) || '-'} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.purchase_price_with_fees?.toFixed(2) || '-'} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.retail_price?.toFixed(2) || '-'} €
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.pro_price?.toFixed(2) || '-'} €
                </td>
                {marketplaces.map(marketplace => {
                  const price = productPrices[product.id]?.[marketplace.id] || '';
                  const { marginNet, marginPercent } = calculateMargin(product, price, marketplace);
                  
                  return (
                    <td key={`${product.id}-${marketplace.id}`} className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={price}
                            onChange={(e) => handlePriceChange(product.id, marketplace.id, e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded-md text-center"
                            placeholder="Prix €"
                          />
                          <button
                            onClick={() => openConfigModal(product, marketplace)}
                            className="text-gray-500 hover:text-gray-700"
                            title="Configurer"
                          >
                            <Settings size={16} />
                          </button>
                        </div>
                        
                        {price && !isNaN(parseFloat(price)) && (
                          <div className="text-xs">
                            <div className={`font-medium ${marginNet > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {marginNet.toFixed(2)} € 
                              <span className="text-gray-500 mx-1">|</span>
                              {marginPercent.toFixed(2)}%
                            </div>
                            <div className="text-gray-500 mt-1">
                              {product.vat_type === 'normal' ? 'Marge net HT' : 'Marge net TVM'}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7 + marketplaces.length} className="px-6 py-4 text-center text-gray-500">
                  Aucun produit trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Marketplace Configuration Modal */}
      {configModalOpen && currentMarketplace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Configuration de {currentMarketplace.name}</h2>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais d'expédition (€)
                </label>
                <input
                  type="number"
                  value={currentMarketplace.shippingFee}
                  onChange={(e) => handleMarketplaceConfigChange('shippingFee', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais fixes (€)
                </label>
                <input
                  type="number"
                  value={currentMarketplace.fixedFee}
                  onChange={(e) => handleMarketplaceConfigChange('fixedFee', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  value={currentMarketplace.commission}
                  onChange={(e) => handleMarketplaceConfigChange('commission', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TVA (%)
                </label>
                <input
                  type="number"
                  value={currentMarketplace.vat}
                  onChange={(e) => handleMarketplaceConfigChange('vat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimation de perte (%)
                </label>
                <input
                  type="number"
                  value={currentMarketplace.lossEstimation}
                  onChange={(e) => handleMarketplaceConfigChange('lossEstimation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveMarketplaceConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Marketplace Modal */}
      {addMarketplaceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Ajouter une marketplace</h2>
              <button
                onClick={() => setAddMarketplaceModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la marketplace
                </label>
                <input
                  type="text"
                  value={newMarketplaceName}
                  onChange={(e) => setNewMarketplaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Ex: Cdiscount"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icône de la marketplace
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={newMarketplaceIcon}
                    onChange={(e) => setNewMarketplaceIcon(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="URL de l'image"
                  />
                  <span className="text-gray-500">ou</span>
                  <label className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md cursor-pointer hover:bg-gray-300">
                    Parcourir
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                </div>
                
                {newMarketplaceIcon && (
                  <div className="mt-2 flex justify-center">
                    <img 
                      src={newMarketplaceIcon} 
                      alt="Aperçu" 
                      className="h-16 object-contain" 
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setAddMarketplaceModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAddMarketplace}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};