class ImagePreloadService {
  constructor() {
    this.preloadedImages = new Set();
    this.preloadQueue = [];
    this.isProcessing = false;
    this.maxConcurrent = 3; // Limit concurrent preloads
    this.activePreloads = 0;
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

    // Add to queue with priority
    this.preloadQueue.push({ url: imageUrl, priority });
    this.preloadQueue.sort((a, b) => b.priority - a.priority); // Sort by priority

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return new Promise((resolve) => {
      // Store resolve function to call when preload completes
      this.preloadQueue.find(item => item.url === imageUrl).resolve = resolve;
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
          if (item.resolve) {
            item.resolve(success);
          }
        })
        .catch(() => {
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
   * Preload a single image
   * @param {string} imageUrl - Image URL
   * @returns {Promise<boolean>} - Success status
   */
  async preloadSingleImage(imageUrl) {
    try {
      // Create link preload element
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = imageUrl;
      link.fetchPriority = 'high';
      
      // Add to head
      document.head.appendChild(link);

      // Wait for load or error
      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          this.preloadedImages.add(imageUrl);
          document.head.removeChild(link);
          console.log(`[ImagePreloadService] Successfully preloaded: ${imageUrl}`);
          resolve(true);
        };

        img.onerror = () => {
          document.head.removeChild(link);
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
    const promises = imageUrls.map(url => this.preloadImage(url, priority));
    return Promise.all(promises);
  }

  /**
   * Check if an image is already preloaded
   * @param {string} imageUrl - Image URL
   * @returns {boolean} - Whether image is preloaded
   */
  isPreloaded(imageUrl) {
    return this.preloadedImages.has(imageUrl);
  }

  /**
   * Clear preloaded images cache
   */
  clearCache() {
    this.preloadedImages.clear();
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
      queueLength: this.preloadQueue.length,
      activePreloads: this.activePreloads,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Preload images for a lesson with smart prioritization
   * @param {Array} imageUrls - Array of image URLs
   * @param {number} visibleIndex - Index of currently visible image
   * @returns {Promise<Array>} - Array of success statuses
   */
  async preloadLessonImages(imageUrls, visibleIndex = 0) {
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    const promises = imageUrls.map((url, index) => {
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

// Create singleton instance
const imagePreloadService = new ImagePreloadService();

export default imagePreloadService;
