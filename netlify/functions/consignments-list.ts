// Netlify Function: consignments-list
// Endpoint pour lister les dépôts-vente par sous-traitant avec synthèse et détails

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  // CORS origin dynamique (autorise prod + dev)
  const origin = (event.headers?.origin as string) || (event.headers?.Origin as string) || '';
  const ALLOWED_ORIGINS = new Set([
    'https://dev-gestockflow.netlify.app',
    'http://localhost:5173'
  ]);
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://dev-gestockflow.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Validate required envs before proceeding
  const missingEnv: string[] = [];
  if (!SUPABASE_URL) missingEnv.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingEnv.length > 0) {
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'missing_env', missing: missingEnv })
    };
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[consignments-list] Début de la requête', { method: event.httpMethod });

    // Seules les requêtes GET sont autorisées
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    // Authentification
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.log('[consignments-list] Pas de token Bearer');
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'unauthorized', message: 'Token manquant' })
      };
    }

    const token = authHeader.substring(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Récupérer l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('[consignments-list] Erreur auth user:', userError);
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'unauthorized', message: 'Token invalide' })
      };
    }

    console.log('[consignments-list] Utilisateur authentifié:', user.id);

    // Récupérer le rôle de l'utilisateur
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[consignments-list] Erreur récupération profil:', profileError);
      return {
        statusCode: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'profile_error', message: profileError.message })
      };
    }

    const userRole = profile?.role || 'MAGASIN';
    console.log('[consignments-list] Rôle utilisateur:', userRole);

    // Contrôle d'accès RBAC
    if (userRole === 'COMMANDE') {
      console.log('[consignments-list] Accès refusé pour COMMANDE');
      return {
        statusCode: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'forbidden', message: 'Accès non autorisé pour ce rôle' })
      };
    }

    // Permissions pour afficher TVA et montants
    const canViewVAT = userRole === 'ADMIN_FULL' || userRole === 'ADMIN';
    console.log('[consignments-list] Peut voir TVA:', canViewVAT);

    // Paramètres de query
    const qs = event.queryStringParameters || {};
    const stockId = qs.stock_id || null;
    const customerId = qs.customer_id || null;
    const searchQuery = qs.q || null;
    const fromDate = qs.from || null;
    const toDate = qs.to || null;
    const detail = qs.detail === '1';

    console.log('[consignments-list] Paramètres:', { stockId, customerId, searchQuery, fromDate, toDate, detail });

    // ===================================================================
    // 1. Charger la synthèse par stock (vue consignment_summary_by_stock)
    // ===================================================================
    let summaryQuery = supabaseService
      .from('consignment_summary_by_stock')
      .select('*');

    if (stockId) {
      summaryQuery = summaryQuery.eq('stock_id', stockId);
    }
    if (customerId) {
      summaryQuery = summaryQuery.eq('customer_id', customerId);
    }

    const { data: summaryData, error: summaryError } = await summaryQuery;

    if (summaryError) {
      console.error('[consignments-list] Erreur chargement synthèse:', summaryError);

      // Fallback propre si la vue n'existe pas (42P01 / "does not exist"):
      const msg = String(summaryError?.message || '');
      const code = (summaryError as any)?.code || '';
      const missingView =
        msg.toLowerCase().includes('does not exist') ||
        code === '42P01';

      if (missingView) {
        // Répondre 200 avec synthèse vide pour ne pas casser l'UI
        const response = {
          ok: true,
          summary: [],
          meta: {
            user_role: userRole,
            can_view_vat: canViewVAT,
            filters: { stockId, customerId, searchQuery, fromDate, toDate }
          }
        };

        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': 'content-type, authorization'
          },
          body: JSON.stringify(response)
        };
      }

      return {
        statusCode: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'summary_error', message: summaryError.message })
      };
    }

    console.log('[consignments-list] Synthèse chargée:', summaryData?.length || 0, 'stocks');

    // Masquer les montants si l'utilisateur ne peut pas voir la TVA
    const summary = (summaryData || []).map((item: any) => {
      if (!canViewVAT) {
        return {
          ...item,
          total_ht: null,
          total_ttc: null,
          total_tva_normal: null,
          total_tva_marge: null
        };
      }
      return item;
    });

    // ===================================================================
    // 2. Charger le détail par produit si demandé
    // ===================================================================
    let detailData: any[] = [];

    if (detail && stockId) {
      console.log('[consignments-list] Chargement détails pour stock:', stockId);

      let detailQuery = supabaseService
        .from('consignment_lines_view')
        .select('*')
        .eq('stock_id', stockId);

      // Filtres optionnels
      if (searchQuery) {
        detailQuery = detailQuery.or(`product_name.ilike.%${searchQuery}%,product_sku.ilike.%${searchQuery}%`);
      }

      const { data: detailResult, error: detailError } = await detailQuery;

      let useFallback = false;
      if (detailError) {
        console.error('[consignments-list] Erreur chargement détails:', detailError);
        const msg = String((detailError as any)?.message || '');
        const code = (detailError as any)?.code || '';
        const missingView = msg.toLowerCase().includes('does not exist') || code === '42P01';
        useFallback = missingView;
      } else if (!detailResult || detailResult.length === 0) {
        useFallback = true;
      }

      if (!useFallback && detailResult) {
        console.log('[consignments-list] Détails chargés:', detailResult?.length || 0, 'produits');

        // Masquer les montants si nécessaire
        detailData = (detailResult || []).map((item: any) => {
          if (!canViewVAT) {
            return {
              ...item,
              montant_ht: null,
              tva_normal: null,
              tva_marge: null
            };
          }
          return item;
        });
      } else {
        // Fallback: reconstruire les lignes depuis consignments + consignment_moves
        console.log('[consignments-list] Fallback détail via consignments/consignment_moves pour stock:', stockId);
        const { data: consRows, error: consErr } = await supabaseService
          .from('consignments')
          .select(`
            id,
            stock_id,
            product_id,
            product:products(name,sku),
            moves:consignment_moves(qty,type,unit_price_ht,vat_rate,vat_regime,created_at)
          `)
          .eq('stock_id', stockId);

        if (consErr) {
          console.error('[consignments-list] Fallback erreur consignments:', consErr);
        } else {
          const linesMap = new Map<string, any>();

          for (const c of (consRows || [])) {
            const pid = c.product_id as string;
            const key = pid;
            const prod = Array.isArray(c.product) ? c.product[0] : c.product;
            const productName = prod?.name ?? null;
            const productSku = prod?.sku ?? null;
            const moves = Array.isArray(c.moves) ? c.moves : [];

            let qtyDepot = 0;
            let qtyFactureNP = 0;
            let montantHT = 0;
            let tvaNormale = 0;
            let tvaMarge = 0;
            let lastMoveAt: string | null = null;

            for (const m of moves) {
              const q = Number(m.qty || 0);
              const up = Number(m.unit_price_ht || 0);
              const vatRate = Number(m.vat_rate || 0);
              const regime = String(m.vat_regime || '').toUpperCase();
              const t = String(m.type || '').toUpperCase();

              if (t === 'OUT') qtyDepot += q;
              else if (t === 'RETURN') qtyDepot -= q;

              if (t === 'INVOICE') qtyFactureNP += q;
              else if (t === 'PAYMENT') qtyFactureNP -= q;

              if (t === 'OUT' || t === 'INVOICE') {
                montantHT += up * q;
                if (regime === 'NORMAL') tvaNormale += up * q * vatRate;
                if (regime === 'MARGE') tvaMarge += up * q * vatRate;
              } else if (t === 'PAYMENT') {
                montantHT -= up * q;
                if (regime === 'NORMAL') tvaNormale -= up * q * vatRate;
                if (regime === 'MARGE') tvaMarge -= up * q * vatRate;
              }

              const ts = m.created_at ? new Date(m.created_at).toISOString() : null;
              if (ts && (!lastMoveAt || ts > lastMoveAt)) lastMoveAt = ts;
            }

            const row = {
              consignment_id: c.id,
              stock_id: c.stock_id,
              product_id: pid,
              product_name: productName,
              product_sku: productSku,
              qty_en_depot: qtyDepot,
              qty_facture_non_payee: qtyFactureNP,
              montant_ht: montantHT,
              tva_normal: tvaNormale,
              tva_marge: tvaMarge,
              last_move_at: lastMoveAt
            };

            // Appliquer filtre de recherche si demandé
            if (searchQuery) {
              const ql = searchQuery.toLowerCase();
              const match =
                (String(productName || '').toLowerCase().includes(ql)) ||
                (String(productSku || '').toLowerCase().includes(ql));
              if (!match) continue;
            }

            linesMap.set(key, row);
          }

          detailData = Array.from(linesMap.values()).map((item: any) => {
            if (!canViewVAT) {
              return {
                ...item,
                montant_ht: null,
                tva_normal: null,
                tva_marge: null
              };
            }
            return item;
          });

          console.log('[consignments-list] Fallback détails construits:', detailData.length);
        }
      }
    }

    // ===================================================================
    // 3. Retour JSON
    // ===================================================================
    const response = {
      ok: true,
      summary,
      detail: detail ? detailData : undefined,
      meta: {
        user_role: userRole,
        can_view_vat: canViewVAT,
        filters: { stockId, customerId, searchQuery, fromDate, toDate }
      }
    };

    console.log('[consignments-list] Réponse envoyée avec', summary.length, 'stocks');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      },
      body: JSON.stringify(response)
    };

  } catch (error: any) {
    console.error('[consignments-list] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'internal_error',
        message: error.message || 'Erreur interne du serveur'
      })
    };
  }
};
