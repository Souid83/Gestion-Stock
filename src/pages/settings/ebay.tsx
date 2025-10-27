import React, { useState, useEffect } from 'react';
import { Settings, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Notifications/Toast';
import { Role, can, ROLES } from '../../lib/rbac';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  show: boolean;
}

export default function EbaySettings() {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', show: false });
  const [userRole, setUserRole] = useState<Role>(ROLES.MAGASIN);

  const [formData, setFormData] = useState({
    environment: 'sandbox' as 'sandbox' | 'production',
    client_id: '',
    client_secret: '',
    runame: ''
  });

  useEffect(() => {
    checkAdminAccess();
    loadFromLocalStorage();
  }, []);

  const loadFromLocalStorage = () => {
    console.log('📂 Loading eBay settings from localStorage');
    const savedEnv = localStorage.getItem('ebay_env');
    const savedClientId = localStorage.getItem('ebay_client_id');
    const savedClientSecret = localStorage.getItem('ebay_client_secret');
    const savedRuname = localStorage.getItem('ebay_runame');

    if (savedEnv || savedClientId || savedClientSecret || savedRuname) {
      setFormData({
        environment: (savedEnv as 'sandbox' | 'production') || 'sandbox',
        client_id: savedClientId || '',
        client_secret: savedClientSecret || '',
        runame: savedRuname || ''
      });
      console.log('✅ Loaded saved eBay settings:', { savedEnv, savedClientId, savedRuname });
    } else {
      console.log('ℹ️ No saved eBay settings found in localStorage');
    }
  };

  const checkAdminAccess = async () => {
    try {
      console.log('[EbaySettings] Checking user role access');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('[EbaySettings] No authenticated user');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      console.log('[EbaySettings] User authenticated:', user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[EbaySettings] Error loading profile:', error);
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      const role = (profile?.role as Role) || ROLES.MAGASIN;
      console.log('[EbaySettings] User role:', role);
      setUserRole(role);

      // Only ADMIN_FULL can access settings
      const hasAccessToSettings = can('accessSettings', role);
      console.log('[EbaySettings] Has access to settings:', hasAccessToSettings);
      setIsAuthorized(hasAccessToSettings);
      setIsLoading(false);
    } catch (e) {
      console.error('[EbaySettings] Exception checking access:', e);
      setIsAuthorized(false);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id.trim() || !formData.client_secret.trim() || !formData.runame.trim()) {
      setToast({
        message: 'Tous les champs sont obligatoires',
        type: 'error',
        show: true
      });
      return;
    }

    setIsSubmitting(true);

    console.log('💾 Saving eBay settings to localStorage');
    localStorage.setItem('ebay_env', formData.environment);
    localStorage.setItem('ebay_client_id', formData.client_id);
    localStorage.setItem('ebay_client_secret', formData.client_secret);
    localStorage.setItem('ebay_runame', formData.runame);
    console.log('✅ eBay settings saved to localStorage');

    try {
      // Submit a top-level navigation POST (no XHR) to our Netlify function,
      // which will 302-redirect to eBay authorize. This avoids any CORS on auth2.ebay.com.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/.netlify/functions/ebay-authorize';
      form.style.display = 'none';

      const add = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      add('environment', formData.environment);
      add('client_id', formData.client_id);
      add('client_secret', formData.client_secret);
      add('runame', formData.runame);

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      setToast({
        message: error?.message || 'Erreur lors de la redirection vers eBay',
        type: 'error',
        show: true
      });
      setIsSubmitting(false);
    }
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Réglages eBay (BYO)</h1>
        </div>
        <p className="text-gray-600">
          Configurez votre propre application eBay en utilisant vos identifiants développeur.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-2">
              Environnement
            </label>
            <select
              id="environment"
              name="environment"
              value={formData.environment}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="sandbox">Sandbox (Test)</option>
              <option value="production">Production</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Utilisez Sandbox pour les tests, Production pour le déploiement réel.
            </p>
          </div>

          <div>
            <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 mb-2">
              App ID (Client ID)
            </label>
            <input
              type="text"
              id="client_id"
              name="client_id"
              value={formData.client_id}
              onChange={handleInputChange}
              placeholder="Ex: YourAppN-YourApp-PRD-1234567890-abc12345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="client_secret" className="block text-sm font-medium text-gray-700 mb-2">
              Cert ID (Client Secret)
            </label>
            <input
              type="password"
              id="client_secret"
              name="client_secret"
              value={formData.client_secret}
              onChange={handleInputChange}
              placeholder="Ex: PRD-1234567890ab-cdef1234-5678-90ab-cdef-1234"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="runame" className="block text-sm font-medium text-gray-700 mb-2">
              RuName (Redirect URL Name)
            </label>
            <input
              type="text"
              id="runame"
              name="runame"
              value={formData.runame}
              onChange={handleInputChange}
              placeholder="Ex: Your_Company-YourAppN-YourAp-abcdefgh"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Connexion en cours...
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Connecter eBay
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Où trouver ces informations ?
        </h2>

        <div className="space-y-4 text-sm text-blue-900">
          <div>
            <h3 className="font-semibold mb-2">1. Créer une application eBay</h3>
            <p className="mb-2">
              Rendez-vous sur le{' '}
              <a
                href="https://developer.ebay.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-700"
              >
                Developer Portal eBay
              </a>{' '}
              et connectez-vous avec votre compte eBay.
            </p>
            <p>
              Accédez à la section{' '}
              <span className="font-mono bg-blue-100 px-2 py-1 rounded">My Account</span> →{' '}
              <span className="font-mono bg-blue-100 px-2 py-1 rounded">Application Keys</span>
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. Récupérer l'App ID et le Cert ID</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>App ID (Client ID)</strong> : Visible directement dans la section "Application Keys"
              </li>
              <li>
                <strong>Cert ID (Client Secret)</strong> : Cliquez sur "Show" à côté de "Cert ID" pour révéler la valeur
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3. Configurer le RuName</h3>
            <p className="mb-2">
              Dans la section{' '}
              <span className="font-mono bg-blue-100 px-2 py-1 rounded">User Tokens</span>, cliquez sur{' '}
              <span className="font-mono bg-blue-100 px-2 py-1 rounded">Get a Token from eBay via Your Application</span>.
            </p>
            <p className="mb-2">
              Vous devrez configurer une URL de redirection (ex: https://votredomaine.com/api/ebay/callback).
            </p>
            <p>
              Une fois configuré, le <strong>RuName</strong> sera généré automatiquement et sera visible dans cette section.
            </p>
          </div>

          <div className="bg-blue-100 rounded p-3 mt-4">
            <p className="font-semibold">Note importante :</p>
            <p className="mt-1">
              Pour l'environnement <strong>Sandbox</strong>, utilisez les clés de la section "Sandbox Keys".
              Pour <strong>Production</strong>, utilisez les clés de la section "Production Keys".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
