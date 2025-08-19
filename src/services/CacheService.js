// src/services/CacheService.js
import apiClient from './apiClient.js';

const CacheService = {
  // Original cache methods
  async purgeImageCache({ substring, substrings, useDisallowed = false, all = false, courseId } = {}) {
    const body = {};
    if (Array.isArray(substrings) && substrings.length > 0) body.substrings = substrings;
    if (typeof substring === 'string' && substring.trim()) body.substring = substring.trim();
    if (useDisallowed) body.useDisallowed = true;
    if (all) body.all = true;
    if (courseId) body.courseId = courseId;
    return apiClient('/api/image-cache/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async banImage({ url, pageURL, title, courseId } = {}) {
    const body = {};
    if (url) body.url = url;
    if (pageURL) body.pageURL = pageURL;
    if (title) body.title = title;
    if (courseId) body.courseId = courseId;
    return apiClient('/api/image-cache/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // New client-side image caching methods
  imageCache: new Map(),
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours for images
  maxCacheSize: 100, // Maximum number of cached items

  /**
   * Check if an image is cached in the browser
   * @param {string} url - Image URL
   * @returns {boolean} - Whether image is cached
   */
  isImageCached(url) {
    if (!url) return false;

    // Check our internal cache first
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return true;
      } else {
        this.imageCache.delete(url);
      }
    }

    // Check browser cache using Image object
    try {
      const img = document.createElement('img');
      img.src = url;
      return img.complete && img.naturalWidth !== 0;
    } catch (error) {
      return false;
    }
  },

  /**
   * Cache an image URL
   * @param {string} url - Image URL
   * @param {Object} metadata - Additional metadata
   */
  cacheImage(url, metadata = {}) {
    if (!url) return;

    // Clean up old cache entries if we're at capacity
    if (this.imageCache.size >= this.maxCacheSize) {
      this.cleanupImageCache();
    }

    this.imageCache.set(url, {
      timestamp: Date.now(),
      metadata
    });
  },

  /**
   * Get cached image metadata
   * @param {string} url - Image URL
   * @returns {Object|null} - Cached metadata or null
   */
  getCachedImage(url) {
    if (!url || !this.imageCache.has(url)) return null;

    const cached = this.imageCache.get(url);
    if (Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached;
    } else {
      this.imageCache.delete(url);
      return null;
    }
  },

  /**
   * Preload image into browser cache
   * @param {string} url - Image URL
   * @returns {Promise<boolean>} - Success status
   */
  async preloadImage(url) {
    if (!url || this.isImageCached(url)) {
      return true;
    }

    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        this.cacheImage(url, { 
          width: img.naturalWidth, 
          height: img.naturalHeight,
          loaded: true 
        });
        resolve(true);
      };

      img.onerror = () => {
        resolve(false);
      };

      img.src = url;
    });
  },

  /**
   * Preload multiple images
   * @param {Array} urls - Array of image URLs
   * @param {number} maxConcurrent - Maximum concurrent preloads
   * @returns {Promise<Array>} - Array of success statuses
   */
  async preloadImages(urls, maxConcurrent = 3) {
    const results = [];
    const chunks = this.chunkArray(urls, maxConcurrent);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(url => this.preloadImage(url));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  },

  /**
   * Split array into chunks
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} - Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Clean up expired cache entries
   */
  cleanupImageCache() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.imageCache.delete(key));
  },

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getImageCacheStats() {
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
      cacheTimeout: this.cacheTimeout,
      maxCacheSize: this.maxCacheSize
    };
  },

  /**
   * Clear image cache
   */
  clearImageCache() {
    this.imageCache.clear();
    console.log('[CacheService] Image cache cleared');
  },

  /**
   * Set image cache timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setImageCacheTimeout(timeout) {
    this.cacheTimeout = timeout;
  },

  /**
   * Set maximum image cache size
   * @param {number} size - Maximum number of cached items
   */
  setMaxImageCacheSize(size) {
    this.maxCacheSize = size;
    if (this.imageCache.size > size) {
      this.cleanupImageCache();
    }
  }
};

export default CacheService; 