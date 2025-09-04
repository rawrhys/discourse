/**
 * Public Course Local Storage Service
 * Handles local storage of public course users' details and progress
 */

class PublicCourseLocalStorage {
  constructor() {
    this.storageKey = 'discourse_public_course_data';
    this.initializeStorage();
  }

  /**
   * Initialize local storage if it doesn't exist
   */
  initializeStorage() {
    if (typeof window !== 'undefined' && !localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify({
        users: {},
        progress: {},
        sessions: {}
      }));
    }
  }

  /**
   * Save user details for a public course session
   */
  saveUserDetails(sessionId, courseId, firstName, lastName, email = null) {
    if (typeof window === 'undefined') return false;

    try {
      const data = this.getStorageData();
      
      data.users[sessionId] = {
        sessionId,
        courseId,
        firstName,
        lastName,
        email,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      this.setStorageData(data);
      console.log(`[PublicCourseLocalStorage] Saved user details for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error saving user details:', error);
      return false;
    }
  }

  /**
   * Get user details for a session
   */
  getUserDetails(sessionId) {
    if (typeof window === 'undefined') return null;

    try {
      const data = this.getStorageData();
      return data.users[sessionId] || null;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting user details:', error);
      return null;
    }
  }

  /**
   * Save progress for a public course session
   */
  saveProgress(sessionId, courseId, lessonId, progress) {
    if (typeof window === 'undefined') return false;

    try {
      const data = this.getStorageData();
      
      if (!data.progress[sessionId]) {
        data.progress[sessionId] = {
          sessionId,
          courseId,
          lessons: {},
          quizScores: {},
          completedLessons: new Set(),
          lastActivity: Date.now()
        };
      }

      data.progress[sessionId].lessons[lessonId] = {
        ...progress,
        completedAt: Date.now()
      };

      if (progress.completed) {
        data.progress[sessionId].completedLessons.add(lessonId);
      }

      data.progress[sessionId].lastActivity = Date.now();
      this.setStorageData(data);
      
      console.log(`[PublicCourseLocalStorage] Saved progress for session ${sessionId}, lesson ${lessonId}`);
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error saving progress:', error);
      return false;
    }
  }

  /**
   * Save quiz score for a public course session
   */
  saveQuizScore(sessionId, courseId, lessonId, score) {
    if (typeof window === 'undefined') return false;

    try {
      const data = this.getStorageData();
      
      if (!data.progress[sessionId]) {
        data.progress[sessionId] = {
          sessionId,
          courseId,
          lessons: {},
          quizScores: {},
          completedLessons: new Set(),
          lastActivity: Date.now()
        };
      }

      data.progress[sessionId].quizScores[lessonId] = score;
      data.progress[sessionId].lastActivity = Date.now();
      this.setStorageData(data);
      
      console.log(`[PublicCourseLocalStorage] Saved quiz score for session ${sessionId}, lesson ${lessonId}: ${score}`);
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error saving quiz score:', error);
      return false;
    }
  }

  /**
   * Get progress for a session
   */
  getProgress(sessionId) {
    if (typeof window === 'undefined') return null;

    try {
      const data = this.getStorageData();
      return data.progress[sessionId] || null;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting progress:', error);
      return null;
    }
  }

  /**
   * Get all progress for a specific course
   */
  getCourseProgress(courseId) {
    if (typeof window === 'undefined') return [];

    try {
      const data = this.getStorageData();
      const courseProgress = [];
      
      for (const [sessionId, progress] of Object.entries(data.progress)) {
        if (progress.courseId === courseId) {
          courseProgress.push({
            ...progress,
            userDetails: data.users[sessionId] || null
          });
        }
      }
      
      return courseProgress;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting course progress:', error);
      return [];
    }
  }

  /**
   * Save session data
   */
  saveSession(sessionId, courseId, sessionData) {
    if (typeof window === 'undefined') return false;

    try {
      const data = this.getStorageData();
      
      data.sessions[sessionId] = {
        sessionId,
        courseId,
        ...sessionData,
        lastUpdated: Date.now()
      };

      this.setStorageData(data);
      console.log(`[PublicCourseLocalStorage] Saved session data for ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error saving session:', error);
      return false;
    }
  }

  /**
   * Get session data
   */
  getSession(sessionId) {
    if (typeof window === 'undefined') return null;

    try {
      const data = this.getStorageData();
      return data.sessions[sessionId] || null;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting session:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a course
   */
  getCourseSessions(courseId) {
    if (typeof window === 'undefined') return [];

    try {
      const data = this.getStorageData();
      const courseSessions = [];
      
      for (const [sessionId, session] of Object.entries(data.sessions)) {
        if (session.courseId === courseId) {
          courseSessions.push(session);
        }
      }
      
      return courseSessions;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting course sessions:', error);
      return [];
    }
  }

  /**
   * Clear all data for a session
   */
  clearSession(sessionId) {
    if (typeof window === 'undefined') return false;

    try {
      const data = this.getStorageData();
      
      delete data.users[sessionId];
      delete data.progress[sessionId];
      delete data.sessions[sessionId];
      
      this.setStorageData(data);
      console.log(`[PublicCourseLocalStorage] Cleared data for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error clearing session:', error);
      return false;
    }
  }

  /**
   * Clear all data
   */
  clearAll() {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.removeItem(this.storageKey);
      this.initializeStorage();
      console.log('[PublicCourseLocalStorage] Cleared all data');
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error clearing all data:', error);
      return false;
    }
  }

  /**
   * Get storage data
   */
  getStorageData() {
    if (typeof window === 'undefined') return { users: {}, progress: {}, sessions: {} };

    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { users: {}, progress: {}, sessions: {} };
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error getting storage data:', error);
      return { users: {}, progress: {}, sessions: {} };
    }
  }

  /**
   * Set storage data
   */
  setStorageData(data) {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error setting storage data:', error);
      return false;
    }
  }

  /**
   * Export data for backup
   */
  exportData() {
    if (typeof window === 'undefined') return null;

    try {
      const data = this.getStorageData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `discourse_public_course_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('[PublicCourseLocalStorage] Error exporting data:', error);
      return false;
    }
  }

  /**
   * Import data from backup
   */
  importData(file) {
    if (typeof window === 'undefined') return false;

    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            this.setStorageData(data);
            console.log('[PublicCourseLocalStorage] Data imported successfully');
            resolve(true);
          } catch (error) {
            console.error('[PublicCourseLocalStorage] Error parsing imported data:', error);
            resolve(false);
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('[PublicCourseLocalStorage] Error importing data:', error);
        resolve(false);
      }
    });
  }
}

// Create singleton instance
const publicCourseLocalStorage = new PublicCourseLocalStorage();

export default publicCourseLocalStorage;
