import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import {
  calculateMarginFromSellingPrice_Margin,
  calculateMarginFromPercent_Margin,
  calculateMarginFromValue_Margin,
} from "./MarginCalculator";

interface SerialProductFormModalProps {
  initialValues: {
    id: string;
    name: string;
    sku: string;
    serial_number: string;
    purchase_price_with_fees: number | null;
    raw_purchase_price: number | null;
    retail_price: number | null;
    pro_price: number | null;
    battery_level: number | null;
    warranty_sticker: string | null;
    supplier: string | null;
    stock_id: string | null;
    product_note: string | null;
    vat_type: "normal" | "margin";
  };
  stocks: { id: string; name: string; group: { name: string; synchronizable: boolean }[] }[];
  onClose: () => void;
  onUpdated: () => void;
}

type MarginFields = {
  price: string; // Prix de vente HT (ou TVM)
  percent: string; // Marge %
  value: string; // Marge nette numéraire
};

type UserTouched = {
  price: boolean;
  percent: boolean;
  value: boolean;
};

function formatNumber(val: number | string | null): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return num.toFixed(2);
}

export const SerialProductFormModal: React.FC<SerialProductFormModalProps> = ({
  initialValues,
  stocks,
  onClose,
  onUpdated,
}) => {
  // Form principal
  const [form, setForm] = useState({
    serial_number: initialValues.serial_number || "",
    purchase_price_with_fees: initialValues.purchase_price_with_fees ?? "",
    raw_purchase_price: initialValues.raw_purchase_price ?? "",
    battery_level: initialValues.battery_level ?? "",
    warranty_sticker: initialValues.warranty_sticker || "",
    supplier: initialValues.supplier || "",
    stock_id: initialValues.stock_id || "",
    product_note: initialValues.product_note || "",
    vat_type: initialValues.vat_type,
  });

  // Champs de marge magasin
  const [retail, setRetail] = useState<MarginFields>({
    price: initialValues.retail_price !== null && initialValues.vat_type === "normal"
      ? formatNumber(initialValues.retail_price / 1.2)
      : initialValues.retail_price !== null
        ? formatNumber(initialValues.retail_price)
        : "",
    percent: "",
    value: "",
  });
  // Champs de marge pro
  const [pro, setPro] = useState<MarginFields>({
    price: initialValues.pro_price !== null && initialValues.vat_type === "normal"
      ? formatNumber(initialValues.pro_price / 1.2)
      : initialValues.pro_price !== null
        ? formatNumber(initialValues.pro_price)
        : "",
    percent: "",
    value: "",
  });

  // Champs touchés par l'utilisateur
  const [retailTouched, setRetailTouched] = useState<UserTouched>({
    price: false,
    percent: false,
    value: false,
  });
  const [proTouched, setProTouched] = useState<UserTouched>({
    price: false,
    percent: false,
    value: false,
  });

  // Chargement initial des marges depuis Supabase
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedInitialMargins, setHasLoadedInitialMargins] = useState(false);
  // Clé pour forcer le rechargement des marges à chaque ouverture
  const [reloadKey, setReloadKey] = useState(0);

  // Pour éviter les recalculs lors du chargement initial
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let ignore = false;
    const fetchLastMargin = async () => {
      console.log("Fetching last margin for product ID:", initialValues.id);
      const { data, error } = await (supabase
        .from("serial_product_margin_last")
        .select("marge_percent, marge_numeraire, pro_marge_percent, pro_marge_numeraire")
        .eq("serial_product_id", initialValues.id)
        .single() as any);
      
      console.log("Margin data fetched:", data, "Error:", error);
      
      if (!ignore && !error && data) {
        setRetail((prev) => ({
          price: prev.price,
          percent: data.marge_percent !== null && data.marge_percent !== undefined ? formatNumber(data.marge_percent) : "",
          value: data.marge_numeraire !== null && data.marge_numeraire !== undefined ? formatNumber(data.marge_numeraire) : "",
        }));
        setPro((prev) => ({
          price: prev.price,
          percent: data.pro_marge_percent !== null && data.pro_marge_percent !== undefined ? formatNumber(data.pro_marge_percent) : "",
          value: data.pro_marge_numeraire !== null && data.pro_marge_numeraire !== undefined ? formatNumber(data.pro_marge_numeraire) : "",
        }));
      }
      setHasLoadedInitialMargins(true);
    };
    fetchLastMargin();
    return () => { ignore = true; };
    // eslint-disable-next-line
  }, [initialValues.id, reloadKey]);

  // Empêcher tout recalcul automatique lors du chargement initial
  useEffect(() => {
    if (isFirstLoad.current && hasLoadedInitialMargins) {
      isFirstLoad.current = false;
    }
  }, [hasLoadedInitialMargins]);

  // Handlers principaux pour les champs de marge magasin
  const handleRetailChange = (field: keyof MarginFields, value: string) => {
    setRetailTouched((prev) => ({ ...prev, [field]: true }));
    const purchase = parseFloat(form.purchase_price_with_fees as any);
    if (isNaN(purchase) || purchase === 0) {
      setRetail((prev) => ({ ...prev, [field]: value }));
      return;
    }

    if (field === "percent") {
      // L'utilisateur modifie la marge %
      setRetail((prev) => {
        if (value === "") return { ...prev, percent: "" };
        const percent = parseFloat(value);
        if (isNaN(percent)) return { ...prev, percent: value };
        if (form.vat_type === "normal") {
          // Correction : marge sur coût (formule classique)
          const ht = (purchase + (purchase * percent / 100)).toFixed(2);
          return {
            price: ht,
            percent: value,
            value: (parseFloat(ht) - purchase).toFixed(2),
          };
        } else {
          // Marge sur coût (TVA marge)
          const result = calculateMarginFromPercent_Margin(purchase, percent);
          return {
            price: formatNumber(result.sellingPrice),
            percent: value,
            value: formatNumber(result.marginValue),
          };
        }
      });
    } else if (field === "value") {
      // L'utilisateur modifie la marge nette
      setRetail((prev) => {
        if (value === "") return { ...prev, value: "" };
        const marginValue = parseFloat(value);
        if (isNaN(marginValue)) return { ...prev, value: value };
        const result = calculateMarginFromValue_Margin(purchase, marginValue);
        return {
          price: formatNumber(result.sellingPrice),
          percent: formatNumber(result.marginPercent),
          value: value,
        };
      });
    } else if (field === "price") {
      // L'utilisateur modifie le prix de vente HT/TVM
      setRetail((prev) => {
        if (value === "") return { ...prev, price: "" };
        const price = parseFloat(value);
        if (isNaN(price)) return { ...prev, price: value };
        const result = calculateMarginFromSellingPrice_Margin(purchase, price);
        return {
          price: value,
          percent: formatNumber(result.marginPercent),
          value: formatNumber(result.marginValue),
        };
      });
    }
  };

  // Handlers principaux pour les champs de marge pro
  const handleProChange = (field: keyof MarginFields, value: string) => {
    setProTouched((prev) => ({ ...prev, [field]: true }));
    const purchase = parseFloat(form.purchase_price_with_fees as any);
    if (isNaN(purchase) || purchase === 0) {
      setPro((prev) => ({ ...prev, [field]: value }));
      return;
    }

    if (field === "percent") {
      setPro((prev) => {
        if (value === "") return { ...prev, percent: "" };
        const percent = parseFloat(value);
        if (isNaN(percent)) return { ...prev, percent: value };
        if (form.vat_type === "normal") {
          // Correction : marge sur coût (formule classique)
          const ht = (purchase + (purchase * percent / 100)).toFixed(2);
          return {
            price: ht,
            percent: value,
            value: (parseFloat(ht) - purchase).toFixed(2),
          };
        } else {
          const result = calculateMarginFromPercent_Margin(purchase, percent);
          return {
            price: formatNumber(result.sellingPrice),
            percent: value,
            value: formatNumber(result.marginValue),
          };
        }
      });
    } else if (field === "value") {
      setPro((prev) => {
        if (value === "") return { ...prev, value: "" };
        const marginValue = parseFloat(value);
        if (isNaN(marginValue)) return { ...prev, value: value };
        const result = calculateMarginFromValue_Margin(purchase, marginValue);
        return {
          price: formatNumber(result.sellingPrice),
          percent: formatNumber(result.marginPercent),
          value: value,
        };
      });
    } else if (field === "price") {
      setPro((prev) => {
        if (value === "") return { ...prev, price: "" };
        const price = parseFloat(value);
        if (isNaN(price)) return { ...prev, price: value };
        const result = calculateMarginFromSellingPrice_Margin(purchase, price);
        return {
          price: value,
          percent: formatNumber(result.marginPercent),
          value: formatNumber(result.marginValue),
        };
      });
    }
  };

  // Handler générique pour les autres champs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handler pour le changement de type de TVA : reset des marges
  const handleVatTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as "normal" | "margin";
    setForm((prev) => ({
      ...prev,
      vat_type: value,
    }));
    // On ne recalcule rien, on garde les valeurs actuelles
  };

  // Handler pour le changement du prix d'achat : reset des marges
  const handlePurchasePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      purchase_price_with_fees: value,
    }));
    // On ne recalcule rien, on garde les valeurs actuelles
  };

  // Handler pour le submit (inchangé)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let retailPrice = "";
      let proPrice = "";
      if (form.vat_type === "margin") {
        retailPrice = retail.price;
        proPrice = pro.price;
      } else {
        // Correction stricte : toujours enregistrer en base le prix TTC (champ saisi = HT)
        retailPrice = retail.price === "" ? "" : (parseFloat(retail.price) * 1.2).toFixed(2);
        proPrice = pro.price === "" ? "" : (parseFloat(pro.price) * 1.2).toFixed(2);
      }

      const { error } = await supabase
        .from("products")
        .update({
          serial_number: form.serial_number,
          purchase_price_with_fees: form.purchase_price_with_fees === "" ? null : Number(form.purchase_price_with_fees),
          raw_purchase_price: form.raw_purchase_price === "" ? null : Number(form.raw_purchase_price),
          retail_price: retailPrice === "" ? null : Number(retailPrice),
          pro_price: proPrice === "" ? null : Number(proPrice),
          battery_level: form.battery_level === "" ? null : Number(form.battery_level),
          warranty_sticker: form.warranty_sticker,
          supplier: form.supplier,
          stock_id: form.stock_id,
          product_note: form.product_note,
          vat_type: form.vat_type,
        })
        .eq("id", initialValues.id);
      if (error) throw error;

      // Enregistrer les marges telles que saisies/affichées (pas de recalcul)
      await (supabase
        .from("serial_product_margin_last")
        .upsert([{
          serial_product_id: initialValues.id,
          marge_percent: retail.percent === "" ? null : Number(retail.percent),
          marge_numeraire: retail.value === "" ? null : Number(retail.value),
          pro_marge_percent: pro.percent === "" ? null : Number(pro.percent),
          pro_marge_numeraire: pro.value === "" ? null : Number(pro.value),
          modified_at: new Date().toISOString()
        }] as any));

      // Correction ultime : fetch différé de la marge pour affichage fiable (éviter race condition)
      setTimeout(async () => {
        const { data: marginData } = await supabase
          .from("serial_product_margin_last")
          .select("marge_percent, marge_numeraire, pro_marge_percent, pro_marge_numeraire")
          .eq("serial_product_id", initialValues.id)
          .single();

        if (form.vat_type === "margin" && marginData) {
          setRetail(prev => ({
            ...prev,
            percent: marginData.marge_percent !== null && marginData.marge_percent !== undefined ? formatNumber(marginData.marge_percent) : "",
            value: marginData.marge_numeraire !== null && marginData.marge_numeraire !== undefined ? formatNumber(marginData.marge_numeraire) : "",
          }));
          setPro(prev => ({
            ...prev,
            percent: marginData.pro_marge_percent !== null && marginData.pro_marge_percent !== undefined ? formatNumber(marginData.pro_marge_percent) : "",
            value: marginData.pro_marge_numeraire !== null && marginData.pro_marge_numeraire !== undefined ? formatNumber(marginData.pro_marge_numeraire) : "",
          }));
        } else {
          setRetail(prev => ({
            ...prev,
            percent: retail.percent,
            value: retail.value
          }));
          setPro(prev => ({
            ...prev,
            percent: pro.percent,
            value: pro.value
          }));
        }
        setReloadKey(k => k + 1);
      }, 500);

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  // Affichage
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Modifier le produit enfant (numéro de série)</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Numéro de série</label>
            <input
              type="text"
              name="serial_number"
              value={form.serial_number}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              maxLength={32}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix d'achat avec frais</label>
            <input
              type="number"
              name="purchase_price_with_fees"
              value={form.purchase_price_with_fees}
              onChange={handlePurchasePriceChange}
              className="w-full border px-3 py-2 rounded"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix d'achat brut</label>
            <input
              type="number"
              name="raw_purchase_price"
              value={form.raw_purchase_price}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              step="0.01"
            />
          </div>
          {/* Prix de vente magasin */}
          <div>
            <label className="block text-sm font-medium mb-1">Prix de vente magasin *</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.vat_type === "normal"
                    ? "Prix de vente HT"
                    : "Prix de vente TVM"}
                </label>
                <input
                  type="text"
                  value={retail.price}
                  onChange={e => handleRetailChange("price", e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
                {form.vat_type === "normal" && retail.price !== "" && (
                  <div className="text-xs text-gray-500 mt-1">
                    Prix TTC : {formatNumber(Number(retail.price) * 1.2)} €
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge %
                </label>
                <input
                  type="text"
                  value={retail.percent}
                  onChange={e => handleRetailChange("percent", e.target.value)}
                  className="w-full border px-3 py-2 rounded text-green-600"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">%</span>
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge nette
                </label>
                <input
                  type="text"
                  value={retail.value}
                  onChange={e => handleRetailChange("value", e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
              </div>
            </div>
          </div>
          {/* Prix de vente pro */}
          <div>
            <label className="block text-sm font-medium mb-1">Prix de vente pro *</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.vat_type === "normal"
                    ? "Prix de vente HT"
                    : "Prix de vente TVM"}
                </label>
                <input
                  type="text"
                  value={pro.price}
                  onChange={e => handleProChange("price", e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
                {form.vat_type === "normal" && pro.price !== "" && (
                  <div className="text-xs text-gray-500 mt-1">
                    Prix TTC : {formatNumber(Number(pro.price) * 1.2)} €
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge %
                </label>
                <input
                  type="text"
                  value={pro.percent}
                  onChange={e => handleProChange("percent", e.target.value)}
                  className="w-full border px-3 py-2 rounded text-green-600"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">%</span>
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge nette
                </label>
                <input
                  type="text"
                  value={pro.value}
                  onChange={e => handleProChange("value", e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Niveau batterie (%)</label>
            <input
              type="number"
              name="battery_level"
              value={form.battery_level}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sticker de garantie</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="warranty_sticker"
                  value="present"
                  checked={form.warranty_sticker === "present"}
                  onChange={() => setForm(prev => ({ ...prev, warranty_sticker: "present" }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  required
                />
                <span className="ml-2">Présent</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="warranty_sticker"
                  value="absent"
                  checked={form.warranty_sticker === "absent"}
                  onChange={() => setForm(prev => ({ ...prev, warranty_sticker: "absent" }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  required
                />
                <span className="ml-2">Absent</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fournisseur</label>
            <input
              type="text"
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              maxLength={64}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stock</label>
            <select
              name="stock_id"
              value={form.stock_id}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">Sélectionner un stock</option>
              {stocks.map(stock => (
                <option key={stock.id} value={stock.id}>
                  {stock.name} {stock.group.length > 0 ? `(${stock.group[0].name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <textarea
              name="product_note"
              value={form.product_note}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              rows={2}
              maxLength={256}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type de TVA</label>
            <select
              name="vat_type"
              value={form.vat_type}
              onChange={handleVatTypeChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="normal">TVA normale</option>
              <option value="margin">TVA sur marge</option>
            </select>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
