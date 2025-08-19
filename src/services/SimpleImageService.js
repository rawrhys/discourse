'use strict';
import { API_BASE_URL } from '../config/api.js';

const SimpleImageService = {
  // Simple in-memory cache
  cache: new Map(),
  cacheTimeout: 30 * 60 * 1000, // 30 minutes

  // Basic fallback images
  fallbackImages: [
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
      title: 'Educational Content',
      pageURL: 'https://commons.wikimedia.org/wiki/File:Profile_avatar_placeholder_large.png',
      attribution: 'Wikimedia Commons',
      uploader: 'Wikimedia'
    },
    {
      url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
      title: 'Learning and Education',
      pageURL: 'https://unsplash.com/photos/books-on-table',
      attribution: 'Unsplash',
      uploader: 'Unsplash'
    },
    {
      url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop',
      title: 'Knowledge and Wisdom',
      pageURL: 'https://unsplash.com/photos/library-books',
      attribution: 'Unsplash',
      uploader: 'Unsplash'
    }
  ],

  // Simple cache key generation
  getCacheKey(lessonTitle, courseId, lessonId) {
    return `${courseId}_${lessonId}_${lessonTitle?.substring(0, 50) || 'default'}`;
  },

  // Get from cache
  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('[SimpleImageService] Cache HIT:', cacheKey);
      return cached.data;
    }
    if (cached) {
      this.cache.delete(cacheKey); // Remove expired
    }
    return null;
  },

  // Set cache
  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    console.log('[SimpleImageService] Cached:', cacheKey);
  },

  // Basic image search
  async search(lessonTitle, courseId, lessonId) {
    // Validate inputs
    if (!lessonTitle || !courseId || !lessonId) {
      console.warn('[SimpleImageService] Missing required parameters');
      return this.getFallbackImage(lessonTitle);
    }

    const cacheKey = this.getCacheKey(lessonTitle, courseId, lessonId);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log('[SimpleImageService] Searching for:', lessonTitle);
      
      const response = await fetch(`${API_BASE_URL}/api/image-search/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lessonTitle.substring(0, 100),
          content: '',
          usedImageTitles: [],
          usedImageUrls: [],
          courseId,
          lessonId,
          disableModeration: true
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.url) {
        console.log('[SimpleImageService] Found image:', data.title);
        this.setCache(cacheKey, data);
        return data;
      } else {
        throw new Error('No image data received');
      }

    } catch (error) {
      console.warn('[SimpleImageService] Search failed:', error.message);
      const fallback = this.getFallbackImage(lessonTitle);
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  },

  // Get appropriate fallback image
  getFallbackImage(lessonTitle) {
    const title = lessonTitle?.toLowerCase() || '';
    
    if (title.includes('history') || title.includes('ancient')) {
      return this.fallbackImages[1];
    } else if (title.includes('science') || title.includes('technology')) {
      return this.fallbackImages[2];
    }
    
    return this.fallbackImages[0];
  },

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('[SimpleImageService] Cache cleared');
  },

  // Get cache stats
  getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < this.cacheTimeout) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired
    };
  }
};

export default SimpleImageService; 