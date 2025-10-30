import React, { useEffect, useState } from 'react';
import { Package, Bell, DollarSign, Settings, Users, ShoppingBag, Cloud, PenTool as Tool, Box, Layers, Wrench, Calculator, LogOut, User } from 'lucide-react';
import { useSalesStore } from './store/salesStore';
import { Products } from './pages/Products';
import { ProductForm } from './components/Products/ProductForm';
import { ProductList } from './components/Products/ProductList';
import { ProductStock } from './pages/ProductStock';
import { StockManagement } from './pages/StockManagement';
import { CategoryManagement } from './pages/CategoryManagement';
import { VariantManagement } from './pages/VariantManagement';
import { ShippingBoxes } from './pages/ShippingBoxes';
import { SearchBar } from './components/Search/SearchBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isAdmin } from './lib/supabase';
import { Role, can, ROLES } from './lib/rbac';
import { ProductTypeSelection } from './pages/ProductTypeSelection';
import { ProductPAMForm } from './pages/ProductPAMForm';
import { ProductMultiplePriceForm } from './pages/ProductMultiplePriceForm';
// Import des composants de facturation
import { QuoteList } from './components/Billing/QuoteList';
import { QuoteForm } from './components/Billing/QuoteForm';
import { InvoiceList } from './components/Billing/InvoiceList';
import { InvoiceForm } from './components/Billing/InvoiceForm';
import { OrderList } from './components/Billing/OrderList';
import { OrderForm } from './components/Billing/OrderForm';
import { CreditNoteList } from './components/Billing/CreditNoteList';
import { CreditNoteForm } from './components/Billing/CreditNoteForm';
import { DocumentTypesPage } from './pages/billing/DocumentTypesPage';
// Import des composants de gestion des clients
import { Customers } from './pages/Customers';
// Import des composants de paramètres
import { MailSettingsPage } from './components/Billing/MailSettingsPage';
import { InvoiceSettings } from './components/Billing/InvoiceSettings';
import { RepairCalculator } from './pages/RepairCalculator';
import { PriseEnCharge } from './pages/PriseEnCharge';
import { supabase } from './lib/supabase';
import MarketplacePricing from './pages/pricing';
import EbaySettings from './pages/settings/ebay';
import UsersManagement from './pages/settings/users';
import { QuickCalculator } from './components/Products/QuickCalculator';
import { SalesChart } from './components/Dashboard/SalesChart';
import { ConsignmentsSection } from './components/ConsignmentsSection';
import { Consignments } from './pages/consignments';
import Login from './pages/Login';

