'use strict';
import { API_BASE_URL } from '../config/api.js';

const SimpleImageService = {
  // Cache for image search results
  imageCache: new Map(),
  cacheTimeout: 10 * 60 * 1000, // 10 minutes - increased for better performance
  
  // Persistent cache for better performance
  persistentCache: new Map(),
  persistentCacheKey: 'imageSearchCache',
  
  // Track active requests to prevent duplicates
  activeRequests: new Map(),

  // Initialize persistent cache from localStorage
  initPersistentCache() {
    try {
      const cached = localStorage.getItem(this.persistentCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        // Only keep entries that haven't expired
        for (const [key, value] of Object.entries(parsed)) {
          if (now - value.timestamp < this.cacheTimeout) {
            this.persistentCache.set(key, value);
          }
        }
        
        console.log(`[SimpleImageService] Loaded ${this.persistentCache.size} cached entries from localStorage`);
      }
    } catch (error) {
      console.warn('[SimpleImageService] Failed to load persistent cache:', error);
    }
  },

  // Save persistent cache to localStorage
  savePersistentCache() {
    try {
      const cacheData = {};
      for (const [key, value] of this.persistentCache.entries()) {
        cacheData[key] = value;
      }
      localStorage.setItem(this.persistentCacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[SimpleImageService] Failed to save persistent cache:', error);
    }
  },

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
    // Check in-memory cache first
    const cached = this.imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('[SimpleImageService] Memory cache HIT for:', cacheKey.substring(0, 50) + '...');
      return cached.data;
    }
    if (cached) {
      this.imageCache.delete(cacheKey); // Remove expired cache
    }
    
    // Check persistent cache
    const persistentCached = this.persistentCache.get(cacheKey);
    if (persistentCached && Date.now() - persistentCached.timestamp < this.cacheTimeout) {
      console.log('[SimpleImageService] Persistent cache HIT for:', cacheKey.substring(0, 50) + '...');
      // Move to memory cache for faster access
      this.imageCache.set(cacheKey, persistentCached);
      return persistentCached.data;
    }
    if (persistentCached) {
      this.persistentCache.delete(cacheKey); // Remove expired cache
    }
    
    return null;
  },

  // Store result in cache
  setCache(cacheKey, data) {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    
    // Store in both caches
    this.imageCache.set(cacheKey, cacheEntry);
    this.persistentCache.set(cacheKey, cacheEntry);
    
    // Save to localStorage periodically
    if (this.persistentCache.size % 10 === 0) {
      this.savePersistentCache();
    }
    
    console.log('[SimpleImageService] Cached result for:', cacheKey.substring(0, 50) + '...');
  },

  // Check if request is already in progress
  isRequestInProgress(cacheKey) {
    return this.activeRequests.has(cacheKey);
  },

  // Add request to active requests
  addActiveRequest(cacheKey, promise) {
    this.activeRequests.set(cacheKey, promise);
  },

  // Remove request from active requests
  removeActiveRequest(cacheKey) {
    this.activeRequests.delete(cacheKey);
  },

  // Simple image search - optimized with caching and timeout
  async search(lessonTitle, content = '', usedImageTitles = [], usedImageUrls = [], courseId = undefined, lessonId = undefined, forceUnique = false) {
    const maxRetries = 2;
    let lastError = null;

    // Initialize persistent cache if not already done
    if (this.persistentCache.size === 0) {
      this.initPersistentCache();
    }

    // Ensure we have a valid lesson title
    if (!lessonTitle || lessonTitle.trim() === '') {
      console.warn('[SimpleImageService] Empty lesson title, using fallback');
      lessonTitle = 'educational content';
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

          // Check if request is already in progress
          if (this.isRequestInProgress(cacheKey)) {
            console.log('[SimpleImageService] Request already in progress, waiting...');
            const existingPromise = this.activeRequests.get(cacheKey);
            const result = await existingPromise;
            return result;
          }
        }

        const searchUrl = `${API_BASE_URL}/api/image-search/search`;
        
        // Optimize query - use shorter, more focused query
        let finalQuery = lessonTitle;
        if (forceUnique) {
          const uniqueStr = Math.random().toString(36).substring(2, 8); // Shorter unique string
          finalQuery = `${lessonTitle} ${uniqueStr}`;
        }
        
        console.log(`[SimpleImageService] Searching for: ${finalQuery} (attempt ${attempt}/${maxRetries})`);

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

        // Create the search promise
        const searchPromise = this._performSearch(searchUrl, requestBody, attempt, maxRetries);
        
        // Track active request if not forceUnique
        if (!forceUnique) {
          const cacheKey = this.getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
          this.addActiveRequest(cacheKey, searchPromise);
        }

        const data = await searchPromise;
        
        // Remove from active requests
        if (!forceUnique) {
          const cacheKey = this.getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
          this.removeActiveRequest(cacheKey);
        }

        // Cache the result if not forceUnique
        if (!forceUnique && data) {
          const cacheKey = this.getCacheKey(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
          this.setCache(cacheKey, data);
        }

        return data;
        
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.error(`[SimpleImageService] Search timeout after 10 seconds on attempt ${attempt}`);
        } else {
          console.error(`[SimpleImageService] Search failed on attempt ${attempt}:`, error.message);
        }

        // Don't retry on AbortError or client errors
        if (error.name === 'AbortError' || (error.message && error.message.includes('4'))) {
          break;
        }

        // Retry on network errors or server errors
        if (attempt < maxRetries) {
          console.log(`[SimpleImageService] Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    console.warn('[SimpleImageService] Search failed after retry, using fallback image');
    return this.getFallbackImage(lessonTitle);
  },

  // Perform the actual search request
  async _performSearch(searchUrl, requestBody, attempt, maxRetries) {
    // Add timeout to prevent hanging requests - increased to 10 seconds for better reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
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
      
      console.warn(`[SimpleImageService] Server returned ${response.status} on attempt ${attempt}`);
      const errorText = await response.text();
      console.error('[SimpleImageService] Error response body:', errorText);
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Image search failed: ${response.status} - ${errorText}`);
      }
      
      // For 5xx errors, continue to retry
      throw new Error(`Image search failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[SimpleImageService] Found image:', data.title);
    return data;
  },

  // Enhanced search with course context - optimized
  searchWithContext: async function(lessonTitle, courseSubject, content, usedImageTitles, usedImageUrls, courseId = undefined, lessonId = undefined, coursePrompt = null) {
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

      // Try the enhanced search first
      const result = await this.search(enhancedQuery, content, usedImageTitles, usedImageUrls, courseId, lessonId);
      
      // If enhanced search fails, try with just the lesson title
      if (!result || !result.url) {
        console.log('[SimpleImageService] Enhanced search failed, trying basic search...');
        return await this.search(lessonTitle, content, usedImageTitles, usedImageUrls, courseId, lessonId);
      }
      
      return result;

    } catch (error) {
      console.error('[SimpleImageService] Enhanced search failed:', error);
      // Fallback to basic search with safe parameters
      try {
        return await this.search(
          lessonTitle || '',
          typeof content === 'string' ? content : '',
          Array.isArray(usedImageTitles) ? usedImageTitles : [],
          Array.isArray(usedImageUrls) ? usedImageUrls : [],
          courseId,
          lessonId
        );
      } catch (fallbackError) {
        console.error('[SimpleImageService] Fallback search also failed:', fallbackError);
        // Return a guaranteed fallback image
        return this.getFallbackImage(lessonTitle || 'educational content');
      }
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
  },

  // Get fallback image when search fails
  getFallbackImage(lessonTitle) {
    // Create a fallback image based on the lesson title
    const fallbackImages = [
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
    ];

    // Select a fallback image based on lesson title keywords
    let selectedFallback = fallbackImages[0];
    
    if (lessonTitle.toLowerCase().includes('history') || lessonTitle.toLowerCase().includes('ancient')) {
      selectedFallback = fallbackImages[1];
    } else if (lessonTitle.toLowerCase().includes('science') || lessonTitle.toLowerCase().includes('technology')) {
      selectedFallback = fallbackImages[2];
    }

    console.log(`[SimpleImageService] Using fallback image: ${selectedFallback.title}`);
    return selectedFallback;
  }
};

export default SimpleImageService; 