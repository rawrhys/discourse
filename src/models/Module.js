import Lesson from './Lesson.js';

function generateId() {
  return 'module_' + Math.random().toString(36).substr(2, 9);
}

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

  static fromJSON(json) {
    return new Module({
      ...json,
      completed: json.isCompleted || json.completed || false,
      perfectQuizzes: json.perfectQuizzes || 0,
      progress: json.progress || 0
    });
  }

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

  getModuleProgress() {
    if (this.lessons.length === 0) return 0;
    const completedLessons = this.lessons.filter(lesson => lesson.isCompleted).length;
    return (completedLessons / this.lessons.length) * 100;
  }

  isCompleted() {
    return this._completed || (this.progress >= 100 && this.lessons.every(lesson => lesson.isCompleted));
  }

  setCompleted(value) {
    this._completed = Boolean(value);
  }

  updateProgress(value) {
    this.progress = Math.min(100, Math.max(0, value));
    if (this.progress >= 100) {
      this._completed = true;
    }
  }
}

export { Module as default, generateId };