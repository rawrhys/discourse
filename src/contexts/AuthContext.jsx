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
          // Preflight check with backend to ensure account wasn't deleted
          try {
            const resp = await fetch('/api/auth/can-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user?.email })
            });
            const data = resp.ok ? await resp.json() : { allowed: true };
            if (data && data.allowed === false) {
              await supabase.auth.signOut();
              try { localStorage.removeItem('token'); } catch {}
            } else {
              setUser(session.user);
              if (session.access_token) {
                try { localStorage.setItem('token', session.access_token); } catch {}
              }
            }
          } catch (e) {
            // If preflight fails, keep user but backend will still enforce on API calls
            setUser(session.user);
            if (session.access_token) {
              try { localStorage.setItem('token', session.access_token); } catch {}
            }
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
          try {
            const resp = await fetch('/api/auth/can-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user?.email })
            });
            const data = resp.ok ? await resp.json() : { allowed: true };
            if (data && data.allowed === false) {
              await supabase.auth.signOut();
              setUser(null);
              try { localStorage.removeItem('token'); } catch {}
            } else {
              setUser(session.user);
              if (session.access_token) {
                try { localStorage.setItem('token', session.access_token); } catch {}
              }
            }
          } catch (e) {
            // On preflight failure, fall back to letting backend enforce
            setUser(session.user);
            if (session.access_token) {
              try { localStorage.setItem('token', session.access_token); } catch {}
            }
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

  const login = async (email, password, captchaToken) => {
    try {
      console.log('🔧 [AUTH] Starting login for:', email);
      
      // Mandatory preflight check against backend deletion list (fail-closed)
      const resp = await fetch('/api/auth/can-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!resp.ok) {
        throw new Error('Login temporarily unavailable. Please try again shortly.');
      }
      const pre = await resp.json();
      if (!pre.allowed) {
        throw new Error('This account has been deleted.');
      }

      // Skip Supabase authentication for login (captcha not required)
      // Go directly to backend authentication
      console.log('🔧 [AUTH] Skipping Supabase authentication, using backend directly...');

      // Use backend login endpoint directly
      console.log('🔧 [AUTH] Using backend authentication...');
      const loginResp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken })
      });

      if (!loginResp.ok) {
        const errorData = await loginResp.json();
        
        // Handle email verification requirement
        if (errorData.code === 'EMAIL_NOT_CONFIRMED') {
          throw new Error('Please confirm your email address before signing in. Check your inbox and spam folder for the confirmation link.');
        }
        
        throw new Error(errorData.error || 'Login failed');
      }

      const loginData = await loginResp.json();
      
      // Create a user object that matches Supabase format
      const user = {
        id: loginData.user.id,
        email: loginData.user.email,
        user_metadata: { name: loginData.user.name }
      };

      setUser(user);
      
      // Store token
      if (loginData.token) {
        try { localStorage.setItem('token', loginData.token); } catch {}
      }
      
      return { user, session: { access_token: loginData.token } };
    } catch (error) {
      console.error('🔧 [AUTH] Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, name, options = {}) => {
    try {
      console.log('🔧 [AUTH] Starting registration for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name,
            gdpr_policy_version: options.policyVersion || '1.0',
            gdpr_consent_at: new Date().toISOString()
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
          ...(options.captchaToken ? { captchaToken: options.captchaToken } : {}),
        }
      });

      if (error) {
        console.error('🔧 [AUTH] Registration error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        console.log('🔧 [AUTH] Registration successful, user:', data.user.id);
        console.log('🔧 [AUTH] Email confirmed:', data.user.email_confirmed_at);
        
        // Don't set user immediately if email confirmation is required
        if (data.user.email_confirmed_at) {
          console.log('🔧 [AUTH] Email already confirmed, setting user immediately');
          setUser(data.user);
          if (data.session?.access_token) {
            try { localStorage.setItem('token', data.session.access_token); } catch {}
          }
        } else {
          console.log('🔧 [AUTH] Email confirmation required, user not set yet');
        }
        
        const requiresEmailConfirmation = !data.user.email_confirmed_at;
        console.log('🔧 [AUTH] Requires email confirmation:', requiresEmailConfirmation);
        
        return { 
          user: data.user, 
          session: data.session, 
          requiresEmailConfirmation 
        };
      } else {
        throw new Error('No user data returned from registration');
      }
    } catch (error) {
      console.error('🔧 [AUTH] Registration error:', error);
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