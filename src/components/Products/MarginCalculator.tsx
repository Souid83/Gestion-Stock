
/**
 * Fonctions utilitaires pour le calcul dynamique des marges/prix selon le type de TVA.
 * - TVA sur marge ("margin") : la TVA ne s'applique que sur la marge.
 * - TVA normale ("normal") : la TVA s'applique sur le total.
 */
export const TVA_RATE = 1.2;

// --- CALCULS POUR TVA SUR MARGE ("margin") ---

/**
 * À partir du prix de vente TTC (TVA sur marge)
 * @returns { marginValue, marginPercent, sellingPrice }
 */
export function calculateMarginFromSellingPrice_Margin(purchase: number, selling: number) {
  const marginNet = (selling - purchase) / TVA_RATE;
  const marginPercent = (marginNet / purchase) * 100;
  return { marginValue: marginNet, marginPercent, sellingPrice: selling };
}

/**
 * À partir de la marge % (TVA sur marge)
 */
export function calculateMarginFromPercent_Margin(purchase: number, percent: number) {
  const marginNet = (purchase * percent) / 100;
  const selling = purchase + marginNet * TVA_RATE;
  return { marginValue: marginNet, marginPercent: percent, sellingPrice: selling };
}

/**
 * À partir de la marge nette (€) (TVA sur marge)
 */
export function calculateMarginFromValue_Margin(purchase: number, value: number) {
  const selling = purchase + value * TVA_RATE;
  const marginPercent = (value / purchase) * 100;
  return { marginValue: value, marginPercent, sellingPrice: selling };
}

// --- CALCULS POUR TVA NORMALE ("normal") ---

/**
 * À partir du prix de vente TTC (TVA normale)
 */
export function calculateMarginFromSellingPrice_Normal(purchase: number, selling: number) {
  const marginNet = selling - purchase;
  const marginPercent = (marginNet / purchase) * 100;
  return { marginValue: marginNet, marginPercent, sellingPrice: selling };
}

/**
 * À partir de la marge % (TVA normale)
 */
export function calculateMarginFromPercent_Normal(purchase: number, percent: number) {
  const marginNet = (purchase * percent) / 100;
  const selling = purchase + marginNet;
  return { marginValue: marginNet, marginPercent: percent, sellingPrice: selling };
}

/**
 * À partir de la marge nette (€) (TVA normale)
 */
export function calculateMarginFromValue_Normal(purchase: number, value: number) {
  const selling = purchase + value;
  const marginPercent = (value / purchase) * 100;
  return { marginValue: value, marginPercent, sellingPrice: selling };
}
import React, { useState } from 'react';



interface Result {
  marginValue: number;
  marginPercent: number;
  sellingPrice: number;
}

export const MarginCalculator: React.FC = () => {
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [marginPercent, setMarginPercent] = useState('');
  const [marginValue, setMarginValue] = useState('');
  const [mode, setMode] = useState<'cas1' | 'cas2' | 'cas3'>('cas1');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const parse = (value: string) => parseFloat(value.replace(',', '.'));

  const handleCalculation = () => {
    const purchase = parse(purchasePrice);
    setError('');

    if (isNaN(purchase) || purchase <= 0) {
      setError("Le prix d'achat doit être un nombre positif.");
      return;
    }

    switch (mode) {
      case 'cas1': {
        const sell = parse(sellingPrice);
        if (isNaN(sell) || sell <= 0) {
          setError('Le prix de vente doit être un nombre positif.');
          return;
        }
        const marginNet = (sell - purchase) / TVA_RATE;
        const marginPct = (marginNet / purchase) * 100;
        setResult({
          marginValue: marginNet,
          marginPercent: marginPct,
          sellingPrice: sell
        });
        break;
      }
      case 'cas2': {
        const pct = parse(marginPercent);
        if (isNaN(pct) || pct <= 0) {
          setError('La marge % doit être un nombre positif.');
          return;
        }
        const marginNet = (purchase * pct) / 100;
        const sell = purchase + marginNet * TVA_RATE;
        setResult({
          marginValue: marginNet,
          marginPercent: pct,
          sellingPrice: sell
        });
        break;
      }
      case 'cas3': {
        const net = parse(marginValue);
        if (isNaN(net) || net <= 0) {
          setError('La marge numéraire doit être un nombre positif.');
          return;
        }
        const sell = purchase + net * TVA_RATE;
        const pct = (net / purchase) * 100;
        setResult({
          marginValue: net,
          marginPercent: pct,
          sellingPrice: sell
        });
        break;
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Calculateur de marge (TVA sur marge)</h2>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Mode de calcul :</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="cas1">Cas 1 : Prix achat + Prix vente</option>
          <option value="cas2">Cas 2 : Prix achat + Marge %</option>
          <option value="cas3">Cas 3 : Prix achat + Marge €</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat (€)</label>
          <input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {mode === 'cas1' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (€)</label>
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        )}

        {mode === 'cas2' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marge %</label>
            <input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        )}

        {mode === 'cas3' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marge numéraire (€)</label>
            <input
              type="number"
              value={marginValue}
              onChange={(e) => setMarginValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleCalculation}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Calculer
      </button>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Marge numéraire nette</h3>
              <p className="text-lg font-semibold text-gray-900">
                {result.marginValue.toFixed(2)} €
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Marge en %</h3>
              <p className="text-lg font-semibold text-gray-900">
                {result.marginPercent.toFixed(2)} %
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Prix de vente</h3>
              <p className="text-lg font-semibold text-gray-900">
                {result.sellingPrice.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
