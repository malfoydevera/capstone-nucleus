import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Password recovery relies on these being present. Fail loudly during dev.
  console.error(
    'Missing Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend .env'
  );
}

// This client is used ONLY for the Supabase-native password flow
// (resetPasswordForEmail + the recovery session on /reset-password).
// The rest of the app authenticates through the Express API, so we keep this
// session isolated under a dedicated storage key and never auto-refresh it.
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
