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
  product_name?: string | null; // Nom produit (app) pour affichage
  sync_status: 'ok' | 'pending' | 'failed' | 'unmapped';
  is_mapped: boolean;
  qty_ebay?: number | null;
  qty_app?: number | null;
}

interface FilterState {
  searchQuery: string;
  unmappedFirst: boolean;
  diffFirst: boolean;
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
    diffFirst: true,
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

  // Nouveaux états: chargement global (toutes pages) et sync massive
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [useAllLocal, setUseAllLocal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffRows, setDiffRows] = useState<PricingListing[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<Record<string, boolean>>({});

  // Non mappés: sélection et lien en masse par SKU
  const [showUnmappedModal, setShowUnmappedModal] = useState(false);
  const [unmappedRows, setUnmappedRows] = useState<PricingListing[]>([]);
  const [selectedUnmapped, setSelectedUnmapped] = useState<Record<string, boolean>>({});

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
    if (!selectedAccountId || useAllLocal) return;

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
        let mapped: PricingListing[] = (data.items || []).map((it: any) => {
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

        // Lookup noms produits (app) pour meilleure lisibilité
        try {
          const ids = Array.from(
            new Set(mapped.map(m => m.product_id).filter((v): v is string => !!v))
          );
          if (ids.length > 0) {
            const { data: prodNames } = await supabase
              .from('products')
              .select('id,name')
              .in('id', ids as any);
            const nameById: Record<string, string> = {};
            (prodNames || []).forEach((p: any) => {
              if (p?.id) nameById[p.id] = p.name || '';
            });
            mapped = mapped.map(m => ({
              ...m,
              product_name: m.product_id ? (nameById[m.product_id] ?? null) : null
            }));
          }
        } catch (e) {
          console.warn('⚠️ product_name lookup failed', (e as any)?.message || e);
        }

        try {
          const skus = Array.from(
            new Set(mapped.filter(m => !m.product_name && m.remote_sku).map(m => m.remote_sku))
          );
          if (skus.length > 0) {
            const { data: prodBySku } = await supabase
              .from('products')
              .select('sku,name')
              .in('sku', skus as any);
            const nameBySku: Record<string, string> = {};
            (prodBySku || []).forEach((p: any) => {
              if (p?.sku) nameBySku[p.sku] = p.name || '';
            });
            mapped = mapped.map(m =>
              !m.product_name && m.remote_sku ? { ...m, product_name: nameBySku[m.remote_sku] ?? null } : m
            );
          }
        } catch (e) {
          console.warn('⚠️ product_name fallback by SKU failed', (e as any)?.message || e);
        }

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

    if (filters.diffFirst) {
      result.sort((a, b) => {
        const af = a.is_mapped && a.qty_app != null && a.qty_ebay !== a.qty_app ? 0 : 1;
        const bf = b.is_mapped && b.qty_app != null && b.qty_ebay !== b.qty_app ? 0 : 1;
        return af - bf;
      });
    }

    setFilteredListings(result);
  }, [listings, filters]);

  // Ouvrir la modale des différences automatiquement si des écarts existent
  useEffect(() => {
    if (!autoLinkAttempted) return;
    const miss = listings.filter(
      l => l.is_mapped && l.qty_app != null && l.remote_sku && l.qty_ebay !== l.qty_app
    );
    if (miss.length > 0) {
      setDiffRows(miss);
      const init: Record<string, boolean> = {};
      miss.forEach(m => { if (m.remote_sku) init[m.remote_sku] = true; });
      setSelectedDiff(init);
      setShowDiffModal(true);
    }
  }, [listings, autoLinkAttempted]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);


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

  // Utils
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  const chunk = <T,>(arr: T[], size = 100) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Charger toutes les pages une seule fois et conserver en mémoire
  const handleLoadAllListings = async () => {
    if (!selectedAccountId) return;
    try {
      setIsLoadingAll(true);
      setToast({ message: 'Chargement de toutes les pages…', type: 'success' });

      const limit = itemsPerPage;
      // Première page pour connaître total
      const params1 = new URLSearchParams({
        provider: selectedProvider,
        account_id: selectedAccountId,
        q: filters.searchQuery,
        // Toujours charger tout, pas uniquement les unmapped
        only_unmapped: 'false',
        status: filters.statusFilter,
        page: '1',
        limit: String(limit),
        offset: '0'
      });
      const resp1 = await fetch(`/.netlify/functions/marketplaces-listings?${params1}`);
      if (!resp1.ok) {
        const t = await resp1.text();
        throw new Error(`HTTP ${resp1.status} ${t.substring(0, 120)}`);
      }
      const js1 = await resp1.json();
      const total = Number(js1.total || js1.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const mapBySku = new Map<string, PricingListing>();
      // Map page 1
      const page1Items: any[] = Array.isArray(js1.items) ? js1.items : [];
      let mapped: PricingListing[] = page1Items.map((it: any) => ({
        remote_id: it?.remote_id || '',
        remote_sku: it?.remote_sku || '',
        title: it?.title || '',
        price: typeof it?.price_amount === 'number' ? it.price_amount : (it?.price_amount ? parseFloat(it.price_amount) : null),
        price_currency: it?.price_currency || 'EUR',
        price_eur: null,
        internal_price: null,
        product_id: it?.product_id || null,
        product_name: null,
        sync_status: ((): any => {
          const s = (it?.status_sync || '').toString();
          return s === 'ok' || s === 'pending' || s === 'failed' ? s : 'unmapped';
        })(),
        is_mapped: !!it?.product_id || false,
        qty_ebay: typeof it?.qty_ebay === 'number' ? it.qty_ebay : (it?.qty_ebay ?? null),
        qty_app: typeof it?.qty_app === 'number' ? it.qty_app : (it?.qty_app ?? null)
      }));
      mapped.forEach(m => { if (m.remote_sku) mapBySku.set(m.remote_sku, m); });

      // Pages suivantes
      for (let p = 2; p <= totalPages; p++) {
        const offset = String((p - 1) * limit);
        const params = new URLSearchParams({
          provider: selectedProvider,
          account_id: selectedAccountId,
          q: filters.searchQuery,
          only_unmapped: 'false',
          status: filters.statusFilter,
          page: String(p),
          limit: String(limit),
          offset
        });
        const resp = await fetch(`/.netlify/functions/marketplaces-listings?${params}`);
        if (!resp.ok) {
          const t = await resp.text();
          console.warn(`Page ${p} failed: HTTP ${resp.status} ${t.substring(0, 120)}`);
          await sleep(200);
          continue;
        }
        const js = await resp.json();
        const items: any[] = Array.isArray(js.items) ? js.items : [];
        const mappedP: PricingListing[] = items.map((it: any) => ({
          remote_id: it?.remote_id || '',
          remote_sku: it?.remote_sku || '',
          title: it?.title || '',
          price: typeof it?.price_amount === 'number' ? it.price_amount : (it?.price_amount ? parseFloat(it.price_amount) : null),
          price_currency: it?.price_currency || 'EUR',
          price_eur: null,
          internal_price: null,
          product_id: it?.product_id || null,
          product_name: null,
          sync_status: ((): any => {
            const s = (it?.status_sync || '').toString();
            return s === 'ok' || s === 'pending' || s === 'failed' ? s : 'unmapped';
          })(),
          is_mapped: !!it?.product_id || false,
          qty_ebay: typeof it?.qty_ebay === 'number' ? it.qty_ebay : (it?.qty_ebay ?? null),
          qty_app: typeof it?.qty_app === 'number' ? it.qty_app : (it?.qty_app ?? null)
        }));
        mappedP.forEach(m => { if (m.remote_sku) mapBySku.set(m.remote_sku, m); });
        // Throttle léger
        await sleep(150);
      }

      // Fusion finale + lookup noms produits
      const all = Array.from(mapBySku.values());
      try {
        const ids = Array.from(new Set(all.map(m => m.product_id).filter((v): v is string => !!v)));
        if (ids.length > 0) {
          const { data: prodNames } = await supabase
            .from('products')
            .select('id,name')
            .in('id', ids as any);
          const nameById: Record<string, string> = {};
          (prodNames || []).forEach((p: any) => {
            if (p?.id) nameById[p.id] = p.name || '';
          });
          for (const m of all) {
            if (m.product_id) m.product_name = nameById[m.product_id] ?? null;
          }
        }
      } catch (e) {
        console.warn('⚠️ product_name lookup (all) failed', (e as any)?.message || e);
      }

      setListings(all);
      setTotalCount(all.length);
      setUseAllLocal(true);
      setToast({ message: `Chargé: ${all.length} produits`, type: 'success' });
    } catch (e: any) {
      setToast({ message: `Erreur chargement: ${e.message || e}`, type: 'error' });
    } finally {
      setIsLoadingAll(false);
    }
  };

  // Sync page courante: pousse qty_app -> eBay pour la page affichée
  const handleSyncPage = async () => {
    if (!selectedAccountId) return;
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(currentPage * itemsPerPage, filteredListings.length);
    const pageRows = filteredListings.slice(start, end);
    const items = pageRows
      .filter(l => l.remote_sku && typeof l.qty_app === 'number')
      .map(l => ({ sku: l.remote_sku, quantity: l.qty_app as number }));

    if (items.length === 0) {
      setToast({ message: 'Aucune quantité à pousser sur cette page', type: 'error' });
      return;
    }
    await pushQtyBatched(items);
  };

  // Sync tout: pousse qty_app -> eBay pour tout le filtré affiché (ou tout)
  const handleSyncAll = async () => {
    if (!selectedAccountId) return;
    const items = filteredListings
      .filter(l => l.remote_sku && typeof l.qty_app === 'number')
      .map(l => ({ sku: l.remote_sku, quantity: l.qty_app as number }));
    if (items.length === 0) {
      setToast({ message: 'Aucune quantité à pousser', type: 'error' });
      return;
    }
    await pushQtyBatched(items);
  };

  const pushQtyBatched = async (items: { sku: string; quantity: number }[]) => {
    try {
      setIsBulkSyncing(true);
      setToast({ message: `Sync quantités… (${items.length})`, type: 'success' });
      const batches = chunk(items, 100);
      for (let i = 0; i < batches.length; i++) {
        const resp = await fetch('/.netlify/functions/marketplaces-stock-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: selectedAccountId, items: batches[i] })
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(`HTTP ${resp.status} ${t.substring(0, 120)}`);
        }
        await sleep(100);
      }
      const skuSet = new Set(items.map(i => i.sku));
      setListings(prev => prev.map(l => (skuSet.has(l.remote_sku) ? { ...l, qty_ebay: l.qty_app ?? l.qty_ebay } : l)));
      setToast({ message: `Quantités mises à jour (${items.length})`, type: 'success' });
    } catch (e: any) {
      setToast({ message: `Erreur sync: ${e.message || e}`, type: 'error' });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleReloadFromEbay = () => {
    setUseAllLocal(false);
    setReloadToken(x => x + 1);
    setToast({ message: 'Rechargement depuis eBay…', type: 'success' });
  };

  const openUnmappedModal = () => {
    const rows = listings.filter(l => !l.is_mapped && l.remote_sku);
    setUnmappedRows(rows);
    const init: Record<string, boolean> = {};
    rows.forEach(r => { if (r.remote_sku) init[r.remote_sku] = true; });
    setSelectedUnmapped(init);
    setShowUnmappedModal(true);
  };

  const selectAllUnmapped = () => {
    const next: Record<string, boolean> = {};
    unmappedRows.forEach(r => { if (r.remote_sku) next[r.remote_sku] = true; });
    setSelectedUnmapped(next);
  };

  const clearAllUnmapped = () => {
    setSelectedUnmapped({});
  };

  const linkSelectedUnmappedBySku = async () => {
    try {
      const items = Object.keys(selectedUnmapped)
        .filter(sku => selectedUnmapped[sku])
        .map(sku => {
          const row = unmappedRows.find(r => r.remote_sku === sku);
          return row ? { remote_sku: sku, remote_id: row.remote_id } : null;
        })
        .filter(Boolean) as { remote_sku: string; remote_id: string }[];

      if (items.length === 0) {
        setToast({ message: 'Aucune ligne sélectionnée', type: 'error' });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };

      const payload = {
        action: 'bulk_link_by_sku',
        provider: selectedProvider,
        account_id: selectedAccountId,
        items
      };

      const resp = await fetch('/.netlify/functions/marketplaces-mapping', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      const body = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        throw new Error(body?.error || `HTTP ${resp.status}`);
      }

      const linked = Number(body?.linked || 0);
      const review = Array.isArray(body?.needs_review) ? body.needs_review : [];
      setToast({ message: `Liens par SKU: ${linked} lié(s), ${review.length} à revoir`, type: linked > 0 ? 'success' : 'error' });
      setShowUnmappedModal(false);

      // Rafraîchir pour récupérer product_id et qty_app
      setReloadToken(x => x + 1);
    } catch (e: any) {
      setToast({ message: `Erreur liaison: ${e.message || e}`, type: 'error' });
    }
  };

  const openDiffModal = () => {
    const miss = listings.filter(
      l => l.is_mapped && l.qty_app != null && l.remote_sku && l.qty_ebay !== l.qty_app
    );
    setDiffRows(miss);
    const init: Record<string, boolean> = {};
    miss.forEach(m => { if (m.remote_sku) init[m.remote_sku] = true; });
    setSelectedDiff(init);
    if (miss.length > 0) setShowDiffModal(true);
    else setToast({ message: 'Aucune différence de quantités détectée', type: 'success' });
  };

  const sendSelectedDiff = async () => {
    const selectedSkus = Object.keys(selectedDiff).filter(s => selectedDiff[s]);
    if (selectedSkus.length === 0) {
      setToast({ message: 'Aucune ligne sélectionnée', type: 'error' });
      return;
    }
    const bySku = new Map(diffRows.map(r => [r.remote_sku, r]));
    const items = selectedSkus
      .map(s => {
        const row = bySku.get(s);
        return row && typeof row.qty_app === 'number' ? { sku: s, quantity: row.qty_app } : null;
      })
      .filter(Boolean) as { sku: string; quantity: number }[];

    await pushQtyBatched(items);
    setShowDiffModal(false);
    const miss = listings.filter(
      l => l.is_mapped && l.qty_app != null && l.remote_sku && l.qty_ebay !== l.qty_app
    );
    setDiffRows(miss);
    const init: Record<string, boolean> = {};
    miss.forEach(m => { if (m.remote_sku) init[m.remote_sku] = true; });
    setSelectedDiff(init);
  };

  const selectAllDiff = () => {
    const next: Record<string, boolean> = {};
    diffRows.forEach(r => { if (r.remote_sku) next[r.remote_sku] = true; });
    setSelectedDiff(next);
  };

  const clearAllDiff = () => {
    setSelectedDiff({});
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
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.diffFirst}
              onChange={(e) => setFilters({ ...filters, diffFirst: e.target.checked })}
              className="rounded"
            />
            Différences d'abord
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
            onClick={handleReloadFromEbay}
            disabled={isLoadingListings}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
            title="Recharger en mode serveur depuis eBay"
          >
            Recharger depuis eBay
          </button>
          <button
            onClick={handleLoadAllListings}
            disabled={isLoadingAll || isLoadingListings}
            className={`px-4 py-2 rounded-md ${isLoadingAll ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            title="Charger toutes les pages dans la mémoire (pagination client)"
          >
            {isLoadingAll ? 'Chargement…' : 'Charger tout (toutes pages)'}
          </button>
          <button
            onClick={openUnmappedModal}
            disabled={isLoadingListings || listings.length === 0}
            className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700"
            title="Afficher les produits non mappés et lier en masse par SKU"
          >
            Non mappés
          </button>
          <button
            onClick={openDiffModal}
            disabled={isLoadingListings || listings.length === 0}
            className="px-4 py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700"
            title="Afficher uniquement les produits avec différences de quantités"
          >
            Différences
          </button>
          <button
            onClick={handleSyncPage}
            disabled={isBulkSyncing || isLoadingListings}
            className={`px-4 py-2 rounded-md ${isBulkSyncing ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            title="Pousser les quantités de la page courante vers eBay"
          >
            {isBulkSyncing ? 'Sync…' : 'Sync page'}
          </button>
          <button
            onClick={handleSyncAll}
            disabled={isBulkSyncing || isLoadingListings}
            className={`px-4 py-2 rounded-md ${isBulkSyncing ? 'bg-gray-200 text-gray-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            title="Pousser les quantités de tout le filtré vers eBay"
          >
            {isBulkSyncing ? 'Sync…' : 'Sync tout'}
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
                        Nom produit (app)
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
                            {listing.product_name ? (
                              <span>{listing.product_name}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
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

      {/* Modal Différences de quantités */}
      {showDiffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Produits avec différences de quantités</h2>
              <button onClick={() => setShowDiffModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={selectAllDiff} className="px-3 py-1 border rounded">Tout sélectionner</button>
              <button onClick={clearAllDiff} className="px-3 py-1 border rounded">Tout désélectionner</button>
            </div>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Nom produit (app)</th>
                    <th className="px-3 py-2 text-left">Qté eBay</th>
                    <th className="px-3 py-2 text-left">Qté app</th>
                    <th className="px-3 py-2 text-left">Sélection</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(r => (
                    <tr key={r.remote_id} className="border-t">
                      <td className="px-3 py-2 font-mono">{r.remote_sku}</td>
                      <td className="px-3 py-2">{r.product_name || r.title || '—'}</td>
                      <td className="px-3 py-2">{r.qty_ebay ?? '—'}</td>
                      <td className="px-3 py-2">{r.qty_app ?? '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selectedDiff[r.remote_sku]}
                          onChange={(e) => setSelectedDiff(prev => ({ ...prev, [r.remote_sku]: e.target.checked }))}
                        />
                      </td>
                    </tr>
                  ))}
                  {diffRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">Aucune différence détectée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
              <button
                onClick={sendSelectedDiff}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Envoyer vers eBay ({Object.values(selectedDiff).filter(Boolean).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Non mappés (lien en masse par SKU) */}
      {showUnmappedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Produits non mappés</h2>
              <button onClick={() => setShowUnmappedModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={selectAllUnmapped} className="px-3 py-1 border rounded">Tout sélectionner</button>
              <button onClick={clearAllUnmapped} className="px-3 py-1 border rounded">Tout désélectionner</button>
            </div>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Nom (app)</th>
                    <th className="px-3 py-2 text-left">Sélection</th>
                  </tr>
                </thead>
                <tbody>
                  {unmappedRows.map(r => (
                    <tr key={r.remote_id} className="border-t">
                      <td className="px-3 py-2 font-mono">{r.remote_sku}</td>
                      <td className="px-3 py-2">{r.product_name || r.title || '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selectedUnmapped[r.remote_sku]}
                          onChange={(e) => setSelectedUnmapped(prev => ({ ...prev, [r.remote_sku]: e.target.checked }))}
                        />
                      </td>
                    </tr>
                  ))}
                  {unmappedRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-500">Aucun non mappé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowUnmappedModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
              <button
                onClick={linkSelectedUnmappedBySku}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Lier sélection (SKU)
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
