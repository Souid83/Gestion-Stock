import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event) => {
  try {
    const code = new URL(event.rawUrl).searchParams.get("code");
    if (!code) {
      return { statusCode: 400, body: "Missing code" };
    }

    const clientId = process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CERT_ID;
    const ruName = process.env.EBAY_RUNAME;
    const secretKey = process.env.SECRET_KEY || "";

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    });

    const response = await fetch("https://api.sandbox.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("eBay OAuth error:", data);
      return { statusCode: 500, body: JSON.stringify(data) };
    }

    const { access_token, refresh_token, expires_in, token_type, scope } = data;

    function encryptToken(token, secret) {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(secret, "salt", 32);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return JSON.stringify({ iv: iv.toString("hex"), tag: tag.toString("hex"), data: encrypted.toString("hex") });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const encryptedRefresh = refresh_token ? encryptToken(refresh_token, secretKey) : null;

    await supabase.from("oauth_tokens").insert({
      access_token,
      refresh_token_encrypted: encryptedRefresh,
      token_type,
      scope,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      statusCode: 302,
      headers: { Location: "/pricing?provider=ebay&connected=1" },
    };
  } catch (err) {
    console.error("Callback exception:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
