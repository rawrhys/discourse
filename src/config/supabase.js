import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

// Create a mock Supabase client since we're using backend authentication
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (callback) => {
      // Return a mock subscription
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut: async () => ({ error: null }),
    signUp: async () => {
      throw new Error('Supabase signup is disabled. Use backend registration instead.');
    }
  },
  supabaseUrl,
  supabaseKey: supabaseAnonKey
};

// Expose URL and key for direct API calls
supabase.supabaseUrl = supabaseUrl;
supabase.supabaseKey = supabaseAnonKey;

// Debug logging
console.log('🔧 [SUPABASE] Client initialized with URL:', supabaseUrl);
console.log('🔧 [SUPABASE] Environment variables:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***' : 'NOT_SET'
});

export default supabase;
