// src/config/api.js

// Dynamic API_BASE_URL based on environment
const inferDefaultBaseUrl = () => {
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const port = window.location.port;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      
      // Always use local server when running on localhost (any port)
      if (isLocalhost) {
        return 'http://localhost:4003';
      }
      
      // For production, check if we're on the same domain as the API
      // If frontend and backend are on the same domain, use relative URLs
      if (hostname === 'thediscourse.ai' || hostname === 'api.thediscourse.ai') {
        return ''; // Use relative URLs for same-domain deployment
      }
      
      // For other cases, default to local server for development
      return 'http://localhost:4003';
    }
  } catch (_) {}
  return 'http://localhost:4003'; // Default to local server for development
};

export const API_BASE_URL = inferDefaultBaseUrl();

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