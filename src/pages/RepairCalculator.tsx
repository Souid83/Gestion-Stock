import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CreditCard as Edit, Trash2, Download, ChevronDown, ChevronRight } from 'lucide-react';

interface Part {
  id: string;
  name: string;
  serviceTime: number;
  repairPrice: number;
  valuePercentage: number;
  purchasePrice: number;
  targetNetMargin?: number;
}

interface Article {
  id: string;
  name: string;
  value: number;
  parts: Part[];
  selected: boolean;
  isExpanded: boolean;
  isModified: boolean;
  isSaved: boolean;
}

interface Thresholds {
  redMax: number;
  greenMin: number;
}

interface RepairSettings {
  id?: string;
  fixed_charges: number;
  hourly_rate: number;
  vat_rate: number;
  profit_tax: number;
  revenue_tax: number;
  value_pct_thresholds?: Thresholds;
  net_margin_thresholds?: Thresholds;
}

export const RepairCalculator: React.FC = () => {
  const [globalSettings, setGlobalSettings] = useState({
    fixedCharges: 1500,
    hourlyRate: 50,
    vatRate: 20,
    profitTax: 30,
    revenueTax: 12.8,
    valuePctThresholds: { redMax: 34, greenMin: 55 },
    netMarginThresholds: { redMax: 44, greenMin: 55 },
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [modifiedParts, setModifiedParts] = useState<Set<string>>(new Set());
  const [savedParts, setSavedParts] = useState<Set<string>>(new Set());
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
  const [isGlobalModified, setIsGlobalModified] = useState(false);
  const [isGlobalSaved, setIsGlobalSaved] = useState(false);
  const [existingModels, setExistingModels] = useState<string[]>([]);
  const [existingParts, setExistingParts] = useState<string[]>([]);

  // Ordre explicite pour l'affichage et l'export
  const IPHONE_ORDER = [
    'iPhone 8',
    'iPhone 8 Plus',
    'iPhone X',
    'iPhone XR',
    'iPhone XS',
    'iPhone XS Max',
    'iPhone 11',
    'iPhone 11 Pro',
    'iPhone 11 Pro Max',
    'iPhone 12',
    'iPhone 12 Mini',
    'iPhone 12 Pro',
    'iPhone 12 Pro Max',
    'iPhone 13',
    'iPhone 13 Mini',
    'iPhone 13 Pro',
    'iPhone 13 Pro Max',
    'iPhone 14',
    'iPhone 14 Plus',
    'iPhone 14 Pro',
    'iPhone 14 Pro Max',
    'iPhone 15',
    'iPhone 15 Plus',
    'iPhone 15 Pro',
    'iPhone 15 Pro Max',
    'iPhone 16',
    'iPhone 16 Plus',
    'iPhone 16 Pro',
    'iPhone 16 Pro Max',
    'iPhone 17',
    'iPhone Air',
    'iPhone 17 Pro',
    'iPhone 17 Pro Max',
  ];

  const orderIndex = (name: string): number => {
    const n = String(name || '').trim().toLowerCase();
    const idx = IPHONE_ORDER.findIndex(x => x.toLowerCase() === n);
    return idx >= 0 ? idx : 10000; // Non listé -> après tous les iPhone
  };

  // Fonction utilitaire pour calculer le prix de réparation HT nécessaire pour atteindre une marge nette cible
  const calculateRepairPriceForTargetNetMargin = (
    targetNetMargin: number,
    purchasePrice: number,
    serviceTime: number,
    fixedCharges: number,
    hourlyRate: number,
    vatRate: number,
    profitTax: number,
    revenueTax: number
  ): number => {
    const servicePrice = (serviceTime / 60) * hourlyRate;
    // Toujours utiliser la formule demandée pour atteindre la marge nette cible:
    // repairPriceHT = (targetNetMargin + purchasePrice + servicePrice + fixedCharges) / (1 - revenueTax/100)
    return (targetNetMargin + purchasePrice + servicePrice + fixedCharges) / (1 - revenueTax / 100);
  };

  React.useEffect(() => {
    const loadSettings = async () => {
      setSettingsError(null);
      try {
        const { data, error } = await (supabase as any).from('repair_settings').select('*').maybeSingle();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found, which is fine
        if (data) {
          setGlobalSettings({
            fixedCharges: data.fixed_charges,
            hourlyRate: data.hourly_rate,
            vatRate: data.vat_rate,
            profitTax: data.profit_tax,
            revenueTax: data.revenue_tax,
            valuePctThresholds: (data.value_pct_thresholds && ('redMax' in data.value_pct_thresholds) && ('greenMin' in data.value_pct_thresholds))
              ? data.value_pct_thresholds
              : data.value_pct_thresholds
              ? { redMax: Math.max(0, (data.value_pct_thresholds.green ?? 0) - 1), greenMin: data.value_pct_thresholds.yellow ?? 0 }
              : { redMax: 34, greenMin: 55 },
            netMarginThresholds: (data.net_margin_thresholds && ('redMax' in data.net_margin_thresholds) && ('greenMin' in data.net_margin_thresholds))
              ? data.net_margin_thresholds
              : data.net_margin_thresholds
              ? { redMax: Math.max(0, (data.net_margin_thresholds.green ?? 0) - 1), greenMin: data.net_margin_thresholds.yellow ?? 0 }
              : { redMax: 44, greenMin: 55 },
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

  React.useEffect(() => {
    loadArticles();
  }, []);

  React.useEffect(() => {
    const loadNames = async () => {
      try {
        const { data: models, error: mErr } = await (supabase as any)
          .from('repair_models')
          .select('name');
        if (mErr) throw mErr;
        const rawModelNames: string[] = (models || [])
          .map((m: any) => String(m?.name ?? '').trim())
          .filter((n: string) => n.length > 0);
        const uniqueModelNames: string[] = Array.from(new Set<string>(rawModelNames));
        uniqueModelNames.sort((a: string, b: string) => a.localeCompare(b, 'fr'));
        setExistingModels(uniqueModelNames);

        const { data: services, error: sErr } = await (supabase as any)
          .from('repair_services')
          .select('name');
        if (sErr) throw sErr;
        const rawPartNames: string[] = (services || [])
          .map((s: any) => String(s?.name ?? '').trim())
          .filter((n: string) => n.length > 0);
        const uniquePartNames: string[] = Array.from(new Set<string>(rawPartNames));
        uniquePartNames.sort((a: string, b: string) => a.localeCompare(b, 'fr'));
        setExistingParts(uniquePartNames);
      } catch (err) {
        console.error('Error loading autocomplete lists:', err);
      }
    };
    loadNames();
  }, []);

  const loadArticles = async () => {
    setIsLoadingArticles(true);
    setSettingsError(null);
    try {
      console.log('Loading articles from repair_models...');
      
      // Récupérer tous les modèles de réparation
      const { data: modelsData, error: modelsError } = await (supabase as any)
        .from('repair_models')
        .select('id, name, value')
        .order('name');
      
      if (modelsError) throw modelsError;
      
      console.log('Models loaded:', modelsData);
      
      const loadedArticles: Article[] = [];
      
      // Pour chaque modèle, récupérer ses services associés
      for (const model of modelsData || []) {
        console.log(`Loading services for model ${model.id}...`);
        
        const { data: servicesData, error: servicesError } = await (supabase as any)
          .from('repair_services')
          .select('id, name, service_time, repair_price, value_percentage, purchase_price, target_net_margin')
          .eq('repair_model_id', model.id)
          .order('name');
        
        if (servicesError) throw servicesError;
        
        console.log(`Services loaded for model ${model.id}:`, servicesData);
        
        // Mapper les services en objets Part
        const modelValue = Number(model.value) || 0;
        const parts: Part[] = (servicesData || []).map((service: any) => {
          const repairPrice = Number(service.repair_price) || 0;
          const fallbackPct = Number(service.value_percentage) || 0;
          const valuePercentage = modelValue > 0 && repairPrice > 0
            ? (repairPrice / modelValue) * 100
            : fallbackPct;

          return {
            id: service.id,
            name: service.name || '',
            serviceTime: Number(service.service_time) || 0,
            repairPrice,
            valuePercentage,
            purchasePrice: Number(service.purchase_price) || 0,
            targetNetMargin: Number(service.target_net_margin) || 0
          };
        });
        
        // Construire l'objet Article
        const article: Article = {
          id: model.id,
          name: model.name || '',
          value: model.value || 0,
          parts: parts,
          selected: false,
          isExpanded: false,
          isModified: false,
          isSaved: false
        };
        
        loadedArticles.push(article);
      }
      
      console.log('All articles loaded:', loadedArticles);
      loadedArticles.sort((a, b) => {
        const ia = orderIndex(a.name);
        const ib = orderIndex(b.name);
        if (ia !== ib) return ia - ib;
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });
      setArticles(loadedArticles);
    } catch (err) {
      console.error('Error loading articles:', err);
      setSettingsError(err instanceof Error ? err.message : 'Erreur lors du chargement des articles');
    } finally {
      setIsLoadingArticles(false);
    }
  };

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
        value_pct_thresholds: globalSettings.valuePctThresholds,
        net_margin_thresholds: globalSettings.netMarginThresholds,
      };

      if (settingsId) {
        const { error } = await (supabase as any)
          .from('repair_settings')
          .update(settingsToSave)
          .eq('id', settingsId);
        if (error) throw error;
        console.log('Repair settings updated successfully.');
        setIsGlobalModified(false);
        setIsGlobalSaved(true);
        setTimeout(() => setIsGlobalSaved(false), 2000);
      } else {
        const { data, error } = await (supabase as any)
          .from('repair_settings')
          .insert([settingsToSave])
          .select('id')
          .single();
        if (error) throw error;
        setSettingsId(data.id);
        console.log('Repair settings inserted successfully.');
        setIsGlobalModified(false);
        setIsGlobalSaved(true);
        setTimeout(() => setIsGlobalSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error saving repair settings:', err);
      setSettingsError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const [articles, setArticles] = useState<Article[]>([]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportExportMenu, setShowImportExportMenu] = useState(false);
  const modelsFileInputRef = useRef<HTMLInputElement>(null);
  const servicesFileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ===== Helpers & Handlers for Import/Export CSV =====
  const parseCSV = (text: string): Record<string, string>[] => {
    const cleaned = text.replace(/\r/g, '');
    const lines = cleaned.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? '';
      });
      return obj;
    });
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import modèles
  const handleImportModelsClick = () => {
    setShowImportExportMenu(false);
    modelsFileInputRef.current?.click();
  };

  const handleModelsFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? '');
        const rows = parseCSV(text);
        const payload = rows
          .filter(r => (r.name?.trim()?.length ?? 0) > 0)
          .map(r => ({
            name: r.name.trim(),
            value: Number(r.value) || 0
          }));
        if (payload.length > 0) {
          const { error } = await (supabase as any)
            .from('repair_models')
            .upsert(payload);
          if (error) throw error;
          await loadArticles();
        }
      } catch (err) {
        console.error('Import modèles error:', err);
        setSettingsError(err instanceof Error ? err.message : 'Erreur import modèles');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSampleModels = () => {
    downloadText('repair_models_sample.csv', 'name,value\n');
    setShowImportExportMenu(false);
  };

  // Import pièces
  const handleImportServicesClick = () => {
    setShowImportExportMenu(false);
    servicesFileInputRef.current?.click();
  };

  const handleServicesFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? '');
        const rows = parseCSV(text);
        const payload: any[] = [];
        for (const r of rows) {
          const modelName = (r.model_name || '').trim();
          const serviceName = (r.name || '').trim();
          if (!modelName || !serviceName) continue;
  
          const { data: model, error: mErr } = await (supabase as any)
            .from('repair_models')
            .select('id, value')
            .eq('name', modelName)
            .maybeSingle();
          if (mErr) throw mErr;
          if (!model?.id) {
            console.warn(`Modèle introuvable pour model_name="${modelName}", ligne ignorée.`);
            continue;
          }
  
          const repairPriceNum = Number(r.repair_price) || 0;
          const modelValueNum = Number(model.value) || 0;
          const valuePct = modelValueNum > 0 && repairPriceNum > 0
            ? (repairPriceNum / modelValueNum) * 100
            : 0;

          payload.push({
            repair_model_id: model.id,
            name: serviceName,
            service_time: Number(r.service_time) || 0,
            repair_price: repairPriceNum,
            purchase_price: Number(r.purchase_price) || 0,
            value_percentage: Number(valuePct.toFixed(2))
          });
        }
  
        if (payload.length > 0) {
          const { error } = await (supabase as any)
            .from('repair_services')
            .upsert(payload);
          if (error) throw error;
          await loadArticles();
        }
      } catch (err) {
        console.error('Import pièces error:', err);
        setSettingsError(err instanceof Error ? err.message : 'Erreur import pièces');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSampleServices = () => {
    downloadText(
      'repair_services_sample.csv',
      'model_name,name,service_time,repair_price,purchase_price\niPhone 12,Batterie,30,69,15\niPhone 12,Écran LCD générique,45,99,25\niPhone 13,Écran OLED original,60,199,90\nSamsung S21,Connecteur de charge,40,89,20\n'
    );
    setShowImportExportMenu(false);
  };

  // Export global
  const handleExportGlobal = async () => {
    try {
      const { data: models, error: mErr } = await (supabase as any)
        .from('repair_models')
        .select('id, name, value');
      if (mErr) throw mErr;

      const { data: services, error: sErr } = await (supabase as any)
        .from('repair_services')
        .select('id, repair_model_id, name, service_time, repair_price, value_percentage, purchase_price, target_net_margin');
      if (sErr) throw sErr;

      const header = 'dataset,name,value,service_time,repair_price,value_percentage,purchase_price,net_margin\n';
      const lines: string[] = [];

      // Sort models with explicit order (iPhone 8 -> iPhone 17 Pro Max), others after alphabetically
      const sortedModels = [...(models || [])].sort((a: any, b: any) => {
        const ia = orderIndex(a.name);
        const ib = orderIndex(b.name);
        if (ia !== ib) return ia - ib;
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });

      sortedModels.forEach((m: any) => {
        // Parent line for model: dataset,name,value then empty columns for service fields
        lines.push(`model,${m.name ?? ''},${m.value ?? ''},,,,,`);
        const children = (services || []).filter((s: any) => s.repair_model_id === m.id);
        children.forEach((s: any) => {
          const rp = Number(s.repair_price) || 0;
          const pp = Number(s.purchase_price) || 0;
          const st = Number(s.service_time) || 0;
          const tnm = Number(s.target_net_margin) || 0;
          const margins = calculateMargins({ repairPrice: rp, purchasePrice: pp, serviceTime: st, targetNetMargin: tnm } as any, Number(m.value) || 0);
          const net = Number(margins.netMarginEur || 0).toFixed(2);
          // Child service line: dataset,name,,service_time,repair_price,value_percentage,purchase_price,net_margin
          lines.push(`service,${s.name ?? ''},,${s.service_time ?? ''},${s.repair_price ?? ''},${s.value_percentage ?? ''},${s.purchase_price ?? ''},${net}`);
        });
      });

      downloadText('repair_data_export.csv', header + lines.join('\n'));
    } catch (err) {
      console.error('Export global error:', err);
      setSettingsError(err instanceof Error ? err.message : 'Erreur export global');
    } finally {
      setShowImportExportMenu(false);
    }
  };

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
    // Si une marge nette cible est définie, calculer le prix réparation requis
    if (part.targetNetMargin && part.targetNetMargin > 0) {
      const repairPriceHT = calculateRepairPriceForTargetNetMargin(
        part.targetNetMargin,
        part.purchasePrice,
        part.serviceTime,
        globalSettings.fixedCharges,
        globalSettings.hourlyRate,
        globalSettings.vatRate,
        globalSettings.profitTax,
        globalSettings.revenueTax
      );
      
      const repairPriceTTC = repairPriceHT * (1 + globalSettings.vatRate / 100);

      return {
        grossMarginEur: repairPriceTTC - part.purchasePrice,
        grossMarginPct: ((repairPriceTTC - part.purchasePrice) / repairPriceTTC) * 100,
        netMarginEur: part.targetNetMargin,
        netMarginPct: (part.targetNetMargin / repairPriceTTC) * 100,
        validationError: null
      };
    }

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
    setIsGlobalModified(true);
  };

  // Mise à jour des seuils (JSON) dans l'état global
  const handleThresholdChange = (
    type: 'valuePct' | 'netMargin',
    key: 'redMax' | 'greenMin',
    value: number
  ) => {
    setGlobalSettings(prev => {
      if (type === 'valuePct') {
        return {
          ...prev,
          valuePctThresholds: {
            ...(prev.valuePctThresholds || { redMax: 34, greenMin: 55 }),
            [key]: value
          }
        };
      }
      return {
        ...prev,
        netMarginThresholds: {
          ...(prev.netMarginThresholds || { redMax: 44, greenMin: 55 }),
          [key]: value
        }
      };
    });
    setIsGlobalModified(true);
  };

  // Renvoie la classe Tailwind selon la valeur et les seuils configurés
  const getColorClass = (kind: 'valuePct' | 'netMarginPct', value: number): string => {
    const thresholds =
      kind === 'valuePct' ? globalSettings.valuePctThresholds : globalSettings.netMarginThresholds;

    if (!thresholds) return '';

    const redMax = thresholds.redMax ?? 0;
    const greenMin = thresholds.greenMin ?? 0;

    // Pour % valeur produit: bicolore (vert entre min et max, rouge en dehors)
    if (kind === 'valuePct') {
      if (value < redMax) return 'text-red-600 font-bold';
      if (value > greenMin) return 'text-red-600 font-bold';
      return 'text-green-600 font-bold';
    }

    // Pour Marge nette %, on conserve la logique existante (tri-couleur)
    if (value <= redMax) return 'text-red-600 font-bold';
    if (value < greenMin) return 'text-yellow-600 font-bold';
    return 'text-green-600 font-bold';
  };

  const handleArticleChange = (articleId: string, field: keyof Article, value: any) => {
    console.log(`Article ${articleId} field ${field} changed to:`, value);

    if (field === 'value') {
      setArticles(prev =>
        prev.map(a =>
          a.id === articleId
            ? {
                ...a,
                value: value,
                isModified: true,
                isSaved: false,
                parts: a.parts.map(p => {
                  const pct = value > 0 && p.repairPrice > 0 ? (p.repairPrice / value) * 100 : 0;
                  return { ...p, valuePercentage: pct };
                })
              }
            : a
        )
      );
      return;
    }

    setArticles(prev => prev.map(article => 
      article.id === articleId ? { ...article, [field]: value, isModified: true, isSaved: false } : article
    ));
  };

  const handlePartChange = (articleId: string, partId: string, field: keyof Part, value: any) => {
    console.log(`Part ${partId} field ${field} changed to:`, value);
    
    // Logique spéciale pour targetNetMargin
    if (field === 'targetNetMargin') {
      const article = articles.find(a => a.id === articleId);
      const part = articles.find(a => a.id === articleId)?.parts.find(p => p.id === partId);
      
      if (article && part && value > 0) {
        const repairPriceHT = calculateRepairPriceForTargetNetMargin(
          value,
          part.purchasePrice,
          part.serviceTime,
          globalSettings.fixedCharges,
          globalSettings.hourlyRate,
          globalSettings.vatRate,
          globalSettings.profitTax,
          globalSettings.revenueTax
        );
        
        const repairPrice = repairPriceHT * (1 + globalSettings.vatRate / 100);
        const valuePercentage = article.value > 0 ? (repairPrice / article.value) * 100 : 0;
        
        setArticles(prev => prev.map(a => 
          a.id === articleId 
            ? {
                ...a,
                parts: a.parts.map(p => 
                  p.id === partId 
                    ? { 
                        ...p, 
                        [field]: value,
                        repairPrice: repairPrice,
                        valuePercentage: valuePercentage
                      } 
                    : p
                )
              }
            : a
        ));
        
        setModifiedParts(prev => new Set(prev).add(partId));
        setSavedParts(prev => {
          const newSet = new Set(prev);
          newSet.delete(partId);
          return newSet;
        });
        
        return;
      }
    }
    
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
    
    setModifiedParts(prev => new Set(prev).add(partId));
    setSavedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });

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
    console.log(`Repair price for part ${partId} changed to:`, value);
    const article = articles.find(a => a.id === articleId);
    if (article && article.value > 0) {
      const valuePercentage = (value / article.value) * 100;
      setArticles(prev =>
        prev.map(a =>
          a.id === articleId
            ? {
                ...a,
                parts: a.parts.map(p => {
                  if (p.id === partId) {
                    const updatedPart = { ...p, repairPrice: value, valuePercentage };
return updatedPart;

                  }
                  return p;
                }),
              }
            : a
        )
      );
    } else {
      handlePartChange(articleId, partId, "repairPrice", value);
    }

    setModifiedParts(prev => new Set(prev).add(partId));
    setSavedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });
  };




  const handleValuePercentageChange = (articleId: string, partId: string, value: number) => {
    console.log(`Value percentage for part ${partId} changed to:`, value);
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
    
    setModifiedParts(prev => new Set(prev).add(partId));
    setSavedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });
  };

  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      name: '',
      value: 0,
      selected: false,
      isExpanded: false,
      isModified: false,
      isSaved: false,
      parts: []
    };
    setArticles(prev => [...prev, newArticle]);
  };

  const deleteArticle = async (articleId: string) => {
  try {
    // Supprimer d'abord les services liés
    await (supabase as any)
      .from('repair_services')
      .delete()
      .eq('repair_model_id', articleId);

    // Puis supprimer le modèle
    await (supabase as any)
      .from('repair_models')
      .delete()
      .eq('id', articleId);

    // Enfin, mettre à jour l'état côté frontend
    setArticles(prev => prev.filter(article => article.id !== articleId));

    console.log(`Article ${articleId} et ses pièces supprimés.`);
  } catch (err) {
    console.error('Erreur lors de la suppression du modèle et des pièces :', err);
    setSettingsError(
      err instanceof Error ? err.message : "Erreur lors de la suppression de l'article"
    );
  }
};


  const addPart = (articleId: string) => {
    const newPart: Part = {
      id: `${articleId}-${Date.now()}`,
      name: '',
      serviceTime: 0,
      repairPrice: 0,
      valuePercentage: 0,
      purchasePrice: 0,
      targetNetMargin: 0
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
    
    // Remove from modified and saved sets
    setModifiedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });
    setSavedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });
  };

  const toggleArticleExpansion = (articleId: string) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, isExpanded: !article.isExpanded }
        : article
    ));
  };
  
  // Fonction utilitaire pour vérifier si un ID est un UUID valide
  const isUuid = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };
  
  const saveArticle = async (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
      console.error(`Article with id ${articleId} not found`);
      return;
    }

    try {
      console.log(`Saving article ${articleId} to repair_models`);
      
      // Construire le payload pour l'upsert
      const payload: any = {
        name: article.name,
        value: article.value
      };
      
      // Si l'id est un UUID valide, l'inclure pour la mise à jour
      if (isUuid(article.id)) {
        payload.id = article.id;
      }
      
      const { data, error } = await (supabase as any)
        .from('repair_models')
        .upsert(payload)
        .select('id')
        .single();
      
      if (error) {
        console.error('Error saving article to repair_models:', error);
        setSettingsError(`Erreur lors de l'enregistrement de l'article: ${error.message}`);
        return;
      }
      
      console.log('Article saved successfully:', data);
      
      // Si un nouvel id a été généré, mettre à jour l'article dans l'état
      if (data && data.id && data.id !== article.id) {
        setArticles(prev => prev.map(a => 
          a.id === articleId ? { ...a, id: data.id } : a
        ));
      }
    } catch (err) {
      console.error('Error saving article:', err);
      setSettingsError(`Erreur lors de l'enregistrement de l'article: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      return;
    }
    
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, isModified: false, isSaved: true }
        : article
    ));
    
    // Masquer le message de confirmation après 2 secondes
    setTimeout(() => {
      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, isSaved: false }
          : article
      ));
    }, 2000);
  };
  
  const savePart = async (partId: string) => {
    // Trouver l'article et la pièce concernés
    let targetArticle: Article | null = null;
    let targetPart: Part | null = null;
    
    for (const article of articles) {
      const part = article.parts.find(p => p.id === partId);
      if (part) {
        targetArticle = article;
        targetPart = part;
        break;
      }
    }
    
    if (!targetArticle || !targetPart) {
      console.error(`Part with id ${partId} not found`);
      return;
    }

    try {
      console.log(`Saving part ${partId} to repair_services`);
      
      // Construire le payload pour l'upsert
      const modelValueNum = Number(targetArticle.value) || 0;
      const repairPriceNum = Number(targetPart.repairPrice) || 0;
      const valuePct = modelValueNum > 0 && repairPriceNum > 0
        ? (repairPriceNum / modelValueNum) * 100
        : 0;
      const payload: any = {
        repair_model_id: targetArticle.id,
        name: targetPart.name,
        service_time: targetPart.serviceTime,
        repair_price: repairPriceNum,
        value_percentage: Number(valuePct.toFixed(2)),
        purchase_price: targetPart.purchasePrice,
        target_net_margin: targetPart.targetNetMargin
      };
      
      // Si l'id est un UUID valide, l'inclure pour la mise à jour
      if (isUuid(targetPart.id)) {
        payload.id = targetPart.id;
      }
      
      const { data, error } = await (supabase as any)
        .from('repair_services')
        .upsert(payload)
        .select('id')
        .single();
      
      if (error) {
        console.error('Error saving part to repair_services:', error);
        setSettingsError(`Erreur lors de l'enregistrement de la pièce: ${error.message}`);
        return;
      }
      
      console.log('Part saved successfully:', data);
      
      // Si un nouvel id a été généré, mettre à jour la pièce dans l'état
      if (data && data.id && data.id !== targetPart.id) {
        setArticles(prev => prev.map(article => 
          article.id === targetArticle.id 
            ? {
                ...article,
                parts: article.parts.map(part => 
                  part.id === partId ? { ...part, id: data.id } : part
                )
              }
            : article
        ));
      }
    } catch (err) {
      console.error('Error saving part:', err);
      setSettingsError(`Erreur lors de l'enregistrement de la pièce: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      return;
    }
    
    setModifiedParts(prev => {
      const newSet = new Set(prev);
      newSet.delete(partId);
      return newSet;
    });
    
    setSavedParts(prev => new Set(prev).add(partId));
    
    // Masquer le message de confirmation après 2 secondes
    setTimeout(() => {
      setSavedParts(prev => {
        const newSet = new Set(prev);
        newSet.delete(partId);
        return newSet;
      });
    }, 2000);
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
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
              className="p-1 text-blue-600 hover:text-blue-800 focus:outline-none"
            >
              {isGlobalExpanded ? (
                <ChevronDown size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
            <h2
              className="text-lg font-semibold cursor-pointer"
              onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
            >
              Paramètres globaux
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={saveGlobalSettings}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${isGlobalModified ? 'bg-orange-500 text-white animate-pulse hover:bg-orange-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
            {isGlobalSaved && (
              <span className="text-green-600 text-sm font-medium flex items-center">
                ✅ Enregistré
              </span>
            )}
          </div>
        </div>
        {isGlobalExpanded && (
          <>
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
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
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
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
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
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
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
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
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
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
                id="revenue-tax"
                type="number"
                value={globalSettings.revenueTax}
                onChange={(e) => handleGlobalSettingChange('revenueTax', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Seuils % valeur produit */}
<div className="mt-6">
  <p className="text-sm font-medium text-gray-700 mb-2">Seuils % valeur produit</p>
  <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
    <div className="space-y-4">
      {/* Slider Min (Rouge) */}
      <div className="flex items-center gap-4">
        <span className="text-red-600 font-bold w-16 text-right">Min</span>
        <input
          type="range"
          min={0}
          max={100}
          value={globalSettings.valuePctThresholds.redMax}
          onChange={(e) => {
            const raw = parseInt(e.target.value) || 0;
            const val = Math.min(100, Math.max(0, raw));
            // Forcer min ≤ max: si min dépasse max, ajuster max
            if (val > globalSettings.valuePctThresholds.greenMin) {
              handleThresholdChange('valuePct', 'greenMin', val);
            }
            handleThresholdChange('valuePct', 'redMax', val);
          }}
          className="flex-1 accent-red-600"
          aria-label="Seuil minimum valeur produit"
        />
        <input
          type="number"
          min={0}
          max={100}
          className="w-20 h-10 text-center rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          value={globalSettings.valuePctThresholds.redMax}
          onChange={(e) => {
            const raw = parseFloat(e.target.value) || 0;
            const val = Math.min(100, Math.max(0, raw));
            if (val > globalSettings.valuePctThresholds.greenMin) {
              handleThresholdChange('valuePct', 'greenMin', val);
            }
            handleThresholdChange('valuePct', 'redMax', val);
          }}
        />
        <span className="text-gray-500 text-sm">%</span>
      </div>

      {/* Slider Max (Vert) */}
      <div className="flex items-center gap-4">
        <span className="text-green-600 font-bold w-16 text-right">Max</span>
        <input
          type="range"
          min={0}
          max={100}
          value={globalSettings.valuePctThresholds.greenMin}
          onChange={(e) => {
            const raw = parseInt(e.target.value) || 0;
            const val = Math.min(100, Math.max(0, raw));
            // Forcer min ≤ max: si max passe sous min, ajuster min
            if (val < globalSettings.valuePctThresholds.redMax) {
              handleThresholdChange('valuePct', 'redMax', val);
            }
            handleThresholdChange('valuePct', 'greenMin', val);
          }}
          className="flex-1 accent-green-600"
          aria-label="Seuil maximum valeur produit"
        />
        <input
          type="number"
          min={0}
          max={100}
          className="w-20 h-10 text-center rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          value={globalSettings.valuePctThresholds.greenMin}
          onChange={(e) => {
            const raw = parseFloat(e.target.value) || 0;
            const val = Math.min(100, Math.max(0, raw));
            if (val < globalSettings.valuePctThresholds.redMax) {
              handleThresholdChange('valuePct', 'redMax', val);
            }
            handleThresholdChange('valuePct', 'greenMin', val);
          }}
        />
        <span className="text-gray-500 text-sm">%</span>
      </div>
    </div>

    <p className="mt-2 text-xs text-gray-500 text-center">
      Vert entre {globalSettings.valuePctThresholds.redMax}% et {globalSettings.valuePctThresholds.greenMin}% • Rouge en dehors
    </p>
  </div>
</div>

{/* Seuils Marge nette % */}
<div className="mt-4">
  <p className="text-sm font-medium text-gray-700 mb-2">Seuils Marge nette %</p>
  <div className="rounded-md border border-gray-200 overflow-hidden">
    <table className="w-full table-fixed text-center text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="py-2">🔴 Rouge</th>
          <th className="py-2">🟡 Jaune</th>
          <th className="py-2">🟢 Vert</th>
        </tr>
      </thead>
      <tbody>
        <tr className="bg-gray-50">
          <td className="py-2">
            ≤{' '}
            <input
              type="number"
              className="w-20 text-center h-10 font-bold rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              value={globalSettings.netMarginThresholds.redMax}
              onChange={(e) =>
                handleThresholdChange('netMargin', 'redMax', parseFloat(e.target.value) || 0)
              }
            />{' '}
            %
          </td>
          <td className="py-2">
            Entre{' '}
            <span className="font-bold">
              {(globalSettings.netMarginThresholds.redMax ?? 0) + 1}%
            </span>{' '}
            et{' '}
            <span className="font-bold">
              {(globalSettings.netMarginThresholds.greenMin ?? 0) - 1}%
            </span>
          </td>
          <td className="py-2">
            ≥{' '}
            <input
              type="number"
              className="w-20 text-center h-10 font-bold rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              value={globalSettings.netMarginThresholds.greenMin}
              onChange={(e) =>
                handleThresholdChange('netMargin', 'greenMin', parseFloat(e.target.value) || 0)
              }
            />{' '}
            %
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

          </>
        )}

      </div>

      <main className="flex flex-col h-full">
        {/* Action Bar */}
        <div className="grid grid-cols-3 items-center mb-6">
          {/* Left: Exporter la sélection */}
          <div className="justify-self-start relative inline-block text-left">
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
                  <button className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text left">
                    Excel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Center: Import/Export */}
          <div className="justify-self-center relative inline-block text-left">
            <div>
              <button
                onClick={() => setShowImportExportMenu(!showImportExportMenu)}
                className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-indigo-700"
                type="button"
              >
                Import/Export
                <ChevronDown className="h-5 w-5 text-gray-200" />
              </button>
            </div>

            <input type="file" accept=".csv" ref={modelsFileInputRef} className="hidden" onChange={handleModelsFileSelected} />
            <input type="file" accept=".csv" ref={servicesFileInputRef} className="hidden" onChange={handleServicesFileSelected} />

            {showImportExportMenu && (
              <div className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <button onClick={handleImportModelsClick} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Import modèles (repair_models)
                  </button>
                  <button onClick={handleSampleModels} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Sample modèles (CSV exemple)
                  </button>
                  <button onClick={handleImportServicesClick} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Import pièces (repair_services)
                  </button>
                  <button onClick={handleSampleServices} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Sample pièces (CSV exemple)
                  </button>
                  <button onClick={handleExportGlobal} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block px-4 py-2 text-sm w-full text-left">
                    Export global
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Ajouter un article */}
          <div className="justify-self-end">
            <button
              onClick={addArticle}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="mr-2 -ml-1 h-4 w-4" />
              Ajouter un article
            </button>
          </div>
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
  list="model-options"
  className="mt-1 block h-[38px] w-[60%] text-center rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
  value={article.name}
  onChange={(e) => handleArticleChange(article.id, 'name', e.target.value)}
  placeholder="Ex: iPhone 12"
/>
                        <datalist id="model-options">
                          {existingModels.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="block text sm font-medium text-gray-900">
                        Valeur du produit (€)
                      </label>
                      <input
  type="number"
  className="mt-1 block h-[38px] w-[30%] text-center rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
  value={article.value}
  onChange={(e) => handleArticleChange(article.id, 'value', parseFloat(e.target.value) || 0)}
/>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => saveArticle(article.id)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                        article.isModified
                          ? 'bg-orange-500 text-white animate-pulse hover:bg-orange-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      Enregistrer
                    </button>
                    {article.isSaved && (
                      <span className="text-green-600 text-sm font-medium flex items-center">
                        ✅ Enregistré
                      </span>
                    )}
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
                                Nom de la pièce ou prestation
                              </label>
                              <input
  type="text"
  list="part-options"
  className="mt-1 block w-full h-[38px] text-center rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
  value={part.name}
  onChange={(e) => handlePartChange(article.id, part.id, 'name', e.target.value)}
  placeholder="Ex: Batterie"
/>
                              <datalist id="part-options">
                                {existingParts.map((name) => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>

                            </div>

                            {/* Temps total */}
                            <div>
                              <label className="block text-sm font-medium text-gray-500">
                                Temps total (min)
                              </label>
                              <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
                                value={part.serviceTime}
                                onChange={(e) => handlePartChange(article.id, part.id, 'serviceTime', parseFloat(e.target.value) || 0)}
                              />
                            </div>

                            {/* Prix M.O. */}
                            <div>
                              <label className="block text-sm font-medium text-gray-500">
                                Main d'Oeuvre. (€)
                              </label>
                              <input
  type="text"
  readOnly
  className="mt-1 block w-full h-[38px] text-center rounded-md border-gray-300 bg-white shadow-sm text-sm"
  value={`${servicePrice.toFixed(2)}€`}
/>

                            </div>

                            {/* Prix réparation */}
                            <div className="col-span-1">
                              <label className="block text-sm font-medium text-gray-500">
                                Prix réparation (€)
                              </label>
                              <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
                                value={part.repairPrice ? Math.round(part.repairPrice) : ''}


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
  step="0.01"
  className={`block w-full rounded-l-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10 ${getColorClass('valuePct', part.valuePercentage)}`}
  value={(part.valuePercentage ?? 0).toFixed(2)}
  onChange={(e) => handleValuePercentageChange(article.id, part.id, parseFloat(e.target.value) || 0)}
  onBlur={(e) => {
    const val = Number(parseFloat(e.target.value).toFixed(2)) || 0;
    handleValuePercentageChange(article.id, part.id, val);
  }}
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
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
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
                                <div className={`w-full p-2 rounded-l-md bg-white border border-r-0 border-gray-300 text-sm ${getColorClass('netMarginPct', margins.netMarginPct)}`}>
                                  {margins.netMarginEur.toFixed(2)}€
                                </div>
                                <div className={`p-2 rounded-r-md bg-white border border-l-0 border-gray-300 text-sm ${getColorClass('netMarginPct', margins.netMarginPct)}`}>
                                  {margins.netMarginPct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Marge nette cible */}
                          <div className="w-24">
                            <label className="block text-sm font-medium text-gray-500">
                              Marge nette cible (€)
                            </label>
                            <input
                              type="number"
                              className="mt-1 block w-24 rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-center h-10"
                              value={part.targetNetMargin || ''}
                              onChange={(e) => handlePartChange(article.id, part.id, 'targetNetMargin', parseFloat(e.target.value) || 0)}
                              placeholder="Marge cible"
                            />
                          </div>

                          {/* Validation Error */}
                          {margins.validationError && (
                            <div className="mt-2 text-sm text-red-600">
                              {margins.validationError}
                            </div>
                          )}

                          {/* Delete Part Button */}
                          <div className="flex justify-end items-center space-x-2 mt-2">
                            <button
                              onClick={() => savePart(part.id)}
                              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                modifiedParts.has(part.id)
                                  ? 'bg-orange-500 text-white animate-pulse hover:bg-orange-600'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              Enregistrer
                            </button>
                            {savedParts.has(part.id) && (
                              <span className="text-green-600 text-sm font-medium flex items-center">
                                ✅ Enregistré
                              </span>
                            )}
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
