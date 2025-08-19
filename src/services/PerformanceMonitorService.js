class PerformanceMonitorService {
  constructor() {
    this.metrics = {
      renderTimes: new Map(),
      apiCalls: new Map(),
      imageLoads: new Map(),
      componentRenders: new Map(),
      flashcardRenders: 0,
      lastFlashcardRender: 0
    };
    
    this.thresholds = {
      slowRender: 100, // ms
      slowApiCall: 1000, // ms
      slowImageLoad: 2000, // ms
      excessiveRenders: 10 // per second
    };
    
    this.isEnabled = true;
    this.initPerformanceObserver();
  }

  // Initialize Performance Observer for monitoring
  initPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        // Monitor long tasks - only in development and with higher threshold
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 200 && process.env.NODE_ENV === 'development') { // Higher threshold, dev only
              console.warn('[Performance] Long task detected:', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              });
            }
          }
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        
        // Monitor layout shifts - only in development and with higher threshold
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.value > 0.3 && process.env.NODE_ENV === 'development') { // Higher threshold, dev only
              console.warn('[Performance] Layout shift detected:', {
                value: entry.value,
                sources: entry.sources
              });
            }
          }
        });
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        
        console.log('[PerformanceMonitor] Performance observers initialized');
      } catch (error) {
        console.warn('[PerformanceMonitor] Failed to initialize observers:', error);
      }
    }
  }

  // Track component render time
  trackRenderTime(componentName, renderTime) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.renderTimes.has(componentName)) {
      this.metrics.renderTimes.set(componentName, []);
    }
    
    this.metrics.renderTimes.get(componentName).push(renderTime);
    
    if (renderTime > this.thresholds.slowRender) {
      console.warn('[Performance] Slow render detected in ' + componentName + ':', renderTime + 'ms');
    }
  }

  // Track API call performance
  trackApiCall(endpoint, duration, success = true) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.apiCalls.has(endpoint)) {
      this.metrics.apiCalls.set(endpoint, []);
    }
    
    this.metrics.apiCalls.get(endpoint).push({ duration, success, timestamp: Date.now() });
    
    if (duration > this.thresholds.slowApiCall) {
      console.warn('[Performance] Slow API call detected for ' + endpoint + ':', duration + 'ms');
    }
  }

  // Track image load performance
  trackImageLoad(url, duration, cacheHit = false) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.imageLoads.has(url)) {
      this.metrics.imageLoads.set(url, []);
    }
    
    this.metrics.imageLoads.get(url).push({ duration, cacheHit, timestamp: Date.now() });
    
    if (duration > this.thresholds.slowImageLoad) {
      console.warn('[Performance] Slow image load detected for ' + url + ':', duration + 'ms');
    }
  }

  // Track component render count
  trackComponentRender(componentName) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.componentRenders.has(componentName)) {
      this.metrics.componentRenders.set(componentName, 0);
    }
    
    this.metrics.componentRenders.set(
      componentName, 
      this.metrics.componentRenders.get(componentName) + 1
    );
  }

  // Track flashcard rendering (specifically for the excessive rendering issue)
  trackFlashcardRender() {
    if (!this.isEnabled) return;
    
    const now = Date.now();
    this.metrics.flashcardRenders++;
    
    // Check if we're rendering too many flashcards per second
    if (now - this.metrics.lastFlashcardRender < 1000) {
      if (this.metrics.flashcardRenders > this.thresholds.excessiveRenders) {
        console.warn('[Performance] Excessive flashcard rendering detected:', {
          count: this.metrics.flashcardRenders,
          timeWindow: '1 second'
        });
      }
    } else {
      // Reset counter every second
      this.metrics.flashcardRenders = 1;
      this.metrics.lastFlashcardRender = now;
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {
      renderTimes: {},
      apiCalls: {},
      imageLoads: {},
      componentRenders: {},
      recommendations: []
    };

    // Analyze render times
    for (const [component, times] of this.metrics.renderTimes) {
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        summary.renderTimes[component] = { avg: avg.toFixed(2), max, count: times.length };
        
        if (avg > this.thresholds.slowRender) {
          summary.recommendations.push('Consider memoizing ' + component + ' component');
        }
      }
    }

    // Analyze API calls
    for (const [endpoint, calls] of this.metrics.apiCalls) {
      if (calls.length > 0) {
        const avg = calls.reduce((a, b) => a + b.duration, 0) / calls.length;
        const max = Math.max(...calls.map(c => c.duration));
        summary.apiCalls[endpoint] = { avg: avg.toFixed(2), max, count: calls.length };
        
        if (avg > this.thresholds.slowApiCall) {
          summary.recommendations.push('Consider caching or optimizing ' + endpoint + ' API calls');
        }
      }
    }

    // Analyze image loads
    for (const [url, loads] of this.metrics.imageLoads) {
      if (loads.length > 0) {
        const avg = loads.reduce((a, b) => a + b.duration, 0) / loads.length;
        const max = Math.max(...loads.map(l => l.duration));
        const cacheHitRate = loads.filter(l => l.cacheHit).length / loads.length;
        summary.imageLoads[url] = { 
          avg: avg.toFixed(2), 
          max, 
          count: loads.length,
          cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%'
        };
        
        if (avg > this.thresholds.slowImageLoad) {
          summary.recommendations.push('Consider optimizing image loading for ' + url);
        }
      }
    }

    // Component render counts
    for (const [component, count] of this.metrics.componentRenders) {
      summary.componentRenders[component] = count;
      
      if (count > 100) {
        summary.recommendations.push('Component ' + component + ' is rendering too frequently - consider optimization');
      }
    }

    return summary;
  }

  // Reset all metrics
  resetMetrics() {
    this.metrics = {
      renderTimes: new Map(),
      apiCalls: new Map(),
      imageLoads: new Map(),
      componentRenders: new Map(),
      flashcardRenders: 0,
      lastFlashcardRender: 0
    };
    console.log('[PerformanceMonitor] Metrics reset');
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log('[PerformanceMonitor] Monitoring ' + (enabled ? 'enabled' : 'disabled'));
  }

  // Get current metrics
  getMetrics() {
    return { ...this.metrics };
  }

  // Log performance summary to console
  logPerformanceSummary() {
    const summary = this.getPerformanceSummary();
    console.group('[PerformanceMonitor] Performance Summary');
    console.table(summary.renderTimes);
    console.table(summary.apiCalls);
    console.table(summary.componentRenders);
    
    if (summary.recommendations.length > 0) {
      console.group('Recommendations');
      summary.recommendations.forEach(rec => console.log('•', rec));
      console.groupEnd();
    }
    
    console.groupEnd();
    return summary;
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitorService();
export default performanceMonitor; 