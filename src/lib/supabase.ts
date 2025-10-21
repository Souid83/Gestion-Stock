import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please check your .env file.');
}

/**
 * Dev-only fetch instrumentation to trace accidental CSV bulk uploads (PostgREST ?columns= or text/csv)
 * This helps identify the exact initiator (stack trace) of unwanted bulk CSV requests.
 * It logs a trace when:
 *   - URL targets /rest/v1/products AND
 *   - query contains columns= OR method=POST with Content-Type: text/csv
 *
 * You can hard-block these requests by setting in the DevTools console:
 *   window.__blockCsvUploads = true
 */
if (import.meta.env.DEV && typeof window !== 'undefined' && !(window as any).__supabaseFetchInstrumented) {
  (window as any).__supabaseFetchInstrumented = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method =
        (init?.method ||
          (typeof input !== 'string' && (input as Request).method) ||
          'GET').toString().toUpperCase();
      const headers = new Headers(
        init?.headers || (typeof input !== 'string' ? (input as Request).headers : undefined)
      );
      const contentType = headers.get('content-type') || headers.get('Content-Type') || '';
      const isProductsEndpoint = url.includes('/rest/v1/products');
      const hasColumnsParam = /[?&]columns=/.test(url);
      const isCsv =
        /text\/csv/i.test(contentType) ||
        /\.csv(\?|$)/i.test(url);

      if (isProductsEndpoint && (hasColumnsParam || (method === 'POST' && isCsv))) {
        console.groupCollapsed('%c[TRACE] PostgREST CSV/columns= detected', 'color:#b91c1c;font-weight:bold');
        console.log('URL:', url);
        console.log('Method:', method);
        console.log('Headers:', Object.fromEntries(headers.entries()));
        try {
          // Best-effort to show body for JSON requests (avoid consuming the stream)
          const bodyPreview =
            init && typeof init.body === 'string' && init.body.length <= 2000
              ? init.body
              : (typeof init?.body === 'object' ? '[object body]' : '(no preview)');
          console.log('Body (preview):', bodyPreview);
        } catch {}
        console.trace('Initiator stack trace');
        console.groupEnd();

        // Optional: hard block in dev if needed
        if ((window as any).__blockCsvUploads === true) {
          console.warn('[BLOCKED] CSV bulk upload blocked by __blockCsvUploads');
          return Promise.reject(new Error('CSV bulk upload blocked in dev by instrumentation'));
        }
      }
    } catch {
      // ignore instrumentation errors
    }
    return originalFetch(input as any, init as any);
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'supabase-auth',
    storage: {
      getItem: (key) => {
        try {
          const item = localStorage.getItem(key);
          return item;
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Ignore write errors
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore remove errors
        }
      }
    },
    cookieOptions: {
      name: 'sb-auth-token',
      lifetime: 60 * 60 * 24 * 7, // 7 days
      domain: window.location.hostname,
      path: '/',
      sameSite: 'None',
      secure: true,
      httpOnly: true
    }
  }
});

// Function to check if current user is admin
export const isAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // For now, allow all users to be admin

    const { data, error } = await supabase
      .from('admin_users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error checking admin status:', error);
      return true; // For now, default to admin access
    }

    return (data as any)?.is_admin ?? true; // Default to true if no admin record exists
  } catch (error) {
    console.error('Error in isAdmin check:', error);
    return true; // For now, default to admin access
  }
};

// Function to get current user role
export const getUserRole = async (): Promise<'ROLE_ADMIN' | 'ROLE_USER' | null> => {
  try {
    const isUserAdmin = await isAdmin();
    if (isUserAdmin) return 'ROLE_ADMIN';
    
    const { data: { user } } = await supabase.auth.getUser();
    return user ? 'ROLE_USER' : 'ROLE_ADMIN'; // Default to admin for now
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'ROLE_ADMIN'; // Default to admin for now
  }
};

// Function to create first admin user if none exists
export const setupFirstAdmin = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if any admin exists
    const { data: existingAdmins } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    // If no admins exist, make the current user an admin
    if (!existingAdmins || existingAdmins.length === 0) {
      const { error } = await supabase
        .from('admin_users')
        .insert([
          { id: user.id, is_admin: true }
        ]);

      if (error) {
        console.error('Error creating first admin:', error);
      }
    }
  } catch (error) {
    console.error('Error in setupFirstAdmin:', error);
  }
};

// Product embedding generation function
interface ProductEmbeddingInput {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
}

export const generateProductEmbedding = async (product: ProductEmbeddingInput): Promise<void> => {
  try {
    console.log('Generating embedding for product:', product.id);

    // Combine product fields for embedding
    const textToEmbed = [
      product.name,
      product.description || '',
      product.sku
    ].filter(Boolean).join(' ');

    console.log('Text to embed:', textToEmbed);

    // Call Supabase AI API for embedding generation
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: textToEmbed })
    });

    if (!response.ok) {
      throw new Error(`Embedding API returned status ${response.status}`);
    }

    const { embedding } = await response.json();
    console.log('Embedding generated, length:', embedding?.length);

    // Store embedding in product_embeddings table
    const { error: insertError } = await supabase
      .from('product_embeddings')
      .upsert({
        product_id: product.id,
        embedding: embedding,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'product_id'
      });

    if (insertError) {
      console.error('Error storing embedding:', insertError);
      throw insertError;
    }

    console.log('Embedding stored successfully for product:', product.id);
  } catch (error) {
    console.error('Error generating product embedding:', error);
    throw error;
  }
};
