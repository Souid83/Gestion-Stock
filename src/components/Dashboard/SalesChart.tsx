/**
 * SalesChart Component
 * Displays sales data visualization
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
  data?: Array<{
    name: string;
    sales: number;
  }>;
}

export function SalesChart({ data = [] }: SalesChartProps) {
  console.log('[SalesChart] Rendering with data:', data);

  // Default empty data
  const chartData = data.length > 0 ? data : [
    { name: 'Lun', sales: 0 },
    { name: 'Mar', sales: 0 },
    { name: 'Mer', sales: 0 },
    { name: 'Jeu', sales: 0 },
    { name: 'Ven', sales: 0 },
    { name: 'Sam', sales: 0 },
    { name: 'Dim', sales: 0 },
  ];

  return (
    <div className="w-full h-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ventes</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="sales" fill="#3B82F6" name="Ventes" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
