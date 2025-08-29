import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Add these options to handle email confirmation better
    emailRedirectTo: `${window.location.origin}/verify-email`,
    // Disable auto-confirm for development if needed
    // confirmEmailRedirectTo: `${window.location.origin}/verify-email`
  }
});

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
