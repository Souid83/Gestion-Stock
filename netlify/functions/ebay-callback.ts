import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event) => {
  console.log("🟢 eBay Callback triggered");

  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) {
      return { statusCode: 400, body: "Missing code" };
    }

    // --- Variables d’environnement (Production) ---
    const clientId = process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CERT_ID;
    const ruName = process.env.EBAY_RUNAME;
    const secretKey = process.env.SECRET_KEY || "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("🔐 Using eBay credentials:", {
      clientId,
      ruName,
      env: process.env.EBAY_BASE_URL,
    });

    // --- Header Basic Auth ---
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // --- redirect complet obligatoire pour PROD ---
    const redirectFull = ruName;


    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectFull,
    }).toString();

    console.log("🌐 Requesting token from eBay PRODUCTION...");

    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
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

    console.log("✅ Token response received");

    if (!access_token) {
      console.error("❌ Missing access_token in eBay response");
      return { statusCode: 502, body: JSON.stringify({ error: "missing_access_token" }) };
    }

    if (!refresh_token) {
      console.error("❌ Missing refresh_token in eBay response");
      return { statusCode: 502, body: JSON.stringify({ error: "missing_refresh_token" }) };
    }

    // --- Insertion Supabase ---
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Upsert marketplace_accounts ---
    console.log("🔄 Upserting marketplace_accounts...");
    const { data: accountData, error: accountError } = await supabase
      .from("marketplace_accounts")
      .upsert(
        {
          user_id: null,
          provider: "ebay",
          provider_account_id: clientId,
          display_name: "eBay Production",
          environment: "production",
          is_active: true,
          client_id: clientId,
          updated_at: new Date().toISOString(),
        },
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

    console.log("✅ marketplace_accounts upserted");

    const scopesArray = scope ? scope.split(' ').filter(Boolean) : [];

    const { error } = await supabase.from("oauth_tokens").insert({
      marketplace_account_id: accountData.id,
      provider: "ebay",
      access_token,
      refresh_token,
      expires_in: expires_in || null,
      scopes: scopesArray.length > 0 ? scopesArray : null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return { statusCode: 500, body: JSON.stringify({ insert_error: error }) };
    }

    console.log("✅ OAuth tokens stored successfully");

    return {
      statusCode: 302,
      headers: {
        Location: "/pricing?provider=ebay&connected=1",
      },
    };
  } catch (err) {
    console.error("🔥 Callback fatal error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
