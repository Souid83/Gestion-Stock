// Netlify Function: consignments-move
// Endpoint pour enregistrer un mouvement OUT (sortie) ou RETURN (retour) vers/depuis un sous-traitant

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[consignments-move] Début de la requête', { method: event.httpMethod });

    // Seules les requêtes POST sont autorisées
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    // Authentification
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.log('[consignments-move] Pas de token Bearer');
      return {
        statusCode: 401,
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
      console.log('[consignments-move] Erreur auth user:', userError);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'unauthorized', message: 'Token invalide' })
      };
    }

    console.log('[consignments-move] Utilisateur authentifié:', user.id);

    // Récupérer le rôle de l'utilisateur
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[consignments-move] Erreur récupération profil:', profileError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'profile_error', message: profileError.message })
      };
    }

    const userRole = profile?.role || 'MAGASIN';
    console.log('[consignments-move] Rôle utilisateur:', userRole);

    // Contrôle d'accès RBAC
    if (userRole === 'COMMANDE') {
      console.log('[consignments-move] Accès refusé pour COMMANDE');
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'forbidden', message: 'Accès non autorisé' })
      };
    }

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { type, stock_id, product_id, qty } = body;

    console.log('[consignments-move] Paramètres:', { type, stock_id, product_id, qty });

    // Validations
    if (!type || !['OUT', 'RETURN'].includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_type', message: 'Type doit être OUT ou RETURN' })
      };
    }

    if (!stock_id || !product_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'missing_params', message: 'stock_id et product_id requis' })
      };
    }

    if (!qty || qty <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_qty', message: 'Quantité doit être > 0' })
      };
    }

    // ===================================================================
    // 1. Vérifier que le stock appartient au groupe SOUS-TRAITANT
    // ===================================================================
    const { data: stockData, error: stockError } = await supabaseService
      .from('stocks')
      .select('id, name, group_id, stock_groups(name)')
      .eq('id', stock_id)
      .maybeSingle();

    if (stockError || !stockData) {
      console.error('[consignments-move] Stock non trouvé:', stockError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'stock_not_found', message: 'Stock introuvable' })
      };
    }

    const stockGroupName = (stockData as any).stock_groups?.name;
    console.log('[consignments-move] Stock groupe:', stockGroupName);

    if (stockGroupName !== 'SOUS-TRAITANT' && !(stockData.name || '').startsWith('Sous-traitant:')) {
      console.log('[consignments-move] Stock pas dans groupe SOUS-TRAITANT');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_stock', message: 'Ce stock n\'est pas un stock sous-traitant' })
      };
    }

    // ===================================================================
    // 2. Charger les informations du produit pour calculer les montants
    // ===================================================================
    const { data: productData, error: productError } = await supabaseService
      .from('products')
      .select('id, name, sku, sale_price_ht, sale_price_ttc, tax_rate, vat_type')
      .eq('id', product_id)
      .maybeSingle();

    if (productError || !productData) {
      console.error('[consignments-move] Produit non trouvé:', productError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'product_not_found', message: 'Produit introuvable' })
      };
    }

    console.log('[consignments-move] Produit chargé:', productData.sku);

    // Calculer prix HT
    let unitPriceHT = productData.sale_price_ht;
    if (!unitPriceHT && productData.sale_price_ttc) {
      const taxRate = productData.tax_rate || 0.20;
      unitPriceHT = productData.sale_price_ttc / (1 + taxRate);
      console.log('[consignments-move] Prix HT calculé depuis TTC:', unitPriceHT);
    }

    if (!unitPriceHT || unitPriceHT <= 0) {
      console.warn('[consignments-move] Prix HT invalide, utilisation de 0');
      unitPriceHT = 0;
    }

    // Taux TVA
    const vatRate = productData.tax_rate || 0.20;

    // Régime TVA
    let vatRegime: 'NORMAL' | 'MARGE' = 'NORMAL';
    if (productData.vat_type === 'margin' || productData.vat_type === 'marge') {
      vatRegime = 'MARGE';
    }

    console.log('[consignments-move] Calculs:', { unitPriceHT, vatRate, vatRegime });

    // ===================================================================
    // 3. Récupérer customer_id depuis mapping si existe
    // ===================================================================
    const { data: mappingData } = await supabaseService
      .from('consignment_stock_customer_map')
      .select('customer_id')
      .eq('stock_id', stock_id)
      .maybeSingle();

    const customerId = mappingData?.customer_id || null;
    console.log('[consignments-move] Customer ID depuis mapping:', customerId);

    // ===================================================================
    // 4. Upsert consignment
    // ===================================================================
    const { data: consignmentData, error: consignmentError } = await supabaseService
      .from('consignments')
      .upsert({
        stock_id,
        product_id,
        customer_id: customerId
      }, {
        onConflict: 'stock_id,product_id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (consignmentError) {
      console.error('[consignments-move] Erreur upsert consignment:', consignmentError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'consignment_error', message: consignmentError.message })
      };
    }

    const consignmentId = consignmentData.id;
    console.log('[consignments-move] Consignment ID:', consignmentId);

    // ===================================================================
    // 5. Insérer le mouvement
    // ===================================================================
    const { data: moveData, error: moveError } = await supabaseService
      .from('consignment_moves')
      .insert({
        consignment_id: consignmentId,
        type,
        qty,
        unit_price_ht: unitPriceHT,
        vat_rate: vatRate,
        vat_regime: vatRegime
      })
      .select('id')
      .single();

    if (moveError) {
      console.error('[consignments-move] Erreur insert mouvement:', moveError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'move_error', message: moveError.message })
      };
    }

    const moveId = moveData.id;
    console.log('[consignments-move] Mouvement créé:', moveId);

    // ===================================================================
    // 6. Retour succès
    // ===================================================================
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        ok: true,
        move_id: moveId,
        consignment_id: consignmentId,
        type,
        qty,
        unit_price_ht: unitPriceHT,
        vat_rate: vatRate,
        vat_regime: vatRegime
      })
    };

  } catch (error: any) {
    console.error('[consignments-move] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: error.message || 'Erreur interne du serveur'
      })
    };
  }
};
