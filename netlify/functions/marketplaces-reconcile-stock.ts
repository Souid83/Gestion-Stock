process.env.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS || '1';

import { createClient } from '@supabase/supabase-js';

type NetlifyResponse = { statusCode: number; headers?: Record<string, string>; body: string };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SECRET_KEY = process.env.SECRET_KEY || '';
const EBAY_STOCK_NAME = process.env.EBAY_STOCK_NAME || 'EBAY';

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
    // Accept scheduled invocation or manual GET/POST
    if (event.httpMethod && !['GET', 'POST'].includes(event.httpMethod)) {
      return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {}

    const only_account_id = (body.account_id || '').trim();
    const provider = 'ebay';

    // 1) Accounts actifs
    const { data: accounts, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('provider', provider)
      .eq('is_active', true);

    if (accErr) {
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'accounts_fetch_failed' }) };
    }

    const targetAccounts = (accounts || []).filter((a: any) => !only_account_id || a?.id === only_account_id);
    if (targetAccounts.length === 0) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ updated: 0, failed: 0, results: [], note: 'no_active_accounts' }) };
    }

    // 2) Résoudre les stock_id EBAY (par nom)
    const ebayStockIds: string[] = [];
    {
      const name = (EBAY_STOCK_NAME || 'EBAY').toString();
      const { data: s1 } = await supabaseService
        .from('stocks')
        .select('id,name')
        .ilike('name', name);
      if (Array.isArray(s1)) {
        s1.forEach((r: any) => { if (r?.id) ebayStockIds.push(r.id); });
      }
      if (ebayStockIds.length === 0 && name.toUpperCase() !== 'EBAY') {
        const { data: s2 } = await supabaseService
          .from('stocks')
          .select('id,name')
          .ilike('name', 'EBAY');
        if (Array.isArray(s2)) s2.forEach((r: any) => { if (r?.id) ebayStockIds.push(r.id); });
      }
    }

    const globalResults: any[] = [];
    let globalUpdated = 0;
    let globalFailed = 0;

    // Helpers
    const ensureRefreshedToken = async (account: any, tokenRow: any): Promise<string | null> => {
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
        .eq('marketplace_account_id', account.id);

      return refreshed.access_token;
    };

    for (const account of targetAccounts) {
      // Token
      const { data: tokenRow } = await supabaseService
        .from('oauth_tokens')
        .select('*')
        .eq('marketplace_account_id', account.id)
        .neq('access_token', 'pending')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow) {
        globalResults.push({ account_id: account.id, status: 'SKIPPED', reason: 'token_missing' });
        continue;
      }

      const baseHost = account.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
      const bulkUrl = new URL('/sell/inventory/v1/bulk_update_price_quantity', baseHost).toString();

      // Mappings pour ce compte
      const { data: maps } = await supabaseService
        .from('marketplace_products_map')
        .select('product_id, remote_sku')
        .eq('provider', provider)
        .eq('marketplace_account_id', account.id);

      const mapRows = Array.isArray(maps) ? maps as any[] : [];
      if (mapRows.length === 0) {
        globalResults.push({ account_id: account.id, status: 'SKIPPED', reason: 'no_mapping' });
        continue;
      }

      const productIds = Array.from(new Set(mapRows.map((m: any) => m?.product_id).filter(Boolean)));

      // Résoudre parents
      const { data: prows } = await supabaseService
        .from('products')
        .select('id,parent_id,serial_number')
        .in('id', productIds as any);

      const idToParent = new Map<string, string>();
      (Array.isArray(prows) ? prows as any[] : []).forEach((p: any) => {
        const pid = p?.id as string;
        const parent = (p?.parent_id as string) || pid;
        idToParent.set(pid, parent);
      });

      // Parents uniques
      const parentIds = Array.from(new Set(productIds.map((pid: string) => idToParent.get(pid) || pid)));

      // Qty EBAY par parent (si aucun stock EBAY, qty=0)
      const qtyByParent: Record<string, number> = {};
      if (ebayStockIds.length > 0) {
        const { data: spRows } = await supabaseService
          .from('stock_produit')
          .select('produit_id, stock_id, quantite')
          .in('produit_id', parentIds as any)
          .in('stock_id', ebayStockIds as any);

        (Array.isArray(spRows) ? spRows as any[] : []).forEach((r: any) => {
          const pid = r?.produit_id as string;
          const q = Number(r?.quantite) || 0;
          if (pid) qtyByParent[pid] = (qtyByParent[pid] || 0) + q;
        });
      }
      parentIds.forEach((pid) => {
        if (!Object.prototype.hasOwnProperty.call(qtyByParent, pid)) qtyByParent[pid] = 0;
      });

      // Construire items (dedupe par SKU)
      const items: { sku: string; quantity: number }[] = [];
      const seenSku = new Set<string>();
      for (const m of mapRows) {
        const sku = (m?.remote_sku || '').toString().trim();
        const pid = (m?.product_id || '').toString();
        if (!sku || !pid) continue;
        const parent = idToParent.get(pid) || pid;
        const qty = qtyByParent[parent] ?? 0;
        if (!seenSku.has(sku)) {
          seenSku.add(sku);
          items.push({ sku, quantity: qty });
        }
      }

      if (items.length === 0) {
        globalResults.push({ account_id: account.id, status: 'SKIPPED', reason: 'no_items' });
        continue;
      }

      // Push en lots (25)
      let accessToken: string = tokenRow.access_token;
      let updated = 0;
      let failed = 0;

      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        const payload = { requests: batch.map((it) => ({ sku: it.sku, shipToLocationAvailability: { quantity: it.quantity } })) };

        let resp = await fetch(bulkUrl, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(payload) });
        let raw = await readText(resp);

        if (resp.status === 401) {
          const newToken = await ensureRefreshedToken(account, tokenRow);
          if (!newToken) {
            failed += batch.length;
            continue;
          }
          accessToken = newToken;
          resp = await fetch(bulkUrl, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(payload) });
          raw = await readText(resp);
        }

        if (!resp.ok) {
          const js = parseJson(raw);
          if (js && Array.isArray(js.responses)) {
            js.responses.forEach((r: any) => {
              const ok = r?.statusCode === 200;
              if (ok) updated += 1; else failed += 1;
            });
          } else {
            failed += batch.length;
          }
        } else {
          const js = parseJson(raw);
          const arr = Array.isArray(js?.responses) ? js.responses : Array.isArray(js?.results) ? js.results : [];
          if (arr.length > 0) {
            arr.forEach((r: any) => {
              const ok = r?.statusCode === 200;
              if (ok) updated += 1; else failed += 1;
            });
          } else {
            // pas de détail - considérer succès pour tout le batch
            updated += batch.length;
          }
        }
      }

      globalUpdated += updated;
      globalFailed += failed;

      await supabaseService.from('sync_logs').insert({
        marketplace_account_id: account.id,
        provider: 'ebay',
        operation: 'inventory_reconcile_qty',
        outcome: failed > 0 ? 'retry' : 'ok',
        http_status: 200,
        message: 'reconcile_qty_completed',
        metadata: { updated, failed, total_items: items.length }
      });
      globalResults.push({ account_id: account.id, updated, failed, total_items: items.length });
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ updated: globalUpdated, failed: globalFailed, results: globalResults }) };
  } catch (e: any) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', detail: e?.message || 'unknown' }) };
  }
};
