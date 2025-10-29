import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, FileText, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { canViewConsignmentsVAT, type Role, ROLES } from '../lib/rbac';

// Types inspirés de la page consignments existante
type SummaryRow = {
  stock_id: string;
  stock_name: string;
  customer_id: string | null;
  customer_name: string | null;
  total_en_depot?: number | null;
  total_facture_non_payee?: number | null;
  total_ht?: number | null;
  total_ttc?: number | null;
  total_tva_normal?: number | null;
  total_tva_marge?: number | null;
};

type DetailRow = {
  consignment_id?: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  montant_ht?: number | null;
  tva_normal?: number | null;
  tva_marge?: number | null;
  // Champs optionnels pour l'affichage mini-liste
  imei?: string | null;
  pam?: string | null;
  imei_pam?: string | null;
  serial?: string | null;
  serial_number?: string | null;
  sn?: string | null;
};

type DetailsByStock = Record<string, DetailRow[]>;

export function ConsignmentsSection() {
  const [userRole, setUserRole] = useState<Role>(ROLES.MAGASIN);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [detailsByStock, setDetailsByStock] = useState<DetailsByStock>({});
  const [error, setError] = useState<string | null>(null);

  const canViewVAT = canViewConsignmentsVAT(userRole);

  const euro = useMemo(
    () =>
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }),
    []
  );

  // Récupérer rôle utilisateur (profil)
  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!cancelled) {
          setUserRole(((profile?.role as Role) || ROLES.MAGASIN) as Role);
        }
      } catch (e) {
        // rôle par défaut déjà défini
      }
    };
    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Charger la synthèse, puis les détails par stock
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Session manquante');
        }

        // 1) Synthèse (expose la liste des stocks)
        const baseUrl = '/.netlify/functions/consignments-list';
        const res = await fetch(baseUrl, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error(`Erreur API (summary): ${res.status}`);
        }

        const data = await res.json();
        const rows: SummaryRow[] = Array.isArray(data?.summary) ? data.summary : [];
        if (cancelled) return;

        setSummary(rows);

        // 2) Détails par stock (pour agrégations locales)
        const byStock: DetailsByStock = {};
        // Charger séquentiellement (minimal et sûr), on peut optimiser plus tard si besoin
        for (const s of rows) {
          if (!s?.stock_id) continue;
          const u = `${baseUrl}?stock_id=${encodeURIComponent(s.stock_id)}&detail=1`;
          const dRes = await fetch(u, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          if (!dRes.ok) {
            // Non bloquant: on loggue côté console et continue
            // eslint-disable-next-line no-console
            console.warn('[ConsignmentsSection] Détails indisponibles pour', s.stock_id, dRes.status);
            byStock[s.stock_id] = [];
            continue;
          }
          const dJson = await dRes.json();
          byStock[s.stock_id] = Array.isArray(dJson?.detail) ? dJson.detail : [];
          if (cancelled) return;
        }

        setDetailsByStock(byStock);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    // Fallback de rafraîchissement léger toutes les 60s (optionnel)
    const interval = setInterval(fetchAll, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fonctions d'agrégation
  const computeTotals = (rows: DetailRow[]) => {
    let ht = 0;
    let ttcNormale = 0;
    let ttcMarge = 0;

    for (const r of rows || []) {
      const mht = Number(r?.montant_ht || 0);
      const tvn = Number(r?.tva_normal || 0);
      const tvm = Number(r?.tva_marge || 0);
      ht += mht;
      if (tvn > 0) ttcNormale += mht + tvn;
      if (tvm > 0) ttcMarge += mht + tvm;
    }
    const ttcCumul = ttcNormale + ttcMarge;
    return { ht, ttcNormale, ttcMarge, ttcCumul };
  };

  const perStockTotals = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeTotals>> = {};
    for (const s of summary) {
      const rows = detailsByStock[s.stock_id] || [];
      out[s.stock_id] = computeTotals(rows);
    }
    return out;
  }, [summary, detailsByStock]);

  const globalTotals = useMemo(() => {
    let gHT = 0;
    let gNormale = 0;
    let gMarge = 0;
    for (const s of summary) {
      const t = perStockTotals[s.stock_id];
      if (!t) continue;
      gHT += t.ht;
      gNormale += t.ttcNormale;
      gMarge += t.ttcMarge;
    }
    const gCumul = gNormale + gMarge;
    return { ht: gHT, ttcNormale: gNormale, ttcMarge: gMarge, ttcCumul: gCumul };
  }, [summary, perStockTotals]);

  const formatMoney = (v: number) => euro.format(v || 0);

  // Rendu
  return (
    <div className="space-y-6">
      {/* Bandeau KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total HT</span>
            <DollarSign size={20} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ht) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">TTC TVA normale</span>
            <FileText size={20} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ttcNormale) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">TTC TVA marge</span>
            <FileText size={20} className="text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ttcMarge) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">TTC cumulé</span>
            <DollarSign size={20} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ttcCumul) : '—'}
          </p>
        </div>
      </div>

      {/* États de chargement / erreur */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-600">
          Chargement des sous-traitants...
        </div>
      )}
      {!loading && error && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6 text-center text-red-600">
          {error}
        </div>
      )}

      {/* Cartes par stock */}
      {!loading && !error && summary.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Aucun dépôt-vente en cours</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {summary.map((s) => {
          const details = detailsByStock[s.stock_id] || [];
          const totals = perStockTotals[s.stock_id] || { ht: 0, ttcNormale: 0, ttcMarge: 0, ttcCumul: 0 };
          return (
            <div key={s.stock_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.stock_name}</h3>
                  {s.customer_name && (
                    <div className="text-sm text-gray-500">{s.customer_name}</div>
                  )}
                </div>
              </div>

              {/* Sous-totaux */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">HT</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ht) : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">TTC normale</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ttcNormale) : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">TTC marge</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ttcMarge) : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">Dû TTC</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ttcCumul) : '—'}
                  </div>
                </div>
              </div>

              {/* Mini-liste d'articles */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-600">
                    <tr>
                      <th className="text-left py-1.5 pr-2">SKU</th>
                      <th className="text-left py-1.5 px-2">Nom</th>
                      <th className="text-left py-1.5 px-2">IMEI/PAM</th>
                      <th className="text-left py-1.5 px-2">N° de série</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {details.slice(0, 5).map((d, idx) => {
                      const imeiPam = (d.imei_pam || d.imei || d.pam || '') as string;
                      const serial = (d.serial_number || d.serial || d.sn || '') as string;
                      return (
                        <tr key={`${s.stock_id}-${idx}`}>
                          <td className="py-1.5 pr-2 text-gray-900">{d.product_sku || ''}</td>
                          <td className="py-1.5 px-2 text-gray-900">{d.product_name || ''}</td>
                          <td className="py-1.5 px-2 text-gray-700">{imeiPam || '—'}</td>
                          <td className="py-1.5 px-2 text-gray-700">{serial || '—'}</td>
                        </tr>
                      );
                    })}
                    {details.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-gray-500">Aucun article</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConsignmentsSection;
