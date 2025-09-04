class AdvancedCacheService {
  constructor() {
    this.cache = new Map();
    this.metadata = new Map();
    this.maxSize = 1000; // Maximum number of items
    this.maxMemory = 50 * 1024 * 1024; // 50MB max memory usage
    this.currentMemory = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set(key, value, ttl = 300000) { // Default 5 minutes TTL
    const size = this.calculateSize(value);
    const expiresAt = Date.now() + ttl;
    
    // Check if we need to evict items
    this.ensureCapacity(size);
    
    // Store the value and metadata
    this.cache.set(key, value);
    this.metadata.set(key, {
      expiresAt,
      size,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
    
    this.currentMemory += size;
    this.stats.sets++;
    this.updateStats();
    
    return true;
  }

  /**
   * Get a value from the cache
   */
  get(key) {
    const metadata = this.metadata.get(key);
    
    if (!metadata) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }
    
    // Check if expired
    if (Date.now() > metadata.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }
    
    // Update access statistics
    metadata.accessCount++;
    metadata.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateStats();
    
    return this.cache.get(key);
  }

  /**
   * Delete a value from the cache
   */
  delete(key) {
    const metadata = this.metadata.get(key);
    if (metadata) {
      this.currentMemory -= metadata.size;
      this.stats.deletes++;
    }
    
    this.cache.delete(key);
    this.metadata.delete(key);
    this.updateStats();
    
    return true;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key) {
    const metadata = this.metadata.get(key);
    if (!metadata) return false;
    
    if (Date.now() > metadata.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.metadata.clear();
    this.currentMemory = 0;
    this.updateStats();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      memoryUsage: this.formatBytes(this.currentMemory),
      maxMemory: this.formatBytes(this.maxMemory),
      memoryUsagePercent: ((this.currentMemory / this.maxMemory) * 100).toFixed(2)
    };
  }

  /**
   * Get cache keys with optional pattern matching
   */
  keys(pattern = null) {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) return keys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  /**
   * Get cache entries with metadata
   */
  entries() {
    const entries = [];
    for (const [key, value] of this.cache.entries()) {
      const metadata = this.metadata.get(key);
      if (metadata && Date.now() <= metadata.expiresAt) {
        entries.push({
          key,
          value,
          metadata: { ...metadata }
        });
      }
    }
    return entries;
  }

  /**
   * Set multiple values at once
   */
  mset(entries, ttl = 300000) {
    const results = [];
    for (const [key, value] of entries) {
      results.push(this.set(key, value, ttl));
    }
    return results;
  }

  /**
   * Get multiple values at once
   */
  mget(keys) {
    const results = [];
    for (const key of keys) {
      results.push(this.get(key));
    }
    return results;
  }

  /**
   * Increment a numeric value
   */
  incr(key, amount = 1) {
    const current = this.get(key);
    const newValue = (current || 0) + amount;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a numeric value
   */
  decr(key, amount = 1) {
    return this.incr(key, -amount);
  }

  /**
   * Set expiration time for a key
   */
  expire(key, ttl) {
    const metadata = this.metadata.get(key);
    if (metadata) {
      metadata.expiresAt = Date.now() + ttl;
      return true;
    }
    return false;
  }

  /**
   * Get time to live for a key
   */
  ttl(key) {
    const metadata = this.metadata.get(key);
    if (!metadata) return -2; // Key doesn't exist
    if (Date.now() > metadata.expiresAt) return -1; // Key expired
    
    return Math.max(0, metadata.expiresAt - Date.now());
  }

  /**
   * Ensure cache has capacity for new item
   */
  ensureCapacity(newItemSize) {
    if (this.currentMemory + newItemSize <= this.maxMemory && this.cache.size < this.maxSize) {
      return;
    }
    
    // Need to evict items
    const itemsToEvict = this.getItemsToEvict();
    
    for (const key of itemsToEvict) {
      this.delete(key);
      this.stats.evictions++;
      
      if (this.currentMemory + newItemSize <= this.maxMemory * 0.8 && this.cache.size < this.maxSize * 0.8) {
        break;
      }
    }
  }

  /**
   * Get items to evict based on LRU and expiration
   */
  getItemsToEvict() {
    const items = Array.from(this.metadata.entries()).map(([key, metadata]) => ({
      key,
      ...metadata
    }));
    
    // Sort by priority: expired first, then by access count and last accessed time
    items.sort((a, b) => {
      const now = Date.now();
      const aExpired = now > a.expiresAt;
      const bExpired = now > b.expiresAt;
      
      if (aExpired && !bExpired) return -1;
      if (!aExpired && bExpired) return 1;
      
      // Both expired or both not expired, sort by access count and last accessed
      const aScore = a.accessCount * 0.7 + (now - a.lastAccessed) * 0.3;
      const bScore = b.accessCount * 0.7 + (now - b.lastAccessed) * 0.3;
      
      return aScore - bScore;
    });
    
    return items.map(item => item.key);
  }

  /**
   * Calculate approximate size of a value
   */
  calculateSize(value) {
    if (value === null || value === undefined) return 8;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (value instanceof Blob) return value.size;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024; // Fallback size for complex objects
      }
    }
    return 8; // Default size
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Start periodic cleanup
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, metadata] of this.metadata.entries()) {
      if (now > metadata.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      console.log(`[AdvancedCacheService] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.memoryUsage = this.currentMemory;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0
    };
  }
}

// Export singleton instance
const advancedCacheService = new AdvancedCacheService();
export default advancedCacheService;
