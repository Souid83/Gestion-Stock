import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event: any) => {
  console.log("🟢 eBay Callback triggered");

  const requestOrigin = (event?.headers && (event.headers.origin || (event.headers as any).Origin)) || '';
  const frontendOrigin = process.env.FRONTEND_ORIGIN || requestOrigin || '';
  const buildCorsHeaders = () => (frontendOrigin ? {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  } : {});

  // Preflight handler for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...buildCorsHeaders(),
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  const isHttps = (process.env.URL || '').startsWith('https://') || ((event?.headers || {})['x-forwarded-proto'] === 'https');
  const envHint = (process.env.EBAY_ENVIRONMENT || process.env.EBAY_ENV || '').toLowerCase();
  const isProd = isHttps || envHint === 'production';
  const buildCookie = (name: string, value: string, maxAge = 300) => {
    // Host-only cookie (no Domain), Path=/, HttpOnly, SameSite=Lax; add Secure only if HTTPS
    let c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    if (isHttps) c += '; Secure';
    return c;
  };

  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) {
      return { statusCode: 400, headers: buildCorsHeaders(), body: "Missing code" };
    }

    // Parse state payload (base64url) to preserve account_id and detect environment
    let environment: 'sandbox' | 'production' = 'production';
    let stateAccountId: string | null = null;
    try {
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        if (decoded && typeof decoded === 'object') {
          if (decoded.environment === 'sandbox' || decoded.environment === 'production') {
            environment = decoded.environment;
          }
          if (decoded.account_id) {
            stateAccountId = String(decoded.account_id);
          }
        }
      }
    } catch {
      // ignore malformed state, fallback to production
    }

    // --- Variables d’environnement (Production) ---
    const clientId = process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CERT_ID;
    const ruName = environment === 'sandbox' ? process.env.EBAY_RUNAME_SANDBOX : process.env.EBAY_RUNAME_PROD;
    const secretKey = process.env.SECRET_KEY || "";
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("🔐 Using eBay credentials:", {
      clientId,
      ruName,
      env: process.env.EBAY_BASE_URL,
    });

    // --- Header Basic Auth ---
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // --- redirect complet obligatoire pour PROD ---
    if (!ruName) {
      return { statusCode: 500, headers: buildCorsHeaders(), body: JSON.stringify({ error: "missing_runame" }) };
    }
    const redirectFull: string = ruName;

    // DevPortal/test tolerance: if state missing/invalid (e.g., Developer Portal "Test Sign-in") or ?test=1,
    // redirect ONCE to our authorize function with prompt=consent, using an anti-loop cookie.
    const qs = (event as any).queryStringParameters || {};
    const referer = (event.headers as any)?.referer || (event.headers as any)?.Referer || '';
    const isDevPortal = !state || state === '' || (typeof referer === 'string' && referer.includes('developer.ebay.com')) || qs.test === '1';
    if (isDevPortal) {
      console.warn('callback_state_missing_devportal');
      const cookieHeader = (event.headers as any)?.cookie || (event.headers as any)?.Cookie || '';
      const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      const hasOnce = typeof cookieHeader === 'string' && cookieHeader.includes('gf_ebay_reauth_once=1');

      if (hasOnce) {
        const html = `<html><body><p>Re-consent requis.</p><a href="/.netlify/functions/ebay-authorize?reconsent=1">Continuer</a></body></html>`;
        return { statusCode: 200, headers: { 'Content-Type': 'text/html', ...buildCorsHeaders() }, body: html };
      }

      const setOnce = `gf_ebay_reauth_once=1; ${cookieAttrs}`;
      const setReauth = `gf_ebay=reauth; ${cookieAttrs}`;
      return {
        statusCode: 302,
        headers: {
          ...buildCorsHeaders(),
          'Location': `/.netlify/functions/ebay-authorize?reconsent=1`,
          'Set-Cookie': `${setOnce}, ${setReauth}`
        },
        body: ''
      };
    }

    const tokenScopes = 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment';

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectFull,
      scope: tokenScopes,
    }).toString();

    const baseHost = environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
    console.log(`🌐 Requesting token from eBay ${environment.toUpperCase()}...`);

    const response = await fetch(`${baseHost}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      console.error("❌ eBay OAuth error:", data);
      return { statusCode: 502, headers: buildCorsHeaders(), body: JSON.stringify({ ebay_error: data }) };
    }

    const { access_token, refresh_token, expires_in, scope, token_type } = data;

    // Validate scopes but do not hard-fail; persist token and mark account for reauth if insufficient
    if (!refresh_token) {
      return { statusCode: 502, headers: buildCorsHeaders(), body: JSON.stringify({ reason: 'r0_detected_no_refresh_token' }) };
    }
    const scopeStr = typeof scope === 'string' ? scope : Array.isArray(scope) ? scope.join(' ') : '';
    console.debug('token_debug', { hasScopeField: Object.prototype.hasOwnProperty.call(data, 'scope'), scopeLen: (scopeStr || '').length });

    // Diagnostic temporaire: vérifier les privilèges SELL (status only, aucun secret loggé)
    try {
      const privilegeResp = await fetch(`${baseHost}/sell/account/v1/privilege`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/json'
        }
      });
      console.info('ebay_privilege_status', { status: privilegeResp.status });
    } catch {
      console.warn('ebay_privilege_status_error');
    }

    const hasRequired = /\bsell\.inventory\b|\bsell\.account\b|\bsell\.fulfillment\b/.test(scopeStr);
    let insufficientScopes = false;
    if (!hasRequired) {
      insufficientScopes = true;
      console.warn('ebay_callback_insufficient_scope', { scope: scopeStr });
    }
    console.log('eBay token meta', { token_type, scope: scopeStr, hasRequired });

    // --- Chiffrement AES-GCM (WebCrypto) du refresh token ---
    const encryptData = async (data: string): Promise<{ encrypted: string; iv: string }> => {
      if (!secretKey) {
        throw new Error("SECRET_KEY not configured");
      }
      const keyBuffer = Buffer.from(secretKey, "base64");
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        new TextEncoder().encode(data)
      );
      return {
        encrypted: Buffer.from(encryptedBuffer).toString("base64"),
        iv: Buffer.from(iv).toString("base64"),
      };
    };

    const encryptedRefresh = refresh_token
      ? await encryptData(refresh_token)
      : null;

    // --- Insertion Supabase ---
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, headers: buildCorsHeaders(), body: JSON.stringify({ error: "missing_supabase_env" }) };
    }
    const supabase = createClient(supabaseUrl as string, supabaseKey as string);

    // Re-consent flow if token_type invalid or scopes missing the required SELL scopes
    if (token_type !== 'User Access Token' || !hasRequired || !scopeStr) {
      console.warn('ebay_callback_insufficient_scope', { token_type, scope: scopeStr });

      const cookieHeader = (event.headers as any)?.cookie || (event.headers as any)?.Cookie || '';
      const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      const hasOnce = typeof cookieHeader === 'string' && cookieHeader.includes('gf_ebay_reauth_once=1');

      if (hasOnce) {
        const html = `<html><body><p>Re-consent requis.</p><a href="/.netlify/functions/ebay-authorize?reconsent=1">Continuer</a></body></html>`;
        return { statusCode: 200, headers: { 'Content-Type': 'text/html', ...buildCorsHeaders() }, body: html };
      }

      const setOnce = `gf_ebay_reauth_once=1; ${cookieAttrs}`;
      const setReauth = `gf_ebay=reauth; ${cookieAttrs}`;
      return {
        statusCode: 302,
        headers: {
          ...buildCorsHeaders(),
          'Location': '/.netlify/functions/ebay-authorize?reconsent=1',
          'Set-Cookie': `${setOnce}, ${setReauth}`
        },
        body: ''
      };
    }

    // Validate state nonce against pending oauth_tokens
    let stateNonce: string | null = null;
    try {
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        stateNonce = typeof decoded?.n === 'string' ? decoded.n : null;
      }
    } catch {
      // ignore
    }
    if (!stateNonce) {
      // No state → single reconsent via our authorize function
      const cookieHeader = (event.headers as any)?.cookie || (event.headers as any)?.Cookie || '';
      const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      const hasOnce = typeof cookieHeader === 'string' && cookieHeader.includes('gf_ebay_reauth_once=1');

      if (hasOnce) {
        const html = `<html><body><p>Re-consent requis.</p><a href="/.netlify/functions/ebay-authorize?reconsent=1">Continuer</a></body></html>`;
        return { statusCode: 200, headers: { 'Content-Type': 'text/html', ...buildCorsHeaders() }, body: html };
      }

      const setOnce = `gf_ebay_reauth_once=1; ${cookieAttrs}`;
      const setReauth = `gf_ebay=reauth; ${cookieAttrs}`;
      return {
        statusCode: 302,
        headers: {
          ...buildCorsHeaders(),
          'Location': '/.netlify/functions/ebay-authorize?reconsent=1',
          'Set-Cookie': `${setOnce}, ${setReauth}`
        },
        body: ''
      };
    }
    const { data: pendingRow } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('state_nonce', stateNonce as any)
      .eq('access_token', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!pendingRow) {
      // cleanup any stale rows with this nonce
      try { await supabase.from('oauth_tokens').delete().eq('state_nonce', stateNonce as any); } catch {}

      const cookieHeader = (event.headers as any)?.cookie || (event.headers as any)?.Cookie || '';
      const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      const hasOnce = typeof cookieHeader === 'string' && cookieHeader.includes('gf_ebay_reauth_once=1');

      if (hasOnce) {
        const html = `<html><body><p>Re-consent requis.</p><a href="/.netlify/functions/ebay-authorize?reconsent=1">Continuer</a></body></html>`;
        return { statusCode: 200, headers: { 'Content-Type': 'text/html', ...buildCorsHeaders() }, body: html };
      }

      const setOnce = `gf_ebay_reauth_once=1; ${cookieAttrs}`;
      const setReauth = `gf_ebay=reauth; ${cookieAttrs}`;
      return {
        statusCode: 302,
        headers: {
          ...buildCorsHeaders(),
          'Location': '/.netlify/functions/ebay-authorize?reconsent=1',
          'Set-Cookie': `${setOnce}, ${setReauth}`
        },
        body: ''
      };
    }


    // --- Upsert marketplace_accounts ---
    console.log("🔄 Resolving marketplace_account (preserve id if reconnect)...");
    let accountId: string | null = null;

    // If we are reconnecting an existing account, update it instead of creating a new one
    if (stateAccountId) {
      const { data: existingAcc } = await supabase
        .from("marketplace_accounts")
        .select("*")
        .eq("id", stateAccountId as any)
        .eq("provider", "ebay")
        .maybeSingle();

      if (existingAcc && (existingAcc as any).id) {
        const { error: updErr } = await supabase
          .from("marketplace_accounts")
          .update({
            is_active: true,
            environment,
            display_name: `eBay ${environment === 'sandbox' ? 'Sandbox' : 'Production'}`,
            updated_at: new Date().toISOString()
          } as any)
          .eq("id", stateAccountId as any);
        if (!updErr) {
          accountId = stateAccountId;
          console.log("✅ marketplace_account updated by state.account_id:", stateAccountId);
        } else {
          console.warn("⚠️ Failed to update existing account by state.account_id, will fallback to upsert:", updErr);
        }
      } else {
        console.warn("⚠️ state.account_id not found or not ebay provider, fallback to upsert:", stateAccountId);
      }
    }

    // Fallback: Upsert by (user_id,provider,environment,provider_account_id)
    if (!accountId) {
      const { data: accountData, error: accountError } = await supabase
        .from("marketplace_accounts")
        .upsert(
          {
            user_id: null,
            provider: "ebay",
            provider_account_id: clientId, // stays stable for this app config
            display_name: `eBay ${environment === 'sandbox' ? 'Sandbox' : 'Production'}`,
            environment,
            is_active: true,
            updated_at: new Date().toISOString(),
          } as any,
          {
            onConflict: "user_id,provider,environment,provider_account_id",
          }
        )
        .select()
        .single();

      if (accountError) {
        console.error("❌ marketplace_accounts upsert error:", accountError);
        return { statusCode: 500, body: JSON.stringify({ account_error: accountError }) };
      }
      accountId = (accountData as any).id;
      console.log("✅ marketplace_accounts upserted:", accountId);
    }

    const { error } = await supabase.from("oauth_tokens").insert({
      marketplace_account_id: accountId,
      access_token,
      refresh_token_encrypted: encryptedRefresh ? encryptedRefresh.encrypted : null,
      encryption_iv: encryptedRefresh ? encryptedRefresh.iv : null,
      scope,
      token_type,
      expires_at: new Date(Date.now() + Math.max(0, ((expires_in || 7200) - 120) * 1000)).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_nonce: stateNonce || "none",
    } as any);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return { statusCode: 500, headers: buildCorsHeaders(), body: JSON.stringify({ insert_error: error }) };
    }

    console.log("✅ OAuth tokens stored successfully");
    // If scopes are insufficient, mark account as needing re-auth
    try {
      if (typeof insufficientScopes !== 'undefined' && insufficientScopes && accountId) {
        await supabase
          .from('marketplace_accounts')
          .update({ needs_reauth: true, updated_at: new Date().toISOString() } as any)
          .eq('id', accountId as any);
      }
    } catch (e) {
      console.warn('⚠️ Failed to set needs_reauth on marketplace_accounts:', (e as any)?.message || e);
    }

    // Consume the pending state
    try {
      await supabase
        .from('oauth_tokens')
        .update({ access_token: 'consumed', updated_at: new Date().toISOString() } as any)
        .eq('state_nonce', stateNonce as any);
    } catch {}

    {
      const redirectLocation = `/pricing?provider=ebay${(typeof insufficientScopes !== 'undefined' && insufficientScopes) ? '&connected=0&reason=insufficient_scope' : '&connected=1'}`;
      // Set a short-lived host-only cookie to reflect connection status (no Domain, Path=/, HttpOnly, SameSite=Lax; Secure if HTTPS)
      const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      const okCookie = `gf_ebay=connected; ${cookieAttrs}`;
      const clearOnce = `gf_ebay_reauth_once=; ${cookieAttrs}; Max-Age=0`;
      return {
        statusCode: 302,
        headers: {
          ...buildCorsHeaders(),
          'Location': redirectLocation,
          'Set-Cookie': `${okCookie}, ${clearOnce}`
        },
        body: ''
      };
    }
  } catch (err: any) {
    console.error("🔥 Callback fatal error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
