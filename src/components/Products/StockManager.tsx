import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Plus, Save, Trash2 } from 'lucide-react';

interface Stock {
  id: string;
  name: string;
  group_id: string;
  group?: {
    name: string;
    synchronizable: boolean;
  };
}

interface StockAllocation {
  id?: string;
  stock_id: string;
  stock_name?: string;
  group_name?: string;
  quantity: number;
}

interface StockManagerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  onStockUpdate?: () => void;
}

export const StockManager: React.FC<StockManagerProps> = ({
  isOpen,
  onClose,
  productId,
  onStockUpdate
}) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allocations, setAllocations] = useState<StockAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [globalStock, setGlobalStock] = useState(0);
  const [productName, setProductName] = useState('');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && productId) {
      fetchData();
    }
  }, [isOpen, productId]);

  useEffect(() => {
    const total = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    setTotalAllocated(total);
    setHasChanges(true);
  }, [allocations]);

  const fetchData = async () => {
    if (!productId) {
      setError("No product ID provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('name, stock')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProductName(productData.name);
      setGlobalStock(productData.stock || 0);

      // Fetch all available stocks
      const { data: stocksData, error: stocksError } = await supabase
        .from('stocks')
        .select(`
          *,
          group:stock_groups(name, synchronizable)
        `)
        .order('name');

      if (stocksError) throw stocksError;
      setStocks(stocksData || []);

      // Fetch product's current stocks
      const { data: productStocksData, error: productStocksError } = await supabase
        .from('stock_produit')
        .select(`
          id,
          stock_id,
          quantite,
          stock:stocks(
            name,
            group:stock_groups(name)
          )
        `)
        .eq('produit_id', productId);

      if (productStocksError) throw productStocksError;

      const transformedAllocations = productStocksData?.map(ps => ({
        id: ps.id,
        stock_id: ps.stock_id,
        stock_name: ps.stock.name,
        group_name: ps.stock.group?.name,
        quantity: ps.quantite
      })) || [];

      setAllocations(transformedAllocations);
      setHasChanges(false);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      setIsLoading(false);
    }
  };

  const handleAddStock = () => {
    if (!selectedStockId || quantity <= 0) {
      setError('Veuillez sélectionner un stock et entrer une quantité valide');
      return;
    }

    const selectedStock = stocks.find(s => s.id === selectedStockId);
    if (!selectedStock) return;

    const newTotal = totalAllocated + quantity;
    if (newTotal > globalStock) {
      setError(`La quantité totale allouée (${newTotal}) ne peut pas dépasser le stock global (${globalStock})`);
      return;
    }

    const newAllocation: StockAllocation = {
      stock_id: selectedStock.id,
      stock_name: selectedStock.name,
      group_name: selectedStock.group?.name,
      quantity: quantity
    };

    setAllocations([...allocations, newAllocation]);
    setSelectedStockId('');
    setQuantity(0);
    setError(null);
  };

  const handleUpdateQuantity = (stockId: string, newQuantity: number) => {
    const updatedAllocations = allocations.map(allocation => {
      if (allocation.stock_id === stockId) {
        return { ...allocation, quantity: newQuantity };
      }
      return allocation;
    });

    const newTotal = updatedAllocations.reduce((sum, a) => sum + a.quantity, 0);
    if (newTotal > globalStock) {
      setError(`La quantité totale allouée (${newTotal}) ne peut pas dépasser le stock global (${globalStock})`);
      return;
    }

    setAllocations(updatedAllocations);
    setError(null);
  };

  const handleRemoveStock = (stockId: string) => {
    setAllocations(allocations.filter(a => a.stock_id !== stockId));
    setError(null);
  };

  const handleSave = async () => {
    if (totalAllocated !== globalStock) {
      setError(`Le stock total alloué (${totalAllocated}) doit être égal au stock global (${globalStock})`);
      return;
    }

    try {
      // Delete all existing allocations
      await supabase
        .from('stock_produit')
        .delete()
        .eq('produit_id', productId);

      // Insert new allocations
      if (allocations.length > 0) {
        const { error: insertError } = await supabase
          .from('stock_produit')
          .insert(
            allocations.map(allocation => ({
              produit_id: productId,
              stock_id: allocation.stock_id,
              quantite: allocation.quantity
            }))
          );

        if (insertError) throw insertError;
      }

      // Update the product's total stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_total: totalAllocated })
        .eq('id', productId);

      if (updateError) throw updateError;

      setHasChanges(false);
      if (onStockUpdate) {
        onStockUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Error saving stock allocations:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving stock allocations');
    }
  };

  if (!isOpen) return null;

  const availableStocks = stocks.filter(
    stock => !allocations.some(allocation => allocation.stock_id === stock.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Gestion des stocks</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">{productName}</h3>
            <p className="text-blue-800">Stock global : {globalStock}</p>
          </div>

          {/* Add Stock Form */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Ajouter un stock</h3>
            <div className="flex gap-4">
              <select
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">Sélectionner un stock</option>
                {availableStocks.map(stock => (
                  <option key={stock.id} value={stock.id}>
                    {stock.name} ({stock.group?.name})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                placeholder="Qté"
              />
              <button
                onClick={handleAddStock}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={18} />
                Ajouter
              </button>
            </div>
          </div>

          {/* Allocations Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allocations.map((allocation) => (
                  <tr key={allocation.stock_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {allocation.stock_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {allocation.group_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="number"
                        value={allocation.quantity}
                        onChange={(e) => handleUpdateQuantity(allocation.stock_id, parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                        min="0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveStock(allocation.stock_id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      Aucun stock alloué
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary and Save */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Stock total alloué</h3>
                <p className={totalAllocated === globalStock ? 'text-green-600' : 'text-red-600'}>
                  {totalAllocated} / {globalStock}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges || totalAllocated !== globalStock}
                className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                  hasChanges && totalAllocated === globalStock
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Save size={18} />
                Valider
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};