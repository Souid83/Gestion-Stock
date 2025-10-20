import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SECRET_KEY = process.env.SECRET_KEY || '';

interface eBayInventoryItem {
  sku: string;
  product?: {
    title?: string;
    price?: {
      value?: string;
      currency?: string;
    };
  };
}

interface eBayInventoryResponse {
  inventoryItems?: eBayInventoryItem[];
  total?: number;
  size?: number;
}

interface OAuthTokenRow {
  id: string;
  marketplace_account_id: string;
  access_token: string;
  refresh_token_encrypted: string | null;
  encryption_iv: string | null;
  expires_at: string;
  scope: string | null;
  updated_at: string;
}

interface MarketplaceAccount {
  id: string;
  user_id: string;
  provider: string;
  environment: string;
  is_active: boolean;
}

function decryptToken(encrypted: string, secret: string): string {
  console.log('🔓 Decrypting refresh token...');
  const parsed = JSON.parse(encrypted);
  const iv = Buffer.from(parsed.iv, 'hex');
  const tag = Buffer.from(parsed.tag, 'hex');
  const data = Buffer.from(parsed.data, 'hex');
  const key = crypto.scryptSync(secret, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptToken(token: string, secret: string): string {
  console.log('🔐 Encrypting new refresh token...');
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(secret, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: enc.toString('hex'),
  });
}

async function logToSyncLogs(
  supabase: any,
  details: {
    marketplace_account_id?: string;
    provider: string;
    operation: string;
    outcome: 'ok' | 'fail';
    http_status: number;
    error_code?: string;
    message?: string;
  }
) {
  console.log(`📋 Logging to sync_logs: ${details.operation} - ${details.outcome}`);
  await supabase.from('sync_logs').insert({
    marketplace_account_id: details.marketplace_account_id || null,
    provider: details.provider,
    operation: details.operation,
    outcome: details.outcome,
    http_status: details.http_status,
    error_code: details.error_code || null,
    message: details.message || null,
    metadata: {}
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

async function refreshAccessToken(
  supabase: any,
  tokenRow: OAuthTokenRow,
  clientId: string,
  clientSecret: string
): Promise<string> {
  console.log('🔄 Token expired, attempting refresh...');

  if (!tokenRow.refresh_token_encrypted) {
    console.error('❌ No refresh token available');
    throw new Error('No refresh token available');
  }

  const refreshToken = decryptToken(tokenRow.refresh_token_encrypted, SECRET_KEY);
  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account'
  });

  console.log('🌐 Requesting new token from eBay...');
  const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: tokenBody.toString()
  });

  const tokenText = await tokenResponse.text();
  console.log(`📥 eBay token response status: ${tokenResponse.status}`);

  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    console.error('❌ Failed to parse token response:', tokenText);
    throw new Error('Token refresh failed: invalid JSON response');
  }

  if (!tokenResponse.ok) {
    console.error('❌ Token refresh failed:', tokenData);
    throw new Error(tokenData.error || 'Token refresh failed');
  }

  const newAccessToken = tokenData.access_token;
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString();

  let updateData: any = {
    access_token: newAccessToken,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString()
  };

  if (tokenData.refresh_token) {
    updateData.refresh_token_encrypted = encryptToken(tokenData.refresh_token, SECRET_KEY);
  }

  console.log('💾 Updating access token in database...');
  const { error: updateError } = await supabase
    .from('oauth_tokens')
    .update(updateData)
    .eq('marketplace_account_id', tokenRow.marketplace_account_id);

  if (updateError) {
    console.error('❌ Failed to update token in database:', updateError);
    throw new Error('Failed to update token');
  }

  console.log('✅ Token refreshed successfully');
  return newAccessToken;
}

