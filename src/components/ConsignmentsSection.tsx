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
  qty_en_depot?: number | null;
  // Champs enrichis depuis la fonction Netlify
  serial_number?: string | null;
  parent_id?: string | null;
  parent_name?: string | null;
  product_type?: string | null;
  vat_regime?: string | null;
  unit_price?: number | null;
  total_line_price?: number | null;
};

type DetailsByStock = Record<string, DetailRow[]>;

export function ConsignmentsSection() {
  const [userRole, setUserRole] = useState<Role>(ROLES.MAGASIN);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [detailsByStock, setDetailsByStock] = useState<DetailsByStock>({});
  const [error, setError] = useState<string | null>(null);

  const canViewVAT = canViewConsignmentsVAT(userRole);
  const canSeeSection = userRole === ROLES.ADMIN_FULL || userRole === ROLES.ADMIN;

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

        // 0) Liste des stocks du groupe "SOUS TRAITANT" (pour inclure même vides)
        let groupStocks: { stock_id: string; stock_name: string }[] = [];
        try {
          // 0) Trouver l'id du groupe "SOUS TRAITANT" puis lister ses stocks par group_id
          const GROUP_FILTER = 'name.eq.SOUS TRAITANT,name.eq.SOUS_TRAITANT,name.eq.SOUS-TRAITANT';

          // a) ID du groupe
          const { data: gRows } = await supabase
            .from('stock_groups')
            .select('id')
            .or(GROUP_FILTER)
            .limit(1);

          const groupId = gRows?.[0]?.id ? String(gRows[0].id) : null;

          // b) Stocks du groupe
          if (groupId) {
            const { data: sRows } = await supabase
              .from('stocks')
              .select('id, name')
              .eq('group_id', groupId);

            if (Array.isArray(sRows)) {
              groupStocks = (sRows as any[]).map((r: any) => ({
                stock_id: String(r.id),
                stock_name: String(r.name ?? r.id)
              }));
            }
          }

          // Log de contrôle
          // eslint-disable-next-line no-console
          console.info('[ConsignmentsSection] groupId:', groupId, 'groupStocks:', groupStocks);
        } catch (_) {
          // silencieux
        }

        // 1) Synthèse (expose les stocks avec activité)
        const baseUrl = '/.netlify/functions/consignments-list';

        // Tolérant: en dev local, Netlify dev peut renvoyer 404 → ne pas bloquer l'affichage des cartes de groupe
        let rows: SummaryRow[] = [];
        try {
          const res = await fetch(baseUrl, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (res.ok) {
            const data = await res.json();
            rows = Array.isArray(data?.summary) ? data.summary : [];
          } else {
            // eslint-disable-next-line no-console
            console.warn('[ConsignmentsSection] summary non disponible:', res.status);
            rows = [];
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[ConsignmentsSection] summary fetch error:', e);
          rows = [];
        }
        if (cancelled) return;

        // 1.b) Choisir la source d’affichage: priorité aux stocks du groupe
        const stocksToShow = (groupStocks && groupStocks.length > 0)
          ? groupStocks
          : (rows || []).map((r) => ({ stock_id: r.stock_id, stock_name: r.stock_name }));

        // Construire le summary à afficher (fusionne info client si dispo)
        const summaryRows: SummaryRow[] = stocksToShow.map((s) => {
          const m = (rows || []).find(r => r.stock_id === s.stock_id);
          return {
            stock_id: s.stock_id,
            stock_name: s.stock_name || m?.stock_name || '',
            customer_id: m?.customer_id ?? null,
            customer_name: m?.customer_name ?? null,
            total_en_depot: m?.total_en_depot ?? null,
            total_facture_non_payee: m?.total_facture_non_payee ?? null,
            total_ht: m?.total_ht ?? null,
            total_ttc: m?.total_ttc ?? null,
            total_tva_normal: m?.total_tva_normal ?? null,
            total_tva_marge: m?.total_tva_marge ?? null
          };
        });
        setSummary(summaryRows);

        // 2) Détails par stock (pour agrégations locales)
        const byStock: DetailsByStock = {};
        // Charger séquentiellement (API Netlify uniquement)
        for (const s of stocksToShow) {
          if (!s?.stock_id) continue;
          const u = `${baseUrl}?stock_id=${encodeURIComponent(s.stock_id)}&detail=1`;
          try {
            const dRes = await fetch(u, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            });
            let items: any[] = [];
            if (dRes.ok) {
              const dJson = await dRes.json();
              items = Array.isArray(dJson?.detail) ? dJson.detail : [];
            } else {
              // eslint-disable-next-line no-console
              console.warn('[ConsignmentsSection] Détails indisponibles (API) pour', s.stock_id, dRes.status);
              items = [];
            }

            // Fallback local: si aucun détail via consignments, afficher le stock réel (stock_produit)
            if (!items || items.length === 0) {
              try {
                const { data: spRows, error: spErr } = await supabase
                  .from('stock_produit')
                  .select('produit_id, quantite, products(name, sku)')
                  .eq('stock_id', s.stock_id)
                  .gt('quantite', 0);

                if (!spErr && Array.isArray(spRows) && spRows.length > 0) {
                  items = (spRows as any[]).map((r: any) => ({
                    consignment_id: null,
                    product_id: r.produit_id,
                    product_name: r.products?.name ?? null,
                    product_sku: r.products?.sku ?? null,
                    qty_en_depot: Number(r.quantite || 0),
                    // Pas de valorisation sans consignments → montants/TVA null
                    montant_ht: null,
                    tva_normal: null,
                    tva_marge: null
                  }));
                }
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[ConsignmentsSection] Fallback stock_produit error pour', s.stock_id, e);
              }
            }

            byStock[s.stock_id] = items as DetailRow[];
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[ConsignmentsSection] Détails API error pour', s.stock_id, err);
            byStock[s.stock_id] = [];
          }
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
    console.log('[ConsignmentsSection] Calcul des totaux pour', rows.length, 'lignes');
    let ht = 0;
    let ttc = 0;

    for (const r of rows || []) {
      const mht = Number(r?.montant_ht || 0);
      const tvn = Number(r?.tva_normal || 0);
      const tvm = Number(r?.tva_marge || 0);

      ht += mht;
      ttc += mht + tvn + tvm;

      console.log('[ConsignmentsSection] Ligne:', {
        sku: r?.product_sku,
        montant_ht: mht,
        tva_normal: tvn,
        tva_marge: tvm,
        ttc_ligne: mht + tvn + tvm
      });
    }

    console.log('[ConsignmentsSection] Totaux calculés:', { ht, ttc });
    return { ht, ttc };
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
    let gTTC = 0;
    for (const s of summary) {
      const t = perStockTotals[s.stock_id];
      if (!t) continue;
      gHT += t.ht;
      gTTC += t.ttc;
    }
    console.log('[ConsignmentsSection] Totaux globaux:', { ht: gHT, ttc: gTTC });
    return { ht: gHT, ttc: gTTC };
  }, [summary, perStockTotals]);

  const formatMoney = (v: number) => euro.format(v || 0);

  // Rendu
  if (!canSeeSection) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-600">
        Accès limité aux rôles ADMIN/ADMIN_FULL
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Bandeau KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total HT Global</span>
            <DollarSign size={20} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ht) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total TTC Global (HT + TVA)</span>
            <DollarSign size={20} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {canViewVAT ? formatMoney(globalTotals.ttc) : '—'}
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

      <div className="flex flex-col gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">Total HT</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ht) : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <div className="text-xs text-gray-600">Total TTC (HT + TVA)</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {canViewVAT ? formatMoney(totals.ttc) : '—'}
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
                      <th className="text-left py-1.5 px-2">Numéro de série</th>
                      <th className="text-left py-1.5 px-2">Qté</th>
                      <th className="text-right py-1.5 px-2">Prix unitaire</th>
                      <th className="text-right py-1.5 px-2">Prix total ligne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {details.slice(0, 5).map((d, idx) => {
                      // Déterminer le nom à afficher : parent si PAM enfant, sinon nom produit
                      const displayName = d.parent_id && d.parent_name ? d.parent_name : (d.product_name || '');

                      // Numéro de série
                      const serialNumber = d.serial_number || '—';

                      // Quantité
                      const qty = Number(d?.qty_en_depot ?? 0);

                      // Prix unitaire et total
                      const unitPrice = Number(d?.unit_price || 0);
                      const totalLinePrice = Number(d?.total_line_price || 0);

                      console.log('[ConsignmentsSection] Affichage ligne:', {
                        sku: d.product_sku,
                        displayName,
                        serialNumber,
                        parent_id: d.parent_id,
                        parent_name: d.parent_name,
                        qty,
                        unitPrice,
                        totalLinePrice,
                        vat_regime: d.vat_regime
                      });

                      return (
                        <tr key={`${s.stock_id}-${idx}`}>
                          <td className="py-1.5 pr-2 text-gray-900">{d.product_sku || ''}</td>
                          <td className="py-1.5 px-2 text-gray-900">{displayName}</td>
                          <td className="py-1.5 px-2 text-gray-700">{serialNumber}</td>
                          <td className="py-1.5 px-2 text-gray-900">{qty}</td>
                          <td className="py-1.5 px-2 text-right text-gray-900">
                            {canViewVAT ? formatMoney(unitPrice) : '—'}
                            {canViewVAT && d.vat_regime && (
                              <span className="text-xs text-gray-500 ml-1">
                                {d.vat_regime === 'MARGE' ? '(TTC)' : '(HT)'}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right text-gray-900 font-medium">
                            {canViewVAT ? formatMoney(totalLinePrice) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {details.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-2 text-gray-500">Aucun article</td>
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
