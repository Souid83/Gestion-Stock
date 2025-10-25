import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event: any) => {
  console.log("🟢 eBay Callback triggered");

  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) {
      return { statusCode: 400, body: "Missing code" };
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
    const ruName = process.env.EBAY_RUNAME;
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
      return { statusCode: 500, body: JSON.stringify({ error: "missing_runame" }) };
    }
    const redirectFull: string = ruName;


    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectFull,
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
      return { statusCode: 502, body: JSON.stringify({ ebay_error: data }) };
    }

    const { access_token, refresh_token, expires_in, scope, token_type } = data;

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
      return { statusCode: 500, body: JSON.stringify({ error: "missing_supabase_env" }) };
    }
    const supabase = createClient(supabaseUrl as string, supabaseKey as string);

    // Ensure provider_app_credentials are available for this environment (used by stock-update refresh)
    try {
      if (clientId && clientSecret) {
        // Local helper to encrypt app credentials with SECRET_KEY (AES-GCM) — same scheme as elsewhere
        const encryptAppField = async (val: string): Promise<{ encrypted: string; iv: string }> => {
          if (!secretKey) throw new Error("SECRET_KEY not configured");
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
            new TextEncoder().encode(val)
          );
          return {
            encrypted: Buffer.from(encryptedBuffer).toString("base64"),
            iv: Buffer.from(iv).toString("base64"),
          };
        };

        const encId = await encryptAppField(String(clientId));
        const encSecret = await encryptAppField(String(clientSecret));

        await supabase
          .from('provider_app_credentials')
          .upsert({
            provider: 'ebay',
            environment,
            client_id_encrypted: encId.encrypted,
            client_secret_encrypted: encSecret.encrypted,
            runame: ruName,
            encryption_iv: encId.iv,
            updated_at: new Date().toISOString()
          } as any, {
            onConflict: 'provider,environment'
          } as any);
      }
    } catch (e) {
      console.warn('⚠️ provider_app_credentials upsert failed (non-blocking):', e);
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
      expires_at: new Date(Date.now() + (expires_in || 7200) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_nonce: state || "none",
    } as any);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return { statusCode: 500, body: JSON.stringify({ insert_error: error }) };
    }

    console.log("✅ OAuth tokens stored successfully");

    return {
      statusCode: 302,
      headers: {
        Location: "https://dev-gestockflow.netlify.app/pricing?provider=ebay&connected=1",
      },
    };
  } catch (err: any) {
    console.error("🔥 Callback fatal error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
