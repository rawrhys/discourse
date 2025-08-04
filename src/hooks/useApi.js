// src/hooks/useApi.js
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const useApi = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const apiFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4002';
    const fullUrl = `${apiBaseUrl}${url}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(fullUrl, config);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Token is invalid or expired
          logout(); // Clear user session
          navigate('/login', { state: { from: window.location.pathname } });
          // Throw an error to stop further processing in the calling function
          throw new Error('Session expired. Please log in again.');
        }
        // For other errors, try to parse the error message from the body
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || response.statusText;
        throw new Error(errorMessage);
      }

      // If response is ok, but has no content
      if (response.status === 204) {
        return null;
      }
      
      return await response.json();

    } catch (error) {
      console.error('API Fetch Error:', error);
      // Re-throw the error so the calling component can handle it if needed
      throw error;
    }
  }, [logout, navigate]);

  return apiFetch;
};

export default useApi; 