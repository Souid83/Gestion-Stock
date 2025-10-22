import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Package, RefreshCw, Search } from 'lucide-react';
import { isAdmin, supabase } from '../../lib/supabase';

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
  qty_ebay?: number | null;
  qty_app?: number | null;
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
  const [totalCount, setTotalCount] = useState(0);
  const [needsReview, setNeedsReview] = useState<any[]>([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showQtySyncPrompt, setShowQtySyncPrompt] = useState(false);
  const [itemsToSync, setItemsToSync] = useState<{ sku: string; quantity: number }[]>([]);
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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

  // Reset auto-link attempt when page/account changes
  useEffect(() => {
    setAutoLinkAttempted(false);
  }, [selectedAccountId, currentPage]);

  // Fetch listings quand accountId, filters ou page changent
  useEffect(() => {
    if (!selectedAccountId) return;

    const fetchListings = async () => {
      setIsLoadingListings(true);
      setError(null);
      try {
        console.log('📞 Fetching eBay listings...');
        const offset = String((currentPage - 1) * itemsPerPage);
        const params = new URLSearchParams({
          provider: selectedProvider,
          account_id: selectedAccountId,
          q: filters.searchQuery,
          only_unmapped: filters.unmappedFirst ? 'true' : 'false',
          status: filters.statusFilter,
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
          offset
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
        setTotalCount(data.total || data.count || 0);

        // Map backend shape → UI PricingListing shape
        const mapped: PricingListing[] = (data.items || []).map((it: any) => {
          const priceAmount =
            typeof it?.price_amount === 'number'
              ? it.price_amount
              : (it?.price_amount ? parseFloat(it.price_amount) : null);

          const statusRaw = (it?.status_sync || '').toString();
          const status: 'ok' | 'pending' | 'failed' | 'unmapped' =
            statusRaw === 'ok' || statusRaw === 'pending' || statusRaw === 'failed'
              ? statusRaw
              : 'unmapped';

          return {
            remote_id: it?.remote_id || '',
            remote_sku: it?.remote_sku || '',
            title: it?.title || '',
            price: Number.isFinite(priceAmount as number) ? (priceAmount as number) : null,
            price_currency: it?.price_currency || 'EUR',
            price_eur: null,              // Conversion éventuelle à brancher
            internal_price: null,         // A compléter si jointure interne
            product_id: it?.product_id || null,
            sync_status: status,
            is_mapped: !!it?.product_id || false,
            qty_ebay: typeof it?.qty_ebay === 'number' ? it.qty_ebay : (it?.qty_ebay ?? null),
            qty_app: typeof it?.qty_app === 'number' ? it.qty_app : (it?.qty_app ?? null)
          };
        });

        setListings(mapped);

        // Auto-link by SKU on first load for this page, then refetch to display qty_app
        if (!autoLinkAttempted) {
          setAutoLinkAttempted(true);
          try {
            const unmapped = mapped.filter(l => !l.is_mapped && l.remote_sku);
            if (unmapped.length > 0) {
              const { data: { session } } = await supabase.auth.getSession();
              const authHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`
              };
              const payload = {
                action: 'bulk_link_by_sku',
                provider: selectedProvider,
                account_id: selectedAccountId,
                items: unmapped.slice(0, 200).map(u => ({ remote_sku: u.remote_sku, remote_id: u.remote_id }))
              };
              const bulkResp = await fetch('/.netlify/functions/marketplaces-mapping', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(payload)
              });
              const bulkJson = await bulkResp.json().catch(() => ({} as any));
              if (bulkResp.ok) {
                const linked = Number(bulkJson?.linked || 0);
                const review = Array.isArray(bulkJson?.needs_review) ? bulkJson.needs_review : [];
                setNeedsReview(review);
                setShowReviewPanel(review.length > 0);
                setToast({ message: `Auto-liaison: ${linked} lié(s), ${review.length} à revoir`, type: linked > 0 ? 'success' : 'error' });
                if (linked > 0) {
                  // Trigger a refetch to populate qty_app for newly linked SKUs
                  setReloadToken(x => x + 1);
                }
              }
            }
          } catch (e) {
            console.warn('auto_link_by_sku failed', (e as any)?.message || e);
          }
        }
      } catch (err: any) {
        console.error('🔥 Error fetching listings:', err);
        setError(err.message);
        setListings([]);
      } finally {
        setIsLoadingListings(false);
      }
    };

    fetchListings();
  }, [selectedAccountId, filters, currentPage, selectedProvider, reloadToken]);

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

  // Prompt to sync quantities when listings updated and mappings exist
  useEffect(() => {
    if (!autoLinkAttempted) return;
    const mismatches = listings.filter(
      l => l.is_mapped && l.qty_app != null && l.remote_sku && l.qty_ebay !== l.qty_app
    );
    if (mismatches.length > 0) {
      setItemsToSync(
        mismatches.map(l => ({ sku: l.remote_sku, quantity: l.qty_app as number }))
      );
      setShowQtySyncPrompt(true);
    }
  }, [listings, autoLinkAttempted]);

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
    if (!linkModalData) return;

    setActionLoading({ ...actionLoading, [linkModalData.remoteId]: true });
    try {
      // 1) tentative auto: link_by_sku (SKU exact)
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };
      const autoResp = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'link_by_sku',
          provider: selectedProvider,
          account_id: selectedAccountId,
          remote_id: linkModalData.remoteId,
          remote_sku: linkModalData.remoteSku
        })
      });

      const autoJson = await autoResp.json().catch(() => ({} as any));

      if (autoResp.ok && autoJson?.status === 'ok') {
        // Lié automatiquement
        const updatedListings = listings.map(l =>
          l.remote_id === linkModalData.remoteId
            ? { ...l, is_mapped: true, product_id: autoJson?.mapping?.product_id || null, sync_status: 'ok' as const }
            : l
        );
        setListings(updatedListings);
        setToast({ message: 'Produit lié automatiquement (SKU)', type: 'success' });
        setShowLinkModal(false);
        setReloadToken(x => x + 1);
        return;
      }

      if (autoResp.ok && autoJson?.status === 'multiple_matches') {
        // Afficher les candidats dans la modale actuelle via input libre → on bascule en mode "sélection"
        setToast({ message: 'Plusieurs correspondances trouvées pour ce SKU. Saisissez l’ID produit voulu puis confirmez.', type: 'error' });
        // Laisser la modale ouverte avec input productIdInput pour sélection manuelle
        return;
      }

      if (autoResp.ok && autoJson?.status === 'not_found') {
        // Aucun match → fallback sur saisie manuelle (champ déjà présent)
        if (!productIdInput.trim()) {
          setToast({ message: 'Aucun produit interne trouvé pour ce SKU. Saisissez un ID produit.', type: 'error' });
          return;
        }
      }

      // 2) fallback: lien explicite avec product_id saisi
      if (!productIdInput.trim()) {
        throw new Error(autoJson?.error || 'Aucun produit trouvé. Saisissez un ID interne pour lier.');
      }

      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'link',
          provider: selectedProvider,
          account_id: selectedAccountId,
          remote_id: linkModalData.remoteId,
          remote_sku: linkModalData.remoteSku,
          product_id: productIdInput.trim()
        })
      });

      if (!response.ok) {
        const errJ = await response.json().catch(() => ({}));
        throw new Error(errJ?.error || `HTTP ${response.status}`);
      }

      const updatedListings = listings.map(l =>
        l.remote_id === linkModalData.remoteId
          ? { ...l, is_mapped: true, product_id: productIdInput.trim(), sync_status: 'ok' as const }
          : l
      );
      setListings(updatedListings);

      setToast({ message: 'Produit lié avec succès', type: 'success' });
      setShowLinkModal(false);
      setReloadToken(x => x + 1);
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading({ ...actionLoading, [linkModalData.remoteId]: false });
    }
  };

  const handleCreate = async (remoteId: string) => {
    setActionLoading({ ...actionLoading, [remoteId]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };
      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: authHeaders,
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
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };
      const response = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: authHeaders,
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

  const applyQtyToEbay = async (listing: PricingListing) => {
    if (!selectedAccountId || listing.qty_app == null || !listing.remote_sku) return;
    setActionLoading({ ...actionLoading, [listing.remote_id]: true });
    try {
      const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          items: [{ sku: listing.remote_sku, quantity: listing.qty_app }]
        })
      });
      const resJson = await resp.json().catch(() => ({} as any));
      if (!resp.ok) throw new Error(resJson?.error || `HTTP ${resp.status}`);
      setListings(prev =>
        prev.map(l => l.remote_id === listing.remote_id ? { ...l, qty_ebay: listing.qty_app } : l)
      );
      setToast({ message: 'Quantité mise à jour sur eBay', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erreur MAJ quantité: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading({ ...actionLoading, [listing.remote_id]: false });
    }
  };

  const confirmBulkQtySync = async () => {
    try {
      const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          items: itemsToSync
        })
      });
      const js = await resp.json().catch(() => ({} as any));
      if (!resp.ok) throw new Error(js?.error || `HTTP ${resp.status}`);
      const skuSet = new Set(itemsToSync.map(i => i.sku));
      setListings(prev =>
        prev.map(l => (skuSet.has(l.remote_sku) ? { ...l, qty_ebay: l.qty_app ?? l.qty_ebay } : l))
      );
      setToast({ message: `Quantités mises à jour sur eBay (${itemsToSync.length})`, type: 'success' });
    } catch (e: any) {
      setToast({ message: `Erreur MAJ quantités: ${e.message}`, type: 'error' });
    } finally {
      setShowQtySyncPrompt(false);
    }
  };

  const handleResolveBySku = (sku: string) => {
    // Ouvre la modale de lien sur la première ligne correspondante
    const row = listings.find(l => l.remote_sku === sku && !l.is_mapped);
    if (!row) {
      setToast({ message: `Aucune ligne non mappée pour SKU ${sku}`, type: 'error' });
      return;
    }
    handleLinkClick(row.remote_id, row.remote_sku);
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
    <div className="p-6 space-y-6 h-[calc(100vh-80px)] overflow-y-auto">
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

      {/* Résumé auto-liaison / À revoir */}
      {selectedAccountId && showReviewPanel && needsReview.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-900">À revoir ({needsReview.length})</h3>
            <button
              onClick={() => setShowReviewPanel(false)}
              className="text-sm text-yellow-800 hover:underline"
            >
              Masquer
            </button>
          </div>
          <div className="max-h-40 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-yellow-900">
                  <th className="text-left px-2 py-1">SKU</th>
                  <th className="text-left px-2 py-1">Raison</th>
                  <th className="text-left px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {needsReview.map((it, idx) => (
                  <tr key={`${it?.remote_sku || 's'}-${idx}`} className="border-t border-yellow-200">
                    <td className="px-2 py-1 font-mono">{it?.remote_sku || '—'}</td>
                    <td className="px-2 py-1">
                      {it?.status === 'multiple_matches' ? 'Plusieurs correspondances' :
                       it?.status === 'not_found' ? 'Introuvable' :
                       it?.status === 'conflict' ? 'Conflit de mapping' :
                       it?.status || '—'}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => handleResolveBySku(it?.remote_sku)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Lier…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                        Prix eBay (EUR)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qté eBay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qté app
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
                            {listing.qty_ebay != null
                              ? listing.qty_ebay
                              : <span className="text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {listing.qty_app != null
                              ? listing.qty_app
                              : <span className="text-gray-400">—</span>
                            }
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
                              {listing.qty_app != null && listing.remote_sku && (
                                <button
                                  onClick={() => applyQtyToEbay(listing)}
                                  disabled={actionLoading[listing.remote_id]}
                                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Qté app → eBay
                                </button>
                              )}
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
                {totalCount > 0 ? (
                  `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalCount)} sur ${totalCount}`
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
                  disabled={currentPage * itemsPerPage >= totalCount}
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
                disabled={actionLoading[linkModalData.remoteId]}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sync quantités */}
      {showQtySyncPrompt && itemsToSync.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-3">Mettre à jour les quantités sur eBay</h2>
            <p className="text-sm text-gray-600 mb-4">
              {itemsToSync.length} produit(s) ont une différence entre Qté app et Qté eBay. Voulez-vous pousser les quantités de l'app vers eBay maintenant ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowQtySyncPrompt(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Plus tard
              </button>
              <button
                onClick={confirmBulkQtySync}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Mettre à jour maintenant
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
