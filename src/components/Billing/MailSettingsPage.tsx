import React, { useEffect, useState } from 'react';
import { useMailSettingsStore, MailSettings } from '../../store/mailSettingsStore';
import { Save, Send, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const MailSettingsPage: React.FC = () => {
  const { settings, fetchSettings, saveSettings, testConnection, isLoading, error, clearError } = useMailSettingsStore();
  
  const [formData, setFormData] = useState<MailSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    quote_template: '',
    order_template: '',
    invoice_template: '',
    credit_note_template: ''
  });
  
  const [activeTab, setActiveTab] = useState<'settings' | 'templates'>('settings');
  const [activeTemplate, setActiveTemplate] = useState<'quote' | 'order' | 'invoice' | 'credit_note'>('quote');
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  
  useEffect(() => {
    console.log('MailSettingsPage component mounted, fetching settings...');
    fetchSettings();
  }, [fetchSettings]);
  
  useEffect(() => {
    if (settings) {
      setFormData({
        id: settings.id,
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
      });
    }
  }, [settings]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value
    }));
  };
  
  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [`${activeTemplate}_template`]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setTestStatus(null);
    
    try {
      await saveSettings(formData);
    } catch (err) {
      console.error('Error saving mail settings:', err);
    }
  };
  
  const handleTestConnection = async () => {
    clearError();
    setTestStatus(null);
    
    const result = await testConnection(formData);
    setTestStatus(result);
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Paramètres d'email</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchSettings()}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuration SMTP
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Modèles d'emails
          </button>
        </nav>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle size={20} className="mr-2" />
          {error}
        </div>
      )}
      
      {testStatus && (
        <div className={`p-4 rounded-lg ${
          testStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testStatus.success ? (
            <div className="flex items-center">
              <CheckCircle size={20} className="mr-2" />
              {testStatus.message}
            </div>
          ) : (
            <div className="flex items-center">
              <AlertCircle size={20} className="mr-2" />
              {testStatus.message}
            </div>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'settings' ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6">Configuration du serveur SMTP</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serveur SMTP
                  </label>
                  <input
                    type="text"
                    name="smtp_host"
                    value={formData.smtp_host}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="smtp.example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port SMTP
                  </label>
                  <input
                    type="number"
                    name="smtp_port"
                    value={formData.smtp_port}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="587"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'utilisateur SMTP
                  </label>
                  <input
                    type="text"
                    name="smtp_user"
                    value={formData.smtp_user}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe SMTP
                  </label>
                  <input
                    type="password"
                    name="smtp_password"
                    value={formData.smtp_password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email expéditeur
                  </label>
                  <input
                    type="email"
                    name="from_email"
                    value={formData.from_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contact@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom expéditeur
                  </label>
                  <input
                    type="text"
                    name="from_name"
                    value={formData.from_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Votre Entreprise"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-6 pt-6 border-t">
              <button
                type="button"
                onClick={handleTestConnection}
                className="px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                disabled={isLoading}
              >
                <div className="flex items-center">
                  <Send size={18} className="mr-2" />
                  Tester la connexion
                </div>
              </button>
              
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isLoading}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6">Modèles d'emails</h2>
            
            <div className="mb-6">
              <div className="flex border-b">
                <button
                  type="button"
                  onClick={() => setActiveTemplate('quote')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTemplate === 'quote'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Devis
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplate('order')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTemplate === 'order'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Commandes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplate('invoice')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTemplate === 'invoice'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Factures
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplate('credit_note')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTemplate === 'credit_note'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Avoirs
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle d'email pour {
                    activeTemplate === 'quote' ? 'les devis' :
                    activeTemplate === 'order' ? 'les commandes' :
                    activeTemplate === 'invoice' ? 'les factures' :
                    'les avoirs'
                  }
                </label>
                <textarea
                  value={formData[`${activeTemplate}_template` as keyof MailSettings] as string || ''}
                  onChange={handleTemplateChange}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Variables disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-sm text-gray-600">
                    <code>{'{customer_name}'}</code> - Nom du client
                  </div>
                  <div className="text-sm text-gray-600">
                    <code>{'{document_number}'}</code> - Numéro du document
                  </div>
                  <div className="text-sm text-gray-600">
                    <code>{'{company_name}'}</code> - Nom de votre entreprise
                  </div>
                  
                  {activeTemplate === 'quote' && (
                    <div className="text-sm text-gray-600">
                      <code>{'{expiry_date}'}</code> - Date d'expiration
                    </div>
                  )}
                  
                  {activeTemplate === 'invoice' && (
                    <>
                      <div className="text-sm text-gray-600">
                        <code>{'{due_date}'}</code> - Date d'échéance
                      </div>
                      <div className="text-sm text-gray-600">
                        <code>{'{total_amount}'}</code> - Montant total
                      </div>
                    </>
                  )}
                  
                  {activeTemplate === 'credit_note' && (
                    <>
                      <div className="text-sm text-gray-600">
                        <code>{'{total_amount}'}</code> - Montant total
                      </div>
                      <div className="text-sm text-gray-600">
                        <code>{'{invoice_number}'}</code> - Numéro de facture
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-6 border-t">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isLoading}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};