import React, { useState, useEffect } from 'react';
import { Package, Search, X, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from '../../hooks/useNavigate';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_total: number;
  category?: {
    type: string;
    brand: string;
    model: string;
  };
  variant?: {
    color: string;
    grade: string;
    capacity: string;
  };
}

interface ProductSelectionWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  category: {
    type: string;
    brand: string;
    model: string;
  };
  variant: {
    color: string;
    grade: string;
    capacity: string;
  };
}

export const ProductSelectionWindow: React.FC<ProductSelectionWindowProps> = ({
  isOpen,
  onClose,
  onSelect,
  category,
  variant
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { navigateToProduct } = useNavigate();

  useEffect(() => {
    if (isOpen && category.type && category.brand && category.model) {
      fetchMatchingProducts();
    }
  }, [isOpen, category, variant]);

  const fetchMatchingProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          stock_total,
          category:product_categories!inner(
            type,
            brand,
            model
          )
        `)
        .eq('product_categories.type', category.type)
        .eq('product_categories.brand', category.brand)
        .eq('product_categories.model', category.model);

      if (fetchError) throw fetchError;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Erreur lors de la récupération des produits');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    onSelect(product);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Sélection du produit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center text-red-700">
              <AlertCircle size={20} className="mr-2" />
              {error}
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium text-blue-900">Critères de recherche</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p><strong>Catégorie:</strong> {category.type} {category.brand} {category.model}</p>
              </div>
              <div>
                <p><strong>Variante:</strong> {variant.color} {variant.grade} {variant.capacity}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Chargement des produits...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence>
                {products.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-2 h-2 rounded-full ${product.stock_total > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(product)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <span>Associer</span>
                      <CheckCircle size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
</div>

{/* Ajout du bouton ici pour qu'il apparaisse toujours */}
<div className="mt-6 text-center">
  <button
    onClick={() => navigateToProduct('add-product-multiple')}
    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center mx-auto space-x-2"
  >
    <span>Créer un nouveau produit</span>
    <ArrowRight size={20} />
  </button>
</div>

          )}
        </div>
      </motion.div>
    </div>
  );
};