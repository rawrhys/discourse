// src/config/api.js

// Simple API configuration - use correct endpoints
const inferDefaultBaseUrl = () => {
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      if (isLocalhost) return '';

      // For production, use the correct API endpoint
      return '';
    }
  } catch (_) {}
  return '';
};

// Force API_BASE_URL to use correct endpoint for production (no trailing /api)
let resolvedBaseUrl = 'https://thediscourse.ai';

export const API_BASE_URL = resolvedBaseUrl;

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
    const response = await fetch(`${API_BASE_URL}/api/health`, {
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