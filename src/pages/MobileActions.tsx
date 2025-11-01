import React, { useMemo } from 'react';

function useQuery() {
  return useMemo(() => {
    try {
      const u = new URL(window.location.href);
      return u.searchParams;
    } catch {
      return new URLSearchParams();
    }
  }, []);
}

export default function MobileActions() {
  const q = useQuery();
  const productId = q.get('id') || '';

  const handleChangeStock = () => {
    alert('Changer de stock — à venir');
    // TODO: implémenter le flux de changement de stock (sélecteur de dépôt, confirmation, etc.)
  };

  const handleHistory = () => {
    alert('Consulter l’historique produit — à venir');
    // TODO: naviguer vers une page d’historique détaillé pour le produit (réparations, pièces, techniciens…)
  };

  const handleExpenseRepair = () => {
    alert('Entrer une dépense / réparation — à venir');
    // TODO: formulaire rapide pour consigner une dépense/réparation pour cet appareil
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Actions appareil</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-2">
              Produit ID: <span className="font-mono">{productId || '—'}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <button
              onClick={handleChangeStock}
              className="rounded-xl px-4 py-6 sm:py-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition-colors text-lg sm:text-xl"
            >
              Changer de stock
            </button>

            <button
              onClick={handleHistory}
              className="rounded-xl px-4 py-6 sm:py-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition-colors text-lg sm:text-xl"
            >
              Consulter l’historique produit
            </button>

            <button
              onClick={handleExpenseRepair}
              className="rounded-xl px-4 py-6 sm:py-8 bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-md transition-colors text-lg sm:text-xl"
            >
              Entrer une dépense / réparation
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            Interface mobile — mise en page responsive
          </div>
        </div>
      </div>
    </div>
  );
}
