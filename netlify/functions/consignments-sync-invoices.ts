// Netlify Function: consignments-sync-invoices
// Job automatique pour synchroniser les factures et créer les mouvements INVOICE/PAYMENT

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[consignments-sync-invoices] Début du job de synchronisation');

    // Peut être appelé en GET ou POST
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    // Authentification optionnelle pour POST manuel
    if (event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabase = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || '', {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'unauthorized' })
          };
        }

        // Vérifier rôle ADMIN
        const { data: profile } = await supabaseService
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const userRole = profile?.role || 'MAGASIN';
        if (userRole !== 'ADMIN_FULL' && userRole !== 'ADMIN') {
          return {
            statusCode: 403,
            body: JSON.stringify({ error: 'forbidden' })
          };
        }
      }
    }

    // Paramètre since pour filtrer les factures modifiées récemment
    const qs = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const sinceParam = qs.since || body.since || null;

    // Par défaut: 2 dernières heures
    const now = new Date();
    const defaultSince = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const since = sinceParam ? new Date(sinceParam) : defaultSince;

    console.log('[consignments-sync-invoices] Synchronisation depuis:', since.toISOString());

    // Compteurs
    let processedCount = 0;
    let invoiceMovesCreated = 0;
    let paymentMovesCreated = 0;
    let errorsCount = 0;

    // ===================================================================
    // 1. Charger le groupe SOUS-TRAITANT
    // ===================================================================
    const { data: groupData } = await supabaseService
      .from('stock_groups')
      .select('id')
      .eq('name', 'SOUS-TRAITANT')
      .maybeSingle();

    const subcontractorGroupId = groupData?.id;
    if (!subcontractorGroupId) {
      console.warn('[consignments-sync-invoices] Groupe SOUS-TRAITANT non trouvé');
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          message: 'Groupe SOUS-TRAITANT non configuré',
          processed: 0
        })
      };
    }

    console.log('[consignments-sync-invoices] Groupe SOUS-TRAITANT ID:', subcontractorGroupId);

    // ===================================================================
    // 2. Charger les lignes de facture avec stock_id dans groupe SOUS-TRAITANT
    // ===================================================================
    const { data: invoiceItemsData, error: itemsError } = await supabaseService
      .from('invoice_items')
      .select(`
        id,
        invoice_id,
        product_id,
        stock_id,
        quantity,
        unit_price,
        tax_rate,
        invoices!inner(id, status, customer_id, updated_at)
      `)
      .not('stock_id', 'is', null)
      .gte('invoices.updated_at', since.toISOString());

    if (itemsError) {
      console.error('[consignments-sync-invoices] Erreur chargement invoice_items:', itemsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'items_error', message: itemsError.message })
      };
    }

    console.log('[consignments-sync-invoices] Lignes de facture trouvées:', invoiceItemsData?.length || 0);

    // ===================================================================
    // 3. Filtrer les lignes dont le stock appartient au groupe SOUS-TRAITANT
    // ===================================================================
    const stockIds = [...new Set((invoiceItemsData || []).map((item: any) => item.stock_id).filter(Boolean))];
    console.log('[consignments-sync-invoices] Stock IDs uniques:', stockIds.length);

    if (stockIds.length === 0) {
      console.log('[consignments-sync-invoices] Aucun stock à traiter');
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          processed: 0,
          message: 'Aucune ligne de facture avec stock sous-traitant'
        })
      };
    }

    const { data: stocksData } = await supabaseService
      .from('stocks')
      .select('id, name, group_id')
      .in('id', stockIds);

    const subcontractorStockIds = new Set(
      (stocksData || [])
        .filter((s: any) => s.group_id === subcontractorGroupId || (s.name || '').startsWith('Sous-traitant:'))
        .map((s: any) => s.id)
    );

    console.log('[consignments-sync-invoices] Stocks sous-traitants:', subcontractorStockIds.size);

    // Filtrer seulement les lignes de facture des stocks sous-traitants
    const relevantItems = (invoiceItemsData || []).filter((item: any) =>
      subcontractorStockIds.has(item.stock_id)
    );

    console.log('[consignments-sync-invoices] Lignes pertinentes:', relevantItems.length);

    // ===================================================================
    // 4. Traiter chaque ligne de facture
    // ===================================================================
    for (const item of relevantItems) {
      try {
        processedCount++;

        const invoiceStatus = (item as any).invoices?.status;
        const invoiceId = item.invoice_id;
        const invoiceItemId = item.id;
        const productId = item.product_id;
        const stockId = item.stock_id;
        const qty = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const taxRate = item.tax_rate ? item.tax_rate / 100 : 0.20; // Convertir de % en décimal

        console.log('[consignments-sync-invoices] Traitement item:', {
          invoiceItemId,
          invoiceStatus,
          productId,
          stockId,
          qty
        });

        if (qty <= 0) {
          console.log('[consignments-sync-invoices] Quantité <= 0, ignoré');
          continue;
        }

        // Récupérer vat_type du produit
        const { data: productData } = await supabaseService
          .from('products')
          .select('vat_type')
          .eq('id', productId)
          .maybeSingle();

        let vatRegime: 'NORMAL' | 'MARGE' = 'NORMAL';
        if (productData?.vat_type === 'margin' || productData?.vat_type === 'marge') {
          vatRegime = 'MARGE';
        }

        // Upsert consignment
        const { data: consignmentData, error: consignmentError } = await supabaseService
          .from('consignments')
          .upsert({
            stock_id: stockId,
            product_id: productId,
            customer_id: (item as any).invoices?.customer_id || null
          }, {
            onConflict: 'stock_id,product_id',
            ignoreDuplicates: false
          })
          .select('id')
          .single();

        if (consignmentError || !consignmentData) {
          console.error('[consignments-sync-invoices] Erreur upsert consignment:', consignmentError);
          errorsCount++;
          continue;
        }

        const consignmentId = consignmentData.id;

        // ---------------------------------------------------------------
        // 4a. Créer mouvement INVOICE si statut = sent (ÉMISE)
        // ---------------------------------------------------------------
        if (invoiceStatus === 'sent' || invoiceStatus === 'draft') {
          // Vérifier si mouvement INVOICE existe déjà
          const { data: existingInvoice } = await supabaseService
            .from('consignment_moves')
            .select('id')
            .eq('invoice_item_id', invoiceItemId)
            .eq('type', 'INVOICE')
            .maybeSingle();

          if (!existingInvoice) {
            const { error: invoiceMoveError } = await supabaseService
              .from('consignment_moves')
              .insert({
                consignment_id: consignmentId,
                type: 'INVOICE',
                qty,
                unit_price_ht: unitPrice,
                vat_rate: taxRate,
                vat_regime: vatRegime,
                invoice_id: invoiceId,
                invoice_item_id: invoiceItemId
              });

            if (invoiceMoveError) {
              console.error('[consignments-sync-invoices] Erreur création INVOICE:', invoiceMoveError);
              errorsCount++;
            } else {
              console.log('[consignments-sync-invoices] Mouvement INVOICE créé');
              invoiceMovesCreated++;
            }
          } else {
            console.log('[consignments-sync-invoices] Mouvement INVOICE existe déjà');
          }
        }

        // ---------------------------------------------------------------
        // 4b. Créer mouvement PAYMENT si statut = paid (PAYÉE)
        // ---------------------------------------------------------------
        if (invoiceStatus === 'paid') {
          // Vérifier si mouvement PAYMENT existe déjà
          const { data: existingPayment } = await supabaseService
            .from('consignment_moves')
            .select('id')
            .eq('invoice_item_id', invoiceItemId)
            .eq('type', 'PAYMENT')
            .maybeSingle();

          if (!existingPayment) {
            const { error: paymentMoveError } = await supabaseService
              .from('consignment_moves')
              .insert({
                consignment_id: consignmentId,
                type: 'PAYMENT',
                qty,
                unit_price_ht: unitPrice,
                vat_rate: taxRate,
                vat_regime: vatRegime,
                invoice_id: invoiceId,
                invoice_item_id: invoiceItemId
              });

            if (paymentMoveError) {
              console.error('[consignments-sync-invoices] Erreur création PAYMENT:', paymentMoveError);
              errorsCount++;
            } else {
              console.log('[consignments-sync-invoices] Mouvement PAYMENT créé');
              paymentMovesCreated++;
            }
          } else {
            console.log('[consignments-sync-invoices] Mouvement PAYMENT existe déjà');
          }
        }

      } catch (itemError: any) {
        console.error('[consignments-sync-invoices] Erreur traitement item:', itemError);
        errorsCount++;
      }
    }

    // ===================================================================
    // 5. Retour résumé
    // ===================================================================
    const result = {
      ok: true,
      processed: processedCount,
      invoice_moves_created: invoiceMovesCreated,
      payment_moves_created: paymentMovesCreated,
      errors: errorsCount,
      since: since.toISOString()
    };

    console.log('[consignments-sync-invoices] Synchronisation terminée:', result);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };

  } catch (error: any) {
    console.error('[consignments-sync-invoices] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'internal_error',
        message: error.message || 'Erreur interne du serveur'
      })
    };
  }
};
