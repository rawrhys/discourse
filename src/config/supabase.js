import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Debug logging
console.log('🔧 [SUPABASE] Client initialized with URL:', supabaseUrl);
console.log('🔧 [SUPABASE] Environment variables:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***' : 'NOT_SET'
});

// Validate API key format
if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (key.includes('\n') || key.includes(' ')) {
    console.error('❌ [SUPABASE] API key contains line breaks or spaces - this will cause authentication errors!');
  } else {
    console.log('✅ [SUPABASE] API key format looks correct');
  }
} else {
  console.error('❌ [SUPABASE] VITE_SUPABASE_ANON_KEY is not set!');
}

export default supabase;
