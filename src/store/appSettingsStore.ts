/**
 * App Settings Store
 * Zustand store for managing application settings
 */

import { create } from 'zustand';

interface AppSettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_siret: string;
  company_vat_number: string;
  invoice_prefix: string;
  invoice_next_number: number;
  quote_prefix: string;
  quote_next_number: number;
  default_tax_rate: number;
  currency: string;
  logo_url?: string;
}

interface AppSettingsStore {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_siret: '',
  company_vat_number: '',
  invoice_prefix: 'INV',
  invoice_next_number: 1,
  quote_prefix: 'DEV',
  quote_next_number: 1,
  default_tax_rate: 20,
  currency: 'EUR',
};

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    console.log('[AppSettingsStore] Fetching app settings');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      set({ settings: defaultSettings, isLoading: false });
    } catch (error) {
      console.error('[AppSettingsStore] Error fetching settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des paramètres',
        isLoading: false,
      });
    }
  },

  updateSettings: async (settings) => {
    console.log('[AppSettingsStore] Updating settings:', settings);
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual update in Supabase
      const currentSettings = get().settings || defaultSettings;
      const updatedSettings = { ...currentSettings, ...settings };

      set({ settings: updatedSettings, isLoading: false });
      console.log('[AppSettingsStore] Settings updated successfully');
    } catch (error) {
      console.error('[AppSettingsStore] Error updating settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour des paramètres',
        isLoading: false,
      });
    }
  },
}));
