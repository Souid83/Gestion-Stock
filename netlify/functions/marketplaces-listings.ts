process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

const MAX_SKUS_PER_RUN = parseInt(process.env.EBAY_MAX_SKUS_PER_RUN || '300', 10);
const CONCURRENCY = Math.min(parseInt(process.env.EBAY_CONCURRENCY || '3', 10), 10);
const BATCH_DELAY_MS = parseInt(process.env.EBAY_BATCH_DELAY_MS || '250', 10);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (fetchFn: () => Promise<any>, maxRetries = 3): Promise<any> => {
  const delays = [500, 1000, 2000];
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fetchFn();

      if (result.ok) {
        console.info(`✅ fetchWithRetry success on attempt ${attempt + 1}`);
        return result;
      }

      if (result.status === 429 || result.status >= 500) {
        console.warn(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} on status ${result.status}`);
        lastError = result;
        if (attempt < maxRetries - 1) {
          await sleep(delays[attempt]);
          continue;
        }
      }

      return result;
    } catch (err) {
      console.error(`❌ fetchWithRetry exception on attempt ${attempt + 1}:`, err);
      lastError = err;
      if (attempt < maxRetries - 1) {
        await sleep(delays[attempt]);
      }
    }
  }

  throw lastError || new Error('fetchWithRetry_failed');
};

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  console.info('🚀 marketplaces-listings (offers) triggered');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const badRequest = (code: string) => ({ statusCode: 400, body: JSON.stringify({ error: code }) });
  const srvError = (code: string, detail?: string) => ({ statusCode: 500, body: JSON.stringify({ error: code, detail }) });

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const qs = event.queryStringParameters || {};
    const account_id = qs.account_id;
    const limit = Math.min(parseInt(qs.limit || '50', 10) || 50, 200);
    const offset = parseInt(qs.offset || '0', 10) || 0;
    const maxOffersPerSku = parseInt(qs.max_offers_per_sku || '5', 10) || 5;

    if (!account_id) return badRequest('missing_account_id');

    console.info('📋 Fetching account:', account_id, 'limit:', limit, 'offset:', offset, 'maxOffersPerSku:', maxOffersPerSku);

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();

    if (accErr || !account) {
      console.error('❌ account_not_found', accErr);
      return { statusCode: 404, body: JSON.stringify({ error: 'account_not_found' }) };
    }
    console.info('✅ Account found:', account.id);

    const { data: tokenRow, error: tokErr } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .eq('provider', 'ebay')
      .neq('access_token', 'pending')
      .not('refresh_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokErr || !tokenRow) {
      console.error('❌ token_missing', tokErr);
      return { statusCode: 424, body: JSON.stringify({ error: 'token_missing' }) };
    }
    console.info('✅ Token found');

    const host = account.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    const authHeaders = (token: string, acceptLang?: string): Record<string, string> => {
      const h: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      if (acceptLang) h['Accept-Language'] = acceptLang;
      return h;
    };

    const readText = async (resp: Response): Promise<string> => { try { return await resp.text(); } catch { return ''; } };
    const parseJsonSafe = (txt: string): any => { try { return JSON.parse(txt); } catch { return null; } };

    const fetchInventoryItems = async (token: string) => {
      const url = new URL('/sell/inventory/v1/inventory_item', host);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      console.info('🔄 Fetching inventory items:', url.toString());

      return fetchWithRetry(async () => {
        let resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token) });
        let raw = await readText(resp);

        if (resp.status === 401) return { ok: false, status: 401, raw };

        // 25709 → retry with en-US then fr-FR
        if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
          console.warn('🔁 25709 on inventory: retrying with en-US');
          resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token, 'en-US') });
          raw = await readText(resp);
          if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
            console.warn('🔁 25709 persists: retrying with fr-FR');
            resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token, 'fr-FR') });
            raw = await readText(resp);
          }
        }

        if (!resp.ok) {
          console.error('❌ inventory_items_error', raw);
          return { ok: false, status: resp.status, raw };
        }

        const json = parseJsonSafe(raw);
        if (!json) {
          console.error('❌ invalid_json_inventory', raw.substring(0, 200));
          return { ok: false, status: 502, raw };
        }

        const items = Array.isArray(json.inventoryItems) ? json.inventoryItems : [];
        const skus = items.map((it: any) => it && (it.sku || it.SKU || it.Sku)).filter(Boolean);
        console.info('📦 Inventory SKUs found:', skus.length);

        return { ok: true, skus, total: json.total || skus.length };
      });
    };

    const fetchOffersBySku = async (token: string, sku: string) => {
      const url = new URL('/sell/inventory/v1/offer', host);
      url.searchParams.set('sku', sku);
      url.searchParams.set('limit', String(maxOffersPerSku));
      url.searchParams.set('offset', '0');

      return fetchWithRetry(async () => {
        let resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token) });
        let raw = await readText(resp);

        // 25709 → retry with en-US then fr-FR
        if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
          resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token, 'en-US') });
          raw = await readText(resp);
          if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
            resp = await fetch(url.toString(), { method: 'GET', headers: authHeaders(token, 'fr-FR') });
            raw = await readText(resp);
          }
        }

        if (resp.status === 400 && raw.includes('"errorId":25707')) {
          console.warn('⚠️ invalid_sku_25707, skipping SKU:', sku);
          return { ok: true, offers: [], skipped: true };
        }

        if (!resp.ok) {
          console.error('❌ getOffers_error', sku, raw);
          return { ok: false, status: resp.status, raw };
        }

        const json = parseJsonSafe(raw);
        if (!json) {
          console.error('❌ invalid_json_getOffers', raw.substring(0, 200));
          return { ok: true, offers: [] };
        }

        const offers = Array.isArray(json.offers) ? json.offers : [];
        return { ok: true, offers };
      });
    };

    let accessToken = tokenRow.access_token;
    let inv = await fetchInventoryItems(accessToken);

    if (!inv.ok && inv.status === 401) {
      console.warn('⚠️ Inventory 401 — attempting refresh');
      if (tokenRow.refresh_token && account.client_id && account.client_secret) {
        const refreshed = await refreshAccessToken({
          client_id: account.client_id,
          client_secret: account.client_secret,
          refresh_token: tokenRow.refresh_token,
          scopes: (Array.isArray(tokenRow.scopes) && tokenRow.scopes.length > 0)
            ? tokenRow.scopes.join(' ')
            : 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
          environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
        });

        if (refreshed && refreshed.access_token) {
          await supabaseService.from('oauth_tokens').insert({
            marketplace_account_id: account_id,
            provider: 'ebay',
            access_token: refreshed.access_token,
            refresh_token: tokenRow.refresh_token,
            expires_in: refreshed.expires_in || null,
            scopes: tokenRow.scopes || null
          });
          accessToken = refreshed.access_token;
          inv = await fetchInventoryItems(accessToken);
        } else {
          return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
        }
      } else {
        return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) };
      }
    }

    if (!inv.ok) {
      return { statusCode: inv.status || 400, body: inv.raw || JSON.stringify({ error: 'inventory_fetch_failed' }) };
    }

    let skus = inv.skus || [];
    if (!skus || skus.length === 0) {
      console.info('ℹ️ No SKUs found in inventory');
      return { statusCode: 200, body: JSON.stringify({ items: [], count: 0, limit, offset, processed_skus: 0, skipped_skus: 0, retries: 0 }) };
    }

    skus = skus.slice(0, MAX_SKUS_PER_RUN);
    console.info('🔎 Processing', skus.length, 'SKUs (max', MAX_SKUS_PER_RUN, ')');

    const allOffers = [];
    let skippedCount = 0;
    let totalRetries = 0;

    for (let i = 0; i < skus.length; i += CONCURRENCY) {
      const batch = skus.slice(i, i + CONCURRENCY);
      console.info(`🔄 Processing batch ${Math.floor(i / CONCURRENCY) + 1}, SKUs ${i + 1}-${Math.min(i + CONCURRENCY, skus.length)}`);

      const settled = await Promise.allSettled(batch.map((sku: string) => fetchOffersBySku(accessToken, sku)));

      for (let k = 0; k < settled.length; k++) {
        const r = settled[k];
        if (r.status === 'fulfilled' && r.value && r.value.ok) {
          if (r.value.skipped) {
            skippedCount++;
          } else if (Array.isArray(r.value.offers)) {
            allOffers.push(...r.value.offers);
          }
        }
      }

      if (i + CONCURRENCY < skus.length) {
        console.info(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch`);
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.info('🧾 Offers collected:', allOffers.length, 'Skipped SKUs:', skippedCount);

    const defaultCurrency = account.currency || 'EUR';
    const items = allOffers.map((offer) => ({
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
        limit,
        offset,
        processed_skus: skus.length,
        skipped_skus: skippedCount,
        retries: totalRetries
      })
    };
  } catch (err: any) {
    console.error('🔥 fatal', err);
    return srvError('server_error', err && err.message ? err.message : 'unknown');
  }
};

async function refreshAccessToken(
  {
    client_id,
    client_secret,
    refresh_token,
    scopes,
    environment = 'production'
  }: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    scopes?: string;
    environment?: 'sandbox' | 'production';
  }
) {
  const endpoint = environment === 'sandbox'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  try {
    const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refresh_token);
    if (scopes) body.set('scope', scopes);

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
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
  } catch (e: any) {
    console.error('❌ refresh_access_token_exception', e && e.message ? e.message : e);
    return null;
  }
}
