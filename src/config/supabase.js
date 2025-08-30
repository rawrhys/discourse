import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

// Completely disable Supabase client - use backend authentication only
export const supabase = {
  auth: {
    getSession: async () => {
      console.warn('⚠️ Supabase getSession called - using backend auth instead');
      return { data: { session: null }, error: null };
    },
    onAuthStateChange: (callback) => {
      console.warn('⚠️ Supabase onAuthStateChange called - using backend auth instead');
      // Return a mock subscription
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut: async () => {
      console.warn('⚠️ Supabase signOut called - using backend auth instead');
      return { error: null };
    },
    signUp: async () => {
      console.error('❌ Supabase signUp called - this should not happen!');
      throw new Error('Supabase signup is completely disabled. Use backend registration instead.');
    },
    signInWithPassword: async () => {
      console.error('❌ Supabase signInWithPassword called - this should not happen!');
      throw new Error('Supabase login is completely disabled. Use backend authentication instead.');
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
