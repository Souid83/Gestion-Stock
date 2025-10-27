process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

import { createClient } from '@supabase/supabase-js';

type NetlifyResponse = { statusCode: number; headers?: Record<string, string>; body: string };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SECRET_KEY = process.env.SECRET_KEY || '';

const decryptData = async (encrypted: string, iv: string): Promise<string> => {
  if (!SECRET_KEY) throw new Error('SECRET_KEY not configured');
  const keyBuffer = Buffer.from(SECRET_KEY, 'base64');
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, cryptoKey, encryptedBuffer);
  return new TextDecoder().decode(decryptedBuffer);
};

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'Accept-Language': 'en-US'
});

const readText = async (resp: Response): Promise<string> => { try { return await resp.text(); } catch { return ''; } };
const parseJson = (txt: string): any => { try { return JSON.parse(txt); } catch { return null; } };

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
  scopes?: string;
  environment?: 'sandbox' | 'production';
}) {
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
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const text = await resp.text();
    if (!resp.ok) return null;
    const json = parseJson(text);
    return json?.access_token
      ? { access_token: json.access_token, expires_in: json.expires_in, token_type: json.token_type, scope: json.scope }
      : null;
  } catch {
    return null;
  }
}

export const handler = async (event: any): Promise<NetlifyResponse> => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    // RBAC: Authenticate user and check role
    console.log('🔐 [StockUpdate] Authenticating user...');
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [StockUpdate] Missing or invalid authorization header');
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'missing_token' }) };
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.warn('⚠️ [StockUpdate] Invalid token or user not found:', authError?.message);
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) };
    }

    console.log('✅ [StockUpdate] User authenticated:', user.id);

    // Load user role
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('❌ [StockUpdate] Error loading user profile:', profileError);
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'profile_load_failed' }) };
    }

    const userRole = profile?.role || 'MAGASIN';
    console.log('👤 [StockUpdate] User role:', userRole);

    // Only ADMIN_FULL and ADMIN can push price updates
    const allowedRoles = ['ADMIN_FULL', 'ADMIN'];
    if (!allowedRoles.includes(userRole)) {
      console.warn('⚠️ [StockUpdate] User role not authorized for price/stock updates:', userRole);
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'insufficient_role' }) };
    }

    console.log('✅ [StockUpdate] Permission granted for price/stock update');

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad_json' }) }; }

    const account_id = (body.account_id || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const dry_run = Boolean(body.dry_run);

    if (!account_id) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'missing_account_id' }) };
    if (items.length === 0) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'missing_items' }) };

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();
    if (accErr || !account) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'account_not_found' }) };

    const { data: tokenRow, error: tokErr } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .neq('access_token', 'pending')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tokErr || !tokenRow) return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing' }) };

    const baseHost = account.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    const updateUrl = new URL('/sell/inventory/v1/bulk_update_price_quantity', baseHost).toString();
    let accessToken: string = tokenRow.access_token;

    if (dry_run) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ dry_run: true, items }) };
    }

    const chunkSize = 25;
    const results: any[] = [];

    // Pre-filter to SKUs that are actually listed on eBay for this account (avoid silent "offer not found")
    let listedSkus = new Set<string>();
    try {
      const { data: listedOffers } = await supabaseService
        .from('marketplace_listings')
        .select('remote_sku')
        .eq('provider', 'ebay')
        .eq('marketplace_account_id', account_id);
      if (Array.isArray(listedOffers)) {
        listedSkus = new Set(
          listedOffers
            .map((o: any) => (o?.remote_sku ?? '').toString().trim())
            .filter((s: string) => s.length > 0)
        );
      }
    } catch {
      // proceed without filtering if query fails
    }

    const ensureRefreshedToken = async (): Promise<string | null> => {
      if (!tokenRow.encryption_iv && tokenRow.refresh_token_encrypted?.includes('"iv"')) {
        try { const parsed = JSON.parse(tokenRow.refresh_token_encrypted); tokenRow.encryption_iv = parsed.iv; } catch {}
      }
      if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) return null;

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
          } catch {}
        }
      }
      if (!clientId || !clientSecret) return null;

      let refreshToken: string;
      if (tokenRow.refresh_token_encrypted?.includes('"iv"')) {
        try {
          const parsed = JSON.parse(tokenRow.refresh_token_encrypted as string);
          const ivB = Buffer.from(parsed.iv, 'hex');
          const ctB = Buffer.concat([Buffer.from(parsed.data, 'hex'), Buffer.from(parsed.tag, 'hex')]);
          refreshToken = await decryptData(ctB.toString('base64'), ivB.toString('base64'));
        } catch (e) {
          return null;
        }
      } else {
        refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);
      }

      const refreshed = await refreshAccessToken({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scopes: typeof tokenRow.scope === 'string' && tokenRow.scope
          ? tokenRow.scope
          : 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
      });
      if (!refreshed?.access_token) return null;

      await supabaseService
        .from('oauth_tokens')
        .update({
          access_token: refreshed.access_token,
          updated_at: new Date().toISOString(),
          expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : tokenRow.expires_at || null
        })
        .eq('marketplace_account_id', account_id);

      // Mark account as healthy (no reauth needed) after a successful refresh
      await supabaseService
        .from('marketplace_accounts')
        .update({ needs_reauth: false, updated_at: new Date().toISOString() } as any)
        .eq('id', account_id as any);

      return refreshed.access_token;
    };

    for (let i = 0; i < items.length; i += chunkSize) {
      const batchAll = items.slice(i, i + chunkSize)
        .filter((it: any) => it && typeof it.sku === 'string' && it.sku.trim().length > 0 && typeof it.quantity === 'number');

      // Mark immediately as FAILED the SKUs not listed on eBay for this account
      const invalid = batchAll.filter((it: any) => !listedSkus.has((it.sku || '').toString().trim()));
      invalid.forEach((b: any) => results.push({
        sku: b.sku,
        status: 'FAILED',
        errors: [{ message: 'not_listed_on_ebay' }]
      }));

      // Only send the SKUs that are actually listed
      const batch = batchAll.filter((it: any) => listedSkus.has((it.sku || '').toString().trim()));

      if (batch.length === 0) continue;

      const payload = {
        requests: batch.map((it: any) => ({
          sku: it.sku,
          shipToLocationAvailability: { quantity: it.quantity }
        }))
      };

      let resp = await fetch(updateUrl, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(payload) });
      let raw = await readText(resp);

      if (resp.status === 401) {
        const newToken = await ensureRefreshedToken();
        if (!newToken) {
          // Mark account as requiring reauth when refresh is impossible
          try {
            await supabaseService
              .from('marketplace_accounts')
              .update({ needs_reauth: true, updated_at: new Date().toISOString() } as any)
              .eq('id', account_id as any);
          } catch {}
          batch.forEach((b: any) => results.push({ sku: b.sku, status: 'FAILED', errors: [{ message: 'token_expired' }] }));
          continue;
        }
        accessToken = newToken;
        resp = await fetch(updateUrl, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(payload) });
        raw = await readText(resp);
      }

      if (!resp.ok) {
        const js = parseJson(raw);
        if (js && Array.isArray(js.responses)) {
          js.responses.forEach((r: any) => {
            results.push({
              sku: r?.sku || 'unknown',
              status: r?.statusCode === 200 ? 'SUCCESS' : 'FAILED',
              errors: Array.isArray(r?.errors) ? r.errors : [{ message: raw?.substring(0, 300) || 'unknown_error' }],
              raw: r
            });
          });
        } else {
          batch.forEach((b: any) => results.push({
            sku: b.sku,
            status: 'FAILED',
            errors: [{ message: raw?.substring(0, 300) || `HTTP_${resp.status}` }]
          }));
        }
      } else {
        const js = parseJson(raw);
        const arr = Array.isArray(js?.responses) ? js.responses : Array.isArray(js?.results) ? js.results : [];
        if (arr.length > 0) {
          arr.forEach((r: any) => {
            results.push({
              sku: r?.sku || 'unknown',
              status: r?.statusCode === 200 ? 'SUCCESS' : 'FAILED',
              errors: Array.isArray(r?.errors) ? r.errors : null,
              raw: r
            });
          });
        } else {
          // No per-SKU responses from eBay; do NOT mark success silently
          batch.forEach((b: any) => results.push({
            sku: b.sku,
            status: 'FAILED',
            errors: [{ message: 'no_responses_from_ebay' }]
          }));
        }
      }
    }

    await supabaseService.from('sync_logs').insert({
      marketplace_account_id: account_id,
      provider: 'ebay',
      operation: 'inventory_bulk_update_qty',
      outcome: results.some(r => r.status === 'FAILED') ? 'retry' : 'ok',
      http_status: 200,
      message: 'bulk_update_qty_completed',
      metadata: { total: items.length, results: results.slice(0, 10) } // store sample for brevity
    });

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ updated: results.filter(r => r.status === 'SUCCESS').length, failed: results.filter(r => r.status === 'FAILED').length, results }) };
  } catch (e: any) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', detail: e?.message || 'unknown' }) };
  }
};
