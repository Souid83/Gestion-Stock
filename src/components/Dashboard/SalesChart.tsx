import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', Amazon: 4000, eBay: 2400, Store: 2400 },
  { name: 'Feb', Amazon: 3000, eBay: 1398, Store: 2210 },
  { name: 'Mar', Amazon: 2000, eBay: 9800, Store: 2290 },
  { name: 'Apr', Amazon: 2780, eBay: 3908, Store: 2000 },
  { name: 'May', Amazon: 1890, eBay: 4800, Store: 2181 },
  { name: 'Jun', Amazon: 2390, eBay: 3800, Store: 2500 },
];

export const SalesChart: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Overview</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="Amazon" stackId="1" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.6} />
            <Area type="monotone" dataKey="eBay" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Store" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};