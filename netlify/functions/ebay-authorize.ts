export const handler = async (event) => {
  const { createClient } = await import('@supabase/supabase-js');

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const qs = event.queryStringParameters || {};
    const account_id = qs.account_id || qs.state;
    if (!account_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'missing_account_id' }) };
    }

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('id, client_id, runame, environment, provider, is_active')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();

    if (accErr || !account || !account.client_id || !account.runame) {
      return { statusCode: 404, body: JSON.stringify({ error: 'account_or_settings_not_found' }) };
    }

    const isSandbox = account.environment === 'sandbox';
    const authHost = isSandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';

    // Scopes lecture minimum (Vague A)
    const scopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
      'https://api.ebay.com/oauth/api_scope/sell.account.readonly'
    ].join(' ');

    const authUrl =
      `${authHost}/oauth2/authorize?` +
      `client_id=${encodeURIComponent(account.client_id)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(account.runame)}` + // RUName EXACT
      `&scope=${encodeURIComponent(scopes)}` +
      `&prompt=login` +
      `&state=${encodeURIComponent(account.id)}`;

    return { statusCode: 302, headers: { Location: authUrl } };
  } catch (err) {
    console.error('authorize_fatal', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: 'authorize_server_error', detail: err?.message || 'unknown' }) };
  }
};
