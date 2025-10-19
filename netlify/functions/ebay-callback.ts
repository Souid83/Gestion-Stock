import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SECRET_KEY = process.env.SECRET_KEY || '';

const EBAY_SANDBOX_TOKEN_URL = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
const EBAY_PRODUCTION_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SANDBOX_USER_URL = 'https://apiz.sandbox.ebay.com/commerce/identity/v1/user/';
const EBAY_PRODUCTION_USER_URL = 'https://apiz.ebay.com/commerce/identity/v1/user/';

interface eBayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
  scope?: string;
}

interface eBayUserResponse {
  userId: string;
  username: string;
  registrationMarketplaceId: string;
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

async function decryptData(encrypted: string, iv: string): Promise<string> {
  if (!SECRET_KEY) {
    throw new Error('SECRET_KEY not configured');
  }

  const keyBuffer = Buffer.from(SECRET_KEY, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    cryptoKey,
    encryptedBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

function logToSyncLogs(
  supabase: any,
  operation: string,
  outcome: 'ok' | 'fail',
  details: {
    marketplace_account_id?: string;
    http_status?: number;
    error_code?: string;
    error_message?: string;
    metadata?: any;
  }
) {
  return supabase.from('sync_logs').insert({
    marketplace_account_id: details.marketplace_account_id || null,
    operation,
    outcome,
    http_status: details.http_status,
    error_code: details.error_code,
    error_message: details.error_message,
    metadata: details.metadata || {}
  });
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    const { code, state } = event.queryStringParameters || {};

    if (!code || !state) {
      await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
        http_status: 400,
        error_code: 'missing_param',
        error_message: 'Missing code or state parameter'
      });

      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'missing_param', hint: 'Both code and state are required' })
      };
    }

    const { data: tokenRow, error: stateError } = await supabase
      .from('oauth_tokens')
      .select('state_nonce, marketplace_account_id')
      .eq('state_nonce', state)
      .maybeSingle();

    if (stateError || !tokenRow) {
      await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
        http_status: 400,
        error_code: 'invalid_state',
        error_message: 'State nonce not found or expired'
      });

      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_state', hint: 'Invalid or expired CSRF token' })
      };
    }

    let clientId: string;
    let clientSecret: string;
    let runame: string;
    let environment: 'sandbox' | 'production' = 'sandbox';

    const { data: credentials } = await supabase
      .from('provider_app_credentials')
      .select('*')
      .eq('provider', 'ebay')
      .maybeSingle();

    if (credentials) {
      try {
        clientId = await decryptData(credentials.client_id_encrypted, credentials.encryption_iv);
        clientSecret = await decryptData(credentials.client_secret_encrypted, credentials.encryption_iv);
        runame = credentials.runame;
        environment = credentials.environment || 'sandbox';
      } catch (decryptError) {
        await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
          http_status: 500,
          error_code: 'decryption_failed',
          error_message: 'Failed to decrypt credentials'
        });

        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }
    } else {
      clientId = process.env.EBAY_CLIENT_ID || '';
      clientSecret = process.env.EBAY_CLIENT_SECRET || '';
      runame = process.env.EBAY_RUNAME || '';
      environment = (process.env.EBAY_ENV as 'sandbox' | 'production') || 'sandbox';

      if (!clientId || !clientSecret || !runame) {
        await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
          http_status: 500,
          error_code: 'missing_credentials',
          error_message: 'eBay credentials not configured'
        });

        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }
    }

    const tokenUrl = environment === 'sandbox' ? EBAY_SANDBOX_TOKEN_URL : EBAY_PRODUCTION_TOKEN_URL;
    const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: runame
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenBody.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      const errorCode = errorData.error || 'token_exchange_failed';
      const errorDescription = errorData.error_description || 'Failed to exchange authorization code';

      let hint = 'Token exchange failed';
      if (errorCode === 'invalid_client') hint = 'Invalid client credentials';
      if (errorCode === 'invalid_grant') hint = 'Authorization code is invalid or expired';
      if (errorCode.includes('redirect')) hint = 'Redirect URI mismatch';

      await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
        http_status: tokenResponse.status,
        error_code: errorCode,
        error_message: errorDescription
      });

      return {
        statusCode: 424,
        body: JSON.stringify({ error: errorCode, hint })
      };
    }

    const tokenData: eBayTokenResponse = await tokenResponse.json();

    const userUrl = environment === 'sandbox' ? EBAY_SANDBOX_USER_URL : EBAY_PRODUCTION_USER_URL;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    let providerAccountId = 'unknown';
    let displayName = 'eBay Account';
    let metadata = {};

    if (userResponse.ok) {
      const userData: eBayUserResponse = await userResponse.json();
      providerAccountId = userData.userId;
      displayName = userData.username || userData.userId;
      metadata = {
        username: userData.username,
        userId: userData.userId,
        registrationMarketplaceId: userData.registrationMarketplaceId
      };
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = tokenData.refresh_token_expires_in
      ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
      : null;

    const { encrypted: encryptedRefreshToken, iv: refreshTokenIv } = await encryptData(tokenData.refresh_token);

    const { data: accountData, error: accountError } = await supabase
      .from('marketplace_accounts')
      .upsert({
        user_id: context.clientContext?.user?.sub,
        provider: 'ebay',
        environment,
        provider_account_id: providerAccountId,
        display_name: displayName,
        metadata,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider,environment,provider_account_id'
      })
      .select()
      .single();

    if (accountError || !accountData) {
      await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
        http_status: 500,
        error_code: 'account_upsert_failed',
        error_message: accountError?.message || 'Failed to create/update marketplace account'
      });

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    const { error: tokenUpsertError } = await supabase
      .from('oauth_tokens')
      .upsert({
        marketplace_account_id: accountData.id,
        access_token: tokenData.access_token,
        refresh_token_encrypted: encryptedRefreshToken,
        token_type: tokenData.token_type,
        scope: tokenData.scope || 'commerce.identity.readonly sell.account.readonly sell.inventory.readonly',
        expires_at: expiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        state_nonce: null,
        encryption_iv: refreshTokenIv,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'marketplace_account_id'
      });

    if (tokenUpsertError) {
      await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
        marketplace_account_id: accountData.id,
        http_status: 500,
        error_code: 'token_storage_failed',
        error_message: tokenUpsertError.message
      });

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    await logToSyncLogs(supabase, 'oauth_callback', 'ok', {
      marketplace_account_id: accountData.id,
      http_status: 200,
      metadata: { provider: 'ebay', environment }
    });

    const isDebug = event.headers['x-debug'] === 'true';

    if (isDebug) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          account_id: accountData.id,
          provider: 'ebay',
          environment,
          display_name: displayName
        })
      };
    }

    return {
      statusCode: 302,
      headers: {
        'Location': `/pricing?provider=ebay&account=${accountData.id}`
      },
      body: ''
    };

  } catch (error: any) {
    await logToSyncLogs(supabase, 'oauth_callback', 'fail', {
      http_status: 500,
      error_code: 'unexpected_error',
      error_message: error?.message || 'Unexpected server error'
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
