import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon }) => {
  const isPositive = change >= 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        </div>
        <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
          <span className="text-sm font-medium">{Math.abs(change)}%</span>
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
};