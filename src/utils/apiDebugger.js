// API Debugger Utility
// Helps identify sources of frequent API calls and console spam

class APIDebugger {
  constructor() {
    this.apiCalls = new Map();
    this.interceptors = new Map();
    this.isMonitoring = false;
    this.startTime = null;
    
    // Bind methods
    this.startMonitoring = this.startMonitoring.bind(this);
    this.stopMonitoring = this.stopMonitoring.bind(this);
    this.analyzeCalls = this.analyzeCalls.bind(this);
    this.clearData = this.clearData.bind(this);
  }

  // Start monitoring API calls
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('🔍 [API DEBUG] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();
    
    // Intercept fetch calls
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      const url = args[0];
      if (typeof url === 'string') {
        this.recordAPICall(url, new Error().stack);
      }
      return originalFetch.apply(this, args);
    };
    
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (typeof url === 'string') {
        window.apiDebugger?.recordAPICall(url, new Error().stack);
      }
      return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    console.log('🔍 [API DEBUG] Started monitoring API calls');
    console.log('🔍 [API DEBUG] Use window.apiDebugger.analyzeCalls() to see results');
  }

  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('🔍 [API DEBUG] Not currently monitoring');
      return;
    }

    this.isMonitoring = false;
    
    // Restore original fetch
    if (this.interceptors.has('fetch')) {
      window.fetch = this.interceptors.get('fetch');
      this.interceptors.delete('fetch');
    }
    
    // Restore original XMLHttpRequest
    if (this.interceptors.has('xhr')) {
      XMLHttpRequest.prototype.open = this.interceptors.get('xhr');
      this.interceptors.delete('xhr');
    }
    
    console.log('🔍 [API DEBUG] Stopped monitoring API calls');
  }

  // Record an API call
  recordAPICall(url, stackTrace) {
    const timestamp = Date.now();
    const urlKey = this.normalizeURL(url);
    
    if (!this.apiCalls.has(urlKey)) {
      this.apiCalls.set(urlKey, []);
    }
    
    this.apiCalls.get(urlKey).push({
      timestamp,
      url: url,
      stackTrace: stackTrace,
      timeSinceStart: timestamp - this.startTime
    });
  }

  // Normalize URL for grouping
  normalizeURL(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  // Analyze recorded API calls
  analyzeCalls() {
    if (this.apiCalls.size === 0) {
      console.log('🔍 [API DEBUG] No API calls recorded');
      return;
    }

    console.group('🔍 [API DEBUG] API Call Analysis');
    console.log(`Monitoring period: ${this.startTime ? Date.now() - this.startTime : 0}ms`);
    
    for (const [endpoint, calls] of this.apiCalls.entries()) {
      if (calls.length > 1) {
        console.group(`📡 ${endpoint}`);
        console.log(`Total calls: ${calls.length}`);
        
        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < calls.length; i++) {
          intervals.push(calls[i].timestamp - calls[i - 1].timestamp);
        }
        
        if (intervals.length > 0) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const minInterval = Math.min(...intervals);
          const maxInterval = Math.max(...intervals);
          
          console.log(`Average interval: ${avgInterval.toFixed(0)}ms`);
          console.log(`Min interval: ${minInterval}ms`);
          console.log(`Max interval: ${maxInterval}ms`);
          
          // Identify potential issues
          if (minInterval < 100) {
            console.error('🚨 RAPID POLLING DETECTED! Calls happening too frequently');
          } else if (minInterval < 1000) {
            console.warn('⚠️  Frequent calls detected - potential polling issue');
          } else if (minInterval < 5000) {
            console.warn('⚠️  Moderate frequency - monitor for issues');
          } else {
            console.log('✅ Normal call frequency');
          }
          
          // Show call timeline
          console.log('Call timeline:');
          calls.forEach((call, index) => {
            const timeStr = new Date(call.timestamp).toLocaleTimeString();
            console.log(`  ${index + 1}. ${timeStr} (${call.timeSinceStart}ms from start)`);
          });
          
          // Show stack traces for frequent calls
          if (calls.length > 3) {
            console.log('Stack traces for recent calls:');
            calls.slice(-3).forEach((call, index) => {
              console.log(`Call ${calls.length - 2 + index}:`);
              console.log(call.stackTrace);
            });
          }
        }
        
        console.groupEnd();
      }
    }
    
    console.groupEnd();
  }

  // Get summary of API calls
  getSummary() {
    const summary = {
      totalEndpoints: this.apiCalls.size,
      totalCalls: 0,
      frequentEndpoints: [],
      monitoringDuration: this.startTime ? Date.now() - this.startTime : 0
    };
    
    for (const [endpoint, calls] of this.apiCalls.entries()) {
      summary.totalCalls += calls.length;
      if (calls.length > 1) {
        summary.frequentEndpoints.push({
          endpoint,
          callCount: calls.length,
          avgInterval: this.calculateAverageInterval(calls)
        });
      }
    }
    
    return summary;
  }

  // Calculate average interval for calls
  calculateAverageInterval(calls) {
    if (calls.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < calls.length; i++) {
      intervals.push(calls[i].timestamp - calls[i - 1].timestamp);
    }
    
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  // Clear all recorded data
  clearData() {
    this.apiCalls.clear();
    this.startTime = null;
    console.log('🔍 [API DEBUG] Cleared all recorded data');
  }

  // Export data for external analysis
  exportData() {
    const data = {
      summary: this.getSummary(),
      calls: Object.fromEntries(this.apiCalls),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('🔍 [API DEBUG] Exported data to JSON file');
  }
}

// Create global instance
const apiDebugger = new APIDebugger();

// Make it available globally
window.apiDebugger = apiDebugger;

// Auto-start monitoring if in development mode
if (process.env.NODE_ENV === 'development') {
  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => apiDebugger.startMonitoring(), 1000);
    });
  } else {
    setTimeout(() => apiDebugger.startMonitoring(), 1000);
  }
}

export default apiDebugger; 