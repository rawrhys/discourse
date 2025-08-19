import fetch from 'node-fetch';
import sharp from 'sharp';

// Enhanced in-memory cache with better eviction strategy
const imageCache = new Map();
const CACHE_TTL = 1800000; // 30 minutes - reduced for better memory management
const MAX_CACHE_SIZE = 100; // Reduced cache size for better performance
const CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes

// Enhanced image processing configuration
const PROCESSING_CONFIG = {
  sizes: {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 300 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 900 },
    xlarge: { width: 1600, height: 1200 },
    // Low-quality placeholder sizes
    placeholder: { width: 20, height: 15 },
    blur: { width: 40, height: 30 }
  },
  quality: {
    webp: 80,
    jpeg: 75,
    png: 9,
    placeholder: 10, // Very low quality for placeholders
    blur: 20 // Low quality for blur effects
  },
  optimization: {
    progressive: true,
    mozjpeg: true,
    effort: 4,
    // Enhanced compression settings
    chromaSubsampling: '4:2:0',
    force: true
  }
};

// Allowed domains for security
const ALLOWED_DOMAINS = ['upload.wikimedia.org', 'pixabay.com', 'images.unsplash.com'];

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  lastCleanup: Date.now()
};

class EnhancedImageProxy {
  constructor() {
    this.cache = imageCache;
    this.config = PROCESSING_CONFIG;
    this.setupCacheCleanup();
  }

