import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Package, RefreshCw, Search } from 'lucide-react';
import { isAdmin } from '../../lib/supabase';

// Types inline
interface MarketplaceAccount {
  id: string;
  display_name: string;
  provider: string;
  provider_account_id: string;
  environment: string;
  is_active: boolean;
}

interface PricingListing {
  remote_id: string;
  remote_sku: string;
  title: string;
  price: number | null;
  price_currency: string;
  price_eur: number | null;
  internal_price: number | null;
  product_id: string | null;
  sync_status: 'ok' | 'pending' | 'failed' | 'unmapped';
  is_mapped: boolean;
}

interface FilterState {
  searchQuery: string;
  unmappedFirst: boolean;
  statusFilter: 'all' | 'ok' | 'pending' | 'failed';
}

// Composant inline : Affichage multi-devise
const CurrencyCell = ({
  price,
  currency,
  priceEur
}: {
  price: number | null;
  currency: string;
  priceEur: number | null;
}) => {
  if (price == null) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex items-center gap-1">
      <span>{price.toFixed(2)} {currency}</span>
      {priceEur != null ? (
        <span className="text-gray-500 text-sm">({priceEur.toFixed(2)} EUR)</span>
      ) : (
        <span className="text-gray-400 text-sm" title="Taux non défini">(—)</span>
      )}
    </div>
  );
};

