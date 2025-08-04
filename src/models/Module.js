// src/models/Module.js
import Lesson from './Lesson.js';

// Helper function to generate unique IDs
function generateId() {
  return 'module_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Module Model
 * Represents a learning module containing multiple lessons
 */
class Module {
  constructor({
    id = generateId(),
    title = '',
    description = '',
    lessons = [],
    order = 0,
    completed = false,
    perfectQuizzes = 0,
    progress = 0
  } = {}) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.lessons = (lessons || []).map(lessonData => {
      if (lessonData instanceof Lesson) {
        return lessonData;
      }
      return new Lesson(lessonData);
    });
    this.order = order;
    this._completed = completed;
    this.perfectQuizzes = perfectQuizzes;
    this.progress = progress;
  }

  /**
   * Create a Module instance from JSON data
   * @param {Object} json - The JSON data to create a Module from
   * @returns {Module} A new Module instance
   */
  static fromJSON(json) {
    return new Module({
      ...json,
      completed: json.isCompleted || json.completed || false,
      perfectQuizzes: json.perfectQuizzes || 0,
      progress: json.progress || 0
    });
  }

  /**
   * Convert the module to a plain object
   * @returns {Object} A plain object representation of the module
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      lessons: this.lessons.map(lesson => lesson.toJSON()),
      order: this.order,
      isCompleted: this.isCompleted(),
      perfectQuizzes: this.perfectQuizzes,
      progress: this.progress
    };
  }

  /**
   * Check if the module is completed
   * @returns {boolean} True if all lessons are completed and progress is 100%
   */
  isCompleted() {
    return this._completed || (this.progress >= 100 && this.lessons.every(lesson => lesson.isCompleted));
  }

  /**
   * Set the completion status of the module
   * @param {boolean} value - The completion status
   */
  setCompleted(value) {
    this._completed = Boolean(value);
  }

  /**
   * Update the module's progress
   * @param {number} value - The new progress value (0-100)
   */
  updateProgress(value) {
    this.progress = Math.min(100, Math.max(0, value));
    if (this.progress >= 100) {
      this._completed = true;
    }
  }
}

export { Module as default, generateId };