// Netlify Function: notifications-list
// Endpoint pour lister les notifications de l'utilisateur

export const handler = async (event: any) => {
  // Fixed CORS origin per requirements (no dynamic origin here)
  const ALLOW_ORIGIN = 'https://dev-gestockflow.netlify.app';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Credentials': 'true'
  };

  // CORS preflight (fixed headers)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      },
      body: ''
    };
  }

  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Validate required env vars to avoid opaque 500s
  const missingEnv: string[] = [];
  if (!SUPABASE_URL) missingEnv.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingEnv.push('VITE_SUPABASE_ANON_KEY');
  if (!SUPABASE_SERVICE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingEnv.length > 0) {
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'missing_env', missing: missingEnv })
    };
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[notifications-list] Début de la requête');

    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    // Authentification
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    const token = authHeader.substring(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    console.log('[notifications-list] Utilisateur:', user.id);

    // Paramètres
    const qs = event.queryStringParameters || {};
    const unreadOnly = qs.unread_only === '1';

    console.log('[notifications-list] Paramètres:', { unreadOnly });

    // Charger les notifications de l'utilisateur + notifications globales
    let query = supabaseService
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error: notifError } = await query;

    if (notifError) {
      console.error('[notifications-list] Erreur chargement notifications:', notifError);
      return {
        statusCode: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'notifications_error', message: notifError.message })
      };
    }

    console.log('[notifications-list] Notifications chargées:', notifications?.length || 0);

    // Compter les non lues
    const unreadCount = (notifications || []).filter((n: any) => !n.read).length;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      },
      body: JSON.stringify({
        ok: true,
        notifications: notifications || [],
        unread_count: unreadCount
      })
    };

  } catch (error: any) {
    console.error('[notifications-list] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
