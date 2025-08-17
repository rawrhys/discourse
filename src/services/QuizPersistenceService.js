/**
 * Quiz Persistence Service
 * Handles saving and restoring quiz scores to/from localStorage
 * Provides fallback mechanism for quiz data retention
 */

class QuizPersistenceService {
  constructor() {
    this.storageKey = 'quizScores';
    this.courseProgressKey = 'courseProgress';
  }

  /**
   * Save quiz score to localStorage
   */
  saveQuizScore(courseId, lessonId, score, userId) {
    try {
      const scores = this.getStoredQuizScores();
      const key = `${courseId}_${lessonId}_${userId}`;
      scores[key] = {
        score,
        timestamp: Date.now(),
        courseId,
        lessonId,
        userId
      };
      localStorage.setItem(this.storageKey, JSON.stringify(scores));
      
      console.log('[QuizPersistence] Saved quiz score to localStorage:', {
        key,
        score,
        courseId,
        lessonId,
        userId
      });
      
      return true;
    } catch (error) {
      console.error('[QuizPersistence] Error saving quiz score to localStorage:', error);
      return false;
    }
  }

  /**
   * Get quiz score from localStorage
   */
  getQuizScore(courseId, lessonId, userId) {
    try {
      const scores = this.getStoredQuizScores();
      const key = `${courseId}_${lessonId}_${userId}`;
      const scoreData = scores[key];
      
      if (scoreData) {
        console.log('[QuizPersistence] Retrieved quiz score from localStorage:', {
          key,
          score: scoreData.score,
          timestamp: new Date(scoreData.timestamp)
        });
        return scoreData.score;
      }
      
      return null;
    } catch (error) {
      console.error('[QuizPersistence] Error retrieving quiz score from localStorage:', error);
      return null;
    }
  }

  /**
   * Get all stored quiz scores
   */
  getStoredQuizScores() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[QuizPersistence] Error parsing stored quiz scores:', error);
      return {};
    }
  }

  /**
   * Get all quiz scores for a specific course
   */
  getCourseQuizScores(courseId, userId) {
    try {
      const scores = this.getStoredQuizScores();
      const courseScores = {};
      
      Object.keys(scores).forEach(key => {
        const scoreData = scores[key];
        if (scoreData.courseId === courseId && scoreData.userId === userId) {
          courseScores[scoreData.lessonId] = scoreData.score;
        }
      });
      
      console.log('[QuizPersistence] Retrieved course quiz scores:', {
        courseId,
        userId,
        scores: courseScores
      });
      
      return courseScores;
    } catch (error) {
      console.error('[QuizPersistence] Error retrieving course quiz scores:', error);
      return {};
    }
  }

  /**
   * Restore quiz scores to course data from localStorage
   */
  restoreQuizScoresToCourse(course, userId) {
    try {
      if (!course || !course.id || !userId) {
        console.warn('[QuizPersistence] Cannot restore quiz scores - missing course or userId');
        return course;
      }

      const storedScores = this.getCourseQuizScores(course.id, userId);
      let hasRestoredScores = false;

      const restoredCourse = {
        ...course,
        modules: course.modules.map(module => ({
          ...module,
          lessons: module.lessons.map(lesson => {
            const storedScore = storedScores[lesson.id];
            if (storedScore !== undefined) {
              // Initialize quizScores if it doesn't exist
              if (!lesson.quizScores) {
                lesson.quizScores = {};
              }
              
              // Only restore if the score doesn't already exist or if localStorage is newer
              if (!lesson.quizScores[userId] || storedScore > lesson.quizScores[userId]) {
                lesson.quizScores[userId] = storedScore;
                lesson.quizScore = storedScore; // Backward compatibility
                hasRestoredScores = true;
                
                console.log('[QuizPersistence] Restored quiz score:', {
                  lessonId: lesson.id,
                  lessonTitle: lesson.title,
                  score: storedScore
                });
              }
            }
            return lesson;
          })
        }))
      };

      if (hasRestoredScores) {
        console.log('[QuizPersistence] Successfully restored quiz scores for course:', course.id);
      }

      return restoredCourse;
    } catch (error) {
      console.error('[QuizPersistence] Error restoring quiz scores to course:', error);
      return course;
    }
  }

  /**
   * Sync localStorage scores with backend
   */
  async syncScoresWithBackend(courseId, userId) {
    try {
      const storedScores = this.getCourseQuizScores(courseId, userId);
      const syncPromises = [];

      Object.entries(storedScores).forEach(([lessonId, score]) => {
        const syncPromise = this.syncScoreToBackend(courseId, lessonId, score, userId);
        syncPromises.push(syncPromise);
      });

      await Promise.allSettled(syncPromises);
      console.log('[QuizPersistence] Completed syncing scores with backend');
    } catch (error) {
      console.error('[QuizPersistence] Error syncing scores with backend:', error);
    }
  }

  /**
   * Sync a single score to backend
   */
  async syncScoreToBackend(courseId, lessonId, score, userId) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[QuizPersistence] No token available for backend sync');
        return;
      }

      const response = await fetch('/api/quizzes/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId,
          lessonId,
          score,
          syncFromLocalStorage: true
        })
      });

      if (response.ok) {
        console.log('[QuizPersistence] Successfully synced score to backend:', {
          courseId,
          lessonId,
          score
        });
      } else {
        console.warn('[QuizPersistence] Failed to sync score to backend:', response.status);
      }
    } catch (error) {
      console.error('[QuizPersistence] Error syncing score to backend:', error);
    }
  }

  /**
   * Clear quiz scores for a specific course
   */
  clearCourseQuizScores(courseId, userId) {
    try {
      const scores = this.getStoredQuizScores();
      const keysToRemove = [];

      Object.keys(scores).forEach(key => {
        const scoreData = scores[key];
        if (scoreData.courseId === courseId && scoreData.userId === userId) {
          keysToRemove.push(key);
        }
      });

      keysToRemove.forEach(key => {
        delete scores[key];
      });

      localStorage.setItem(this.storageKey, JSON.stringify(scores));
      console.log('[QuizPersistence] Cleared quiz scores for course:', courseId);
    } catch (error) {
      console.error('[QuizPersistence] Error clearing course quiz scores:', error);
    }
  }

  /**
   * Clear all quiz scores
   */
  clearAllQuizScores() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('[QuizPersistence] Cleared all quiz scores');
    } catch (error) {
      console.error('[QuizPersistence] Error clearing all quiz scores:', error);
    }
  }

  /**
   * Get quiz persistence statistics
   */
  getPersistenceStats() {
    try {
      const scores = this.getStoredQuizScores();
      const totalScores = Object.keys(scores).length;
      const courses = new Set();
      const users = new Set();

      Object.values(scores).forEach(scoreData => {
        courses.add(scoreData.courseId);
        users.add(scoreData.userId);
      });

      return {
        totalScores,
        uniqueCourses: courses.size,
        uniqueUsers: users.size,
        storageSize: JSON.stringify(scores).length
      };
    } catch (error) {
      console.error('[QuizPersistence] Error getting persistence stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const quizPersistenceService = new QuizPersistenceService();

export default quizPersistenceService;
