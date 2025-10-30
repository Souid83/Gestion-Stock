import React from 'react';
import { X, Plus } from 'lucide-react';
import { useNavigate } from '../../hooks/useNavigate';
import LabelPrintButton from './LabelPrintButton';

interface SerialNumberListModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  serialProducts: Array<{
    id: string;
    name?: string;
    serial_number: string;
    vat_type: 'normal' | 'margin';
    raw_purchase_price: number | null;
    purchase_price_with_fees: number;
    retail_price: number;
    pro_price: number;
    battery_level: number;
    supplier: string;
    product_note: string;
  }>;
}

export const SerialNumberListModal: React.FC<SerialNumberListModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  serialProducts
}) => {
  const { navigateToProduct } = useNavigate();

  if (!isOpen) return null;

  const getBatteryStatusColor = (level: number) => {
    if (level >= 85) return 'text-green-600';
    if (level >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleAddSerialNumber = () => {
    // Navigate to the serial number form with the parent product ID
    navigateToProduct('add-product-pam');
    // Store the parent ID in session storage
    sessionStorage.setItem('parentProductId', productId);
    console.log('Stored parentProductId in sessionStorage:', productId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Numéros de série</h2>
            <p className="text-gray-600">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type de TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro de série
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix d'achat brut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix d'achat avec frais
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente magasin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix vente pro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batterie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  État batterie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {serialProducts.map((product) => (
                <tr key={product.id} className={product.vat_type === 'margin' ? 'text-blue-600 font-bold' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.vat_type === 'normal' ? 'TVA normale' : 'TVA marge'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span>{product.serial_number}</span>
                      <LabelPrintButton
                        product={{
                          id: product.id,
                          name: product.name || productName,
                          serial_number: product.serial_number,
                          imei: null,
                          battery_level: product.battery_level,
                          product_note: product.product_note,
                          retail_price: product.retail_price,
                          pro_price: product.pro_price
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.raw_purchase_price !== null ? `${product.raw_purchase_price.toFixed(2)} €` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.purchase_price_with_fees.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.retail_price.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.pro_price.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.battery_level}%
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getBatteryStatusColor(product.battery_level)}`}>
                    {product.battery_level}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.supplier}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.product_note}
                  </td>
                </tr>
              ))}
              {serialProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    Aucun numéro de série associé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAddSerialNumber}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={18} />
            Ajouter un numéro de série
          </button>
        </div>
      </div>
    </div>
  );
};
