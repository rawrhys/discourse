/**
 * Student Progress Tracking Service
 * Tracks student progress for published courses
 */

class StudentProgressService {
  constructor() {
    this.studentProgress = new Map(); // sessionId -> progress data
    this.courseStats = new Map(); // courseId -> aggregated stats
  }

  /**
   * Initialize progress tracking for a student
   */
  initializeStudentProgress(sessionId, courseId, username = null) {
    const progress = {
      sessionId,
      courseId,
      username: username || 'Anonymous',
      startTime: new Date(),
      lastActivity: new Date(),
      completedLessons: new Set(),
      quizScores: new Map(), // lessonId -> score
      totalLessons: 0,
      completedModules: new Set(),
      totalModules: 0,
      isCompleted: false,
      completionTime: null,
      certificateGenerated: false
    };

    this.studentProgress.set(sessionId, progress);
    return progress;
  }

  /**
   * Update lesson completion
   */
  updateLessonCompletion(sessionId, lessonId, moduleId) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return null;

    progress.completedLessons.add(lessonId);
    progress.lastActivity = new Date();

    // Check if module is completed
    this.checkModuleCompletion(sessionId, moduleId);

    // Check if course is completed
    this.checkCourseCompletion(sessionId);

    return progress;
  }

  /**
   * Update quiz score
   */
  updateQuizScore(sessionId, lessonId, score) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return null;

    progress.quizScores.set(lessonId, score);
    progress.lastActivity = new Date();

    return progress;
  }

  /**
   * Check if a module is completed
   */
  checkModuleCompletion(sessionId, moduleId) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return false;

    // This would need to be called with the actual course structure
    // For now, we'll assume completion based on lesson completion
    progress.completedModules.add(moduleId);
    return true;
  }

  /**
   * Check if course is completed
   */
  checkCourseCompletion(sessionId) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return false;

    // This would need to be called with the actual course structure
    // For now, we'll assume completion based on some criteria
    if (progress.completedLessons.size >= progress.totalLessons) {
      progress.isCompleted = true;
      progress.completionTime = new Date();
      return true;
    }

    return false;
  }

  /**
   * Mark certificate as generated
   */
  markCertificateGenerated(sessionId) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return false;

    progress.certificateGenerated = true;
    return true;
  }

  /**
   * Get student progress
   */
  getStudentProgress(sessionId) {
    return this.studentProgress.get(sessionId);
  }

  /**
   * Get all students for a course (for course creator view)
   */
  getCourseStudents(courseId) {
    const students = [];
    
    for (const [sessionId, progress] of this.studentProgress.entries()) {
      if (progress.courseId === courseId) {
        students.push({
          sessionId,
          username: progress.username,
          startTime: progress.startTime,
          lastActivity: progress.lastActivity,
          completedLessons: progress.completedLessons.size,
          totalLessons: progress.totalLessons,
          completedModules: progress.completedModules.size,
          totalModules: progress.totalModules,
          isCompleted: progress.isCompleted,
          completionTime: progress.completionTime,
          certificateGenerated: progress.certificateGenerated,
          averageQuizScore: this.calculateAverageQuizScore(progress.quizScores)
        });
      }
    }

    return students.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Calculate average quiz score
   */
  calculateAverageQuizScore(quizScores) {
    if (quizScores.size === 0) return 0;
    
    let total = 0;
    for (const score of quizScores.values()) {
      total += score;
    }
    
    return Math.round(total / quizScores.size);
  }

  /**
   * Get course statistics
   */
  getCourseStats(courseId) {
    const students = this.getCourseStudents(courseId);
    
    if (students.length === 0) {
      return {
        totalStudents: 0,
        completedStudents: 0,
        averageCompletionTime: 0,
        averageQuizScore: 0,
        completionRate: 0
      };
    }

    const completedStudents = students.filter(s => s.isCompleted);
    const totalCompletionTime = completedStudents.reduce((sum, s) => {
      return sum + (s.completionTime - s.startTime);
    }, 0);
    
    const totalQuizScore = students.reduce((sum, s) => sum + s.averageQuizScore, 0);

    return {
      totalStudents: students.length,
      completedStudents: completedStudents.length,
      averageCompletionTime: completedStudents.length > 0 ? 
        Math.round(totalCompletionTime / completedStudents.length / 1000 / 60) : 0, // in minutes
      averageQuizScore: Math.round(totalQuizScore / students.length),
      completionRate: Math.round((completedStudents.length / students.length) * 100)
    };
  }

  /**
   * Remove student progress (cleanup)
   */
  removeStudentProgress(sessionId) {
    return this.studentProgress.delete(sessionId);
  }

  /**
   * Get all progress data (for admin purposes)
   */
  getAllProgress() {
    return Array.from(this.studentProgress.entries());
  }

  /**
   * Clean up old progress data
   */
  cleanup() {
    const now = new Date();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const [sessionId, progress] of this.studentProgress.entries()) {
      if (now - progress.lastActivity > maxAge) {
        this.studentProgress.delete(sessionId);
      }
    }

    console.log(`[StudentProgressService] Cleaned up old progress data. Currently tracking ${this.studentProgress.size} students`);
  }
}

// Create singleton instance
const studentProgressService = new StudentProgressService();

export default studentProgressService;
