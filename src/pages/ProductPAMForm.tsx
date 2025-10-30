console.log("LOADED: ProductPAMForm");

import React, { useState } from 'react';
import { ArrowLeft, Package, Boxes } from 'lucide-react';
import { useNavigate } from '../hooks/useNavigate';
import { ProductSerialForm } from './ProductSerialForm';

export const ProductPAMForm: React.FC = () => {
  const { navigateToProduct } = useNavigate();
  const [showSerialForm, setShowSerialForm] = useState(false);

  // Affichage direct du formulaire d'édition si editSerialProductId présent
  React.useEffect(() => {
    const editId = sessionStorage.getItem('editSerialProductId');
    if (editId) {
      setShowSerialForm(true);
    }
  }, []);

  if (showSerialForm) {
    return <ProductSerialForm />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigateToProduct('select-type')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Retour
        </button>
      </div>

      <h1 className="text-3xl font-bold text-center mb-12">Vous souhaitez créer :</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Button */}
        <div className="flex flex-col h-full">
          <button
            onClick={() => navigateToProduct('add-product-multiple')}
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500 h-[200px]"
          >
            <Package size={48} className="text-blue-600 mb-4" />
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prix d'achat multiple sans numéro de série</h3>
              <p className="text-sm text-gray-600">Permet de créer l'article en attente de futur numéro de série.</p>
            </div>
          </button>
          
          <div className="bg-blue-50 p-6 rounded-lg mt-4 flex-1">
            <h4 className="font-medium text-blue-900 mb-4">Quelle option choisir ?</h4>
            <div className="text-sm text-blue-800 space-y-3">
              <p>Prix d'achat multiple sans numéro de série</p>
              <p>Permet de créer l'article en attente de futur numéro de série.</p>
            </div>
          </div>
        </div>

        {/* Right Button */}
        <div className="flex flex-col h-full">
          <button
            onClick={() => setShowSerialForm(true)}
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-500 h-[200px]"
          >
            <Boxes size={48} className="text-green-600 mb-4" />
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Prix d'achat multiple avec numéro de série</h3>
              <p className="text-sm text-gray-600">Pour les produits avec différents coûts d'acquisition</p>
            </div>
          </button>
          
          <div className="bg-green-50 p-6 rounded-lg mt-4 flex-1">
            <h4 className="font-medium text-green-900 mb-4">Quelle option choisir ?</h4>
            <div className="text-sm text-green-800 space-y-3">
              <p>Prix d'achat multiple avec numéro de série</p>
              <p>Pour les produits avec différents coûts d'acquisition.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};