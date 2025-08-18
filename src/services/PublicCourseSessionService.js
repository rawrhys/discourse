/**
 * Public Course Session Management Service
 * Handles session isolation for public course users to prevent quiz progression interference
 */

class PublicCourseSessionService {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), this.cleanupInterval);
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new session for a public course
   */
  createSession(courseId) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      courseId: courseId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      quizScores: {},
      lessonProgress: {},
      data: null // Will store course data
    };

    this.sessions.set(sessionId, session);
    console.log(`[PublicCourseSession] Created session ${sessionId} for course ${courseId}`);
    
    return sessionId;
  }

  /**
   * Restore or create session for a course
   * If sessionId is provided and valid, restore it; otherwise create new
   */
  restoreOrCreateSession(courseId, sessionId = null) {
    // If sessionId is provided, try to restore it
    if (sessionId) {
      const existingSession = this.sessions.get(sessionId);
      if (existingSession && existingSession.courseId === courseId) {
        // Update last activity and return existing session
        existingSession.lastActivity = Date.now();
        console.log(`[PublicCourseSession] Restored existing session ${sessionId} for course ${courseId}`);
        return sessionId;
      } else {
        console.log(`[PublicCourseSession] Session ${sessionId} not found or invalid, creating new session`);
      }
    }
    
    // Create new session
    return this.createSession(courseId);
  }

  /**
   * Get session data
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  /**
   * Update session data
   */
  updateSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.data = data;
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Save quiz score for a session
   */
  saveQuizScore(sessionId, lessonId, score) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.quizScores[lessonId] = score;
      session.lastActivity = Date.now();
      console.log(`[PublicCourseSession] Saved quiz score for session ${sessionId}, lesson ${lessonId}: ${score}`);
      return true;
    }
    return false;
  }

  /**
   * Get quiz score for a session
   */
  getQuizScore(sessionId, lessonId) {
    const session = this.sessions.get(sessionId);
    return session ? session.quizScores[lessonId] : null;
  }

  /**
   * Update lesson progress for a session
   */
  updateLessonProgress(sessionId, lessonId, progress) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lessonProgress[lessonId] = progress;
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get lesson progress for a session
   */
  getLessonProgress(sessionId, lessonId) {
    const session = this.sessions.get(sessionId);
    return session ? session.lessonProgress[lessonId] : null;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`[PublicCourseSession] Cleaned up expired session ${sessionId}`);
    });

    if (expiredSessions.length > 0) {
      console.log(`[PublicCourseSession] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => 
        Date.now() - s.lastActivity < this.sessionTimeout
      ).length
    };
  }

  /**
   * Force cleanup all sessions (for testing/admin purposes)
   */
  cleanupAllSessions() {
    const count = this.sessions.size;
    this.sessions.clear();
    console.log(`[PublicCourseSession] Force cleaned up all ${count} sessions`);
    return count;
  }
}

// Create singleton instance
const publicCourseSessionService = new PublicCourseSessionService();

export default publicCourseSessionService;
