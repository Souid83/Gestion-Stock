/**
 * useCSVImport Hook
 * Centralized import dialog state and helpers used across pages
 */

import { useCallback, useState } from 'react';

export interface ImportErrorItem {
  line: number;
  message: string;
}

export interface ImportState {
  isDialogOpen: boolean;
  current: number;
  total: number;
  status: string; // e.g., 'En cours...', 'Terminé', 'Erreurs'
  errors: ImportErrorItem[];
  successMessage: string | null;
}

export interface UseCSVImportResult {
  importState: ImportState;
  startImport: (total: number, status?: string) => void;
  incrementProgress: (step?: number) => void;
  setImportSuccess: (message: string) => void;
  setImportError: (errors: ImportErrorItem[]) => void;
  closeDialog: () => void;
}

const initialState: ImportState = {
  isDialogOpen: false,
  current: 0,
  total: 0,
  status: 'En cours...',
  errors: [],
  successMessage: null,
};

/**
 * Provides a stable API expected by multiple pages:
 * - importState.isDialogOpen, current, total, status, errors, successMessage
 * - startImport(total), incrementProgress(), setImportSuccess(msg), setImportError(errors), closeDialog()
 */
export function useCSVImport(): UseCSVImportResult {
  const [state, setState] = useState<ImportState>(initialState);

  const startImport = useCallback((total: number, status: string = 'En cours...') => {
    setState({
      isDialogOpen: true,
      current: 0,
      total: Math.max(0, Number(total) || 0),
      status,
      errors: [],
      successMessage: null,
    });
  }, []);

  const incrementProgress = useCallback((step: number = 1) => {
    setState((prev) => {
      const nextCurrent = Math.min(prev.total, prev.current + (Number(step) || 1));
      const done = prev.total > 0 && nextCurrent >= prev.total;
      return {
        ...prev,
        current: nextCurrent,
        status: done ? (prev.successMessage ? 'Terminé' : prev.status) : prev.status,
      };
    });
  }, []);

  const setImportSuccess = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      successMessage: message,
      status: 'Terminé',
      // keep dialog open so the user can review the message then close
      isDialogOpen: true,
    }));
  }, []);

  const setImportError = useCallback((errors: ImportErrorItem[]) => {
    setState((prev) => ({
      ...prev,
      errors: Array.isArray(errors) ? errors : [],
      status: 'Erreurs',
      isDialogOpen: true,
    }));
  }, []);

  const closeDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDialogOpen: false,
    }));
  }, []);

  return {
    importState: state,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog,
  };
}
