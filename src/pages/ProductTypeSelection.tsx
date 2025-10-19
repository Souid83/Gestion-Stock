import React from 'react';
import { Package, Boxes } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';

export const ProductTypeSelection: React.FC = () => {
  const { navigateToProduct } = useNavigate();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-12">Vous souhaitez créer :</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="flex flex-col h-full">
          <button
            onClick={() => navigateToProduct('add-product')}
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500 h-[200px]"
          >
            <Package size={48} className="text-blue-600 mb-4" />
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prix d'achat unique</h3>
              <p className="text-sm text-gray-600">Pour les produits avec un seul coûts d'acquisition</p>
            </div>
          </button>
          
          <div className="bg-blue-50 p-6 rounded-lg mt-4 flex-1">
            <h4 className="font-medium text-blue-900 mb-4">Quelle option choisir ?</h4>
            <div className="text-sm text-blue-800 space-y-3">
              <p className="font-semibold">Prix d'achat unique</p>
              <p>Pas de prix d'achat par numéro de série</p>
              <p>Idéal pour la majorité des produits  </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col h-full">
          <button
            onClick={() => navigateToProduct('add-product-pam')}
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-500 h-[200px]"
          >
            <Boxes size={48} className="text-green-600 mb-4" />
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prix d'achat multiple</h3>
              <p className="text-sm text-gray-600">Pour les produits avec différents coûts d'acquisition</p>
              <p className="text-sm text-gray-600">Idéal pour les produits avec numéro de série</p>
            </div>
          </button>
          
          <div className="bg-green-50 p-6 rounded-lg mt-4 flex-1">
            <h4 className="font-medium text-green-900 mb-4">Quelle option choisir ?</h4>
            <div className="text-sm text-green-800 space-y-3">
              <p className="font-semibold">Prix d'achat multiple</p>
              <p>Pour les produits avec différents coûts d'acquisition</p>
              <p>Idéal pour les produits avec numéro de série (Voiture, moto, produit high tech etc!!)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};