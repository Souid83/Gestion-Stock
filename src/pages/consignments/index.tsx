/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { canViewConsignments } from '../../lib/rbac';
import type { Role } from '../../lib/rbac';
import { supabase } from '../../lib/supabase';
import { ConsignmentsSection } from '../../components/ConsignmentsSection';

export function Consignments() {
  const [userRole, setUserRole] = useState<Role>('MAGASIN');

  // Charger le rôle utilisateur (profil) une seule fois
  useEffect(() => {
    let cancelled = false;
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (!cancelled) {
            setUserRole((profile?.role as Role) || 'MAGASIN');
          }
        }
      } catch {
        // rôle par défaut MAGASIN
      }
    };
    fetchUserRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Contrôle d'accès placé juste avant le return JSX
  if (!canViewConsignments(userRole)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="font-semibold text-red-800">Accès refusé</div>
          <p className="text-red-700 mt-2">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  // Wrapper "embed-ready" : rend la section réutilisable
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ConsignmentsSection />
      </div>
    </div>
  );
}

export default Consignments;
