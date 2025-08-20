// src/utils/debug.js
'use strict';

import { API_BASE_URL } from '../config/api.js';

// Global debug utility for course generation
window.debugCourseGeneration = {
  // Get current user info
  getUserInfo: function() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      user: user,
      timestamp: new Date().toISOString()
    };
  },

  // Test API connectivity
  testApiConnection: async function() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      console.log('🔍 [DEBUG] API Health Check:', data);
      return { success: true, data };
    } catch (error) {
      console.error('🔍 [DEBUG] API Health Check Failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current course generation state
  getCourseGenerationState: function() {
    // This will be populated by components that manage course generation state
    return {
      timestamp: new Date().toISOString(),
      localStorage: {
        token: !!localStorage.getItem('token'),
        user: !!localStorage.getItem('user')
      }
    };
  },

  // Clear all console logs and start fresh
  clearLogs: function() {
    console.clear();
    console.log('🧹 [DEBUG] Console cleared at:', new Date().toISOString());
  },

  // Log current environment info
  logEnvironment: function() {
    console.log('🌍 [DEBUG] Environment Info:', {
      userAgent: navigator.userAgent,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  },

  // Test course generation with sample data
  testCourseGeneration: async function() {
    console.log('🧪 [DEBUG] Testing course generation with sample data...');

    const sampleParams = {
      topic: 'Test Course',
      difficulty: 'beginner',
      numModules: 1,
      numLessonsPerModule: 1
    };

    console.log('📋 [DEBUG] Sample parameters:', sampleParams);

    try {
      const response = await fetch('/api/courses/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(sampleParams)
      });

      console.log('📡 [DEBUG] Test response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [DEBUG] Test course generation successful:', data);
        return { success: true, data };
      } else {
        const errorData = await response.text();
        console.error('❌ [DEBUG] Test course generation failed:', errorData);
        return { success: false, error: errorData };
      }
    } catch (error) {
      console.error('💥 [DEBUG] Test course generation error:', error);
      return { success: false, error: error.message };
    }
  },

  // Clear all `unlockedModules` from localStorage
  clearUnlockedModules: function() {
    Object.keys(localStorage).forEach(function(key) {
      if (key.startsWith('unlockedModules_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('🧹 [DEBUG] Unlocked modules cleared from localStorage.');
  },

  // Reset all quiz scores for the current course
  resetQuizScores: async function(courseId) {
    if (!courseId) {
      console.error('❌ [DEBUG] No courseId provided.');
      return;
    }

    try {
      // Fetch the current course data
      const course = await window.api.getCourse(courseId);
      if (!course) {
        console.error('❌ [DEBUG] Course not found.');
        return;
      }

      // Reset quiz scores
      course.modules.forEach(function(module) {
        module.lessons.forEach(function(lesson) {
          lesson.quizScore = undefined;
        });
      });

      // Save the updated course data
      await window.api.saveCourse(course);
      console.log('✅ [DEBUG] Quiz scores reset for course:', courseId);
    } catch (error) {
      console.error('💥 [DEBUG] Error resetting quiz scores:', error);
    }
  },

  // Clear all quiz scores from localStorage
  clearQuizScoresFromLocalStorage: function() {
    localStorage.removeItem('quizScores');
    console.log('✅ [DEBUG] Quiz scores cleared from localStorage');
  },

  // View all quiz scores from localStorage
  viewQuizScoresFromLocalStorage: function() {
    const scores = localStorage.getItem('quizScores');
    if (scores) {
      console.log('📊 [DEBUG] Quiz scores in localStorage:', JSON.parse(scores));
    } else {
      console.log('📊 [DEBUG] No quiz scores found in localStorage');
    }
  },

  // Clear quiz scores for a specific course
  clearQuizScoresForCourse: function(courseId) {
    const scores = JSON.parse(localStorage.getItem('quizScores') || '{}');
    const courseKey = `${courseId}_`;
    
    Object.keys(scores).forEach(key => {
      if (key.startsWith(courseKey)) {
        delete scores[key];
      }
    });
    
    localStorage.setItem('quizScores', JSON.stringify(scores));
    console.log(`✅ [DEBUG] Quiz scores cleared for course: ${courseId}`);
  },

  // Clear quiz scores from backend database
  clearQuizScoresFromBackend: async function(courseId) {
    if (!courseId) {
      console.error('❌ [DEBUG] No courseId provided.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ [DEBUG] No authentication token found.');
        return;
      }

      const response = await fetch(`/api/courses/${courseId}/clear-quiz-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [DEBUG] Quiz scores cleared from backend:', result);
      
      // Also clear from localStorage
      this.clearQuizScoresForCourse(courseId);
      
      // Reload the page to refresh the course state
      console.log('🔄 [DEBUG] Reloading page to refresh course state...');
      window.location.reload();
      
    } catch (error) {
      console.error('💥 [DEBUG] Error clearing quiz scores from backend:', error);
    }
  },

  // Get quiz persistence statistics
  getQuizPersistenceStats: function() {
    try {
      const QuizPersistenceService = require('../services/QuizPersistenceService').default;
      const stats = QuizPersistenceService.getPersistenceStats();
      console.log('📊 [DEBUG] Quiz Persistence Statistics:', stats);
      return stats;
    } catch (error) {
      console.error('💥 [DEBUG] Error getting quiz persistence stats:', error);
      return null;
    }
  },

  // Test quiz persistence service
  testQuizPersistence: function(courseId, lessonId, score, userId) {
    try {
      const QuizPersistenceService = require('../services/QuizPersistenceService').default;
      
      // Test saving
      const saveResult = QuizPersistenceService.saveQuizScore(courseId, lessonId, score, userId);
      console.log('✅ [DEBUG] Quiz persistence save test:', saveResult);
      
      // Test retrieving
      const retrievedScore = QuizPersistenceService.getQuizScore(courseId, lessonId, userId);
      console.log('✅ [DEBUG] Quiz persistence retrieve test:', retrievedScore);
      
      return { saveResult, retrievedScore };
    } catch (error) {
      console.error('💥 [DEBUG] Error testing quiz persistence:', error);
      return null;
    }
  },

  // Debug function to check current course state
  debugCourseState: function() {
    console.log('🔍 [DEBUG] Current Course State Debug:');
    console.log('localStorage quizScores:', localStorage.getItem('quizScores'));
    
    // Try to get course data from the current page
    const courseElement = document.querySelector('[data-course-id]');
    if (courseElement) {
      console.log('Course element found:', courseElement.dataset);
    }
    
    // Check for any React components with course data
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalFiber) {
      console.log('React root found, checking for course state...');
    }
    
    console.log('🔍 [DEBUG] End Course State Debug');
  },

  // Force refresh the course display
  forceRefreshCourse: function() {
    console.log('🔄 [DEBUG] Forcing course refresh...');
    window.location.reload();
  },

  // Test quiz submission endpoint
  testQuizEndpoint: async function() {
    console.log('🧪 [DEBUG] Testing quiz submission endpoint...');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ [DEBUG] No authentication token found');
        return;
      }

      // Use static import instead of dynamic import
      console.log('🔗 [DEBUG] API_BASE_URL:', API_BASE_URL);
      console.log('🌐 [DEBUG] Current window location:', window.location.href);

      // Try to get the actual course ID from the current page
      let actualCourseId = null;
      let actualModuleId = null;
      let actualLessonId = null;

      // First, try to get from React state (most reliable)
      if (window.currentCourseData) {
        actualCourseId = window.currentCourseData.courseId;
        actualModuleId = window.currentCourseData.activeModuleId;
        actualLessonId = window.currentCourseData.activeLessonId;
        console.log('📋 [DEBUG] Found course data from React state:', window.currentCourseData);
      }

      // Fallback: Check if we're on a course page and can extract IDs
      if (!actualCourseId) {
        const courseElement = document.querySelector('[data-course-id]');
        if (courseElement) {
          actualCourseId = courseElement.dataset.courseId;
          console.log('📋 [DEBUG] Found course ID from DOM:', actualCourseId);
        }
      }

      // Fallback: Try to get from URL params
      if (!actualCourseId) {
        const urlParams = new URLSearchParams(window.location.search);
        const courseIdFromUrl = urlParams.get('courseId');
        if (courseIdFromUrl) {
          actualCourseId = courseIdFromUrl;
          console.log('📋 [DEBUG] Found course ID from URL:', actualCourseId);
        }
      }

      // If we still don't have a course ID, try to get it from localStorage or React state
      if (!actualCourseId) {
        console.log('⚠️ [DEBUG] No course ID found, using test data');
        const testData = {
          courseId: 'test-course-id',
          moduleId: 'test-module-id', 
          lessonId: 'test-lesson-id',
          score: 5
        };

        const endpointUrl = `${API_BASE_URL}/api/quizzes/submit`;
        console.log('📡 [DEBUG] Making test request to:', endpointUrl);

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(testData)
        });

        console.log('📡 [DEBUG] Quiz endpoint response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ [DEBUG] Quiz endpoint working:', data);
        } else {
          const errorText = await response.text();
          console.error('❌ [DEBUG] Quiz endpoint error:', response.status, errorText);
        }
        return;
      }

      // Use actual course data if available
      if (actualCourseId && actualModuleId && actualLessonId) {
        console.log('✅ [DEBUG] Using actual course data for test');
        console.log('📋 [DEBUG] Course ID:', actualCourseId);
        console.log('📋 [DEBUG] Module ID:', actualModuleId);
        console.log('📋 [DEBUG] Lesson ID:', actualLessonId);

        const realTestData = {
          courseId: actualCourseId,
          moduleId: actualModuleId,
          lessonId: actualLessonId,
          score: 5
        };

        const endpointUrl = `${API_BASE_URL}/api/quizzes/submit`;
        console.log('📡 [DEBUG] Making real test request to:', endpointUrl);
        console.log('📡 [DEBUG] Request data:', realTestData);

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(realTestData)
        });

        console.log('📡 [DEBUG] Quiz endpoint response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ [DEBUG] Quiz endpoint working with real data:', data);
        } else {
          const errorText = await response.text();
          console.error('❌ [DEBUG] Quiz endpoint error with real data:', response.status, errorText);
        }
      } else {
        console.log('⚠️ [DEBUG] Missing course data, cannot test with real IDs');
      }

    } catch (error) {
      console.error('💥 [DEBUG] Quiz endpoint test failed:', error);
      console.error('💥 [DEBUG] Error details:', error.message);
    }
  }
};

// Log that debug utilities are available - only in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [DEBUG] Course generation debug utilities loaded. Use window.debugCourseGeneration to access debug functions.');
  console.log('🔧 [DEBUG] Available functions:', Object.keys(window.debugCourseGeneration));
}

// Add TTS debugging functions
window.debugTTS = {
  // Test pause/resume functionality
  testPauseResume: async () => {
    try {
      console.log('🔧 [DEBUG TTS] Testing pause/resume functionality...');
      
      // Try to find TTS services
      const publicTTSService = window.publicTTSService;
      const privateTTSService = window.privateTTSService;
      
      if (publicTTSService) {
        console.log('🔧 [DEBUG TTS] Found public TTS service, testing...');
        await publicTTSService.testPauseResume();
      } else if (privateTTSService) {
        console.log('🔧 [DEBUG TTS] Found private TTS service, testing...');
        await privateTTSService.testPauseResume();
      } else {
        console.log('🔧 [DEBUG TTS] No TTS service found in window object');
      }
    } catch (error) {
      console.error('🔧 [DEBUG TTS] Test failed:', error);
    }
  },
  
  // Get TTS service state
  getTTSState: () => {
    try {
      const publicTTSService = window.publicTTSService;
      const privateTTSService = window.privateTTSService;
      
      if (publicTTSService) {
        console.log('🔧 [DEBUG TTS] Public TTS Service State:', publicTTSService.getStatus());
        console.log('🔧 [DEBUG TTS] Public TTS Speak-TTS State:', publicTTSService.getSpeakTTSState());
      }
      
      if (privateTTSService) {
        console.log('🔧 [DEBUG TTS] Private TTS Service State:', privateTTSService.getStatus());
        console.log('🔧 [DEBUG TTS] Private TTS Speak-TTS State:', privateTTSService.getSpeakTTSState());
      }
      
      if (!publicTTSService && !privateTTSService) {
        console.log('🔧 [DEBUG TTS] No TTS services found');
      }
    } catch (error) {
      console.error('🔧 [DEBUG TTS] Error getting state:', error);
    }
  },
  
  // Force reset TTS services
  resetTTS: () => {
    try {
      const publicTTSService = window.publicTTSService;
      const privateTTSService = window.privateTTSService;
      
      if (publicTTSService) {
        console.log('🔧 [DEBUG TTS] Resetting public TTS service...');
        publicTTSService.forceResetStoppingFlag();
      }
      
      if (privateTTSService) {
        console.log('🔧 [DEBUG TTS] Resetting private TTS service...');
        privateTTSService.forceResetStoppingFlag();
      }
      
      if (!publicTTSService && !privateTTSService) {
        console.log('🔧 [DEBUG TTS] No TTS services found to reset');
      }
    } catch (error) {
      console.error('🔧 [DEBUG TTS] Error resetting TTS:', error);
    }
  }
};

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [DEBUG TTS] TTS debug utilities loaded. Use window.debugTTS to access TTS debug functions.');
  console.log('🔧 [DEBUG TTS] Available functions:', Object.keys(window.debugTTS));
}

// Add course loading debug functions
window.debugCourseLoading = {
  // Debug course loading issues
  debugCourseLoading: async function(courseId) {
    if (!courseId) {
      console.error('❌ [DEBUG] No courseId provided.');
      return;
    }

    console.log('🔍 [DEBUG] Debugging course loading for:', courseId);

    try {
      // Check if course exists in database
      const response = await fetch(`/api/debug/course/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const debugInfo = await response.json();
        console.log('📊 [DEBUG] Course debug info:', debugInfo);
        
        if (!debugInfo.courseFound) {
          console.error('❌ [DEBUG] Course not found in database!');
          console.log('📋 [DEBUG] Available courses:', debugInfo.userCourses);
        } else {
          console.log('✅ [DEBUG] Course found in database');
        }
      } else {
        console.error('❌ [DEBUG] Failed to get debug info:', response.status);
      }
    } catch (error) {
      console.error('💥 [DEBUG] Error getting debug info:', error);
    }
  },

  // Debug all user courses
  debugUserCourses: async function() {
    console.log('🔍 [DEBUG] Debugging all user courses');

    try {
      const response = await fetch('/api/debug/user-courses', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const debugInfo = await response.json();
        console.log('📊 [DEBUG] User courses debug info:', debugInfo);
      } else {
        console.error('❌ [DEBUG] Failed to get user courses debug info:', response.status);
      }
    } catch (error) {
      console.error('💥 [DEBUG] Error getting user courses debug info:', error);
    }
  },

  // Clean up orphaned courses from dashboard
  cleanupOrphanedCourses: async function() {
    console.log('🧹 [DEBUG] Cleaning up orphaned courses from dashboard...');

    try {
      // Get current courses from dashboard
      const response = await fetch('/api/courses/saved', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const dashboardCourses = await response.json();
        console.log('📋 [DEBUG] Courses in dashboard:', dashboardCourses);

        // Check each course against the database
        for (const course of dashboardCourses) {
          const courseResponse = await fetch(`/api/debug/course/${course.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (courseResponse.ok) {
            const debugInfo = await courseResponse.json();
            if (!debugInfo.courseFound) {
              console.log(`❌ [DEBUG] Orphaned course found: ${course.id} - ${course.title}`);
              console.log('💡 [DEBUG] This course exists in dashboard but not in database');
            }
          }
        }

        console.log('✅ [DEBUG] Orphaned course check completed');
      } else {
        console.error('❌ [DEBUG] Failed to get dashboard courses:', response.status);
      }
    } catch (error) {
      console.error('💥 [DEBUG] Error cleaning up orphaned courses:', error);
    }
  }
};

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [DEBUG COURSE LOADING] Course loading debug utilities loaded. Use window.debugCourseLoading to access debug functions.');
  console.log('🔧 [DEBUG COURSE LOADING] Available functions:', Object.keys(window.debugCourseLoading));
}

export default window.debugCourseGeneration; 