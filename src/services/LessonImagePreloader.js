import SimpleImageService from './SimpleImageService.js';
import imagePreloadService from './ImagePreloadService.js';

class LessonImagePreloader {
  constructor() {
    this.preloadCache = new Map();
    this.activePreloads = new Map();
    this.preloadQueue = [];
  }

  /**
   * Start preloading images for a lesson while it's being prepared
   * @param {Object} lessonData - Lesson data including title, content, etc.
   * @param {string} subject - Course subject
   * @param {string} courseId - Course ID
   * @param {Array} usedImageTitles - Already used image titles
   * @param {Array} usedImageUrls - Already used image URLs
   * @param {string} courseDescription - Course description
   * @returns {Promise<Object|null>} - Preloaded image data or null
   */
  async preloadLessonImage(lessonData, subject, courseId, usedImageTitles = [], usedImageUrls = [], courseDescription = '') {
    const lessonKey = `${lessonData.id}-${lessonData.title}-${subject}`;
    
    // Check if already preloaded
    if (this.preloadCache.has(lessonKey)) {
      console.log('[LessonImagePreloader] Using cached preload for:', lessonData.title);
      return this.preloadCache.get(lessonKey);
    }

    // Check if already preloading
    if (this.activePreloads.has(lessonKey)) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[LessonImagePreloader] Already preloading for:', lessonData.title);
      }
      return this.activePreloads.get(lessonKey);
    }

    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonImagePreloader] Starting preload for:', lessonData.title);
    }

    // Start preloading in background
    const preloadPromise = this._performPreload(lessonData, subject, courseId, usedImageTitles, usedImageUrls, courseDescription);
    
    // Store the promise so we can return it if requested again
    this.activePreloads.set(lessonKey, preloadPromise);

    try {
      const result = await preloadPromise;
      this.preloadCache.set(lessonKey, result);
      this.activePreloads.delete(lessonKey);
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[LessonImagePreloader] Preload completed for:', lessonData.title);
      }
      return result;
    } catch (error) {
      this.activePreloads.delete(lessonKey);
      console.warn('[LessonImagePreloader] Preload failed for:', lessonData.title, error);
      return null;
    }
  }

  /**
   * Perform the actual image preload
   * @private
   */
  async _performPreload(lessonData, subject, courseId, usedImageTitles, usedImageUrls, courseDescription) {
    try {
      // Use SimpleImageService to search for image
      const result = await SimpleImageService.searchWithContext(
        lessonData.title,
        subject,
        lessonData.content,
        usedImageTitles,
        usedImageUrls,
        courseId,
        lessonData.id,
        courseDescription
      );

      if (result && result.url) {
        // Also preload the image using ImagePreloadService
        await imagePreloadService.preloadImage(result.url, 10);
        console.log('[LessonImagePreloader] Image preloaded successfully:', result.title);
      }

      return result;
    } catch (error) {
      console.error('[LessonImagePreloader] Preload error:', error);
      throw error;
    }
  }

  /**
   * Get preloaded image data for a lesson
   * @param {string} lessonId - Lesson ID
   * @param {string} lessonTitle - Lesson title
   * @param {string} subject - Course subject
   * @returns {Object|null} - Preloaded image data or null
   */
  getPreloadedImage(lessonId, lessonTitle, subject) {
    const lessonKey = `${lessonId}-${lessonTitle}-${subject}`;
    return this.preloadCache.get(lessonKey) || null;
  }

  /**
   * Check if image is being preloaded for a lesson
   * @param {string} lessonId - Lesson ID
   * @param {string} lessonTitle - Lesson title
   * @param {string} subject - Course subject
   * @returns {boolean} - Whether image is being preloaded
   */
  isPreloading(lessonId, lessonTitle, subject) {
    const lessonKey = `${lessonId}-${lessonTitle}-${subject}`;
    return this.activePreloads.has(lessonKey);
  }

  /**
   * Clear preload cache
   */
  clearCache() {
    this.preloadCache.clear();
    this.activePreloads.clear();
    console.log('[LessonImagePreloader] Cache cleared');
  }

  /**
   * Get preload statistics
   * @returns {Object} - Statistics about preloaded images
   */
  getStats() {
    return {
      cachedCount: this.preloadCache.size,
      activePreloads: this.activePreloads.size,
      queueLength: this.preloadQueue.length
    };
  }
}

// Export singleton instance
const lessonImagePreloader = new LessonImagePreloader();
export default lessonImagePreloader;
