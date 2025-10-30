import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stock {
  id: string;
  name: string;
  group: {
    name: string;
    synchronizable: boolean;
  }[];
}

interface FormData {
  serialNumber: string;
  purchasePrice: string;
  rawPurchasePrice: string;
  supplier: string;
  productNote: string;
  vat_type: 'normal' | 'margin';
  batteryPercentage: string;
  warrantySticker: 'present' | 'absent' | '';
  selectedStock: string;
  retailPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
  proPrice: {
    ht: string;
    margin: string;
    ttc: string;
  };
}

interface SerialNumberFormOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  parentProduct: {
    id: string;
    name: string;
    sku: string;
    category_id?: string;
    weight_grams?: number;
    width_cm?: number;
    height_cm?: number;
    depth_cm?: number;
    description?: string;
    ean?: string;
    variants?: any;
  };
  vatType: 'normal' | 'margin';
}

const TVA_RATE = 0.20; // 20% TVA

export const SerialNumberFormOverlay: React.FC<SerialNumberFormOverlayProps> = ({
  isOpen,
  onClose,
  onSubmitSuccess,
  parentProduct,
  vatType
}) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [formData, setFormData] = useState<FormData>({
    serialNumber: '',
    purchasePrice: '',
    rawPurchasePrice: '',
    supplier: '',
    productNote: '',
    vat_type: vatType,
    batteryPercentage: '',
    warrantySticker: '',
    selectedStock: '',
    retailPrice: {
      ht: '',
      margin: '',
      ttc: ''
    },
    proPrice: {
      ht: '',
      margin: '',
      ttc: ''
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          id,
          name,
          group:stock_groups (
            name,
            synchronizable
          )
        `)
        .order('name');

      if (error) throw error;
      setStocks((data as unknown as Stock[]) || []);
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setError('Erreur lors de la récupération des stocks');
    }
  };

  // Fonctions de calcul pour TVA normale
  const updateRetailPriceFromHT = (htValue: string) => {
    const ht = parseFloat(htValue);
    if (isNaN(ht)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: htValue,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateRetailPriceFromMargin = (marginValue: string) => {
    const margin = parseFloat(marginValue);
    if (isNaN(margin)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const ht = purchasePrice * (1 + margin / 100);
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: ht.toFixed(2),
        margin: marginValue,
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateRetailPriceFromTTC = (ttcValue: string) => {
    const ttc = parseFloat(ttcValue);
    if (isNaN(ttc)) return;

    const ht = ttc / (1 + TVA_RATE);
    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;

    setFormData(prev => ({
      ...prev,
      retailPrice: {
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: ttcValue
      }
    }));
  };

  const updateProPriceFromHT = (htValue: string) => {
    const ht = parseFloat(htValue);
    if (isNaN(ht)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: htValue,
        margin: margin.toFixed(2),
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateProPriceFromMargin = (marginValue: string) => {
    const margin = parseFloat(marginValue);
    if (isNaN(margin)) return;

    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const ht = purchasePrice * (1 + margin / 100);
    const ttc = ht * (1 + TVA_RATE);

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: ht.toFixed(2),
        margin: marginValue,
        ttc: ttc.toFixed(2)
      }
    }));
  };

  const updateProPriceFromTTC = (ttcValue: string) => {
    const ttc = parseFloat(ttcValue);
    if (isNaN(ttc)) return;

    const ht = ttc / (1 + TVA_RATE);
    const purchasePrice = parseFloat(formData.purchasePrice);
    if (isNaN(purchasePrice)) return;

    const margin = ((ht - purchasePrice) / purchasePrice) * 100;

    setFormData(prev => ({
      ...prev,
      proPrice: {
        ht: ht.toFixed(2),
        margin: margin.toFixed(2),
        ttc: ttcValue
      }
    }));
  };

  // Mise à jour des prix lorsque le prix d'achat change
  useEffect(() => {
    if (formData.vat_type === 'normal') {
      const purchasePrice = parseFloat(formData.purchasePrice);
      if (isNaN(purchasePrice)) return;

      // Mettre à jour le prix de vente magasin si déjà rempli
      if (formData.retailPrice.ht) {
        updateRetailPriceFromHT(formData.retailPrice.ht);
      } else if (formData.retailPrice.margin) {
        updateRetailPriceFromMargin(formData.retailPrice.margin);
      } else if (formData.retailPrice.ttc) {
        updateRetailPriceFromTTC(formData.retailPrice.ttc);
      }

      // Mettre à jour le prix de vente pro si déjà rempli
      if (formData.proPrice.ht) {
        updateProPriceFromHT(formData.proPrice.ht);
      } else if (formData.proPrice.margin) {
        updateProPriceFromMargin(formData.proPrice.margin);
      } else if (formData.proPrice.ttc) {
        updateProPriceFromTTC(formData.proPrice.ttc);
      }
    }
  }, [formData.purchasePrice, formData.vat_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form data:", formData);
    
    // Validation
    if (!formData.serialNumber) {
      setError("Le numéro de série est obligatoire");
      return;
    }
    
    if (!formData.selectedStock) {
      setError("Veuillez sélectionner un stock");
      return;
    }
    
    if (!formData.purchasePrice) {
      setError("Le prix d'achat avec frais est obligatoire");
      return;
    }
    
    if (!formData.warrantySticker) {
      setError("Veuillez indiquer si le sticker de garantie est présent ou absent");
      return;
    }
    
    if (!formData.supplier) {
      setError("Le fournisseur est obligatoire");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Préparer les données pour l'insertion
      const productData = {
        name: parentProduct.name,
        sku: parentProduct.sku,
        serial_number: formData.serialNumber,
        purchase_price_with_fees: parseFloat(formData.purchasePrice),
        raw_purchase_price: formData.rawPurchasePrice ? parseFloat(formData.rawPurchasePrice) : null,
        supplier: formData.supplier,
        product_note: formData.productNote || null,
        vat_type: formData.vat_type,
        battery_percentage: formData.batteryPercentage ? parseInt(formData.batteryPercentage) : null,
        warranty_sticker: formData.warrantySticker,
        stock_id: formData.selectedStock,
        parent_id: parentProduct.id,
        is_parent: false,
        retail_price: formData.retailPrice.ht ? parseFloat(formData.retailPrice.ht) : null,
        pro_price: formData.proPrice.ht ? parseFloat(formData.proPrice.ht) : null,
        category_id: parentProduct.category_id,
        weight_grams: parentProduct.weight_grams,
        width_cm: parentProduct.width_cm,
        height_cm: parentProduct.height_cm,
        depth_cm: parentProduct.depth_cm,
        description: parentProduct.description,
        ean: parentProduct.ean,
        variants: parentProduct.variants,
        stock: 1 // Un produit avec numéro de série a toujours un stock de 1
      };
      
      console.log("Inserting product data:", productData);
      
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();
        
      if (error) throw error;
      
      console.log("Product created successfully:", data);
      
      // Appeler le callback de succès
      onSubmitSuccess();
      
    } catch (err) {
      console.error("Error creating product:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la création du produit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Ajouter un numéro de série</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800 font-medium">Produit parent: {parentProduct.name}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de série <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                maxLength={15}
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.serialNumber.length} / 15
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.selectedStock}
                onChange={(e) => setFormData(prev => ({ ...prev, selectedStock: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pourcentage de batterie <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="batteryPercentage"
                  value={formData.batteryPercentage}
                  onChange={(e) => {
                    const value = e.target.value;
                    // N'autoriser que les chiffres
                    if (/^\d*$/.test(value)) {
                      const numValue = parseInt(value, 10);
                      // Bloquer si > 100 ou si vide
                      if (value === '' || (numValue >= 0 && numValue <= 100)) {
                        setFormData(prev => ({ ...prev, batteryPercentage: value }));
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setFormData(prev => ({ ...prev, batteryPercentage: '0' }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                  max="100"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sticker de garantie <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="warrantySticker"
                    value="present"
                    checked={formData.warrantySticker === 'present'}
                    onChange={() => setFormData(prev => ({ ...prev, warrantySticker: 'present' }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2">Présent</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="warrantySticker"
                    value="absent"
                    checked={formData.warrantySticker === 'absent'}
                    onChange={() => setFormData(prev => ({ ...prev, warrantySticker: 'absent' }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2">Absent</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix d'achat avec frais <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix d'achat brut <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="rawPurchasePrice"
                  value={formData.rawPurchasePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, rawPurchasePrice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix de vente magasin <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                </label>
                <input
                  type="text"
                  value={formData.retailPrice.ht}
                  required
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.vat_type === 'normal') {
                      updateRetailPriceFromHT(value);
                    } else {
                      // Logique TVA sur marge existante
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const marginNet = (input - purchase) / 1.2;
                        const marginPct = (marginNet / purchase) * 100;
                        
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ht: value,
                            margin: marginPct.toFixed(2),
                            ttc: marginNet.toFixed(2)
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ...prev.retailPrice,
                            ht: value
                          }
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge %
                </label>
                <input
                  type="text"
                  value={formData.retailPrice.margin}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.vat_type === 'normal') {
                      updateRetailPriceFromMargin(value);
                    } else {
                      // Logique TVA sur marge existante
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const marginNet = (purchase * input) / 100;
                        const selling = purchase + (marginNet * 1.2);
                        
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ht: selling.toFixed(2),
                            margin: value,
                            ttc: marginNet.toFixed(2)
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ...prev.retailPrice,
                            margin: value
                          }
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  %
                </span>
              </div>
              {formData.vat_type === 'normal' ? (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prix TTC
                  </label>
                  <input
                    type="text"
                    value={formData.retailPrice.ttc}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateRetailPriceFromTTC(value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Marge numéraire net
                  </label>
                  <input
                    type="text"
                    value={formData.retailPrice.ttc}
                    onChange={(e) => {
                      const value = e.target.value;
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const selling = purchase + (input * 1.2);
                        const marginPct = (input / purchase) * 100;
                        
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ht: selling.toFixed(2),
                            margin: marginPct.toFixed(2),
                            ttc: value
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          retailPrice: {
                            ...prev.retailPrice,
                            ttc: value
                          }
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix de vente pro <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {formData.vat_type === 'normal' ? 'Prix HT' : 'Prix de vente'}
                </label>
                <input
                  type="text"
                  value={formData.proPrice.ht}
                  required
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.vat_type === 'normal') {
                      updateProPriceFromHT(value);
                    } else {
                      // Logique TVA sur marge existante
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const marginNet = (input - purchase) / 1.2;
                        const marginPct = (marginNet / purchase) * 100;
                        
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ht: value,
                            margin: marginPct.toFixed(2),
                            ttc: marginNet.toFixed(2)
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ...prev.proPrice,
                            ht: value
                          }
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Marge %
                </label>
                <input
                  type="text"
                  value={formData.proPrice.margin}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.vat_type === 'normal') {
                      updateProPriceFromMargin(value);
                    } else {
                      // Logique TVA sur marge existante
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const marginNet = (purchase * input) / 100;
                        const selling = purchase + (marginNet * 1.2);
                        
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ht: selling.toFixed(2),
                            margin: value,
                            ttc: marginNet.toFixed(2)
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ...prev.proPrice,
                            margin: value
                          }
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-green-600"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                  %
                </span>
              </div>
              {formData.vat_type === 'normal' ? (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prix TTC
                  </label>
                  <input
                    type="text"
                    value={formData.proPrice.ttc}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateProPriceFromTTC(value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Marge numéraire net
                  </label>
                  <input
                    type="text"
                    value={formData.proPrice.ttc}
                    onChange={(e) => {
                      const value = e.target.value;
                      const purchase = parseFloat(formData.purchasePrice);
                      const input = parseFloat(value);

                      if (!isNaN(purchase) && !isNaN(input)) {
                        const selling = purchase + (input * 1.2);
                        const marginPct = (input / purchase) * 100;
                        
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ht: selling.toFixed(2),
                            margin: marginPct.toFixed(2),
                            ttc: value
                          }
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          proPrice: {
                            ...prev.proPrice,
                            ttc: value
                          }
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fournisseur <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optionnel)
            </label>
            <textarea
              name="productNote"
              value={formData.productNote}
              onChange={(e) => setFormData(prev => ({ ...prev, productNote: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : 'Associer le numéro de série'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};