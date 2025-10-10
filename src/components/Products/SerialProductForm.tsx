import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SerialNumberFormProps {
  onSubmit: (serialNumber: string) => void;
  productName: string;
  productSku: string;
}

export const SerialNumberForm: React.FC<SerialNumberFormProps> = ({
  onSubmit,
  productName,
  productSku
}) => {
  const [serialNumber, setSerialNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialNumber.trim()) {
      onSubmit(serialNumber.trim());
    }
  };

  const handleSerialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 15); // Limit to 15 characters
    setSerialNumber(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-lg shadow-lg border border-gray-200"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Association du numéro de série</h3>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Produit:</span>
            <p className="font-medium text-gray-900">{productName}</p>
          </div>
          <div>
            <span className="text-gray-500">SKU:</span>
            <p className="font-medium text-gray-900">{productSku}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Numéro de série
          </label>
          <div className="relative">
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={handleSerialNumberChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Entrez le numéro de série"
              required
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              {serialNumber.length} / 15
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prix de vente magasin
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Prix HT"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                € HT
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                placeholder="Marge %"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                %
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Prix TTC"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                € TTC
              </span>
            </div>
          </div>
          <div className="mt-2 relative">
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
              placeholder="Marge réelle"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
              €
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prix de vente pro
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Prix HT"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                € HT
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                placeholder="Marge %"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                %
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Prix TTC"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                € TTC
              </span>
            </div>
          </div>
          <div className="mt-2 relative">
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
              placeholder="Marge réelle"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
              €
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Associer le numéro de série
        </button>
      </form>
    </motion.div>
  );
};