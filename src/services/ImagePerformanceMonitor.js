class ImagePerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTimes: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalRequests: 0,
      preloadHits: 0,
      preloadMisses: 0,
      compressionRatios: [],
      responseSizes: []
    };
    
    this.thresholds = {
      slowLoad: 2000, // ms
      verySlowLoad: 5000, // ms
      optimalLoad: 500, // ms
      maxImageSize: 1024 * 1024 // 1MB
    };
    
    this.isEnabled = true;
    this.observers = new Map();
  }

  /**
   * Track image load performance
   * @param {string} imageUrl - Image URL
   * @param {number} loadTime - Load time in milliseconds
   * @param {boolean} cacheHit - Whether it was a cache hit
   * @param {number} fileSize - File size in bytes
   * @param {string} format - Image format
   */
  trackImageLoad(imageUrl, loadTime, cacheHit = false, fileSize = 0, format = 'unknown') {
    if (!this.isEnabled) return;

    this.metrics.totalRequests++;
    
    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Track load time
    if (!this.metrics.loadTimes.has(imageUrl)) {
      this.metrics.loadTimes.set(imageUrl, []);
    }
    this.metrics.loadTimes.get(imageUrl).push({
      loadTime,
      timestamp: Date.now(),
      cacheHit,
      fileSize,
      format
    });

    // Track file size
    if (fileSize > 0) {
      this.metrics.responseSizes.push(fileSize);
    }

    // Performance warnings - reduced frequency to prevent spam
    if (loadTime > this.thresholds.verySlowLoad) {
      console.warn(`[ImagePerformance] Very slow image load: ${imageUrl} (${loadTime}ms)`);
    } else if (loadTime > this.thresholds.slowLoad && Math.random() < 0.1) { // Only log 10% of slow loads
      console.warn(`[ImagePerformance] Slow image load: ${imageUrl} (${loadTime}ms)`);
    }

    // File size warnings
    if (fileSize > this.thresholds.maxImageSize) {
      console.warn(`[ImagePerformance] Large image file: ${imageUrl} (${this.formatFileSize(fileSize)})`);
    }
  }

  /**
   * Track preload performance
   * @param {string} imageUrl - Image URL
   * @param {boolean} wasPreloaded - Whether image was preloaded
   * @param {number} loadTime - Load time in milliseconds
   */
  trackPreloadPerformance(imageUrl, wasPreloaded, loadTime = 0) {
    if (!this.isEnabled) return;

    if (wasPreloaded) {
      this.metrics.preloadHits++;
      console.log(`[ImagePerformance] Preload HIT: ${imageUrl} (${loadTime}ms)`);
    } else {
      this.metrics.preloadMisses++;
      console.log(`[ImagePerformance] Preload MISS: ${imageUrl} (${loadTime}ms)`);
    }
  }

  /**
   * Track image error
   * @param {string} imageUrl - Image URL
   * @param {string} error - Error message
   */
  trackImageError(imageUrl, error) {
    if (!this.isEnabled) return;

    this.metrics.errors++;
    console.error(`[ImagePerformance] Image load error: ${imageUrl} - ${error}`);
  }

  /**
   * Track compression ratio
   * @param {number} originalSize - Original file size
   * @param {number} compressedSize - Compressed file size
   */
  trackCompressionRatio(originalSize, compressedSize) {
    if (!this.isEnabled || originalSize <= 0) return;

    const ratio = compressedSize / originalSize;
    this.metrics.compressionRatios.push(ratio);
  }

  /**
   * Monitor image loading using Performance Observer - optimized
   */
  startPerformanceMonitoring() {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Monitor resource timing for images - only track slow loads to reduce overhead
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType === 'img' || entry.name.includes('image')) {
            const loadTime = entry.responseEnd - entry.fetchStart;
            
            // Only track slow loads to reduce overhead
            if (loadTime > this.thresholds.slowLoad) {
              const fileSize = entry.transferSize || 0;
              this.trackImageLoad(
                entry.name, 
                loadTime, 
                false, // We can't determine cache hit from resource timing
                fileSize,
                this.detectFormatFromUrl(entry.name)
              );
            }
          }
        }
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);

      console.log('[ImagePerformance] Performance monitoring started (optimized)');
    } catch (error) {
      console.warn('[ImagePerformance] Failed to start performance monitoring:', error);
    }
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    for (const [name, observer] of this.observers.entries()) {
      observer.disconnect();
    }
    this.observers.clear();
    console.log('[ImagePerformance] Performance monitoring stopped');
  }

  /**
   * Detect image format from URL
   * @param {string} url - Image URL
   * @returns {string} Image format
   */
  detectFormatFromUrl(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.webp')) return 'webp';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 'jpeg';
    if (lowerUrl.includes('.png')) return 'png';
    if (lowerUrl.includes('.gif')) return 'gif';
    if (lowerUrl.includes('format=webp')) return 'webp';
    if (lowerUrl.includes('format=jpeg')) return 'jpeg';
    return 'unknown';
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    const totalLoads = this.metrics.loadTimes.size;
    const allLoadTimes = Array.from(this.metrics.loadTimes.values()).flat();
    
    const avgLoadTime = allLoadTimes.length > 0 
      ? allLoadTimes.reduce((sum, item) => sum + item.loadTime, 0) / allLoadTimes.length 
      : 0;

    const cacheHitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(2) + '%'
      : '0%';

    const preloadHitRate = (this.metrics.preloadHits + this.metrics.preloadMisses) > 0
      ? (this.metrics.preloadHits / (this.metrics.preloadHits + this.metrics.preloadMisses) * 100).toFixed(2) + '%'
      : '0%';

    const avgFileSize = this.metrics.responseSizes.length > 0
      ? this.metrics.responseSizes.reduce((sum, size) => sum + size, 0) / this.metrics.responseSizes.length
      : 0;

    const avgCompressionRatio = this.metrics.compressionRatios.length > 0
      ? (this.metrics.compressionRatios.reduce((sum, ratio) => sum + ratio, 0) / this.metrics.compressionRatios.length * 100).toFixed(1) + '%'
      : '0%';

    return {
      totalRequests: this.metrics.totalRequests,
      cacheHitRate,
      preloadHitRate,
      avgLoadTime: avgLoadTime.toFixed(2) + 'ms',
      avgFileSize: this.formatFileSize(avgFileSize),
      avgCompressionRatio,
      errors: this.metrics.errors,
      slowLoads: allLoadTimes.filter(item => item.loadTime > this.thresholds.slowLoad).length,
      verySlowLoads: allLoadTimes.filter(item => item.loadTime > this.thresholds.verySlowLoad).length,
      optimalLoads: allLoadTimes.filter(item => item.loadTime <= this.thresholds.optimalLoad).length
    };
  }

  /**
   * Get detailed performance report
   * @returns {Object} Detailed performance report
   */
  getDetailedReport() {
    const stats = this.getStats();
    const allLoadTimes = Array.from(this.metrics.loadTimes.values()).flat();
    
    // Sort by load time to find slowest images
    const sortedLoadTimes = allLoadTimes
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 10); // Top 10 slowest

    // Group by format
    const formatStats = {};
    allLoadTimes.forEach(item => {
      if (!formatStats[item.format]) {
        formatStats[item.format] = { count: 0, totalTime: 0, avgTime: 0 };
      }
      formatStats[item.format].count++;
      formatStats[item.format].totalTime += item.loadTime;
    });

    // Calculate averages
    Object.keys(formatStats).forEach(format => {
      formatStats[format].avgTime = formatStats[format].totalTime / formatStats[format].count;
    });

    return {
      ...stats,
      slowestImages: sortedLoadTimes.map(item => ({
        url: item.url,
        loadTime: item.loadTime + 'ms',
        fileSize: this.formatFileSize(item.fileSize),
        format: item.format,
        cacheHit: item.cacheHit
      })),
      formatStats,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   * @returns {Array} Array of recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    const allLoadTimes = Array.from(this.metrics.loadTimes.values()).flat();

    // Check cache hit rate
    const cacheHitRateNum = parseFloat(stats.cacheHitRate);
    if (cacheHitRateNum < 50) {
      recommendations.push('Consider implementing better image caching strategies');
    }

    // Check preload hit rate
    const preloadHitRateNum = parseFloat(stats.preloadHitRate);
    if (preloadHitRateNum < 30) {
      recommendations.push('Optimize image preloading strategy for better hit rates');
    }

    // Check for slow loads
    if (stats.slowLoads > allLoadTimes.length * 0.1) {
      recommendations.push('More than 10% of images are loading slowly - consider image optimization');
    }

    // Check file sizes
    const avgFileSizeNum = parseFloat(stats.avgFileSize);
    if (avgFileSizeNum > 500) { // 500KB
      recommendations.push('Average image file size is large - consider better compression');
    }

    // Check compression ratio
    const compressionRatioNum = parseFloat(stats.avgCompressionRatio);
    if (compressionRatioNum > 80) {
      recommendations.push('Image compression could be improved - consider WebP format');
    }

    return recommendations;
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = {
      loadTimes: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalRequests: 0,
      preloadHits: 0,
      preloadMisses: 0,
      compressionRatios: [],
      responseSizes: []
    };
    console.log('[ImagePerformance] Metrics cleared');
  }

  /**
   * Enable/disable monitoring
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[ImagePerformance] Monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const imagePerformanceMonitor = new ImagePerformanceMonitor();

export default imagePerformanceMonitor;
