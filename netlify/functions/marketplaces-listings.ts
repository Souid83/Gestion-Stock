process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

export const handler = async (event) => {
  const { createClient } = await import('@supabase/supabase-js');
  console.info('🚀 marketplaces-listings (offers) triggered');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const badRequest = (code) => ({ statusCode: 400, body: JSON.stringify({ error: code }) });
  const srvError = (code, detail) => ({ statusCode: 500, body: JSON.stringify({ error: code, detail }) });

  try {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };

    const qs = event.queryStringParameters || {};
    const account_id = qs.account_id;
    const limit = Math.min(parseInt(qs.limit || '50', 10) || 50, 200);
    const offset = parseInt(qs.offset || '0', 10) || 0;
    const maxOffersPerSku = parseInt(qs.max_offers_per_sku || '5', 10) || 5;
    const CONCURRENCY = Math.min(parseInt(qs.concurrency || '3', 10) || 3, 10);

    if (!account_id) return badRequest('missing_account_id');
    console.info('📋 Fetching account:', account_id, 'limit:', limit, 'offset:', offset, 'maxOffersPerSku:', maxOffersPerSku);

    const { data: account } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();
    if (!account) return { statusCode: 404, body: JSON.stringify({ error: 'account_not_found' }) };
    console.info('✅ Account found:', account.id);

    const { data: tokenRow } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tokenRow) return { statusCode: 424, body: JSON.stringify({ error: 'token_missing' }) };
    console.info('✅ Token found');

    const baseHost = account.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' });

    const readText = async (resp) => { try { return await resp.text(); } catch { return ''; } };
    const parseJson = (txt) => { try { return JSON.parse(txt); } catch { return null; } };

    // 1) Inventory → SKUs
    const inventoryUrl = new URL('/sell/inventory/v1/inventory_item', baseHost);
    inventoryUrl.searchParams.set('limit', String(limit));
    inventoryUrl.searchParams.set('offset', String(offset));
    console.info('🔄 Fetching inventory items:', inventoryUrl.toString());

    let accessToken = tokenRow.access_token;

    let invResp = await fetch(inventoryUrl.toString(), { method: 'GET', headers: authHeaders(accessToken) });
    if (invResp.status === 401) {
      console.warn('⚠️ Inventory 401 — attempting refresh');
      if (!tokenRow.refresh_token) {
        console.error('❌ token_missing_refresh');
        return { statusCode: 424, body: JSON.stringify({ error: 'token_missing_refresh' }) };
      }
      if (!account.client_id || !account.client_secret) {
        console.error('❌ client_credentials_missing');
        return { statusCode: 424, body: JSON.stringify({ error: 'client_credentials_missing' }) };
      }

      const refreshed = await refreshAccessToken({
        client_id: account.client_id,
        client_secret: account.client_secret,
        refresh_token: tokenRow.refresh_token,
        scopes: Array.isArray(tokenRow.scopes) && tokenRow.scopes.length > 0
          ? tokenRow.scopes.join(' ')
          : 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.account.readonly',
        environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
      });

      if (!refreshed || !refreshed.access_token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
      }

      await supabaseService.from('oauth_tokens').insert({
        marketplace_account_id: account.id,
        provider: 'ebay',
        environment: account.environment === 'sandbox' ? 'sandbox' : 'production',
        access_token: refreshed.access_token,
        refresh_token: tokenRow.refresh_token,
        expires_in: refreshed.expires_in || null,
        scopes: tokenRow.scopes || null
      });

      accessToken = refreshed.access_token;
      invResp = await fetch(inventoryUrl.toString(), { method: 'GET', headers: authHeaders(accessToken) });
    }

    const invText = await readText(invResp);
    if (!invResp.ok) {
      console.error('❌ inventory_error', invText.substring(0, 200));
      return { statusCode: invResp.status, body: invText || JSON.stringify({ error: 'inventory_error' }) };
    }

    const invJson = parseJson(invText);
    if (!invJson) {
      console.error('❌ invalid_json_inventory', invText.substring(0, 200));
      return { statusCode: 502, body: JSON.stringify({ error: 'invalid_json_inventory', raw: invText.substring(0, 200) }) };
    }

    const inventoryItems = Array.isArray(invJson.inventoryItems) ? invJson.inventoryItems : [];
    const skus = inventoryItems.map((it) => it && (it.sku || it.SKU || it.Sku)).filter(Boolean);
    console.info('📦 Inventory SKUs found:', skus.length);
    if (skus.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ items: [], count: 0, limit, offset, processed_skus: 0, skipped_skus: 0 }) };
    }

    // 2) Offers by SKU (no Accept-Language)
    const fetchOffersBySku = async (token, sku) => {
      const url = new URL('/sell/inventory/v1/offer', baseHost);
      url.searchParams.set('sku', sku);
      url.searchParams.set('limit', String(maxOffersPerSku));
      url.searchParams.set('offset', '0');

      const resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token) });
      const raw = await readText(resp);

      if (resp.status === 400 && raw.includes('"errorId":25707')) {
        console.warn('⚠️ invalid_sku_25707, skipping SKU:', sku);
        return [];
      }
      if (!resp.ok) {
        console.error('❌ getOffers_error', sku, raw.substring(0, 200));
        return [];
      }

      const js = parseJson(raw);
      return Array.isArray(js?.offers) ? js.offers : [];
    };

    const allOffers = [];
    let skipped = 0;
    for (let i = 0; i < skus.length; i += CONCURRENCY) {
      const batch = skus.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(batch.map((sku) => fetchOffersBySku(accessToken, sku)));
      for (const r of settled) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allOffers.push(...r.value);
        } else {
          skipped++;
        }
      }
    }
    console.info('🧾 Offers collected:', allOffers.length);

    // 3) Mapping + upsert
    const defaultCurrency = account.currency || 'EUR';
    const items = allOffers.map((offer) => ({
      provider: 'ebay',
      marketplace_account_id: account_id,
      remote_id: offer?.offerId || null,
      remote_sku: offer?.sku || null,
      title: offer?.listingDescription || '',
      price_amount: offer?.pricingSummary?.price?.value ? parseFloat(offer.pricingSummary.price.value) : null,
      price_currency: offer?.pricingSummary?.price?.currency || defaultCurrency,
      status_sync: offer?.listingStatus || 'UNKNOWN',
      updated_at: new Date().toISOString()
    })).filter((it) => it.remote_id);

    if (items.length > 0) {
      const { error: upsertError } = await supabaseService
        .from('marketplace_listings')
        .upsert(items, { onConflict: 'provider,marketplace_account_id,remote_id' });
      if (upsertError) {
        console.error('❌ upsert_failed', upsertError);
        return srvError('upsert_failed', upsertError.message || 'unknown');
      }
    }

    console.info('✅ Successfully synced', items.length, 'offers');
    return { statusCode: 200, body: JSON.stringify({ items, count: items.length, limit, offset, processed_skus: skus.length, skipped_skus: skipped }) };
  } catch (err) {
    console.error('🔥 fatal', err?.message || err);
    return srvError('server_error', err?.message || 'unknown');
  }
};

async function refreshAccessToken({ client_id, client_secret, refresh_token, scopes, environment = 'production' }) {
  const endpoint = environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refresh_token);
  if (scopes) body.set('scope', scopes);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error('❌ refresh_access_token_failed status=', resp.status, ' endpoint=', endpoint, ' body=', text.substring(0, 120));
      return null;
    }
    try {
      const json = JSON.parse(text);
      if (!json?.access_token) {
        console.error('❌ refresh_access_token_no_access_token body=', text.substring(0, 120));
        return null;
      }
      return json;
    } catch {
      console.error('❌ refresh_access_token_invalid_json', text.substring(0, 120));
      return null;
    }
  } catch (e) {
    console.error('❌ refresh_access_token_exception', e?.message || String(e));
    return null;
  }
}
