import React, { useState, useEffect } from 'react';
import { Settings, ExternalLink, AlertCircle } from 'lucide-react';
import { isAdmin } from '../../lib/supabase';
import { Toast } from '../../components/Notifications/Toast';

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

  const [formData, setFormData] = useState({
    environment: 'sandbox' as 'sandbox' | 'production',
    client_id: '',
    client_secret: '',
    runame: ''
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const adminAccess = await isAdmin();
    setIsAuthorized(adminAccess);
    setIsLoading(false);

    if (!adminAccess) {
      setToast({
        message: 'Accès refusé. Réservé aux administrateurs.',
        type: 'error',
        show: true
      });
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

    try {
      const response = await fetch('/.netlify/functions/ebay-authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          environment: formData.environment,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
          runame: formData.runame
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Échec de la connexion eBay');
      }

      const data = await response.json();

      if (!data.authorizeUrl) {
        throw new Error('URL d\'autorisation manquante');
      }

      window.location.href = data.authorizeUrl;
    } catch (error: any) {
      setToast({
        message: error.message || 'Erreur lors de la connexion',
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-600">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
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
