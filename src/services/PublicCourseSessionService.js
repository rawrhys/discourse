/**
 * Public Course Session Management Service
 * Handles session isolation for public course users to prevent quiz progression interference
 */

import publicCourseLocalStorage from './PublicCourseLocalStorage.js';

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
    console.log(`[PublicCourseSession] Session stored:`, {
      id: session.id,
      courseId: session.courseId,
      totalSessions: this.sessions.size
    });
    
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
      
      // Also save to local storage
      publicCourseLocalStorage.saveQuizScore(sessionId, session.courseId, lessonId, score);
      
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
      
      // Also save to local storage
      publicCourseLocalStorage.saveUserDetails(sessionId, session.courseId, firstName, lastName);
      
      console.log(`[PublicCourseSession] Set username for session ${sessionId}: ${firstName} ${lastName}`);
      console.log(`[PublicCourseSession] Session after setUsername:`, {
        id: session.id,
        courseId: session.courseId,
        firstName: session.firstName,
        lastName: session.lastName
      });
      return true;
    }
    console.log(`[PublicCourseSession] Session ${sessionId} not found for setUsername`);
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
      const timeSinceLastActivity = now - session.lastActivity;
      if (timeSinceLastActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
        console.log(`[PublicCourseSession] Session ${sessionId} expired (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes old)`);
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
   * Get all sessions for a course (including from local storage)
   */
  getCourseSessions(courseId) {
    console.log(`[PublicCourseSession] Getting sessions for courseId: ${courseId}`);
    console.log(`[PublicCourseSession] Total sessions in memory: ${this.sessions.size}`);
    
    const memorySessions = Array.from(this.sessions.values())
      .filter(session => {
        const matches = session.courseId === courseId;
        console.log(`[PublicCourseSession] Session ${session.id} courseId: ${session.courseId}, matches: ${matches}`);
        return matches;
      });
    
    console.log(`[PublicCourseSession] Found ${memorySessions.length} memory sessions for course ${courseId}`);
    
    // For server-side usage, we don't have access to localStorage
    // So we only return memory sessions
    const allSessions = [...memorySessions];
    
    // If we're in a browser environment, try to get local storage sessions
    if (typeof window !== 'undefined') {
      try {
        const localSessions = publicCourseLocalStorage.getCourseSessions(courseId);
        
        // Add local storage sessions that aren't already in memory
        for (const localSession of localSessions) {
          if (!this.sessions.has(localSession.sessionId)) {
            allSessions.push(localSession);
          }
        }
      } catch (error) {
        console.warn('[PublicCourseSession] Could not access local storage:', error);
      }
    }
    
    console.log(`[PublicCourseSession] Returning ${allSessions.length} total sessions for course ${courseId}`);
    return allSessions;
  }

  /**
   * Get all sessions for a course with user details for dashboard
   */
  getCourseSessionsWithDetails(courseId) {
    const sessions = this.getCourseSessions(courseId);
    
    // Ensure each session has the necessary user details
    return sessions.map(session => {
      // If session doesn't have firstName/lastName, try to get from username
      if (!session.firstName && !session.lastName && session.username) {
        const nameParts = session.username.split(' ');
        session.firstName = nameParts[0] || '';
        session.lastName = nameParts.slice(1).join(' ') || '';
      }
      
      return {
        id: session.id || session.sessionId,
        sessionId: session.id || session.sessionId,
        courseId: session.courseId,
        firstName: session.firstName || '',
        lastName: session.lastName || '',
        username: session.username || `${session.firstName || ''} ${session.lastName || ''}`.trim() || 'Anonymous',
        createdAt: session.createdAt || session.lastUpdated || Date.now(),
        lastActivity: session.lastActivity || session.lastUpdated || Date.now(),
        quizScores: session.quizScores || {},
        lessonProgress: session.lessonProgress || {},
        data: session.data || null,
        isActive: session.isActive !== false
      };
    });
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
