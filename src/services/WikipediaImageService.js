// src/services/WikipediaImageService.js

class WikipediaImageService {
  constructor() {
    this.baseUrl = 'https://en.wikipedia.org/w/api.php';
    this.imageCache = new Map();
    this.moduleImages = new Map(); // Track images by module
    this.moduleUsedImages = new Map(); // Track which images have been used in each module
    this.activeSearches = new Map(); // Track ongoing searches
  }

  /**
   * Extract relevant keywords from content
   * @param {string} content - The lesson content
   * @returns {string[]} Array of relevant keywords
   */
  extractKeywords(content) {
    if (!content) return [];
    
    // Extract bold terms (they're usually important)
    const boldTerms = Array.from(content.matchAll(/\*\*(.*?)\*\*/g))
      .map(match => match[1].trim())
      .filter(term => term.length > 2);

    // Extract first sentence (usually contains main topic)
    const firstSentence = content.split(/[.!?]/)[0].trim();
    
    // Extract proper nouns and capitalized terms
    const properNouns = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    
    // Extract historical terms and concepts
    const historicalTerms = content.match(/\b(ancient|classical|medieval|renaissance|modern|historical|battle|war|kingdom|empire|civilization|culture|society|philosophy|art|architecture|religion|politics|military|navy|army|tactics|strategy|training|discipline|virtue|duty|legacy|influence|inspiration)\b/gi) || [];
    
    // Extract specific historical figures and events
    const historicalFigures = content.match(/\b(king|queen|emperor|general|commander|leader|philosopher|artist|writer|poet|scientist|inventor|explorer|warrior|soldier|citizen|slave|merchant|priest|prophet)\b/gi) || [];
    
    // Extract cultural and artistic terms
    const culturalTerms = content.match(/\b(film|movie|book|novel|game|video|art|music|dance|theater|literature|poetry|sculpture|painting|architecture|design|style|fashion|tradition|custom|ritual|festival|celebration)\b/gi) || [];
    
    // Extract action words and specific terms
    const words = content.split(/\s+/)
      .filter(word => word.length > 3) // Filter out very short words
      .filter(word => !/^(the|and|that|this|with|from|about|which|their|there|would|could|should|have|been|will|your|they|what|when|where|why|how)$/i.test(word)) // Filter out common words
      .filter(word => /[A-Z]/.test(word) || /ing$/.test(word) || /ed$/.test(word)); // Keep capitalized words and action words

    // Combine all keywords and remove duplicates
    const keywords = [...new Set([
      ...boldTerms,
      ...properNouns,
      ...historicalTerms,
      ...historicalFigures,
      ...culturalTerms,
      ...words
    ])];
    
    // Prioritize longer, more specific terms
    return keywords
      .sort((a, b) => b.length - a.length)
      .slice(0, 12); // Return more keywords for better matching
  }

  /**
   * Generate search strategies from keywords and subject
   * @param {string} subject - The lesson subject
   * @param {string[]} keywords - Array of keywords
   * @returns {string[]} Array of search strategies
   */
  generateSearchStrategies(subject, keywords) {
    const strategies = [
      // Strategy 1: Exact subject match
      subject,
      // Strategy 2: Subject with first keyword
      keywords[0] ? `${subject} ${keywords[0]}` : subject,
      // Strategy 3: Subject with second keyword
      keywords[1] ? `${subject} ${keywords[1]}` : subject,
      // Strategy 4: Subject with first two keywords
      keywords[0] && keywords[1] ? `${subject} ${keywords[0]} ${keywords[1]}` : subject,
      // Strategy 5: First keyword with second keyword
      keywords[0] && keywords[1] ? `${keywords[0]} ${keywords[1]}` : keywords[0],
      // Strategy 6: Subject with third keyword
      keywords[2] ? `${subject} ${keywords[2]}` : subject,
      // Strategy 7: First keyword with third keyword
      keywords[0] && keywords[2] ? `${keywords[0]} ${keywords[2]}` : keywords[0],
      // Strategy 8: Second keyword with third keyword
      keywords[1] && keywords[2] ? `${keywords[1]} ${keywords[2]}` : keywords[1]
    ];

    // Add historical context strategies
    if (keywords.some(k => /ancient|classical|medieval|renaissance|modern/i.test(k))) {
      strategies.push(
        // Strategy 9: Subject with historical period
        `${subject} ${keywords.find(k => /ancient|classical|medieval|renaissance|modern/i.test(k))}`,
        // Strategy 10: First keyword with historical period
        `${keywords[0]} ${keywords.find(k => /ancient|classical|medieval|renaissance|modern/i.test(k))}`
      );
    }

    // Add cultural context strategies
    if (keywords.some(k => /art|culture|society|philosophy/i.test(k))) {
      strategies.push(
        // Strategy 11: Subject with cultural term
        `${subject} ${keywords.find(k => /art|culture|society|philosophy/i.test(k))}`,
        // Strategy 12: First keyword with cultural term
        `${keywords[0]} ${keywords.find(k => /art|culture|society|philosophy/i.test(k))}`
      );
    }

    // Remove duplicates and empty strings
    return [...new Set(strategies)].filter(Boolean);
  }

