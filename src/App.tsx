import React, { useEffect, useState } from 'react';
import { Package, Bell, DollarSign, Settings, Users, ShoppingBag, Cloud, PenTool as Tool, Box, Layers } from 'lucide-react';
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
// Import des composants de gestion des clients
import { Customers } from './pages/Customers';
// Import des composants de paramètres
import { MailSettingsPage } from './components/Billing/MailSettingsPage';
import { InvoiceSettings } from './components/Billing/InvoiceSettings';

function App() {
  const { metrics, isLoading, error, fetchMetrics } = useSalesStore();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [showBillingMenu, setShowBillingMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminStatus = await isAdmin();
      setIsAdminUser(adminStatus);
    };
    checkAdminStatus();
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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">Erreur: {error}</div>;
  }

  const renderContent = () => {
    const content = (() => {
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
          return <OrderList />;
        case 'orders-new':
          return <OrderForm />;
        case 'orders-edit':
          return <OrderForm orderId={sessionStorage.getItem('editOrderId') || undefined} />;
        case 'credit-notes-list':
          return <CreditNoteList />;
        case 'credit-notes-new':
          return <CreditNoteForm />;
        case 'credit-notes-edit':
          return <CreditNoteForm creditNoteId={sessionStorage.getItem('editCreditNoteId') || undefined} />;
        // Ajout de la route pour la gestion des clients
        case 'customers':
          return <Customers />;
        // Ajout des routes pour les paramètres
        case 'mail-settings':
          return <MailSettingsPage />;
        case 'invoice-settings':
          return <InvoiceSettings />;
        default:
          return (
            <main className="container mx-auto px-4 py-6">
              {/* Dashboard content */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-[#00bcd4] text-white p-6 rounded-lg">
                  <h3 className="text-lg mb-2">Commandes</h3>
                  <p className="text-3xl font-bold">{metrics.totalOrders}</p>
                  <button className="mt-4 text-sm hover:underline">Traiter les commandes →</button>
                </div>
                <div className="bg-[#e74c3c] text-white p-6 rounded-lg">
                  <h3 className="text-lg mb-2">Produits synchronisés</h3>
                  <p className="text-3xl font-bold">{metrics.syncedProducts}</p>
                  <button className="mt-4 text-sm hover:underline">Voir les produits →</button>
                </div>
                <div className="bg-[#2ecc71] text-white p-6 rounded-lg">
                  <h3 className="text-lg mb-2">CA Mensuel</h3>
                  <p className="text-3xl font-bold">{metrics.monthlyRevenue.toFixed(2)}€</p>
                  <button className="mt-4 text-sm hover:underline">Voir les factures →</button>
                </div>
                <div className="bg-[#f39c12] text-white p-6 rounded-lg">
                  <h3 className="text-lg mb-2">Estimation Bénéfice Mensuel</h3>
                  <p className="text-3xl font-bold">{metrics.estimatedProfit.toFixed(2)}€</p>
                  <button className="mt-4 text-sm hover:underline">Statistiques →</button>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Objectif global Marge Brut : {metrics.monthlyTarget.toFixed(2)}€</h2>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-[#f39c12] text-white p-6 rounded-lg">
                    <h3 className="text-xl mb-2">Obj. Jour</h3>
                    <p className="text-3xl font-bold">{metrics.dailyTarget.toFixed(2)}€</p>
                  </div>
                  <div className="bg-[#f39c12] text-white p-6 rounded-lg">
                    <h3 className="text-xl mb-2">Obj. Semaine</h3>
                    <p className="text-3xl font-bold">{metrics.weeklyTarget.toFixed(2)}€</p>
                  </div>
                  <div className="bg-[#f39c12] text-white p-6 rounded-lg">
                    <h3 className="text-xl mb-2">Obj. Mois</h3>
                    <p className="text-3xl font-bold">{metrics.monthlyTarget.toFixed(2)}€</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-[#00bcd4] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Encaisse Jour</h3>
                  <p className="text-3xl font-bold">{metrics.dailyRevenue.toFixed(2)}€</p>
                </div>
                <div className="bg-[#00bcd4] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Encaisse Semaine</h3>
                  <p className="text-3xl font-bold">{metrics.weeklyRevenue.toFixed(2)}€</p>
                </div>
                <div className="bg-[#00bcd4] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Encaisse Mois</h3>
                  <p className="text-3xl font-bold">{metrics.monthlyRevenue.toFixed(2)}€</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="bg-[#e74c3c] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Reste à faire</h3>
                  <p className="text-3xl font-bold">{metrics.remainingDaily.toFixed(2)}€</p>
                </div>
                <div className="bg-[#e74c3c] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Reste à faire</h3>
                  <p className="text-3xl font-bold">{metrics.remainingWeekly.toFixed(2)}€</p>
                </div>
                <div className="bg-[#e74c3c] text-white p-6 rounded-lg">
                  <h3 className="text-xl mb-2">Reste à faire</h3>
                  <p className="text-3xl font-bold">{metrics.remainingMonthly.toFixed(2)}€</p>
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
      <aside className="w-64 bg-[#2d3741] text-white h-screen overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">A</span>
            </div>
            <span className="font-medium">swuidy</span>
          </div>
          
          <SearchBar />
        </div>

        <nav className="mt-4">
          <div className="px-4 py-2 text-gray-400 text-xs uppercase">Navigation</div>
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
          
          {/* Billing Menu with Submenu */}
          <div className="relative">
            <a
              href="#"
              onClick={() => setShowBillingMenu(!showBillingMenu)}
              className={`px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-[#24303a] ${
                currentPage.includes('invoice') || currentPage.includes('quote') || 
                currentPage.includes('order') || currentPage.includes('credit-note') ? 'bg-[#24303a]' : ''
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
                  onClick={() => setCurrentPage('quotes-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Devis
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('orders-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Commandes
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('invoices-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Factures
                </a>
                <a
                  href="#"
                  onClick={() => setCurrentPage('credit-notes-list')}
                  className="px-8 py-2 flex items-center text-gray-300 hover:bg-[#1a242d]"
                >
                  Avoirs
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
            onClick={() => setCurrentPage('invoices-list')}
            className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'invoices-list' ? 'bg-[#24303a]' : ''}`}
          >
            <DollarSign size={18} />
            <span>Factures</span>
          </a>
          <a 
            href="#" 
            onClick={() => setCurrentPage('customers')}
            className={`px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a] ${currentPage === 'customers' ? 'bg-[#24303a]' : ''}`}
          >
            <Users size={18} />
            <span>Clients</span>
          </a>
          <a 
            href="http://cloud-allcheaper.interfacelte.com/index.php/login" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a]"
          >
            <Cloud size={18} />
            <span>Cloud</span>
          </a>
          <a href="#" className="px-4 py-2 flex items-center space-x-3 text-gray-300 hover:bg-[#24303a]">
            <Tool size={18} />
            <span>Outils</span>
          </a>
          
          {/* Settings Menu with Submenu */}
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
            
            {showSettingsMenu && (
              <div className="bg-[#24303a] py-2">
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
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-[#3498db] text-white shadow">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">InterfaceV2</h1>
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <Bell size={18} className="mr-2" />
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded text-sm">1 Urgence</span>
                </span>
                <span>Montant du : 0.00 €</span>
                <span>Total : {metrics.monthlyTurnover.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
