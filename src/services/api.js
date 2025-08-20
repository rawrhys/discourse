import apiClient from './apiClient';
import { API_BASE_URL } from '../config/api.js';

class AIService {
  async getDefinitionForTerm(term, lessonContext, lessonTitle) {
    try {
      const response = await apiClient.post('/api/ai/definition', {
        term,
        lessonContext,
        lessonTitle,
      });
      return response.definition || `Could not generate a definition for "${term}".`;
    } catch (error) {
      console.error(`[AIService] Error fetching definition for "${term}":`, error);
      return `Definition not available for "${term}". The server might be busy.`;
    }
  }

  validateCourseStructure(data) {
    if (!data || !data.title || !data.modules || !Array.isArray(data.modules)) {
      return false;
    }
    for (const module of data.modules) {
      if (!module.title || !module.lessons || !Array.isArray(module.lessons)) {
        return false;
      }
      for (const lesson of module.lessons) {
        if (!lesson.title) {
          return false;
        }
      }
    }
    return true;
  }

  async getUser(userId) {
    try {
      const user = await apiClient.get(`/api/users/${userId}`);
      return user;
    } catch (error) {
      console.error('Failed to fetch user', error);
      return null;
    }
  }

  /**
   * Generate bibliography for a lesson (frontend fallback)
   * @param {string} topic - The lesson topic
   * @param {string} subject - The course subject
   * @param {number} numReferences - Number of references to generate
   * @returns {Array} Array of reference objects
   */
  generateBibliography(topic, subject, numReferences = 5) {
    // This is a simplified frontend fallback - the main bibliography generation happens on the server
    const defaultReferences = [
      {
        author: 'Encyclopaedia Britannica',
        title: 'Academic Edition',
        year: '2024',
        publisher: 'Encyclopaedia Britannica, Inc.',
        type: 'reference',
        verified: true,
        citationNumber: 1
      },
      {
        author: 'Oxford University Press',
        title: 'Oxford Classical Dictionary',
        year: '2012',
        publisher: 'Oxford University Press',
        type: 'reference',
        verified: true,
        citationNumber: 2
      }
    ];
    
    return defaultReferences.slice(0, numReferences);
  }

  /**
   * Format bibliography as markdown (frontend fallback)
   * @param {Array} bibliography - Array of reference objects
   * @returns {string} Formatted markdown bibliography
   */
  formatBibliographyAsMarkdown(bibliography) {
    if (!bibliography || bibliography.length === 0) {
      return '';
    }

    let markdown = '\n\n## References\n\n';
    
    bibliography.forEach((ref, index) => {
      // Ensure proper citation number
      const citationNumber = ref.citationNumber || (index + 1);
      
      // Format citation with proper spacing and punctuation
      const citation = `[${citationNumber}] ${ref.author}. (${ref.year}). *${ref.title}*. ${ref.publisher}.`;
      
      // Add citation with proper line breaks
      markdown += citation + '\n\n';
    });
    
    return markdown;
  }
}

const aiService = new AIService();

const api = {
    getLesson: (moduleId, lessonId) => 
        apiClient(`/api/lessons/${moduleId}/${lessonId}`),

    getModule: (moduleId) => 
        apiClient(`/api/modules/${moduleId}`),

    getCourse: (courseId) => 
        apiClient(`/api/courses/${courseId}`),

    getPublicCourse: (courseId, sessionId = null) => {
        // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
        const normalizedId = String(courseId || '').replace(/_[0-9]{10,}$/,'');
        let fullUrl = `${API_BASE_URL}/api/public/courses/${normalizedId}`;
        
        // Add sessionId as query parameter if provided
        if (sessionId) {
            fullUrl += `?sessionId=${encodeURIComponent(sessionId)}`;
        }
        
        console.log('📡 [API SERVICE] Fetching public course:', fullUrl);
        
        return fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(response => {
            console.log('📡 [API SERVICE] Response status:', response.status);
            // Handle CAPTCHA response (200 status with requiresCaptcha flag)
            if (response.status === 200) {
                return response.json().then(data => {
                    console.log('📡 [API SERVICE] Response data:', data);
                    // Return CAPTCHA data as successful response instead of throwing error
                    return data;
                });
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        });
    },

    saveCourse: (course) => 
        apiClient('/api/courses', {
            method: 'POST',
            body: JSON.stringify(course),
        }),
    
    getDefinitionForTerm: aiService.getDefinitionForTerm,
    validateCourseStructure: aiService.validateCourseStructure,
    getUser: aiService.getUser,
    generateBibliography: aiService.generateBibliography,
    formatBibliographyAsMarkdown: aiService.formatBibliographyAsMarkdown,

    generateCourse: (topic, difficulty, numModules, numLessonsPerModule) => {
        console.log('📡 [API SERVICE] Calling simplified generateCourse API', {
            topic: topic,
            difficulty: difficulty,
            numModules: numModules,
            numLessonsPerModule: numLessonsPerModule,
            timestamp: new Date().toISOString()
        });
        
        return apiClient('/api/courses/generate', {
            method: 'POST',
            body: JSON.stringify({ topic, difficulty, numModules, numLessonsPerModule }),
        });
    },
    
    getSavedCourses: () => {
        console.log('📡 [API SERVICE] Fetching saved courses');
        return apiClient('/api/courses/saved');
    },
    
    getUserCredits: () => {
        console.log('📡 [API SERVICE] Fetching user credits');
        return apiClient('/api/user/credits');
    },
        
    deleteCourse: (courseId) =>
        apiClient(`/api/courses/${courseId}`, { method: 'DELETE' }),

    clearCache: (courseId = null, cacheType = null) => {
        const body = {};
        if (courseId) body.courseId = courseId;
        if (cacheType) body.cacheType = cacheType;
        
        return apiClient('/api/admin/clear-cache', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    publishCourse: (courseId) =>
        apiClient(`/api/courses/${courseId}/publish`, { method: 'POST' }),

    unpublishCourse: (courseId) =>
        apiClient(`/api/courses/${courseId}/unpublish`, { method: 'POST' }),

    getCurrentUser: () =>
        apiClient('/api/auth/me'),

    login: (email, password) =>
        apiClient('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    register: (email, password, name, { gdprConsent, policyVersion } = {}) =>
        apiClient('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, gdprConsent: !!gdprConsent, policyVersion: policyVersion || '1.0' }),
        }),

    logout: () =>
        apiClient('/api/auth/logout', { method: 'POST' }),
};

export default api;

// This hook is now a simple wrapper around the api object.
// It can be used in components to access the api functions.
export const useApiWrapper = () => {
    return api;
}; 