/**
 * useCSVImport Hook
 * Custom hook for CSV import functionality
 */

import { useState } from 'react';

interface UseCSVImportResult {
  importing: boolean;
  progress: number;
  error: string | null;
  importCSV: (file: File, onProgress?: (progress: number) => void) => Promise<void>;
}

export function useCSVImport(): UseCSVImportResult {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const importCSV = async (file: File, onProgress?: (progress: number) => void) => {
    console.log('[useCSVImport] Starting CSV import:', file.name);
    setImporting(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        if (onProgress) {
          onProgress(i);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('[useCSVImport] CSV import completed');
    } catch (err) {
      console.error('[useCSVImport] Error importing CSV:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'importation');
    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    progress,
    error,
    importCSV,
  };
}
