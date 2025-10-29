/**
 * CustomerList Component
 * Displays list of customers
 */

import React from 'react';
import type { Customer } from '../../types/supabase';

interface CustomerListProps {
  customers?: Customer[];
  onSelectCustomer?: (customer: Customer) => void;
}

export function CustomerList({ customers = [], onSelectCustomer }: CustomerListProps) {
  console.log('[CustomerList] Rendering with', customers.length, 'customers');

  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Aucun client trouvé</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nom</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Téléphone</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {customers.map((customer) => (
            <tr
              key={customer.id}
              onClick={() => onSelectCustomer?.(customer)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 text-sm text-gray-900">{customer.name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{customer.email || '—'}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || '—'}</td>
              <td className="px-6 py-4 text-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCustomer?.(customer);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Voir détails
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
