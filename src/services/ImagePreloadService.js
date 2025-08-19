class ImagePreloadService {
  constructor() {
    this.preloadedImages = new Set();
    this.preloadQueue = [];
    this.isProcessing = false;
    this.maxConcurrent = 3; // Increased to 3 for better performance
    this.activePreloads = 0;
    this.preloadCache = new Map(); // Add cache to prevent duplicate preloads
    this.batchSize = 5; // Process images in batches
    this.retryAttempts = 2; // Allow retries for failed preloads
  }

  /**
   * Preload an image with priority management
   * @param {string} imageUrl - Image URL to preload
   * @param {number} priority - Priority level (1-10, 10 being highest)
   * @returns {Promise<boolean>} - Whether preload was successful
   */
  async preloadImage(imageUrl, priority = 5) {
    if (!imageUrl || this.preloadedImages.has(imageUrl)) {
      return true; // Already preloaded or invalid URL
    }

    // Check if already in cache
    if (this.preloadCache.has(imageUrl)) {
      console.log(`[ImagePreloadService] Image already in cache: ${imageUrl}`);
      return this.preloadCache.get(imageUrl);
    }

    return new Promise((resolve) => {
      // Add to queue with priority and resolve function
      this.preloadQueue.push({ url: imageUrl, priority, resolve });
    this.preloadQueue.sort((a, b) => b.priority - a.priority); // Sort by priority

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    });
  }

  /**
   * Process the preload queue
   */
  async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.preloadQueue.length > 0 && this.activePreloads < this.maxConcurrent) {
      const item = this.preloadQueue.shift();
      this.activePreloads++;

      this.preloadSingleImage(item.url)
        .then(success => {
          // Cache the result
          this.preloadCache.set(item.url, success);
          if (item.resolve) {
            item.resolve(success);
          }
        })
        .catch(() => {
          // Cache failed result to prevent retries
          this.preloadCache.set(item.url, false);
          if (item.resolve) {
            item.resolve(false);
          }
        })
        .finally(() => {
          this.activePreloads--;
          this.processQueue(); // Continue processing
        });
    }

    this.isProcessing = false;
  }

  /**
   * Preload a single image with enhanced performance
   * @param {string} imageUrl - Image URL
   * @returns {Promise<boolean>} - Success status
   */
  async preloadSingleImage(imageUrl) {
    try {
      // Check if preload link already exists
      const existingLink = document.querySelector(`link[rel="preload"][href="${imageUrl}"]`);
      if (existingLink) {
        console.log(`[ImagePreloadService] Preload link already exists for: ${imageUrl}`);
        return true;
      }

      // Create link preload element with enhanced settings
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = imageUrl;
      link.fetchPriority = 'high';
      
      // Fix credentials mismatch: use consistent crossorigin settings
      if (imageUrl.includes('api/image/') || imageUrl.includes('pixabay.com') || imageUrl.includes('wikimedia.org')) {
        link.crossOrigin = 'anonymous';
      }

      // Add to head
      document.head.appendChild(link);

      // Wait for load or error with enhanced timeout
      return new Promise((resolve) => {
        const img = new Image();
        let timeoutId;

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (document.head.contains(link)) {
            document.head.removeChild(link);
          }
        };

        // Set timeout for slow loads
        timeoutId = setTimeout(() => {
          cleanup();
          console.warn(`[ImagePreloadService] Timeout preloading: ${imageUrl}`);
          resolve(false);
        }, 10000); // 10 second timeout

        // Fix credentials mismatch: use consistent crossorigin settings
        if (imageUrl.includes('api/image/') || imageUrl.includes('pixabay.com') || imageUrl.includes('wikimedia.org')) {
          img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
          cleanup();
          this.preloadedImages.add(imageUrl);
          console.log(`[ImagePreloadService] Successfully preloaded: ${imageUrl}`);
          resolve(true);
        };

        img.onerror = () => {
          cleanup();
          console.warn(`[ImagePreloadService] Failed to preload: ${imageUrl}`);
          resolve(false);
        };

        img.src = imageUrl;
      });

    } catch (error) {
      console.error(`[ImagePreloadService] Error preloading ${imageUrl}:`, error);
      return false;
    }
  }

  /**
   * Preload multiple images with priority
   * @param {Array} imageUrls - Array of image URLs
   * @param {number} priority - Priority level for all images
   * @returns {Promise<Array>} - Array of success statuses
   */
  async preloadImages(imageUrls, priority = 5) {
    // Deduplicate URLs first
    const uniqueUrls = [...new Set(imageUrls)];
    const promises = uniqueUrls.map(url => this.preloadImage(url, priority));
    return Promise.all(promises);
  }

  /**
   * Check if an image is already preloaded
   * @param {string} imageUrl - Image URL
   * @returns {boolean} - Whether image is preloaded
   */
  isPreloaded(imageUrl) {
    return this.preloadedImages.has(imageUrl) || this.preloadCache.has(imageUrl);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.preloadedImages.clear();
    this.preloadCache.clear();
    this.preloadQueue = [];
    console.log('[ImagePreloadService] Cache cleared');
  }

  /**
   * Get preload statistics
   * @returns {Object} - Statistics about preloaded images
   */
  getStats() {
    return {
      preloadedCount: this.preloadedImages.size,
      cachedCount: this.preloadCache.size,
      queueLength: this.preloadQueue.length,
      activePreloads: this.activePreloads,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Preload images for a lesson with smart prioritization
   * @param {Array|Object} imageUrlsOrLesson - Array of image URLs or lesson object
   * @param {number} visibleIndex - Index of currently visible image
   * @returns {Promise<Array>} - Array of success statuses
   */
  async preloadLessonImages(imageUrlsOrLesson, visibleIndex = 0) {
    let imageUrls = [];
    
    // Handle both array of URLs and lesson object
    if (Array.isArray(imageUrlsOrLesson)) {
      imageUrls = imageUrlsOrLesson;
    } else if (imageUrlsOrLesson && typeof imageUrlsOrLesson === 'object') {
      // Extract image URL from lesson object
      if (imageUrlsOrLesson.image) {
        const imageUrl = imageUrlsOrLesson.image.imageUrl || imageUrlsOrLesson.image.url;
        if (imageUrl) {
          imageUrls = [imageUrl];
        }
      }
    }
    
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    // Deduplicate URLs first
    const uniqueUrls = [...new Set(imageUrls)];

    const promises = uniqueUrls.map((url, index) => {
      // Calculate priority based on distance from visible image
      const distance = Math.abs(index - visibleIndex);
      let priority;

      if (distance === 0) {
        priority = 10; // Currently visible
      } else if (distance === 1) {
        priority = 8; // Adjacent images
      } else if (distance <= 3) {
        priority = 6; // Nearby images
      } else {
        priority = 4; // Distant images
      }

      return this.preloadImage(url, priority);
    });

    return Promise.all(promises);
  }
}

// Export singleton instance
const imagePreloadService = new ImagePreloadService();
export default imagePreloadService;
