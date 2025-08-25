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
  }

  // Connect to SSE endpoint
  connect(token) {
    if (this.eventSource) {
      this.disconnect();
    }

    // Store token for reconnection
    this.lastToken = token;

    try {
      // Prefer HttpOnly cookie; include token in query as a resilient fallback
      const url = `${API_BASE_URL}/api/courses/notifications?token=${encodeURIComponent(token || '')}`;
      console.log('[CourseNotificationService] Attempting to connect to SSE:', url);

      // Ensure cookie is set before opening connection; include credentials for CORS cases
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        console.log('[CourseNotificationService] SSE connection established successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.reconnecting = false;
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
        console.error('[CourseNotificationService] SSE connection error:', error);
        this.isConnected = false;
        // Try to refresh token once before backing off
        if (!this.reconnecting) {
          this.reconnecting = true;
          this.refreshAndReconnect();
        }
      };

    } catch (error) {
      console.error('[CourseNotificationService] Error creating SSE connection:', error);
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
          await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshToken}`
            },
            body: JSON.stringify({})
          });
        } catch (e) {
          console.warn('[CourseNotificationService] Failed setting SSE cookie:', e?.message || e);
        }
        this.lastToken = freshToken;
        this.handleReconnect(true);
        return;
      }
      console.warn('[CourseNotificationService] Could not obtain fresh token; falling back to backoff reconnect.');
    } catch (e) {
      console.warn('[CourseNotificationService] Token refresh failed:', e?.message || e);
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
        break;

      case 'course_generated':
        console.log('[CourseNotificationService] Course generated notification:', data);
        this.notifyListeners('course_generated', data);
        break;

      default:
        console.log('[CourseNotificationService] Unknown message type:', data.type);
    }
  }

  // Handle reconnection logic
  handleReconnect(hasFreshToken = false) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CourseNotificationService] Max reconnection attempts reached');
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
    return this.isConnected;
  }
}

// Export singleton instance
const courseNotificationService = new CourseNotificationService();
export default courseNotificationService;
