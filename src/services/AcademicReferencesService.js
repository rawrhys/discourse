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
