import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CreditCard as Edit, Trash2, Download, ChevronDown, ChevronRight } from 'lucide-react';

interface Part {
  id: string;
  name: string;
  serviceTime: number;
  repairPrice: number;
  valuePercentage: number;
  purchasePrice: number;
}

interface Article {
  id: string;
  name: string;
  value: number;
  parts: Part[];
  selected: boolean;
  isExpanded: boolean;
}

interface RepairSettings {
  id?: string;
  fixed_charges: number;
  hourly_rate: number;
  vat_rate: number;
  profit_tax: number;
  revenue_tax: number;
}

export const RepairCalculator: React.FC = () => {
  const [globalSettings, setGlobalSettings] = useState({
    fixedCharges: 1500,
    hourlyRate: 50,
    vatRate: 20,
    profitTax: 30,
    revenueTax: 12.8,
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      setSettingsError(null);
      try {
        const { data, error } = await supabase.from('repair_settings').select('*').maybeSingle();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found, which is fine
        if (data) {
          setGlobalSettings({
            fixedCharges: data.fixed_charges,
            hourlyRate: data.hourly_rate,
            vatRate: data.vat_rate,
            profitTax: data.profit_tax,
            revenueTax: data.revenue_tax
          });
          setSettingsId(data.id);
        }
      } catch (err) {
        console.error('Error loading repair settings:', err);
        setSettingsError(err instanceof Error ? err.message : 'Erreur lors du chargement des paramètres');
      }
    };
    loadSettings();
  }, []);

  const saveGlobalSettings = async () => {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const settingsToSave: Omit<RepairSettings, 'id'> = {
        fixed_charges: globalSettings.fixedCharges,
        hourly_rate: globalSettings.hourlyRate,
        vat_rate: globalSettings.vatRate,
        profit_tax: globalSettings.profitTax,
        revenue_tax: globalSettings.revenueTax,
      };

      if (settingsId) {
        const { error } = await supabase
          .from('repair_settings')
          .update(settingsToSave)
          .eq('id', settingsId);
        if (error) throw error;
        console.log('Repair settings updated successfully.');
      } else {
        const { data, error } = await supabase
          .from('repair_settings')
          .insert([settingsToSave])
          .select('id')
          .single();
        if (error) throw error;
        setSettingsId(data.id);
        console.log('Repair settings inserted successfully.');
      }
    } catch (err) {
      console.error('Error saving repair settings:', err);
      setSettingsError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const [articles, setArticles] = useState<Article[]>([
    {
      id: '1',
      name: 'iPhone 12',
      value: 600,
      selected: false,
      isExpanded: true,
      parts: [
        {
          id: '1-1',
          name: 'LCD générique',
          serviceTime: 30,
          repairPrice: 150,
          valuePercentage: 25,
          purchasePrice: 50
        },
        {
          id: '1-2',
          name: 'Batterie',
          serviceTime: 20,
          repairPrice: 80,
          valuePercentage: 13.33,
          purchasePrice: 30
        }
      ]
    },
    {
      id: '2',
      name: 'iPhone 15',
      value: 950,
      selected: false,
      isExpanded: true,
      parts: [
        {
          id: '2-1',
          name: 'Batterie',
          serviceTime: 25,
          repairPrice: 110,
          valuePercentage: 11.58,
          purchasePrice: 45
        }
      ]
    }
  ]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validatePart = (part: Part, articleValue: number): string | null => {
    if (!part.purchasePrice || part.purchasePrice <= 0) {
      return "⚠️ Entrez un prix d'achat pour calculer la marge";
    }
    if (!part.repairPrice || part.repairPrice <= 0) {
      return "⚠️ Entrez un prix de réparation pour calculer la marge";
    }
    if (!articleValue || articleValue <= 0) {
      return "⚠️ Entrez une valeur du produit pour calculer la marge";
    }
    return null;
  };

  const calculateServicePrice = (serviceTime: number): number => {
    return (serviceTime / 60) * globalSettings.hourlyRate;
  };

  const calculateMargins = (part: Part, articleValue: number) => {
    const validationError = validatePart(part, articleValue);
    if (validationError) {
      return {
        grossMarginEur: 0,
        grossMarginPct: 0,
        netMarginEur: 0,
        netMarginPct: 0,
        validationError
      };
    }

    const servicePrice = calculateServicePrice(part.serviceTime);
    const grossMargin = part.repairPrice - part.purchasePrice;
    const grossMarginPct = (grossMargin / part.repairPrice) * 100;
    
    const repairPriceExclVat = part.repairPrice / (1 + (globalSettings.vatRate / 100));
    
    let netMargin;
    // Calculate profit before any taxes or fixed charges.
    // NOTE: This implementation subtracts the *entire* global fixedCharges from *each part's* net margin.
    // If fixedCharges is a monthly total, this will lead to a significant overestimation of costs for individual parts.
    // A more accurate approach for per-part calculation would involve amortizing fixedCharges
    // over an estimated number of repairs/parts per period, which is not available in this function's scope.
    const profitBeforeTax = repairPriceExclVat - part.purchasePrice - servicePrice - globalSettings.fixedCharges;

    if (globalSettings.revenueTax > 0) {
      // Micro-enterprise logic: revenue tax is applied on the repair price (excl. VAT)
      const revenueTaxAmount = repairPriceExclVat * (globalSettings.revenueTax / 100);
      netMargin = profitBeforeTax - revenueTaxAmount;
    } else {
      // Standard profit tax logic: profit tax is applied on the profit before tax
      const taxAmount = profitBeforeTax > 0 ? profitBeforeTax * (globalSettings.profitTax / 100) : 0;
      netMargin = profitBeforeTax - taxAmount;
    }

    const netMarginPct = part.repairPrice > 0 ? (netMargin / part.repairPrice) * 100 : 0;


    return {
      grossMarginEur: grossMargin,
      grossMarginPct,
      netMarginEur: netMargin,
      netMarginPct,
      validationError: null
    };
  };

  const handleGlobalSettingChange = (field: keyof typeof globalSettings, value: number) => {
    setGlobalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleArticleChange = (articleId: string, field: keyof Article, value: any) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId ? { ...article, [field]: value } : article
    ));
  };

  const handlePartChange = (articleId: string, partId: string, field: keyof Part, value: any) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? {
            ...article,
            parts: article.parts.map(part => 
              part.id === partId ? { ...part, [field]: value } : part
            )
          }
        : article
    ));

    // Update validation errors
    const article = articles.find(a => a.id === articleId);
    const part = article?.parts.find(p => p.id === partId);
    if (article && part) {
      const updatedPart = { ...part, [field]: value };
      const error = validatePart(updatedPart, article.value);
      setValidationErrors(prev => ({
        ...prev,
        [`${articleId}-${partId}`]: error || ''
      }));
    }
  };

  const handleRepairPriceChange = (articleId: string, partId: string, value: number) => {
    const article = articles.find(a => a.id === articleId);
    if (article && article.value > 0) {
      const valuePercentage = (value / article.value) * 100;
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? {
              ...a,
              parts: a.parts.map(p => 
                p.id === partId 
                  ? { ...p, repairPrice: value, valuePercentage }
                  : p
              )
            }
          : a
      ));
    } else {
      handlePartChange(articleId, partId, 'repairPrice', value);
    }
  };

  const handleValuePercentageChange = (articleId: string, partId: string, value: number) => {
    const article = articles.find(a => a.id === articleId);
    if (article && article.value > 0) {
      const repairPrice = (value / 100) * article.value;
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? {
              ...a,
              parts: a.parts.map(p => 
                p.id === partId 
                  ? { ...p, valuePercentage: value, repairPrice }
                  : p
              )
            }
          : a
      ));
    } else {
      handlePartChange(articleId, partId, 'valuePercentage', value);
    }
  };

  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      name: '',
      value: 0,
      selected: false,
      isExpanded: true,
      parts: []
    };
    setArticles(prev => [...prev, newArticle]);
  };

  const deleteArticle = (articleId: string) => {
    setArticles(prev => prev.filter(article => article.id !== articleId));
  };

  const addPart = (articleId: string) => {
    const newPart: Part = {
      id: `${articleId}-${Date.now()}`,
      name: '',
      serviceTime: 0,
      repairPrice: 0,
      valuePercentage: 0,
      purchasePrice: 0
    };
    
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, parts: [...article.parts, newPart] }
        : article
    ));
  };

  const deletePart = (articleId: string, partId: string) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, parts: article.parts.filter(part => part.id !== partId) }
        : article
    ));
    
    // Remove validation error
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${articleId}-${partId}`];
      return newErrors;
    });
  };

  const toggleArticleExpansion = (articleId: string) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, isExpanded: !article.isExpanded }
        : article
    ));
  };
  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-blue-700 bg-yellow-100 p-4 rounded-lg shadow-lg border-b-4 border-blue-500">
          Aide calcul Prix Prestation & Fiches Marketing
        </h1>
      </header>

      {/* Global Settings */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Paramètres globaux</h2>
          <button
            onClick={saveGlobalSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isSavingSettings}
          >
            {isSavingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </button>
        </div>
        {settingsError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Erreur!</strong>
            <span className="block sm:inline"> {settingsError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="flex items-center space-x-3">
            <span className="text-gray-500">Charges fixes (€)</span>
            <div>
              <label className="block text-sm font-medium text-gray-500" htmlFor="fixed-charges">
                Montant
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                id="fixed-charges"
                type="number"
                value={globalSettings.fixedCharges}
                onChange={(e) => handleGlobalSettingChange('fixedCharges', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-gray-500">Taux horaire main-d'œuvre (€ / h)</span>
            <div>
              <label className="block text-sm font-medium text-gray-500" htmlFor="hourly-rate">
                Montant
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                id="hourly-rate"
                type="number"
                value={globalSettings.hourlyRate}
                onChange={(e) => handleGlobalSettingChange('hourlyRate', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-gray-500">Taux de TVA (%)</span>
            <div>
              <label className="block text-sm font-medium text-gray-500" htmlFor="vat-rate">
                Pourcentage
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                id="vat-rate"
                type="number"
                value={globalSettings.vatRate}
                onChange={(e) => handleGlobalSettingChange('vatRate', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-gray-500">Impôt sur bénéfice (%)</span>
            <div>
              <label className="block text-sm font-medium text-gray-500" htmlFor="profit-tax">
                Pourcentage
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                id="profit-tax"
                type="number"
                value={globalSettings.profitTax}
                onChange={(e) => handleGlobalSettingChange('profitTax', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-gray-500">Taxe sur CA (Micro ent.) (%)</span>
            <div>
              <label className="block text-sm font-medium text-gray-500" htmlFor="revenue-tax">
                Pourcentage
              </label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                id="revenue-tax"
                type="number"
                value={globalSettings.revenueTax}
                onChange={(e) => handleGlobalSettingChange('revenueTax', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </div>

      <main className="flex flex-col h-full">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="relative inline-block text-left">
            <div>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-indigo-700"
                type="button"
              >
                Exporter la sélection
                <ChevronDown className="h-5 w-5 text-gray-200" />
              </button>
            </div>
            
            {showExportMenu && (
              <div className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <button className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    PDF
                  </button>
                  <button className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    JPEG
                  </button>
                  <button className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Excel
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={addArticle}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="mr-2 -ml-1 h-4 w-4" />
            Ajouter un article
          </button>
        </div>

        {/* Articles Container */}
        <div className="overflow-y-auto h-[70vh] space-y-8 pr-2">
          {articles.map((article) => (
            <div key={article.id} className="bg-white p-6 rounded-lg shadow-md flex items-start space-x-4">
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
                  checked={article.selected}
                  onChange={(e) => handleArticleChange(article.id, 'selected', e.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => toggleArticleExpansion(article.id)}
                  className="p-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                >
                  {article.isExpanded ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
              </div>
              
              <div className="flex-grow">
                {/* Article Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Nom du produit
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          value={article.name}
                          onChange={(e) => handleArticleChange(article.id, 'name', e.target.value)}
                          placeholder="Ex: iPhone 12"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Valeur du produit (€)
                      </label>
                      <input
                        type="number"
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={article.value}
                        onChange={(e) => handleArticleChange(article.id, 'value', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button className="p-2 text-gray-500 hover:text-blue-600">
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteArticle(article.id)}
                      className="p-2 text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Parts Section */}
                {article.isExpanded && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Pièces</h3>
                      <button
                        onClick={() => addPart(article.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Ajouter une pièce à cet article
                      </button>
                    </div>

                  <div className="space-y-4">
                    {article.parts.map((part) => {
                      const margins = calculateMargins(part, article.value);
                      const servicePrice = calculateServicePrice(part.serviceTime);
                      const errorKey = `${article.id}-${part.id}`;
                      const hasError = validationErrors[errorKey];

                      return (
                        <div key={part.id} className="p-4 rounded-md bg-gray-100">
                          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-9 gap-4 items-end">
                            {/* Nom de la pièce */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-500">
                                Nom de la pièce
                              </label>
                              <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={part.name}
                                onChange={(e) => handlePartChange(article.id, part.id, 'name', e.target.value)}
                                placeholder="Ex: Batterie"
                              />
                            </div>

                            {/* Temps total */}
                            <div>
                              <label className="block text-sm font-medium text-gray-500">
                                Temps total (min)
                              </label>
                              <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={part.serviceTime}
                                onChange={(e) => handlePartChange(article.id, part.id, 'serviceTime', parseFloat(e.target.value) || 0)}
                              />
                            </div>

                            {/* Prix M.O. */}
                            <div>
                              <label className="block text-sm font-medium text-gray-500">
                                Prix M.O. (€)
                              </label>
                              <div className="mt-1 p-2 rounded-md bg-white border border-gray-300 text-sm">
                                {servicePrice.toFixed(2)}€
                              </div>
                            </div>

                            {/* Prix réparation */}
                            <div className="col-span-1">
                              <label className="block text-sm font-medium text-gray-500">
                                Prix réparation (€)
                              </label>
                              <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={part.repairPrice}
                                onChange={(e) => handleRepairPriceChange(article.id, part.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>

                            {/* % de la valeur produit */}
                            <div className="col-span-1">
                              <label className="block text-sm font-medium text-gray-500">
                                % de la valeur produit
                              </label>
                              <div className="flex items-center mt-1">
                                <input
                                  type="number"
                                  className="block w-full rounded-l-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  value={part.valuePercentage.toFixed(2)}
                                  onChange={(e) => handleValuePercentageChange(article.id, part.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="inline-flex items-center px-2 py-2 rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-500 text-sm">
                                  %
                                </span>
                              </div>
                            </div>

                            {/* Prix d'achat pièce */}
                            <div>
                              <label className="block text-sm font-medium text-gray-500">
                                Prix d'achat pièce (€)
                              </label>
                              <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                value={part.purchasePrice}
                                onChange={(e) => handlePartChange(article.id, part.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>

                            {/* Marge brute */}
                            <div className="col-span-1">
                              <label className="block text-sm font-medium text-gray-500">
                                Marge brute (€)
                              </label>
                              <div className="flex items-center mt-1">
                                <div className="w-full p-2 rounded-l-md bg-white border border-r-0 border-gray-300 text-sm">
                                  {margins.grossMarginEur.toFixed(2)}€
                                </div>
                                <div className="p-2 rounded-r-md bg-white border border-l-0 border-gray-300 text-sm">
                                  {margins.grossMarginPct.toFixed(2)}%
                                </div>
                              </div>
                            </div>

                            {/* Marge nette */}
                            <div className="col-span-1">
                              <label className="block text-sm font-medium text-gray-500">
                                Marge nette (€)
                              </label>
                              <div className="flex items-center mt-1">
                                <div className="w-full p-2 rounded-l-md bg-white border border-r-0 border-gray-300 text-sm">
                                  {margins.netMarginEur.toFixed(2)}€
                                </div>
                                <div className="p-2 rounded-r-md bg-white border border-l-0 border-gray-300 text-sm">
                                  {margins.netMarginPct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Validation Error */}
                          {margins.validationError && (
                            <div className="mt-2 text-sm text-red-600">
                              {margins.validationError}
                            </div>
                          )}

                          {/* Delete Part Button */}
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => deletePart(article.id, part.id)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};