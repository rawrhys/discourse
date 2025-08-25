// src/services/CourseNotificationService.js
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabase';

class CourseNotificationService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.listeners = new Map();
    this.reconnecting = false;
    this.lastAuthCheck = 0;
    this.authCheckInterval = 60000; // Check auth every minute
    this.silentMode = false; // Prevent console spam during retries
  }

  // Check if user is authenticated before making requests
  async isAuthenticated() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session?.access_token;
    } catch (error) {
      return false;
    }
  }

  // Silent fetch wrapper that doesn't log errors to console
  async silentFetch(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status !== 401) {
        // Only log non-401 errors if not in silent mode
        if (!this.silentMode) {
          console.warn(`[CourseNotificationService] Silent fetch failed: ${response.status} ${response.statusText}`);
        }
      }
      return response;
    } catch (error) {
      // Don't log network errors in silent mode
      if (!this.silentMode) {
        console.warn(`[CourseNotificationService] Silent fetch network error: ${error.message}`);
      }
      throw error;
    }
  }

  // Connect to SSE endpoint
  async connect(token) {
    if (this.eventSource) {
      this.disconnect();
    }

    // Store token for reconnection
    this.lastToken = token;

    try {
      // Check authentication state first
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        console.log('[CourseNotificationService] User not authenticated, skipping SSE connection');
        this.silentMode = true; // Enable silent mode to prevent console spam
        return;
      }

      // Reset silent mode if we're authenticated
      this.silentMode = false;

      // First, ensure the SSE cookie is set before attempting to connect
      this.cookieSetSuccessfully = false;
      if (token) {
        try {
          console.log('[CourseNotificationService] Setting SSE cookie before connecting...');
          const response = await this.silentFetch(`${API_BASE_URL}/api/auth/sse-cookie`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({}),
            credentials: 'include' // Ensure cookies are sent
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              console.log('[CourseNotificationService] Authentication failed, skipping SSE connection');
              return;
            }
            throw new Error(`Failed to set SSE cookie: ${response.status} ${response.statusText}`);
          }
          
          console.log('[CourseNotificationService] SSE cookie set successfully');
          this.cookieSetSuccessfully = true;
        } catch (cookieError) {
          if (cookieError.message.includes('401') || cookieError.message.includes('Unauthorized')) {
            console.log('[CourseNotificationService] Authentication failed, skipping SSE connection');
            return;
          }
          console.error('[CourseNotificationService] Failed to set SSE cookie:', cookieError);
          this.cookieSetSuccessfully = false;
          // Don't fail completely, try to connect anyway
        }
      }

      // Now connect to SSE endpoint
      let url = `${API_BASE_URL}/api/courses/notifications`;
      
      // If we have a token but cookies might fail, add it as query param as fallback
      // This handles cases where SameSite cookies are blocked or CORS prevents cookie transmission
      if (token && !this.cookieSetSuccessfully) {
        url += `?token=${encodeURIComponent(token)}`;
        console.log('[CourseNotificationService] Added token as query param fallback');
      } else if (token) {
        // Even if cookies were set, add token as query param as additional fallback
        // This ensures the connection works even if cookies are blocked by browser security policies
        url += `?token=${encodeURIComponent(token)}`;
        console.log('[CourseNotificationService] Added token as query param for additional security');
      }
      
      console.log('[CourseNotificationService] Attempting to connect to SSE:', url);

      // Create EventSource with credentials to ensure cookies are sent
      // Note: EventSource doesn't support custom headers, so we rely on cookies
      this.eventSource = new EventSource(url, { 
        withCredentials: true 
      });

      this.eventSource.onopen = () => {
        console.log('[CourseNotificationService] SSE connection established successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.reconnecting = false;
        this.silentMode = false; // Reset silent mode on successful connection
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[CourseNotificationService] Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        // Don't log errors in silent mode to prevent console spam
        if (!this.silentMode) {
          console.error('[CourseNotificationService] SSE connection error:', error);
        }
        this.isConnected = false;
        
        // Check if this is a 401 error (authentication failed)
        if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
          console.log('[CourseNotificationService] Connection failed - likely authentication issue');
          // Try to refresh token and reconnect
          if (!this.reconnecting) {
            this.reconnecting = true;
            this.refreshAndReconnect();
          }
        } else {
          // Other connection errors - try to reconnect
          if (!this.reconnecting) {
            this.reconnecting = true;
            this.handleReconnect();
          }
        }
      };

    } catch (error) {
      // Don't log authentication errors to prevent console spam
      if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
        console.error('[CourseNotificationService] Error creating SSE connection:', error);
      }
      // Try to reconnect after a delay
      setTimeout(() => this.handleReconnect(), 3000);
    }
  }

  // Try to fetch a fresh Supabase access token and reconnect
  async refreshAndReconnect() {
    try {
      let freshToken = null;
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      freshToken = session?.access_token || null;
      if (!freshToken) {
        // Attempt explicit refresh
        const { data, error } = await supabase.auth.refreshSession();
        if (!error) {
          freshToken = data?.session?.access_token || null;
        }
      }

      if (freshToken) {
        console.log('[CourseNotificationService] Obtained fresh token. Updating SSE cookie then reconnecting.');
        try {
          const fullUrl = `${API_BASE_URL}/api/auth/sse-cookie`;
          const response = await this.silentFetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshToken}`
            },
            body: JSON.stringify({}),
            credentials: 'include'
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              console.log('[CourseNotificationService] Authentication still failed with fresh token');
              this.silentMode = true; // Enable silent mode to prevent console spam
              return;
            }
            throw new Error(`Failed to set SSE cookie: ${response.status} ${response.statusText}`);
          }
          
          console.log('[CourseNotificationService] SSE cookie updated successfully');
        } catch (e) {
          if (e.message.includes('401') || e.message.includes('Unauthorized')) {
            console.log('[CourseNotificationService] Authentication still failed with fresh token');
            this.silentMode = true; // Enable silent mode to prevent console spam
            return;
          }
          console.warn('[CourseNotificationService] Failed setting SSE cookie:', e?.message || e);
        }
        this.lastToken = freshToken;
        this.handleReconnect(true);
        return;
      }
      console.warn('[CourseNotificationService] Could not obtain fresh token; falling back to backoff reconnect.');
      this.silentMode = true; // Enable silent mode to prevent console spam
    } catch (e) {
      console.warn('[CourseNotificationService] Token refresh failed:', e?.message || e);
      this.silentMode = true; // Enable silent mode to prevent console spam
    }
    // Default backoff if refreshing didn't work
    this.handleReconnect();
  }

  // Handle incoming SSE messages
  handleMessage(data) {
    console.log('[CourseNotificationService] Received message:', data);

    switch (data.type) {
      case 'connected':
        console.log('[CourseNotificationService] Connected to SSE server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        break;

      case 'course_generated':
        console.log('[CourseNotificationService] Course generated notification:', data);
        this.notifyListeners('course_generated', data);
        break;

      case 'ping':
        console.log('[CourseNotificationService] Received ping from server');
        // Respond to ping to keep connection alive
        break;

      default:
        console.log('[CourseNotificationService] Unknown message type:', data.type);
    }
  }

  // Handle reconnection logic
  handleReconnect(hasFreshToken = false) {
    if (!this.shouldAttemptReconnection()) {
      console.log('[CourseNotificationService] Skipping reconnection attempt (silent mode or max attempts reached)');
      this.reconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    // If we have a fresh token, try quicker; otherwise exponential backoff
    const delay = hasFreshToken ? 500 : (this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));

    console.log(`[CourseNotificationService] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.isConnected) {
        // We need to store the token for reconnection
        if (this.lastToken) {
          this.connect(this.lastToken);
        } else {
          console.error('[CourseNotificationService] No token available for reconnection');
        }
      }
      // Allow future reconnect attempts
      this.reconnecting = false;
    }, delay);
  }

  // Add event listener
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  // Remove event listener
  removeEventListener(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify all listeners for a specific event type
  notifyListeners(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[CourseNotificationService] Error in event listener:', error);
        }
      });
    }
  }

  // Disconnect from SSE
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('[CourseNotificationService] SSE connection closed');
  }

  // Check if connected
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasEventSource: !!this.eventSource,
      eventSourceState: this.eventSource ? this.eventSource.readyState : null,
      cookieSetSuccessfully: this.cookieSetSuccessfully,
      lastToken: this.lastToken ? `${this.lastToken.substring(0, 20)}...` : null,
      silentMode: this.silentMode
    };
  }

  // Reset silent mode (called when user successfully authenticates)
  resetSilentMode() {
    this.silentMode = false;
    console.log('[CourseNotificationService] Silent mode reset');
  }

  // Check if we should attempt reconnection (prevents spam during auth failures)
  shouldAttemptReconnection() {
    // Don't attempt reconnection if in silent mode (auth failures)
    if (this.silentMode) {
      return false;
    }
    
    // Don't attempt reconnection if we've reached max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }
    
    return true;
  }

  // Check if we should attempt operations (prevents unnecessary API calls)
  async shouldAttemptOperations() {
    // Don't attempt operations if in silent mode
    if (this.silentMode) {
      return false;
    }
    
    // Check if user is authenticated
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      return false;
    }
    
    return true;
  }

  

  // Test SSE connection manually
  async testConnection(token) {
    try {
      // Check authentication state first
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        console.log('[CourseNotificationService] User not authenticated, skipping connection test');
        return { success: false, error: 'User not authenticated' };
      }

      console.log('[CourseNotificationService] Testing SSE connection...');
      
      // First test the cookie endpoint
      const cookieResponse = await this.silentFetch(`${API_BASE_URL}/api/auth/sse-cookie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}),
        credentials: 'include'
      });
      
      if (!cookieResponse.ok) {
        if (cookieResponse.status === 401) {
          console.log('[CourseNotificationService] Authentication failed during connection test');
          return { success: false, error: 'Authentication failed' };
        }
        throw new Error(`Cookie endpoint failed: ${cookieResponse.status} ${cookieResponse.statusText}`);
      }
      
      console.log('[CourseNotificationService] Cookie endpoint test passed');
      
      // Now test the SSE endpoint with a simple GET request
      const sseResponse = await this.silentFetch(`${API_BASE_URL}/api/courses/notifications`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (sseResponse.status === 401) {
        console.log('[CourseNotificationService] SSE endpoint requires authentication');
        return { success: false, error: 'SSE endpoint requires authentication' };
      }
      
      console.log('[CourseNotificationService] SSE endpoint test passed');
      return { success: true, message: 'Connection test passed' };
      
    } catch (error) {
      // Don't log authentication errors to prevent console spam
      if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
        console.error('[CourseNotificationService] Connection test failed:', error);
      }
      return { success: false, error: error.message };
    }
  }

  // Get debug information about SSE connection
  async getDebugInfo() {
    try {
      // Check authentication state first
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        console.log('[CourseNotificationService] User not authenticated, skipping debug info fetch');
        return { 
          error: 'User not authenticated',
          clientStatus: this.getConnectionStatus()
        };
      }

      const response = await this.silentFetch(`${API_BASE_URL}/api/auth/sse-debug`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('[CourseNotificationService] Authentication failed during debug info fetch');
          return { 
            error: 'Authentication failed',
            clientStatus: this.getConnectionStatus()
          };
        }
        throw new Error(`Debug endpoint failed: ${response.status} ${response.statusText}`);
      }
      
      const debugInfo = await response.json();
      return {
        ...debugInfo,
        clientStatus: this.getConnectionStatus()
      };
    } catch (error) {
      // Don't log authentication errors to prevent console spam
      if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
        console.error('[CourseNotificationService] Failed to get debug info:', error);
      }
      return { 
        error: error.message,
        clientStatus: this.getConnectionStatus()
      };
    }
  }

  // Force reconnection with current token
  async forceReconnect() {
    if (!this.lastToken) {
      console.error('[CourseNotificationService] No token available for forced reconnection');
      return { success: false, error: 'No token available' };
    }

    try {
      console.log('[CourseNotificationService] Forcing reconnection...');
      this.disconnect();
      this.reconnectAttempts = 0;
      this.reconnecting = false;
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.connect(this.lastToken);
      return { success: true, message: 'Reconnection initiated' };
    } catch (error) {
      console.error('[CourseNotificationService] Forced reconnection failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Try different connection strategies
  async tryAlternativeConnectionStrategies() {
    if (!this.lastToken) {
      return { success: false, error: 'No token available' };
    }

    const strategies = [
      {
        name: 'Cookie-only connection',
        connect: async () => {
          // Try to set cookie first, then connect without query param
          await this.setCookieOnly(this.lastToken);
          return this.connectWithoutQueryParam();
        }
      },
      {
        name: 'Query param fallback',
        connect: async () => {
          // Connect with token in query param
          return this.connectWithQueryParam(this.lastToken);
        }
      },
      {
        name: 'Fresh token refresh',
        connect: async () => {
          // Try to get a fresh token and reconnect
          return this.refreshAndReconnect();
        }
      }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`[CourseNotificationService] Trying strategy: ${strategy.name}`);
        const result = await strategy.connect();
        if (result && this.isConnected) {
          console.log(`[CourseNotificationService] Strategy ${strategy.name} succeeded`);
          return { success: true, strategy: strategy.name };
        }
      } catch (error) {
        console.warn(`[CourseNotificationService] Strategy ${strategy.name} failed:`, error.message);
      }
    }

    return { success: false, error: 'All connection strategies failed' };
  }

  // Set cookie only (for testing)
  async setCookieOnly(token) {
    try {
      // Check authentication state first
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        console.log('[CourseNotificationService] User not authenticated, skipping cookie set');
        return false;
      }

      const response = await this.silentFetch(`${API_BASE_URL}/api/auth/sse-cookie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}),
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('[CourseNotificationService] Authentication failed during cookie set');
          return false;
        }
        throw new Error(`Failed to set cookie: ${response.status}`);
      }
      
      this.cookieSetSuccessfully = true;
      return true;
    } catch (error) {
      this.cookieSetSuccessfully = false;
      // Don't log authentication errors to prevent console spam
      if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
        throw error;
      }
      return false;
    }
  }

  // Connect without query param (cookie only)
  async connectWithoutQueryParam() {
    const url = `${API_BASE_URL}/api/courses/notifications`;
    this.eventSource = new EventSource(url, { withCredentials: true });
    return this.setupEventSourceHandlers();
  }

  // Connect with query param
  async connectWithQueryParam(token) {
    const url = `${API_BASE_URL}/api/courses/notifications?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url, { withCredentials: true });
    return this.setupEventSourceHandlers();
  }

  // Setup EventSource handlers
  setupEventSourceHandlers() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.eventSource.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.reconnecting = false;
        console.log('[CourseNotificationService] Alternative connection strategy succeeded');
        resolve(true);
      };

      this.eventSource.onerror = (error) => {
        clearTimeout(timeout);
        this.isConnected = false;
        console.error('[CourseNotificationService] Alternative connection strategy failed:', error);
        reject(error);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[CourseNotificationService] Error parsing SSE message:', error);
        }
      };
    });
  }

  // Check browser compatibility and security restrictions
  checkBrowserCompatibility() {
    const compatibility = {
      hasEventSource: typeof EventSource !== 'undefined',
      hasCredentials: 'withCredentials' in EventSource.prototype,
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      origin: window.location.origin,
      protocol: window.location.protocol,
      hasCSP: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
      hasCSPReportOnly: !!document.querySelector('meta[http-equiv="Content-Security-Policy-Report-Only"]'),
      browser: this.detectBrowser(),
      version: this.detectBrowserVersion()
    };

    // Check for CSP restrictions that might block EventSource
    try {
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (cspMeta) {
        const cspContent = cspMeta.getAttribute('content');
        compatibility.cspContent = cspContent;
        compatibility.cspBlocksEventSource = cspContent && (
          cspContent.includes('connect-src') && 
          !cspContent.includes('unsafe-inline') &&
          !cspContent.includes('*')
        );
      }
    } catch (e) {
      compatibility.cspError = e.message;
    }

    console.log('[CourseNotificationService] Browser compatibility check:', compatibility);
    return compatibility;
  }

  // Detect browser type
  detectBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    if (ua.includes('ie') || ua.includes('trident')) return 'Internet Explorer';
    return 'Unknown';
  }

  // Detect browser version
  detectBrowserVersion() {
    const ua = navigator.userAgent;
    const match = ua.match(/(chrome|firefox|safari|edge|opera|ie|trident)\/?\s*(\d+)/i);
    return match ? match[2] : 'Unknown';
  }

  // Get comprehensive connection diagnostics
  async getConnectionDiagnostics() {
    const diagnostics = {
      browserCompatibility: this.checkBrowserCompatibility(),
      connectionStatus: this.getConnectionStatus(),
      serverDebugInfo: await this.getDebugInfo(),
      networkConnectivity: await this.testNetworkConnectivity(),
      timestamp: new Date().toISOString()
    };

    console.log('[CourseNotificationService] Connection diagnostics:', diagnostics);
    return diagnostics;
  }

  // Test network connectivity to the server
  async testNetworkConnectivity() {
    const tests = {};
    
    // Check authentication state first
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      console.log('[CourseNotificationService] User not authenticated, skipping network connectivity test');
      return {
        basicConnectivity: { success: false, error: 'User not authenticated', timestamp: new Date().toISOString() },
        sseEndpoint: { success: false, error: 'User not authenticated', timestamp: new Date().toISOString() },
        blockingDetection: this.detectBlockingScenarios()
      };
    }
    
    try {
      // Test basic connectivity
      const startTime = Date.now();
      const response = await this.silentFetch(`${API_BASE_URL}/api/auth/sse-debug`, {
        method: 'GET',
        credentials: 'include'
      });
      const endTime = Date.now();
      
      tests.basicConnectivity = {
        success: response.ok,
        status: response.status,
        responseTime: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      tests.basicConnectivity = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Test SSE endpoint specifically
      const startTime = Date.now();
      const response = await this.silentFetch(`${API_BASE_URL}/api/courses/notifications`, {
        method: 'GET',
        credentials: 'include'
      });
      const endTime = Date.now();
      
      tests.sseEndpoint = {
        success: response.ok,
        status: response.status,
        responseTime: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      tests.sseEndpoint = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    // Detect common blocking scenarios
    tests.blockingDetection = this.detectBlockingScenarios();

    return tests;
  }

  // Detect common blocking scenarios
  detectBlockingScenarios() {
    const scenarios = {
      hasAdBlocker: false,
      hasPrivacyExtensions: false,
      hasTrackingProtection: false,
      hasIncognitoMode: false,
      hasPrivateBrowsing: false
    };

    try {
      // Check for common ad blockers
      const adBlockers = [
        'adblock',
        'ublock',
        'adguard',
        'ghostery',
        'privacy badger'
      ];
      
      scenarios.hasAdBlocker = adBlockers.some(blocker => 
        navigator.userAgent.toLowerCase().includes(blocker) ||
        window[blocker] !== undefined
      );

      // Check for privacy extensions
      const privacyExtensions = [
        'privacy',
        'tracking',
        'fingerprint',
        'canvas'
      ];
      
      scenarios.hasPrivacyExtensions = privacyExtensions.some(ext => 
        window[ext] !== undefined
      );

      // Check for tracking protection
      scenarios.hasTrackingProtection = 'trackingProtection' in navigator;

      // Check for incognito/private mode (not always reliable)
      try {
        if ('webkitRequestFileSystem' in window) {
          webkitRequestFileSystem(window.TEMPORARY, 1, () => {}, () => {
            scenarios.hasIncognitoMode = true;
          });
        }
      } catch (e) {
        // Ignore errors
      }

      // Check for private browsing
      if ('mozInnerScreenX' in window) {
        scenarios.hasPrivateBrowsing = true;
      }

    } catch (error) {
      scenarios.error = error.message;
    }

    return scenarios;
  }

  // Generate troubleshooting recommendations
  generateTroubleshootingRecommendations(diagnostics) {
    const recommendations = [];

    // Browser compatibility issues
    if (!diagnostics.browserCompatibility.hasEventSource) {
      recommendations.push({
        priority: 'high',
        category: 'browser',
        title: 'Browser Not Supported',
        description: 'Your browser does not support Server-Sent Events (EventSource).',
        solution: 'Please use a modern browser like Chrome, Firefox, Safari, or Edge.',
        action: 'upgrade_browser'
      });
    }

    // CORS issues
    if (diagnostics.browserCompatibility.origin !== window.location.origin) {
      recommendations.push({
        priority: 'medium',
        category: 'cors',
        title: 'Cross-Origin Request Issue',
        description: 'Your frontend and backend are on different domains, which may cause CORS issues.',
        solution: 'Ensure your backend allows requests from your frontend domain.',
        action: 'check_cors_config'
      });
    }

    // Cookie issues
    if (!diagnostics.serverDebugInfo.hasSseToken) {
      recommendations.push({
        priority: 'high',
        category: 'authentication',
        title: 'Authentication Cookie Missing',
        description: 'The SSE authentication cookie was not set properly.',
        solution: 'Try refreshing the page or logging out and back in.',
        action: 'refresh_page'
      });
    }

    // Network connectivity issues
    if (diagnostics.networkConnectivity && !diagnostics.networkConnectivity.basicConnectivity.success) {
      recommendations.push({
        priority: 'high',
        category: 'network',
        title: 'Network Connectivity Issue',
        description: 'Cannot connect to the backend server.',
        solution: 'Check your internet connection and ensure the backend server is running.',
        action: 'check_network'
      });
    }

    // Privacy/blocking issues
    if (diagnostics.networkConnectivity && diagnostics.networkConnectivity.blockingDetection) {
      const blocking = diagnostics.networkConnectivity.blockingDetection;
      
      if (blocking.hasAdBlocker) {
        recommendations.push({
          priority: 'medium',
          category: 'privacy',
          title: 'Ad Blocker Detected',
          description: 'An ad blocker may be interfering with the SSE connection.',
          solution: 'Try disabling your ad blocker for this site or adding an exception.',
          action: 'disable_adblocker'
        });
      }

      if (blocking.hasPrivacyExtensions) {
        recommendations.push({
          priority: 'medium',
          category: 'privacy',
          title: 'Privacy Extensions Detected',
          description: 'Privacy extensions may be blocking the SSE connection.',
          solution: 'Try temporarily disabling privacy extensions to test the connection.',
          action: 'disable_privacy_extensions'
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return recommendations;
  }
}

// Export singleton instance
const courseNotificationService = new CourseNotificationService();
export default courseNotificationService;
