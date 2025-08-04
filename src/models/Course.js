// src/models/Course.js
import Module from './Module.js';
import Lesson from './Lesson.js';

// Helper function to generate unique IDs
function generateId() {
  return 'course_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Course Model
 * Represents a complete learning course with multiple modules
 */
class Course {
  constructor({
    id = generateId(),
    title = '',
    description = '',
    subject = '',
    difficultyLevel = 'intermediate',
    learningObjectives = [],
    createdBy = 'system',
    createdAt = new Date(),
    updatedAt = new Date(),
    modules = []
  } = {}) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.subject = subject;
    this.difficultyLevel = difficultyLevel;
    this.learningObjectives = learningObjectives;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.modules = (modules || []).map(moduleData => {
      if (moduleData instanceof Module) {
        return moduleData;
      }
      return new Module(moduleData);
    });
  }

  /**
   * Returns structured outline of course content
   */
  getCourseOutline() {
    return {
      title: this.title,
      description: this.description,
      modules: this.modules.map(module => ({
        title: module.title,
        lessons: module.lessons.map(lesson => lesson.title)
      }))
    };
  }

  /**
   * Add a new module to the course
   */
  addModule(module) {
    this.modules.push(module);
    this.updatedAt = new Date();
  }

  /**
   * Remove a module from the course
   */
  removeModule(moduleId) {
    this.modules = this.modules.filter(module => module.id !== moduleId);
    this.updatedAt = new Date();
  }

  /**
   * Update the order of modules
   */
  updateModuleSequence(moduleIds) {
    // Create a map of id to module
    const moduleMap = {};
    this.modules.forEach(module => {
      moduleMap[module.id] = module;
    });
    
    // Reorder modules based on the provided sequence
    this.modules = moduleIds.map(id => moduleMap[id]).filter(Boolean);
    this.updatedAt = new Date();
  }

  /**
   * Convert course to plain object for serialization
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      subject: this.subject,
      difficultyLevel: this.difficultyLevel,
      learningObjectives: this.learningObjectives,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      modules: this.modules.map(module => 
        typeof module.toJSON === 'function' ? module.toJSON() : module
      )
    };
  }

  /**
   * Create a Course instance from plain object
   */
  static fromJSON(json) {
    if (!json) {
      console.error('Invalid JSON provided to Course.fromJSON');
      return new Course();
    }

    try {
      // Ensure modules are properly structured
      const modules = (json.modules || []).map(moduleData => {
        if (!moduleData) return null;
        
        // Ensure each module has required fields
        return Module.fromJSON(moduleData);
      }).filter(Boolean); // Remove any null modules

      return new Course({
        ...json,
        modules,
        createdAt: json.createdAt ? new Date(json.createdAt) : new Date(),
        updatedAt: json.updatedAt ? new Date(json.updatedAt) : new Date()
      });
    } catch (error) {
      console.error('Error creating Course from JSON:', error);
      // Return a basic course instance if parsing fails
      return new Course({
        title: 'Error Loading Course',
        description: 'There was an error loading the course data.',
        modules: []
      });
    }
  }
}

export { Course as default, generateId };