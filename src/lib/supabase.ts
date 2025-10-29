/**
 * Supabase Client Configuration
 * Provides database connection and authentication utilities
 */

import { createClient } from '@supabase/supabase-js';
import { ROLES } from './rbac';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('[Supabase] Initializing client with URL:', supabaseUrl);

// Create and export the Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/**
 * Check if the current user is an administrator
 * @returns Promise<boolean> true if user is ADMIN_FULL
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[Supabase] isAdmin: No user logged in');
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdminUser = profile?.role === ROLES.ADMIN_FULL;
    console.log('[Supabase] isAdmin check:', { userId: user.id, role: profile?.role, isAdmin: isAdminUser });

    return isAdminUser;
  } catch (error) {
    console.error('[Supabase] Error checking admin status:', error);
    return false;
  }
}

/**
 * Setup the first admin user
 * Creates a default MAGASIN profile for the first user if no profile exists
 */
export async function setupFirstAdmin(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[Supabase] setupFirstAdmin: No user logged in');
      return;
    }

    console.log('[Supabase] setupFirstAdmin: Checking profile for user:', user.id);

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[Supabase] setupFirstAdmin: Error fetching profile:', fetchError);
      return;
    }

    if (existingProfile) {
      console.log('[Supabase] setupFirstAdmin: Profile already exists:', existingProfile);
      return;
    }

    // Create default profile with MAGASIN role
    console.log('[Supabase] setupFirstAdmin: Creating default MAGASIN profile');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        role: ROLES.MAGASIN,
        email: user.email
      });

    if (insertError) {
      console.error('[Supabase] setupFirstAdmin: Error creating profile:', insertError);
    } else {
      console.log('[Supabase] setupFirstAdmin: Default profile created successfully');
    }
  } catch (error) {
    console.error('[Supabase] setupFirstAdmin: Unexpected error:', error);
  }
}

/**
 * Get the current user's role
 * @returns Promise<string | null> The user's role or null if not found
 */
export async function getCurrentUserRole(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[Supabase] getCurrentUserRole: No user logged in');
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[Supabase] getCurrentUserRole:', { userId: user.id, role: profile?.role });
    return profile?.role || null;
  } catch (error) {
    console.error('[Supabase] Error getting current user role:', error);
    return null;
  }
}
