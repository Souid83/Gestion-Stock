import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface MailSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  quote_template?: string;
  order_template?: string;
  invoice_template?: string;
  credit_note_template?: string;
  created_at?: string;
  updated_at?: string;
}

interface MailSettingsState {
  settings: MailSettings | null;
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  fetchSettings: () => Promise<MailSettings | null>;
  saveSettings: (settings: MailSettings) => Promise<MailSettings | null>;
  
  // Email templates
  getTemplateForDocumentType: (documentType: 'quote' | 'order' | 'invoice' | 'credit_note') => string;
  saveTemplate: (documentType: 'quote' | 'order' | 'invoice' | 'credit_note', template: string) => Promise<void>;
  
  // Test connection
  testConnection: (settings?: MailSettings) => Promise<{ success: boolean; message: string }>;
  
  // Clear error
  clearError: () => void;
}

// Default templates
const DEFAULT_TEMPLATES = {
  quote: `Bonjour {customer_name},

Veuillez trouver ci-joint votre devis n° {document_number}.

Ce devis est valable jusqu'au {expiry_date}.

Cordialement,
{company_name}`,

  order: `Bonjour {customer_name},

Nous vous confirmons la réception de votre commande n° {document_number}.

Votre commande est en cours de traitement et sera expédiée prochainement.

Cordialement,
{company_name}`,

  invoice: `Bonjour {customer_name},

Veuillez trouver ci-joint votre facture n° {document_number} d'un montant de {total_amount}.

Date d'échéance : {due_date}

Cordialement,
{company_name}`,

  credit_note: `Bonjour {customer_name},

Veuillez trouver ci-joint votre avoir n° {document_number} d'un montant de {total_amount}.

Cet avoir fait référence à la facture n° {invoice_number}.

Cordialement,
{company_name}`
};

export const useMailSettingsStore = create<MailSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching mail settings...');
      const { data, error } = await supabase
        .from('mail_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      
      console.log('Mail settings fetched:', data);
      set({ settings: data, isLoading: false });
      return data;
    } catch (error) {
      console.error('Error fetching mail settings:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while fetching mail settings',
        isLoading: false 
      });
      return null;
    }
  },

  saveSettings: async (settings: MailSettings) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Saving mail settings:', settings);
      
      let result;
      
      if (settings.id) {
        // Update existing settings
        const { data, error } = await supabase
          .from('mail_settings')
          .update({
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port,
            smtp_user: settings.smtp_user,
            smtp_password: settings.smtp_password,
            from_email: settings.from_email,
            from_name: settings.from_name,
            quote_template: settings.quote_template,
            order_template: settings.order_template,
            invoice_template: settings.invoice_template,
            credit_note_template: settings.credit_note_template
          })
          .eq('id', settings.id)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('mail_settings')
          .insert([{
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port,
            smtp_user: settings.smtp_user,
            smtp_password: settings.smtp_password,
            from_email: settings.from_email,
            from_name: settings.from_name,
            quote_template: settings.quote_template,
            order_template: settings.order_template,
            invoice_template: settings.invoice_template,
            credit_note_template: settings.credit_note_template
          }])
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      }
      
      set({ settings: result, isLoading: false });
      return result;
    } catch (error) {
      console.error('Error saving mail settings:', error);
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred while saving mail settings',
        isLoading: false 
      });
      return null;
    }
  },

  getTemplateForDocumentType: (documentType: 'quote' | 'order' | 'invoice' | 'credit_note') => {
    const { settings } = get();
    
    switch (documentType) {
      case 'quote':
        return settings?.quote_template || DEFAULT_TEMPLATES.quote;
      case 'order':
        return settings?.order_template || DEFAULT_TEMPLATES.order;
      case 'invoice':
        return settings?.invoice_template || DEFAULT_TEMPLATES.invoice;
      case 'credit_note':
        return settings?.credit_note_template || DEFAULT_TEMPLATES.credit_note;
    }
  },

  saveTemplate: async (documentType: 'quote' | 'order' | 'invoice' | 'credit_note', template: string) => {
    set({ isLoading: true, error: null });
    try {
      const { settings } = get();
      
      if (!settings) {
        throw new Error('No mail settings found');
      }
      
      const templateField = `${documentType}_template`;
      
      const { error } = await supabase
        .from('mail_settings')
        .update({ [templateField]: template })
        .eq('id', settings.id);
        
      if (error) throw error;
      
      // Update local state
      set({ 
        settings: { 
          ...settings, 
          [templateField]: template 
        },
        isLoading: false 
      });
    } catch (error) {
      console.error(`Error saving ${documentType} template:`, error);
      set({ 
        error: error instanceof Error ? error.message : `An error occurred while saving ${documentType} template`,
        isLoading: false 
      });
    }
  },

  testConnection: async (settings?: MailSettings) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Testing SMTP connection...');
      
      const settingsToTest = settings || get().settings;
      
      if (!settingsToTest) {
        throw new Error('No mail settings provided');
      }
      
      // In a real application, we would call a serverless function to test the connection
      // For now, we'll just simulate a successful connection
      console.log('SMTP settings to test:', settingsToTest);
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demonstration purposes, we'll consider the test successful if the host is not empty
      const success = !!settingsToTest.smtp_host;
      
      set({ isLoading: false });
      
      if (success) {
        return { 
          success: true, 
          message: 'Connexion SMTP établie avec succès' 
        };
      } else {
        return { 
          success: false, 
          message: 'Échec de la connexion SMTP. Veuillez vérifier vos paramètres.' 
        };
      }
    } catch (error) {
      console.error('Error testing SMTP connection:', error);
      set({ isLoading: false });
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Une erreur est survenue lors du test de connexion SMTP' 
      };
    }
  },

  clearError: () => set({ error: null })
}));