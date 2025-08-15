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
  async search(lessonTitle, content = '', usedImageTitles = [], usedImageUrls = [], courseId = undefined, lessonId = undefined) {
    try {
      const searchUrl = `${API_BASE_URL}/api/image-search/search`;
      
      console.log('[SimpleImageService] Searching for:', lessonTitle);
      
      const requestBody = { 
        lessonTitle, 
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

  // Simple search with context
  searchWithContext: function(lessonTitle, courseSubject, content, usedImageTitles, usedImageUrls, courseId, lessonId) {
    var contextualQuery = this.createContextAwareQuery(lessonTitle, courseSubject, content);
    return this.search(contextualQuery, content, usedImageTitles, usedImageUrls, courseId, lessonId);
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

  // Find duplicate images
  findDuplicateImages: function(course) {
    if (!course || !course.modules) return [];
    var imageMap = new Map();
    var duplicates = [];
    for (var i = 0; i < course.modules.length; i++) {
      var module = course.modules[i];
      for (var j = 0; j < (module.lessons || []).length; j++) {
        var lesson = module.lessons[j];
        var imageUrl = (lesson.image && lesson.image.imageUrl) || (lesson.image && lesson.image.url);
        if (imageUrl) {
          if (!imageMap.has(imageUrl)) {
            imageMap.set(imageUrl, []);
          }
          imageMap.get(imageUrl).push({
            moduleTitle: module.title,
            lessonTitle: lesson.title,
            lessonId: lesson.id,
            moduleId: module.id
          });
        }
      }
    }
    imageMap.forEach(function(lessons, url) {
      if (lessons.length > 1) {
        duplicates.push({
          url: url,
          usageCount: lessons.length,
          lessons: lessons
        });
      }
    });
    return duplicates;
  },

  // Log duplicate image analysis
  logDuplicateImageAnalysis: function(course) {
    var duplicates = this.findDuplicateImages(course);
    if (duplicates.length > 0) {
      console.group('[SimpleImageService] Duplicate Image Analysis');
      console.warn('Found ' + duplicates.length + ' images used multiple times:');
      duplicates.forEach(function(dup, index) {
        console.group('Duplicate ' + (index + 1) + ': ' + dup.url);
        console.log('Used ' + dup.usageCount + ' times:');
        dup.lessons.forEach(function(lesson) {
          console.log('• ' + lesson.moduleTitle + ' > ' + lesson.lessonTitle);
        });
        console.groupEnd();
      });
      console.groupEnd();
    } else {
      console.log('[SimpleImageService] No duplicate images found - all images are unique!');
    }
    return duplicates;
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
  }
};

export default SimpleImageService; 