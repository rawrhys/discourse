// src/utils/debug.js
'use strict';

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
  }
};

// Log that debug utilities are available
console.log('🔧 [DEBUG] Course generation debug utilities loaded. Use window.debugCourseGeneration to access debug functions.');
console.log('🔧 [DEBUG] Available functions:', Object.keys(window.debugCourseGeneration));

export default window.debugCourseGeneration; 