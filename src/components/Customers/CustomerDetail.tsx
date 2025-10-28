/**
 * CustomerDetail Component
 * Display detailed customer information
 */

import React from 'react';
import { Mail, Phone, MapPin, X } from 'lucide-react';
import type { Customer } from '../../types/supabase';

interface CustomerDetailProps {
  customer: Customer;
  onClose?: () => void;
  onEdit?: () => void;
}

export function CustomerDetail({ customer, onClose, onEdit }: CustomerDetailProps) {
  console.log('[CustomerDetail] Displaying customer:', customer.id);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">{customer.name}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Modifier
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {customer.email && (
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-900">{customer.email}</p>
            </div>
          </div>
        )}

        {customer.phone && (
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="text-gray-900">{customer.phone}</p>
            </div>
          </div>
        )}

        {customer.address && (
          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Adresse</p>
              <p className="text-gray-900 whitespace-pre-line">{customer.address}</p>
            </div>
          </div>
        )}

        {customer.created_at && (
          <div className="pt-4 mt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Client depuis le {new Date(customer.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
