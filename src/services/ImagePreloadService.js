class ImagePreloadService {
  constructor() {
    this.preloadedImages = new Set();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.maxConcurrentPreloads = 3;
    this.activePreloads = 0;
    this.preloadCache = new Map();
    
    // Performance monitoring
    this.stats = {
      preloaded: 0,
      failed: 0,
      cacheHits: 0,
      totalRequests: 0
    };
  }

  /**
   * Preload images for a lesson
   * @param {Object} lesson - Lesson object containing image data
   * @param {number} priority - Preload priority (1-10, higher = more important)
   */
  async preloadLessonImages(lesson, priority = 5) {
    if (!lesson || !lesson.image) return;

    const imageUrl = lesson.image.imageUrl || lesson.image.url;
    if (!imageUrl || this.preloadedImages.has(imageUrl)) {
      this.stats.cacheHits++;
      return;
    }

    this.addToPreloadQueue(imageUrl, priority, lesson.title);
  }

  /**
   * Preload images for multiple lessons (e.g., next few lessons in module)
   * @param {Array} lessons - Array of lesson objects
   * @param {number} maxLessons - Maximum number of lessons to preload
   */
  async preloadMultipleLessons(lessons, maxLessons = 3) {
    if (!Array.isArray(lessons) || lessons.length === 0) return;

    const lessonsToPreload = lessons.slice(0, maxLessons);
    
    // Sort by priority (current lesson first, then next lessons)
    const preloadPromises = lessonsToPreload.map((lesson, index) => {
      const priority = 10 - index; // Higher priority for closer lessons
      return this.preloadLessonImages(lesson, priority);
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Add image to preload queue
   * @param {string} imageUrl - Image URL to preload
   * @param {number} priority - Priority level (1-10)
   * @param {string} description - Description for logging
   */
  addToPreloadQueue(imageUrl, priority = 5, description = '') {
    if (!imageUrl || this.preloadedImages.has(imageUrl)) {
      this.stats.cacheHits++;
      return;
    }

    this.preloadQueue.push({
      url: imageUrl,
      priority,
      description,
      timestamp: Date.now()
    });

    // Sort queue by priority (highest first)
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    // Start processing if not already running
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  /**
   * Process the preload queue
   */
  async processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;

    while (this.preloadQueue.length > 0 && this.activePreloads < this.maxConcurrentPreloads) {
      const item = this.preloadQueue.shift();
      if (!item) continue;

      this.activePreloads++;
      this.preloadImage(item.url, item.description)
        .finally(() => {
          this.activePreloads--;
        });
    }

    this.isPreloading = false;

    // Continue processing if there are more items
    if (this.preloadQueue.length > 0) {
      setTimeout(() => this.processPreloadQueue(), 100);
    }
  }

  /**
   * Preload a single image
   * @param {string} imageUrl - Image URL to preload
   * @param {string} description - Description for logging
   */
  async preloadImage(imageUrl, description = '') {
    try {
      this.stats.totalRequests++;

      // Check if already cached
      if (this.preloadCache.has(imageUrl)) {
        this.stats.cacheHits++;
        return this.preloadCache.get(imageUrl);
      }

      // Create image element for preloading
      const img = new Image();
      
      const preloadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          this.preloadedImages.add(imageUrl);
          this.preloadCache.set(imageUrl, img);
          this.stats.preloaded++;
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[ImagePreload] Successfully preloaded: ${description || imageUrl}`);
          }
          
          resolve(img);
        };

        img.onerror = (error) => {
          this.stats.failed++;
          console.warn(`[ImagePreload] Failed to preload: ${description || imageUrl}`, error);
          reject(error);
        };
      });

      // Set crossOrigin for external images
      if (imageUrl.includes('http') && !imageUrl.includes(window.location.origin)) {
        img.crossOrigin = 'anonymous';
      }

      // Start loading
      img.src = imageUrl;

      return await preloadPromise;

    } catch (error) {
      console.error(`[ImagePreload] Error preloading image: ${imageUrl}`, error);
      throw error;
    }
  }

  /**
   * Preload images for a course module
   * @param {Object} module - Module object containing lessons
   * @param {number} currentLessonIndex - Current lesson index
   * @param {number} preloadCount - Number of lessons to preload ahead
   */
  async preloadModuleImages(module, currentLessonIndex = 0, preloadCount = 3) {
    if (!module || !module.lessons) return;

    const lessons = module.lessons;
    const nextLessons = lessons.slice(currentLessonIndex + 1, currentLessonIndex + 1 + preloadCount);
    
    await this.preloadMultipleLessons(nextLessons, preloadCount);
  }

  /**
   * Preload images based on user navigation patterns
   * @param {Array} navigationHistory - Array of recent lesson visits
   * @param {Object} currentCourse - Current course object
   */
  async preloadBasedOnNavigation(navigationHistory, currentCourse) {
    if (!navigationHistory || navigationHistory.length < 2) return;

    // Analyze navigation patterns
    const recentVisits = navigationHistory.slice(-5);
    const nextLessonPredictions = this.predictNextLessons(recentVisits, currentCourse);

    // Preload predicted lessons
    for (const prediction of nextLessonPredictions) {
      if (prediction.lesson && prediction.lesson.image) {
        await this.preloadLessonImages(prediction.lesson, prediction.confidence);
      }
    }
  }

  /**
   * Predict next lessons based on navigation history
   * @param {Array} recentVisits - Recent lesson visits
   * @param {Object} currentCourse - Current course object
   * @returns {Array} Array of predicted lessons with confidence scores
   */
  predictNextLessons(recentVisits, currentCourse) {
    const predictions = [];

    if (!currentCourse || !currentCourse.modules) return predictions;

    // Simple prediction: next lesson in sequence
    const lastVisit = recentVisits[recentVisits.length - 1];
    if (lastVisit && lastVisit.moduleIndex !== undefined && lastVisit.lessonIndex !== undefined) {
      const currentModule = currentCourse.modules[lastVisit.moduleIndex];
      if (currentModule && currentModule.lessons) {
        // Next lesson in same module
        const nextLessonIndex = lastVisit.lessonIndex + 1;
        if (nextLessonIndex < currentModule.lessons.length) {
          predictions.push({
            lesson: currentModule.lessons[nextLessonIndex],
            confidence: 0.8
          });
        }

        // First lesson of next module
        const nextModuleIndex = lastVisit.moduleIndex + 1;
        if (nextModuleIndex < currentCourse.modules.length) {
          const nextModule = currentCourse.modules[nextModuleIndex];
          if (nextModule && nextModule.lessons && nextModule.lessons.length > 0) {
            predictions.push({
              lesson: nextModule.lessons[0],
              confidence: 0.6
            });
          }
        }
      }
    }

    return predictions;
  }

  /**
   * Clear preloaded images cache
   */
  clearCache() {
    this.preloadedImages.clear();
    this.preloadCache.clear();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.activePreloads = 0;
    
    console.log('[ImagePreload] Cache cleared');
  }

  /**
   * Get preload statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.totalRequests > 0 
        ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      queueLength: this.preloadQueue.length,
      activePreloads: this.activePreloads,
      cachedImages: this.preloadCache.size
    };
  }

  /**
   * Check if an image is preloaded
   * @param {string} imageUrl - Image URL to check
   * @returns {boolean} True if image is preloaded
   */
  isPreloaded(imageUrl) {
    return this.preloadedImages.has(imageUrl) || this.preloadCache.has(imageUrl);
  }

  /**
   * Get preloaded image element
   * @param {string} imageUrl - Image URL
   * @returns {HTMLImageElement|null} Preloaded image element or null
   */
  getPreloadedImage(imageUrl) {
    return this.preloadCache.get(imageUrl) || null;
  }
}

// Create singleton instance
const imagePreloadService = new ImagePreloadService();

export default imagePreloadService;
