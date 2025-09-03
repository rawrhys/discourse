'use strict';
import { API_BASE_URL } from '../config/api.js';
import musicImageService from './MusicImageService.js';

const SimpleImageService = {
  // Simple in-memory cache
  cache: new Map(),
  cacheTimeout: 30 * 60 * 1000, // 30 minutes

  // Enhanced fallback images for different topics
  fallbackImages: {
    history: [
      {
        url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&h=600&fit=crop',
        title: 'Ancient Historical Architecture',
        pageURL: 'https://unsplash.com/photos/ancient-ruins',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      },
      {
        url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop',
        title: 'Classical Architecture',
        pageURL: 'https://unsplash.com/photos/classical-building',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      },
      {
        url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73dd3?w=800&h=600&fit=crop',
        title: 'Ancient Manuscripts',
        pageURL: 'https://unsplash.com/photos/ancient-manuscript',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      }
    ],
    ancient: [
      {
        url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73dd3?w=800&h=600&fit=crop',
        title: 'Ancient Civilization',
        pageURL: 'https://unsplash.com/photos/ancient-civilization',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      },
      {
        url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
        title: 'Historical Monument',
        pageURL: 'https://unsplash.com/photos/historical-monument',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      }
    ],
    egypt: [
      {
        url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73dd3?w=800&h=600&fit=crop',
        title: 'Ancient Egypt',
        pageURL: 'https://unsplash.com/photos/ancient-egypt',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      },
      {
        url: 'https://images.unsplash.com/photo-1471919743851-c4df8b6ee133?w=800&h=600&fit=crop',
        title: 'Egyptian Architecture',
        pageURL: 'https://unsplash.com/photos/egyptian-architecture',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      }
    ],
    science: [
      {
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
        title: 'Scientific Discovery',
        pageURL: 'https://unsplash.com/photos/science-lab',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      },
      {
        url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop',
        title: 'Scientific Equipment',
        pageURL: 'https://unsplash.com/photos/science-equipment',
        attribution: 'Unsplash',
        uploader: 'Unsplash'
      }
    ],
    education: [
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
    default: [
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
      }
    ]
  },

  // Simple cache key generation
  getCacheKey(lessonTitle, courseId, lessonId) {
    // Include lesson-specific context to ensure uniqueness
    const lessonContext = this.extractLessonContext(lessonTitle);
    return `${courseId}_${lessonId}_${lessonTitle?.substring(0, 50) || 'default'}_${lessonContext}`;
  },

  // Extract lesson-specific context for better uniqueness
  extractLessonContext(lessonTitle) {
    if (!lessonTitle) return 'default';
    
    const title = lessonTitle.toLowerCase();
    let context = '';
    
    // Extract specific historical periods or events
    if (title.includes('early') && title.includes('dynastic')) {
      context = 'early_dynastic';
    } else if (title.includes('unification')) {
      context = 'unification';
    } else if (title.includes('period')) {
      context = 'period';
    } else if (title.includes('empire')) {
      context = 'empire';
    } else if (title.includes('dynasty')) {
      context = 'dynasty';
    } else if (title.includes('kingdom')) {
      context = 'kingdom';
    } else if (title.includes('civilization')) {
      context = 'civilization';
    } else if (title.includes('ancient')) {
      context = 'ancient';
    } else if (title.includes('historical')) {
      context = 'historical';
    } else {
      // Extract key words for uniqueness
      const words = title.split(/\s+/).filter(word => word.length > 3);
      context = words.slice(0, 2).join('_');
    }
    
    return context || 'default';
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

  // Enhanced image search with multiple fallbacks
  async search(lessonTitle, courseId, lessonId, usedImageTitles = [], usedImageUrls = []) {
    // Validate inputs
    if (!lessonTitle || !courseId || !lessonId) {
      console.warn('[SimpleImageService] Missing required parameters');
      return this.getFallbackImage(lessonTitle);
    }

    // Check if this is music-related content
    const isMusicContent = this.detectMusicContent(lessonTitle);
    if (isMusicContent) {
      console.log('[SimpleImageService] Detected music content, using MusicImageService');
      return await musicImageService.searchMusicImages(lessonTitle, courseId, lessonId, usedImageTitles, usedImageUrls);
    }
    
    // Also check course context for music-related content
    const courseContext = await this.getCourseContext(courseId);
    if (courseContext && this.detectMusicContent(courseContext.title || courseContext.subject || '')) {
      console.log('[SimpleImageService] Detected music content from course context, using MusicImageService');
      console.log('[SimpleImageService] Course title suggests music content:', courseContext.title);
      return await musicImageService.searchMusicImages(lessonTitle, courseId, lessonId, usedImageTitles, usedImageUrls);
    }
    
    // For non-music content, try to detect if it's historical content to avoid using historical fallbacks for music
    const isHistoricalContent = this.detectHistoricalContent(lessonTitle);
    if (isHistoricalContent && !isMusicContent) {
      console.log('[SimpleImageService] Detected historical content, using historical fallbacks');
    }

    const cacheKey = this.getCacheKey(lessonTitle, courseId, lessonId);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('[SimpleImageService] Using cached image for:', lessonTitle);
      return cached;
    }

    try {
      console.log('[SimpleImageService] Searching for:', lessonTitle);
      console.log('[SimpleImageService] Excluding used images:', {
        titles: usedImageTitles.length,
        urls: usedImageUrls.length
      });
      
      // Try the main image search API first with enhanced error handling
      const response = await fetch(`${API_BASE_URL}/api/image-search/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lessonTitle.substring(0, 100),
          content: '',
          usedImageTitles: usedImageTitles,
          usedImageUrls: usedImageUrls,
          courseId,
          lessonId,
          disableModeration: true
        }),
        signal: AbortSignal.timeout(10000) // Increased timeout to 10 seconds
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data && data.url) {
          console.log('[SimpleImageService] Found image via API:', data.title);
          this.setCache(cacheKey, data);
          return data;
        } else {
          console.warn('[SimpleImageService] API returned no valid image data');
        }
      } else {
        console.warn('[SimpleImageService] API request failed with status:', response.status);
      }

      // If API fails, try direct Pixabay search as fallback
      console.log('[SimpleImageService] API failed, trying Pixabay fallback');
      const pixabayImage = await this.searchPixabay(lessonTitle);
      if (pixabayImage) {
        console.log('[SimpleImageService] Found Pixabay image:', pixabayImage.title);
        this.setCache(cacheKey, pixabayImage);
        return pixabayImage;
      }

      // If all else fails, use topic-specific fallback
      console.log('[SimpleImageService] All searches failed, using fallback');
      const fallback = this.getFallbackImage(lessonTitle);
      this.setCache(cacheKey, fallback);
      return fallback;

    } catch (error) {
      console.warn('[SimpleImageService] Search failed:', error.message);
      
      // Try Pixabay as emergency fallback even if main API fails
      try {
        console.log('[SimpleImageService] Trying emergency Pixabay fallback');
        const pixabayImage = await this.searchPixabay(lessonTitle);
        if (pixabayImage) {
          console.log('[SimpleImageService] Found emergency Pixabay image:', pixabayImage.title);
          this.setCache(cacheKey, pixabayImage);
          return pixabayImage;
        }
      } catch (pixabayError) {
        console.warn('[SimpleImageService] Emergency Pixabay fallback also failed:', pixabayError.message);
      }
      
      const fallback = this.getFallbackImage(lessonTitle);
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  },

  // Direct Pixabay search as fallback
  async searchPixabay(query) {
    try {
      const pixabayApiKey = process.env.PIXABAY_API_KEY;
      if (!pixabayApiKey) {
        console.warn('[SimpleImageService] No Pixabay API key available');
        return null;
      }

      // Clean and optimize search query
      const cleanQuery = this.optimizeSearchQuery(query);
      console.log('[SimpleImageService] Pixabay search query:', cleanQuery);
      
      const response = await fetch(
        `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(cleanQuery)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=10&min_width=800&min_height=600`,
        {
          signal: AbortSignal.timeout(8000) // Increased timeout to 8 seconds
        }
      );

      if (!response.ok) {
        throw new Error(`Pixabay API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        // Try to find the best match by checking image quality and relevance
        let bestHit = data.hits[0];
        
        // Look for a better quality image if available
        for (const hit of data.hits.slice(0, 5)) {
          if (hit.imageWidth >= 1200 && hit.imageHeight >= 800) {
            bestHit = hit;
            break;
          }
        }
        
        const result = {
          url: bestHit.webformatURL,
          title: bestHit.tags || cleanQuery,
          pageURL: bestHit.pageURL,
          attribution: 'Pixabay',
          uploader: bestHit.user,
          description: bestHit.tags || cleanQuery
        };
        
        console.log('[SimpleImageService] Pixabay found image:', result.title);
        return result;
      }

      console.warn('[SimpleImageService] No Pixabay images found for query:', cleanQuery);
      return null;
    } catch (error) {
      console.warn('[SimpleImageService] Pixabay search failed:', error.message);
      return null;
    }
  },

  // Optimize search query for better results
  optimizeSearchQuery(query) {
    if (!query) return 'education';
    
    // Remove common stop words and clean up
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'by', 'with', 'at', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'being', 'been', 'this', 'that', 'these', 'those', 'it', 'its', 'into', 'about', 'over', 'under', 'between', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'than'];
    
    let cleanQuery = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 4) // Take first 4 meaningful words for better results
      .join(' ');
    
    // Add topic-specific keywords for better results
    if (cleanQuery.includes('egypt') || cleanQuery.includes('ancient') || cleanQuery.includes('dynastic') || cleanQuery.includes('pharaoh')) {
      cleanQuery += ' ancient egypt civilization';
    } else if (cleanQuery.includes('rome') || cleanQuery.includes('roman')) {
      cleanQuery += ' roman empire';
    } else if (cleanQuery.includes('greek') || cleanQuery.includes('greece')) {
      cleanQuery += ' greek civilization';
    } else if (cleanQuery.includes('history') || cleanQuery.includes('historical')) {
      cleanQuery += ' historical ancient';
    } else if (cleanQuery.includes('early') || cleanQuery.includes('period')) {
      cleanQuery += ' ancient historical';
    } else if (cleanQuery.includes('fall') || cleanQuery.includes('decline')) {
      cleanQuery += ' empire collapse';
    } else if (cleanQuery.includes('rise') || cleanQuery.includes('growth')) {
      cleanQuery += ' empire expansion';
    } else if (cleanQuery.includes('city') || cleanQuery.includes('urban')) {
      cleanQuery += ' ancient city';
    } else if (cleanQuery.includes('culture') || cleanQuery.includes('society')) {
      cleanQuery += ' ancient culture';
    } else if (cleanQuery.includes('art') || cleanQuery.includes('architecture')) {
      cleanQuery += ' ancient art';
    } else if (cleanQuery.includes('unification')) {
      cleanQuery += ' unified kingdom ancient';
    } else if (cleanQuery.includes('dynasty')) {
      cleanQuery += ' royal dynasty ancient';
    } else if (cleanQuery.includes('empire')) {
      cleanQuery += ' imperial power ancient';
    } else if (cleanQuery.includes('kingdom')) {
      cleanQuery += ' ancient kingdom civilization';
    }
    
    // Ensure we have at least some meaningful content
    if (!cleanQuery || cleanQuery.trim().length < 3) {
      cleanQuery = 'education learning';
    }
    
    console.log('[SimpleImageService] Optimized query:', { original: query, optimized: cleanQuery });
    return cleanQuery;
  },

  // Get appropriate fallback image based on topic
  getFallbackImage(lessonTitle) {
    const title = lessonTitle?.toLowerCase() || '';
    
    // Determine the best category for this lesson
    let category = 'default';
    
    if (title.includes('egypt') || title.includes('pharaoh') || title.includes('pyramid')) {
      category = 'egypt';
    } else if (title.includes('ancient') || title.includes('rome') || title.includes('roman') || title.includes('greek') || title.includes('greece')) {
      category = 'ancient';
    } else if (title.includes('history') || title.includes('historical') || title.includes('dynasty') || title.includes('empire')) {
      category = 'history';
    } else if (title.includes('science') || title.includes('technology') || title.includes('scientific') || title.includes('research')) {
      category = 'science';
    } else if (title.includes('education') || title.includes('learning') || title.includes('study') || title.includes('knowledge')) {
      category = 'education';
    } else if (title.includes('fall') || title.includes('decline') || title.includes('collapse')) {
      category = 'history'; // Use historical images for decline/collapse topics
    } else if (title.includes('rise') || title.includes('growth') || title.includes('expansion')) {
      category = 'ancient'; // Use ancient civilization images for growth topics
    } else if (title.includes('city') || title.includes('urban') || title.includes('civilization')) {
      category = 'ancient'; // Use ancient city images
    } else if (title.includes('culture') || title.includes('society') || title.includes('art')) {
      category = 'ancient'; // Use ancient culture images
    }
    
    // Get a random image from the appropriate category
    const images = this.fallbackImages[category] || this.fallbackImages.default;
    const randomIndex = Math.floor(Math.random() * images.length);
    
    console.log(`[SimpleImageService] Using ${category} fallback image for: ${lessonTitle}`);
    return images[randomIndex];
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
  },

  // Validate URL format
  isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    try {
      const parsedUrl = new URL(url);
      
      // Check if it's a valid image URL
      const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
      const hasValidExtension = validImageExtensions.some(ext => 
        parsedUrl.pathname.toLowerCase().includes(ext)
      );
      
      // Special handling for SVG files - they might have additional parameters
      const isSvgFile = parsedUrl.pathname.toLowerCase().includes('.svg');
      const hasValidSvgExtension = isSvgFile || hasValidExtension;
      
      if (!hasValidSvgExtension) {
        console.warn('[SimpleImageService] Invalid image format in URL:', parsedUrl.pathname);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  },

  // Pre-cache image with validation
  async preCacheImage(imageData) {
    if (!imageData || !imageData.url) {
      console.warn('[SimpleImageService] Invalid image data for pre-caching');
      return false;
    }

    if (!this.isValidUrl(imageData.url)) {
      console.warn('[SimpleImageService] Invalid URL for pre-caching:', imageData.url);
      return false;
    }

    try {
      // Try to fetch the image to ensure it's accessible
      const response = await fetch(imageData.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // Increased timeout for SVG files
        headers: {
          'Accept': 'image/*, image/svg+xml', // Accept SVG files
          'User-Agent': 'SimpleImageService/1.0'
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const isSvg = contentType.includes('svg') || imageData.url.toLowerCase().includes('.svg');
        
        console.log('[SimpleImageService] Successfully pre-cached image:', {
          url: imageData.url.substring(0, 50) + '...',
          contentType,
          isSvg
        });
        return true;
      } else {
        console.warn('[SimpleImageService] Failed to pre-cache image, status:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('[SimpleImageService] Failed to pre-cache image:', error.message);
      return false;
    }
  },
  
  // Detect if content is music-related
  detectMusicContent(lessonTitle) {
    const text = lessonTitle.toLowerCase();
    
    // Music-specific terms
    const musicTerms = [
      'music', 'musical', 'melody', 'rhythm', 'harmony', 'composition', 'performance', 'concert',
      'song', 'tune', 'note', 'scale', 'chord', 'tempo', 'beat', 'pitch', 'sound', 'audio',
      'orchestra', 'band', 'ensemble', 'singer', 'vocal', 'instrument', 'piano', 'guitar',
      'violin', 'drums', 'trumpet', 'saxophone', 'flute', 'clarinet', 'cello', 'bass',
      'jazz', 'rock', 'pop', 'folk', 'classical', 'electronic', 'blues', 'country', 'reggae',
      'symphony', 'sonata', 'concerto', 'opera', 'ballet', 'musical theater', 'recital',
      // Beatles and music history specific terms
      'beatles', 'beatle', 'lennon', 'mccartney', 'harrison', 'starr', 'ringo', 'paul', 'john', 'george',
      'album', 'single', 'record', 'recording', 'studio', 'producer', 'arrangement', 'lyrics',
      'guitar riff', 'bass line', 'drum beat', 'vocal harmony', 'backup vocals', 'lead singer'
    ];
    
    return musicTerms.some(term => text.includes(term));
  },
  
  // Detect if content is historical-related
  detectHistoricalContent(lessonTitle) {
    const text = lessonTitle.toLowerCase();
    
    // Historical-specific terms
    const historicalTerms = [
      'history', 'ancient', 'rome', 'greek', 'egypt', 'medieval', 'renaissance', 'empire',
      'republic', 'kingdom', 'dynasty', 'civilization', 'war', 'battle', 'revolution',
      'pharaoh', 'emperor', 'king', 'queen', 'temple', 'ruins', 'artifact', 'manuscript'
    ];
    
    return historicalTerms.some(term => text.includes(term));
  },
  
  // Get course context to check if the entire course is music-related
  async getCourseContext(courseId) {
    try {
      // Use public endpoint for public courses
      const response = await fetch(`${API_BASE_URL}/api/public/courses/${courseId}`);
      if (response.ok) {
        const course = await response.json();
        return course;
      }
    } catch (error) {
      console.warn('[SimpleImageService] Failed to get course context:', error);
    }
    return null;
  },
  
  // Force replace existing irrelevant images for music content
  async forceReplaceMusicImages(lessonTitle, courseId, lessonId, usedImageTitles = [], usedImageUrls = []) {
    console.log('[SimpleImageService] Force replacing music images for:', lessonTitle);
    
    // Clear cache to force fresh search
    const cacheKey = this.getCacheKey(lessonTitle, courseId, lessonId);
    this.cache.delete(cacheKey);
    
    // Use MusicImageService to get fresh music-relevant images
    return await musicImageService.forceImageReplacement(lessonTitle, courseId, lessonId, usedImageTitles, usedImageUrls);
  }
};

export default SimpleImageService; 