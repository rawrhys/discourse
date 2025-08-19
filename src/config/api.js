// src/config/api.js

// Dynamic API_BASE_URL based on environment
const inferDefaultBaseUrl = () => {
  // Check for environment variable override first
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('🔧 [API CONFIG] Using VITE_API_BASE_URL from environment:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const port = window.location.port;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isDevServer = port === '5173' || port === '3000' || port === '8080';
      
      if (isLocalhost && isDevServer) {
        // In development, use the Vite dev server proxy
        return ''; // Empty string means use relative URLs, which will be handled by Vite's proxy
      }
      
      // For production, always use the production API URL
      if (hostname === 'thediscourse.ai' || hostname === 'www.thediscourse.ai') {
        return 'https://www.thediscourse.ai';
      }
      
      // For other production domains, use the same domain
      return `https://${hostname}`;
    }
  } catch (_) {}
  return 'https://www.thediscourse.ai'; // Default to production API
};

export const API_BASE_URL = inferDefaultBaseUrl();

// Validate the API URL and provide fallback if needed
const validateApiUrl = () => {
  const url = API_BASE_URL;
  
  // If the URL is pointing to localhost or the old IP, warn and suggest fix
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('31.97.115.145')) {
    console.warn('⚠️ [API CONFIG] API URL points to localhost/old server:', url);
    console.warn('💡 [API CONFIG] This may cause connection issues in production');
    console.warn('💡 [API CONFIG] Consider setting VITE_API_BASE_URL=https://www.thediscourse.ai');
  }
  
  // If we're on the production domain but API URL is not production, warn
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'thediscourse.ai' || window.location.hostname === 'www.thediscourse.ai') &&
      !url.includes('thediscourse.ai')) {
    console.warn('⚠️ [API CONFIG] Production domain but non-production API URL:', url);
  }
};

// Run validation
validateApiUrl();

export const debugApiConfig = () => {
  console.log('🔧 [API CONFIG DEBUG] Current API Configuration:', {
    API_BASE_URL,
    frontendProtocol: typeof window !== 'undefined' ? window.location.protocol : 'n/a',
    frontendHost: typeof window !== 'undefined' ? window.location.host : 'n/a',
    timestamp: new Date().toISOString()
  });
};

export const testBackendConnection = async () => {
  console.log('🔍 [CONNECTION TEST] Testing backend connection...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ [CONNECTION TEST] Backend connection successful:', data);
      return {
        success: true,
        status: response.status,
        data: data
      };
    } else {
      console.warn('⚠️ [CONNECTION TEST] Backend responded with error:', response.status);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        suggestion: 'Check if the backend server is running and accessible'
      };
    }
  } catch (error) {
    console.error('❌ [CONNECTION TEST] Connection failed:', error);
    
    let suggestion = 'Check your internet connection and backend server configuration';
    
    if (String(error.message).includes('Failed to fetch')) {
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && String(API_BASE_URL).startsWith('http:')) {
        suggestion = 'Mixed content error - HTTPS frontend cannot connect to HTTP backend';
      } else {
        suggestion = 'Backend server appears to be unreachable or not running';
      }
    }
    
    return {
      success: false,
      error: error.message,
      suggestion: suggestion
    };
  }
};

// Hint in console about which base URL is being used
try {
  if (typeof window !== 'undefined') {
    console.log(`🔎 API base: ${API_BASE_URL}`);
  }
} catch (_) {} 