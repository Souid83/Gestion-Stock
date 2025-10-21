process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';
try { process.removeAllListeners && process.removeAllListeners('warning'); process.on && process.on('warning', () => {}); } catch {}

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

    console.info('📋 Fetching account:', account_id, 'limit:', limit, 'offset:', offset);

    // 1) Compte eBay actif (prod)
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
    console.info('✅ Account found:', account.id);

    // 2) Dernier token (access + refresh si dispo)
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
    console.info('✅ Token found');

    // 3) Prépare l'URL eBay
    const baseHost = 'https://api.ebay.com';
    const offersUrl = new URL('/sell/inventory/v1/offer', baseHost);
    offersUrl.searchParams.set('limit', String(limit));
    offersUrl.searchParams.set('offset', String(offset));

    // 4) Locale eBay valide (BCP47) selon le compte, fallback fr-FR puis en-US
    const pickLocale = (acc) => {
      const norm = (s) => (typeof s === 'string' ? s.toLowerCase() : '');
      const market = norm(acc.marketplace) || norm(acc.site) || norm(acc.region) || '';
      const country = norm(acc.country) || norm(acc.country_code) || '';
      // Si FR/CA-FR → fr-FR, sinon en-US par défaut
      if (market.includes('fr') || country === 'fr') return 'fr-FR';
      if (market.includes('gb') || country === 'gb' || market.includes('uk')) return 'en-GB';
      if (market.includes('de') || country === 'de') return 'de-DE';
      if (market.includes('it') || country === 'it') return 'it-IT';
      if (market.includes('es') || country === 'es') return 'es-ES';
      if (market.includes('au') || country === 'au') return 'en-AU';
      if (market.includes('ca') && (norm(acc.language) === 'fr' || norm(acc.locale) === 'fr')) return 'fr-CA';
      if (market.includes('ca') || country === 'ca') return 'en-CA';
      return 'fr-FR'; // par défaut FR pour éviter 25709 observé
    };

    const primaryLocale = pickLocale(account);
    const fallbackLocale = primaryLocale === 'fr-FR' ? 'en-US' : 'fr-FR';

    const makeHeaders = (token, locale) => {
      const h = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': locale // Forcé explicitement pour éviter l'injection d'une valeur invalide par la plateforme
      };
      return h;
    };

    const fetchOffers = async (token, locale) => {
      console.info('🔄 Fetching offers from eBay:', offersUrl.toString(), 'locale:', locale);
      return fetch(offersUrl.toString(), {
        method: 'GET',
        headers: makeHeaders(token, locale)
      });
    };

    const readText = async (resp) => {
      try { return await resp.text(); } catch { return ''; }
    };

    const parseJsonSafe = (txt) => {
      try { return JSON.parse(txt); } catch { return null; }
    };

    // 5) Premier appel avec locale primaire
    let response = await fetchOffers(tokenRow.access_token, primaryLocale);
    console.info('📡 eBay response status:', response.status);

    // 5.a) Token expiré → refresh (si refresh_token dispo)
    if (response.status === 401) {
      console.warn('⚠️ eBay 401 on offers — token likely expired');
      if (tokenRow.refresh_token && account.client_id && account.client_secret) {
        console.info('🔄 Attempting token refresh...');
        const refreshed = await refreshAccessToken({
          client_id: account.client_id,
          client_secret: account.client_secret,
          refresh_token: tokenRow.refresh_token,
          scopes: Array.isArray(tokenRow.scopes) && tokenRow.scopes.length > 0
            ? tokenRow.scopes.join(' ')
            : 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account.readonly'
        });

        if (refreshed && refreshed.access_token) {
          console.info('✅ Token refreshed successfully');
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

          response = await fetchOffers(refreshed.access_token, primaryLocale);
          console.info('📡 Retry after refresh - status:', response.status);
        } else {
          console.error('❌ refresh_token failed');
          return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
        }
      } else {
        console.error('❌ No refresh_token available');
        return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
      }
    }

    // 5.b) Si 400 avec 25709 (ou 25707), réessayer avec l'autre locale autorisée
    if (!response.ok && response.status === 400) {
      const raw = await readText(response);
      if (raw.includes('"errorId":25709') || raw.includes('"errorId":25707')) {
        console.warn('🔁 Fallback retry for 25707/25709 with alternate locale:', fallbackLocale);
        response = await fetch(offersUrl.toString(), {
          method: 'GET',
          headers: makeHeaders(tokenRow.access_token, fallbackLocale)
        });
        console.info('📡 Fallback retry - status:', response.status);
        if (!response.ok) {
          const raw2 = await readText(response);
          console.error('❌ eBay API error after locale fallback:', raw2);
          return { statusCode: 400, body: raw2 || JSON.stringify({ error: 'ebay_error_400' }) };
        }
      } else {
        console.error('❌ eBay API error (400)', raw);
        return { statusCode: 400, body: raw || JSON.stringify({ error: 'ebay_error_400' }) };
      }
    }

    // 6) Gestion erreurs HTTP restantes
    if (!response.ok) {
      const raw = await readText(response);
      console.error('❌ eBay API error:', raw);
      return { statusCode: response.status, body: raw || JSON.stringify({ error: 'ebay_error' }) };
    }

    // 7) Parse payload
    const text = await readText(response);
    const json = parseJsonSafe(text);
    if (!json) {
      console.error('❌ invalid JSON', text.substring(0, 200));
      return { statusCode: 502, body: JSON.stringify({ error: 'invalid_json', raw: text.substring(0, 200) }) };
    }

    const offers = Array.isArray(json.offers) ? json.offers : [];
    const defaultCurrency = account.currency || 'EUR';

    console.info('📦 Processing', offers.length, 'offers');

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

    console.info('💾 Upserting', items.length, 'items');

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

  console.info('🔐 Refreshing access token...');

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
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const text = await resp.text();

    if (!resp.ok) {
      console.error('❌ refresh_access_token_failed', text);
      return null;
    }

    const json = (() => { try { return JSON.parse(text); } catch { return null; } })();
    if (!json || !json.access_token) {
      console.error('❌ invalid JSON on refresh', text.substring(0, 200));
      return null;
    }

    return {
      access_token: json.access_token,
      expires_in: json.expires_in || null,
      token_type: json.token_type || null,
      scope: json.scope || null
    };
  } catch (e) {
    console.error('❌ refresh_access_token_exception', e && e.message ? e.message : e);
    return null;
  }
}