export default function MarketplacePricing() {
  // Guard RBAC
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // États locaux
  const [selectedProvider, setSelectedProvider] = useState<string>('ebay');
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [listings, setListings] = useState<PricingListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<PricingListing[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    unmappedFirst: true,
    statusFilter: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState<{ remoteId: string; remoteSku: string } | null>(null);
  const [productIdInput, setProductIdInput] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const provider = params.get("provider");
    const connected = params.get("connected");
    const page = params.get("page");

    if ((provider === "ebay" && connected === "1") || page === "marketplace-pricing") {
      setSelectedProvider("ebay");
      setToast({ message: "Compte eBay connecté avec succès !", type: "success" });
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("provider");
      cleanUrl.searchParams.delete("connected");
      cleanUrl.searchParams.delete("page");
      setTimeout(() => {
        window.history.replaceState(null, "", cleanUrl.toString());
      }, 2000);
    }
  }, [location]);

  // Guard RBAC : vérification admin au montage
  useEffect(() => {
    const checkAccess = async () => {
      const adminStatus = await isAdmin();
      setHasAccess(adminStatus);
    };
    checkAccess();
  }, []);

  // Lecture query params au montage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const accountParam = params.get('account');

    if (providerParam) setSelectedProvider(providerParam);
    if (accountParam) setSelectedAccountId(accountParam);
  }, []);

  // Fetch comptes quand provider change
  useEffect(() => {
    if (!selectedProvider) return;

    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      setError(null);
      try {
        const response = await fetch(`/.netlify/functions/marketplaces-accounts?provider=${selectedProvider}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setAccounts(data.accounts || []);
      } catch (err: any) {
        setError(err.message);
        setAccounts([]);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [selectedProvider]);

  // Fetch listings quand accountId, filters ou page changent
  useEffect(() => {
    if (!selectedAccountId) return;

    const fetchListings = async () => {
      setIsLoadingListings(true);
      setError(null);
      try {
        console.log('📞 Fetching eBay listings...');
        const params = new URLSearchParams({
          provider: selectedProvider,
          account_id: selectedAccountId,
          q: filters.searchQuery,
          only_unmapped: filters.unmappedFirst ? 'true' : 'false',
          status: filters.statusFilter,
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        });
        const response = await fetch(`/.netlify/functions/marketplaces-listings?${params}`);
        console.log(`📥 Response status: ${response.status}`);

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          console.log(`📋 Content-Type: ${contentType}`);

          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error('❌ eBay error response:', errorData);
            if (errorData.error === 'invalid_json') {
              throw new Error('Erreur eBay : réponse inattendue. Consultez les logs Netlify.');
            }
            throw new Error(errorData.error || `HTTP ${response.status}`);
          } else {
            const text = await response.text();
            console.error('❌ Non-JSON response:', text.substring(0, 200));
            throw new Error('Erreur eBay : réponse inattendue. Consultez les logs Netlify.');
          }
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('❌ Expected JSON but got:', text.substring(0, 200));
          throw new Error('Erreur eBay : réponse inattendue. Consultez les logs Netlify.');
        }

        const data = await response.json();
        console.log(`✅ Fetched ${data.items?.length || 0} listings`);
        setListings(data.items || []);
      } catch (err: any) {
        console.error('🔥 Error fetching listings:', err);
        setError(err.message);
        setListings([]);
      } finally {
        setIsLoadingListings(false);
      }
    };

    fetchListings();
  }, [selectedAccountId, filters, currentPage, selectedProvider]);

  // Filtrage et tri local
  useEffect(() => {
    let result = [...listings];

    // Recherche locale
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(l =>
        l.remote_sku?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q)
      );
    }

    // Filtre statut
    if (filters.statusFilter !== 'all') {
      result = result.filter(l => l.sync_status === filters.statusFilter);
    }

    // Tri : non-mappés en tête
    if (filters.unmappedFirst) {
      result.sort((a, b) => {
        if (!a.is_mapped && b.is_mapped) return -1;
        if (a.is_mapped && !b.is_mapped) return 1;
        return 0;
      });
    }

    setFilteredListings(result);
  }, [listings, filters]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Calcul du delta (EUR seulement)
  const calculateDelta = (priceEur: number | null, internalPrice: number | null): number | null => {
    if (priceEur == null || internalPrice == null) return null;
    return priceEur - internalPrice;
  };

  const formatDelta = (delta: number | null) => {
    if (delta === null) return <span className="text-gray-400">—</span>;
    const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-600';
    return <span className={color}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)} EUR</span>;
  };

  // Actions
  const handleLinkClick = (remoteId: string, remoteSku: string) => {
    setLinkModalData({ remoteId, remoteSku });
    setProductIdInput('');
    setShowLinkModal(true);
  };

  const confirmLink = async () => {
    if (!linkModalData || !productIdInput.trim()) return;

    setActionLoading({ ...actionLoading, [linkModalData.remoteId]: true });
    try {
      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          provider: selectedProvider,
          account_id: selectedAccountId,
          remote_id: linkModalData.remoteId,
          remote_sku: linkModalData.remoteSku,
          product_id: productIdInput.trim()
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const updatedListings = listings.map(l =>
        l.remote_id === linkModalData.remoteId
          ? { ...l, is_mapped: true, product_id: productIdInput.trim(), sync_status: 'ok' as const }
          : l
      );
      setListings(updatedListings);

      setToast({ message: 'Produit lié avec succès', type: 'success' });
      setShowLinkModal(false);
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading({ ...actionLoading, [linkModalData.remoteId]: false });
    }
  };

  const handleCreate = async (remoteId: string) => {
    setActionLoading({ ...actionLoading, [remoteId]: true });
    try {
      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          provider: selectedProvider,
          account_id: selectedAccountId,
          remote_id: remoteId
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setToast({ message: 'Annonce créée', type: 'success' });
      const updatedListings = listings.map(l =>
        l.remote_id === remoteId ? { ...l, sync_status: 'ok' as const } : l
      );
      setListings(updatedListings);
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading({ ...actionLoading, [remoteId]: false });
    }
  };

  const handleIgnore = async (remoteId: string) => {
    setActionLoading({ ...actionLoading, [remoteId]: true });
    try {
      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ignore',
          provider: selectedProvider,
          account_id: selectedAccountId,
          remote_id: remoteId
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setToast({ message: 'Produit ignoré', type: 'success' });
      setListings(listings.filter(l => l.remote_id !== remoteId));
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading({ ...actionLoading, [remoteId]: false });
    }
  };

  // Guard render
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Accès non autorisé
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gestion des prix marketplace</h1>

      {/* Onglets niveau 1 : Marketplaces */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setSelectedProvider('ebay')}
          className={`px-4 py-2 rounded-md ${
            selectedProvider === 'ebay'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          eBay
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Amazon
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          BackMarket
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Acheaper
        </button>
      </div>

      {/* Onglets niveau 2 : Comptes */}
      <div className="mt-4">
        {isLoadingAccounts ? (
          <div className="text-gray-500">Chargement des comptes...</div>
        ) : accounts.length === 0 ? (
          <div className="text-gray-500">Aucun compte configuré</div>
        ) : (
          <div className="flex items-center gap-2">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`px-4 py-2 rounded-md ${
                  selectedAccountId === acc.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {acc.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barre de filtres */}
      {selectedAccountId && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher SKU ou titre..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.unmappedFirst}
              onChange={(e) => setFilters({ ...filters, unmappedFirst: e.target.checked })}
              className="rounded"
            />
            Non-mappés d'abord
          </label>
          <select
            value={filters.statusFilter}
            onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">Tous statuts</option>
            <option value="ok">OK</option>
            <option value="pending">En attente</option>
            <option value="failed">Erreur</option>
          </select>
        </div>
      )}

      {/* Boutons sync (désactivés) */}
      {selectedAccountId && (
        <div className="flex items-center gap-2">
          <button
            disabled
            title="Fonctionnalité bientôt disponible"
            className="px-4 py-2 bg-gray-200 text-gray-500 rounded-md cursor-not-allowed"
          >
            Sync sélection
          </button>
          <button
            disabled
            title="Fonctionnalité bientôt disponible"
            className="px-4 py-2 bg-gray-200 text-gray-500 rounded-md cursor-not-allowed"
          >
            Sync page
          </button>
          <button
            disabled
            title="Fonctionnalité bientôt disponible"
            className="px-4 py-2 bg-gray-200 text-gray-500 rounded-md cursor-not-allowed"
          >
            Sync tout
          </button>
        </div>
      )}

      {/* Erreur globale */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tableau des listings */}
      {selectedAccountId && (
        <>
          {isLoadingListings ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-600">Chargement...</span>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <Package className="w-12 h-12 mb-2" />
              <p>Aucun produit trouvé</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produit/SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prix interne
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prix eBay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Devise
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Équiv. EUR
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Δ
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut sync
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredListings
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map(listing => (
                        <tr
                          key={listing.remote_id}
                          className={!listing.is_mapped ? 'bg-orange-50' : ''}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {listing.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {listing.remote_sku}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {listing.internal_price != null
                              ? `${listing.internal_price.toFixed(2)} EUR`
                              : <span className="text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {listing.price != null
                              ? listing.price.toFixed(2)
                              : <span className="text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {listing.price_currency}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <CurrencyCell
                              price={listing.price}
                              currency={listing.price_currency}
                              priceEur={listing.price_eur}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatDelta(calculateDelta(listing.price_eur, listing.internal_price))}
                          </td>
                          <td className="px-4 py-3">
                            {!listing.is_mapped ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                À mapper
                              </span>
                            ) : listing.sync_status === 'ok' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                OK
                              </span>
                            ) : listing.sync_status === 'pending' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                En attente
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Erreur
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!listing.is_mapped && (
                                <button
                                  onClick={() => handleLinkClick(listing.remote_id, listing.remote_sku)}
                                  disabled={actionLoading[listing.remote_id]}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Lier
                                </button>
                              )}
                              <button
                                onClick={() => handleCreate(listing.remote_id)}
                                disabled={actionLoading[listing.remote_id]}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Créer
                              </button>
                              <button
                                onClick={() => handleIgnore(listing.remote_id)}
                                disabled={actionLoading[listing.remote_id]}
                                className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Ignorer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                <div className="text-sm text-gray-700">
                  {filteredListings.length > 0 ? (
                    `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredListings.length)} sur ${filteredListings.length}`
                  ) : '0 résultat'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * itemsPerPage >= filteredListings.length}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal Lier */}
      {showLinkModal && linkModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Lier au produit interne</h2>
            <p className="text-sm text-gray-600 mb-4">
              SKU : <span className="font-mono">{linkModalData.remoteSku}</span>
            </p>
            <input
              type="text"
              placeholder="ID du produit (UUID)"
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmLink}
                disabled={!productIdInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
