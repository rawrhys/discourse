'use strict';
import { API_BASE_URL } from '../config/api.js';

const SimpleImageService = {
  // Test server connectivity
  async testServerConnection() {
    try {
      const testUrl = `${API_BASE_URL}/api/test`;
      console.log('[SimpleImageService] Testing server connection at:', testUrl);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SimpleImageService] Server test successful:', data);
        return true;
      }
      console.warn('[SimpleImageService] Server test failed:', response.status);
      return false;
      
    } catch (error) {
      console.error('[SimpleImageService] Server test error:', error);
      return false;
    }
  },

  // Simple image search - just make the API call
  async search(lessonTitle, content = '', usedImageTitles = [], usedImageUrls = [], courseId = undefined, lessonId = undefined, forceUnique = false) {
    try {
      const searchUrl = `${API_BASE_URL}/api/image-search/search`;
      
      let finalQuery = lessonTitle;
      if (forceUnique) {
        const uniqueStr = Math.random().toString(36).substring(2, 10);
        finalQuery = `${lessonTitle} ${uniqueStr}`;
      }
      
      console.log('[SimpleImageService] Searching for:', finalQuery);
      
      const requestBody = { 
        lessonTitle: finalQuery, 
        content, 
        usedImageTitles, 
        usedImageUrls, 
        courseId, 
        lessonId,
        disableModeration: true
      };
      
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
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
      return data;
      
    } catch (error) {
      console.error('[SimpleImageService] Search failed:', error.message);
      return {
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y5ZjlmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l5ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOdCBBdmFpbGFibGU8L3RleHQ+PC9zdmc+',
        title: lessonTitle || 'Lesson Image',
        pageURL: '',
        attribution: 'Placeholder image',
        uploader: 'System'
      };
    }
  },

  // Enhanced search with course context
  searchWithContext: function(lessonTitle, courseSubject, content, usedImageTitles, usedImageUrls, courseId, lessonId, coursePrompt = null) {
    try {
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
          } else if (content.introduction) {
            // Combine introduction and main_content if available
            const intro = content.introduction || '';
            const main = content.main_content || '';
            const conclusion = content.conclusion || '';
            content = [intro, main, conclusion].filter(Boolean).join(' ');
          } else if (content.toString && content.toString() !== '[object Object]') {
            content = content.toString();
          } else {
            // Fallback: try to extract meaningful text from object
            const textParts = [];
            for (const key in content) {
              if (typeof content[key] === 'string' && content[key].length > 10) {
                textParts.push(content[key]);
              }
            }
            content = textParts.join(' ') || '';
          }
        } else if (typeof content !== 'string') {
          content = String(content);
        }
      } else {
        content = '';
      }
      
      // Ensure other parameters are strings
      lessonTitle = lessonTitle ? String(lessonTitle) : '';
      courseSubject = courseSubject ? String(courseSubject) : '';
      coursePrompt = coursePrompt ? String(coursePrompt) : '';
      
      // Debug logging for content processing
      if (process.env.NODE_ENV === 'development' && content && content.includes('[object Object]')) {
        console.warn('[SimpleImageService] Detected [object Object] in content, this indicates improper content handling');
      }
      
      var contextualQuery = this.createEnhancedContextAwareQuery(lessonTitle, courseSubject, content, coursePrompt);
      return this.search(contextualQuery, content, usedImageTitles, usedImageUrls, courseId, lessonId, true);
    } catch (error) {
      console.error('[SimpleImageService] Error in searchWithContext:', error);
      // Fallback to basic search
      return this.search(lessonTitle || 'lesson', content || '', usedImageTitles, usedImageUrls, courseId, lessonId, false);
    }
  },

  // Get image source for debugging
  getImageSource: function(url) {
    if (!url || typeof url !== 'string') return 'unknown';
    var lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('wikipedia.org') || lowerUrl.includes('wikimedia.org')) {
      return 'wikipedia';
    } else if (lowerUrl.includes('pixabay.com')) {
      return 'pixabay';
    } else if (lowerUrl.includes('metmuseum.org')) {
      return 'metmuseum';
    } else if (lowerUrl.includes('thediscourse.ai') || lowerUrl.includes('localhost')) {
      return 'local';
    }
    return 'unknown';
  },

  // Create context-aware search query
  createContextAwareQuery: function(lessonTitle, courseSubject, content) {
    courseSubject = courseSubject || '';
    content = content || '';
    if (!lessonTitle) return '';
    var query = String(lessonTitle).trim();
    if (courseSubject) {
      query = courseSubject + ' ' + query;
    }
    if (query.toLowerCase().includes('rome') || query.toLowerCase().includes('ancient') || query.toLowerCase().includes('history')) {
      query = query + ' history';
    }
    return query;
  },

  // Create enhanced context-aware search query using course prompt and lesson text
  createEnhancedContextAwareQuery: function(lessonTitle, courseSubject, content, coursePrompt) {
    try {
      courseSubject = courseSubject || '';
      content = content || '';
      coursePrompt = coursePrompt || '';
      
      if (!lessonTitle) return '';
      
      // Start with the lesson title
      var query = String(lessonTitle).trim();
    
    // Add course subject for broader context
    if (courseSubject) {
      query = courseSubject + ' ' + query;
    }
    
    // Add course prompt/description for enhanced context
    if (coursePrompt) {
      // Extract key terms from course prompt (first 100 characters to avoid too long queries)
      var promptTerms = coursePrompt.substring(0, 100).split(' ').filter(word => 
        word.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'during', 'including', 'until', 'against', 'among', 'throughout', 'despite', 'towards', 'upon'].includes(word.toLowerCase())
      ).slice(0, 3).join(' ');
      
      if (promptTerms) {
        query = query + ' ' + promptTerms;
      }
    }
    
    // Extract key terms from lesson content for more specific context
    if (content && typeof content === 'string') {
      // Look for key terms in content (bold text, important concepts)
      var contentTerms = '';
      var contentWords = content.split(' ').filter(word => 
        word.length > 4 && 
        (word.startsWith('**') || word.endsWith('**') || 
         word.charAt(0) === word.charAt(0).toUpperCase() && word.length > 5)
      ).slice(0, 2);
      
      if (contentWords.length > 0) {
        contentTerms = contentWords.join(' ');
        query = query + ' ' + contentTerms;
      }
      
      // Extract specific historical terms from content for better image relevance
      var historicalTerms = this.extractHistoricalTerms(content);
      if (historicalTerms) {
        query = query + ' ' + historicalTerms;
      }
    }
    
    // Add historical context for history-related topics
    if (query.toLowerCase().includes('rome') || query.toLowerCase().includes('ancient') || query.toLowerCase().includes('history') || 
        query.toLowerCase().includes('greek') || query.toLowerCase().includes('greece') || query.toLowerCase().includes('egypt')) {
      query = query + ' history';
    }
    
    // Add educational context for better image relevance
    if (query.toLowerCase().includes('science') || query.toLowerCase().includes('chemistry') || query.toLowerCase().includes('physics')) {
      query = query + ' educational';
    }
    
    // Add art context for art-related topics
    if (query.toLowerCase().includes('art') || query.toLowerCase().includes('painting') || query.toLowerCase().includes('sculpture')) {
      query = query + ' art';
    }
    
    console.log('[SimpleImageService] Enhanced query created:', query);
    return query;
    } catch (error) {
      console.error('[SimpleImageService] Error in createEnhancedContextAwareQuery:', error);
      // Fallback to basic query
      return lessonTitle || 'lesson';
    }
  },

  // Extract historical terms from content for better image relevance
  extractHistoricalTerms: function(content) {
    if (!content || typeof content !== 'string') return '';
    
    var terms = [];
    
    // Look for specific historical periods and concepts
    var historicalPatterns = [
      /\bArchaic Period\b/gi,
      /\bClassical Period\b/gi,
      /\bAncient Greece\b/gi,
      /\bAncient Rome\b/gi,
      /\bGreek City-States\b/gi,
      /\bPolis\b/gi,
      /\bAcropolis\b/gi,
      /\bAgora\b/gi,
      /\bOracle of Delphi\b/gi,
      /\bOlympic Games\b/gi,
      /\bLyric Poetry\b/gi,
      /\bSappho\b/gi,
      /\bHomer\b/gi,
      /\bMount Parnassus\b/gi,
      /\bDelphi\b/gi,
      /\bOlympia\b/gi,
      /\bZeus\b/gi,
      /\bApollo\b/gi,
      /\bPythia\b/gi
    ];
    
    historicalPatterns.forEach(pattern => {
      var matches = content.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    });
    
    // Remove duplicates and limit to 3 most relevant terms
    var uniqueTerms = [...new Set(terms)].slice(0, 3);
    
    return uniqueTerms.join(' ');
  }
};

export default SimpleImageService; 