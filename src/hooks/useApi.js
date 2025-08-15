// src/hooks/useApi.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const useApi = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const handleAuthError = (evt) => {
      const detail = evt?.detail || {};
      const status = detail.status;
      // Only force logout on 401/403. For 5xx, keep the session and show a soft redirect if needed.
      if (status === 401 || status === 403) {
        logout();
        navigate('/login', { state: { from: window.location.pathname } });
      } else {
        // For non-auth errors, do nothing here. Components can surface errors locally.
        // Optionally, we could show a toast.
      }
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, [logout, navigate]);

  // The hook now doesn't return anything, it just sets up a global listener.
  // We can call this hook in a central place like App.jsx to ensure it's active.
};

export default useApi;