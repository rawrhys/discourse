/**
 * MusicImageService - Specialized image service for music-related topics
 * Ensures highly relevant images for music history, theory, instruments, and cultural content
 */

import { API_BASE_URL } from '../config/api.js';

class MusicImageService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Curated music-specific search terms for different categories
    this.musicCategories = {
      // Classical/Orchestral
      classical: [
        'orchestra', 'symphony', 'classical music', 'concert hall', 'conductor', 'violin', 'cello', 'piano', 'flute', 'clarinet',
        'trumpet', 'trombone', 'french horn', 'timpani', 'harp', 'oboe', 'bassoon', 'percussion', 'string quartet', 'chamber music'
      ],
      
      // Jazz
      jazz: [
        'jazz music', 'jazz band', 'saxophone', 'trumpet', 'piano', 'double bass', 'drums', 'jazz club', 'jazz musician',
        'improvisation', 'swing', 'bebop', 'cool jazz', 'fusion', 'smooth jazz', 'jazz festival', 'jazz ensemble'
      ],
      
      // Rock/Pop
      rock: [
        'rock music', 'electric guitar', 'bass guitar', 'drums', 'rock band', 'concert', 'stage', 'microphone', 'amplifier',
        'rock concert', 'music festival', 'band performance', 'electric bass', 'keyboard', 'synthesizer', 'rock star'
      ],
      
      // Folk/Traditional
      folk: [
        'folk music', 'acoustic guitar', 'banjo', 'mandolin', 'fiddle', 'harmonica', 'accordion', 'traditional music',
        'cultural music', 'ethnic music', 'world music', 'indigenous music', 'heritage music', 'roots music'
      ],
      
      // Electronic/Digital
      electronic: [
        'electronic music', 'synthesizer', 'drum machine', 'dj equipment', 'music production', 'studio equipment',
        'digital audio', 'electronic instruments', 'music technology', 'computer music', 'electronic dance music'
      ],
      
      // Historical/Period
      historical: [
        'medieval music', 'renaissance music', 'baroque music', 'classical period', 'romantic music', 'early music',
        'ancient music', 'historical instruments', 'period instruments', 'music manuscript', 'music history'
      ],
      
      // Cultural/World
      cultural: [
        'african music', 'asian music', 'latin music', 'middle eastern music', 'indian music', 'chinese music',
        'japanese music', 'celtic music', 'slavic music', 'arabic music', 'flamenco', 'tango', 'samba', 'reggae'
      ]
    };
    
    // Music-specific fallback images
    this.musicFallbacks = {
      general: [
        {
          url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop',
          title: 'Musical Instruments',
          pageURL: 'https://unsplash.com/photos/musical-instruments',
          attribution: 'Unsplash',
          uploader: 'Unsplash'
        },
        {
          url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=600&fit=crop',
          title: 'Music Studio',
          pageURL: 'https://unsplash.com/photos/music-studio',
          attribution: 'Unsplash',
          uploader: 'Unsplash'
        }
      ],
      classical: [
        {
          url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop',
          title: 'Classical Orchestra',
          pageURL: 'https://unsplash.com/photos/classical-orchestra',
          attribution: 'Unsplash',
          uploader: 'Unsplash'
        }
      ],
      jazz: [
        {
          url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=600&fit=crop',
          title: 'Jazz Performance',
          pageURL: 'https://unsplash.com/photos/jazz-performance',
          attribution: 'Unsplash',
          uploader: 'Unsplash'
        }
      ]
    };
  }

  /**
   * Determine the music category based on lesson title and content
   */
  detectMusicCategory(lessonTitle, content = '') {
    const text = `${lessonTitle} ${content}`.toLowerCase();
    
    // Check for specific music categories
    for (const [category, terms] of Object.entries(this.musicCategories)) {
      for (const term of terms) {
        if (text.includes(term.toLowerCase())) {
          return category;
        }
      }
    }
    
    // Check for general music terms
    const generalMusicTerms = [
      'music', 'musical', 'melody', 'rhythm', 'harmony', 'composition', 'performance', 'concert',
      'song', 'tune', 'note', 'scale', 'chord', 'tempo', 'beat', 'pitch', 'sound', 'audio'
    ];
    
    for (const term of generalMusicTerms) {
      if (text.includes(term)) {
        return 'general';
      }
    }
    
    return null;
  }

  /**
   * Generate music-specific search queries
   */
  generateMusicSearchQueries(lessonTitle, content = '', category = null) {
    const queries = [];
    const text = `${lessonTitle} ${content}`.toLowerCase();
    
    // Always include the original lesson title
    if (lessonTitle) {
      queries.push(lessonTitle);
    }
    
    // Add category-specific terms
    if (category && this.musicCategories[category]) {
      const categoryTerms = this.musicCategories[category];
      for (const term of categoryTerms) {
        if (text.includes(term.toLowerCase()) || lessonTitle.toLowerCase().includes(term.toLowerCase())) {
          queries.push(term);
          break; // Only add one category term to avoid dilution
        }
      }
    }
    
    // Add general music terms if no specific category found
    if (!category) {
      const generalTerms = ['music', 'musical', 'instrument', 'performance'];
      for (const term of generalTerms) {
        if (text.includes(term)) {
          queries.push(term);
          break;
        }
      }
    }
    
    // Add specific instrument terms if mentioned
    const instrumentTerms = [
      'piano', 'guitar', 'violin', 'drums', 'trumpet', 'saxophone', 'flute', 'clarinet',
      'cello', 'bass', 'harp', 'oboe', 'bassoon', 'trombone', 'french horn', 'timpani'
    ];
    
    for (const instrument of instrumentTerms) {
      if (text.includes(instrument)) {
        queries.push(instrument);
        break;
      }
    }
    
    // Add period/style terms if mentioned
    const periodTerms = [
      'classical', 'jazz', 'rock', 'pop', 'folk', 'electronic', 'medieval', 'renaissance',
      'baroque', 'romantic', 'modern', 'contemporary', 'traditional', 'experimental'
    ];
    
    for (const period of periodTerms) {
      if (text.includes(period)) {
        queries.push(period);
        break;
      }
    }
    
    // Limit to 5 queries to maintain relevance
    return queries.slice(0, 5);
  }

  /**
   * Search for music-relevant images using the main API
   */
  async searchMusicImages(lessonTitle, courseId, lessonId, usedImageTitles = [], usedImageUrls = []) {
    const cacheKey = this.getCacheKey(lessonTitle, courseId, lessonId);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('[MusicImageService] Using cached image for:', lessonTitle);
      return cached;
    }
    
    try {
      console.log('[MusicImageService] Searching for music image:', lessonTitle);
      
      // Detect music category
      const category = this.detectMusicCategory(lessonTitle);
      console.log('[MusicImageService] Detected music category:', category);
      
      // Generate music-specific search queries
      const searchQueries = this.generateMusicSearchQueries(lessonTitle, '', category);
      console.log('[MusicImageService] Generated search queries:', searchQueries);
      
      // Try the main image search API with music-specific context
      const response = await fetch(`${API_BASE_URL}/api/image-search/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lessonTitle.substring(0, 100),
          content: `Music lesson about ${lessonTitle}. ${category ? `Category: ${category}` : ''}`,
          usedImageTitles: usedImageTitles,
          usedImageUrls: usedImageUrls,
          courseId,
          lessonId,
          disableModeration: true,
          musicContext: true, // Flag for music-specific processing
          musicCategory: category
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout for music searches
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.url) {
          console.log('[MusicImageService] Found music image via API:', data.title);
          this.setCache(cacheKey, data);
          return data;
        } else {
          console.warn('[MusicImageService] API returned no valid image data');
        }
      } else {
        console.warn('[MusicImageService] API request failed with status:', response.status);
      }
      
      // Fallback to direct music-specific search
      return await this.searchMusicFallback(lessonTitle, category, usedImageTitles, usedImageUrls);
      
    } catch (error) {
      console.error('[MusicImageService] Error in music image search:', error);
      return this.getMusicFallback(category);
    }
  }

  /**
   * Fallback search using music-specific terms
   */
  async searchMusicFallback(lessonTitle, category, usedImageTitles, usedImageUrls) {
    try {
      const searchQueries = this.generateMusicSearchQueries(lessonTitle, '', category);
      
      // Try Pixabay with music-specific search
      for (const query of searchQueries) {
        const result = await this.searchPixabayMusic(query, usedImageTitles, usedImageUrls);
        if (result) {
          console.log('[MusicImageService] Found music image via Pixabay fallback:', result.title);
          return result;
        }
      }
      
      // If all else fails, return category-specific fallback
      return this.getMusicFallback(category);
      
    } catch (error) {
      console.error('[MusicImageService] Error in music fallback search:', error);
      return this.getMusicFallback(category);
    }
  }

  /**
   * Direct Pixabay search for music content
   */
  async searchPixabayMusic(query, usedImageTitles, usedImageUrls) {
    try {
      const pixabayApiKey = process.env.PIXABAY_API_KEY;
      if (!pixabayApiKey) {
        console.warn('[MusicImageService] No Pixabay API key available');
        return null;
      }
      
      // Enhance query with music context
      const enhancedQuery = `music ${query}`;
      console.log('[MusicImageService] Pixabay music search query:', enhancedQuery);
      
      const response = await fetch(
        `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(enhancedQuery)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=20&min_width=800&min_height=600`,
        {
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Pixabay API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        // Filter for music-relevant images
        const musicRelevantHits = data.hits.filter(hit => {
          const tags = (hit.tags || '').toLowerCase();
          const title = (hit.tags || '').split(',')[0]?.toLowerCase() || '';
          
          // Check for music relevance
          const musicTerms = ['music', 'musical', 'instrument', 'concert', 'performance', 'band', 'orchestra', 'singer', 'song'];
          return musicTerms.some(term => tags.includes(term) || title.includes(term));
        });
        
        if (musicRelevantHits.length > 0) {
          const bestHit = musicRelevantHits[0];
          
          return {
            url: bestHit.webformatURL,
            title: bestHit.tags || query,
            pageURL: bestHit.pageURL,
            attribution: 'Pixabay',
            uploader: bestHit.user,
            description: bestHit.tags || query
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn('[MusicImageService] Pixabay music search failed:', error.message);
      return null;
    }
  }

  /**
   * Get music-specific fallback image
   */
  getMusicFallback(category = 'general') {
    const fallbacks = this.musicFallbacks[category] || this.musicFallbacks.general;
    const randomIndex = Math.floor(Math.random() * fallbacks.length);
    return fallbacks[randomIndex];
  }

  /**
   * Cache management
   */
  getCacheKey(lessonTitle, courseId, lessonId) {
    return `music_image_${courseId}_${lessonId}_${lessonTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
  }

  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    console.log('[MusicImageService] Cached music image:', cacheKey);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[MusicImageService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 100,
      timeout: this.cacheTimeout
    };
  }
}

// Export singleton instance
const musicImageService = new MusicImageService();
export default musicImageService;
