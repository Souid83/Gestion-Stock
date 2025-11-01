import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

// Type local pour l'insertion dans serial_product_margin_history
type SerialProductMarginHistoryInsert = {
  serial_product_id: string;
  marge_percent: number;
  marge_numeraire: number;
  modified_by?: string;
};

interface EditSerialProductFormProps {
  product: {
    id: string;
    serial_number: string | null;
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
  onClose: () => void;
  onUpdated: () => void;
}

export const EditSerialProductForm: React.FC<EditSerialProductFormProps> = ({
  product,
  onClose,
  onUpdated,
}) => {
  const [form, setForm] = useState({
    serial_number: product.serial_number || "",
    purchase_price_with_fees: product.purchase_price_with_fees ?? "",
    raw_purchase_price: product.raw_purchase_price ?? "",
    retail_price: product.retail_price ?? "",
    pro_price: product.pro_price ?? "",
    battery_level: product.battery_level ?? "",
    warranty_sticker: product.warranty_sticker || "",
    supplier: product.supplier || "",
    stock_id: product.stock_id || "",
    product_note: product.product_note || "",
    margin_value: "",
    margin_percent: "",
    pro_margin_value: "",
    pro_margin_percent: "",
    vat_type: product.vat_type || "normal",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculer les marges initiales
  useEffect(() => {
    console.log("Calculating initial margins");
    const pa = parseFloat(form.purchase_price_with_fees as any);
    const retailPrice = parseFloat(form.retail_price as any);
    const proPrice = parseFloat(form.pro_price as any);
    
    if (!isNaN(pa) && !isNaN(retailPrice)) {
      if (form.vat_type === "margin") {
        // TVA sur marge
        const margeNette = (retailPrice - pa) / 1.2;
        const percent = pa > 0 ? (margeNette / pa) * 100 : 0;
        
        setForm(prev => ({
          ...prev,
          margin_value: margeNette.toFixed(2),
          margin_percent: percent.toFixed(2)
        }));
        console.log(`Initial TVA marge retail: margeNette=${margeNette}, percent=${percent}`);
      } else {
        // TVA normale
        const marge = retailPrice - pa;
        const percent = pa > 0 ? (marge / pa) * 100 : 0;
        
        setForm(prev => ({
          ...prev,
          margin_value: marge.toFixed(2),
          margin_percent: percent.toFixed(2)
        }));
      }
    }
    
    if (!isNaN(pa) && !isNaN(proPrice)) {
      if (form.vat_type === "margin") {
        // TVA sur marge
        const margeNette = (proPrice - pa) / 1.2;
        const percent = pa > 0 ? (margeNette / pa) * 100 : 0;
        
        setForm(prev => ({
          ...prev,
          pro_margin_value: margeNette.toFixed(2),
          pro_margin_percent: percent.toFixed(2)
        }));
        console.log(`Initial TVA marge pro: margeNette=${margeNette}, percent=${percent}`);
      } else {
        // TVA normale
        const marge = proPrice - pa;
        const percent = pa > 0 ? (marge / pa) * 100 : 0;
        
        setForm(prev => ({
          ...prev,
          pro_margin_value: marge.toFixed(2),
          pro_margin_percent: percent.toFixed(2)
        }));
      }
    }
  }, [form.purchase_price_with_fees, form.retail_price, form.pro_price, form.vat_type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`Field changed: ${name} = ${value}`);
    
    // Logique spéciale pour les champs de prix et marges
    if (name === "retail_price" || name === "purchase_price_with_fees" || name === "margin_percent" || 
        name === "margin_value" || name === "pro_price" || name === "pro_margin_percent" || 
        name === "pro_margin_value" || name === "vat_type") {
      
      const pa = parseFloat(name === "purchase_price_with_fees" ? value : form.purchase_price_with_fees as any);
      
      if (isNaN(pa)) {
        setForm(prev => ({ ...prev, [name]: value }));
        return;
      }
      
      const vatType = name === "vat_type" ? value : form.vat_type;
      
      // Prix de vente magasin
      if (vatType === "margin") {
        // TVA sur marge
        if (name === "retail_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            // Quand l'utilisateur modifie le prix de vente TVM
            const margeNette = (pv - pa) / 1.2;
            const margePercent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              margin_value: margeNette.toFixed(2),
              margin_percent: margePercent.toFixed(2)
            }));
            console.log(`TVA marge - Prix modifié: margeNette=${margeNette}, margePercent=${margePercent}`);
            return;
          }
        } 
        else if (name === "margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            // Quand l'utilisateur modifie la marge %
            const margeNette = (pa * percent) / 100;
            const pv = pa + (margeNette * 1.2);
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              retail_price: pv.toFixed(2),
              margin_value: margeNette.toFixed(2)
            }));
            console.log(`TVA marge - Marge % modifiée: pv=${pv}, margeNette=${margeNette}`);
            return;
          }
        } 
        else if (name === "margin_value") {
          const margeNette = parseFloat(value);
          if (!isNaN(margeNette)) {
            // Quand l'utilisateur modifie la marge nette (€)
            const pv = pa + (margeNette * 1.2);
            const percent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              retail_price: pv.toFixed(2),
              margin_percent: percent.toFixed(2)
            }));
            console.log(`TVA marge - Marge € modifiée: pv=${pv}, percent=${percent}`);
            return;
          }
        }
        
        // Prix de vente pro
        if (name === "pro_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            // Quand l'utilisateur modifie le prix de vente pro TVM
            const margeNette = (pv - pa) / 1.2;
            const margePercent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_margin_value: margeNette.toFixed(2),
              pro_margin_percent: margePercent.toFixed(2)
            }));
            console.log(`TVA marge Pro - Prix modifié: margeNette=${margeNette}, margePercent=${margePercent}`);
            return;
          }
        } 
        else if (name === "pro_margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            // Quand l'utilisateur modifie la marge % pro
            const margeNette = (pa * percent) / 100;
            const pv = pa + (margeNette * 1.2);
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_price: pv.toFixed(2),
              pro_margin_value: margeNette.toFixed(2)
            }));
            console.log(`TVA marge Pro - Marge % modifiée: pv=${pv}, margeNette=${margeNette}`);
            return;
          }
        } 
        else if (name === "pro_margin_value") {
          const margeNette = parseFloat(value);
          if (!isNaN(margeNette)) {
            // Quand l'utilisateur modifie la marge nette pro (€)
            const pv = pa + (margeNette * 1.2);
            const percent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_price: pv.toFixed(2),
              pro_margin_percent: percent.toFixed(2)
            }));
            console.log(`TVA marge Pro - Marge € modifiée: pv=${pv}, percent=${percent}`);
            return;
          }
        }
      } else {
        // TVA normale
        if (name === "retail_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            const marge = pv - pa;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              margin_value: marge.toFixed(2),
              margin_percent: percent.toFixed(2)
            }));
            return;
          }
        } 
        else if (name === "margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            const pv = pa * (1 + percent / 100);
            const marge = pv - pa;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              retail_price: pv.toFixed(2),
              margin_value: marge.toFixed(2)
            }));
            return;
          }
        }
        else if (name === "margin_value") {
          const marge = parseFloat(value);
          if (!isNaN(marge)) {
            const pv = pa + marge;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              retail_price: pv.toFixed(2),
              margin_percent: percent.toFixed(2)
            }));
            return;
          }
        }
        
        // Prix pro
        if (name === "pro_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            const marge = pv - pa;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_margin_value: marge.toFixed(2),
              pro_margin_percent: percent.toFixed(2)
            }));
            return;
          }
        } 
        else if (name === "pro_margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            const pv = pa * (1 + percent / 100);
            const marge = pv - pa;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_price: pv.toFixed(2),
              pro_margin_value: marge.toFixed(2)
            }));
            return;
          }
        }
        else if (name === "pro_margin_value") {
          const marge = parseFloat(value);
          if (!isNaN(marge)) {
            const pv = pa + marge;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              [name]: value,
              pro_price: pv.toFixed(2),
              pro_margin_percent: percent.toFixed(2)
            }));
            return;
          }
        }
      }
      
      // Si on change juste le type de TVA, recalculer les marges
      if (name === "vat_type") {
        const retailPrice = parseFloat(form.retail_price as any);
        const proPrice = parseFloat(form.pro_price as any);
        
        if (!isNaN(retailPrice)) {
          if (value === "margin") {
            // Conversion vers TVA sur marge
            const margeNette = (retailPrice - pa) / 1.2;
            const margePercent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              vat_type: value,
              margin_value: margeNette.toFixed(2),
              margin_percent: margePercent.toFixed(2)
            }));
          } else {
            // Conversion vers TVA normale
            const marge = retailPrice - pa;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              vat_type: value,
              margin_value: marge.toFixed(2),
              margin_percent: percent.toFixed(2)
            }));
          }
        }
        
        if (!isNaN(proPrice)) {
          if (value === "margin") {
            // Conversion vers TVA sur marge
            const margeNette = (proPrice - pa) / 1.2;
            const margePercent = pa > 0 ? (margeNette / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              vat_type: value,
              pro_margin_value: margeNette.toFixed(2),
              pro_margin_percent: margePercent.toFixed(2)
            }));
          } else {
            // Conversion vers TVA normale
            const marge = proPrice - pa;
            const percent = pa > 0 ? (marge / pa) * 100 : 0;
            
            setForm(prev => ({
              ...prev,
              vat_type: value,
              pro_margin_value: marge.toFixed(2),
              pro_margin_percent: percent.toFixed(2)
            }));
          }
        }
        
        return;
      }
    }
    
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form with data:", form);
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          serial_number: form.serial_number,
          purchase_price_with_fees: form.purchase_price_with_fees === "" ? null : Number(form.purchase_price_with_fees),
          raw_purchase_price: form.raw_purchase_price === "" ? null : Number(form.raw_purchase_price),
          retail_price: form.retail_price === "" ? null : Number(form.retail_price),
          pro_price: form.pro_price === "" ? null : Number(form.pro_price),
          battery_level: form.battery_level === "" ? null : Number(form.battery_level),
          warranty_sticker: form.warranty_sticker,
          supplier: form.supplier,
          stock_id: form.stock_id,
          product_note: form.product_note,
          vat_type: form.vat_type,
        })
        .eq("id", product.id);
      if (error) throw error;
      // Calcul de la marge numéraire et du pourcentage (sur prix de vente magasin)
      const retailPrice = form.retail_price === "" ? null : Number(form.retail_price);
      const purchasePrice = form.purchase_price_with_fees === "" ? null : Number(form.purchase_price_with_fees);

      if (retailPrice !== null && purchasePrice !== null) {
        // Calcul TVA sur marge
        let marge_percent, marge_numeraire;
        
        if (form.vat_type === "margin") {
          // TVA sur marge
          const margeNette = (retailPrice - purchasePrice) / 1.2;
          marge_percent = purchasePrice !== 0 ? (margeNette / purchasePrice) * 100 : 0;
          marge_numeraire = margeNette;
          console.log(`Saving TVA marge: margeNette=${margeNette}, marge_percent=${marge_percent}`);
        } else {
          // TVA normale
          const marge = retailPrice - purchasePrice;
          marge_percent = purchasePrice !== 0 ? (marge / purchasePrice) * 100 : 0;
          marge_numeraire = marge;
        }

        // Insertion dans l'historique des marges
        const marginInsert: SerialProductMarginHistoryInsert = {
          serial_product_id: product.id,
          marge_percent,
          marge_numeraire,
          // modified_by: ... // à compléter si tu as l'id utilisateur
        };
        console.log("Tentative insertion historique marge :", marginInsert);
        const { data: marginData, error: marginError } = await supabase
          .from("serial_product_margin_history")
          .insert([marginInsert as any]);
        console.log("Résultat insertion historique marge :", { marginData, marginError });
        if (marginError) {
          console.error("Erreur insertion historique marge :", marginError);
          setError("Erreur lors de la sauvegarde de la marge : " + marginError.message);
        }

        // Correction : upsert dans serial_product_margin_last pour affichage immédiat
        await supabase
          .from("serial_product_margin_last")
          .upsert([{
            serial_product_id: product.id,
            marge_percent,
            marge_numeraire,
            modified_at: new Date().toISOString()
          }] as any);
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

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
              onChange={handleChange}
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
          <div>
            <label className="block text-sm font-medium mb-1">Type de TVA</label>
            <select
              name="vat_type"
              value={form.vat_type}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="normal">TVA normale</option>
              <option value="margin">TVA sur marge</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix de vente magasin</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.vat_type === "margin" ? "Prix vente TVM" : "Prix HT"}
                </label>
                <input
                  type="number"
                  name="retail_price"
                  value={form.retail_price}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Marge %</label>
                <input
                  type="number"
                  name="margin_percent"
                  value={form.margin_percent}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded text-green-600"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Marge nette (€)</label>
                <input
                  type="number"
                  name="margin_value"
                  value={form.margin_value}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix de vente pro</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.vat_type === "margin" ? "Prix vente TVM" : "Prix HT"}
                </label>
                <input
                  type="number"
                  name="pro_price"
                  value={form.pro_price}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Marge %</label>
                <input
                  type="number"
                  name="pro_margin_percent"
                  value={form.pro_margin_percent}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded text-green-600"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Marge nette (€)</label>
                <input
                  type="number"
                  name="pro_margin_value"
                  value={form.pro_margin_value}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded"
                  step="0.01"
                />
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
            <label className="block text-sm font-medium mb-1">Sticker garantie</label>
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
            <label className="block text-sm font-medium mb-1">Stock ID</label>
            <input
              type="text"
              name="stock_id"
              value={form.stock_id}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              maxLength={64}
            />
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