  /**
   * Search for an image using a specific strategy
   * @param {string} searchQuery - The search query to use
   * @returns {Promise<{url: string, description: string, source: string, pageUrl: string}|null>}
   */
  async searchForImage(searchQuery) {
    try {
        // Step 1: Search for the page
        const searchParams = new URLSearchParams({
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: searchQuery,
          origin: '*'
        });
        const searchResp = await fetch(`${this.baseUrl}?${searchParams}`);
        const searchData = await searchResp.json();
        
        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
          console.log('WikipediaImageService: No search results found for:', searchQuery);
        return null;
        }

        const pageTitle = searchData.query.search[0].title;
        
        // Step 2: Get the page image
        const imageParams = new URLSearchParams({
          action: 'query',
          format: 'json',
          prop: 'pageimages|description',
          titles: pageTitle,
          pithumbsize: 800,
          origin: '*'
        });
        const imageResp = await fetch(`${this.baseUrl}?${imageParams}`);
        const imageData = await imageResp.json();
        const pages = imageData.query && imageData.query.pages ? imageData.query.pages : {};
        const page = Object.values(pages)[0];
        
        if (!page || !page.thumbnail || !page.thumbnail.source) {
          console.log('WikipediaImageService: No image found for page:', pageTitle);
        return null;
        }

      return {
          url: page.thumbnail.source,
          description: page.title + (page.description ? `: ${page.description}` : ''),
          source: 'Wikipedia',
          pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
        };
    } catch (error) {
      console.error('WikipediaImageService: Error searching for image:', error);
      return null;
    }
  }

  /**
   * Fetch a subject-related image from Wikipedia
   * @param {string} subject - The subject or lesson title
   * @param {string} content - The lesson content
   * @param {string} moduleId - The module ID
   * @returns {Promise<{url: string, description: string, source: string, pageUrl: string}|null>}
   */
  async fetchImageForSubject(subject, content = '', moduleId = null) {
    if (!subject || typeof subject !== 'string') return null;
    
    // Create a cache key that includes both subject and content
    const cacheKey = `${subject}-${content.substring(0, 100)}`;
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey);
    }

    // Initialize module's used images set if it doesn't exist
    if (moduleId && !this.moduleUsedImages.has(moduleId)) {
      this.moduleUsedImages.set(moduleId, new Set());
    }

    // Check if there's already an active search for this subject
    if (this.activeSearches.has(cacheKey)) {
      return this.activeSearches.get(cacheKey);
    }

    // Create a new search promise
    const searchPromise = (async () => {
      try {
        // Extract keywords from content
        const keywords = this.extractKeywords(content);
        
        // Generate search strategies
        const searchStrategies = this.generateSearchStrategies(subject, keywords);
        console.log('WikipediaImageService: Generated search strategies:', searchStrategies);

        // Try each strategy until we find an image
        for (const searchQuery of searchStrategies) {
          console.log('WikipediaImageService: Trying search query:', searchQuery);
          
          const result = await this.searchForImage(searchQuery);
          
          if (result) {
            // Check if this image is already used in the current module
            if (moduleId) {
              const usedImages = this.moduleUsedImages.get(moduleId);
              if (usedImages.has(result.url)) {
                console.log('WikipediaImageService: Image already used in this module, trying next strategy');
                continue; // Try next strategy
              }
            }

            // Cache the result
        this.imageCache.set(cacheKey, result);
            
            // Store in module images if this is a module lesson
            if (moduleId) {
              this.moduleImages.set(moduleId, result);
              this.moduleUsedImages.get(moduleId).add(result.url);
            }
            
        return result;
          }
        }

        // If we've tried all strategies and found nothing, start a new search with different combinations
        console.log('WikipediaImageService: No image found with initial strategies, continuing search...');
        
        // Generate additional search strategies with different combinations
        const additionalStrategies = [
          ...keywords.map(k => `${subject} ${k}`),
          ...keywords.map(k => k),
          ...keywords.slice(0, 3).map((k, i) => 
            keywords.slice(i + 1, i + 3).map(k2 => `${k} ${k2}`)
          ).flat()
        ].filter(Boolean);

        // Try additional strategies
        for (const searchQuery of additionalStrategies) {
          console.log('WikipediaImageService: Trying additional search query:', searchQuery);
          
          const result = await this.searchForImage(searchQuery);
          
          if (result) {
            // Check if this image is already used in the current module
            if (moduleId) {
              const usedImages = this.moduleUsedImages.get(moduleId);
              if (usedImages.has(result.url)) {
                console.log('WikipediaImageService: Image already used in this module, trying next strategy');
                continue; // Try next strategy
              }
            }

            // Cache the result
            this.imageCache.set(cacheKey, result);
            
            // Store in module images if this is a module lesson
            if (moduleId) {
              this.moduleImages.set(moduleId, result);
              this.moduleUsedImages.get(moduleId).add(result.url);
            }
            
            return result;
          }
        }

        console.log('WikipediaImageService: No image found after trying all strategies');
      return null;

    } catch (error) {
      console.error('WikipediaImageService error:', error);
      return null;
      } finally {
        // Clean up the active search
        this.activeSearches.delete(cacheKey);
      }
    })();

    // Store the search promise
    this.activeSearches.set(cacheKey, searchPromise);
    
    return searchPromise;
  }
}

export const wikipediaImageService = new WikipediaImageService(); 