// Netlify Function: ebay-orders-sync
// Scheduled ingestion of eBay orders to decrement EBAY stock on parent products (parentOnly) with idempotent processing.
//
// Behavior:
// - For each active eBay account, fetch orders modified in the last 2 hours from eBay Fulfillment API.
// - For each order line, map remote_sku -> product_id via marketplace_products_map restricted to that account.
// - Compute parentId for the mapped product (parent_id if present else id).
// - Decrement stock_produit for (produit_id = parentId, stock_id = EBAY) by the order quantity (clamped >= 0).
// - Insert a record into marketplace_orders_processed with unique (provider, account_id, remote_order_id, remote_line_id) to ensure idempotency.
//
// Notes:
// - Uses the EBAY stock UUID provided by the user. Can be overridden with env EBAY_STOCK_ID if present.
// - Best-effort; continues on errors and logs them.


export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Only GET/POST
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const qs = event.queryStringParameters || {};
    const oneAccountId = qs.account_id || null;

    const EBAY_STOCK_ID =
      process.env.EBAY_STOCK_ID ||
      'adf77dc9-8594-45a2-9d2e-501d62f6fb7f'; // fallback to provided EBAY stock UUID

    // 1) Load active eBay accounts (optionally filtered by account_id)
    let accQuery = supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('provider', 'ebay')
      .eq('is_active', true);

    if (oneAccountId) {
      accQuery = accQuery.eq('id', oneAccountId);
    }

    const { data: accounts, error: accErr } = await accQuery;
    if (accErr) {
      return { statusCode: 500, body: JSON.stringify({ error: 'accounts_fetch_failed', detail: accErr.message || 'unknown' }) };
    }

    const activeAccounts = Array.isArray(accounts) ? (accounts as any[]) : [];
    if (activeAccounts.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, accounts: 0, processed: 0 }) };
    }

    // 2) Time window: last 2 hours (can be tuned)
    const now = new Date();
    const from = new Date(now.getTime() - 1000 * 60 * 120); // 2 hours back
    const fromISO = from.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const untilISO = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

    let totalProcessed = 0;
    const accountSummaries: any[] = [];

    // Helpers
    const baseHostFor = (env: string) => (env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com');
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' as const });

    const readText = async (resp: any) => {
      try {
        return await resp.text();
      } catch {
        return '';
      }
    };
    const parseJson = (txt: string) => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    };

    // Iterate per account
    for (const account of activeAccounts) {
      const accId = account.id as string;
      const baseHost = baseHostFor(account.environment === 'sandbox' ? 'sandbox' : 'production');

      // Load latest token
      const { data: tokenRow } = await supabaseService
        .from('oauth_tokens')
        .select('*')
        .eq('marketplace_account_id', accId)
        .eq('provider', 'ebay')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow) {
        accountSummaries.push({ account_id: accId, processed: 0, reason: 'missing_token' });
        continue;
      }

      // get or refresh access token
      let accessToken: string | null = tokenRow.access_token || null;
      const ensureAccessToken = async (): Promise<string | null> => {
        if (!accessToken) return null;
        // make a light test call to avoid immediate 401 detection overhead (we can just try first page)
        return accessToken;
      };

      let processedForAcc = 0;

      // 3) Fetch orders from eBay Fulfillment API with paging
      // Using lastmodifieddate window to catch updates
      // GET /sell/fulfillment/v1/order?filter=lastmodifieddate:[from..to]&limit=100
      const baseOrdersUrl = new URL('/sell/fulfillment/v1/order', baseHost);
      baseOrdersUrl.searchParams.set('filter', `lastmodifieddate:[${fromISO}..${untilISO}]`);
      baseOrdersUrl.searchParams.set('limit', '100');

      const seenLines = new Set<string>(); // remote_order_id|remote_line_id
      let pageUrl: string | null = baseOrdersUrl.toString();
      let token = await ensureAccessToken();
      if (!token) {
        accountSummaries.push({ account_id: accId, processed: 0, reason: 'no_access_token' });
        continue;
      }

      // eBay returns 'orders' array, 'href', 'next'
      while (pageUrl) {
        let resp = await fetch(pageUrl, { method: 'GET', headers: headers(token) });
        let raw = await readText(resp);

        // Handle 401 -> attempt refresh once
        if (resp.status === 401) {
          if (!tokenRow.refresh_token || !account.client_id || !account.client_secret) {
            accountSummaries.push({ account_id: accId, processed: processedForAcc, reason: 'cannot_refresh' });
            break;
          }
          const refreshed = await refreshAccessToken({
            client_id: account.client_id,
            client_secret: account.client_secret,
            refresh_token: tokenRow.refresh_token,
            scopes: Array.isArray(tokenRow.scopes) && tokenRow.scopes.length > 0
              ? tokenRow.scopes.join(' ')
              : 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
            environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
          });
          if (!refreshed?.access_token) {
            accountSummaries.push({ account_id: accId, processed: processedForAcc, reason: 'token_expired' });
            break;
          }
          // Persist refreshed token
          await supabaseService.from('oauth_tokens').insert({
            marketplace_account_id: accId,
            provider: 'ebay',
            environment: account.environment === 'sandbox' ? 'sandbox' : 'production',
            access_token: refreshed.access_token,
            refresh_token: tokenRow.refresh_token,
            expires_in: refreshed.expires_in || null,
            scopes: tokenRow.scopes || null
          });
          token = refreshed.access_token;
          resp = await fetch(pageUrl, { method: 'GET', headers: headers(token) });
          raw = await readText(resp);
        }

        if (!resp.ok) {
          // Stop paging on error for this account
          console.warn('ebay-orders-sync: orders fetch failed', accId, resp.status, raw?.substring(0, 200));
          break;
        }

        const js = parseJson(raw);
        const orders = Array.isArray(js?.orders) ? js.orders : [];
        const nextLink = typeof js?.next === 'string' ? (js.next as string) : null;
        const candidates: { remote_order_id: string; remote_line_id: string; sku: string; quantity: number }[] = [];

        for (const order of orders) {
          const remoteOrderId = order?.orderId || order?.order_id || order?.id || '';
          const lines: any[] =
            Array.isArray(order?.lineItems) ? order.lineItems :
            Array.isArray(order?.lineItemSummaries) ? order.lineItemSummaries :
            [];

          for (const li of lines) {
            const sku: string =
              (li?.sku || li?.legacySku || li?.lineItemSku || '').toString().trim();
            const remoteLineId: string = (li?.lineItemId || li?.lineItemIdValue || '').toString().trim();
            const qty: number = Number(li?.quantity || li?.quantityPurchased || 0) || 0;

            if (!remoteOrderId || !remoteLineId || !sku || qty <= 0) continue;

            const key = `${remoteOrderId}|${remoteLineId}`;
            if (seenLines.has(key)) continue;
            seenLines.add(key);

            candidates.push({
              remote_order_id: remoteOrderId,
              remote_line_id: remoteLineId,
              sku,
              quantity: qty
            });
          }
        }

        // Process candidates
        for (const c of candidates) {
          // Idempotence: skip if already processed
          const { data: already } = await supabaseService
            .from('marketplace_orders_processed')
            .select('id')
            .eq('provider', 'ebay')
            .eq('marketplace_account_id', accId)
            .eq('remote_order_id', c.remote_order_id)
            .eq('remote_line_id', c.remote_line_id)
            .maybeSingle();

          if (already && (already as any).id) {
            continue;
          }

          // Resolve mapping for this account and SKU
          const { data: mapRow } = await supabaseService
            .from('marketplace_products_map')
            .select('product_id')
            .eq('provider', 'ebay')
            .eq('marketplace_account_id', accId)
            .eq('remote_sku', c.sku)
            .maybeSingle();

          if (!mapRow || !(mapRow as any).product_id) {
            // not mapped -> record and continue
            await upsertProcessedSafe(supabaseService, {
              provider: 'ebay',
              marketplace_account_id: accId,
              remote_order_id: c.remote_order_id,
              remote_line_id: c.remote_line_id,
              product_id: null,
              quantity: c.quantity
            });
            continue;
          }

          const productId = (mapRow as any).product_id as string;

          // Find parentId (parentOnly decrement)
          const { data: prodRow } = await supabaseService
            .from('products')
            .select('id,parent_id')
            .eq('id', productId)
            .maybeSingle();

          const parentId = ((prodRow as any)?.parent_id as string) || ((prodRow as any)?.id as string);
          if (!parentId) {
            await upsertProcessedSafe(supabaseService, {
              provider: 'ebay',
              marketplace_account_id: accId,
              remote_order_id: c.remote_order_id,
              remote_line_id: c.remote_line_id,
              product_id: productId,
              quantity: c.quantity
            });
            continue;
          }

          // Decrement stock_produit for (parentId, EBAY_STOCK_ID)
          try {
            const { data: spRow } = await supabaseService
              .from('stock_produit')
              .select('id, quantite')
              .eq('produit_id', parentId)
              .eq('stock_id', EBAY_STOCK_ID)
              .maybeSingle();

            if (spRow && (spRow as any).id) {
              const currentQ = Number((spRow as any).quantite) || 0;
              const newQ = Math.max(0, currentQ - c.quantity);
              const { error: upErr } = await supabaseService
                .from('stock_produit')
                .update({ quantite: newQ, updated_at: new Date().toISOString() } as any)
                .eq('id', (spRow as any).id as any);
              if (upErr) {
                console.warn('ebay-orders-sync: decrement failed', accId, parentId, upErr);
              }
            } else {
              // permissive: create row with 0 (we cannot decrement below 0)
              const { error: insErr } = await supabaseService
                .from('stock_produit')
                .insert([{ produit_id: parentId as any, stock_id: EBAY_STOCK_ID as any, quantite: 0 } as any]);
              if (insErr) {
                console.warn('ebay-orders-sync: create missing stock_produit failed', accId, parentId, insErr);
              }
            }

            // Mark processed
            await upsertProcessedSafe(supabaseService, {
              provider: 'ebay',
              marketplace_account_id: accId,
              remote_order_id: c.remote_order_id,
              remote_line_id: c.remote_line_id,
              product_id: parentId,
              quantity: c.quantity
            });

            processedForAcc++;
            totalProcessed++;
          } catch (e: any) {
            console.warn('ebay-orders-sync: decrement exception', accId, parentId, e?.message || e);
          }
        }

        // Next page
        pageUrl = nextLink || null;
      }

      accountSummaries.push({ account_id: accId, processed: processedForAcc });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        accounts: activeAccounts.length,
        processed: totalProcessed,
        details: accountSummaries
      })
    };
  } catch (err: any) {
    console.error('ebay-orders-sync fatal', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: err?.message || 'unknown' }) };
  }
};

// Helpers

async function upsertProcessedSafe(
  supabaseService: any,
  row: {
    provider: 'ebay';
    marketplace_account_id: string;
    remote_order_id: string;
    remote_line_id: string;
    product_id: string | null;
    quantity: number;
  }
) {
  try {
    await supabaseService
      .from('marketplace_orders_processed')
      .insert({
        provider: row.provider,
        marketplace_account_id: row.marketplace_account_id,
        remote_order_id: row.remote_order_id,
        remote_line_id: row.remote_line_id,
        product_id: row.product_id,
        quantity: row.quantity,
        processed_at: new Date().toISOString()
      });
  } catch (e) {
    // unique violation or others — ignore
  }
}

async function refreshAccessToken({
  client_id,
  client_secret,
  refresh_token,
  scopes,
  environment = 'production'
}: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  scopes: string;
  environment?: 'production' | 'sandbox';
}): Promise<{ access_token?: string; expires_in?: number } | null> {
  const endpoint =
    environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', refresh_token);
  params.set('scope', scopes);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.warn('refreshAccessToken failed', resp.status, text?.substring(0, 200));
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn('refreshAccessToken exception', (e as any)?.message || e);
    return null;
  }
}
