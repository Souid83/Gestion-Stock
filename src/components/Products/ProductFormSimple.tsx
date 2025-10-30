console.log("LOADED: ProductFormSimple");

import React, { useState, useEffect } from 'react';
import { useProductStore } from '../../store/productStore';
import { useCategoryStore } from '../../store/categoryStore';
import {
  calculateMarginFromSellingPrice_Margin,
  calculateMarginFromPercent_Margin,
  calculateMarginFromValue_Margin,
  calculateMarginFromSellingPrice_Normal,
  calculateMarginFromPercent_Normal,
  calculateMarginFromValue_Normal,
} from './MarginCalculator';

const ProductFormSimple = () => {
  const { addProduct } = useProductStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    purchase_price: '',
    retail_price: '',
    pro_price: '',
    weight: '',
    ean: '',
    description: '',
    stock_alert: '',
    current_stock: '',
    location: '',
    category_type: '',
    category_brand: '',
    category_model: '',
    vat_type: 'normal', // Ajout du type de TVA (normal par défaut)
    margin_percent: '',
    margin_value: '',
    pro_margin_percent: '',
    pro_margin_value: ''
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    console.log(`Field changed: ${name} = ${value}`);
    
    // Logique dynamique pour les marges/prix selon TVA
    if (["retail_price", "purchase_price", "margin_percent", "margin_value", "pro_price", "pro_margin_percent", "pro_margin_value", "vat_type"].includes(name)) {
      let newForm = { ...formData, [name]: value };
      const pa = parseFloat(newForm.purchase_price);
      const vat = newForm.vat_type;

      if (isNaN(pa)) {
        setFormData(newForm);
        return;
      }

      // --- Prix de vente magasin ---
      if (vat === "margin") {
        if (name === "retail_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            // Marge brute = prix vente TTC - prix achat
            const margeBrute = pv - pa;
            // Marge nette = marge brute / 1.2
            const margeNette = margeBrute / 1.2;
            // Marge % = (marge nette / prix achat) * 100
            const margePercent = pa > 0 ? (margeNette / pa) * 100 : 0;
            newForm.margin_value = margeNette.toFixed(2);
            newForm.margin_percent = margePercent.toFixed(2);
          }
        } else if (name === "margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            // Marge nette = (prix achat * marge %) / 100
            const margeNette = (pa * percent) / 100;
            // Prix de vente TTC = prix achat + (marge nette * 1.2)
            const pv = pa + (margeNette * 1.2);
            newForm.retail_price = pv.toFixed(2);
            newForm.margin_value = margeNette.toFixed(2);
          }
        } else if (name === "margin_value") {
          const margeNette = parseFloat(value);
          if (!isNaN(margeNette)) {
            // Prix de vente TTC = prix achat + (marge nette * 1.2)
            const pv = pa + (margeNette * 1.2);
            // Marge % = (marge nette / prix achat) * 100
            const percent = pa > 0 ? (margeNette / pa) * 100 : 0;
            newForm.retail_price = pv.toFixed(2);
            newForm.margin_percent = percent.toFixed(2);
          }
        }

        // --- Prix pro TVA sur marge ---
        if (name === "pro_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Margin(pa, pv);
            newForm.pro_margin_value = marginValue.toFixed(2);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
          }
        } else if (name === "pro_margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            const { marginValue, sellingPrice } = calculateMarginFromPercent_Margin(pa, percent);
            newForm.pro_price = sellingPrice.toFixed(2);
            newForm.pro_margin_value = marginValue.toFixed(2);
          }
        } else if (name === "pro_margin_value") {
          const margeNette = parseFloat(value);
          if (!isNaN(margeNette)) {
            const { sellingPrice, marginPercent } = calculateMarginFromValue_Margin(pa, margeNette);
            newForm.pro_price = sellingPrice.toFixed(2);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
          }
        }
      } else {
        // --- Calcul dynamique pour TVA normale ---
        if (name === "margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            const { marginValue, sellingPrice } = calculateMarginFromPercent_Normal(pa, percent);
            newForm.retail_price = sellingPrice.toFixed(2);
            newForm.margin_value = marginValue.toFixed(2);
          }
        } else if (name === "retail_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Normal(pa, pv);
            newForm.margin_percent = marginPercent.toFixed(2);
            newForm.margin_value = marginValue.toFixed(2);
          }
        } else if (name === "margin_value") {
          const valueNum = parseFloat(value);
          if (!isNaN(valueNum)) {
            const { sellingPrice, marginPercent } = calculateMarginFromValue_Normal(pa, valueNum);
            newForm.retail_price = sellingPrice.toFixed(2);
            newForm.margin_percent = marginPercent.toFixed(2);
          }
        }

        // --- Prix pro TVA normale ---
        if (name === "pro_margin_percent") {
          const percent = parseFloat(value);
          if (!isNaN(percent)) {
            const { marginValue, sellingPrice } = calculateMarginFromPercent_Normal(pa, percent);
            newForm.pro_price = sellingPrice.toFixed(2);
            newForm.pro_margin_value = marginValue.toFixed(2);
          }
        } else if (name === "pro_price") {
          const pv = parseFloat(value);
          if (!isNaN(pv)) {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Normal(pa, pv);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
            newForm.pro_margin_value = marginValue.toFixed(2);
          }
        } else if (name === "pro_margin_value") {
          const valueNum = parseFloat(value);
          if (!isNaN(valueNum)) {
            const { sellingPrice, marginPercent } = calculateMarginFromValue_Normal(pa, valueNum);
            newForm.pro_price = sellingPrice.toFixed(2);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
          }
        }
      }

      // --- Changement du type de TVA : recalculer les marges/prix à partir du prix de vente actuel ---
      if (name === "vat_type") {
        const retailPrice = parseFloat(newForm.retail_price);
        const proPrice = parseFloat(newForm.pro_price);

        if (!isNaN(retailPrice)) {
          if (value === "margin") {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Margin(pa, retailPrice);
            newForm.margin_value = marginValue.toFixed(2);
            newForm.margin_percent = marginPercent.toFixed(2);
          } else {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Normal(pa, retailPrice);
            newForm.margin_value = marginValue.toFixed(2);
            newForm.margin_percent = marginPercent.toFixed(2);
          }
        }

        if (!isNaN(proPrice)) {
          if (value === "margin") {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Margin(pa, proPrice);
            newForm.pro_margin_value = marginValue.toFixed(2);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
          } else {
            const { marginValue, marginPercent } = calculateMarginFromSellingPrice_Normal(pa, proPrice);
            newForm.pro_margin_value = marginValue.toFixed(2);
            newForm.pro_margin_percent = marginPercent.toFixed(2);
          }
        }
      }

      setFormData(newForm);
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    // validation simple
    if (!formData.name || !formData.sku || !formData.purchase_price) return alert('Champs requis manquants');
    // Conversion des champs en number pour l'enregistrement
    const productToSave = {
      ...formData,
      purchase_price: parseFloat(formData.purchase_price),
      retail_price: parseFloat(formData.retail_price),
      pro_price: parseFloat(formData.pro_price),
      weight_grams: formData.weight ? parseInt(formData.weight) : 0,
      stock_alert: formData.stock_alert ? parseInt(formData.stock_alert) : 0,
      current_stock: formData.current_stock ? parseInt(formData.current_stock) : 0,
      margin_percent: formData.margin_percent ? parseFloat(formData.margin_percent) : null,
      margin_value: formData.margin_value ? parseFloat(formData.margin_value) : null,
      pro_margin_percent: formData.pro_margin_percent ? parseFloat(formData.pro_margin_percent) : null,
      pro_margin_value: formData.pro_margin_value ? parseFloat(formData.pro_margin_value) : null,
      vat_type: formData.vat_type
    };
    await addProduct(productToSave);
    alert('Produit ajouté');
    setFormData({
      name: '', sku: '', purchase_price: '', retail_price: '', pro_price: '',
      weight: '', ean: '', description: '', stock_alert: '', current_stock: '',
      location: '', category_type: '', category_brand: '', category_model: '',
      vat_type: 'normal', margin_percent: '', margin_value: '', pro_margin_percent: '', pro_margin_value: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" name="name" placeholder="Nom du produit" value={formData.name} onChange={handleChange} />
      <input type="text" name="sku" placeholder="SKU" value={formData.sku} onChange={handleChange} />
      <input type="number" name="purchase_price" placeholder="Prix d'achat" value={formData.purchase_price} onChange={handleChange} />

      {/* Sélecteur de TVA */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type de TVA</label>
        <select name="vat_type" value={formData.vat_type} onChange={handleChange} className="w-full border px-3 py-2 rounded">
          <option value="normal">TVA normale</option>
          <option value="margin">TVA sur marge</option>
        </select>
      </div>

      {/* Champs dynamiques pour prix de vente et marges */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Prix de vente magasin
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {formData.vat_type === "margin" ? "Prix vente TVM" : "Prix HT"}
            </label>
            <input type="number" name="retail_price" placeholder="Prix vente magasin" value={formData.retail_price} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marge %</label>
            <input type="number" name="margin_percent" placeholder="Marge %" value={formData.margin_percent} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marge nette (€)</label>
            <input type="number" name="margin_value" placeholder="Marge nette" value={formData.margin_value} onChange={handleChange} />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Prix de vente pro
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {formData.vat_type === "margin" ? "Prix vente TVM" : "Prix HT"}
            </label>
            <input type="number" name="pro_price" placeholder="Prix vente pro" value={formData.pro_price} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marge % pro</label>
            <input type="number" name="pro_margin_percent" placeholder="Marge % pro" value={formData.pro_margin_percent} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marge nette pro (€)</label>
            <input type="number" name="pro_margin_value" placeholder="Marge nette pro" value={formData.pro_margin_value} onChange={handleChange} />
          </div>
        </div>
      </div>

      <input type="number" name="weight" placeholder="Poids (g)" value={formData.weight} onChange={handleChange} />
      <input type="text" name="ean" placeholder="Code EAN" value={formData.ean} onChange={handleChange} />
      <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} />
      <input type="number" name="stock_alert" placeholder="Alerte stock" value={formData.stock_alert} onChange={handleChange} />
      <input type="number" name="current_stock" placeholder="Stock actuel" value={formData.current_stock} onChange={handleChange} />
      <input type="text" name="location" placeholder="Emplacement" value={formData.location} onChange={handleChange} />

      <select name="category_type" value={formData.category_type} onChange={handleChange}>
        <option value="">Type</option>
        {[...new Set(categories.map(c => c.type))].map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select name="category_brand" value={formData.category_brand} onChange={handleChange}>
        <option value="">Marque</option>
        {[...new Set(categories.filter(c => c.type === formData.category_type).map(c => c.brand))].map(brand => (
          <option key={brand} value={brand}>{brand}</option>
        ))}
      </select>
      <select name="category_model" value={formData.category_model} onChange={handleChange}>
        <option value="">Modèle</option>
        {[...new Set(categories.filter(c => c.brand === formData.category_brand).map(c => c.model))].map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>

      <button type="submit">Ajouter produit</button>
    </form>
  );
};

export default ProductFormSimple;