function App() {
  const { metrics, isLoading, error, fetchMetrics } = useSalesStore();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [showBillingMenu, setShowBillingMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showWorkshopMenu, setShowWorkshopMenu] = useState(false);
  const [isQuickCalcOpen, setIsQuickCalcOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [showConsignments, setShowConsignments] = useState(false);
  const [period, setPeriod] = useState<'jour' | 'semaine' | 'mois' | 'personnalise'>('semaine');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [goalsTab, setGoalsTab] = useState<'global' | 'internet' | 'mag1' | 'mag2'>('global');
  const [stockType, setStockType] = useState<string>('tous');
  const [loadingStocks, setLoadingStocks] = useState<boolean>(false);
  const [natureTypes, setNatureTypes] = useState<string[]>([]);
  const [globalHT, setGlobalHT] = useState<number>(0);
  const [globalTVAClassique, setGlobalTVAClassique] = useState<number>(0);
  const [globalTVAMarge, setGlobalTVAMarge] = useState<number>(0);
  const [obsoleteValue, setObsoleteValue] = useState<number>(0);
  const [obsoleteMarginValue, setObsoleteMarginValue] = useState<number>(0);
  const [withoutObsolete, setWithoutObsolete] = useState<number>(0);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [userRole, setUserRole] = useState<Role>(ROLES.MAGASIN);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [montantDu, setMontantDu] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {}
  }, [sidebarCollapsed]);

  // Deep-linking and graceful routing without react-router:
  // - Accepts ?page=<known-page>
  // - Maps pathnames like /billing/invoices/new to the internal page ids (e.g., invoices-new)
  // - Keeps existing marketplace-pricing behavior
  useEffect(() => {
    const ALLOWED = new Set<string>([
      // Billing
      'quotes-list','quotes-new','quotes-edit',
      'invoices-list','invoices-new','invoices-edit',
      'orders-list','orders-new','orders-edit',
      'credit-notes-list','credit-notes-new','credit-notes-edit',
      'document-types',
      // Core pages already used in the app
      'dashboard','product-list','product-stock','stock-management',
      'category-management','variant-management','shipping-boxes',
      'select-type','add-product','add-product-pam','add-product-multiple',
      'customers','consignments',
      // Settings / tools / marketplace
      'mail-settings','invoice-settings','settings-ebay','settings-users',
      'marketplace-pricing','repair-calculator','atelier-prise-en-charge'
    ]);

    const mapPathToPage = (pathname: string): string | null => {
      const p = pathname.replace(/\/+$/, '');
      // Normalize empty to root
      if (p === '' || p === '/') return null;

      // Billing aliases
      if (p === '/billing/invoices') return 'invoices-list';
      if (p === '/billing/invoices/new') return 'invoices-new';
      if (p.startsWith('/billing/invoices/edit')) return 'invoices-edit';

      if (p === '/billing/quotes') return 'quotes-list';
      if (p === '/billing/quotes/new') return 'quotes-new';
      if (p.startsWith('/billing/quotes/edit')) return 'quotes-edit';

      if (p === '/billing/credit-notes') return 'credit-notes-list';
      if (p === '/billing/credit-notes/new') return 'credit-notes-new';
      if (p.startsWith('/billing/credit-notes/edit')) return 'credit-notes-edit';

      if (p === '/billing/document-types') return 'document-types';

      // Orders (if deep-linked)
      if (p === '/billing/orders') return 'orders-list';
      if (p === '/billing/orders/new') return 'orders-new';
      if (p.startsWith('/billing/orders/edit')) return 'orders-edit';

      // Marketplace pricing
      if (p === '/marketplace/pricing') return 'marketplace-pricing';

      // Settings
      if (p === '/settings/invoice') return 'invoice-settings';
      if (p === '/settings/mail') return 'mail-settings';
      if (p === '/settings/ebay') return 'settings-ebay';
      if (p === '/settings/users') return 'settings-users';

      // Products sections
      if (p === '/products') return 'product-list';
      if (p === '/products/stock') return 'product-stock';
      if (p === '/products/stock-management') return 'stock-management';
      if (p === '/products/category-management') return 'category-management';
      if (p === '/products/variant-management') return 'variant-management';
      if (p === '/products/shipping-boxes') return 'shipping-boxes';
      if (p === '/products/select-type') return 'select-type';
      if (p === '/products/add') return 'add-product';
      if (p === '/products/add-pam') return 'add-product-pam';
      if (p === '/products/add-multiple') return 'add-product-multiple';

      // Customers
      if (p === '/customers') return 'customers';

      // Tools / Workshop
      if (p === '/tools/repair-calculator') return 'repair-calculator';
      if (p === '/atelier/prise-en-charge') return 'atelier-prise-en-charge';

      return null;
    };

    const applyFromLocation = () => {
      const url = new URL(window.location.href);
      const page = url.searchParams.get('page');
      const provider = url.searchParams.get('provider');
      const connected = url.searchParams.get('connected');

      // 1) Pathname mapping (e.g., /billing/invoices/new)
      const mapped = mapPathToPage(window.location.pathname);
      if (mapped && ALLOWED.has(mapped)) {
        // Normalize URL to include ?page=mapped for consistency (without reload)
        if (!page) {
          const u = new URL(window.location.href);
          u.searchParams.set('page', mapped);
          window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
        }
        setCurrentPage(mapped);
        return;
      }

      // 2) Marketplace special case (kept)
      if (page === 'marketplace-pricing' || (provider === 'ebay' && connected === '1')) {
        setCurrentPage('marketplace-pricing');
        return;
      }

      // 3) Generic ?page support with whitelist
      if (page && ALLOWED.has(page)) {
        setCurrentPage(page);
      }
    };

    applyFromLocation();

    const onPop = () => {
      try { applyFromLocation(); } catch {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  const toggleSection = (id: string) => {
    setOpenSections(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const fetchStocks = async (selectedType: string) => {
    // Protection au montage: si supabase non dispo
    if (!(supabase as any)) return;
    setLoadingStocks(true);
    try {
      // Utiliser la vue qui expose stock_total et les prix d'achat
      const viewCols = 'raw_purchase_price,purchase_price_with_fees,vat_type,stock_total,stock';
      let data: any[] = [];
      let error: any = null;

      // Charger les données selon la nature sélectionnée
      const productCols = 'raw_purchase_price,purchase_price_with_fees,vat_type,stock_total,stock';
      if (selectedType && selectedType !== 'tous') {
        // Filtrer par "Nature du produit" via category_id
        let catIds: string[] = [];
        try {
          const { data: cats, error: catErr } = await supabase
            .from('product_categories')
            .select('id')
            .eq('type' as any, selectedType as any);
          if (catErr) {
            console.warn('Stocks fetch: category ids error', catErr);
          }
          catIds = Array.from(new Set(((cats as any[]) || []).map((c: any) => c.id).filter(Boolean)));
        } catch (e) {
          console.warn('Stocks fetch: categories exception', e);
        }
        if (catIds.length > 0) {
          const res = await supabase.from('products').select(productCols).in('category_id', catIds as any);
          data = res.data ?? [];
          error = res.error;
        } else {
          data = [];
          error = null;
        }
      } else {
        // Global: vue consolidée si dispo, sinon products
        let res = await supabase.from('clear_products_with_stock').select(viewCols);
        if (res.error) {
          res = await supabase.from('products').select(productCols);
        }
        data = res.data ?? [];
        error = res.error;
      }

      if (error) {
        // Journaliser l'erreur de manière non bloquante
        console.warn('Stocks fetch error:', error);
      }

      // Logs de diagnostic pour comprendre la structure
      console.info('Stocks fetch:', { selectedType, rows: data.length });
      if (data.length) {
        // Afficher les clés disponibles du premier enregistrement
        console.info('Sample row keys:', Object.keys(data[0] || {}));
      }

      // Totaux HT par type de TVA
      let totalHT = 0;
      let htClassic = 0; // TVA classique (normal/normale/classique/standard)
      let htMargin = 0;  // TVA marge (marge/margin)
      let htOther = 0;   // Autres libellés éventuels
      let totalObsolete = 0; // Aucune colonne is_obsolete détectée dans le schéma → 0
      let totalObsoleteMarge = 0;

      for (const row of data) {
        const unitCost =
          Number((row as any)?.raw_purchase_price) ||
          Number((row as any)?.purchase_price_with_fees) ||
          0;
        const qty =
          Number((row as any)?.stock_total) ??
          Number((row as any)?.stock) ??
          0;
        const ht = unitCost * qty;
        totalHT += ht;

        const vt = String((row as any)?.vat_type ?? '')
          .trim()
          .toLowerCase();

        const isMargin = vt === 'marge' || vt === 'margin';
        const isClassic = vt === 'normal' || vt === 'normale' || vt === 'classique' || vt === 'standard' || vt === 'std';

        if (isMargin) {
          htMargin += ht;
        } else if (isClassic) {
          htClassic += ht;
        } else {
          htOther += ht;
        }

        // Pas de champ d'obsolescence dans le schéma → reste à 0
        if (false) {
          totalObsolete += ht;
          if (isMargin) totalObsoleteMarge += ht;
        }
      }

      const withoutObsoleteVal = totalHT - totalObsolete;

      // Affectations: afficher directement la valeur HT par catégorie de TVA
      setGlobalHT(totalHT);
      setGlobalTVAClassique(htClassic);
      setGlobalTVAMarge(htMargin);
      setObsoleteValue(totalObsolete);
      setObsoleteMarginValue(totalObsoleteMarge);
      setWithoutObsolete(withoutObsoleteVal);

      // Logs de contrôle pour vérifier la répartition
      console.info('[Stocks] VAT buckets', {
        classicHT: htClassic,
        marginHT: htMargin,
        otherHT: htOther,
        totalHT
      });

      // Log clair de succès
      console.info('Stocks loaded:', { totalHT, obsolete: totalObsolete, withoutObsolete: withoutObsoleteVal });
    } catch (e) {
      console.warn('Stocks fetch failed:', e);
      // Valeurs par défaut déjà à 0 via useState initial → évite NaN €
    } finally {
      setLoadingStocks(false);
    }
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminStatus = await isAdmin();
      setIsAdminUser(adminStatus);
    };
    checkAdminStatus();
  }, []);

  // Load user role from Supabase profiles
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        console.log('[RBAC] Loading user role from Supabase profiles');
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.log('[RBAC] No authenticated user found');
          return;
        }

        console.log('[RBAC] User authenticated:', user.id);
        setCurrentUserId(user.id);
        setUserEmail(user.email || '');
        console.log('[AUTH] User email loaded:', user.email);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[RBAC] Error loading user role:', error);
          return;
        }

        if (profile && profile.role) {
          console.log('[RBAC] User role loaded:', profile.role);
          console.log('[RBAC] Setting userRole state to:', profile.role);
          console.log('[RBAC] Can access settings?', can('accessSettings', profile.role as Role));
          setUserRole(profile.role as Role);
          console.log('[RBAC] userRole state updated');
        } else {
          console.log('[RBAC] No profile found, creating default MAGASIN profile');
          // Create default profile if not exists
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, role: ROLES.MAGASIN });

          if (insertError) {
            console.error('[RBAC] Error creating profile:', insertError);
          } else {
            console.log('[RBAC] Default profile created');
          }
        }
      } catch (e) {
        console.error('[RBAC] Exception loading user role:', e);
      }
    };

    loadUserRole();
  }, []);

  // Charger les notifications et le montant dû
  useEffect(() => {
    const loadNotificationsAndMontantDu = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log('[Notifications] Chargement des notifications');

        // Charger les notifications
        const notifUrl = `/.netlify/functions/notifications-list?unread_only=1`;
        const notifResponse = await fetch(notifUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (notifResponse.ok) {
          const notifResult = await notifResponse.json();
          setNotifications(notifResult.notifications || []);
          setUnreadNotifCount(notifResult.unread_count || 0);
          console.log('[Notifications] Notifications chargées:', notifResult.unread_count);
        }

        // Charger le montant dû depuis consignments
        const consigUrl = `/.netlify/functions/consignments-list`;
        const consigResponse = await fetch(consigUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (consigResponse.ok) {
          const consigResult = await consigResponse.json();
          const totalDu = (consigResult.summary || []).reduce((acc: number, item: any) => {
            return acc + (item.total_ttc || 0);
          }, 0);
          setMontantDu(totalDu);
          console.log('[Consignments] Montant dû total:', totalDu);
        }
      } catch (error) {
        console.error('[Notifications] Erreur chargement:', error);
      }
    };

    // Charger immédiatement
    loadNotificationsAndMontantDu();

    // Recharger toutes les 60 secondes
    const interval = setInterval(loadNotificationsAndMontantDu, 60000);

    return () => clearInterval(interval);
  }, []);

  // Charger dynamiquement les natures (types) pour le filtre "Nature du produit"
  useEffect(() => {
    const loadNatureTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('product_categories')
          .select('type')
          .not('type', 'is', null);
        if (!error && Array.isArray(data)) {
          const types = Array.from(
            new Set(((data as any[]) || []).map((r: any) => String(r.type)).filter(Boolean))
          ).sort();
          setNatureTypes(types);
        }
      } catch (e) {
        console.warn('Failed to load nature types:', e);
      }
    };
    loadNatureTypes();
  }, []);

  useEffect(() => {
    (window as any).__setCurrentPage = setCurrentPage;
    (window as any).__getCurrentPage = () => currentPage;
    return () => {
      delete (window as any).__setCurrentPage;
      delete (window as any).__getCurrentPage;
    };
  }, [currentPage]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchStocks(stockType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockType]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">Erreur: {error}</div>;
  }

  const renderContent = () => {
    const content: any = (() => {
      switch (currentPage) {
        case 'select-type':
          return isAdminUser ? <ProductTypeSelection /> : <div className="p-6">Accès non autorisé</div>;
        case 'add-product':
          return isAdminUser ? <ProductForm /> : <div className="p-6">Accès non autorisé</div>;
        case 'add-product-pam':
          return isAdminUser ? <ProductPAMForm /> : <div className="p-6">Accès non autorisé</div>;
        case 'add-product-multiple':
          return isAdminUser ? <ProductMultiplePriceForm /> : <div className="p-6">Accès non autorisé</div>;
        case 'product-list':
          return <Products />;
        case 'product-stock':
          return <ProductStock />;
        case 'stock-management':
          return isAdminUser ? <StockManagement /> : <div className="p-6">Accès non autorisé</div>;
        case 'category-management':
          return isAdminUser ? <CategoryManagement /> : <div className="p-6">Accès non autorisé</div>;
        case 'variant-management':
          return isAdminUser ? <VariantManagement /> : <div className="p-6">Accès non autorisé</div>;
        case 'shipping-boxes':
          return isAdminUser ? <ShippingBoxes /> : <div className="p-6">Accès non autorisé</div>;
        // Ajout des routes pour la facturation
        case 'quotes-list':
          return <QuoteList />;
        case 'quotes-new':
          return <QuoteForm />;
        case 'quotes-edit':
          return <QuoteForm quoteId={sessionStorage.getItem('editQuoteId') || undefined} />;
        case 'invoices-list':
          return <InvoiceList />;
        case 'invoices-new':
          return <InvoiceForm />;
        case 'invoices-edit':
          return <InvoiceForm invoiceId={sessionStorage.getItem('editInvoiceId') || undefined} />;
        case 'orders-list':
          return can('viewOrders', userRole) ? <OrderList /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'orders-new':
          return can('viewOrders', userRole) ? <OrderForm /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'orders-edit':
          return can('viewOrders', userRole) ? <OrderForm orderId={sessionStorage.getItem('editOrderId') || undefined} /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'credit-notes-list':
          return <CreditNoteList />;
        case 'credit-notes-new':
          return <CreditNoteForm />;
        case 'credit-notes-edit':
          return <CreditNoteForm creditNoteId={sessionStorage.getItem('editCreditNoteId') || undefined} />;
        case 'document-types':
          return <DocumentTypesPage />;
        // Ajout de la route pour la gestion des clients
        case 'customers':
          return <Customers />;
        case 'consignments':
          return can('viewConsignments', userRole) ? <Consignments /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'repair-calculator':
          return <RepairCalculator />;
        case 'atelier-prise-en-charge':
          return <PriseEnCharge />;
        case 'marketplace-pricing':
          return can('accessPricing', userRole) ? <MarketplacePricing /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'settings-ebay':
          return can('accessSettings', userRole) ? <EbaySettings /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'settings-users':
          return can('accessSettings', userRole) ? <UsersManagement /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'mail-settings':
          return can('accessSettings', userRole) ? <MailSettingsPage /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        case 'invoice-settings':
          return can('accessSettings', userRole) ? <InvoiceSettings /> : <div className="p-6 text-red-600">Accès non autorisé</div>;
        default:
          return (
            <main className="bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Barre de période globale */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="inline-flex bg-white/90 border border-gray-200/50 rounded-md p-1 shadow-sm">
                    <button onClick={() => setPeriod('jour')} className={`px-3 py-1.5 rounded text-sm font-medium ${period === 'jour' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Jour</button>
                    <button onClick={() => setPeriod('semaine')} className={`px-3 py-1.5 rounded text-sm font-medium ${period === 'semaine' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Semaine</button>
                    <button onClick={() => setPeriod('mois')} className={`px-3 py-1.5 rounded text-sm font-medium ${period === 'mois' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Mois</button>
                    <button onClick={() => setPeriod('personnalise')} className={`px-3 py-1.5 rounded text-sm font-medium ${period === 'personnalise' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Personnalisé</button>
                  </div>
                  {period === 'personnalise' && (
                    <div className="flex items-center gap-2">
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm" />
                      <span className="text-gray-400">–</span>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm" />
                    </div>
                  )}
                  <div className="text-sm text-gray-500 sm:ml-auto">
                    📅 Période active : {period === 'jour' ? "Aujourd'hui" : period === 'semaine' ? 'Semaine en cours' : period === 'mois' ? 'Mois en cours' : 'Période personnalisée'}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Commandes */}
                  <div className="bg-white/90 rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                    <button
                      onClick={() => toggleSection('commandes')}
                      aria-label="Section Commandes"
                      aria-expanded={openSections.includes('commandes')}
                      aria-controls="section-commandes"
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <span>Commandes</span>
                      <svg className={`h-5 w-5 transition-transform duration-300 ${openSections.includes('commandes') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      id="section-commandes"
                      role="region"
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${openSections.includes('commandes') ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="p-4 border-t border-gray-200/50">
                        <p className="text-sm text-gray-600 mb-4">Commandes à traiter</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-md text-center">
                            <p className="text-sm text-gray-500">À traiter</p>
                            <p className="text-2xl font-bold text-gray-900">—</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-md text-center">
                            <p className="text-sm text-gray-500">Expédiées</p>
                            <p className="text-2xl font-bold text-gray-900">—</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                          <span className="inline-flex items-center gap-1 text-gray-800"><span className="font-semibold">Amazon</span><span className="px-1.5 py-0.5 rounded bg-gray-100">3</span></span>
                          <span className="inline-flex items-center gap-1 text-gray-800"><span className="font-semibold">eBay</span><span className="px-1.5 py-0.5 rounded bg-gray-100">5</span></span>
                          <span className="inline-flex items-center gap-1 text-gray-800"><span className="font-semibold">BackMarket</span><span className="px-1.5 py-0.5 rounded bg-gray-100">1</span></span>
                          <span className="inline-flex items-center gap-1 text-gray-800"><span className="font-semibold">Boutique</span><span className="px-1.5 py-0.5 rounded bg-gray-100">2</span></span>
                        </div>

                        {/* Espace réservé pour futur bouton "Voir plus" */}
                        <div className="pt-2 min-h-[32px]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Ventes */}
                  <div className="bg-white/90 rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                    <button
                      onClick={() => toggleSection('ventes')}
                      aria-label="Section Ventes"
                      aria-expanded={openSections.includes('ventes')}
                      aria-controls="section-ventes"
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <span>Ventes</span>
                      <svg className={`h-5 w-5 transition-transform duration-300 ${openSections.includes('ventes') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      id="section-ventes"
                      role="region"
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${openSections.includes('ventes') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="p-4 border-t border-gray-200/50 space-y-6">
                        {/* Affichage d'un seul bloc selon le filtre global */}
                        <div className="space-y-3">
                          <h3 className="font-medium text-gray-900">
                            {period === 'jour' ? 'Ventes du jour' : period === 'semaine' ? 'Ventes de la semaine' : period === 'mois' ? 'Ventes du mois' : 'Ventes (période personnalisée)'}
                          </h3>
                          <div className="bg-gray-50 p-4 rounded-md">
                            <SalesChart />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Totaux par marketplace</h4>
                            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-800">
                              <li className="bg-white/80 border border-gray-200 rounded-md p-3 flex items-center justify-between"><span>Amazon</span><span className="font-semibold">—</span></li>
                              <li className="bg-white/80 border border-gray-200 rounded-md p-3 flex items-center justify-between"><span>eBay</span><span className="font-semibold">—</span></li>
                              <li className="bg-white/80 border border-gray-200 rounded-md p-3 flex items-center justify-between"><span>Boutique</span><span className="font-semibold">—</span></li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Objectifs */}
                  <div className="bg-white/90 rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                    <button
                      onClick={() => toggleSection('objectifs')}
                      aria-label="Section Objectifs"
                      aria-expanded={openSections.includes('objectifs')}
                      aria-controls="section-objectifs"
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <span>Objectifs</span>
                      <svg className={`h-5 w-5 transition-transform duration-300 ${openSections.includes('objectifs') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      id="section-objectifs"
                      role="region"
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${openSections.includes('objectifs') ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="p-4 border-t border-gray-200/50 space-y-4">
                        {/* Zone de saisie (UI seulement) */}
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <h4 className="text-sm font-medium text-gray-800 mb-2">Objectifs à saisir</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input className="h-10 rounded-md border border-gray-300 px-3 text-sm" placeholder="Objectif Global (€)" />
                            <input className="h-10 rounded-md border border-gray-300 px-3 text-sm" placeholder="Objectif Internet (€)" />
                            <input className="h-10 rounded-md border border-gray-300 px-3 text-sm" placeholder="Objectif Magasin (€)" />
                          </div>
                        </div>

                        {/* Chiffre réalisé & progression */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-gray-700">
                            <span>Chiffre réalisé</span>
                            <span className="font-semibold">— €</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4 relative">
                            <div className="bg-emerald-600 h-4 rounded-full" style={{ width: '60%' }}></div>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700">60%</span>
                          </div>
                          <div className="text-sm text-gray-700">Reste à faire pour atteindre l’objectif : — €</div>
                        </div>

                        {/* Sous-onglets (UI seulement) */}
                        <div>
                          <div className="inline-flex bg-white/80 border border-gray-200 rounded-md p-1 shadow-sm mb-3">
                            <button onClick={() => setGoalsTab('global')} className={`px-3 py-1.5 rounded text-sm ${goalsTab === 'global' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Global</button>
                            <button onClick={() => setGoalsTab('internet')} className={`px-3 py-1.5 rounded text-sm ${goalsTab === 'internet' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Internet</button>
                            <button onClick={() => setGoalsTab('mag1')} className={`px-3 py-1.5 rounded text-sm ${goalsTab === 'mag1' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Magasin 1</button>
                            <button onClick={() => setGoalsTab('mag2')} className={`px-3 py-1.5 rounded text-sm ${goalsTab === 'mag2' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-100 text-gray-700'}`}>Magasin 2</button>
                          </div>
                          <div className="text-sm text-gray-700">Vue: {goalsTab === 'global' ? 'Global' : goalsTab === 'internet' ? 'Internet' : goalsTab === 'mag1' ? 'Magasin 1' : 'Magasin 2'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stocks */}
                  <div className="bg-white/90 rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                    <button
                      onClick={() => toggleSection('stocks')}
                      aria-label="Section Valeur stock"
                      aria-expanded={openSections.includes('stocks')}
                      aria-controls="section-stocks"
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <span>Valeur stock</span>
                      <svg className={`h-5 w-5 transition-transform duration-300 ${openSections.includes('stocks') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      id="section-stocks"
                      role="region"
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${openSections.includes('stocks') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="p-0 border-t border-gray-200/50">
                        {/* Sticky filter */}
                        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200/50 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-700">Nature du produit</label>
                            <select value={stockType} onChange={(e) => setStockType(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm">
                              <option value="tous">Tous</option>
                              {natureTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Valeur stock globale (HT)</h4>
                              {loadingStocks ? (
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                <p className="text-lg font-semibold text-gray-800">{euro.format(globalHT)}</p>
                              )}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">TVA classique</h4>
                              {loadingStocks ? (
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                <p className="text-lg font-semibold text-gray-800">{euro.format(globalTVAClassique)}</p>
                              )}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">TVA marge</h4>
                              {loadingStocks ? (
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                <p className="text-lg font-semibold text-gray-800">{euro.format(globalTVAMarge)}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Stock obsolète à dévaluer (HT)</h4>
                              {loadingStocks ? (
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                <p className="text-lg font-semibold text-gray-800">{euro.format(obsoleteValue)}</p>
                              )}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Stock obsolète à dévaluer (TVA marge)</h4>
                              {loadingStocks ? (
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                              ) : (
                                <p className="text-lg font-semibold text-gray-800">{euro.format(obsoleteMarginValue)}</p>
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Valeur stock sans produits obsolètes</h4>
                            {loadingStocks ? (
                              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                            ) : (
                              <p className="text-lg font-semibold text-gray-800">{euro.format(withoutObsolete)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suivi sous-traitant - accordéon embed */}
                  {can('viewConsignments', userRole) && (
                    <div className="bg-white/90 rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                      <button
                        onClick={() => setShowConsignments(v => !v)}
                        aria-label="Section Suivi sous-traitant"
                        aria-expanded={showConsignments}
                        aria-controls="section-consignments"
                        className="w-full flex items-center justify-between p-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span>Suivi sous-traitant</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-bold text-blue-600">{euro.format(montantDu)}</span>
                          <svg className={`h-5 w-5 transition-transform duration-300 ${showConsignments ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      <div
                        id="section-consignments"
                        role="region"
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${showConsignments ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                        <div className="p-4 border-t border-gray-200/50">
                          <ConsignmentsSection />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </main>
          );
      }
    })();

    return <ErrorBoundary>{content}</ErrorBoundary>;
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? 'w-16 hover:w-64 group' : 'w-64'} relative bg-[#2d3741] text-white h-screen overflow-y-auto overflow-x-hidden transition-all duration-300`}
        aria-label="Barre de navigation latérale"
      >
        <div className="p-4">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(v => !v)}
            className="absolute -right-3 top-4 z-10 w-6 h-6 rounded-full bg-white text-[#2d3741] shadow flex items-center justify-center border border-gray-200"
            aria-pressed={sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}
            title={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">A</span>
            </div>
            <span
              className={`font-medium ${
                sidebarCollapsed
                  ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                  : 'opacity-100'
              } transition-opacity duration-200`}
            >
              swuidy
            </span>
          </div>
          
          <div
            className={`${
              sidebarCollapsed
                ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                : 'opacity-100'
            } transition-opacity duration-200`}
          >
            <SearchBar onSearch={(q) => {
              try {
                const STORAGE_KEY = 'products:list:state:v1';
                const raw = sessionStorage.getItem(STORAGE_KEY);
                const st = raw ? JSON.parse(raw) : {};
                st.search = q;
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(st));
              } catch {}
              setCurrentPage('product-list');
              try {
                window.dispatchEvent(new CustomEvent('products:global-search', { detail: { q } }));
              } catch {}
            }} />
          </div>
        </div>

        <nav className="mt-4">
          <div className="px-4 py-2 text-gray-400 text-xs uppercase">Navigation</div>
          {(() => {
            console.log('[SIDEBAR RENDER] Current state:', {
              userRole,
              isAdminUser,
              currentUserId,
              canAccessSettings: can('accessSettings', userRole)
            });
            return null;
          })()}
          <a
            href="#"
            onClick={() => setCurrentPage('dashboard')}
            className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'dashboard' ? 'bg-[#24303a]' : ''}`}
          >
            <Package size={18} />
            <span>Tableau de bord</span>
          </a>
          
          {/* Products Menu with Submenu */}
          <div className="relative">
            <a
              href="#"
              onClick={() => setShowProductMenu(!showProductMenu)}
              className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                currentPage.startsWith('product') || currentPage === 'select-type' ? 'bg-[#24303a]' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <Box size={18} />
                <span>Produits</span>
              </div>
              <span className={`transform transition-transform ${showProductMenu ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </a>
            
            {showProductMenu && (
              <div className="bg-[#24303a] py-2">
                {isAdminUser && (
                  <a
                    href="#"
                    onClick={() => setCurrentPage('select-type')}
                    className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                  >
                    + Ajouter un produit
                  </a>
                )}
                <a
                  href="#"
                  onClick={() => setCurrentPage('product-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Stock produits
                </a>
                {can('accessPricing', userRole) && (
                  <a
                    href="#"
                    onClick={() => setCurrentPage('marketplace-pricing')}
                    className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                  >
                    Gestion prix marketplace
                  </a>
                )}
                {isAdminUser && (
                  <>
                    <a
                      href="#"
                      onClick={() => setCurrentPage('stock-management')}
                      className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                    >
                      Gestion stocks multiple
                    </a>
                    <a
                      href="#"
                      onClick={() => setCurrentPage('category-management')}
                      className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                    >
                      Gestion catégorie
                    </a>
                    <a
                      href="#"
                      onClick={() => setCurrentPage('variant-management')}
                      className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                    >
                      Gestion variantes
                    </a>
                    <a
                      href="#"
                      onClick={() => setCurrentPage('shipping-boxes')}
                      className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                    >
                      Formats d'expédition
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Workshop Menu with Submenu */}
          <div className="relative">
            <a
              href="#"
              onClick={() => setShowWorkshopMenu(!showWorkshopMenu)}
              className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                currentPage.includes('atelier') ? 'bg-[#24303a]' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <Wrench size={18} />
                <span>Atelier</span>
              </div>
              <span className={`transform transition-transform ${showWorkshopMenu ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </a>
            
            {showWorkshopMenu && (
              <div className="bg-[#24303a] py-2">
                <a
                  href="#"
                  onClick={() => setCurrentPage('atelier-prise-en-charge')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Prise en charge
                </a>
              </div>
            )}
          </div>

          {/* Billing Menu with Submenu */}
          <div className="relative">
            <a
              href="#"
              onClick={() => setShowBillingMenu(!showBillingMenu)}
              className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                currentPage.includes('invoice') || currentPage.includes('quote') ||
                currentPage.includes('order') || currentPage.includes('credit-note') || currentPage.includes('document-types') ? 'bg-[#24303a]' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <DollarSign size={18} />
                <span>Facturation</span>
              </div>
              <span className={`transform transition-transform ${showBillingMenu ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </a>
            
            {showBillingMenu && (
              <div className="bg-[#24303a] py-2">
                <a
                  href="#"
                  onClick={() => setCurrentPage('invoices-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Factures
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('quotes-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Devis
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('credit-notes-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Avoirs
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('document-types')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Gestion des Typages
                </a>
              </div>
            )}
          </div>
          
          <a 
            href="#" 
            onClick={() => setCurrentPage('orders-list')}
            className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'orders-list' ? 'bg-[#24303a]' : ''}`}
          >
            <ShoppingBag size={18} />
            <span>Commandes</span>
          </a>
          <a
            href="#"
            onClick={() => setCurrentPage('customers')}
            className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'customers' ? 'bg-[#24303a]' : ''}`}
          >
            <Users size={18} />
            <span>Clients</span>
          </a>
          {can('viewConsignments', userRole) && (
            <a
              href="#"
              onClick={() => {
                console.log('[Sidebar] Navigation vers consignments');
                setCurrentPage('consignments');
              }}
              className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'consignments' ? 'bg-[#24303a]' : ''}`}
            >
              <Users size={18} />
              <span>Sous-traitants</span>
            </a>
          )}
          <a
            href="http://cloud-allcheaper.interfacelte.com/index.php/login"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a]"
          >
            <Cloud size={18} />
            <span>Cloud</span>
          </a>
          
          {/* Tools Menu with Submenu */}
          <div className="relative">
            <a
              href="#"
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                currentPage.includes('repair-calculator') ? 'bg-[#24303a]' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <Tool size={18} />
                <span>Outils</span>
              </div>
              <span className={`transform transition-transform ${showToolsMenu ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </a>
            
            {showToolsMenu && (
              <div className="bg-[#24303a] py-2">
                <a
                  href="#"
                  onClick={() => setCurrentPage('repair-calculator')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Aides Prix & Fiches Marketing
                </a>
              </div>
            )}
          </div>
          
          {/* Settings Menu with Submenu - Only for ADMIN_FULL */}
          {(() => {
            const hasAccess = can('accessSettings', userRole);
            console.log('[SIDEBAR DEBUG] Settings menu check:', {
              userRole,
              hasAccess,
              canFunction: can.toString().substring(0, 100),
              ROLES: ROLES
            });
            return hasAccess;
          })() && (
            <div className="relative">
              <a
                href="#"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                  currentPage.includes('settings') ? 'bg-[#24303a]' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Settings size={18} />
                  <span>Paramètres</span>
                </div>
                <span className={`transform transition-transform ${showSettingsMenu ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </a>
            
            {showSettingsMenu && can('accessSettings', userRole) && (
              <div className="bg-[#24303a] py-2">
                <a
                  href="#"
                  onClick={() => setCurrentPage('settings-users')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Gestion Utilisateurs
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('mail-settings')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Paramètres Email
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('invoice-settings')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Réglages Facture
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('settings-ebay')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Réglages eBay (BYO)
                </a>
              </div>
            )}
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-[#3498db] text-white shadow">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-white">Gestock Flow</h1>
                <button
                  type="button"
                  onClick={() => setIsQuickCalcOpen(prev => !prev)}
                  aria-label="Aide au calcul des prestation"
                  title="Aide au calcul des prestation"
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Calculator size={45} />
                </button>
                <div className="flex items-center gap-2">{/* Espace pour futurs outils rapides */}</div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                    className="flex items-center hover:bg-white/10 rounded-md px-2 py-1 transition-colors"
                  >
                    <Bell size={18} className="mr-2" />
                    {unreadNotifCount > 0 && (
                      <span className={`px-2 py-0.5 rounded text-sm ${
                        notifications.some(n => n.severity === 'urgent')
                          ? 'bg-red-500 text-white'
                          : 'bg-orange-500 text-white'
                      }`}>
                        {unreadNotifCount} {unreadNotifCount === 1 ? 'Notification' : 'Notifications'}
                      </span>
                    )}
                  </button>
                  {showNotificationsPanel && notifications.length > 0 && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
                      <div className="p-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                      </div>
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                  notif.severity === 'urgent' ? 'bg-red-100 text-red-800' :
                                  notif.severity === 'warning' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {notif.severity === 'urgent' ? 'Urgent' :
                                   notif.severity === 'warning' ? 'Attention' : 'Info'}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 text-sm">{notif.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                              {notif.link && (
                                <button
                                  onClick={() => {
                                    const page = notif.link.replace('/', '').replace('?', '&').split('&')[0];
                                    setCurrentPage(page || 'consignments');
                                    setShowNotificationsPanel(false);
                                  }}
                                  className="text-blue-600 text-sm mt-2 hover:underline"
                                >
                                  Voir les détails →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span>Montant du : {montantDu.toFixed(2)} €</span>
                <span>Total : {Number(metrics?.totalRevenue ?? 0).toFixed(2)} €</span>
                {userEmail && (
                  <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-white/30">
                    <div className="flex items-center space-x-2">
                      <User size={16} />
                      <span className="text-sm">{userEmail}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        console.log('[AUTH] Déconnexion en cours...');
                        try {
                          await supabase.auth.signOut();
                          console.log('[AUTH] Déconnexion réussie');
                          window.location.reload();
                        } catch (error) {
                          console.error('[AUTH] Erreur lors de la déconnexion:', error);
                        }
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-sm font-medium"
                      aria-label="Se déconnecter"
                      title="Se déconnecter"
                    >
                      <LogOut size={16} />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>

        {isQuickCalcOpen && (
          <QuickCalculator
            isOpen={isQuickCalcOpen}
            onClose={() => setIsQuickCalcOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
