import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Password recovery relies on these being present. Fail loudly during dev.
  console.error(
    'Missing Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend .env'
  );
}

// Supabase client for auth email flows (recovery email verification, password reset).
// All emails are sent by Supabase Auth's built-in service — no third-party mailers.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'nucleus-recovery-auth',
  },
});

export default supabase;
