/**
 * Student Progress Tracking Service
 * Tracks student progress for published courses
 */

class StudentProgressService {
  constructor() {
    this.studentProgress = new Map(); // sessionId -> progress data (in-memory cache)
    this.courseStats = new Map(); // courseId -> aggregated stats
    this.db = null; // Will be set when service is initialized
  }

  /**
   * Initialize the service with database reference
   */
  initialize(db) {
    this.db = db;
    this.loadFromDatabase();
  }

  /**
   * Load student progress data from database
   */
  loadFromDatabase() {
    if (!this.db || !this.db.data.studentProgress) return;

    console.log(`[StudentProgressService] Loading ${this.db.data.studentProgress.length} student progress records from database`);
    
    for (const progressData of this.db.data.studentProgress) {
      // Convert arrays back to Sets and Maps
      const progress = {
        ...progressData,
        completedLessons: new Set(progressData.completedLessons || []),
        quizScores: new Map(Object.entries(progressData.quizScores || {})),
        completedModules: new Set(progressData.completedModules || [])
      };
      
      this.studentProgress.set(progressData.sessionId, progress);
    }
  }

  /**
   * Save student progress data to database
   */
  async saveToDatabase() {
    if (!this.db) return;

    // Convert Sets and Maps to serializable formats
    const serializableData = Array.from(this.studentProgress.entries()).map(([sessionId, progress]) => ({
      sessionId,
      courseId: progress.courseId,
      username: progress.username,
      startTime: progress.startTime,
      lastActivity: progress.lastActivity,
      completedLessons: Array.from(progress.completedLessons),
      quizScores: Object.fromEntries(progress.quizScores),
      totalLessons: progress.totalLessons,
      completedModules: Array.from(progress.completedModules),
      totalModules: progress.totalModules,
      isCompleted: progress.isCompleted,
      completionTime: progress.completionTime,
      certificateGenerated: progress.certificateGenerated
    }));

    this.db.data.studentProgress = serializableData;
    await this.db.write();
  }

  /**
   * Initialize progress tracking for a student
   */
  async initializeStudentProgress(sessionId, courseId, username = null, courseData = null) {
    // Calculate total lessons and modules from course data if available
    let totalLessons = 0;
    let totalModules = 0;
    
    if (courseData && courseData.modules) {
      totalModules = courseData.modules.length;
      totalLessons = courseData.modules.reduce((total, module) => {
        return total + (module.lessons ? module.lessons.length : 0);
      }, 0);
    }
    
    const progress = {
      sessionId,
      courseId,
      username: username || 'Anonymous',
      startTime: new Date(),
      lastActivity: new Date(),
      completedLessons: new Set(),
      quizScores: new Map(), // lessonId -> score
      totalLessons,
      completedModules: new Set(),
      totalModules,
      isCompleted: false,
      completionTime: null,
      certificateGenerated: false
    };

    this.studentProgress.set(sessionId, progress);
    await this.saveToDatabase();
    console.log(`[StudentProgressService] Initialized progress for ${username} - ${totalLessons} lessons, ${totalModules} modules`);
    return progress;
  }

  /**
   * Update lesson completion
   */
  async updateLessonCompletion(sessionId, lessonId, moduleId) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return null;

    progress.completedLessons.add(lessonId);
    progress.lastActivity = new Date();

    // Check if module is completed
    this.checkModuleCompletion(sessionId, moduleId);

    // Check if course is completed
    this.checkCourseCompletion(sessionId);

    await this.saveToDatabase();
    return progress;
  }

  /**
   * Update quiz score
   */
  async updateQuizScore(sessionId, lessonId, score) {
    const progress = this.studentProgress.get(sessionId);
    if (!progress) return null;

    progress.quizScores.set(lessonId, score);
    progress.lastActivity = new Date();

    await this.saveToDatabase();
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
