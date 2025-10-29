import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // We deliberately do not throw here to avoid crashing the function import,
  // but any call will fail if env is missing.
  console.warn('[oauth.ts] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Récupère le dernier token OAuth pour un compte marketplace.
 * - Chemin principal: par marketplace_account_id si fourni
 * - Fallback: résout l’account via marketplace_accounts (provider, environment) puis lit oauth_tokens
 * - Ne filtre PAS par des colonnes inexistantes dans oauth_tokens (ex: provider/environment/status)
 * - Renvoie le dernier token (tolérance d’expiration gérée ailleurs)
 */
export async function getOAuthToken({
  accountId,
  provider = 'ebay',
  environment = 'production',
}: {
  accountId?: string;
  provider?: string;
  environment?: 'production' | 'sandbox';
}) {
  const s = supabaseService;

  // 1) Lecture par marketplace_account_id
  if (accountId) {
    const { data, error } = await s
      .from('oauth_tokens')
      .select(
        'id, marketplace_account_id, access_token, refresh_token_encrypted, token_type, scope, expires_at, created_at'
      )
      .eq('marketplace_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data?.length) return data[0];
  }

  // 2) Fallback: résoudre l’accountId via provider/env
  const { data: acc, error: e1 } = await s
    .from('marketplace_accounts')
    .select('id')
    .eq('provider', provider)
    .eq('environment', environment)
    .order('created_at', { ascending: false })
    .limit(1);

  if (e1) throw e1;
  if (!acc?.length) throw new Error('missing_account');

  const resolvedId = acc[0].id;

  const { data: tok, error: e2 } = await s
    .from('oauth_tokens')
    .select(
      'id, marketplace_account_id, access_token, refresh_token_encrypted, token_type, scope, expires_at, created_at'
    )
    .eq('marketplace_account_id', resolvedId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (e2) throw e2;
  if (!tok?.length) throw new Error('missing_token');

  return tok[0];
}
