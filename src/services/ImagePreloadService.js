import advancedCacheService from './AdvancedCacheService.js';

class ImagePreloadService {
  constructor() {
    this.preloadedImages = new Set();
    this.maxConcurrent = 3; // Increased for better performance
    this.activePreloads = 0;
    this.cache = advancedCacheService;
  }

  // Enhanced preload with caching
  async preloadImage(imageUrl, priority = 'low') {
    if (!imageUrl) return false;

    // Check cache first
    const cacheKey = `preload:${imageUrl}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ImagePreloadService] Cache hit for: ${imageUrl}`);
      return true;
    }

    // Check if already preloaded
    if (this.preloadedImages.has(imageUrl)) {
      return true;
    }

    // Wait if too many concurrent preloads
    while (this.activePreloads >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced wait time
    }

    this.activePreloads++;

    try {
      const success = await this._preloadSingleImage(imageUrl);
      if (success) {
        this.preloadedImages.add(imageUrl);
        // Cache the preload result for 10 minutes
        this.cache.set(cacheKey, { success: true, timestamp: Date.now() }, 600000);
      }
      return success;
    } finally {
      this.activePreloads--;
    }
  }

  // Preload a single image
  async _preloadSingleImage(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        console.warn(`[ImagePreloadService] Timeout: ${imageUrl}`);
        resolve(false);
      }, 5000); // 5 second timeout

      img.onload = () => {
        clearTimeout(timeout);
        console.log(`[ImagePreloadService] Preloaded: ${imageUrl}`);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.warn(`[ImagePreloadService] Failed: ${imageUrl}`);
        resolve(false);
      };

      // Set cross-origin for external images
      if (imageUrl.includes('api/image/') || imageUrl.includes('pixabay.com') || imageUrl.includes('wikimedia.org')) {
        img.crossOrigin = 'anonymous';
      }

      img.src = imageUrl;
    });
  }

  // Check if image is preloaded
  isPreloaded(imageUrl) {
    return this.preloadedImages.has(imageUrl);
  }

  // Clear preloaded images
  clearPreloaded() {
    this.preloadedImages.clear();
    console.log('[ImagePreloadService] Cleared preloaded images');
  }

  // Get performance statistics
  getStats() {
    const cacheStats = this.cache.getStats();
    return {
      preloadedCount: this.preloadedImages.size,
      activePreloads: this.activePreloads,
      maxConcurrent: this.maxConcurrent,
      cacheStats
    };
  }

  // Get cache statistics
  getCacheStats() {
    return this.cache.getStats();
  }
}

// Export singleton instance
const imagePreloadService = new ImagePreloadService();
export default imagePreloadService;
