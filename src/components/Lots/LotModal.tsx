/**
 * LotModal Component
 * Modal for managing product lots
 */

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface Lot {
  id: string;
  lot_number: string;
  quantity: number;
  purchase_date?: string;
  expiry_date?: string;
}

interface LotModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
  lots?: Lot[];
  onSave?: (lot: Partial<Lot>) => void;
}

export function LotModal({ isOpen, onClose, productId, productName, lots = [], onSave }: LotModalProps) {
  const [formData, setFormData] = useState({
    lot_number: '',
    quantity: 0,
    purchase_date: '',
    expiry_date: '',
  });

  console.log('[LotModal] Rendered', isOpen ? 'open' : 'closed', 'for product:', productId);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[LotModal] Submitting lot:', formData);
    if (onSave) {
      onSave(formData);
    }
    setFormData({
      lot_number: '',
      quantity: 0,
      purchase_date: '',
      expiry_date: '',
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Gestion des lots - {productName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Existing lots */}
          {lots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Lots existants</h3>
              <div className="space-y-2">
                {lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{lot.lot_number}</p>
                      <p className="text-sm text-gray-600">Quantité: {lot.quantity}</p>
                    </div>
                    {lot.expiry_date && (
                      <p className="text-sm text-gray-500">
                        Expire le: {new Date(lot.expiry_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new lot form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Ajouter un lot</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de lot *
              </label>
              <input
                type="text"
                name="lot_number"
                value={formData.lot_number}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'achat
                </label>
                <input
                  type="date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'expiration
                </label>
                <input
                  type="date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Fermer
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Ajouter le lot
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
