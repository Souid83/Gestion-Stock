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
          <input
            type="text"
            id="serialNumber"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Entrez le numéro de série"
            required
          />
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