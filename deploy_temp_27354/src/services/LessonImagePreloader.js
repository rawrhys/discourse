import SimpleImageService from './SimpleImageService.js';
import imagePreloadService from './ImagePreloadService.js';

class LessonImagePreloader {
  constructor() {
    this.preloadCache = new Map();
  }

  // Simple preload for a lesson
  async preloadLessonImage(lessonData, subject, courseId) {
    if (!lessonData?.title || !courseId) {
      return null;
    }

    const lessonKey = `${courseId}_${lessonData.id}_${lessonData.title}`;
    
    // Check if already preloaded
    if (this.preloadCache.has(lessonKey)) {
      console.log('[LessonImagePreloader] Using cached preload for:', lessonData.title);
      return this.preloadCache.get(lessonKey);
    }

    console.log('[LessonImagePreloader] Starting preload for:', lessonData.title);

    try {
      // Get image from SimpleImageService
      const result = await SimpleImageService.search(
        lessonData.title,
        courseId,
        lessonData.id
      );

      if (result && result.url) {
        // Preload the image
        await imagePreloadService.preloadImage(result.url, 'high');
        console.log('[LessonImagePreloader] Preloaded:', result.title);
      }

      // Cache the result
      this.preloadCache.set(lessonKey, result);
      return result;

    } catch (error) {
      console.warn('[LessonImagePreloader] Preload failed for:', lessonData.title, error);
      return null;
    }
  }

  // Get preloaded image data
  getPreloadedImage(lessonId, lessonTitle, subject) {
    // Simple lookup - could be improved with better key generation
    for (const [key, value] of this.preloadCache.entries()) {
      if (key.includes(lessonId) || key.includes(lessonTitle)) {
        return value;
      }
    }
    return null;
  }

  // Clear cache
  clearCache() {
    this.preloadCache.clear();
    console.log('[LessonImagePreloader] Cache cleared');
  }
}

// Export singleton instance
const lessonImagePreloader = new LessonImagePreloader();
export default lessonImagePreloader;
