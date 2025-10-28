// Netlify Function: notifications-mark-read
// Endpoint pour marquer une notification comme lue

export const handler = async (event: any) => {
  const requestOrigin = (event?.headers && (event.headers.origin || (event.headers as any).Origin)) || '';
  const frontendOrigin = process.env.FRONTEND_ORIGIN || requestOrigin || '';
  const buildCorsHeaders = () => (frontendOrigin ? {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  } : {});

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...buildCorsHeaders(),
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[notifications-mark-read] Début de la requête');

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          ...buildCorsHeaders(),
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
          ...buildCorsHeaders(),
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
          ...buildCorsHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    console.log('[notifications-mark-read] Utilisateur:', user.id);

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { notification_id } = body;

    if (!notification_id) {
      return {
        statusCode: 400,
        headers: {
          ...buildCorsHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'missing_notification_id' })
      };
    }

    console.log('[notifications-mark-read] Notification ID:', notification_id);

    // Marquer comme lue
    const { error: updateError } = await supabaseService
      .from('notifications')
      .update({ read: true })
      .eq('id', notification_id)
      .eq('user_id', user.id); // Sécurité: seulement ses propres notifications

    if (updateError) {
      console.error('[notifications-mark-read] Erreur mise à jour:', updateError);
      return {
        statusCode: 500,
        headers: {
          ...buildCorsHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'update_error', message: updateError.message })
      };
    }

    console.log('[notifications-mark-read] Notification marquée comme lue');

    return {
      statusCode: 200,
      headers: {
        ...buildCorsHeaders(),
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ ok: true })
    };

  } catch (error: any) {
    console.error('[notifications-mark-read] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: {
        ...buildCorsHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
