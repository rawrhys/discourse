'use strict';

class ImagePerformanceMonitor {
  constructor() {
    this.slowImages = new Map();
    this.performanceData = new Map();
    this.renderTimes = new Map();
    this.slowThreshold = 3000; // 3 seconds threshold for slow images
    this.criticalThreshold = 5000; // 5 seconds for critical slow images
    this.maxSlowImages = 50; // Maximum number of slow images to track
    
    // Performance observer for image loading
    this.observer = null;
    this.renderObserver = null;
    this.initPerformanceObserver();
  }

  initPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        // Monitor resource timing for images
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource' && entry.initiatorType === 'img') {
              this.trackImageLoad(entry);
            }
          }
        });
        
        this.observer.observe({ entryTypes: ['resource'] });
        
        // Monitor long tasks that might cause render lag
        this.renderObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.trackLongTask(entry);
            }
          }
        });
        
        this.renderObserver.observe({ entryTypes: ['longtask'] });
        
        console.log('[ImagePerformanceMonitor] Performance observers initialized');
      } catch (error) {
        console.warn('[ImagePerformanceMonitor] Failed to initialize performance observer:', error);
      }
    }
  }

  trackImageLoad(entry) {
    const loadTime = entry.duration;
    const url = entry.name;
    
    // Track all image loads
    this.performanceData.set(url, {
      loadTime,
      timestamp: Date.now(),
      size: entry.transferSize || 0
    });

    // Track slow images
    if (loadTime > this.slowThreshold) {
      this.slowImages.set(url, {
        loadTime,
        timestamp: Date.now(),
        size: entry.transferSize || 0,
        domain: new URL(url).hostname
      });

      // Log slow images
      if (loadTime > this.criticalThreshold) {
        console.warn(`[Performance] Critical slow image load detected for ${url}: ${loadTime.toFixed(2)}ms`);
      } else {
        console.warn(`[Performance] Slow image load detected for ${url}: ${loadTime.toFixed(2)}ms`);
      }

      // Clean up old entries
      if (this.slowImages.size > this.maxSlowImages) {
        const oldestKey = Array.from(this.slowImages.keys())[0];
        this.slowImages.delete(oldestKey);
      }
    }
  }

  trackLongTask(entry) {
    const duration = entry.duration;
    const startTime = entry.startTime;
    
    console.warn(`[Performance] Long task detected: ${duration.toFixed(2)}ms at ${new Date(startTime).toISOString()}`);
    
    // Track render-blocking tasks
    if (duration > 100) {
      console.error(`[Performance] Render-blocking task: ${duration.toFixed(2)}ms - this may cause lag`);
    }
  }

  // Track render times for components
  trackRenderTime(componentName, renderTime) {
    this.renderTimes.set(componentName, {
      renderTime,
      timestamp: Date.now()
    });
    
    if (renderTime > 1000) {
      console.warn(`[Performance] Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  }

  // Manual tracking for images not caught by performance observer
  trackManualImageLoad(url, loadTime, size = 0) {
    if (loadTime > this.slowThreshold) {
      this.slowImages.set(url, {
        loadTime,
        timestamp: Date.now(),
        size,
        domain: new URL(url).hostname,
        manual: true
      });

      console.warn(`[Performance] Manual slow image detection for ${url}: ${loadTime.toFixed(2)}ms`);
    }
  }

  getSlowImages() {
    return Array.from(this.slowImages.entries()).map(([url, data]) => ({
      url,
      ...data
    }));
  }

  getPerformanceStats() {
    const allLoadTimes = Array.from(this.performanceData.values()).map(data => data.loadTime);
    const allRenderTimes = Array.from(this.renderTimes.values()).map(data => data.renderTime);
    
    if (allLoadTimes.length === 0) {
      return {
        totalImages: 0,
        averageLoadTime: 0,
        slowImages: 0,
        criticalSlowImages: 0,
        averageRenderTime: 0,
        slowRenders: 0
      };
    }

    const averageLoadTime = allLoadTimes.reduce((sum, time) => sum + time, 0) / allLoadTimes.length;
    const slowCount = allLoadTimes.filter(time => time > this.slowThreshold).length;
    const criticalCount = allLoadTimes.filter(time => time > this.criticalThreshold).length;

    const averageRenderTime = allRenderTimes.length > 0 
      ? allRenderTimes.reduce((sum, time) => sum + time, 0) / allRenderTimes.length 
      : 0;
    const slowRenders = allRenderTimes.filter(time => time > 1000).length;

    return {
      totalImages: allLoadTimes.length,
      averageLoadTime: Math.round(averageLoadTime),
      slowImages: slowCount,
      criticalSlowImages: criticalCount,
      slowPercentage: Math.round((slowCount / allLoadTimes.length) * 100),
      averageRenderTime: Math.round(averageRenderTime),
      slowRenders,
      totalRenders: allRenderTimes.length
    };
  }

  getOptimizationSuggestions() {
    const suggestions = [];
    const stats = this.getPerformanceStats();

    if (stats.slowPercentage > 20) {
      suggestions.push('Consider implementing image CDN or compression');
    }

    if (stats.criticalSlowImages > 0) {
      suggestions.push('Critical slow images detected - review image sources and proxy settings');
    }

    if (stats.averageRenderTime > 500) {
      suggestions.push('Slow render times detected - consider deferred rendering and requestIdleCallback');
    }

    if (stats.slowRenders > 0) {
      suggestions.push('Render-blocking operations detected - break rendering into chunks');
    }

    const slowImages = this.getSlowImages();
    const domainCounts = {};
    
    slowImages.forEach(img => {
      domainCounts[img.domain] = (domainCounts[img.domain] || 0) + 1;
    });

    const problematicDomains = Object.entries(domainCounts)
      .filter(([domain, count]) => count > 3)
      .map(([domain]) => domain);

    if (problematicDomains.length > 0) {
      suggestions.push(`Slow images from domains: ${problematicDomains.join(', ')}`);
    }

    return suggestions;
  }

  // Generate performance report
  generatePerformanceReport() {
    const stats = this.getPerformanceStats();
    const suggestions = this.getOptimizationSuggestions();
    const slowImages = this.getSlowImages().slice(0, 10); // Top 10 slowest
    
    return {
      timestamp: new Date().toISOString(),
      stats,
      suggestions,
      slowImages,
      renderTimes: Array.from(this.renderTimes.entries()).map(([component, data]) => ({
        component,
        ...data
      }))
    };
  }

  clearData() {
    this.slowImages.clear();
    this.performanceData.clear();
    this.renderTimes.clear();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.renderObserver) {
      this.renderObserver.disconnect();
    }
  }
}

// Export singleton instance
const imagePerformanceMonitor = new ImagePerformanceMonitor();
export default imagePerformanceMonitor;
