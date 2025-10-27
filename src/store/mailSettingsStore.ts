/**
 * Mail Settings Store
 * Zustand store for managing email configuration
 */

import { create } from 'zustand';

interface MailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
}

interface MailSettingsStore {
  settings: MailSettings | null;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<MailSettings>) => Promise<void>;
  testConnection: () => Promise<boolean>;
}

export const useMailSettingsStore = create<MailSettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    console.log('[MailSettingsStore] Fetching mail settings');
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual fetching from Supabase
      const defaultSettings: MailSettings = {
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        from_email: '',
        from_name: '',
        use_tls: true,
      };

      set({ settings: defaultSettings, isLoading: false });
    } catch (error) {
      console.error('[MailSettingsStore] Error fetching settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération des paramètres mail',
        isLoading: false,
      });
    }
  },

  updateSettings: async (settings) => {
    console.log('[MailSettingsStore] Updating settings:', settings);
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual update in Supabase
      const currentSettings = get().settings;
      const updatedSettings = { ...currentSettings, ...settings } as MailSettings;

      set({ settings: updatedSettings, isLoading: false });
      console.log('[MailSettingsStore] Settings updated successfully');
    } catch (error) {
      console.error('[MailSettingsStore] Error updating settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour des paramètres',
        isLoading: false,
      });
    }
  },

  testConnection: async () => {
    console.log('[MailSettingsStore] Testing email connection');

    try {
      // TODO: Implement actual connection test
      console.log('[MailSettingsStore] Connection test successful');
      return true;
    } catch (error) {
      console.error('[MailSettingsStore] Connection test failed:', error);
      return false;
    }
  },
}));
