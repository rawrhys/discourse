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
}

const aiService = new AIService();

const api = {
    getLesson: (moduleId, lessonId) => 
        apiClient(`/api/lessons/${moduleId}/${lessonId}`),

    getModule: (moduleId) => 
        apiClient(`/api/modules/${moduleId}`),

    getCourse: (courseId) => 
        apiClient(`/api/courses/${courseId}`),

    getPublicCourse: (courseId) => {
        // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
        const normalizedId = String(courseId || '').replace(/_[0-9]{10,}$/,'');
        const fullUrl = `${API_BASE_URL}/api/public/courses/${normalizedId}`;
        
        console.log('📡 [API SERVICE] Fetching public course:', fullUrl);
        
        return fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(response => {
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

    getQuizScoresForModule: (moduleId) => 
        apiClient(`/api/modules/${moduleId}/quiz-scores`),
    
    getDefinitionForTerm: aiService.getDefinitionForTerm,
    validateCourseStructure: aiService.validateCourseStructure,
    getUser: aiService.getUser,

    generateCourse: (topic, difficulty, numModules, numLessonsPerModule, onProgress) => {
        console.log('📡 [API SERVICE] Calling generateCourse API', {
            topic: topic,
            difficulty: difficulty,
            numModules: numModules,
            numLessonsPerModule: numLessonsPerModule,
            timestamp: new Date().toISOString()
        });
        
        return apiClient('/api/courses/generate', {
            method: 'POST',
            body: JSON.stringify({ topic, difficulty, numModules, numLessonsPerModule }),
            onProgress,
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