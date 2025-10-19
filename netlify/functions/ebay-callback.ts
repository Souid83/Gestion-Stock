import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const handler = async (event) => {
  console.log("🟢 eBay Callback triggered");
  try {
    console.log("🔸 Raw URL:", event.rawUrl);
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    console.log("🔹 Code:", code);
    console.log("🔹 State:", state);

    if (!code) {
      console.error("❌ Missing code param in callback URL");
      return { statusCode: 400, body: "Missing code" };
    }

    const clientId = process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CERT_ID;
    const ruName = process.env.EBAY_RUNAME;
    const secretKey = process.env.SECRET_KEY || "";
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("🔑 Env OK:", { clientId, ruName, supabaseUrl: supabaseUrl?.slice(0, 25) + "...", secretKeyLen: secretKey?.length });

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    });

    console.log("🌐 Fetching token from eBay Identity API...");

    const response = await fetch("https://api.sandbox.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    console.log("🔸 eBay response status:", response.status);
    const rawText = await response.text();
    console.log("🧾 Raw eBay response text:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("⚠️ Failed to parse JSON:", e);
      data = { raw: rawText };
    }

    if (!response.ok) {
      console.error("❌ eBay OAuth error:", data);
      return { statusCode: 500, body: JSON.stringify(data) };
    }

    const { access_token, refresh_token, expires_in, token_type, scope } = data;
    console.log("✅ Tokens received:", {
      hasAccess: !!access_token,
      hasRefresh: !!refresh_token,
      scope,
      expires_in,
      token_type,
    });

    function encryptToken(token, secret) {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(secret, "salt", 32);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return JSON.stringify({ iv: iv.toString("hex"), tag: tag.toString("hex"), data: encrypted.toString("hex") });
    }

    const encryptedRefresh = refresh_token ? encryptToken(refresh_token, secretKey) : null;
    console.log("🧩 Encrypted refresh token length:", encryptedRefresh?.length);

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("🧭 Inserting into oauth_tokens...");

    const { data: insertData, error: insertError } = await supabase.from("oauth_tokens").insert({
      access_token: access_token || "missing_access_token",
      refresh_token_encrypted: encryptedRefresh,
      token_type,
      scope,
      expires_at: new Date(Date.now() + (expires_in || 7200) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_nonce: state || "none",
    }).select("*");

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      return { statusCode: 500, body: JSON.stringify({ insert_error: insertError }) };
    }

    console.log("✅ Insert OK:", insertData);

    return {
      statusCode: 302,
      headers: { Location: "/pricing?provider=ebay&connected=1" },
    };
  } catch (err) {
    console.error("🔥 Uncaught callback exception:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};
