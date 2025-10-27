/**
 * ImportDialog Component
 * Dialog for showing import progress
 */

import React from 'react';
import { X, Upload } from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  progress?: number;
  status?: string;
}

export function ImportDialog({ isOpen, onClose, progress = 0, status = 'En cours...' }: ImportDialogProps) {
  if (!isOpen) return null;

  console.log('[ImportDialog] Rendering with progress:', progress, 'status:', status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Import en cours</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{status}</span>
              <span className="text-sm font-medium text-gray-900">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {progress === 100 && (
            <div className="text-center">
              <p className="text-green-600 font-medium">Import terminé avec succès !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
