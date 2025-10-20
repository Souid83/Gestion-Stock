import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event) => {
  console.log("🟢 eBay Callback triggered");

  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) return { statusCode: 400, body: "Missing code" };

    const clientId = process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CERT_ID;
    const ruName = process.env.EBAY_RUNAME;
    const secretKey = process.env.SECRET_KEY || "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    }).toString();

    console.log("🌐 Requesting token from eBay sandbox...");

    const response = await fetch("https://api.sandbox.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
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

    const encryptToken = (token, secret) => {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(secret, "salt", 32);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return JSON.stringify({ iv: iv.toString("hex"), tag: tag.toString("hex"), data: enc.toString("hex") });
    };

    const encryptedRefresh = refresh_token ? encryptToken(refresh_token, secretKey) : null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("oauth_tokens").insert({
      access_token,
      refresh_token_encrypted: encryptedRefresh,
      scope,
      token_type,
      expires_at: new Date(Date.now() + (expires_in || 7200) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_nonce: state || "none",
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return { statusCode: 500, body: JSON.stringify({ insert_error: error }) };
    }

    console.log("✅ OAuth tokens stored OK");
    return { statusCode: 302, headers: { Location: "/pricing?provider=ebay&connected=1" } };
  } catch (err) {
    console.error("🔥 Callback fatal error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
