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
  const SECRET_KEY = process.env.SECRET_KEY || '';

  const decryptData = async (encrypted: string, iv: string): Promise<string> => {
    if (!SECRET_KEY) {
      throw new Error('SECRET_KEY not configured');
    }
    const keyBuffer = Buffer.from(SECRET_KEY, 'base64');
    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, cryptoKey, encryptedBuffer);
    return new TextDecoder().decode(decryptedBuffer);
  };

  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const badRequest = (code: string) => ({ statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: code }) });
  const srvError = (code: string, detail?: string) => ({ statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: code, detail }) });

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    // RBAC: Authenticate user and check role
    console.info('🔐 Authenticating user...');
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ Missing or invalid authorization header');
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'missing_token' }) };
    }

    const supabaseAccessToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseAccessToken);

    if (authError || !user) {
      console.warn('⚠️ Invalid token or user not found:', authError?.message);
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) };
    }

    console.info('✅ User authenticated:', user.id);

    // Load user role
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Error loading user profile:', profileError);
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'profile_load_failed' }) };
    }

    const userRole = profile?.role || 'MAGASIN';
    console.info('👤 User role:', userRole);

    // Check if user has access to pricing (ADMIN_FULL, ADMIN)
    const allowedRoles = ['ADMIN_FULL', 'ADMIN'];
    if (!allowedRoles.includes(userRole)) {
      console.warn('⚠️ User role not authorized for pricing:', userRole);
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'insufficient_role' }) };
    }

    const qs = event.queryStringParameters || {};

    // Params + logs (provider/env/accountId)
    const provider = (qs.provider || 'ebay') as 'ebay';
    const environment = (qs.environment || 'production') as 'production' | 'sandbox';
    const accountIdParam = (qs.accountId || qs.account_id || undefined) as string | undefined;
    console.info('listings_params', { provider, environment, accountId: accountIdParam });

    // Fetch token via shared helper (robuste)
    const { getOAuthToken } = await import('./_shared/oauth');
    let tok: any;
    try {
      tok = await getOAuthToken({ provider, environment, accountId: accountIdParam });
    } catch (e: any) {
      console.error('listings_token_fetch_error', e?.message || e);
      if (e?.message === 'missing_account') return badRequest('missing_account_id');
      if (e?.message === 'missing_token') return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing' }) };
      return srvError('token_lookup_failed', e?.message || 'unknown');
    }
    console.info('listings_token_fetch', { found: !!tok, accountId_used: tok?.marketplace_account_id });

    const account_id = (tok?.marketplace_account_id || accountIdParam || '') as string;
    const limit = Math.min(parseInt(qs.limit || '50', 10) || 50, 200);
    const page = Math.max(parseInt(qs.page || '1', 10) || 1, 1);
    let offset = parseInt(qs.offset || '0', 10) || 0;
    if (!qs.offset && qs.page) {
      offset = (page - 1) * limit;
    }
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
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'account_not_found' }) };
    }
    console.info('✅ Account found:', account.id);

    // Utiliser le token récupéré via getOAuthToken
    const tokenRow: any = tok;
    if (!tokenRow) {
      console.error('❌ token_missing_lookup');
      return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing' }) };
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

    const normalizeListingStatus = (s?: string): 'ok' | 'pending' | 'failed' | 'unmapped' => {
      const v = (s || '').toUpperCase();
      if (v.includes('PUBLISH') || v.includes('ACTIVE') || v === 'PUBLISHED') return 'ok';
      if (v.includes('PEND') || v.includes('READY') || v.includes('PREP')) return 'pending';
      if (v.includes('FAIL') || v.includes('ERROR') || v.includes('BLOCK')) return 'failed';
      return 'unmapped';
    };

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

        // Build qty map per SKU
        const qtyBySku: Record<string, number> = {};
        for (const it of items) {
          const sku = it && (it.sku || it.SKU || it.Sku);
          if (!sku) continue;
          const qty =
            (it?.availability?.shipToLocationAvailability?.quantity ?? null) ??
            (Array.isArray(it?.availability?.pickupAtLocationAvailability)
              ? it.availability.pickupAtLocationAvailability.reduce((sum: number, loc: any) => sum + (loc?.quantity || 0), 0)
              : null) ??
            (it?.availability?.availableQuantity ?? null) ??
            (it?.availableQuantity ?? null);
          if (typeof qty === 'number') qtyBySku[sku] = qty;
        }
        console.info('📦 Inventory SKUs found:', skus.length);

        return { ok: true, skus, total: json.total || skus.length, qtyBySku };
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

    let ebayAccessToken = tokenRow.access_token;
    let inv = await fetchInventoryItems(ebayAccessToken);

    if (!inv.ok && inv.status === 401) {
      console.warn('⚠️ Inventory 401 — attempting refresh');

      // Normalize legacy JSON {iv, tag, data} → base64 (ciphertext||tag) + iv, then persist
      if (!tokenRow.encryption_iv && typeof tokenRow.refresh_token_encrypted === 'string' && tokenRow.refresh_token_encrypted.includes('"iv"')) {
        try {
          const legacy = JSON.parse(tokenRow.refresh_token_encrypted as string);
          const ivB = Buffer.from(legacy.iv, 'hex');
          const ctB = Buffer.concat([Buffer.from(legacy.data, 'hex'), Buffer.from(legacy.tag, 'hex')]);
          const ivBase64 = ivB.toString('base64');
          const ctBase64 = ctB.toString('base64');
          try {
            await decryptData(ctBase64, ivBase64);
            await supabaseService
              .from('oauth_tokens')
              .update({
                refresh_token_encrypted: ctBase64,
                encryption_iv: ivBase64,
                updated_at: new Date().toISOString()
              })
              .eq('marketplace_account_id', account_id);
            (tokenRow as any).refresh_token_encrypted = ctBase64;
            (tokenRow as any).encryption_iv = ivBase64;
            console.log('🔁 Normalized legacy refresh token to base64 + iv and persisted');
          } catch (e) {
            console.warn('⚠️ Legacy token normalize decrypt failed, skipping persist:', (e as any)?.message || e);
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      // Ensure we have a refresh token stored (encrypted) and client credentials
      if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) {
        return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing_refresh' }) };
      }

      // Resolve client credentials (from account or provider_app_credentials)
      let clientId: string = account.client_id || '';
      let clientSecret: string = account.client_secret || '';

      if (!clientId || !clientSecret) {
        const { data: credentials } = await supabaseService
          .from('provider_app_credentials')
          .select('*')
          .eq('provider', 'ebay')
          .eq('environment', account.environment === 'sandbox' ? 'sandbox' : 'production')
          .maybeSingle();

        if (credentials) {
          try {
            clientId = await decryptData(credentials.client_id_encrypted, credentials.encryption_iv);
            clientSecret = await decryptData(credentials.client_secret_encrypted, credentials.encryption_iv);
          } catch {
            // fall through to error below if still missing
          }
        }
      }

      if (!clientId || !clientSecret) {
        return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing_refresh' }) };
      }

      const refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);

      const refreshed = await refreshAccessToken({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scopes: (typeof tokenRow.scope === 'string' && tokenRow.scope)
          ? tokenRow.scope
          : 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
        environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
      });

      if (!refreshed?.access_token) {
        return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_expired' }) };
      }

      // Update existing token row (unique per marketplace_account_id)
      const updateData: any = {
        access_token: refreshed.access_token,
        updated_at: new Date().toISOString()
      };
      if (refreshed.expires_in) {
        updateData.expires_at = new Date(Date.now() + (refreshed.expires_in * 1000)).toISOString();
      }

      await supabaseService
        .from('oauth_tokens')
        .update(updateData)
        .eq('marketplace_account_id', account_id);

      ebayAccessToken = refreshed.access_token;
      inv = await fetchInventoryItems(ebayAccessToken);
    }

    if (!inv.ok) {
      return { statusCode: inv.status || 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'inventory_fetch_failed', raw: typeof inv.raw === 'string' ? inv.raw.substring(0, 500) : undefined }) };
    }

    let skus = inv.skus || [];
    if (!skus || skus.length === 0) {
      console.info('ℹ️ No SKUs found in inventory');
      return { statusCode: 200, body: JSON.stringify({ items: [], count: 0, limit, offset, processed_skus: 0, skipped_skus: 0, retries: 0 }) };
    }

    skus = skus.slice(0, MAX_SKUS_PER_RUN);
    console.info('🔎 Processing', skus.length, 'SKUs (max', MAX_SKUS_PER_RUN, ')');

    // Quantities + mappings maps
    const qtyEbayBySku: Record<string, number> = (inv && (inv as any).qtyBySku) || {};
    let qtyAppBySku: Record<string, number | null> = {};
    let productIdBySku: Record<string, string> = {};
    let internalPriceBySku: Record<string, number | null> = {};
    try {
      // Get mappings
      const { data: mappings } = await supabaseService
        .from('marketplace_products_map')
        .select('remote_sku, product_id')
        .eq('provider', 'ebay')
        .eq('marketplace_account_id', account_id)
        .in('remote_sku', skus);

      const productIds = Array.isArray(mappings) ? mappings.map((m: any) => m.product_id).filter(Boolean) : [];
      if (productIds.length > 0) {
        // Load shared quantity (view) + fallback quantities and internal price (table)
        const { data: vw } = await supabaseService
          .from('clear_products_with_stock')
          .select('id, mirror_stock')
          .in('id', productIds);

        const { data: prodRows } = await supabaseService
          .from('products')
          .select('id, mirror_of, shared_stock_id, stock_total, stock, retail_price')
          .in('id', productIds);

        const qtyByProductId: Record<string, number | null> = {};
        const internalPriceByProductId: Record<string, number | null> = {};

        // Merge with mirror parents if any
        let allVw = vw || [];
        let allProdRows = prodRows || [];
        const parentIds = Array.from(new Set((allProdRows || []).map((p: any) => p.mirror_of).filter(Boolean)));
        if (parentIds.length > 0) {
          const { data: vwParents } = await supabaseService
            .from('clear_products_with_stock')
            .select('id, mirror_stock')
            .in('id', parentIds);
          const { data: parentRows } = await supabaseService
            .from('products')
            .select('id, mirror_of, shared_stock_id, stock_total, stock, retail_price')
            .in('id', parentIds);
          allVw = [...allVw, ...(vwParents || [])];
          allProdRows = [...allProdRows, ...(parentRows || [])];
        }

        // Load pool quantities from shared_stocks for products that belong to a shared pool (including parents)
        const sharedStockIds = Array.from(new Set((allProdRows || []).map((p: any) => p.shared_stock_id).filter(Boolean)));
        let poolQtyByStockId: Record<string, number | null> = {};
        if (sharedStockIds.length > 0) {
          const { data: pools } = await supabaseService
            .from('shared_stocks')
            .select('id, quantity')
            .in('id', sharedStockIds);
          (pools || []).forEach((s: any) => {
            if (s && s.id) {
              poolQtyByStockId[s.id] = typeof s.quantity === 'number' ? s.quantity : (s.quantity ?? null);
            }
          });
        }

        // Build internal price map + quantity fallbacks from products table (including mirror parents)
        (allProdRows || []).forEach((p: any) => {
          internalPriceByProductId[p.id] =
            typeof p.retail_price === 'number' ? p.retail_price : (p.retail_price ?? null);

          // Fallback priority:
          // 1) shared_stocks.quantity (pool) if shared_stock_id present
          // 2) shared_quantity from view
          // 3) products.stock_total
          // 4) products.stock
          const poolQty = p.shared_stock_id ? poolQtyByStockId[p.shared_stock_id] : null;
          const mirrorVal = (allVw || []).find((s: any) => s.id === p.id)?.mirror_stock;
          const candidates = [poolQty, mirrorVal, p.stock_total, p.stock];
          const picked = candidates.find((q) => typeof q === 'number');
          qtyByProductId[p.id] = typeof picked === 'number' ? picked : null;
        });

        // If view returned a mirror_stock, it takes precedence
        (allVw || []).forEach((s: any) => {
          if (typeof s.mirror_stock === 'number') {
            qtyByProductId[s.id] = s.mirror_stock;
          }
        });

        // Mirror children: force child quantity to parent's quantity when available + debug logs
        (prodRows || []).forEach((p: any) => {
          if (p && p.id && p.mirror_of) {
            const parentQty = qtyByProductId[p.mirror_of];
            if (typeof parentQty === 'number') {
              qtyByProductId[p.id] = parentQty;
            }
            console.info('mirror_debug', {
              child_id: p.id,
              parent_id: p.mirror_of,
              resolved_parent_qty: typeof parentQty === 'number' ? parentQty : null
            });
          }
        });

        const ipBySku: Record<string, number | null> = {};
        (mappings || []).forEach((m: any) => {
          if (m?.remote_sku && m?.product_id) {
            productIdBySku[m.remote_sku] = m.product_id;
            qtyAppBySku[m.remote_sku] = (qtyByProductId[m.product_id] ?? null);
            ipBySku[m.remote_sku] = internalPriceByProductId[m.product_id] ?? null;
          }
        });
        internalPriceBySku = ipBySku;
      }
      console.info('🧮 Qty maps built — ebay:', Object.keys(qtyEbayBySku).length, 'app:', Object.keys(qtyAppBySku).length);
      console.info('🔗 mappings found:', Object.keys(productIdBySku).length);
      console.info('🏷 internal_price set for:', Object.keys(internalPriceBySku).length);
    } catch (e) {
      console.warn('⚠️ qty/mapping build failed', (e as any)?.message || e);
    }

    const allOffers = [];
    let skippedCount = 0;
    let totalRetries = 0;

    for (let i = 0; i < skus.length; i += CONCURRENCY) {
      const batch = skus.slice(i, i + CONCURRENCY);
      console.info(`🔄 Processing batch ${Math.floor(i / CONCURRENCY) + 1}, SKUs ${i + 1}-${Math.min(i + CONCURRENCY, skus.length)}`);

      const settled = await Promise.allSettled(batch.map((sku: string) => fetchOffersBySku(ebayAccessToken, sku)));

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

    const sampleOffers = allOffers.slice(0, 3).map((o: any) => ({
      sku: o?.sku || null,
      price: o?.pricingSummary?.price?.value || null,
      currency: o?.pricingSummary?.price?.currency || null
    }));
    console.info('🔎 Sample offers (sku/price):', sampleOffers);

    const defaultCurrency = account.currency || 'EUR';

    // Real offers coming from eBay "offer" API
    const itemsOffers = allOffers.map((offer) => ({
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
      status_sync: (offer && offer.sku && productIdBySku[offer.sku]) ? 'ok' : normalizeListingStatus(offer && offer.listingStatus ? offer.listingStatus : undefined),
      metadata: {
        listingStatus: (offer && offer.listingStatus ? offer.listingStatus : null),
        marketplaceId: (offer && offer.marketplaceId ? offer.marketplaceId : null),
        availableQuantity: (offer && typeof offer.availableQuantity !== 'undefined' ? offer.availableQuantity : null),
        format: (offer && (offer.format || offer.offerType) ? (offer.format || offer.offerType) : null)
      },
      product_id: offer && offer.sku ? (productIdBySku[offer.sku] ?? null) : null,
      internal_price: offer && offer.sku ? (internalPriceBySku[offer.sku] ?? null) : null,
      qty_ebay: offer && offer.sku ? (qtyEbayBySku[offer.sku] ?? null) : null,
      qty_app: offer && offer.sku ? (qtyAppBySku[offer.sku] ?? null) : null,
      updated_at: new Date().toISOString()
    })).filter((it) => it.remote_id);

    // Inventory placeholders for SKUs present in inventory but with no offer yet
    const offerSkuSet = new Set(
      allOffers.map((o: any) => (o && o.sku ? o.sku : null)).filter(Boolean)
    );
    const itemsPlaceholders = (skus || [])
      .filter((sku: string) => !offerSkuSet.has(sku))
      .map((sku: string) => ({
        provider: 'ebay',
        marketplace_account_id: account_id,
        // Mark as inventory-only row
        remote_id: `inv:${sku}`,
        remote_sku: sku,
        title: '',
        price_amount: null,
        price_currency: defaultCurrency,
        status_sync: 'unmapped' as const,
        metadata: {
          listingStatus: null,
          marketplaceId: null,
          availableQuantity: null,
          format: null
        },
        product_id: productIdBySku[sku] ?? null,
        internal_price: internalPriceBySku[sku] ?? null,
        qty_ebay: typeof qtyEbayBySku[sku] === 'number' ? qtyEbayBySku[sku] : null,
        qty_app: typeof qtyAppBySku[sku] === 'number' ? qtyAppBySku[sku] : null,
        updated_at: new Date().toISOString()
      }));

    const items = [...itemsOffers, ...itemsPlaceholders];

    // Strip non-persistent fields before DB upsert (offers only)
    // Do not persist product_id (only for UI), nor qty_ebay/qty_app
    const dbItems = itemsOffers.map(({ qty_ebay, qty_app, product_id, internal_price, ...rest }) => rest);

    console.info('💾 Upserting', itemsOffers.length, 'offer items; returning', items.length, 'total items incl. placeholders');

    if (items.length > 0) {
      const { error: upsertError } = await supabaseService
        .from('marketplace_listings')
        .upsert(dbItems, { onConflict: 'provider,marketplace_account_id,remote_id' });
      if (upsertError) {
        console.error('❌ upsert_failed', upsertError);
        return srvError('upsert_failed', upsertError.message || 'unknown');
      }
    }

    console.info('✅ Successfully synced', items.length, 'offers');

    // RBAC: Filter purchase_price based on role
    const filteredItems = items.map((item: any) => {
      // ADMIN_FULL can see all purchase prices
      if (userRole === 'ADMIN_FULL') {
        return item;
      }

      // ADMIN can see purchase_price only if they created the product
      if (userRole === 'ADMIN') {
        const productCreatedBy = item.product_created_by_user_id;
        if (productCreatedBy && productCreatedBy === user.id) {
          return item;
        }
      }

      // For all other cases (ADMIN without ownership, MAGASIN, COMMANDE), remove purchase_price
      const { purchase_price, internal_purchase_price, ...rest } = item;
      console.log('🔒 Masking purchase_price for item:', item.remote_sku || item.remote_id);
      return rest;
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        items: filteredItems,
        count: filteredItems.length,
        limit,
        offset,
        processed_skus: skus.length,
        skipped_skus: skippedCount,
        retries: totalRetries,
        total: (inv && (inv as any).total) || skus.length
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
