process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

export const handler = async (event) => {
  const { createClient } = await import('@supabase/supabase-js');

  console.info('🚀 marketplaces-listings (offers) triggered');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const RBAC_BYPASS = process.env.RBAC_DISABLED === 'true';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const badRequest = (code) => ({ statusCode: 400, body: JSON.stringify({ error: code }) });
  const srvError = (code, detail) => ({ statusCode: 500, body: JSON.stringify({ error: code, detail }) });

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const qs = event.queryStringParameters || {};
    const account_id = qs.account_id;
    const limit = Math.min(parseInt(qs.limit || '50', 10) || 50, 200);
    const offset = parseInt(qs.offset || '0', 10) || 0;

    if (!account_id) return badRequest('missing_account_id');

    console.log('📋 Fetching account:', account_id, 'limit:', limit, 'offset:', offset);

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('environment', 'production')
      .eq('is_active', true)
      .maybeSingle();

    if (accErr || !account) {
      console.error('❌ account_not_found', accErr);
      return { statusCode: 404, body: JSON.stringify({ error: 'account_not_found' }) };
    }

    console.log('✅ Account found:', account.id);

    const { data: tokenRow, error: tokErr } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokErr || !tokenRow) {
      console.error('❌ token_missing', tokErr);
      return { statusCode: 424, body: JSON.stringify({ error: 'token_missing' }) };
    }

    console.log('✅ Token found');

    const baseHost = 'https://api.ebay.com';
    const offersUrl = new URL('/sell/inventory/v1/offer', baseHost);
    offersUrl.searchParams.set('limit', String(limit));
    offersUrl.searchParams.set('offset', String(offset));

    const defaultHeaders = (token) => ({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    });

    const fetchOffers = async (token) => {
      console.log('🔄 Fetching offers from eBay:', offersUrl.toString());
      return fetch(offersUrl.toString(), {
        method: 'GET',
        headers: defaultHeaders(token)
      });
    };

    const readText = async (resp) => {
      try {
        return await resp.text();
      } catch {
        return '';
      }
    };

    const parseJsonSafe = (txt) => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    };

    let response = await fetchOffers(tokenRow.access_token);
    console.log('📡 eBay response status:', response.status);

    if (response.status === 401) {
      console.warn('⚠️ eBay 401 on offers — token likely expired');
      if (tokenRow.refresh_token && account.client_id && account.client_secret) {
        console.log('🔄 Attempting token refresh...');
        const refreshed = await refreshAccessToken({
          client_id: account.client_id,
          client_secret: account.client_secret,
          refresh_token: tokenRow.refresh_token,
          scopes: Array.isArray(tokenRow.scopes) && tokenRow.scopes.length > 0
            ? tokenRow.scopes.join(' ')
            : 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly'
        });

        if (refreshed && refreshed.access_token) {
          console.log('✅ Token refreshed successfully');
          await supabaseService
            .from('oauth_tokens')
            .insert({
              marketplace_account_id: account_id,
              provider: 'ebay',
              access_token: refreshed.access_token,
              refresh_token: tokenRow.refresh_token,
              expires_in: refreshed.expires_in || null,
              scopes: tokenRow.scopes || null
            });

          response = await fetchOffers(refreshed.access_token);
          console.log('📡 Retry after refresh - status:', response.status);
        } else {
          console.error('❌ refresh_token failed');
          return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
        }
      } else {
        console.error('❌ No refresh_token available');
        return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
      }
    }

    if (!response.ok && response.status === 400) {
      const raw = await readText(response);
      if (raw.includes('"errorId":25707') || raw.includes('"errorId":25709')) {
        console.warn('🔁 Fallback retry for 25707/25709: retrying with minimal headers');
        response = await fetch(offersUrl.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${tokenRow.access_token}` }
        });
        console.log('📡 Fallback retry - status:', response.status);
      } else {
        console.error('❌ eBay API error (400)', raw);
        return { statusCode: 400, body: raw || JSON.stringify({ error: 'ebay_error_400' }) };
      }
    }

    if (!response.ok) {
      const raw = await readText(response);
      console.error('❌ eBay API error:', raw);
      return { statusCode: response.status, body: raw || JSON.stringify({ error: 'ebay_error' }) };
    }

    const text = await readText(response);
    const json = parseJsonSafe(text);
    if (!json) {
      console.error('❌ invalid JSON', text.substring(0, 200));
      return { statusCode: 502, body: JSON.stringify({ error: 'invalid_json', raw: text.substring(0, 200) }) };
    }

    const offers = Array.isArray(json.offers) ? json.offers : [];
    const defaultCurrency = account.currency || 'EUR';

    console.log('📦 Processing', offers.length, 'offers');

    const items = offers.map((offer) => ({
      provider: 'ebay',
      marketplace_account_id: account_id,
      remote_id: offer && offer.offerId ? offer.offerId : null,
      remote_sku: offer && offer.sku ? offer.sku : null,
      title: offer && offer.listingDescription ? offer.listingDescription : '',
      price_amount: offer && offer.pricingSummary && offer.pricingSummary.price && offer.pricingSummary.price.value
        ? parseFloat(offer.pricingSummary.price.value)
        : null,
      price_currency: offer && offer.pricingSummary && offer.pricingSummary.price && offer.pricingSummary.price.currency
        ? offer.pricingSummary.price.currency
        : defaultCurrency,
      status_sync: offer && offer.listingStatus ? offer.listingStatus : 'UNKNOWN',
      updated_at: new Date().toISOString()
    })).filter((it) => it.remote_id);

    console.log('💾 Upserting', items.length, 'items');

    if (items.length > 0) {
      const { error: upsertError } = await supabaseService
        .from('marketplace_listings')
        .upsert(items, { onConflict: 'provider,marketplace_account_id,remote_id' });

      if (upsertError) {
        console.error('❌ upsert_failed', upsertError);
        return srvError('upsert_failed', upsertError.message || 'unknown');
      }
    }

    console.log('✅ Successfully synced', items.length, 'offers');

    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        count: items.length,
        total: json.total || items.length,
        limit,
        offset
      })
    };
  } catch (err) {
    console.error('🔥 fatal', err);
    return srvError('server_error', err && err.message ? err.message : 'unknown');
  }
};

async function refreshAccessToken({ client_id, client_secret, refresh_token, scopes }) {
  const endpoint = 'https://api.ebay.com/identity/v1/oauth2/token';

  console.log('🔐 Refreshing access token...');

  try {
    const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      scope: scopes
    });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`
      },
      body: body.toString()
    });

    const text = await resp.text();

    if (!resp.ok) {
      console.error('❌ refresh_access_token_failed', text);
      return null;
    }

    try {
      const json = JSON.parse(text);
      return {
        access_token: json.access_token,
        expires_in: json.expires_in || null,
        token_type: json.token_type || null,
        scope: json.scope || null
      };
    } catch {
      console.error('❌ invalid JSON on refresh', text.substring(0, 200));
      return null;
    }
  } catch (e) {
    console.error('❌ refresh_access_token_exception', e && e.message ? e.message : e);
    return null;
  }
}
