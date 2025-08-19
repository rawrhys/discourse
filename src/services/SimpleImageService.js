'use strict';
import { API_BASE_URL } from '../config/api.js';

const SimpleImageService = {
  // Cache for image search results
  imageCache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 minutes

  // Test server connectivity
  async testServerConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/image-search/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonTitle: 'test', content: '', usedImageTitles: [], usedImageUrls: [] })
      });
      return response.ok;
    } catch (error) {
      console.error('[SimpleImageService] Server test error:', error);
      return false;
    }
  },

  // Get cache key for search - optimized for better performance
  getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId) {
    // Ensure arrays are actually arrays before calling slice
    const safeUsedImageTitles = Array.isArray(usedImageTitles) ? usedImageTitles.slice(0, 3) : [];
    const safeUsedImageUrls = Array.isArray(usedImageUrls) ? usedImageUrls.slice(0, 3) : [];

    // Truncate content more aggressively for faster cache key generation
    const truncatedContent = content ? content.substring(0, 50) : '';

    const key = JSON.stringify({
      lessonTitle: lessonTitle ? lessonTitle.substring(0, 100) : '',
      content: truncatedContent,
      usedImageTitles: safeUsedImageTitles,
      usedImageUrls: safeUsedImageUrls,
      courseId,
      lessonId
    });
    return key;
  },

  // Check cache for existing result
  getFromCache(cacheKey) {
    const cached = this.imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('[SimpleImageService] Cache HIT for:', cacheKey.substring(0, 50) + '...');
      return cached.data;
    }
    if (cached) {
      this.imageCache.delete(cacheKey); // Remove expired cache
    }
    return null;
  },

  // Store result in cache
  setCache(cacheKey, data) {
    this.imageCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    console.log('[SimpleImageService] Cached result for:', cacheKey.substring(0, 50) + '...');
  },

  // Simple image search - optimized with caching and timeout
  async search(lessonTitle, content = '', usedImageTitles = [], usedImageUrls = [], courseId = undefined, lessonId = undefined, forceUnique = false) {
    try {
      // Ensure parameters are properly typed
      lessonTitle = lessonTitle || '';
      content = content || '';
      usedImageTitles = Array.isArray(usedImageTitles) ? usedImageTitles : [];
      usedImageUrls = Array.isArray(usedImageUrls) ? usedImageUrls : [];

      // Skip cache if forceUnique is true
      if (!forceUnique) {
        const cacheKey = this.getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const searchUrl = `${API_BASE_URL}/api/image-search/search`;

      // Optimize query - use shorter, more focused query
      let finalQuery = lessonTitle;
      if (forceUnique) {
        const uniqueStr = Math.random().toString(36).substring(2, 8); // Shorter unique string
        finalQuery = `${lessonTitle} ${uniqueStr}`;
      }

      console.log('[SimpleImageService] Searching for:', finalQuery);

      // Truncate content more aggressively for faster requests
      const truncatedContent = content.length > 500 ? content.substring(0, 500) + '...' : content;

      const requestBody = {
        lessonTitle: finalQuery,
        content: truncatedContent,
        usedImageTitles,
        usedImageUrls,
        courseId,
        lessonId,
        disableModeration: true
      };

      // Add timeout to prevent hanging requests - reduced to 8 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          const errorText = await response.text();
          console.log(`[SimpleImageService] No suitable image found. Server response: ${errorText}`);
          return null;
        }

        console.warn(`[SimpleImageService] Server returned ${response.status}`);
        const errorText = await response.text();
        console.error('[SimpleImageService] Error response body:', errorText);
        throw new Error(`Image search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[SimpleImageService] Found image:', data.title);

      // Cache the result if not forceUnique
      if (!forceUnique) {
        const cacheKey = this.getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
        this.setCache(cacheKey, data);
      }

      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[SimpleImageService] Search timeout after 8 seconds');
      } else {
        console.error('[SimpleImageService] Search failed:', error.message);
      }

      // Return null to let the calling code handle the error appropriately
      return null;
    }
  },

  // Enhanced search with course context - optimized
  searchWithContext: function(lessonTitle, courseSubject, content, usedImageTitles, usedImageUrls, courseId = undefined, lessonId = undefined, coursePrompt = null) {
    try {
      // Ensure all parameters are properly typed
      lessonTitle = lessonTitle || '';
      courseSubject = courseSubject || '';
      usedImageTitles = Array.isArray(usedImageTitles) ? usedImageTitles : [];
      usedImageUrls = Array.isArray(usedImageUrls) ? usedImageUrls : [];

      // Ensure content is a string and handle various input types
      if (content) {
        if (typeof content === 'object') {
          // If content is an object, try to extract text content
          if (content.text) {
            content = content.text;
          } else if (content.content) {
            content = content.content;
          } else if (content.main_content) {
            content = content.main_content;
          } else {
            // Try to stringify the object and extract meaningful text
            content = JSON.stringify(content);
          }
        }

        // Ensure content is a string
        content = String(content);

        // Limit content length to prevent overly large requests - reduced to 500 chars
        if (content.length > 500) {
          content = content.substring(0, 500) + '...';
        }
      } else {
        content = '';
      }

      // Create enhanced query with course context - simplified for better performance
      let enhancedQuery = lessonTitle;
      if (courseSubject && courseSubject !== lessonTitle) {
        // Use shorter, more focused query
        enhancedQuery = `${courseSubject} ${lessonTitle}`;
      }

      if (coursePrompt) {
        // Truncate course prompt to prevent overly long queries
        const truncatedPrompt = coursePrompt.length > 100 ? coursePrompt.substring(0, 100) + '...' : coursePrompt;
        enhancedQuery = `${truncatedPrompt} ${enhancedQuery}`;
      }

      console.log('[SimpleImageService] Enhanced query created:', enhancedQuery);

      return this.search(enhancedQuery, content, usedImageTitles, usedImageUrls, courseId, lessonId);

    } catch (error) {
      console.error('[SimpleImageService] Enhanced search failed:', error);
      // Fallback to basic search with safe parameters
      return this.search(
        lessonTitle || '',
        typeof content === 'string' ? content : '',
        Array.isArray(usedImageTitles) ? usedImageTitles : [],
        Array.isArray(usedImageUrls) ? usedImageUrls : [],
        courseId,
        lessonId
      );
    }
  },

  // Clear cache
  clearCache() {
    this.imageCache.clear();
    console.log('[SimpleImageService] Cache cleared');
  },

  // Get cache statistics
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.imageCache.size,
      validEntries,
      expiredEntries,
      cacheTimeout: this.cacheTimeout
    };
  }
};

export default SimpleImageService; 