  /**
   * Setup periodic cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Enhanced image proxy with processing and caching
   */
  async serveImage(req, res) {
    const startTime = Date.now();
    
    try {
      const { url, size = 'medium', format = 'auto', quality, w, h } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
      }

      // Security validation
      if (!this.isAllowedDomain(url)) {
        console.warn(`[EnhancedImageProxy] Forbidden domain: ${new URL(url).hostname}`);
        return res.status(403).json({ error: 'Forbidden domain' });
      }

      // Handle width/height parameters for responsive images
      let finalSize = size;
      let finalQuality = quality;
      
      if (w || h) {
        finalSize = 'custom';
        // Use custom size if width/height specified
        if (w && h) {
          this.config.sizes.custom = { width: parseInt(w), height: parseInt(h) };
        } else if (w) {
          this.config.sizes.custom = { width: parseInt(w), height: null };
        } else if (h) {
          this.config.sizes.custom = { width: null, height: parseInt(h) };
        }
      }

      // Handle quality parameter
      if (quality) {
        finalQuality = parseInt(quality);
        if (finalQuality < 1 || finalQuality > 100) {
          finalQuality = this.config.quality.jpeg;
        }
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(url, finalSize, format, finalQuality);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        cacheStats.hits++;
        const responseTime = Date.now() - startTime;
        console.log(`[EnhancedImageProxy] Cache HIT for ${url} (${responseTime}ms)`);
        return this.serveCachedImage(res, cached);
      }

      cacheStats.misses++;

      // Fetch and process image
      const processedImage = await this.processImage(url, finalSize, format, finalQuality);
      
      // Cache the result
      this.setCache(cacheKey, processedImage);

      // Serve the image
      const responseTime = Date.now() - startTime;
      console.log(`[EnhancedImageProxy] Processed ${url} in ${responseTime}ms`);
      return this.serveProcessedImage(res, processedImage);

    } catch (error) {
      console.error('[EnhancedImageProxy] Error serving image:', error);
      
      // Fallback to basic proxy
      return this.basicImageProxy(req, res);
    }
  }

  /**
   * Process image with enhanced features
   */
  async processImage(url, size = 'medium', format = 'auto', quality = null) {
    try {
      // Fetch original image with timeout
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Enhanced-Image-Proxy/1.0' },
        timeout: 8000 // Reduced timeout for better performance
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Process with Sharp
      return await this.processWithSharp(imageBuffer, size, format, contentType, quality);

    } catch (error) {
      console.error('[EnhancedImageProxy] Image processing error:', error);
      throw error;
    }
  }

  /**
   * Process image with Sharp
   */
  async processWithSharp(imageBuffer, size, format, contentType, quality = null) {
    const sizeConfig = this.config.sizes[size] || this.config.sizes.medium;
    
    let sharpInstance = sharp(imageBuffer);
    
    // Resize with enhanced options
    if (sizeConfig.width || sizeConfig.height) {
      sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
    }

    // Apply format-specific processing
    const outputFormat = format === 'auto' ? this.detectOptimalFormat(contentType) : format;
    let processedBuffer;
    let outputContentType;
    
    // Use custom quality if provided
    const finalQuality = quality || this.config.quality[outputFormat] || this.config.quality.jpeg;
    
    switch (outputFormat) {
      case 'webp':
        processedBuffer = await sharpInstance
          .webp({ 
            quality: finalQuality,
            effort: this.config.optimization.effort,
            nearLossless: false,
            smartSubsample: true
          })
          .toBuffer();
        outputContentType = 'image/webp';
        break;
        
      case 'jpeg':
        processedBuffer = await sharpInstance
          .jpeg({ 
            quality: finalQuality,
            progressive: this.config.optimization.progressive,
            mozjpeg: this.config.optimization.mozjpeg,
            chromaSubsampling: this.config.optimization.chromaSubsampling,
            force: this.config.optimization.force
          })
          .toBuffer();
        outputContentType = 'image/jpeg';
        break;
        
      case 'png':
        processedBuffer = await sharpInstance
          .png({ 
            compressionLevel: this.config.quality.png,
            progressive: false,
            adaptiveFiltering: true
          })
          .toBuffer();
        outputContentType = 'image/png';
        break;
        
      default:
        processedBuffer = await sharpInstance.jpeg({ quality: finalQuality }).toBuffer();
        outputContentType = 'image/jpeg';
    }

    return {
      buffer: processedBuffer,
      contentType: outputContentType,
      size: processedBuffer.length,
      originalSize: imageBuffer.length,
      compressionRatio: (processedBuffer.length / imageBuffer.length * 100).toFixed(1)
    };
  }

  /**
   * Detect optimal format based on content type and browser support
   */
  detectOptimalFormat(contentType) {
    // Always prefer WebP for better compression
    return 'webp';
  }

  /**
   * Security validation
   */
  isAllowedDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain));
    } catch {
      return false;
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(url, size, format, quality) {
    const qualityStr = quality ? `q${quality}` : '';
    return `image:${Buffer.from(url).toString('base64')}:${size}:${format}:${qualityStr}`;
  }

  /**
   * Enhanced cache operations with LRU eviction
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access time for LRU
    cached.lastAccessed = Date.now();
    return cached.data;
  }

  setCache(key, data) {
    // Implement LRU cache eviction
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }

  /**
   * Evict least recently used cache entries
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      cacheStats.evictions++;
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[EnhancedImageProxy] Cleaned up ${cleaned} expired cache entries`);
    }

    cacheStats.lastCleanup = now;
  }

  /**
   * Serve processed image
   */
  serveProcessedImage(res, processedImage) {
    res.set('Content-Type', processedImage.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Length', processedImage.size);
    res.set('X-Compression-Ratio', processedImage.compressionRatio + '%');
    res.send(processedImage.buffer);
  }

  /**
   * Serve cached image
   */
  serveCachedImage(res, cached) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Cache', 'HIT');
    res.set('X-Compression-Ratio', cached.compressionRatio + '%');
    res.send(cached.buffer);
  }

  /**
   * Basic image proxy (fallback)
   */
  async basicImageProxy(req, res) {
    try {
      const url = req.query.url;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Enhanced-Image-Proxy-Fallback/1.0' },
        timeout: 10000
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch image' });
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(imageBuffer);

    } catch (error) {
      console.error('[EnhancedImageProxy] Fallback error:', error);
      res.status(500).json({ error: 'Image service unavailable' });
    }
  }

  /**
   * Enhanced health check with detailed statistics
   */
  getHealth() {
    return {
      status: 'healthy',
      cacheSize: this.cache.size,
      maxCacheSize: MAX_CACHE_SIZE,
      cacheHitRate: this.getCacheHitRate(),
      cacheStats: {
        ...cacheStats,
        hitRate: this.getCacheHitRate()
      },
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Get cache statistics
   */
  getCacheHitRate() {
    const totalRequests = cacheStats.hits + cacheStats.misses;
    return totalRequests > 0 ? (cacheStats.hits / totalRequests * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      lastCleanup: Date.now()
    };
    console.log('[EnhancedImageProxy] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      ...cacheStats,
      hitRate: this.getCacheHitRate(),
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE
    };
  }
}

// Create singleton instance
const enhancedImageProxy = new EnhancedImageProxy();

export default enhancedImageProxy;
