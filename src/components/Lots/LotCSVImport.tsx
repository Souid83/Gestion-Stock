/**
 * LotCSVImport Component
 * CSV import functionality for lots
 */

import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';

interface LotCSVImportProps {
  onImport?: (file: File) => Promise<void>;
  onClose?: () => void;
}

export function LotCSVImport({ onImport, onClose }: LotCSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.log('[LotCSVImport] File selected:', selectedFile.name);
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    console.log('[LotCSVImport] Starting import:', file.name);
    setImporting(true);

    try {
      if (onImport) {
        await onImport(file);
      }
      console.log('[LotCSVImport] Import completed');
      setFile(null);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[LotCSVImport] Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Importer des lots (CSV)</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="text-sm text-gray-600">
            Fichier sélectionné : {file.name}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={importing}
            >
              Annuler
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={18} />
            {importing ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
