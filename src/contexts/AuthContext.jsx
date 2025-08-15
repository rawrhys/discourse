import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api'; // We'll use our API client

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          return currentUser;
        } else {
          // If getCurrentUser returns null (401 error handled in apiClient), clear the token
          console.warn('⚠️ [AUTH] getCurrentUser returned null, clearing token');
          localStorage.removeItem('token');
          setUser(null);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      
      // Handle cases where the server returns a non-JSON response (e.g., HTML error page from a proxy)
      // for what should be a JSON endpoint. This is a common issue with authentication checks.
      if (error.message === 'Server returned invalid JSON response' || (error && (error.status === 401 || error.status === 403))) {
        localStorage.removeItem('token');
        setUser(null);
      } else {
        // Keep token; just log. The UI can handle retries for server-side (5xx) or network errors.
        console.warn('Keeping auth token despite refresh error (likely a temporary server issue)');
      }
      return null;
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const currentUser = await api.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // If getCurrentUser returns null, clear the token
            console.warn('⚠️ [AUTH] getCurrentUser returned null during check, clearing token');
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
          // Only clear token for explicit auth failures or invalid server responses on this critical path.
          if (error.message === 'Server returned invalid JSON response' || (error && (error.status === 401 || error.status === 403))) {
            localStorage.removeItem('token');
            setUser(null);
          } else {
            // Keep the session on server/network issues
            console.warn('Keeping auth token after user check error (non-auth error)');
          }
        }
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.login(email, password);
      localStorage.setItem('token', response.token);
      // Extract the user data from the response
      setUser(response.user);
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, name, options = {}) => {
    try {
      const response = await api.register(email, password, name, options);
      localStorage.setItem('token', response.token);
      // Extract the user data from the response
      setUser(response.user);
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, refreshUser }}>
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