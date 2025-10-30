import React, { useState, useEffect, useRef } from 'react';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { Save, Upload, RefreshCw, Image, FileText, CreditCard, FileOutput } from 'lucide-react';

export const InvoiceSettings: React.FC = () => {
  const { settings, isLoading, error, fetchSettings, updateSettings, uploadLogo, clearError } = useAppSettingsStore();
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [footerText, setFooterText] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ field: string; success: boolean } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    console.log('InvoiceSettings component mounted, fetching settings...');
    fetchSettings();
  }, [fetchSettings]);
  
  useEffect(() => {
    if (settings) {
      setLogoPreview(settings.logo_url || null);
      setFooterText(settings.footer_text || '');
      setTermsAndConditions(settings.terms_and_conditions || '');
      setBankInfo(settings.bank_info || '');
    }
  }, [settings]);
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview the selected image
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleLogoUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return;
    
    setIsSaving(true);
    clearError();
    
    try {
      const file = fileInputRef.current.files[0];
      await uploadLogo(file);
      
      // Show success status
      setSaveStatus({ field: 'logo', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setSaveStatus({ field: 'logo', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveFooterText = async () => {
    setIsSaving(true);
    clearError();
    
    try {
      await updateSettings('footer_text', footerText);
      
      // Show success status
      setSaveStatus({ field: 'footer', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving footer text:', err);
      setSaveStatus({ field: 'footer', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveTermsAndConditions = async () => {
    setIsSaving(true);
    clearError();
    
    try {
      await updateSettings('terms_and_conditions', termsAndConditions);
      
      // Show success status
      setSaveStatus({ field: 'terms', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving terms and conditions:', err);
      setSaveStatus({ field: 'terms', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveBankInfo = async () => {
    setIsSaving(true);
    clearError();
    
    try {
      await updateSettings('bank_info', bankInfo);
      
      // Show success status
      setSaveStatus({ field: 'bank', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving bank info:', err);
      setSaveStatus({ field: 'bank', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Réglages Facture</h1>
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
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Image size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Logo</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600 mb-4">
                  Téléchargez votre logo pour l'afficher sur vos documents (devis, factures, avoirs).
                </p>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                    <Upload size={18} />
                    Choisir un fichier
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={!fileInputRef.current?.files?.[0] && !logoPreview}
                  >
                    <div className="flex items-center">
                      <Save size={18} className="mr-2" />
                      {isSaving && saveStatus?.field === 'logo' ? 'Enregistrement...' : 'Enregistrer'}
                    </div>
                  </button>
                </div>
                
                {saveStatus?.field === 'logo' && (
                  <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                    {saveStatus.success ? 'Logo enregistré avec succès' : 'Erreur lors de l\'enregistrement du logo'}
                  </div>
                )}
              </div>
              
              <div className="flex justify-center items-center border rounded-lg p-4 bg-gray-50 h-40">
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="max-h-full max-w-full object-contain" 
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <Image size={48} className="mx-auto mb-2" />
                    <p>Aucun logo</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer Text Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FileText size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Texte de pied de page</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Ce texte apparaîtra en bas de tous vos documents (devis, factures, avoirs).
            </p>
            
            <div className="mb-4">
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Merci pour votre confiance. Tous les prix sont en euros."
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveFooterText}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'footer' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
            
            {saveStatus?.field === 'footer' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Texte de pied de page enregistré avec succès' : 'Erreur lors de l\'enregistrement du texte de pied de page'}
              </div>
            )}
          </div>
          
          {/* Terms and Conditions Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FileOutput size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Conditions Générales de Vente</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Ces conditions apparaîtront sur vos documents (devis, factures, avoirs).
            </p>
            
            <div className="mb-4">
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Les produits restent la propriété de la société jusqu'au paiement intégral."
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveTermsAndConditions}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'terms' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
            
            {saveStatus?.field === 'terms' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'CGV enregistrées avec succès' : 'Erreur lors de l\'enregistrement des CGV'}
              </div>
            )}
          </div>
          
          {/* Bank Info Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <CreditCard size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Coordonnées bancaires</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Ces informations apparaîtront sur vos factures pour faciliter les paiements par virement.
            </p>
            
            <div className="mb-4">
              <textarea
                value={bankInfo}
                onChange={(e) => setBankInfo(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX&#10;BIC: XXXXXXXX&#10;Banque: Exemple Banque"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveBankInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'bank' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
            
            {saveStatus?.field === 'bank' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Coordonnées bancaires enregistrées avec succès' : 'Erreur lors de l\'enregistrement des coordonnées bancaires'}
              </div>
            )}
          </div>
          
          {/* Preview Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Aperçu</h2>
            
            <div className="border rounded-lg p-6">
              <div className="flex justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">FACTURE</h2>
                  <p className="text-gray-600">N° EXEMPLE-2025-0001</p>
                  <p className="text-gray-600">Date: 01/01/2025</p>
                  <p className="text-gray-600">Échéance: 31/01/2025</p>
                </div>
                <div className="text-right">
                  {logoPreview && (
                    <img 
                      src={logoPreview} 
                      alt="Logo" 
                      className="max-h-20 max-w-40 object-contain mb-2" 
                    />
                  )}
                  <h3 className="font-bold text-lg">Votre Entreprise</h3>
                  <p>123 Rue Exemple</p>
                  <p>75000 Paris</p>
                  <p>France</p>
                </div>
              </div>
              
              {/* Bank Info Preview */}
              {bankInfo && (
                <div className="mb-8">
                  <h3 className="font-bold text-gray-800 mb-2">Coordonnées bancaires</h3>
                  <div className="border-t border-gray-200 pt-2">
                    <pre className="whitespace-pre-line font-sans">{bankInfo}</pre>
                  </div>
                </div>
              )}
              
              {/* Footer Preview */}
              <div className="text-center text-gray-500 text-sm mt-8 pt-8 border-t">
                {footerText && <p className="mb-2">{footerText}</p>}
                {termsAndConditions && <p>{termsAndConditions}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};