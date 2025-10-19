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

interface MarketplaceAccount {
  id: string;
  display_name: string;
  environment: string;
  provider_account_id: string;
}

async function logToSyncLogs(
  supabase: any,
  provider: string,
  operation: string,
  outcome: 'ok' | 'fail',
  details: {
    http_status?: number;
    error_code?: string;
    message?: string;
  }
) {
  await supabase.from('sync_logs').insert({
    provider,
    operation,
    outcome,
    http_status: details.http_status,
    error_code: details.error_code,
    message: details.message || null,
    metadata: {}
  });
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
    if (event.httpMethod !== 'GET') {
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

    const provider = event.queryStringParameters?.provider;

    if (!provider) {
      await logToSyncLogs(supabase, 'unknown', 'accounts_list', 'fail', {
        http_status: 400,
        error_code: 'bad_request',
        message: 'Missing provider parameter'
      });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Provider parameter is required' })
      };
    }

    const { data: accounts, error } = await supabase
      .from('marketplace_accounts')
      .select('id, display_name, environment, provider_account_id')
      .eq('provider', provider)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      await logToSyncLogs(supabase, provider, 'accounts_list', 'fail', {
        http_status: 500,
        error_code: 'server_error',
        message: 'Failed to fetch accounts'
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    await logToSyncLogs(supabase, provider, 'accounts_list', 'ok', {
      http_status: 200,
      message: `Retrieved ${accounts?.length || 0} accounts`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        accounts: accounts || []
      })
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
