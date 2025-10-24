import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  logo_url: string;
  footer_text: string;
  terms_and_conditions: string;
  bank_info: string;
}

interface AppSettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  fetchSettings: () => Promise<void>;
  updateSettings: (key: keyof AppSettings, value: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  
  // Clear error
  clearError: () => void;
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  logo_url: '',
  footer_text: 'Merci pour votre confiance. Tous les prix sont en euros.',
  terms_and_conditions: 'Conditions générales de vente : Les produits restent la propriété de la société jusqu\'au paiement intégral.',
  bank_info: 'IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX\nBIC: XXXXXXXX\nBanque: Exemple Banque'
};

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching app settings...');
      
      // Fetch settings from app_settings table
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;
      
      console.log('App settings fetched:', data);
      
      // Convert array of {key, value} to object
      const settingsObject = { ...DEFAULT_SETTINGS };
      
      if (data && data.length > 0) {
        (data as any[]).forEach((item: any) => {
          const k = item?.key as keyof AppSettings;
          const v = String(item?.value ?? '');
          if (k && (k in DEFAULT_SETTINGS)) {
            (settingsObject as any)[k] = v;
          }
        });
      }
      
      set({ settings: settingsObject, isLoading: false });
    } catch (error) {
      console.error('Error fetching app settings:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching app settings',
        isLoading: false 
      });
    }
  },

  updateSettings: async (key: keyof AppSettings, value: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`Updating app setting: ${key} = ${value}`);
      
      // Check if the setting already exists
      const { data: existingData, error: checkError } = await supabase
        .from('app_settings' as any)
        .select('*')
        .eq('key' as any, key as any)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      let updateError;
      
      if (existingData) {
        // Update existing setting
        const { error } = await supabase
          .from('app_settings' as any)
          .update({ value } as any)
          .eq('key' as any, key as any);
          
        updateError = error;
      } else {
        // Insert new setting
        const { error } = await supabase
          .from('app_settings' as any)
          .insert([{ key, value }] as any);
          
        updateError = error;
      }
      
      if (updateError) throw updateError;
      
      // Update local state
      set(state => ({
        settings: {
          ...state.settings,
          [key]: value
        },
        isLoading: false
      }));
      
      console.log(`App setting ${key} updated successfully`);
    } catch (error) {
      console.error(`Error updating app setting ${key}:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while updating app setting ${key}`,
        isLoading: false 
      });
    }
  },

  uploadLogo: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Uploading logo...');
      
      // Generate a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('app-assets')
        .upload(filePath, file, {
          upsert: true,
          contentType: (file as any).type || 'image/png'
        } as any);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('app-assets')
        .getPublicUrl(filePath);
        
      const publicUrl = urlData.publicUrl;
      
      // Update logo_url setting
      await get().updateSettings('logo_url', publicUrl);
      
      console.log('Logo uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while uploading logo',
        isLoading: false 
      });
      return '';
    }
  },

  clearError: () => set({ error: null })
}));
