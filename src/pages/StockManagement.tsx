import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Upload, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { ImportDialog } from '../components/ImportProgress/ImportDialog';
import { useCSVImport } from '../hooks/useCSVImport';

interface StockGroup {
  id: string;
  name: string;
  synchronizable: boolean;
}

interface Stock {
  id: string;
  name: string;
  group_id: string;
  group?: StockGroup;
}

interface ProductStock {
  id: string;
  product_id: string;
  stock_id: string;
  quantity: number;
  product?: {
    name: string;
    sku: string;
  };
  stock?: {
    name: string;
  };
}

export const StockManagement: React.FC = () => {
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newGroup, setNewGroup] = useState({ name: '', synchronizable: false });
  const [newStock, setNewStock] = useState({ name: '', group_id: '' });
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch stock groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('stock_groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;
      setStockGroups(groupsData || []);

      // Fetch stocks with their groups
      const { data: stocksData, error: stocksError } = await supabase
        .from('stocks')
        .select(`
          *,
          group:stock_groups(*)
        `)
        .order('name');

      if (stocksError) throw stocksError;
      setStocks(stocksData || []);

      // Fetch product stocks with product details
      const { data: productStocksData, error: productStocksError } = await supabase
        .from('product_stocks')
        .select(`
          *,
          product:products(name, sku),
          stock:stocks(name)
        `)
        .order('created_at', { ascending: false });

      if (productStocksError) throw productStocksError;
      setProductStocks(productStocksData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      setError('Le nom du groupe est requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_groups')
        .insert([{
          name: newGroup.name.toUpperCase(),
          synchronizable: newGroup.synchronizable
        }]);

      if (error) throw error;
      
      setNewGroup({ name: '', synchronizable: false });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding stock group');
    }
  };

  const handleAddStock = async () => {
    if (!newStock.name.trim()) {
      setError('Le nom du stock est requis');
      return;
    }

    if (!newStock.group_id) {
      setError('Le groupe est requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('stocks')
        .insert([{
          name: newStock.name.toUpperCase(),
          group_id: newStock.group_id
        }]);

      if (error) throw error;
      
      setNewStock({ name: '', group_id: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding stock');
    }
  };

  const handleUpdateGroup = async (id: string, updates: Partial<StockGroup>) => {
    if (!updates.name?.trim()) {
      setError('Le nom du groupe est requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_groups')
        .update({
          ...updates,
          name: updates.name?.toUpperCase()
        })
        .eq('id', id);

      if (error) throw error;
      
      setEditingGroup(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating stock group');
    }
  };

  const handleUpdateStock = async (id: string, updates: Partial<Stock>) => {
    if (!updates.name?.trim()) {
      setError('Le nom du stock est requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('stocks')
        .update({
          ...updates,
          name: updates.name?.toUpperCase()
        })
        .eq('id', id);

      if (error) throw error;
      
      setEditingStock(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating stock');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe de stock ?')) return;
    
    try {
      const { error } = await supabase
        .from('stock_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting stock group');
    }
  };

  const handleDeleteStock = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce stock ?')) return;
    
    try {
      const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting stock');
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = 'name,group_name\nBACK MARKET,INTERNET\nSAV UA,SAV';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stocks_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          const [name, groupName] = rows[i].split(',').map(field => field?.trim() || '');
          
          if (!name || !groupName) {
            throw new Error(`Format de ligne invalide: ${rows[i]}`);
          }

          // Get or create stock group
          const { data: group } = await supabase
            .from('stock_groups')
            .select('id')
            .eq('name', groupName.toUpperCase())
            .single();

          if (group) {
            // Create stock
            const { error: stockError } = await supabase
              .from('stocks')
              .insert([{
                name: name.toUpperCase(),
                group_id: group.id
              }]);

            if (stockError && !stockError.message.includes('duplicate')) {
              throw stockError;
            }
          }

          incrementProgress();
        } catch (err) {
          console.error('Error importing stock:', err);
          importErrors.push({
            line: i + 2,
            message: `Erreur avec le stock ${rows[i]}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
          });
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (importErrors.length > 0) {
        setImportError(importErrors);
      } else {
        setImportSuccess(`${rows.length} stocks importés avec succès`);
      }

      fetchData();
    } catch (error) {
      console.error('Import error:', error);
      setImportError([{
        line: 0,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'importation'
      }]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center sticky top-0 bg-gray-100 z-50 py-4">
        <h1 className="text-2xl font-bold">Gestion Multi-Stock</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download size={18} />
            Template CSV
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
            <Upload size={18} />
            Importer CSV
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Stock Groups Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="sticky top-[5.5rem] bg-white z-40 p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Groupes de Stock</h2>
          
          {/* Add Stock Group Form */}
          <div className="flex gap-4">
            <input
              type="text"
              value={newGroup.name}
              onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
              placeholder="Nom du groupe"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md uppercase"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newGroup.synchronizable}
                onChange={(e) => setNewGroup(prev => ({ ...prev, synchronizable: e.target.checked }))}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span>Synchronisable</span>
            </label>
            <button
              onClick={handleAddGroup}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Stock Groups List */}
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Synchronisable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockGroups.map(group => (
                <tr key={group.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingGroup === group.id ? (
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => setStockGroups(groups => 
                          groups.map(g => g.id === group.id ? { ...g, name: e.target.value.toUpperCase() } : g)
                        )}
                        className="px-2 py-1 border border-gray-300 rounded-md uppercase"
                      />
                    ) : (
                      group.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingGroup === group.id ? (
                      <input
                        type="checkbox"
                        checked={group.synchronizable}
                        onChange={(e) => setStockGroups(groups => 
                          groups.map(g => g.id === group.id ? { ...g, synchronizable: e.target.checked } : g)
                        )}
                        className="form-checkbox h-5 w-5 text-blue-600"
                      />
                    ) : (
                      <span className={group.synchronizable ? 'text-green-600' : 'text-red-600'}>
                        {group.synchronizable ? 'Oui' : 'Non'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {editingGroup === group.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateGroup(group.id, {
                              name: group.name,
                              synchronizable: group.synchronizable
                            })}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => setEditingGroup(null)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingGroup(group.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stocks Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="sticky top-[5.5rem] bg-white z-40 p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Stocks</h2>
          
          {/* Add Stock Form */}
          <div className="flex gap-4">
            <input
              type="text"
              value={newStock.name}
              onChange={(e) => setNewStock(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
              placeholder="Nom du stock"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md uppercase"
            />
            <select
              value={newStock.group_id}
              onChange={(e) => setNewStock(prev => ({ ...prev, group_id: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Sélectionner un groupe</option>
              {stockGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddStock}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Stocks List */}
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Groupe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stocks.map(stock => (
                <tr key={stock.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingStock === stock.id ? (
                      <input
                        type="text"
                        value={stock.name}
                        onChange={(e) => setStocks(stocks => 
                          stocks.map(s => s.id === stock.id ? { ...s, name: e.target.value.toUpperCase() } : s)
                        )}
                        className="px-2 py-1 border border-gray-300 rounded-md uppercase"
                      />
                    ) : (
                      stock.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingStock === stock.id ? (
                      <select
                        value={stock.group_id}
                        onChange={(e) => setStocks(stocks => 
                          stocks.map(s => s.id === stock.id ? { ...s, group_id: e.target.value } : s)
                        )}
                        className="px-2 py-1 border border-gray-300 rounded-md"
                      >
                        {stockGroups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    ) : (
                      stock.group?.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {editingStock === stock.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateStock(stock.id, {
                              name: stock.name,
                              group_id: stock.group_id
                            })}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => setEditingStock(null)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingStock(stock.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteStock(stock.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Stocks */}
      <div className="bg-white rounded-lg shadow">
        <div className="sticky top-[5.5rem] bg-white z-40 p-6 border-b">
          <h2 className="text-lg font-semibold">Produits en Stock</h2>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantité
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productStocks.map(ps => (
                <tr key={ps.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{ps.product?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ps.product?.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ps.stock?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{ps.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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