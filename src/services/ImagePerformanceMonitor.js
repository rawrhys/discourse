'use strict';

class ImagePerformanceMonitor {
  constructor() {
    this.slowImages = new Map();
    this.performanceData = new Map();
    this.slowThreshold = 3000; // 3 seconds threshold for slow images
    this.criticalThreshold = 5000; // 5 seconds for critical slow images
    this.maxSlowImages = 50; // Maximum number of slow images to track
    
    // Performance observer for image loading
    this.observer = null;
    this.initPerformanceObserver();
  }

  initPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource' && entry.initiatorType === 'img') {
              this.trackImageLoad(entry);
            }
          }
        });
        
        this.observer.observe({ entryTypes: ['resource'] });
        console.log('[ImagePerformanceMonitor] Performance observer initialized');
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
    
    if (allLoadTimes.length === 0) {
      return {
        totalImages: 0,
        averageLoadTime: 0,
        slowImages: 0,
        criticalSlowImages: 0
      };
    }

    const averageLoadTime = allLoadTimes.reduce((sum, time) => sum + time, 0) / allLoadTimes.length;
    const slowCount = allLoadTimes.filter(time => time > this.slowThreshold).length;
    const criticalCount = allLoadTimes.filter(time => time > this.criticalThreshold).length;

    return {
      totalImages: allLoadTimes.length,
      averageLoadTime: Math.round(averageLoadTime),
      slowImages: slowCount,
      criticalSlowImages: criticalCount,
      slowPercentage: Math.round((slowCount / allLoadTimes.length) * 100)
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

  clearData() {
    this.slowImages.clear();
    this.performanceData.clear();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Export singleton instance
const imagePerformanceMonitor = new ImagePerformanceMonitor();
export default imagePerformanceMonitor;
