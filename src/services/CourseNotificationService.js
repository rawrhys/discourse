// src/services/CourseNotificationService.js
import { API_BASE_URL } from '../config/api';

class CourseNotificationService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.listeners = new Map();
  }

  // Connect to SSE endpoint
  connect(token) {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      // EventSource doesn't support custom headers, so we'll use a query parameter for the token
      const url = `${API_BASE_URL}/api/courses/notifications?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[CourseNotificationService] SSE connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
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
        this.handleReconnect();
      };

    } catch (error) {
      console.error('[CourseNotificationService] Error creating SSE connection:', error);
    }
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
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CourseNotificationService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[CourseNotificationService] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
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
