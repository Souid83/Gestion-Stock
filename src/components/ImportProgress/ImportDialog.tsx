import React from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';

export interface ImportError {
  line: number;
  message: string;
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  current: number;
  total: number;
  status: 'progress' | 'success' | 'error';
  errors?: ImportError[];
  successMessage?: string;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  current,
  total,
  status,
  errors = [],
  successMessage = 'Import terminé avec succès'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        {status === 'progress' && (
          <>
            <h3 className="text-lg font-semibold mb-4">Importation en cours</h3>
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(current / total) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {current} / {total} éléments traités
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700 mb-2">Import réussi</h3>
            <p className="text-gray-600 mb-6">{successMessage}</p>
            <button
              onClick={onClose}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
            >
              OK
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="flex items-center mb-4">
              <XCircle className="w-8 h-8 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-red-700">Import annulé</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-700 mb-2">Les erreurs suivantes ont été détectées :</p>
              <ul className="text-sm text-red-600 space-y-1">
                {errors.slice(0, 3).map((error, index) => (
                  <li key={index} className="bg-red-50 p-2 rounded">
                    Ligne {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onClose}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};