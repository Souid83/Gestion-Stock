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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  const RBAC_BYPASS = process.env.RBAC_DISABLED === "true";
  if (RBAC_BYPASS) {
    console.log("⚙️ RBAC bypass activé pour marketplaces-accounts");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: event.headers.authorization || ''
      }
    }
  });
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    if (RBAC_BYPASS) {
      const providerRBAC = (event.queryStringParameters?.provider || 'ebay').toLowerCase();

      const { data, error } = await supabase
        .from("marketplace_accounts")
        .select("*")
        .eq("provider", providerRBAC)
        .eq("is_active", true)
        .order('created_at', { ascending: false });
      if (error) {
        console.error("❌ Supabase error:", error);
        return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error }) };
      }

      // Tokens: get latest per account_id (order desc, take first seen)
      const ids = (data || []).map(a => a && a.id).filter(Boolean);
      const { data: tokens } = await supabaseService
        .from('oauth_tokens')
        .select('marketplace_account_id, created_at, access_token')
        .in('marketplace_account_id', ids)
        .neq('access_token', 'pending')
        .order('created_at', { ascending: false });

      const hasToken = new Set<string>();
      (tokens || []).forEach(t => {
        if (t && t.marketplace_account_id && !hasToken.has(t.marketplace_account_id)) {
          hasToken.add(t.marketplace_account_id);
        }
      });

      // Group by provider_account_id and pick canonical id (prefer one with token)
      const groups = new Map<string, any[]>();
      for (const a of (data || [])) {
        if (!a || !a.provider_account_id) continue;
        const key = a.provider_account_id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(a);
      }

      const accounts = [];
      for (const [key, accs] of groups.entries()) {
        // accs are already ordered by created_at desc
        const withToken = accs.find(x => x && x.id && hasToken.has(x.id));
        const canonical = withToken || accs[0];
        if (!canonical) continue;
        accounts.push({
          id: canonical.id,
          display_name: canonical.display_name,
          environment: canonical.environment,
          provider_account_id: canonical.provider_account_id,
          connected: Boolean(withToken)
        });
      }

      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ accounts }) };
    }

    const isAdmin = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return {
        statusCode: 403,
        headers: JSON_HEADERS,
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
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'bad_request', hint: 'Provider parameter is required' })
      };
    }

    const { data: accounts, error } = await supabase
      .from('marketplace_accounts')
      .select('id, display_name, environment, provider_account_id, needs_reauth')
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
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'server_error' })
      };
    }

    // Fetch latest tokens per account_id and build hasToken set
    const acctIds = (accounts || []).map(a => a && a.id).filter(Boolean);
    const { data: tokens } = await supabaseService
      .from('oauth_tokens')
      .select('marketplace_account_id, created_at, access_token')
      .in('marketplace_account_id', acctIds)
      .neq('access_token', 'pending')
      .order('created_at', { ascending: false });

    const hasToken = new Set<string>();
    (tokens || []).forEach(t => {
      if (t && t.marketplace_account_id && !hasToken.has(t.marketplace_account_id)) {
        hasToken.add(t.marketplace_account_id);
      }
    });

    // Group by provider_account_id and pick canonical id (prefer one with token)
    const groups = new Map<string, any[]>();
    for (const a of (accounts || [])) {
      if (!a || !a.provider_account_id) continue;
      const key = a.provider_account_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }

    const resultAccounts: any[] = [];
    for (const [key, accs] of groups.entries()) {
      // accounts already ordered by created_at desc in the query
      const withToken = accs.find(x => x && x.id && hasToken.has(x.id));
      const canonical = withToken || accs[0];
      if (!canonical) continue;
      resultAccounts.push({
        id: canonical.id,
        display_name: canonical.display_name,
        environment: canonical.environment,
        provider_account_id: canonical.provider_account_id,
        connected: Boolean(withToken),
        needs_reauth: Boolean((canonical as any)?.needs_reauth)
      });
    }

    await logToSyncLogs(supabase, provider, 'accounts_list', 'ok', {
      http_status: 200,
      message: `Retrieved ${resultAccounts.length} accounts`
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        accounts: resultAccounts
      })
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
