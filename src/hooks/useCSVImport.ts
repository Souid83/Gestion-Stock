import { useState } from 'react';
import type { ImportError } from '../components/ImportProgress/ImportDialog';

interface ImportState {
  isDialogOpen: boolean;
  current: number;
  total: number;
  status: 'progress' | 'success' | 'error';
  errors: ImportError[];
}

interface UseCSVImportReturn {
  importState: ImportState;
  startImport: (total: number) => void;
  incrementProgress: () => void;
  setImportSuccess: (message?: string) => void;
  setImportError: (errors: ImportError[]) => void;
  closeDialog: () => void;
}

export const useCSVImport = (): UseCSVImportReturn => {
  const [importState, setImportState] = useState<ImportState>({
    isDialogOpen: false,
    current: 0,
    total: 0,
    status: 'progress',
    errors: []
  });

  const startImport = (total: number) => {
    setImportState({
      isDialogOpen: true,
      current: 0,
      total,
      status: 'progress',
      errors: []
    });
  };

  const incrementProgress = () => {
    setImportState(prev => ({
      ...prev,
      current: prev.current + 1
    }));
  };

  const setImportSuccess = (message?: string) => {
    setImportState(prev => ({
      ...prev,
      status: 'success'
    }));
  };

  const setImportError = (errors: ImportError[]) => {
    setImportState(prev => ({
      ...prev,
      status: 'error',
      errors
    }));
  };

  const closeDialog = () => {
    setImportState(prev => ({
      ...prev,
      isDialogOpen: false,
      current: 0,
      total: 0,
      status: 'progress',
      errors: []
    }));
  };

  return {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  };
};