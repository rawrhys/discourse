/**
 * Academic References Manager Utility
 * Provides console commands to manage academic references
 */

import academicReferencesService from '../services/AcademicReferencesService.js';

// Expose management functions to window for console access
if (typeof window !== 'undefined') {
  window.AcademicReferencesManager = {
    /**
     * Get storage statistics
     */
    getStats() {
      const stats = academicReferencesService.getStorageStats();
      console.table(stats);
      return stats;
    },

    /**
     * Clear all saved references
     */
    clearAll() {
      const result = academicReferencesService.clearAllReferences();
      console.log('Cleared all references:', result);
      return result;
    },

    /**
     * Export all references as JSON
     */
    export() {
      const data = academicReferencesService.exportAllReferences();
      console.log('Exported references:', data);
      
      // Create downloadable file
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `academic-references-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      return data;
    },

    /**
     * Import references from JSON data
     */
    import(jsonData) {
      try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        const result = academicReferencesService.importReferences(data);
        console.log('Import result:', result);
        return result;
      } catch (error) {
        console.error('Import failed:', error);
        return false;
      }
    },

    /**
     * List all lesson IDs with saved references
     */
    listLessons() {
      const stats = academicReferencesService.getStorageStats();
      if (stats && stats.lessonIds) {
        console.log('Lessons with saved references:');
        stats.lessonIds.forEach((id, index) => {
          console.log(`${index + 1}. ${id}`);
        });
        return stats.lessonIds;
      }
      return [];
    },

    /**
     * Get references for a specific lesson
     */
    getLessonReferences(lessonId) {
      const references = academicReferencesService.getSavedReferences(lessonId);
      console.log(`References for lesson ${lessonId}:`, references);
      return references;
    },

    /**
     * Check if a lesson has saved references
     */
    hasReferences(lessonId) {
      const hasRefs = academicReferencesService.hasReferences(lessonId);
      console.log(`Lesson ${lessonId} has references:`, hasRefs);
      return hasRefs;
    },

    /**
     * Get the last processed lesson ID
     */
    getLastProcessed() {
      const lastId = academicReferencesService.getLastProcessedLessonId();
      console.log('Last processed lesson ID:', lastId);
      return lastId;
    },

    /**
     * Clear the last processed lesson ID
     */
    clearLastProcessed() {
      const result = academicReferencesService.clearLastProcessedLessonId();
      console.log('Cleared last processed lesson ID:', result);
      return result;
    },

    /**
     * Help function
     */
    help() {
      console.log(`
Academic References Manager - Available Commands:

📊 getStats()           - Show storage statistics
🗑️  clearAll()          - Clear all saved references
📤 export()             - Export all references as JSON file
📥 import(jsonData)     - Import references from JSON data
📋 listLessons()        - List all lesson IDs with saved references
🔍 getLessonReferences(lessonId) - Get references for a specific lesson
✅ hasReferences(lessonId) - Check if a lesson has saved references
🔄 getLastProcessed()   - Get last processed lesson ID
🗑️  clearLastProcessed() - Clear last processed lesson ID
❓ help()               - Show this help message

Examples:
  AcademicReferencesManager.getStats()
  AcademicReferencesManager.listLessons()
  AcademicReferencesManager.getLessonReferences('lesson_123')
  AcademicReferencesManager.getLastProcessed()
      `);
    }
  };

  // Auto-show help on first access
  console.log('🎓 Academic References Manager loaded! Type AcademicReferencesManager.help() for available commands.');
}

export default window.AcademicReferencesManager;
