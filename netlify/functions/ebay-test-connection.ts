import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string> | null;
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

interface eBayIdentityResponse {
  userId: string;
  username: string;
  registrationMarketplaceId: string;
}

interface eBayPrivilegesResponse {
  sellerRegistrationCompleted: boolean;
  sellingLimit?: {
    amount: {
      value: string;
      currency: string;
    };
    quantity: number;
  } | null;
}

interface eBayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
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

function logToSyncLogs(
  supabase: any,
  details: {
    marketplace_account_id: string;
    operation: string;
    outcome: 'ok' | 'retry' | 'fail';
    http_status: number;
    message?: string;
    retry_count?: number;
  }
) {
  return supabase.from('sync_logs').insert({
    marketplace_account_id: details.marketplace_account_id,
    operation: details.operation,
    outcome: details.outcome,
    http_status: details.http_status,
    error_message: details.message || null,
    metadata: {
      provider: 'ebay',
      retry_count: details.retry_count || 0
    }
  });
}

async function checkRBAC(supabase: any): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('admin_users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return false;

    return (data as any)?.is_admin ?? false;
  } catch {
    return false;
  }
}

export const handler = async (event: NetlifyEvent, context: NetlifyContext): Promise<NetlifyResponse> => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    const hasAccess = await checkRBAC(supabase);
    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'forbidden' })
      };
    }

    const { account_id } = event.queryStringParameters || {};

    if (!account_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'missing_account_id' })
      };
    }

    const { data: account, error: accountError } = await supabase
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();

    if (accountError || !account) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'account_not_found' })
      };
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      await logToSyncLogs(supabase, {
        marketplace_account_id: account_id,
        operation: 'oauth_test',
        outcome: 'fail',
        http_status: 424,
        message: 'Token missing'
      });

      return {
        statusCode: 424,
        body: JSON.stringify({ error: 'token_missing' })
      };
    }

    let clientId: string;
    let clientSecret: string;
    const environment = account.environment || 'sandbox';

    const { data: credentials } = await supabase
      .from('provider_app_credentials')
      .select('*')
      .eq('provider', 'ebay')
      .eq('environment', environment)
      .maybeSingle();

    if (credentials) {
      try {
        clientId = await decryptData(credentials.client_id_encrypted, credentials.encryption_iv);
        clientSecret = await decryptData(credentials.client_secret_encrypted, credentials.encryption_iv);
      } catch {
        clientId = process.env.EBAY_CLIENT_ID || '';
        clientSecret = process.env.EBAY_CLIENT_SECRET || '';
      }
    } else {
      clientId = process.env.EBAY_CLIENT_ID || '';
      clientSecret = process.env.EBAY_CLIENT_SECRET || '';
    }

    if (!clientId || !clientSecret) {
      await logToSyncLogs(supabase, {
        marketplace_account_id: account_id,
        operation: 'oauth_test',
        outcome: 'fail',
        http_status: 500,
        message: 'Credentials missing'
      });

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    const isSandbox = environment === 'sandbox';
    const tokenUrl = isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
    const identityUrl = isSandbox
      ? 'https://apiz.sandbox.ebay.com/commerce/identity/v1/user/'
      : 'https://apiz.ebay.com/commerce/identity/v1/user/';
    const privilegeUrl = isSandbox
      ? 'https://api.sandbox.ebay.com/sell/account/v1/privilege'
      : 'https://api.ebay.com/sell/account/v1/privilege';

    let accessToken = tokenRow.access_token;
    let hasRefreshed = false;

    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);

    if (now >= expiresAt) {
      if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) {
        await logToSyncLogs(supabase, {
          marketplace_account_id: account_id,
          operation: 'oauth_test',
          outcome: 'fail',
          http_status: 424,
          message: 'Token expired, no refresh token'
        });

        return {
          statusCode: 424,
          body: JSON.stringify({ error: 'token_expired' })
        };
      }

      try {
        const refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);
        const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const tokenBody = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: tokenRow.scope || ''
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
          const errorCode = errorData.error || 'refresh_failed';

          await logToSyncLogs(supabase, {
            marketplace_account_id: account_id,
            operation: 'oauth_test',
            outcome: 'fail',
            http_status: tokenResponse.status,
            message: `Token refresh failed: ${errorCode}`,
            retry_count: 1
          });

          return {
            statusCode: 424,
            body: JSON.stringify({ error: errorCode, hint: 'Token refresh failed' })
          };
        }

        const tokenData: eBayTokenResponse = await tokenResponse.json();
        accessToken = tokenData.access_token;
        hasRefreshed = true;

        const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        let updateData: any = {
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        };

        if (tokenData.refresh_token) {
          const { encrypted: newEncryptedRefresh, iv: newIv } = await encryptData(tokenData.refresh_token);
          updateData.refresh_token_encrypted = newEncryptedRefresh;
          updateData.encryption_iv = newIv;
        }

        await supabase
          .from('oauth_tokens')
          .update(updateData)
          .eq('marketplace_account_id', account_id);

      } catch (refreshError: any) {
        await logToSyncLogs(supabase, {
          marketplace_account_id: account_id,
          operation: 'oauth_test',
          outcome: 'fail',
          http_status: 500,
          message: 'Refresh error',
          retry_count: 1
        });

        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }
    }

    let identity: eBayIdentityResponse | null = null;
    let privileges: eBayPrivilegesResponse | null = null;
    let retryCount = 0;

    try {
      const identityResponse = await fetch(identityUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (identityResponse.status === 401 && !hasRefreshed) {
        retryCount = 1;

        if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) {
          throw new Error('Token invalid, no refresh available');
        }

        const refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);
        const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const tokenBody = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: tokenRow.scope || ''
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
          throw new Error('Refresh failed on 401 retry');
        }

        const tokenData: eBayTokenResponse = await tokenResponse.json();
        accessToken = tokenData.access_token;
        hasRefreshed = true;

        const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        let updateData: any = {
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        };

        if (tokenData.refresh_token) {
          const { encrypted: newEncryptedRefresh, iv: newIv } = await encryptData(tokenData.refresh_token);
          updateData.refresh_token_encrypted = newEncryptedRefresh;
          updateData.encryption_iv = newIv;
        }

        await supabase
          .from('oauth_tokens')
          .update(updateData)
          .eq('marketplace_account_id', account_id);

        const retryIdentityResponse = await fetch(identityUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!retryIdentityResponse.ok) {
          throw new Error(`Identity API failed after retry: ${retryIdentityResponse.status}`);
        }

        identity = await retryIdentityResponse.json();

      } else if (!identityResponse.ok) {
        throw new Error(`Identity API failed: ${identityResponse.status}`);
      } else {
        identity = await identityResponse.json();
      }

      const privilegeResponse = await fetch(privilegeUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (privilegeResponse.status === 401 && !hasRefreshed) {
        retryCount = 1;

        if (!tokenRow.refresh_token_encrypted || !tokenRow.encryption_iv) {
          throw new Error('Token invalid, no refresh available');
        }

        const refreshToken = await decryptData(tokenRow.refresh_token_encrypted, tokenRow.encryption_iv);
        const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const tokenBody = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: tokenRow.scope || ''
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
          throw new Error('Refresh failed on 401 retry');
        }

        const tokenData: eBayTokenResponse = await tokenResponse.json();
        accessToken = tokenData.access_token;
        hasRefreshed = true;

        const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        let updateData: any = {
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        };

        if (tokenData.refresh_token) {
          const { encrypted: newEncryptedRefresh, iv: newIv } = await encryptData(tokenData.refresh_token);
          updateData.refresh_token_encrypted = newEncryptedRefresh;
          updateData.encryption_iv = newIv;
        }

        await supabase
          .from('oauth_tokens')
          .update(updateData)
          .eq('marketplace_account_id', account_id);

        const retryPrivilegeResponse = await fetch(privilegeUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!retryPrivilegeResponse.ok) {
          throw new Error(`Privilege API failed after retry: ${retryPrivilegeResponse.status}`);
        }

        privileges = await retryPrivilegeResponse.json();

      } else if (!privilegeResponse.ok) {
        throw new Error(`Privilege API failed: ${privilegeResponse.status}`);
      } else {
        privileges = await privilegeResponse.json();
      }

      await logToSyncLogs(supabase, {
        marketplace_account_id: account_id,
        operation: 'oauth_test',
        outcome: retryCount > 0 ? 'retry' : 'ok',
        http_status: 200,
        message: 'Connection test successful',
        retry_count: retryCount
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          identity: {
            userId: identity?.userId || '',
            username: identity?.username || '',
            registrationMarketplaceId: identity?.registrationMarketplaceId || ''
          },
          privileges: {
            sellerRegistrationCompleted: privileges?.sellerRegistrationCompleted || false,
            sellingLimit: privileges?.sellingLimit || null
          }
        })
      };

    } catch (apiError: any) {
      await logToSyncLogs(supabase, {
        marketplace_account_id: account_id,
        operation: 'oauth_test',
        outcome: 'fail',
        http_status: 502,
        message: 'eBay API error',
        retry_count: retryCount
      });

      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'ebay_unavailable' })
      };
    }

  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
