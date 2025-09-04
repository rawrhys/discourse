/**
 * Public Course Session Management Service
 * Handles session isolation for public course users to prevent quiz progression interference
 */

class PublicCourseSessionService {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    this.activeSessions = new Set(); // Track which sessions are currently active
    
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
  createSession(courseId, sessionId = null) {
    const finalSessionId = sessionId || this.generateSessionId();
    
    const session = {
      id: finalSessionId,
      courseId: courseId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      quizScores: {},
      lessonProgress: {},
      data: null, // Will store course data
      isActive: true
    };

    this.sessions.set(finalSessionId, session);
    this.activeSessions.add(finalSessionId);
    
    console.log(`[PublicCourseSession] Created session ${finalSessionId} for course ${courseId}`);
    
    return finalSessionId;
  }

  /**
   * Check if a session is available for use
   */
  isSessionAvailable(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[PublicCourseSession] Session ${sessionId} not found`);
      return false;
    }
    
    // Check if the session is inactive (expired)
    const isInactive = Date.now() - session.lastActivity > this.sessionTimeout;
    if (isInactive) {
      // Clean up inactive session
      this.sessions.delete(sessionId);
      this.activeSessions.delete(sessionId);
      console.log(`[PublicCourseSession] Session ${sessionId} expired and cleaned up`);
      return false;
    }
    
    // Session is active and available
    console.log(`[PublicCourseSession] Session ${sessionId} is available`);
    return true;
  }

  /**
   * Restore or create session for a course with session isolation
   */
  restoreOrCreateSession(courseId, sessionId = null) {
    // If sessionId is provided, check if it's available
    if (sessionId) {
      if (this.isSessionAvailable(sessionId)) {
        const existingSession = this.sessions.get(sessionId);
        if (existingSession && existingSession.courseId === courseId) {
          // Update last activity and return existing session
          existingSession.lastActivity = Date.now();
          existingSession.isActive = true;
          this.activeSessions.add(sessionId);
          
          console.log(`[PublicCourseSession] Restored existing session ${sessionId} for course ${courseId}`);
          return sessionId;
        } else {
          console.log(`[PublicCourseSession] Session ${sessionId} not found or invalid course, creating new session`);
        }
      } else {
        console.log(`[PublicCourseSession] Session ${sessionId} is not available, creating new session`);
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
    const session = this.getSession(sessionId);
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
    const session = this.getSession(sessionId);
    return session ? session.lessonProgress[lessonId] : null;
  }

  /**
   * Set username for a session
   */
  setUsername(sessionId, firstName, lastName) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.firstName = firstName;
      session.lastName = lastName;
      session.lastActivity = Date.now();
      console.log(`[PublicCourseSession] Set username for session ${sessionId}: ${firstName} ${lastName}`);
      return true;
    }
    return false;
  }

  /**
   * Get username for a session
   */
  getUsername(sessionId) {
    const session = this.getSession(sessionId);
    if (session && session.firstName && session.lastName) {
      return {
        firstName: session.firstName,
        lastName: session.lastName
      };
    }
    return null;
  }

  /**
   * Release a session (mark as inactive)
   */
  releaseSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      console.log(`[PublicCourseSession] Released session ${sessionId}`);
      return true;
    }
    return false;
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
      this.activeSessions.delete(sessionId);
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
    const activeSessions = Array.from(this.sessions.values()).filter(s => 
      Date.now() - s.lastActivity < this.sessionTimeout
    );
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      activeSessionIds: Array.from(this.activeSessions)
    };
  }

  /**
   * Force cleanup all sessions (for testing/admin purposes)
   */
  cleanupAllSessions() {
    const count = this.sessions.size;
    this.sessions.clear();
    this.activeSessions.clear();
    console.log(`[PublicCourseSession] Force cleaned up all ${count} sessions`);
    return count;
  }
}

// Create singleton instance
const publicCourseSessionService = new PublicCourseSessionService();

export default publicCourseSessionService;
