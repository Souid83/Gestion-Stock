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

interface StockAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  globalStock: number;
}

export const StockAllocationModal: React.FC<StockAllocationModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  globalStock
}) => {
useEffect(() => {
  console.log("StockAllocationModal - isOpen:", isOpen);
  if (isOpen) {
    fetchStocks();
  }
}, [isOpen]);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allocations, setAllocations] = useState<StockAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAllocated, setTotalAllocated] = useState(0);
  
  // New state for the add form
  const [selectedStockId, setSelectedStockId] = useState('');
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchStocks();
    }
  }, [isOpen]);

  useEffect(() => {
    // Calculate total allocated stock
    const total = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    setTotalAllocated(total);
  }, [allocations]);

  const fetchStocks = async () => {
    try {
      const { data: stocksData, error: stocksError } = await supabase
        .from('stocks')
        .select(`
          *,
          group:stock_groups(name, synchronizable)
        `)
        .order('name');

      if (stocksError) throw stocksError;
      setStocks(stocksData || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching stocks');
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

    const newAllocation: StockAllocation = {
      stock_id: selectedStock.id,
      stock_name: selectedStock.name,
      group_name: selectedStock.group?.name,
      quantity: quantity
    };

    const newTotal = totalAllocated + quantity;
    if (newTotal > globalStock) {
      setError('La quantité totale allouée ne peut pas dépasser le stock global');
      return;
    }

    setAllocations([...allocations, newAllocation]);
    setSelectedStockId('');
    setQuantity(0);
    setError(null);
  };

  const handleRemoveAllocation = (stockId: string) => {
    setAllocations(allocations.filter(a => a.stock_id !== stockId));
  };

  const handleSave = async () => {
    if (totalAllocated !== globalStock) {
      setError('Le stock total alloué doit être égal au stock global');
      return;
    }

    try {
      // Insert stock allocations
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
      onClose();
    } catch (err) {
      console.error('Error saving stock allocations:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving stock allocations');
    }
  };

if (!isOpen) return <div className="hidden" />;


  const availableStocks = stocks.filter(
    stock => !allocations.some(allocation => allocation.stock_id === stock.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Allocation du stock</h2>
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
            <p className="text-blue-800">Stock global à allouer : {globalStock}</p>
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
                      {allocation.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveAllocation(allocation.stock_id)}
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
                disabled={totalAllocated !== globalStock}
                className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                  totalAllocated === globalStock
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