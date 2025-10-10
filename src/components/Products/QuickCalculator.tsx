import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface QuickCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

type CalculationRecord = {
  id: string;
  user_id?: string | null;
  nom: string;
  prix_final: number;
  marge_nette: number;
  marge_nette_pct: number;
  cotisation: number;
  statut_fiscal: string;
  date_creation: string;
  input_payload?: any;
};

export const QuickCalculator: React.FC<QuickCalculatorProps> = ({ isOpen, onClose }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const calculatorRef = useRef<HTMLDivElement>(null);

  // Paramètres généraux avec lazy initialization depuis localStorage
  const [taxStatus, setTaxStatus] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.taxStatus !== undefined ? parsed.taxStatus : 'societe';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return 'societe';
  });

  const [taxRateIS, setTaxRateIS] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.taxRateIS !== undefined ? parsed.taxRateIS : '25';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return '25';
  });

  const [cotisationMicro, setCotisationMicro] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.cotisationMicro !== undefined ? parsed.cotisationMicro : '12.8';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return '12.8';
  });

  const [hourlyRate, setHourlyRate] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.hourlyRate !== undefined ? parsed.hourlyRate : '';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return '';
  });

  const [minMargin, setMinMargin] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.minMargin !== undefined ? parsed.minMargin : '';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return '';
  });

  const [vatRate, setVatRate] = useState(() => {
    const saved = localStorage.getItem('quickCalculatorSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.vatRate !== undefined ? parsed.vatRate : '';
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
    return '';
  });

  // Champs de saisie
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePriceError, setPurchasePriceError] = useState(false);
  const [repairTime, setRepairTime] = useState('');
  const [additionalFees, setAdditionalFees] = useState('');
  const [desiredMarginPercentage, setDesiredMarginPercentage] = useState('');
  const [desiredMarginEuro, setDesiredMarginEuro] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  // Source de saisie prioritaire: 'percent' | 'euro' | 'price' | null
  const [lastEdited, setLastEdited] = useState<'percent' | 'euro' | 'price' | null>(null);

  // Sections repliables
  const [inputOpen, setInputOpen] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);

  // Enregistrement / historique
  const [calculationName, setCalculationName] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [history, setHistory] = useState<CalculationRecord[]>([]);
  // Calcul chargé et état de modification
  const [loadedCalcId, setLoadedCalcId] = useState<string | null>(null);
  const [loadedCalcName, setLoadedCalcName] = useState<string>('');
  const [loadedCalcDate, setLoadedCalcDate] = useState<string>('');
  const [isModified, setIsModified] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const loadingFromRecord = React.useRef(false);

  console.log('QuickCalculator - Current state:', {
    purchasePrice,
    desiredMarginPercentage,
    desiredMarginEuro,
    sellingPrice
  });

  useEffect(() => {
    const savedPosition = localStorage.getItem('quickCalculatorPosition');
    if (savedPosition) {
      const parsed = JSON.parse(savedPosition);
      setPosition(parsed);
    } else {
      const defaultX = window.innerWidth - 450;
      const defaultY = 16;
      setPosition({ x: defaultX, y: defaultY });
    }

    const savedSettings = localStorage.getItem('quickCalculatorSettings');
    if (savedSettings) {
      console.log('✅ Paramètres généraux restaurés depuis localStorage');
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const calculatorWidth = calculatorRef.current?.offsetWidth || 400;
      const calculatorHeight = calculatorRef.current?.offsetHeight || 600;

      const constrainedX = Math.max(0, Math.min(newX, window.innerWidth - calculatorWidth));
      const constrainedY = Math.max(0, Math.min(newY, window.innerHeight - calculatorHeight));

      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('quickCalculatorPosition', JSON.stringify(position));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (calculatorRef.current) {
      const rect = calculatorRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setDragOffset({ x: offsetX, y: offsetY });
      setIsDragging(true);
    }
  };

  const handleClose = () => {
    localStorage.removeItem('quickCalculatorPosition');
    onClose();
  };

  // Fonction pour calculer la marge € à partir de la marge %
  const calculateMarginEuroFromPercent = (purchasePriceVal: number, percentVal: number): number => {
    console.log('calculateMarginEuroFromPercent called with:', { purchasePriceVal, percentVal });
    const result = (purchasePriceVal * percentVal) / 100;
    console.log('calculateMarginEuroFromPercent result:', result);
    return result;
  };

  // Fonction pour calculer la marge % à partir de la marge €
  const calculateMarginPercentFromEuro = (purchasePriceVal: number, euroVal: number): number => {
    console.log('calculateMarginPercentFromEuro called with:', { purchasePriceVal, euroVal });
    if (purchasePriceVal === 0) return 0;
    const result = (euroVal / purchasePriceVal) * 100;
    console.log('calculateMarginPercentFromEuro result:', result);
    return result;
  };

  // Fonction pour calculer les résultats selon la source (lastEdited)
  const calculateRecommendedPrice = (): {
    ht: number;
    ttc: number;
    totalCost: number;
    netMargin: number;
    netMarginPct: number;
    taxAmount: number;
  } => {
    const prixAchat = parseFloat(purchasePrice) || 0;
    const time = parseFloat(repairTime) || 0;
    const frais = parseFloat(additionalFees) || 0;
    const rate = parseFloat(hourlyRate) || 0;
    const vat = parseFloat(vatRate) || 20;
    const margeEuro = parseFloat(desiredMarginEuro) || 0;
    const margePctInput = parseFloat(desiredMarginPercentage) || 0;
    const prixSaisi = parseFloat(sellingPrice) || 0;

    // MO et base de coût
    const mainOeuvre = (time / 60) * rate;
    const baseCost = prixAchat + mainOeuvre + frais;

    const cotRate = taxStatus === 'micro' ? (parseFloat(cotisationMicro) || 0) : 0;

    // Helpers de prix selon la source
    const priceFromEuro = () => {
      const raw = taxStatus === 'micro'
        ? (baseCost + (margeEuro || 0)) / (1 - (cotRate / 100))
        : baseCost + (margeEuro || 0);
      return Math.ceil(raw);
    };

    const priceFromPercent = () => {
      const raw = taxStatus === 'micro'
        ? baseCost / (1 - ((cotRate + (margePctInput || 0)) / 100))
        : baseCost / (1 - ((margePctInput || 0) / 100));
      return Math.ceil(raw);
    };

    // Déterminer le prix effectif utilisé pour le calcul final
    let price = 0;
    if (lastEdited === 'price' && prixSaisi > 0) {
      price = Math.ceil(prixSaisi);
    } else if (lastEdited === 'percent' && (margePctInput || 0) > 0) {
      price = priceFromPercent();
    } else if ((margeEuro || 0) > 0) {
      price = priceFromEuro();
    } else {
      // Pas de marge ni prix → au minimum couvrir les coûts
      price = Math.ceil(baseCost > 0 ? baseCost / (1 - (cotRate / 100 || 0)) : 0);
    }

    // Cotisations / impôts intégrés dans le coût (micro seulement)
    const cotisations = taxStatus === 'micro' ? (price * (cotRate / 100)) : 0;

    const totalCost = baseCost + cotisations;
    const netMargin = price - totalCost;
    const netMarginPct = price > 0 ? (netMargin / price) * 100 : 0;

    // Prix TTC (informative pour société)
    const ttc = taxStatus === 'societe' ? price * (1 + vat / 100) : price;

    return {
      ht: price,
      ttc,
      totalCost,
      netMargin,
      netMarginPct,
      taxAmount: cotisations
    };
  };

  // Calculer les résultats
  const results = calculateRecommendedPrice();
  const minMarginValue = parseFloat(minMargin) || 0;
  const isBelowMin = results.netMarginPct < minMarginValue;
  const filteredHistory = React.useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const arr = [...history].sort(
      (a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime()
    );
    if (!q) return arr;
    return arr.filter((h) => (h.nom || '').toLowerCase().includes(q));
  }, [history, historySearch]);

  useEffect(() => {
    const settings = {
      taxStatus,
      taxRateIS,
      cotisationMicro,
      hourlyRate,
      minMargin,
      vatRate
    };
    localStorage.setItem('quickCalculatorSettings', JSON.stringify(settings));
  }, [taxStatus, taxRateIS, cotisationMicro, hourlyRate, minMargin, vatRate]);

  const handleSaveSettings = () => {
    console.log('Settings saved (manual trigger for feedback)');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSettingsOpen(false);
    }, 2000);
  };

  const handleMarginEuroChange = (value: string) => {
    // Arrondir à l'unité et définir comme source
    const numValue = parseFloat(value);
    const rounded = isNaN(numValue) ? '' : Math.round(numValue).toString();
    setDesiredMarginEuro(isNaN(numValue) ? value : rounded);
    setLastEdited('euro');

    // Synchroniser la marge % à partir de la marge €
    const prixAchat = parseFloat(purchasePrice) || 0;
    const time = parseFloat(repairTime) || 0;
    const frais = parseFloat(additionalFees) || 0;
    const rate = parseFloat(hourlyRate) || 0;
    const mainOeuvre = (time / 60) * rate;
    const baseCost = prixAchat + mainOeuvre + frais;
    const cotRate = taxStatus === 'micro' ? (parseFloat(cotisationMicro) || 0) : 0;

    let price = 0;
    if (!isNaN(numValue)) {
      if (taxStatus === 'micro') {
        price = Math.ceil((baseCost + numValue) / (1 - (cotRate / 100)));
      } else {
        price = Math.ceil(baseCost + numValue);
      }
      const cotisations = taxStatus === 'micro' ? price * (cotRate / 100) : 0;
      const netMargin = price - (baseCost + cotisations);
      const pct = price > 0 ? (netMargin / price) * 100 : 0;
      setDesiredMarginPercentage(pct.toFixed(0));
    }
  };

  // Utils & persistance
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR');
    } catch {
      return iso;
    }
  };

  const loadHistory = async () => {
    // Tenter Supabase puis fallback stockage local
    try {
      const { data, error } = await supabase
        .from('repair_calculations')
        .select('id,user_id,nom,prix_final,marge_nette,marge_nette_pct,cotisation,statut_fiscal,date_creation,input_payload')
        .order('date_creation', { ascending: false });
      if (!error && data) {
        setHistory((data as any) as CalculationRecord[]);
        return;
      }
    } catch (e) {
      console.warn('Supabase loadHistory failed, using localStorage:', e);
    }
    const local = JSON.parse(localStorage.getItem('quickCalculatorHistory') || '[]');
    setHistory(local);
  };

  // Marquer la modification si un calcul chargé est actif
  useEffect(() => {
    if (loadedCalcId && !loadingFromRecord.current) {
      setIsModified(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasePrice, repairTime, additionalFees, desiredMarginPercentage, desiredMarginEuro, sellingPrice, hourlyRate, vatRate, cotisationMicro, taxStatus, minMargin]);

  const handleSaveCalculation = async () => {
    const name = (calculationName || '').trim();
    const r = calculateRecommendedPrice();
    const inputPayload = {
      purchasePrice,
      repairTime,
      additionalFees,
      hourlyRate,
      vatRate,
      cotisationMicro,
      desiredMarginEuro,
      desiredMarginPercentage,
      sellingPrice,
      taxStatus,
      minMargin
    };
    const insertPayload: Omit<CalculationRecord, 'id'> & { input_payload?: any } = {
      user_id: null,
      nom: name || `Calcul ${new Date().toLocaleString('fr-FR')}`,
      prix_final: r.ht,
      marge_nette: r.netMargin,
      marge_nette_pct: r.netMarginPct,
      cotisation: r.taxAmount,
      statut_fiscal: taxStatus,
      date_creation: new Date().toISOString(),
      input_payload: inputPayload
    };

    // Tentative Supabase
    try {
      let userId: string | null = null;
      try {
        const auth = await (supabase as any).auth?.getUser?.();
        userId = auth?.data?.user?.id ?? null;
      } catch {
        // ignore
      }
      const { data, error } = await supabase
        .from('repair_calculations')
        .insert([{ ...insertPayload, user_id: userId }] as any)
        .select('*')
        .single();

      if (!error && data) {
        setCalculationName('');
        await loadHistory();
        return;
      }
    } catch (e) {
      console.warn('Supabase save failed, fallback to localStorage:', e);
    }

    // Fallback localStorage
    const localArr: CalculationRecord[] = JSON.parse(localStorage.getItem('quickCalculatorHistory') || '[]');
    const id = (globalThis as any)?.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const localRec: CalculationRecord = { id, ...(insertPayload as any) };
    localArr.unshift(localRec);
    localStorage.setItem('quickCalculatorHistory', JSON.stringify(localArr));
    setCalculationName('');
    setHistory(localArr);
  };

  const handleUpdateCalculation = async () => {
    if (!loadedCalcId) return;
    const r = calculateRecommendedPrice();
    const inputPayload = {
      purchasePrice,
      repairTime,
      additionalFees,
      hourlyRate,
      vatRate,
      cotisationMicro,
      desiredMarginEuro,
      desiredMarginPercentage,
      sellingPrice,
      taxStatus,
      minMargin
    };

    // Supabase update
    let updated = false;
    try {
      const { error } = await supabase
        .from('repair_calculations')
        .update({
          prix_final: r.ht,
          marge_nette: r.netMargin,
          marge_nette_pct: r.netMarginPct,
          cotisation: r.taxAmount,
          statut_fiscal: taxStatus,
          date_creation: new Date().toISOString(),
          input_payload: inputPayload,
          nom: loadedCalcName || `Calcul ${new Date().toLocaleString('fr-FR')}`
        } as any)
        .eq('id', loadedCalcId as any);
      if (!error) updated = true;
    } catch {
      updated = false;
    }

    if (!updated) {
      // Fallback localStorage
      const localArr: CalculationRecord[] = JSON.parse(localStorage.getItem('quickCalculatorHistory') || '[]');
      const idx = localArr.findIndex((r) => r.id === loadedCalcId);
      if (idx !== -1) {
        localArr[idx] = {
          ...localArr[idx],
          prix_final: r.ht,
          marge_nette: r.netMargin,
          marge_nette_pct: r.netMarginPct,
          cotisation: r.taxAmount,
          statut_fiscal: taxStatus,
          date_creation: new Date().toISOString(),
          input_payload: inputPayload,
          nom: loadedCalcName || localArr[idx].nom
        };
        localStorage.setItem('quickCalculatorHistory', JSON.stringify(localArr));
      }
    }

    setIsModified(false);
    setUpdateSuccess(true);
    setTimeout(() => setUpdateSuccess(false), 2000);
    await loadHistory();
  };

  const handleSaveAsNew = async () => {
    await handleSaveCalculation();
  };

  const deleteCalculation = async (id: string) => {
    try {
      const { error } = await supabase.from('repair_calculations').delete().eq('id', id as any);
      if (!error) {
        await loadHistory();
        return;
      }
    } catch (e) {
      console.warn('Supabase delete failed, fallback to localStorage:', e);
    }
    const localArr: CalculationRecord[] = JSON.parse(localStorage.getItem('quickCalculatorHistory') || '[]');
    const next = localArr.filter((r) => r.id !== id);
    localStorage.setItem('quickCalculatorHistory', JSON.stringify(next));
    setHistory(next);
  };

  const applyCalculation = (rec: CalculationRecord) => {
    const p = rec.input_payload || {};
    loadingFromRecord.current = true;
    setLoadedCalcId(rec.id);
    setLoadedCalcName(rec.nom || '');
    setLoadedCalcDate(rec.date_creation || new Date().toISOString());
    setInputOpen(true);
    setIsModified(false);
    setUpdateSuccess(false);

    setPurchasePrice(String(p.purchasePrice ?? ''));
    setRepairTime(String(p.repairTime ?? ''));
    setAdditionalFees(String(p.additionalFees ?? ''));
    setHourlyRate(String(p.hourlyRate ?? hourlyRate));
    setVatRate(String(p.vatRate ?? vatRate));
    setCotisationMicro(String(p.cotisationMicro ?? cotisationMicro));
    setDesiredMarginEuro(String(p.desiredMarginEuro ?? ''));
    setDesiredMarginPercentage(String(p.desiredMarginPercentage ?? ''));
    setSellingPrice(String(p.sellingPrice ?? rec.prix_final ?? ''));
    setTaxStatus(String(p.taxStatus ?? taxStatus));
    setMinMargin(String(p.minMargin ?? minMargin));
    setLastEdited('price');

    // Relâcher le drapeau après flush
    setTimeout(() => {
      loadingFromRecord.current = false;
    }, 0);
  };

  useEffect(() => {
    // Charger l'historique au montage
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={calculatorRef}
      className="fixed z-[9999] w-full max-w-md"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div className="rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl shadow-slate-900/10">
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200/50 dark:border-gray-700/50 p-4 bg-white/80 dark:bg-gray-900/85 backdrop-blur-xl rounded-t-xl cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-black dark:text-white" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
              <rect height="18" rx="2" width="14" x="5" y="3"></rect>
              <line x1="8" x2="16" y1="7" y2="7"></line>
              <line x1="8" x2="16" y1="12" y2="12"></line>
              <line x1="8" x2="12" y1="17" y2="17"></line>
            </svg>
            <h1 className="text-lg font-bold text-black dark:text-white">Calculette rapide</h1>
          </div>
          <div className="relative group">
            <button
              onClick={handleClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path>
              </svg>
            </button>
            <div className="absolute right-0 mt-2 w-64 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50 text-xs text-black dark:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <p className="font-medium">Fermer la calculatrice</p>
              <p>Ceci réinitialisera les champs de calcul mais conservera vos paramètres généraux.</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {loadedCalcId && (
            <div className="mb-4 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/30 px-3 py-2 text-sm text-blue-800 dark:text-blue-200 transition-opacity duration-300 ease-in-out">
              🔹 Calcul chargé : <span className="font-semibold">{loadedCalcName}</span> — Dernière modification : {formatDate(loadedCalcDate)}
            </div>
          )}
          {updateSuccess && (
            <div className="mb-2 rounded-md border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200 transition-opacity duration-300 ease-in-out">
              ✅ Calcul mis à jour avec succès
            </div>
          )}
          {/* Paramètres généraux */}
          <details open={settingsOpen} onToggle={(e: any) => { if (!e.target.open) setSettingsOpen(false); }} className="rounded-lg border border-gray-200/50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800 transition-all duration-300 ease-in-out hover:shadow-md">
            <summary
              onClick={(e) => { e.preventDefault(); setSettingsOpen(!settingsOpen); }}
              className="flex cursor-pointer items-center justify-between text-black dark:text-white list-none"
            >
              <h3 className="text-base font-semibold">{settingsOpen ? 'Paramètres généraux' : 'Ouvrir les paramètres généraux'}</h3>
              <svg
                className={`h-5 w-5 transition-transform duration-300 ${settingsOpen ? 'rotate-180' : ''}`}
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>

            {settingsOpen && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <label className="flex flex-col col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Statut fiscal</p>
                    </div>
                    <select
                      className="form-select w-full rounded-lg border-0 bg-white text-black focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                      value={taxStatus}
                      onChange={(e) => setTaxStatus(e.target.value)}
                    >
                      <option value="societe">Société</option>
                      <option value="micro">Micro-entreprise</option>
                    </select>
                  </label>

                  {taxStatus === 'societe' && (
                    <div className="col-span-2">
                      <label className="flex flex-col">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Taux IS (%)</p>
                        <input
                          className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                          placeholder="Ex: 25"
                          type="number"
                          value={taxRateIS}
                          onChange={(e) => setTaxRateIS(e.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  {taxStatus === 'micro' && (
                    <div className="col-span-2">
                      <label className="flex flex-col">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Cotisation micro (%)</p>
                        <input
                          className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                          placeholder="Ex: 12.8"
                          type="number"
                          value={cotisationMicro}
                          onChange={(e) => setCotisationMicro(e.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  <label className="flex flex-col">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Taux horaire</p>
                    <input
                      className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                      placeholder="0.00 €"
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                  </label>

                  <label className="flex flex-col">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Marge min. (%)</p>
                    <input
                      className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                      placeholder="Ex: 20"
                      type="number"
                      value={minMargin}
                      onChange={(e) => setMinMargin(e.target.value)}
                    />
                  </label>

                  {taxStatus === 'societe' && (
                    <label className="flex flex-col col-span-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">TVA (%)</p>
                      <input
                        className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                        placeholder="Ex: 20"
                        type="number"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="flex-grow flex items-center justify-center rounded-lg h-12 px-4 bg-blue-500 text-white text-base font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Enregistrer les paramètres
                  </button>
                  {saved && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Paramètres enregistrés
                    </p>
                  )}
                </div>
              </div>
            )}
          </details>

          {/* Saisir un calcul (repliable) */}
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-6 rounded-lg bg-blue-50/50 dark:bg-blue-900/30 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-in-out hover:shadow-md">
            <div
              className="flex cursor-pointer items-center justify-between text-black dark:text-white"
              onClick={() => setInputOpen(!inputOpen)}
            >
              <h3 className="text-base font-semibold">
                {inputOpen ? 'Saisir un calcul' : 'Ouvrir pour saisir un calcul'}
              </h3>
              <svg
                className={`h-5 w-5 transition-transform duration-300 ${inputOpen ? 'rotate-180' : ''}`}
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {inputOpen && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Prix d'achat HT <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 ${purchasePriceError ? 'focus:ring-red-500 border-red-500' : 'focus:ring-blue-500'} h-12 p-3 text-sm font-normal`}
                  placeholder="Ex: 150.00"
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  onBlur={() => setPurchasePriceError(purchasePrice === '')}
                />
                {purchasePriceError && (
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400">Ce champ est requis.</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Temps de réparation (min)
                </label>
                <input
                  className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                  placeholder="Ex: 45"
                  type="number"
                  value={repairTime}
                  onChange={(e) => setRepairTime(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Frais additionnels (€)
                </label>
                <input
                  className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                  placeholder="Ex: 25.50"
                  type="number"
                  value={additionalFees}
                  onChange={(e) => setAdditionalFees(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Marge souhaitée (%)
                </label>
                <input
                  className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                  placeholder="Ex: 30"
                  type="number"
                  value={desiredMarginPercentage}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDesiredMarginPercentage(v);
                    setLastEdited('percent');

                    // Synchroniser la marge € à partir du %
                    const pct = parseFloat(v) || 0;
                    const prixAchat = parseFloat(purchasePrice) || 0;
                    const time = parseFloat(repairTime) || 0;
                    const frais = parseFloat(additionalFees) || 0;
                    const rate = parseFloat(hourlyRate) || 0;
                    const mainOeuvre = (time / 60) * rate;
                    const baseCost = prixAchat + mainOeuvre + frais;
                    const cotRate = taxStatus === 'micro' ? (parseFloat(cotisationMicro) || 0) : 0;

                    let price = 0;
                    if (taxStatus === 'micro') {
                      price = Math.ceil(baseCost / (1 - ((cotRate + pct) / 100)));
                    } else {
                      price = Math.ceil(baseCost / (1 - (pct / 100)));
                    }
                    const cotisations = taxStatus === 'micro' ? price * (cotRate / 100) : 0;
                    const netMargin = price - (baseCost + cotisations);
                    setDesiredMarginEuro(Math.round(netMargin).toString());
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Marge souhaitée (€)
                </label>
                <input
                  className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                  placeholder="Ex: 50.00"
                  type="number"
                  value={desiredMarginEuro}
                  onChange={(e) => handleMarginEuroChange(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Prix de vente souhaité (€)
                </label>
                <input
                  className="form-input w-full resize-none rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm font-normal"
                  placeholder="Ex: 250"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      const rounded = Math.round(numValue).toString();
                      setSellingPrice(rounded);
                      setLastEdited('price');

                      // Synchroniser marges depuis le prix saisi
                      const prix = Math.round(numValue);
                      const prixAchat = parseFloat(purchasePrice) || 0;
                      const time = parseFloat(repairTime) || 0;
                      const frais = parseFloat(additionalFees) || 0;
                      const rate = parseFloat(hourlyRate) || 0;
                      const mainOeuvre = (time / 60) * rate;
                      const baseCost = prixAchat + mainOeuvre + frais;
                      const cotRate = taxStatus === 'micro' ? (parseFloat(cotisationMicro) || 0) : 0;

                      const cotisations = taxStatus === 'micro' ? prix * (cotRate / 100) : 0;
                      const net = prix - (baseCost + cotisations);
                      const pct = prix > 0 ? (net / prix) * 100 : 0;

                      setDesiredMarginEuro(Math.round(net).toString());
                      setDesiredMarginPercentage(pct.toFixed(0));
                    } else {
                      setSellingPrice(value);
                    }
                  }}
                />
              </div>
              </div>
            )}
          </div>

          {/* Enregistrer un calcul (repliable) */}
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-6">
            <div
              className="flex cursor-pointer items-center justify-between text-black dark:text-white"
              onClick={() => setSaveOpen(!saveOpen)}
            >
              <h3 className="text-base font-semibold">
                {saveOpen ? 'Enregistrer un calcul' : 'Ouvrir pour nommer et enregistrer un calcul'}
              </h3>
              <svg
                className={`h-5 w-5 transition-transform duration-300 ${saveOpen ? 'rotate-180' : ''}`}
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {saveOpen && (
              <div className="mt-4 space-y-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 p-4 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-in-out hover:shadow-md">
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 form-input rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-12 p-3 text-sm"
                    placeholder="Nommer ce calcul…"
                    value={calculationName}
                    onChange={(e) => setCalculationName(e.target.value)}
                  />
                  <button
                    onClick={handleSaveCalculation}
                    className="px-4 rounded-lg h-12 bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  >
                    Enregistrer le calcul
                  </button>
                </div>

                {isModified && loadedCalcId && (
                  <div className="rounded-md border border-yellow-200 dark:border-yellow-700 bg-yellow-50/70 dark:bg-yellow-900/30 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    Des modifications ont été détectées. Voulez-vous mettre à jour ce calcul ou enregistrer une nouvelle version ?
                    <div className="mt-2 flex gap-2">
                      <button onClick={handleUpdateCalculation} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700">
                        Mettre à jour ce calcul
                      </button>
                      <button onClick={handleSaveAsNew} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700">
                        Enregistrer comme nouveau
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-black dark:text-white">Historique des calculs</h4>
                    <div className="relative w-64">
                      <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Rechercher un calcul…"
                        className="pl-7 form-input w-full rounded-lg border-0 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 h-9 text-sm"
                      />
                    </div>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div className="text-sm text-gray-500">Aucun calcul enregistré pour le moment.</div>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto divide-y divide-gray-200/60 dark:divide-gray-700/50">
                      {filteredHistory.map((item) => {
                        const low = (item.marge_nette_pct || 0) < minMarginValue;
                        return (
                          <li key={item.id} className="py-2 flex items-center justify-between gap-2">
                            <button
                              className="text-left flex-1"
                              onClick={() => applyCalculation(item)}
                            >
                              <div className="font-semibold text-black dark:text-white">{item.nom}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Prix final : {Number(item.prix_final).toFixed(2)} € • {formatDate(item.date_creation)}
                              </div>
                            </button>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${low ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {low ? 'Faible' : 'OK'}
                            </span>
                            <button
                              className="p-1 text-gray-500 hover:text-red-600"
                              title="Supprimer"
                              onClick={() => deleteCalculation(item.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Résultats */}
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-6 mt-6">
            <h3 className="text-base font-semibold text-black dark:text-white mb-4">Résultats</h3>
            <div className="space-y-3 rounded-lg bg-gray-100/80 dark:bg-gray-800/80 p-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700 dark:text-gray-300">Prix de vente souhaité</p>
                <p className="font-semibold text-black dark:text-white">{results.ht.toFixed(2)} €</p>
              </div>

              <div className="border-t border-gray-200/50 dark:border-gray-700/50 my-3"></div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Coût total (pièce + MO + frais{taxStatus === 'micro' ? ' + cotisations' : ''})
                </p>
                <p className="font-semibold text-black dark:text-white">{results.totalCost.toFixed(2)} €</p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700 dark:text-gray-300">Marge nette</p>
                <p className={`font-semibold ${isBelowMin ? 'text-red-600' : 'text-black dark:text-white'}`}>
                  {results.netMargin.toFixed(2)} € • <span className={isBelowMin ? 'text-red-600' : 'text-emerald-500'}>{results.netMarginPct.toFixed(0)} %</span>
                </p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Cotisations à reverser (déjà déduites)
                </p>
                <p className="font-semibold text-black dark:text-white">{results.taxAmount.toFixed(2)} €</p>
              </div>

              <div className="flex items-center justify-end pt-2">
                <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                  isBelowMin
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {isBelowMin ? '⚠️ Attention : marge inférieure à la marge mini prédéfinie' : 'Marge OK'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
