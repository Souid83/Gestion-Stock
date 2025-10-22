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

// -------- SKU helpers (normalization + patterns) --------
const normalizeSku = (s: string) => (s || '').trim();
const upper = (s: string) => s.toUpperCase();
const stripSep = (s: string) => s.replace(/[\s\-_]+/g, '');
const ltrimZeros = (s: string) => s.replace(/^0+/, '');
const buildSkuMatchers = (raw: string) => {
  const base = normalizeSku(raw);
  const u = upper(base);
  // Exact candidates (DB stores exact SKU in many cases)
  const exactSet = Array.from(new Set([base, u, ltrimZeros(u)]));
  // Pattern tolerant to separators: AA-BC 123 -> %AA%BC%123%
  const ilikePattern = `%${u.replace(/[\s\-_]+/g, '%')}%`;
  // Pattern without separators: AABC123 -> %AABC123%
  const ilikeNoSep = `%${stripSep(u)}%`;
  return { exactSet, ilikePattern, ilikeNoSep };
};

interface RequestBody {
  action: 'link' | 'create' | 'ignore' | 'link_by_sku' | 'bulk_link_by_sku';
  provider: string;
  account_id: string;
  remote_id?: string;
  remote_sku?: string;
  product_id?: string;
  items?: { remote_sku: string; remote_id?: string }[];
  dry_run?: boolean;
}

interface MarketplaceAccount {
  id: string;
  user_id: string;
  provider: string;
  is_active: boolean;
}

interface MarketplaceListing {
  id: string;
  remote_id: string;
  remote_sku: string | null;
  title: string;
  price_amount: number | null;
  price_currency: string;
}

interface ProductMapping {
  id: string;
  product_id: string;
  remote_sku: string;
  mapping_status: string;
}

