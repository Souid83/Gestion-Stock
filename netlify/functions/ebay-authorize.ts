import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
}

interface NetlifyContext {
  clientContext?: {
    user?: {
      sub: string;
    };
  };
}

interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SECRET_KEY = process.env.SECRET_KEY || '';

const EBAY_SANDBOX_AUTH_URL = 'https://auth.sandbox.ebay.com/oauth2/authorize';
const EBAY_PRODUCTION_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';

interface RequestBody {
  environment: 'sandbox' | 'production';
  client_id: string;
  client_secret: string;
  runame: string;
  // Optionnel: si on reconnecte un compte existant, passer son id pour préserver le marketplace_account_id
  account_id?: string | null;
}

async function encryptData(data: string): Promise<{ encrypted: string; iv: string }> {
  if (!SECRET_KEY) {
    throw new Error('SECRET_KEY not configured');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const keyBuffer = Buffer.from(SECRET_KEY, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  return {
    encrypted: Buffer.from(encryptedBuffer).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
}

function generateStateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64url');
}

async function checkAdminAccess(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('admin_users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_admin === true;
}

export const handler = async (event: NetlifyEvent, context: NetlifyContext): Promise<NetlifyResponse> => {
  // RBAC bypass pour développement / sandbox
  const RBAC_BYPASS = process.env.RBAC_DISABLED === 'true';
  if (RBAC_BYPASS) {
    console.log('⚙️ RBAC bypass activé pour eBay authorize');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: event.headers.authorization || ''
      }
    }
  });

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    const isAdmin = await checkAdminAccess(supabase);
    if (!isAdmin && !RBAC_BYPASS) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'forbidden' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Missing request body' })
      };
    }

    // Accept JSON or application/x-www-form-urlencoded bodies
    let parsed: any = {};
    const rawBody = event.body || '';
    const contentType = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();

    try {
      if (contentType.includes('application/json')) {
        parsed = JSON.parse(rawBody);
      } else {
        const params = new URLSearchParams(rawBody);
        parsed = {
          environment: params.get('environment') || undefined,
          client_id: params.get('client_id') || undefined,
          client_secret: params.get('client_secret') || undefined,
          runame: params.get('runame') || undefined,
          account_id: params.get('account_id') || undefined
        };
      }
    } catch {
      parsed = {};
    }

    const body: RequestBody = {
      environment: parsed.environment,
      client_id: parsed.client_id,
      client_secret: parsed.client_secret,
      runame: parsed.runame,
      account_id: parsed.account_id
    } as any;
    const { environment, client_id, client_secret, runame } = body;

    if (!environment || !client_id || !client_secret) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Missing environment, client_id or client_secret' })
      };
    }

    if (environment !== 'sandbox' && environment !== 'production') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Invalid environment' })
      };
    }

    const ruNameEnv = environment === 'sandbox' ? (process.env.EBAY_RUNAME_SANDBOX || '') : (process.env.EBAY_RUNAME_PROD || '');
    const ruNameFinal = ruNameEnv || runame || '';
    if (!ruNameFinal) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing RUName for environment and no runame provided' })
      };
    }
    if (!ruNameEnv) {
      console.warn('[eBay Authorize] RUName not set in env for', environment, '- falling back to request body runame.');
    }

    const { encrypted: encryptedClientId, iv } = await encryptData(client_id);
    const { encrypted: encryptedClientSecret } = await encryptData(client_secret);

    await supabase
      .from('provider_app_credentials')
      .upsert({
        provider: 'ebay',
        environment,
        client_id_encrypted: encryptedClientId,
        client_secret_encrypted: encryptedClientSecret,
        runame: ruNameFinal,
        encryption_iv: iv,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'provider,environment'
      });

    const stateNonce = generateStateNonce();
    // Encoder dans state: nonce + environment + (optionnel) account_id pour reconnection
    const statePayload = {
      n: stateNonce,
      environment,
      account_id: (body as any).account_id || null
    };
    const stateEncoded = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    await supabase
      .from('oauth_tokens')
      .insert({
        marketplace_account_id: null,
        access_token: 'pending',
        state_nonce: stateNonce,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        updated_at: new Date().toISOString()
      });

    const authBaseUrl = environment === 'sandbox'
      ? EBAY_SANDBOX_AUTH_URL
      : EBAY_PRODUCTION_AUTH_URL;

    // Include base scope + required SELL scopes (no client_credentials here)
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
    ];

    const authorizeUrl = `${authBaseUrl}?client_id=${encodeURIComponent(client_id)}&response_type=code&redirect_uri=${encodeURIComponent(ruNameFinal)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(stateEncoded)}&prompt=login`;

    const safeUrl = authorizeUrl.replace(/([?&]state=)[^&]+/, '$1<hidden>');
    console.log('eBay authorize', { environment, url: safeUrl });

    // Redirect directly to eBay consent page (no cookies here)
    return {
      statusCode: 302,
      headers: {
        Location: authorizeUrl
      },
      body: ''
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
