/**
 * ImportDialog Component
 * Dialog for showing import progress
 */

import React from 'react';
import { X, Upload } from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Either provide progress directly or current/total to compute it
  progress?: number;
  current?: number;
  total?: number;
  status?: string;
  errors?: { line: number; message: string }[];
  successMessage?: string | null;
}

export function ImportDialog({
  isOpen,
  onClose,
  progress,
  current,
  total,
  status = 'En cours...',
  errors = [],
  successMessage = null
}: ImportDialogProps) {
  if (!isOpen) return null;

  const computedProgress =
    typeof progress === 'number'
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : typeof current === 'number' && typeof total === 'number' && total > 0
      ? Math.max(0, Math.min(100, Math.round((current / total) * 100)))
      : 0;

  console.log('[ImportDialog] Rendering with progress:', computedProgress, 'status:', status);

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
              <span className="text-sm font-medium text-gray-900">{computedProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${computedProgress}%` }}
              />
            </div>
          </div>

          {computedProgress === 100 && (
            <div className="text-center space-y-2">
              <p className="text-green-600 font-medium">Import terminé avec succès !</p>
              {successMessage && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{successMessage}</p>
              )}
            </div>
          )}

          {Array.isArray(errors) && errors.length > 0 && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded p-3 max-h-40 overflow-auto">
              <p className="text-sm font-medium text-red-700 mb-1">Erreurs:</p>
              <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                {errors.slice(0, 20).map((e, idx) => (
                  <li key={idx}>
                    {typeof e?.line === 'number' ? `Ligne ${e.line}: ` : ''}
                    {e?.message || 'Erreur'}
                  </li>
                ))}
                {errors.length > 20 && (
                  <li className="italic">… {errors.length - 20} erreurs supplémentaires</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