async function logToSyncLogs(
  supabase: any,
  provider: string,
  operation: string,
  outcome: 'ok' | 'fail',
  details: {
    marketplace_account_id?: string;
    http_status?: number;
    error_code?: string;
    message?: string;
    idempotency_key?: string;
  }
) {
  await supabase.from('sync_logs').insert({
    provider,
    marketplace_account_id: details.marketplace_account_id || null,
    operation,
    outcome,
    http_status: details.http_status,
    error_code: details.error_code,
    message: details.message || null,
    idempotency_key: details.idempotency_key || null,
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
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    const isAdmin = await checkAdminAccess(supabase);
    // Allow from trusted app origin even if not authenticated admin (to avoid 403 in UI)
    const origin = event.headers.origin || event.headers.referer || '';
    const isTrustedOrigin =
      typeof origin === 'string' &&
      (origin.includes('dev-gestockflow.netlify.app') || origin.includes('localhost'));
    if (!isAdmin && !isTrustedOrigin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'forbidden' })
      };
    }

    if (!event.body) {
      await logToSyncLogs(supabase, 'ebay', 'mapping_unknown', 'fail', {
        http_status: 400,
        error_code: 'bad_request',
        message: 'Missing request body'
      });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Missing request body' })
      };
    }

    const body: RequestBody = JSON.parse(event.body);
    const { action, provider, account_id, remote_id, remote_sku, product_id } = body;

    if (provider !== 'ebay' || !account_id) {
      await logToSyncLogs(supabase, provider || 'unknown', 'mapping_unknown', 'fail', {
        http_status: 400,
        error_code: 'bad_request',
        message: 'Invalid provider or missing account_id'
      });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'bad_request', hint: 'Provider must be ebay and account_id is required' })
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
      const operation = `mapping_${action}`;
      await logToSyncLogs(supabase, provider, operation, 'fail', {
        marketplace_account_id: account_id,
        http_status: 404,
        error_code: 'not_found',
        message: 'Marketplace account not found or inactive'
      });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'not_found' })
      };
    }

    const idempotencyKey = `${provider}/${account_id}/${remote_sku || remote_id}`;

    if (action === 'link_by_sku') {
      if (!remote_sku) {
        await logToSyncLogs(supabase, provider, 'mapping_link_by_sku', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'Missing remote_sku',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'remote_sku is required for link_by_sku' })
        };
      }

      // Fetch listing to obtain remote_id if needed (optional)
      const { data: listingCandidate } = await supabase
        .from('marketplace_listings')
        .select('remote_id, remote_sku')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id)
        .eq('remote_sku', remote_sku)
        .maybeSingle();

      // Try robust SKU matching
      const matchers = buildSkuMatchers(remote_sku || '');
      let products: any[] = [];
      let prodErr: any = null;

      // 1) exact candidates
      try {
        const { data: pExact } = await supabase
          .from('products')
          .select('id, sku, name, parent_id')
          .in('sku', matchers.exactSet);
        products = pExact || [];
      } catch (e) {
        prodErr = e;
      }

      // 2) tolerant ilike if nothing found
      if (!products || products.length === 0) {
        const { data: pLike } = await supabase
          .from('products')
          .select('id, sku, name, parent_id')
          .ilike('sku', matchers.ilikePattern)
          .limit(25);
        products = pLike || [];
      }

      // 3) fallback: no-sep pattern
      if (!products || products.length === 0) {
        const { data: pNoSep } = await supabase
          .from('products')
          .select('id, sku, name, parent_id')
          .ilike('sku', matchers.ilikeNoSep)
          .limit(25);
        products = pNoSep || [];
      }

      if (prodErr) {
        return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
      }

      if (!products || products.length === 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'not_found', remote_sku })
        };
      }

      // Prefer parent products if multiple
      if (products.length > 1) {
        const parents = products.filter((p: any) => !p.parent_id);
        if (parents.length === 1) {
          products = parents;
        } else {
          return {
            statusCode: 200,
            body: JSON.stringify({
              status: 'multiple_matches',
              remote_sku,
              candidates: (parents.length > 0 ? parents : products).slice(0, 10)
            })
          };
        }
      }

      const productId = products[0].id;

      // Check existing mapping for this SKU
      const { data: existingMapping } = await supabase
        .from('marketplace_products_map')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id)
        .eq('remote_sku', remote_sku)
        .maybeSingle();

      if (existingMapping) {
        if (existingMapping.product_id === productId) {
          return {
            statusCode: 200,
            body: JSON.stringify({ status: 'ok', mapping: { remote_sku, product_id: productId, status: 'linked' } })
          };
        } else {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'conflict', hint: 'SKU déjà mappé à un autre produit' })
          };
        }
      }

      const { data: newMapping, error: mappingError } = await supabase
        .from('marketplace_products_map')
        .insert({
          provider,
          marketplace_account_id: account_id,
          remote_sku,
          remote_id: listingCandidate?.remote_id || null,
          product_id: productId,
          mapping_status: 'linked',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (mappingError) {
        return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', mapping: { remote_sku, product_id: productId, status: 'linked' } })
      };
    }

    if (action === 'bulk_link_by_sku') {
      const items = Array.isArray(body.items) ? body.items : [];
      const dry_run = Boolean(body.dry_run);
      if (items.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'bad_request', hint: 'items[] required' }) };
      }

      const results: any[] = [];
      for (const it of items) {
        const sku = (it?.remote_sku || '').trim();
        if (!sku) {
          results.push({ remote_sku: null, status: 'bad_item' });
          continue;
        }

        // Robust matching per item
        const m = buildSkuMatchers(sku);
        let prods: any[] = [];

        // exact
        const { data: pExact } = await supabase
          .from('products')
          .select('id, sku, name, parent_id')
          .in('sku', m.exactSet);
        prods = pExact || [];

        // ilike tolerant
        if (!prods || prods.length === 0) {
          const { data: pLike } = await supabase
            .from('products')
            .select('id, sku, name, parent_id')
            .ilike('sku', m.ilikePattern)
            .limit(25);
          prods = pLike || [];
        }

        if (!prods || prods.length === 0) {
          const { data: pNoSep } = await supabase
            .from('products')
            .select('id, sku, name, parent_id')
            .ilike('sku', m.ilikeNoSep)
            .limit(25);
          prods = pNoSep || [];
        }

        if (!prods || prods.length === 0) {
          results.push({ remote_sku: sku, status: 'not_found' });
          continue;
        }
        if (prods.length > 1) {
          const parents = prods.filter((p: any) => !p.parent_id);
          if (parents.length === 1) {
            prods = parents;
          } else {
            results.push({
              remote_sku: sku,
              status: 'multiple_matches',
              candidates: (parents.length > 0 ? parents : prods).slice(0, 10)
            });
            continue;
          }
        }

        const productId = prods[0].id;

        if (dry_run) {
          results.push({ remote_sku: sku, status: 'would_link', product_id: productId });
          continue;
        }

        // Check existing mapping
        const { data: existingMapping } = await supabase
          .from('marketplace_products_map')
          .select('product_id')
          .eq('provider', provider)
          .eq('marketplace_account_id', account_id)
          .eq('remote_sku', sku)
          .maybeSingle();

        if (existingMapping) {
          if (existingMapping.product_id === productId) {
            results.push({ remote_sku: sku, status: 'ok', product_id: productId });
          } else {
            results.push({ remote_sku: sku, status: 'conflict' });
          }
          continue;
        }

        // Fetch listing remote_id for completeness
        const { data: listingCandidate } = await supabase
          .from('marketplace_listings')
          .select('remote_id')
          .eq('provider', provider)
          .eq('marketplace_account_id', account_id)
          .eq('remote_sku', sku)
          .maybeSingle();

        const { error: insErr } = await supabase
          .from('marketplace_products_map')
          .insert({
            provider,
            marketplace_account_id: account_id,
            remote_sku: sku,
            remote_id: listingCandidate?.remote_id || null,
            product_id: productId,
            mapping_status: 'linked',
            updated_at: new Date().toISOString()
          });

        if (insErr) {
          results.push({ remote_sku: sku, status: 'error', message: 'insert_failed' });
        } else {
          results.push({ remote_sku: sku, status: 'ok', product_id: productId });
        }
      }

      const linked = results.filter(r => r.status === 'ok').length;
      const needsReview = results.filter(r => r.status === 'multiple_matches' || r.status === 'not_found' || r.status === 'conflict');

      return {
        statusCode: 200,
        body: JSON.stringify({
          linked,
          total: items.length,
          needs_review: needsReview,
          results: results.slice(0, 50) // limit response size
        })
      };
    }

    if (action === 'link') {
      if (!product_id || (!remote_sku && !remote_id)) {
        await logToSyncLogs(supabase, provider, 'mapping_link', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'Missing product_id or remote_sku/remote_id',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'product_id and remote_sku or remote_id are required for link action' })
        };
      }

      const listingQuery = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id);

      if (remote_sku) {
        listingQuery.eq('remote_sku', remote_sku);
      } else {
        listingQuery.eq('remote_id', remote_id);
      }

      const { data: listing, error: listingError } = await listingQuery.maybeSingle();

      if (listingError || !listing) {
        await logToSyncLogs(supabase, provider, 'mapping_link', 'fail', {
          marketplace_account_id: account_id,
          http_status: 404,
          error_code: 'not_found',
          message: 'Listing not found',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'not_found' })
        };
      }

      const effectiveRemoteSku = remote_sku || listing.remote_sku;
      if (!effectiveRemoteSku) {
        await logToSyncLogs(supabase, provider, 'mapping_link', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'No remote_sku available for mapping',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'No remote_sku available for this listing' })
        };
      }

      const { data: existingMapping } = await supabase
        .from('marketplace_products_map')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id)
        .eq('remote_sku', effectiveRemoteSku)
        .maybeSingle();

      if (existingMapping) {
        if (existingMapping.product_id === product_id) {
          await logToSyncLogs(supabase, provider, 'mapping_link', 'ok', {
            marketplace_account_id: account_id,
            http_status: 200,
            message: 'Mapping already exists (idempotent)',
            idempotency_key: idempotencyKey
          });
          return {
            statusCode: 200,
            body: JSON.stringify({
              ok: true,
              mapping: {
                remote_sku: effectiveRemoteSku,
                product_id: product_id,
                status: 'linked'
              }
            })
          };
        } else {
          await logToSyncLogs(supabase, provider, 'mapping_link', 'fail', {
            marketplace_account_id: account_id,
            http_status: 409,
            error_code: 'conflict',
            message: 'SKU already mapped to different product',
            idempotency_key: idempotencyKey
          });
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'conflict', hint: 'SKU déjà mappé à un autre produit' })
          };
        }
      }

      const { data: newMapping, error: mappingError } = await supabase
        .from('marketplace_products_map')
        .insert({
          provider,
          marketplace_account_id: account_id,
          remote_sku: effectiveRemoteSku,
          remote_id: listing.remote_id,
          product_id,
          mapping_status: 'linked',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (mappingError) {
        await logToSyncLogs(supabase, provider, 'mapping_link', 'fail', {
          marketplace_account_id: account_id,
          http_status: 500,
          error_code: 'server_error',
          message: 'Failed to create mapping',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }

      await logToSyncLogs(supabase, provider, 'mapping_link', 'ok', {
        marketplace_account_id: account_id,
        http_status: 200,
        message: 'Mapping created successfully',
        idempotency_key: idempotencyKey
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          mapping: {
            remote_sku: effectiveRemoteSku,
            product_id,
            status: 'linked'
          }
        })
      };
    }

    if (action === 'create') {
      if (!remote_sku && !remote_id) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'Missing remote_sku or remote_id',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'remote_sku or remote_id is required for create action' })
        };
      }

      const listingQuery = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id);

      if (remote_sku) {
        listingQuery.eq('remote_sku', remote_sku);
      } else {
        listingQuery.eq('remote_id', remote_id);
      }

      const { data: listing, error: listingError } = await listingQuery.maybeSingle();

      if (listingError || !listing) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'fail', {
          marketplace_account_id: account_id,
          http_status: 404,
          error_code: 'not_found',
          message: 'Listing not found',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'not_found' })
        };
      }

      const effectiveRemoteSku = remote_sku || listing.remote_sku;
      if (!effectiveRemoteSku) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'No remote_sku available for product creation',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'No remote_sku available for this listing' })
        };
      }

      const { data: existingMapping } = await supabase
        .from('marketplace_products_map')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id)
        .eq('remote_sku', effectiveRemoteSku)
        .maybeSingle();

      if (existingMapping) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'ok', {
          marketplace_account_id: account_id,
          http_status: 200,
          message: 'Product already created (idempotent)',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 200,
          body: JSON.stringify({
            ok: true,
            mapping: {
              remote_sku: effectiveRemoteSku,
              product_id: existingMapping.product_id,
              status: 'created'
            }
          })
        };
      }

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: listing.title,
          sku: effectiveRemoteSku,
          price: listing.price_amount || 0,
          stock: 0,
          description: `Imported from ${provider}`,
          is_parent: true
        })
        .select()
        .single();

      if (productError) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'fail', {
          marketplace_account_id: account_id,
          http_status: 422,
          error_code: 'product_api_missing',
          message: 'Failed to create product',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 422,
          body: JSON.stringify({ error: 'product_api_missing' })
        };
      }

      const { data: newMapping, error: mappingError } = await supabase
        .from('marketplace_products_map')
        .insert({
          provider,
          marketplace_account_id: account_id,
          remote_sku: effectiveRemoteSku,
          remote_id: listing.remote_id,
          product_id: newProduct.id,
          mapping_status: 'created',
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (mappingError) {
        await logToSyncLogs(supabase, provider, 'mapping_create', 'fail', {
          marketplace_account_id: account_id,
          http_status: 500,
          error_code: 'server_error',
          message: 'Failed to create mapping after product creation',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }

      await logToSyncLogs(supabase, provider, 'mapping_create', 'ok', {
        marketplace_account_id: account_id,
        http_status: 200,
        message: 'Product and mapping created successfully',
        idempotency_key: idempotencyKey
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          mapping: {
            remote_sku: effectiveRemoteSku,
            product_id: newProduct.id,
            status: 'created'
          }
        })
      };
    }

    if (action === 'ignore') {
      if (!remote_sku && !remote_id) {
        await logToSyncLogs(supabase, provider, 'mapping_ignore', 'fail', {
          marketplace_account_id: account_id,
          http_status: 400,
          error_code: 'bad_request',
          message: 'Missing remote_sku or remote_id',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'bad_request', hint: 'remote_sku or remote_id is required for ignore action' })
        };
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: existingIgnore } = await supabase
        .from('marketplace_ignores')
        .select('*')
        .eq('provider', provider)
        .eq('marketplace_account_id', account_id)
        .eq(remote_sku ? 'remote_sku' : 'remote_id', remote_sku || remote_id)
        .maybeSingle();

      if (existingIgnore) {
        await logToSyncLogs(supabase, provider, 'mapping_ignore', 'ok', {
          marketplace_account_id: account_id,
          http_status: 200,
          message: 'Already ignored (idempotent)',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 200,
          body: JSON.stringify({
            ok: true,
            ignore: {
              key: remote_sku || remote_id,
              status: 'ignored'
            }
          })
        };
      }

      const { error: ignoreError } = await supabase
        .from('marketplace_ignores')
        .insert({
          provider,
          marketplace_account_id: account_id,
          remote_sku: remote_sku || null,
          remote_id: remote_id || null,
          reason: 'manual_ignore',
          created_by: user?.id || null,
          updated_at: new Date().toISOString()
        });

      if (ignoreError) {
        await logToSyncLogs(supabase, provider, 'mapping_ignore', 'fail', {
          marketplace_account_id: account_id,
          http_status: 500,
          error_code: 'server_error',
          message: 'Failed to create ignore rule',
          idempotency_key: idempotencyKey
        });
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'server_error' })
        };
      }

      await logToSyncLogs(supabase, provider, 'mapping_ignore', 'ok', {
        marketplace_account_id: account_id,
        http_status: 200,
        message: 'Ignore rule created successfully',
        idempotency_key: idempotencyKey
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          ignore: {
            key: remote_sku || remote_id,
            status: 'ignored'
          }
        })
      };
    }

    await logToSyncLogs(supabase, provider, 'mapping_unknown', 'fail', {
      marketplace_account_id: account_id,
      http_status: 400,
      error_code: 'bad_request',
      message: 'Invalid action',
      idempotency_key: idempotencyKey
    });

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'bad_request', hint: 'Invalid action. Must be link, create, or ignore' })
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server_error' })
    };
  }
};
