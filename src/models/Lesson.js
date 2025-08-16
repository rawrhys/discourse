// src/models/Lesson.js

// Helper function to generate unique IDs
function generateId() {
  return 'lesson_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Lesson Model
 * Represents a single lesson within a module
 */
class Lesson {
  constructor({
    id = generateId(),
    title = '',
    content = '',
    order = 0,
    isCompleted = false,
    quiz = null,
    quizScore = undefined,
    quizCompleted = false,
    flashcards = [],
    quizScores = {},
    lastQuizScore = null
  } = {}) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.order = order;
    this.isCompleted = isCompleted;
    this.quiz = quiz;
    this.quizScore = quizScore;
    this.quizCompleted = quizCompleted;
    this.flashcards = flashcards;
    this.quizScores = quizScores;
    this.lastQuizScore = lastQuizScore;
  }

  /**
   * Create a Lesson instance from JSON data
   * @param {Object} json - The JSON data to create a Lesson from
   * @returns {Lesson} A new Lesson instance
   */
  static fromJSON(json) {
    return new Lesson({
      ...json,
      quizScore: json.quizScore,
      quizCompleted: json.quizCompleted,
      quizScores: json.quizScores || {}, // Preserve quizScores from backend
      lastQuizScore: json.lastQuizScore
    });
  }

  /**
   * Convert the lesson to a plain object
   * @returns {Object} A plain object representation of the lesson
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      order: this.order,
      isCompleted: this.isCompleted,
      quiz: this.quiz,
      quizScore: this.quizScore,
      quizCompleted: this.quizCompleted,
      flashcards: this.flashcards,
      quizScores: this.quizScores,
      lastQuizScore: this.lastQuizScore
    };
  }
}

export { Lesson as default, generateId };