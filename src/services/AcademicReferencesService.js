/**
 * Academic References Service
 * Generates academic citations linked to text content for public lesson views
 */

class AcademicReferencesService {
  constructor() {
    this.citationPatterns = {
      // Common academic citation patterns
      book: /(\w+)\s*\((\d{4})\)\.\s*([^.]*)/g,
      journal: /(\w+)\s*\((\d{4})\)\.\s*"([^"]*)"\s*in\s*([^.]*)/g,
      website: /(\w+)\s*\((\d{4})\)\.\s*([^.]*)\s*\[Online\]/g,
      encyclopedia: /(\w+)\s*\((\d{4})\)\.\s*\*([^*]*)\*/g
    };
    
    // Retain structure for potential future use, but do not use static defaults anymore
    this.defaultReferences = {};
    
    // Initialize storage for saved references
    this.storageKey = 'academic_references_cache';
    this.initializeStorage();
  }

  /**
   * Initialize storage for academic references
   */
  initializeStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const existing = localStorage.getItem(this.storageKey);
        if (!existing) {
          localStorage.setItem(this.storageKey, JSON.stringify({}));
        }
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to initialize storage:', error);
    }
  }

  /**
   * Save academic references for a specific lesson
   */
  saveReferences(lessonId, references) {
    try {
      if (typeof window !== 'undefined' && window.localStorage && references && references.length > 0) {
        const storage = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        storage[lessonId] = {
          references: references,
          timestamp: Date.now(),
          version: '1.0'
        };
        localStorage.setItem(this.storageKey, JSON.stringify(storage));
        console.log(`[AcademicReferencesService] Saved ${references.length} references for lesson ${lessonId}`);
        return true;
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to save references:', error);
    }
    return false;
  }

  /**
   * Retrieve saved academic references for a specific lesson
   */
  getSavedReferences(lessonId) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storage = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        const lessonData = storage[lessonId];
        
        if (lessonData && lessonData.references && lessonData.references.length > 0) {
          // Check if references are not too old (30 days)
          const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
          if (Date.now() - lessonData.timestamp < maxAge) {
            console.log(`[AcademicReferencesService] Retrieved ${lessonData.references.length} saved references for lesson ${lessonId}`);
            return lessonData.references;
          } else {
            // References are too old, remove them
            delete storage[lessonId];
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
            console.log(`[AcademicReferencesService] Removed expired references for lesson ${lessonId}`);
          }
        }
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to retrieve saved references:', error);
    }
    return null;
  }

  /**
   * Check if references exist for a lesson
   */
  hasReferences(lessonId) {
    return this.getSavedReferences(lessonId) !== null;
  }

  /**
   * Clear all saved references (useful for debugging or maintenance)
   */
  clearAllReferences() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.storageKey);
        this.initializeStorage();
        console.log('[AcademicReferencesService] Cleared all saved references');
        return true;
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to clear references:', error);
    }
    return false;
  }

  /**
   * Get storage statistics for debugging
   */
  getStorageStats() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storage = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        const lessonIds = Object.keys(storage);
        const totalReferences = lessonIds.reduce((total, lessonId) => {
          return total + (storage[lessonId]?.references?.length || 0);
        }, 0);
        
        return {
          totalLessons: lessonIds.length,
          totalReferences: totalReferences,
          lessonIds: lessonIds,
          storageSize: JSON.stringify(storage).length,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to get storage stats:', error);
    }
    return null;
  }

  /**
   * Export all saved references (useful for backup)
   */
  exportAllReferences() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storage = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        return {
          data: storage,
          exportDate: new Date().toISOString(),
          version: '1.0'
        };
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to export references:', error);
    }
    return null;
  }

  /**
   * Import references from backup data
   */
  importReferences(backupData) {
    try {
      if (typeof window !== 'undefined' && window.localStorage && backupData?.data) {
        const currentStorage = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        const mergedStorage = { ...currentStorage, ...backupData.data };
        localStorage.setItem(this.storageKey, JSON.stringify(mergedStorage));
        console.log('[AcademicReferencesService] Imported references from backup');
        return true;
      }
    } catch (error) {
      console.warn('[AcademicReferencesService] Failed to import references:', error);
    }
    return false;
  }

  /**
   * Generate academic references based on lesson content and subject
   * Static generation is disabled; AI service should be used instead.
   */
  generateReferences(lessonContent, subject, lessonTitle) {
    console.warn('[AcademicReferencesService] Static reference generation is disabled. Use AI service.');
    return [];
  }

  /**
   * Get reference set based on subject
   * Disabled to avoid static references.
   */
  getReferenceSetBySubject(subject) {
    return [];
  }

  /**
   * Generate contextual references based on content analysis
   * Disabled to avoid static references.
   */
  generateContextualReferences(content, baseReferences) {
    return [];
  }

  /**
   * Get lesson-specific references
   * Disabled to avoid static references.
   */
  getLessonSpecificReferences(lessonTitle, subject) {
    return [];
  }

  /**
   * Combine and deduplicate references
   */
  combineAndDeduplicateReferences(references) {
    if (!references || !Array.isArray(references)) {
      return [];
    }
    
    const seen = new Set();
    const uniqueRefs = [];
    
    references.forEach(ref => {
      if (!ref || !ref.author || !ref.title) {
        console.warn('[AcademicReferencesService] Skipping invalid reference:', ref);
        return;
      }
      const normalizedAuthor = ref.author.trim().toLowerCase();
      const normalizedTitle = ref.title.trim().toLowerCase();
      const year = ref.year || '';
      const key = `${normalizedAuthor}-${year}-${normalizedTitle}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRefs.push({
          ...ref,
          id: uniqueRefs.length + 1
        });
      }
    });
    return uniqueRefs;
  }

  /**
   * Get default references for a subject
   * Disabled to avoid static references.
   */
  getDefaultReferences(subject) {
    return [];
  }

  /**
   * Format reference as academic citation
   */
  formatCitation(reference) {
    switch (reference.type) {
      case 'book':
        return `${reference.author} (${reference.year}). *${reference.title}*. ${reference.publisher}.`;
      case 'journal':
        return `${reference.author} (${reference.year}). "${reference.title}" in ${reference.publisher}.`;
      case 'encyclopedia':
        return `${reference.author} (${reference.year}). *${reference.title}*. ${reference.publisher}.`;
      case 'website':
        return `${reference.author} (${reference.year}). ${reference.title} [Online]. ${reference.publisher}.`;
      default:
        return `${reference.author} (${reference.year}). ${reference.title}. ${reference.publisher}.`;
    }
  }

  /**
   * Generate inline citations for text content
   */
  generateInlineCitations(content, references) {
    if (!content || !references || references.length === 0) {
      return { content, citations: [] };
    }

    const citations = [];
    let citationIndex = 1;
    
    const contentWithCitations = content.replace(
      /([.!?])\s+/g,
      (match, punctuation) => {
        if (citationIndex <= references.length && Math.random() < 0.3) {
          const citation = ` [${citationIndex}]`;
          citations.push({
            id: citationIndex,
            reference: references[citationIndex - 1],
            text: citation
          });
          citationIndex++;
          return `${punctuation}${citation} `;
        }
        return `${punctuation} `;
      }
    );

    return {
      content: contentWithCitations,
      citations: citations
    };
  }

  /**
   * Create academic references footer
   */
  createReferencesFooter(references) {
    if (!references || references.length === 0) {
      return null;
    }

    return {
      title: 'References',
      references: references.map(ref => ({
        id: ref.id,
        citation: this.formatCitation(ref)
      }))
    };
  }
}

// Create singleton instance
const academicReferencesService = new AcademicReferencesService();

export default academicReferencesService;
