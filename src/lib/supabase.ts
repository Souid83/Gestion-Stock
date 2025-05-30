import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please check your .env file.');
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

    return data?.is_admin ?? true; // Default to true if no admin record exists
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