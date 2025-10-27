// Netlify Function: consignments-check-unpaid
// Job automatique quotidien pour détecter les factures de dépôt-vente non payées > X jours

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[consignments-check-unpaid] Début du contrôle des impayés');

    // Paramètre: nombre de jours avant alerte (défaut: 30)
    const qs = event.queryStringParameters || {};
    const daysThreshold = parseInt(qs.days || '30', 10);

    console.log('[consignments-check-unpaid] Seuil:', daysThreshold, 'jours');

    // Date limite
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

    console.log('[consignments-check-unpaid] Date limite:', thresholdDate.toISOString());

    // ===================================================================
    // 1. Charger les mouvements INVOICE sans PAYMENT correspondant
    // ===================================================================
    const { data: invoiceMovesData, error: invoiceError } = await supabaseService
      .from('consignment_moves')
      .select(`
        id,
        consignment_id,
        invoice_id,
        invoice_item_id,
        qty,
        unit_price_ht,
        vat_rate,
        vat_regime,
        created_at,
        consignments!inner(
          stock_id,
          product_id,
          stocks(name),
          products(name, sku),
          customers(name)
        )
      `)
      .eq('type', 'INVOICE')
      .lt('created_at', thresholdDate.toISOString());

    if (invoiceError) {
      console.error('[consignments-check-unpaid] Erreur chargement mouvements INVOICE:', invoiceError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'invoice_error', message: invoiceError.message })
      };
    }

    console.log('[consignments-check-unpaid] Mouvements INVOICE anciens:', invoiceMovesData?.length || 0);

    if (!invoiceMovesData || invoiceMovesData.length === 0) {
      console.log('[consignments-check-unpaid] Aucun impayé détecté');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, unpaid: 0, message: 'Aucun impayé' })
      };
    }

    // ===================================================================
    // 2. Vérifier pour chaque INVOICE si un PAYMENT existe
    // ===================================================================
    let unpaidCount = 0;
    const unpaidList: any[] = [];

    for (const invoiceMove of invoiceMovesData) {
      // Chercher un mouvement PAYMENT pour le même invoice_item_id
      const { data: paymentData } = await supabaseService
        .from('consignment_moves')
        .select('id')
        .eq('invoice_item_id', invoiceMove.invoice_item_id)
        .eq('type', 'PAYMENT')
        .maybeSingle();

      if (!paymentData) {
        // Pas de paiement → impayé
        unpaidCount++;
        unpaidList.push(invoiceMove);

        const stockName = (invoiceMove as any).consignments?.stocks?.name || 'Inconnu';
        const productName = (invoiceMove as any).consignments?.products?.name || 'Inconnu';
        const productSku = (invoiceMove as any).consignments?.products?.sku || '';
        const customerName = (invoiceMove as any).consignments?.customers?.name || null;

        const daysOverdue = Math.floor((now.getTime() - new Date(invoiceMove.created_at).getTime()) / (24 * 60 * 60 * 1000));

        console.log('[consignments-check-unpaid] Impayé détecté:', {
          stockName,
          productName,
          productSku,
          daysOverdue
        });

        // ===================================================================
        // 3. Créer une notification
        // ===================================================================
        const notificationTitle = `Facture impayée depuis ${daysOverdue} jours`;
        const notificationMessage = `Le produit "${productName}" (${productSku}) chez "${stockName}"${customerName ? ` (${customerName})` : ''} est facturé mais non payé depuis ${daysOverdue} jours.`;
        const notificationLink = `/consignments?stock_id=${(invoiceMove as any).consignments?.stock_id}`;

        const { error: notifError } = await supabaseService
          .from('notifications')
          .insert({
            type: 'consignment_unpaid',
            title: notificationTitle,
            message: notificationMessage,
            severity: daysOverdue > 60 ? 'urgent' : 'warning',
            link: notificationLink,
            user_id: null // Notification globale
          });

        if (notifError) {
          console.error('[consignments-check-unpaid] Erreur création notification:', notifError);
        } else {
          console.log('[consignments-check-unpaid] Notification créée');
        }
      }
    }

    // ===================================================================
    // 4. Retour résumé
    // ===================================================================
    const result = {
      ok: true,
      unpaid: unpaidCount,
      threshold_days: daysThreshold,
      checked: invoiceMovesData.length,
      notifications_created: unpaidCount
    };

    console.log('[consignments-check-unpaid] Contrôle terminé:', result);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };

  } catch (error: any) {
    console.error('[consignments-check-unpaid] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
