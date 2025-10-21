export const handler = async (event) => {
  const { createClient } = await import('@supabase/supabase-js');

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const qs = event.queryStringParameters || {};
    const code = qs.code;
    const account_id = qs.state || qs.account_id;
    if (!code || !account_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'missing_code_or_state' }) };
    }

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('id, provider, environment, client_id, client_secret, runame, is_active')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('is_active', true)
      .maybeSingle();

    if (accErr || !account || !account.client_id || !account.client_secret || !account.runame) {
      return { statusCode: 404, body: JSON.stringify({ error: 'account_or_secrets_not_found' }) };
    }

    const isSandbox = account.environment === 'sandbox';
    const tokenEndpoint = isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

    const basic = Buffer.from(`${account.client_id}:${account.client_secret}`).toString('base64');
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', account.runame); // RUName EXACT

    const resp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('oauth_exchange_failed', resp.status, text.substring(0, 200));
      return { statusCode: 302, headers: { Location: '/pricing?provider=ebay&connected=0&reason=oauth_exchange_failed' }, body: '' };
    }

    let token;
    try { token = JSON.parse(text); } catch {
      console.error('oauth_exchange_invalid_json', text.substring(0, 200));
      return { statusCode: 302, headers: { Location: '/pricing?provider=ebay&connected=0&reason=invalid_json' }, body: '' };
    }

    const access_token = token?.access_token || null;
    const refresh_token = token?.refresh_token || null;
    const expires_in = token?.expires_in || null;
    const scope = token?.scope || null;

    if (!access_token) {
      console.error('oauth_exchange_no_access_token');
      return { statusCode: 302, headers: { Location: '/pricing?provider=ebay&connected=0&reason=no_access_token' }, body: '' };
    }

    await supabaseService.from('oauth_tokens').insert({
      marketplace_account_id: account.id,
      provider: 'ebay',
      environment: isSandbox ? 'sandbox' : 'production',
      access_token,
      refresh_token: refresh_token || null,
      expires_in,
      scopes: scope || null
    });

    const connectedFlag = refresh_token ? '1' : '0';
    const reason = refresh_token ? '' : '&reason=token_missing_refresh';
    return { statusCode: 302, headers: { Location: `/pricing?provider=ebay&connected=${connectedFlag}${reason}` }, body: '' };
  } catch (err) {
    console.error('callback_fatal', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: 'callback_server_error', detail: err?.message || 'unknown' }) };
  }
};
