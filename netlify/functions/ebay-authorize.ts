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
    if (!isAdmin) {
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

    const body: RequestBody = JSON.parse(event.body);
    const { environment, client_id, client_secret, runame } = body;

    if (!environment || !client_id || !client_secret || !runame) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'All fields are required' })
      };
    }

    if (environment !== 'sandbox' && environment !== 'production') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Invalid environment' })
      };
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
        runame,
        encryption_iv: iv,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'provider,environment'
      });

    const stateNonce = generateStateNonce();

    await supabase
      .from('oauth_tokens')
      .insert({
        marketplace_account_id: null,
        access_token: 'pending',
        state_nonce: stateNonce,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        updated_at: new Date().toISOString()
      });

    const authBaseUrl = environment === 'sandbox' ? EBAY_SANDBOX_AUTH_URL : EBAY_PRODUCTION_AUTH_URL;

    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.finances',
      'https://api.ebay.com/oauth/api_scope/sell.payment.dispute',
      'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
    ];

    const authorizeUrl = `${authBaseUrl}?client_id=${encodeURIComponent(client_id)}&response_type=code&redirect_uri=${encodeURIComponent(runame)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(stateNonce)}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        authorizeUrl
      })
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
