import React, { useEffect, useState } from 'react';
import { X, Upload, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCategoryStore } from '../../store/categoryStore';
import { useCSVImport } from '../../hooks/useCSVImport';
import { ImportDialog } from '../ImportProgress/ImportDialog';

interface MirrorCSVImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // called after successful import to refresh listing
}

/**
 * Encode a csv cell with RFC4180 quotes escaping rules
 */
const encodeCSVCell = (cell: string): string => {
  const s = String(cell ?? '');
  if (s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Robust CSV parser (RFC 4180-like)
 */
const parseCSV = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\n') {
        row.push(cell.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }

  return rows;
};

export const MirrorCSVImport: React.FC<MirrorCSVImportProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const { addCategory } = useCategoryStore();

  // Import progress dialog
  const {
    importState,
    startImport,
    incrementProgress,
    setImportSuccess,
    setImportError,
    closeDialog
  } = useCSVImport();

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview([]);
      setUiError(null);
    }
  }, [isOpen]);

  const norm = (s: string) =>
    (s || '')
      .replace(/\u00A0/g, ' ')
      .trim();

  const upper = (s: string) => norm(s).toUpperCase();

  const handleDownloadTemplate = () => {
    const headers = [
      'parent_sku',
      'parent_name',
      'child_sku',
      'child_name',
      'description',
      'category_type',
      'category_brand',
      'category_model'
    ];
    const rows = [
      ['PARENT001', 'Exemple Parent', 'CHILD001', 'Nom Enfant 1', 'Description enfant 1', 'SMARTPHONE', 'APPLE', 'IPHONE 12'],
      ['PARENT001', 'Exemple Parent', 'CHILD002', 'Nom Enfant 2', 'Description enfant 2, avec virgule', 'SMARTPHONE', 'APPLE', 'IPHONE 12']
    ];
    const csv = [
      headers.map(encodeCSVCell).join(','),
      ...rows.map(r => r.map(encodeCSVCell).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mirrors_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setUiError(null);
    setPreview([]);

    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const data = parseCSV(text);
        setPreview(data.slice(0, 5));
      } catch (e) {
        console.error('CSV preview parse error:', e);
        setUiError('Erreur lors de la lecture du fichier CSV');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) {
      setUiError('Veuillez sélectionner un fichier CSV');
      return;
    }

    setIsLoading(true);
    setUiError(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);
      if (data.length < 2) {
        setUiError('Le fichier CSV est vide');
        setIsLoading(false);
        return;
      }

      const headers = data[0].map(h => norm(h).toLowerCase());

      // Robust header index resolver:
      // 1) exact match first
      // 2) then bounded fuzzy match with word/underscore boundaries
      // Also allow excluding headers that contain certain substrings (e.g., avoid matching "parent_name" when searching "name")
      const hIndex = (keys: string[], opts?: { excludeContains?: string[] }) => {
        const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // exact match
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          for (const k of keys) {
            if (h === k) return i;
          }
        }
        // bounded fuzzy with exclusions
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          if (opts?.excludeContains && opts.excludeContains.some(ex => h.includes(ex))) continue;
          for (const k of keys) {
            const re = new RegExp(`(^|[ _-])${esc(k)}($|[ _-])`);
            if (re.test(h)) return i;
          }
        }
        return -1;
      };

      const iParentSku = hIndex(['parent_sku', 'parent sku']);
      const iParentName = hIndex(['parent_name', 'parent name']); // informative only
      const iChildSku = hIndex(['child_sku', 'child sku', 'sku_enfant', 'sku enfant']);
      // IMPORTANT: exclude headers that contain "parent_" or "parent " to avoid matching parent_name as child_name
      const iChildName = hIndex(['child_name', 'child name', 'name', 'nom'], { excludeContains: ['parent_', 'parent '] });
      const iDesc = hIndex(['description', 'desc']);
      const iType = hIndex(['category_type', 'type']);
      const iBrand = hIndex(['category_brand', 'brand', 'marque']);
      const iModel = hIndex(['category_model', 'model', 'modèle', 'modele']);

      if (iChildSku === -1) {
        setUiError('Colonne "child_sku" manquante');
        setIsLoading(false);
        return;
      }

      const rows = data.slice(1);
      startImport(rows.length);

      const parentCache: Record<string, any> = {};
      const categoryCache: Record<string, string> = {};
      const rejections: { line: number; message: string }[] = [];
      let created = 0;
      let updated = 0;

      const resolveParentBySku = async (skuUpper: string) => {
        if (!skuUpper) return null;
        if (parentCache[skuUpper]) return parentCache[skuUpper];

        const { data: found } = await supabase
          .from('products')
          .select('id, sku, name, parent_id, description, purchase_price_with_fees, raw_purchase_price, retail_price, pro_price, stock_alert, location, vat_type, margin_percent, margin_value, pro_margin_percent, pro_margin_value, weight_grams, ean, width_cm, height_cm, depth_cm, category_id, shipping_box_id')
          .ilike('sku', skuUpper)
          .maybeSingle();

        if (!found) {
          parentCache[skuUpper] = null;
          return null;
        }

        // Climb to root if needed
        let root: any = found;
        while (root && root.parent_id) {
          const { data: next } = await supabase
            .from('products')
          .select('id, sku, name, parent_id, description, purchase_price_with_fees, raw_purchase_price, retail_price, pro_price, stock_alert, location, vat_type, margin_percent, margin_value, pro_margin_percent, pro_margin_value, weight_grams, ean, width_cm, height_cm, depth_cm, category_id, shipping_box_id')
            .eq('id', root.parent_id as any)
            .maybeSingle();
          if (!next) break;
          root = next;
        }
        parentCache[skuUpper] = root;
        return root;
      };

      const resolveCategoryId = async (type: string, brand: string, model: string): Promise<string | null> => {
        const key = `${type}|${brand}|${model}`;
        if (categoryCache[key]) return categoryCache[key];
        try {
          const cat = await addCategory({ type, brand, model });
          const id = (cat as any)?.id ?? null;
          if (id) categoryCache[key] = id;
          return id;
        } catch (e) {
          // fallback lookup
          const { data } = await supabase
            .from('product_categories')
            .select('id')
            .eq('type', type as any)
            .eq('brand', brand as any)
            .eq('model', model as any)
            .maybeSingle();
          const id = (data as any)?.id ?? null;
          if (id) categoryCache[key] = id;
          return id;
        }
      };

      for (let i = 0; i < rows.length; i++) {
        const lineNo = i + 2; // accounting for header line
        const row = rows[i] || [];
        try {
          const parentSkuRaw = iParentSku !== -1 ? row[iParentSku] || '' : '';
          const childSkuRaw = iChildSku !== -1 ? row[iChildSku] || '' : '';
          const childNameRaw = iChildName !== -1 ? row[iChildName] || '' : '';
          const descRaw = iDesc !== -1 ? row[iDesc] || '' : '';
          const typeRaw = iType !== -1 ? row[iType] || '' : '';
          const brandRaw = iBrand !== -1 ? row[iBrand] || '' : '';
          const modelRaw = iModel !== -1 ? row[iModel] || '' : '';

          const parentSku = upper(parentSkuRaw);
          const childSku = upper(childSkuRaw);
          const childName = norm(childNameRaw);
          const description = norm(descRaw);
          const catType = upper(typeRaw);
          const catBrand = upper(brandRaw);
          const catModel = upper(modelRaw);

          if (!childSku) {
            rejections.push({ line: lineNo, message: 'child_sku manquant' });
            incrementProgress();
            continue;
          }

          // Check if child exists
          const { data: existingChild } = await supabase
            .from('products')
            .select('id, sku, name, mirror_of, serial_number, category_id')
            .ilike('sku', childSku)
            .maybeSingle();

            if (existingChild) {
              const childAny = existingChild as any;
              // must be mirror non-serialized
              if (!(childAny.mirror_of && !childAny.serial_number)) {
                rejections.push({ line: lineNo, message: `SKU "${childSku}" existe mais n'est pas un miroir` });
                incrementProgress();
                continue;
              }
            // if parent_sku provided, ensure same parent (no reparenting)
            if (parentSku) {
              const { data: currentParent } = await supabase
                .from('products')
                .select('id, sku')
                .eq('id', childAny.mirror_of as any)
                .maybeSingle();
              const currentParentSku = upper(((((currentParent as any) || {})?.sku || '') as string));
              if (currentParentSku && parentSku && currentParentSku !== parentSku) {
                rejections.push({ line: lineNo, message: `Reparenting interdit: parent actuel ${currentParentSku} ≠ import ${parentSku} (SKU enfant ${childSku})` });
                incrementProgress();
                continue;
              }
            }

            // Prepare updates (SKU child is immutable)
            const updates: any = {};
            if (childName) updates.name = childName;
            if (description) updates.description = description;
            if (catType && catBrand && catModel) {
              const cid = await resolveCategoryId(catType, catBrand, catModel);
              if (cid) updates.category_id = cid;
            }

            if (Object.keys(updates).length > 0) {
              const { error: upErr } = await supabase
                .from('products')
                .update(updates as any)
                .eq('id', childAny.id as any);
              if (upErr) {
                rejections.push({ line: lineNo, message: `Erreur update ${childSku}: ${upErr.message}` });
                incrementProgress();
                continue;
              }
              updated += 1;
            } // else nothing to update
            incrementProgress();
            continue;
          }

          // Creation path
          if (!parentSku) {
            rejections.push({ line: lineNo, message: `parent_sku requis pour créer ${childSku}` });
            incrementProgress();
            continue;
          }
          if (!childName) {
            rejections.push({ line: lineNo, message: `child_name requis pour créer ${childSku}` });
            incrementProgress();
            continue;
          }

          const parent = await resolveParentBySku(parentSku);
          if (!parent) {
            rejections.push({ line: lineNo, message: `parent_sku introuvable (${parentSku}) pour ${childSku}` });
            incrementProgress();
            continue;
          }

          let categoryId: string | null = parent.category_id ?? null;
          if (catType && catBrand && catModel) {
            const cid = await resolveCategoryId(catType, catBrand, catModel);
            if (cid) categoryId = cid;
          }

          // Build payload (inherit from parent) with safe fallbacks for NOT NULL numeric fields
          const nz = (v: any, def: number = 0) => (typeof v === 'number' && isFinite(v) ? v : def);
          const payload: any = {
            name: childName,
            sku: childSku,
            description: description || parent.description || null,
            // IMPORTANT: coalesce NOT NULL numeric fields to 0 to avoid 23502
            purchase_price_with_fees: nz(parent.purchase_price_with_fees, 0),
            raw_purchase_price: parent.raw_purchase_price ?? null,
            retail_price: nz(parent.retail_price, 0),
            pro_price: nz(parent.pro_price, 0),
            stock_alert: parent.stock_alert ?? null,
            location: parent.location ?? null,
            vat_type: parent.vat_type ?? 'normal',
            margin_percent: parent.margin_percent ?? null,
            margin_value: parent.margin_value ?? null,
            pro_margin_percent: parent.pro_margin_percent ?? null,
            pro_margin_value: parent.pro_margin_value ?? null,
            weight_grams: typeof parent.weight_grams === 'number' ? parent.weight_grams : null,
            ean: parent.ean ?? null,
            width_cm: typeof parent.width_cm === 'number' ? parent.width_cm : null,
            height_cm: typeof parent.height_cm === 'number' ? parent.height_cm : null,
            depth_cm: typeof parent.depth_cm === 'number' ? parent.depth_cm : null,
            category_id: categoryId ?? parent.category_id ?? null,
            shipping_box_id: parent.shipping_box_id ?? null,
            serial_number: null,
            mirror_of: parent.id
          };

          const { error: insErr } = await supabase
            .from('products')
            .insert([payload as any])
            .select('id')
            .single();

          if (insErr) {
            rejections.push({ line: lineNo, message: `Erreur création ${childSku}: ${insErr.message}` });
            incrementProgress();
            continue;
          }
          created += 1;
          incrementProgress();
        } catch (e: any) {
          rejections.push({ line: lineNo, message: `Erreur ligne ${lineNo}: ${e?.message || 'inconnue'}` });
          incrementProgress();
        }
      }

      const summary = `Import terminé: ${created} créé(s), ${updated} mis à jour, ${rejections.length} rejet(s).`;
      if (rejections.length > 0) {
        setImportError([
          { line: 0, message: summary },
          ...rejections
        ]);
      } else {
        setImportSuccess(summary);
      }

      // Success callback (refresh)
      onSuccess();
      setIsLoading(false);
    } catch (e: any) {
      console.error('Mirror import error:', e);
      setUiError(e?.message || 'Erreur inconnue lors de l\'import');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Import CSV — Produits miroirs</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={22} />
          </button>
        </div>

        <div className="mb-3 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            Format attendu: parent_sku, parent_name, child_sku, child_name, description, category_type, category_brand, category_model
          </p>
          <p className="text-xs text-blue-700">
            Règles: SKU enfant immuable. Reparenting interdit. Création possible si parent_sku existe et child_sku inconnu.
          </p>
        </div>

        {uiError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded flex items-center gap-2">
            <AlertCircle size={16} /> <span className="text-sm">{uiError}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block text-sm font-medium text-gray-700 mb-1">Fichier CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </label>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
            >
              <Download size={16} />
              Modèle CSV
            </button>
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Aperçu (5 premières lignes)</h3>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full border-collapse">
                  <tbody>
                    {preview.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'bg-gray-100 font-medium' : ''}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1 border text-xs">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={!file || isLoading}
              className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Upload size={16} />
              {isLoading ? 'Import en cours…' : 'Importer'}
            </button>
          </div>
        </div>

        {/* Import progress dialog */}
        <ImportDialog
          isOpen={importState.isDialogOpen}
          onClose={closeDialog}
          current={importState.current}
          total={importState.total}
          status={importState.status}
          errors={importState.errors}
          successMessage={importState.successMessage}
        />
      </div>
    </div>
  );
};

export default MirrorCSVImport;
