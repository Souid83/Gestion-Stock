import React, { useEffect, useState } from 'react';
import { Users, RefreshCw, AlertCircle, Package, ArrowUp, ArrowDown, FileText, DollarSign } from 'lucide-react';
import { canViewConsignments, canViewConsignmentsVAT } from '../../lib/rbac';
import type { Role } from '../../lib/rbac';
import { supabase } from '../../lib/supabase';

interface ConsignmentSummary {
  stock_id: string;
  stock_name: string;
  customer_id: string | null;
  customer_name: string | null;
  total_en_depot: number;
  total_facture_non_payee: number;
  total_ht: number;
  total_ttc: number;
  total_tva_normal: number;
  total_tva_marge: number;
  last_move_at: string | null;
}

interface ConsignmentDetail {
  consignment_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty_en_depot: number;
  qty_facture_non_payee: number;
  montant_ht: number;
  tva_normal: number;
  tva_marge: number;
  last_move_at: string | null;
}

export function Consignments() {
  const [userRole, setUserRole] = useState<Role>('MAGASIN');
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<ConsignmentSummary[]>([]);
  const [detailData, setDetailData] = useState<ConsignmentDetail[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  console.log('[Consignments] Composant monté');

  // Récupérer le rôle utilisateur
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          const role = (profile?.role as Role) || 'MAGASIN';
          setUserRole(role);
          console.log('[Consignments] Rôle utilisateur:', role);
        }
      } catch (error) {
        console.error('[Consignments] Erreur récupération rôle:', error);
      }
    };

    fetchUserRole();
  }, []);

  // Contrôle d'accès
  if (!canViewConsignments(userRole)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <h2 className="font-semibold">Accès refusé</h2>
          </div>
          <p className="text-red-700 mt-2">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  const canViewVAT = canViewConsignmentsVAT(userRole);
  console.log('[Consignments] Peut voir TVA:', canViewVAT);

  // Charger les données
  const loadData = async () => {
    setLoading(true);
    console.log('[Consignments] Chargement des données...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[Consignments] Pas de session');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consignments-list`;
      const params = new URLSearchParams();
      if (selectedStockId) {
        params.append('stock_id', selectedStockId);
        params.append('detail', '1');
      }
      if (searchQuery) {
        params.append('q', searchQuery);
      }

      const url = params.toString() ? `${apiUrl}?${params}` : apiUrl;

      console.log('[Consignments] Appel API:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Consignments] Données reçues:', result);

      setSummaryData(result.summary || []);
      if (result.detail) {
        setDetailData(result.detail);
      }
    } catch (error) {
      console.error('[Consignments] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStockId, searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  // Calculer les totaux globaux
  const globalTotals = summaryData.reduce(
    (acc, item) => ({
      ht: acc.ht + (item.total_ht || 0),
      ttc: acc.ttc + (item.total_ttc || 0),
      tva_normal: acc.tva_normal + (item.total_tva_normal || 0),
      tva_marge: acc.tva_marge + (item.total_tva_marge || 0)
    }),
    { ht: 0, ttc: 0, tva_normal: 0, tva_marge: 0 }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={32} className="text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Sous-traitants (dépôt-vente)
              </h1>
            </div>
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Rafraîchir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Onglets sous-traitants */}
        {summaryData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-gray-600" />
              <h2 className="font-semibold text-gray-900">Sous-traitants</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedStockId(null)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  !selectedStockId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tous ({summaryData.length})
              </button>
              {summaryData.map((item) => (
                <button
                  key={item.stock_id}
                  onClick={() => setSelectedStockId(item.stock_id)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    selectedStockId === item.stock_id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.stock_name}
                  {item.customer_name && <span className="text-xs ml-1">({item.customer_name})</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards (si autorisé) */}
        {canViewVAT && !selectedStockId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Total dû HT</span>
                <DollarSign size={20} className="text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.ht)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Total dû TTC</span>
                <DollarSign size={20} className="text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.ttc)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">TVA normale</span>
                <FileText size={20} className="text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.tva_normal)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">TVA marge</span>
                <FileText size={20} className="text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.tva_marge)}</p>
            </div>
          </div>
        )}

        {/* Tableau récapitulatif */}
        {selectedStockId && detailData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Détail par produit</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Produit</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">En dépôt</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Facturé non payé</th>
                    {canViewVAT && (
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Montant HT</th>
                    )}
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Dernier mouvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {detailData.map((item) => (
                    <tr key={item.consignment_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.product_sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.qty_en_depot}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-900">{item.qty_facture_non_payee}</span>
                          {item.qty_facture_non_payee > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              <AlertCircle size={12} />
                              Facture éditée
                            </span>
                          )}
                        </div>
                      </td>
                      {canViewVAT && (
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(item.montant_ht)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {formatDate(item.last_move_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedStockId === null && summaryData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Synthèse par sous-traitant</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sous-traitant</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">En dépôt</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Facturé non payé</th>
                    {canViewVAT && (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total HT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total TTC</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summaryData.map((item) => (
                    <tr
                      key={item.stock_id}
                      onClick={() => setSelectedStockId(item.stock_id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.stock_name}</div>
                        {item.customer_name && (
                          <div className="text-sm text-gray-500">{item.customer_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.total_en_depot}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-900">{item.total_facture_non_payee}</span>
                          {item.total_facture_non_payee > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              <AlertCircle size={12} className="mr-1" />
                              Impayé
                            </span>
                          )}
                        </div>
                      </td>
                      {canViewVAT && (
                        <>
                          <td className="px-4 py-3 text-right text-gray-900">
                            {formatCurrency(item.total_ht)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatCurrency(item.total_ttc)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {loading ? 'Chargement...' : 'Aucun dépôt-vente en cours'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Consignments;
