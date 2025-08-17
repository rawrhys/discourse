import fetch from 'node-fetch';
import sharp from 'sharp';

// Simple in-memory cache (can be upgraded to Redis later)
const imageCache = new Map();
const CACHE_TTL = 3600000; // 1 hour
const MAX_CACHE_SIZE = 100;

// Enhanced image processing configuration
const PROCESSING_CONFIG = {
  sizes: {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 300 },
    medium: { width: 800, height: 600 },
    large: { width: 1200, height: 900 }
  },
  quality: {
    webp: 80,
    jpeg: 75,
    png: 9
  },
  optimization: {
    progressive: true,
    mozjpeg: true,
    effort: 4
  }
};

// Allowed domains for security
const ALLOWED_DOMAINS = ['upload.wikimedia.org', 'pixabay.com', 'images.unsplash.com'];

class EnhancedImageProxy {
  constructor() {
    this.cache = imageCache;
    this.config = PROCESSING_CONFIG;
  }

  /**
   * Enhanced image proxy with processing and caching
   */
  async serveImage(req, res) {
    try {
      const { url, size = 'medium', format = 'auto' } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
      }

      // Security validation
      if (!this.isAllowedDomain(url)) {
        console.warn(`[EnhancedImageProxy] Forbidden domain: ${new URL(url).hostname}`);
        return res.status(403).json({ error: 'Forbidden domain' });
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(url, size, format);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return this.serveCachedImage(res, cached);
      }

      // Fetch and process image
      const processedImage = await this.processImage(url, size, format);
      
      // Cache the result
      this.setCache(cacheKey, processedImage);

      // Serve the image
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
  async processImage(url, size = 'medium', format = 'auto') {
    try {
      // Fetch original image
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Enhanced-Image-Proxy/1.0' },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Process with Sharp
      return await this.processWithSharp(imageBuffer, size, format, contentType);

    } catch (error) {
      console.error('[EnhancedImageProxy] Image processing error:', error);
      throw error;
    }
  }

  /**
   * Process image with Sharp
   */
  async processWithSharp(imageBuffer, size, format, contentType) {
    const sizeConfig = this.config.sizes[size] || this.config.sizes.medium;
    
    let sharpInstance = sharp(imageBuffer);
    
    // Resize
    sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3
    });

    // Apply format-specific processing
    const outputFormat = format === 'auto' ? this.detectOptimalFormat(contentType) : format;
    let processedBuffer;
    let outputContentType;
    
    switch (outputFormat) {
      case 'webp':
        processedBuffer = await sharpInstance
          .webp({ 
            quality: this.config.quality.webp,
            effort: this.config.optimization.effort
          })
          .toBuffer();
        outputContentType = 'image/webp';
        break;
        
      case 'jpeg':
        processedBuffer = await sharpInstance
          .jpeg({ 
            quality: this.config.quality.jpeg,
            progressive: this.config.optimization.progressive,
            mozjpeg: this.config.optimization.mozjpeg
          })
          .toBuffer();
        outputContentType = 'image/jpeg';
        break;
        
      case 'png':
        processedBuffer = await sharpInstance
          .png({ 
            compressionLevel: this.config.quality.png
          })
          .toBuffer();
        outputContentType = 'image/png';
        break;
        
      default:
        processedBuffer = await sharpInstance.jpeg({ quality: 75 }).toBuffer();
        outputContentType = 'image/jpeg';
    }

    return {
      buffer: processedBuffer,
      contentType: outputContentType,
      size: processedBuffer.length
    };
  }

  /**
   * Detect optimal format based on content type
   */
  detectOptimalFormat(contentType) {
    // Prefer WebP for better compression
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
  generateCacheKey(url, size, format) {
    return `image:${Buffer.from(url).toString('base64')}:${size}:${format}`;
  }

  /**
   * Cache operations
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    // Implement LRU cache eviction
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Serve processed image
   */
  serveProcessedImage(res, processedImage) {
    res.set('Content-Type', processedImage.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Length', processedImage.size);
    res.send(processedImage.buffer);
  }

  /**
   * Serve cached image
   */
  serveCachedImage(res, cached) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Cache', 'HIT');
    res.send(cached.buffer);
  }

  /**
   * Basic image proxy (fallback)
   */
  async basicImageProxy(req, res) {
    try {
      const url = req.query.url;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Enhanced-Image-Proxy-Fallback/1.0' }
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
   * Health check
   */
  getHealth() {
    return {
      status: 'healthy',
      cacheSize: this.cache.size,
      maxCacheSize: MAX_CACHE_SIZE,
      cacheHitRate: this.getCacheHitRate()
    };
  }

  /**
   * Get cache statistics
   */
  getCacheHitRate() {
    // Simple cache hit rate calculation
    const totalRequests = this.cache.get('stats:total') || 0;
    const cacheHits = this.cache.get('stats:hits') || 0;
    return totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[EnhancedImageProxy] Cache cleared');
  }
}

// Create singleton instance
const enhancedImageProxy = new EnhancedImageProxy();

export default enhancedImageProxy;
