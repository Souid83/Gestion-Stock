import { createClient } from '@supabase/supabase-js'

export const handler = async (event) => {
  console.log('🚀 marketplaces-listings (offers) triggered')

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const RBAC_BYPASS = process.env.RBAC_DISABLED === 'true'
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) }
    }

    const { account_id } = event.queryStringParameters || {}
    if (!account_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'missing_account_id' }) }
    }

    const { data: account, error: accErr } = await supabaseService
      .from('marketplace_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('provider', 'ebay')
      .eq('environment', 'production')
      .eq('is_active', true)
      .maybeSingle()
    if (accErr || !account) {
      return { statusCode: 404, body: JSON.stringify({ error: 'account_not_found' }) }
    }

    const { data: tokenRow } = await supabaseService
      .from('oauth_tokens')
      .select('*')
      .eq('marketplace_account_id', account_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!tokenRow) {
      return { statusCode: 424, body: JSON.stringify({ error: 'token_missing' }) }
    }

    const accessToken = tokenRow.access_token
    const ebayApiUrl = 'https://api.ebay.com/sell/inventory/v1/offer?limit=50'
    let response = await fetch(ebayApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US'
      }
    })

    if (response.status === 401) {
      console.warn('⚠️ eBay 401 on offers — token likely expired')
      return { statusCode: 401, body: JSON.stringify({ error: 'token_expired' }) }
    }

    const text = await response.text()
    if (!response.ok) {
      console.error('❌ eBay API error:', text)
      return { statusCode: response.status, body: text }
    }

    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error('❌ invalid JSON', text.substring(0, 200))
      return { statusCode: 502, body: JSON.stringify({ error: 'invalid_json', raw: text }) }
    }

    const items = (data.offers || []).map((offer) => ({
      provider: 'ebay',
      marketplace_account_id: account_id,
      remote_id: offer.offerId,
      remote_sku: offer.sku,
      title: offer.listingDescription || '',
      price_amount: offer.pricingSummary?.price?.value
        ? parseFloat(offer.pricingSummary.price.value)
        : null,
      price_currency: offer.pricingSummary?.price?.currency || 'EUR',
      status_sync: offer.listingStatus || 'UNKNOWN',
      updated_at: new Date().toISOString()
    }))

    if (items.length > 0) {
      const { error: upsertError } = await supabaseService
        .from('marketplace_listings')
        .upsert(items, { onConflict: 'provider,marketplace_account_id,remote_id' })
      if (upsertError) {
        console.error('❌ upsert failed', upsertError)
        return { statusCode: 500, body: JSON.stringify({ error: 'upsert_failed' }) }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        count: items.length
      })
    }
  } catch (err) {
    console.error('🔥 fatal', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: err.message }) }
  }
}
