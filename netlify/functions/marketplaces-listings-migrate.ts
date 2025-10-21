process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

import { createClient } from '@supabase/supabase-js';

type NetlifyResponse = { statusCode: number; headers?: Record<string, string>; body: string };

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MAX_BATCH = 50;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const fetchWithRetry = async (fn: () => Promise<Response>, maxRetries = 3): Promise<Response> => {
  const delays = [500, 1000, 2000];
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await fn();
      if (r.ok) return r;
      if (r.status === 429 || r.status >= 500) {
        lastErr = r;
        if (i < maxRetries - 1) await sleep(delays[i]);
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (i < maxRetries - 1) await sleep(delays[i]);
    }
  }
  if (lastErr instanceof Response) return lastErr;
  throw lastErr || new Error('fetchWithRetry_failed');
};

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

const readText = async (resp: Response): Promise<string> => {
  try { return await resp.text(); } catch { return ''; }
};
const parseJson = (txt: string): any => { try { return JSON.parse(txt); } catch { return null; } };

const authHeaders = (token: string, acceptLang?: string): Record<string, string> => {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (acceptLang) h['Accept-Language'] = acceptLang;
  return h;
};

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
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    const text = await resp.text();
    if (!resp.ok) return null;
    const json = parseJson(text);
    if (!json?.access_token) return null;
    return {
      access_token: json.access_token as string,
      expires_in: json.expires_in as number | null,
      token_type: json.token_type as string | null,
      scope: json.scope as string | null
    };
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

    const qs = event.queryStringParameters || {};
    const account_id = (qs.account_id || '').trim();
    if (!account_id) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'missing_account_id' }) };
    }

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad_json' }) };
    }

    const dry_run = Boolean(body?.dry_run);
    const batch_size = Math.max(1, Math.min(parseInt(body?.batch_size || `${MAX_BATCH}`, 10) || MAX_BATCH, MAX_BATCH));
    const max_batches = body?.max_batches ? Math.max(1, parseInt(body.max_batches, 10) || 1) : null;

    // Collect listing IDs
    let listingIds: string[] = Array.isArray(body?.listing_ids) ? body.listing_ids.filter((x: any) => typeof x === 'string' && x.trim() !== '') : [];
    if (typeof body?.item_ids_csv === 'string' && body.item_ids_csv.trim() !== '') {
      const more = body.item_ids_csv.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      listingIds = listingIds.concat(more);
    }
    listingIds = Array.from(new Set(listingIds));
    if (listingIds.length === 0) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'no_listing_ids' }) };
    }

    // Account
    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();

    if (accErr || !account) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'account_not_found' }) };
    }

    // Token row
    const { data: tokenRows, error: tokErr } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .neq('access_token', 'pending')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 0);

    const tokenRow = Array.isArray(tokenRows) ? tokenRows[0] : null;

    if (tokErr || !tokenRow) {
      return { statusCode: 424, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token_missing' }) };
    }

    // Host
    const baseHost = account.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    const migrateUrl = new URL('/sell/inventory/v1/bulk_migrate_listing', baseHost).toString();

    // Access token handling with 401 refresh fallback when needed
    let accessToken: string = tokenRow.access_token;

    // If dry-run, just return planned batches summary
    if (dry_run) {
      const plannedBatches = Math.ceil(listingIds.length / batch_size);
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          dry_run: true,
          listing_count: listingIds.length,
          batch_size,
          batches: Math.min(plannedBatches, max_batches ?? plannedBatches),
          sample_payload_first_batch: { listingIds: listingIds.slice(0, batch_size) }
        })
      };
    }

    // Ensure we have credentials to refresh if needed
    const ensureRefreshedToken = async (): Promise<string | null> => {
      if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) return null;

      // Resolve client credentials
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
          } catch { /* ignore */ }
        }
      }
      if (!clientId || !clientSecret) return null;

      const refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);
      const refreshed = await refreshAccessToken({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scopes: typeof tokenRow.scope === 'string' && tokenRow.scope ? tokenRow.scope : 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        environment: account.environment === 'sandbox' ? 'sandbox' : 'production'
      });
      if (!refreshed?.access_token) return null;

      // Update existing token row
      const updateData: any = {
        access_token: refreshed.access_token,
        updated_at: new Date().toISOString()
      };
      if (refreshed.expires_in) {
        updateData.expires_at = new Date(Date.now() + (refreshed.expires_in * 1000)).toISOString();
      }
      await supabaseService.from('oauth_tokens').update(updateData).eq('marketplace_account_id', account_id);

      return refreshed.access_token;
    };

    // Process in batches
    const results: Array<{
      listingId: string;
      status: 'SUCCESS' | 'FAILED';
      sku?: string | null;
      offerId?: string | null;
      errors?: any[] | null;
      raw?: any;
    }> = [];

    let batchesProcessed = 0;
    for (let i = 0; i < listingIds.length; i += batch_size) {
      if (max_batches !== null && batchesProcessed >= max_batches) break;
      const batch = listingIds.slice(i, i + batch_size);

      const doCall = async (acceptLang?: string) => fetchWithRetry(async () => {
        return fetch(migrateUrl, {
          method: 'POST',
          headers: {
            ...authHeaders(accessToken, acceptLang),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ listingIds: batch })
        });
      });

      let resp = await doCall();
      let raw = await readText(resp);

      // 401 - try token refresh once
      if (resp.status === 401) {
        const newToken = await ensureRefreshedToken();
        if (!newToken) {
          // mark whole batch failed
          for (const lid of batch) {
            results.push({ listingId: lid, status: 'FAILED', errors: [{ message: 'token_expired' }] });
          }
          continue;
        }
        accessToken = newToken;
        resp = await doCall();
        raw = await readText(resp);
      }

      // 25709 fallback Accept-Language (none -> en-US -> fr-FR)
      if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
        resp = await doCall('en-US');
        raw = await readText(resp);
        if (!resp.ok && resp.status === 400 && raw.includes('"errorId":25709')) {
          resp = await doCall('fr-FR');
          raw = await readText(resp);
        }
      }

      if (!resp.ok) {
        // On error: attempt to parse errors and assign to each listingId
        const js = parseJson(raw);
        const errorObj = js?.errors || [{ message: raw?.substring(0, 200) || 'unknown_error' }];
        for (const lid of batch) {
          results.push({ listingId: lid, status: 'FAILED', errors: Array.isArray(errorObj) ? errorObj : [errorObj] });
        }
      } else {
        const js = parseJson(raw);
        // eBay returns per-listing results; try to map conservatively
        const items = Array.isArray(js?.responses) ? js.responses : (Array.isArray(js?.results) ? js.results : []);
        if (Array.isArray(items) && items.length > 0) {
          for (const r of items) {
            const lid = r?.listingId || r?.listingID || null;
            const sku = r?.sku || r?.inventoryItem?.sku || null;
            const offerId = r?.offerId || r?.offer?.offerId || null;
            const errs = Array.isArray(r?.errors) ? r.errors : null;
            const status: 'SUCCESS' | 'FAILED' = errs && errs.length > 0 ? 'FAILED' : ((r?.status || '').toUpperCase() === 'SUCCESS' ? 'SUCCESS' : 'SUCCESS');
            results.push({
              listingId: lid || 'unknown',
              status,
              sku,
              offerId,
              errors: errs,
              raw: r
            });
          }
        } else {
          // No detailed responses; mark entire batch as success (best effort)
          for (const lid of batch) {
            results.push({ listingId: lid, status: 'SUCCESS' });
          }
        }
      }

      batchesProcessed++;
    }

    const migrated = results.filter((r) => r.status === 'SUCCESS').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;

    // Log to sync_logs (optional audit)
    await supabaseService.from('sync_logs').insert({
      marketplace_account_id: account_id,
      operation: 'inventory_migrate',
      outcome: failed === 0 ? 'ok' : (migrated > 0 ? 'retry' : 'fail'),
      http_status: 200,
      error_message: failed > 0 ? `${failed} failed` : null,
      metadata: { migrated, failed, total: results.length, batchesProcessed }
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        migrated,
        failed,
        total: results.length,
        batch_size,
        batches_processed: batchesProcessed,
        results
      })
    };

  } catch (e: any) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', detail: e?.message || 'unknown' }) };
  }
};
