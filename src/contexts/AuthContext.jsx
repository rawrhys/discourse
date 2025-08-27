import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else if (session) {
          setUser(session.user);
          // Store token for downstream services (e.g., SSE)
          if (session.access_token) {
            try { localStorage.setItem('token', session.access_token); } catch {}
          }
        } else {
          try { localStorage.removeItem('token'); } catch {}
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔧 [AUTH] Auth state changed:', event, session?.user?.email);
        
        if (session) {
          setUser(session.user);
          // Persist token for clients that need it (SSE)
          if (session.access_token) {
            try { localStorage.setItem('token', session.access_token); } catch {}
          }
        } else {
          setUser(null);
          try { localStorage.removeItem('token'); } catch {}
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      // Preflight check against backend deletion list
      try {
        const resp = await fetch('/api/auth/can-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.allowed === false) {
            throw new Error('This account has been deleted.');
          }
        }
      } catch (_) { /* non-fatal, continue to Supabase */ }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        setUser(data.user);
        // Store token from fresh login session if available
        if (data.session?.access_token) {
          try { localStorage.setItem('token', data.session.access_token); } catch {}
        }
        return { user: data.user, session: data.session };
      } else {
        throw new Error('No user data returned');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, name, options = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name,
            gdpr_policy_version: options.policyVersion || '1.0',
            gdpr_consent_at: new Date().toISOString()
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Registration error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        setUser(data.user);
        return { user: data.user, session: data.session };
      } else {
        throw new Error('No user data returned');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      // Clear SSE cookie on logout
      try {
        await fetch(`${window.location.origin}/api/auth/clear-sse-cookie`, { method: 'POST' });
      } catch (e) {
        // Non-fatal
      }
      setUser(null);
      try { localStorage.removeItem('token'); } catch {}
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 