export const handler = async (event: NetlifyEvent, context: NetlifyContext): Promise<NetlifyResponse> => {
  console.log('🚀 marketplaces-listings function triggered');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (event.httpMethod !== 'GET') {
      console.log('❌ Invalid HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    const hasAccess = await checkRBAC(supabase);
    if (!hasAccess) {
      console.log('❌ Access denied: user is not admin');
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'forbidden' })
      };
    }

    const { account_id } = event.queryStringParameters || {};

    if (!account_id) {
      console.log('❌ Missing account_id parameter');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'missing_account_id' })
      };
    }

    console.log(`🔍 Looking up marketplace account: ${account_id}`);

    const { data: account, error: accountError } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('environment', 'production')
      .eq('is_active', true)
      .maybeSingle();

    if (accountError || !account) {
      console.error('❌ Marketplace account not found or inactive');
      await logToSyncLogs(supabaseService, {
        marketplace_account_id: account_id,
        provider: 'ebay',
        operation: 'fetch_listings',
        outcome: 'fail',
        http_status: 404,
        error_code: 'account_not_found',
        message: 'Marketplace account not found or inactive'
      });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'account_not_found' })
      };
    }

    console.log('✅ Marketplace account found:', account.id);
    console.log('🔍 Fetching OAuth token...');

    const { data: tokenRow, error: tokenError } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      console.error('❌ No OAuth token found for this account');
      await logToSyncLogs(supabaseService, {
        marketplace_account_id: account_id,
        provider: 'ebay',
        operation: 'fetch_listings',
        outcome: 'fail',
        http_status: 424,
        error_code: 'token_missing',
        message: 'No OAuth token found'
      });
      return {
        statusCode: 424,
        body: JSON.stringify({ error: 'token_missing' })
      };
    }

    console.log('✅ OAuth token found');

    const clientId = process.env.EBAY_APP_ID || '';
    const clientSecret = process.env.EBAY_CERT_ID || '';

    if (!clientId || !clientSecret) {
      console.error('❌ eBay credentials not configured');
      await logToSyncLogs(supabaseService, {
        marketplace_account_id: account_id,
        provider: 'ebay',
        operation: 'fetch_listings',
        outcome: 'fail',
        http_status: 500,
        error_code: 'credentials_missing',
        message: 'eBay credentials not configured'
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    let accessToken = tokenRow.access_token;
    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);

    if (now >= expiresAt) {
      console.log('⚠️ Token expired, refreshing...');
      try {
        accessToken = await refreshAccessToken(supabaseService, tokenRow as OAuthTokenRow, clientId, clientSecret);
      } catch (refreshError: any) {
        console.error('❌ Token refresh failed:', refreshError.message);
        await logToSyncLogs(supabaseService, {
          marketplace_account_id: account_id,
          provider: 'ebay',
          operation: 'fetch_listings',
          outcome: 'fail',
          http_status: 401,
          error_code: 'token_refresh_failed',
          message: refreshError.message
        });
        return {
          statusCode: 401,
          body: JSON.stringify({
            error: 'token_refresh_failed',
            detail: refreshError.message
          })
        };
      }
    }

    console.log('🌐 Calling eBay Inventory API...');
    const ebayApiUrl = 'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=50';

    let response = await fetch(ebayApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📥 eBay API response status: ${response.status}`);

    if (response.status === 401) {
      console.log('⚠️ Received 401, attempting token refresh...');
      try {
        accessToken = await refreshAccessToken(supabaseService, tokenRow as OAuthTokenRow, clientId, clientSecret);

        console.log('🔄 Retrying eBay API call with new token...');
        response = await fetch(ebayApiUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`📥 Retry response status: ${response.status}`);
      } catch (refreshError: any) {
        console.error('❌ Token refresh failed on 401:', refreshError.message);
        await logToSyncLogs(supabaseService, {
          marketplace_account_id: account_id,
          provider: 'ebay',
          operation: 'fetch_listings',
          outcome: 'fail',
          http_status: 401,
          error_code: 'token_refresh_failed',
          message: refreshError.message
        });
        return {
          statusCode: 401,
          body: JSON.stringify({
            error: 'token_refresh_failed',
            detail: refreshError.message
          })
        };
      }
    }

    const text = await response.text();
    console.log('📄 eBay raw response received, length:', text.length);

    let data: eBayInventoryResponse;
    try {
      data = JSON.parse(text);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse eBay response as JSON:', text.substring(0, 200));
      await logToSyncLogs(supabaseService, {
        marketplace_account_id: account_id,
        provider: 'ebay',
        operation: 'fetch_listings',
        outcome: 'fail',
        http_status: 502,
        error_code: 'invalid_json',
        message: 'eBay returned non-JSON response'
      });
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'invalid_json',
          raw: text.substring(0, 500)
        })
      };
    }

    if (!response.ok) {
      console.error('❌ eBay API error:', data);
      await logToSyncLogs(supabaseService, {
        marketplace_account_id: account_id,
        provider: 'ebay',
        operation: 'fetch_listings',
        outcome: 'fail',
        http_status: response.status,
        error_code: 'ebay_api_error',
        message: 'eBay API returned error'
      });
      return {
        statusCode: response.status,
        body: JSON.stringify({ ebay_error: data })
      };
    }

    console.log('📦 Processing eBay inventory items...');
    const items = (data.inventoryItems || []).map((item) => ({
      provider: 'ebay',
      marketplace_account_id: account_id,
      remote_id: item.sku,
      remote_sku: item.sku,
      title: item.product?.title || '',
      price_amount: item.product?.price?.value ? parseFloat(item.product.price.value) : null,
      price_currency: item.product?.price?.currency || 'EUR',
      status_sync: 'unmapped',
      updated_at: new Date().toISOString()
    }));

    console.log(`📊 Transformed ${items.length} items for upsert`);

    if (items.length > 0) {
      console.log('💾 Upserting items to marketplace_listings...');
      const { error: upsertError } = await supabaseService
        .from('marketplace_listings')
        .upsert(items, {
          onConflict: 'provider,marketplace_account_id,remote_id'
        });

      if (upsertError) {
        console.error('❌ Failed to upsert listings:', upsertError);
        await logToSyncLogs(supabaseService, {
          marketplace_account_id: account_id,
          provider: 'ebay',
          operation: 'fetch_listings',
          outcome: 'fail',
          http_status: 500,
          error_code: 'upsert_failed',
          message: 'Failed to save listings to database'
        });
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'upsert_failed' })
        };
      }
      console.log('✅ Listings upserted successfully');
    } else {
      console.log('ℹ️ No items to upsert');
    }

    await logToSyncLogs(supabaseService, {
      marketplace_account_id: account_id,
      provider: 'ebay',
      operation: 'fetch_listings',
      outcome: 'ok',
      http_status: 200,
      message: `Successfully fetched ${items.length} items`
    });

    console.log('✅ Operation completed successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        count: items.length,
        total: data.total || items.length
      })
    };

  } catch (error: any) {
    console.error('🔥 Fatal error in marketplaces-listings:', error);
    await logToSyncLogs(supabaseService, {
      provider: 'ebay',
      operation: 'fetch_listings',
      outcome: 'fail',
      http_status: 500,
      error_code: 'server_error',
      message: error.message
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error', detail: error.message })
    };
  }
};
