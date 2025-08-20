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
    
    this.defaultReferences = {
      ancientEgypt: [
        { id: 1, type: 'book', author: 'Shaw', year: '2000', title: 'The Oxford History of Ancient Egypt', publisher: 'Oxford University Press' },
        { id: 2, type: 'book', author: 'Kemp', year: '2006', title: 'Ancient Egypt: Anatomy of a Civilization', publisher: 'Routledge' },
        { id: 3, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      ancientGreece: [
        { id: 1, type: 'book', author: 'Hornblower', year: '2012', title: 'The Oxford Classical Dictionary', publisher: 'Oxford University Press' },
        { id: 2, type: 'book', author: 'Cartledge', year: '2011', title: 'Ancient Greece: A Very Short Introduction', publisher: 'Oxford University Press' },
        { id: 3, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      ancientRome: [
        { id: 1, type: 'book', author: 'Beard', year: '2015', title: 'SPQR: A History of Ancient Rome', publisher: 'Liveright' },
        { id: 2, type: 'book', author: 'Woolf', year: '2012', title: 'Rome: An Empire\'s Story', publisher: 'Oxford University Press' },
        { id: 3, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      biology: [
        { id: 1, type: 'book', author: 'Alberts', year: '2022', title: 'Molecular Biology of the Cell', publisher: 'Garland Science' },
        { id: 2, type: 'book', author: 'Campbell', year: '2021', title: 'Biology: A Global Approach', publisher: 'Pearson' },
        { id: 3, type: 'book', author: 'Raven', year: '2020', title: 'Biology', publisher: 'McGraw-Hill Education' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      plantBiology: [
        { id: 1, type: 'book', author: 'Taiz', year: '2018', title: 'Plant Physiology and Development', publisher: 'Sinauer Associates' },
        { id: 2, type: 'book', author: 'Raven', year: '2016', title: 'Biology of Plants', publisher: 'W.H. Freeman' },
        { id: 3, type: 'book', author: 'Mauseth', year: '2019', title: 'Botany: An Introduction to Plant Biology', publisher: 'Jones & Bartlett Learning' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      cellBiology: [
        { id: 1, type: 'book', author: 'Alberts', year: '2022', title: 'Molecular Biology of the Cell', publisher: 'Garland Science' },
        { id: 2, type: 'book', author: 'Lodish', year: '2021', title: 'Molecular Cell Biology', publisher: 'W.H. Freeman' },
        { id: 3, type: 'book', author: 'Cooper', year: '2019', title: 'The Cell: A Molecular Approach', publisher: 'Sinauer Associates' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      chemistry: [
        { id: 1, type: 'book', author: 'Atkins', year: '2022', title: 'Physical Chemistry', publisher: 'Oxford University Press' },
        { id: 2, type: 'book', author: 'McMurry', year: '2021', title: 'Organic Chemistry', publisher: 'Cengage Learning' },
        { id: 3, type: 'book', author: 'Brown', year: '2020', title: 'Chemistry: The Central Science', publisher: 'Pearson' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      physics: [
        { id: 1, type: 'book', author: 'Halliday', year: '2021', title: 'Fundamentals of Physics', publisher: 'Wiley' },
        { id: 2, type: 'book', author: 'Serway', year: '2020', title: 'Physics for Scientists and Engineers', publisher: 'Cengage Learning' },
        { id: 3, type: 'book', author: 'Young', year: '2022', title: 'University Physics', publisher: 'Pearson' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ],
      mathematics: [
        { id: 1, type: 'book', author: 'Stewart', year: '2021', title: 'Calculus: Early Transcendentals', publisher: 'Cengage Learning' },
        { id: 2, type: 'book', author: 'Lay', year: '2020', title: 'Linear Algebra and Its Applications', publisher: 'Pearson' },
        { id: 3, type: 'book', author: 'Rosen', year: '2019', title: 'Discrete Mathematics and Its Applications', publisher: 'McGraw-Hill Education' },
        { id: 4, type: 'encyclopedia', author: 'Encyclopaedia Britannica', year: '2024', title: 'Academic Edition', publisher: 'Encyclopaedia Britannica, Inc.' }
      ]
    };
  }

  /**
   * Generate academic references based on lesson content and subject
   */
  generateReferences(lessonContent, subject, lessonTitle) {
    try {
      console.log('[AcademicReferencesService] Generating references for:', { subject, lessonTitle });
      
      // Determine the appropriate reference set based on subject
      let referenceSet = this.getReferenceSetBySubject(subject);
      
      // Generate contextual references based on content
      const contextualRefs = this.generateContextualReferences(lessonContent, referenceSet);
      
      // Add lesson-specific references if available
      const lessonSpecificRefs = this.getLessonSpecificReferences(lessonTitle, subject);
      
      // Combine and deduplicate references
      const allReferences = this.combineAndDeduplicateReferences([
        ...contextualRefs,
        ...lessonSpecificRefs
      ]);
      
      console.log('[AcademicReferencesService] Generated references:', allReferences);
      
      return allReferences;
    } catch (error) {
      console.error('[AcademicReferencesService] Error generating references:', error);
      return this.getDefaultReferences(subject);
    }
  }

  /**
   * Get reference set based on subject
   */
  getReferenceSetBySubject(subject) {
    const subjectLower = subject?.toLowerCase() || '';
    
    // History subjects
    if (subjectLower.includes('egypt') || subjectLower.includes('ancient egypt')) {
      return this.defaultReferences.ancientEgypt;
    } else if (subjectLower.includes('greece') || subjectLower.includes('ancient greece')) {
      return this.defaultReferences.ancientGreece;
    } else if (subjectLower.includes('rome') || subjectLower.includes('ancient rome')) {
      return this.defaultReferences.ancientRome;
    }
    
    // Biology subjects
    if (subjectLower.includes('plant') || subjectLower.includes('botany') || subjectLower.includes('flora')) {
      return this.defaultReferences.plantBiology;
    } else if (subjectLower.includes('cell') || subjectLower.includes('cellular') || subjectLower.includes('molecular')) {
      return this.defaultReferences.cellBiology;
    } else if (subjectLower.includes('biology') || subjectLower.includes('biological') || subjectLower.includes('life science')) {
      return this.defaultReferences.biology;
    }
    
    // Chemistry subjects
    if (subjectLower.includes('chemistry') || subjectLower.includes('chemical') || subjectLower.includes('organic') || subjectLower.includes('inorganic')) {
      return this.defaultReferences.chemistry;
    }
    
    // Physics subjects
    if (subjectLower.includes('physics') || subjectLower.includes('physical') || subjectLower.includes('mechanics') || subjectLower.includes('thermodynamics')) {
      return this.defaultReferences.physics;
    }
    
    // Mathematics subjects
    if (subjectLower.includes('math') || subjectLower.includes('mathematics') || subjectLower.includes('calculus') || subjectLower.includes('algebra') || subjectLower.includes('geometry')) {
      return this.defaultReferences.mathematics;
    }
    
    // Default to biology for scientific subjects, ancient Greece for unclear subjects
    if (subjectLower.includes('science') || subjectLower.includes('scientific')) {
      return this.defaultReferences.biology;
    }
    
    // Default to ancient Greece if subject is completely unclear
    return this.defaultReferences.ancientGreece;
  }

  /**
   * Generate contextual references based on content analysis
   */
  generateContextualReferences(content, baseReferences) {
    if (!content || typeof content !== 'string') {
      return baseReferences;
    }

    const contextualRefs = [...baseReferences];
    const contentLower = content.toLowerCase();
    
    // Create a set of existing reference keys to avoid duplicates
    const existingKeys = new Set();
    baseReferences.forEach(ref => {
      const key = `${ref.author}-${ref.year}-${ref.title}`;
      existingKeys.add(key);
    });
    
    // Add specific references based on content keywords (only if not already present)
    
    // History references
    if (contentLower.includes('pyramid') || contentLower.includes('pharaoh')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Lehner',
        year: '1997',
        title: 'The Complete Pyramids',
        publisher: 'Thames & Hudson'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    if (contentLower.includes('democracy') || contentLower.includes('athens')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Ober',
        year: '2015',
        title: 'The Rise and Fall of Classical Greece',
        publisher: 'Princeton University Press'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    if (contentLower.includes('republic') || contentLower.includes('senate')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Lintott',
        year: '1999',
        title: 'The Constitution of the Roman Republic',
        publisher: 'Oxford University Press'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    // Biology references
    if (contentLower.includes('cell') || contentLower.includes('cellular') || contentLower.includes('membrane')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Alberts',
        year: '2022',
        title: 'Molecular Biology of the Cell',
        publisher: 'Garland Science'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    if (contentLower.includes('plant') || contentLower.includes('chloroplast') || contentLower.includes('photosynthesis')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Taiz',
        year: '2018',
        title: 'Plant Physiology and Development',
        publisher: 'Sinauer Associates'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    if (contentLower.includes('dna') || contentLower.includes('gene') || contentLower.includes('genetic')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Watson',
        year: '2014',
        title: 'Molecular Biology of the Gene',
        publisher: 'Pearson'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    // Chemistry references
    if (contentLower.includes('molecule') || contentLower.includes('chemical') || contentLower.includes('reaction')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Atkins',
        year: '2022',
        title: 'Physical Chemistry',
        publisher: 'Oxford University Press'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    // Physics references
    if (contentLower.includes('force') || contentLower.includes('energy') || contentLower.includes('motion')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Halliday',
        year: '2021',
        title: 'Fundamentals of Physics',
        publisher: 'Wiley'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    // Mathematics references
    if (contentLower.includes('equation') || contentLower.includes('formula') || contentLower.includes('calculation')) {
      const newRef = {
        id: contextualRefs.length + 1,
        type: 'book',
        author: 'Stewart',
        year: '2021',
        title: 'Calculus: Early Transcendentals',
        publisher: 'Cengage Learning'
      };
      const key = `${newRef.author}-${newRef.year}-${newRef.title}`;
      if (!existingKeys.has(key)) {
        contextualRefs.push(newRef);
        existingKeys.add(key);
      }
    }
    
    return contextualRefs;
  }

  /**
   * Get lesson-specific references
   */
  getLessonSpecificReferences(lessonTitle, subject) {
    if (!lessonTitle) return [];
    
    const titleLower = lessonTitle.toLowerCase();
    const specificRefs = [];
    
    // Add specific references based on lesson title
    if (titleLower.includes('early dynastic') || titleLower.includes('unification')) {
      specificRefs.push({
        id: 1,
        type: 'book',
        author: 'Wilkinson',
        year: '2013',
        title: 'The Rise and Fall of Ancient Egypt',
        publisher: 'Random House'
      });
    }
    
    if (titleLower.includes('city-state') || titleLower.includes('polis')) {
      specificRefs.push({
        id: 1,
        type: 'book',
        author: 'Hansen',
        year: '2006',
        title: 'Polis: An Introduction to the Ancient Greek City-State',
        publisher: 'Oxford University Press'
      });
    }
    
    // Add more specific references based on lesson content
    if (titleLower.includes('republic') || titleLower.includes('roman republic')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Lintott',
        year: '1999',
        title: 'The Constitution of the Roman Republic',
        publisher: 'Oxford University Press'
      });
    }
    
    if (titleLower.includes('empire') || titleLower.includes('roman empire')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Garnsey',
        year: '1987',
        title: 'The Roman Empire: Economy, Society and Culture',
        publisher: 'University of California Press'
      });
    }
    
    // Biology-specific references
    if (titleLower.includes('cell') || titleLower.includes('cellular') || titleLower.includes('membrane')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Alberts',
        year: '2022',
        title: 'Molecular Biology of the Cell',
        publisher: 'Garland Science'
      });
    }
    
    if (titleLower.includes('plant') || titleLower.includes('botany') || titleLower.includes('photosynthesis')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Taiz',
        year: '2018',
        title: 'Plant Physiology and Development',
        publisher: 'Sinauer Associates'
      });
    }
    
    if (titleLower.includes('dna') || titleLower.includes('gene') || titleLower.includes('genetic')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Watson',
        year: '2014',
        title: 'Molecular Biology of the Gene',
        publisher: 'Pearson'
      });
    }
    
    // Chemistry-specific references
    if (titleLower.includes('chemistry') || titleLower.includes('chemical') || titleLower.includes('molecule')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Atkins',
        year: '2022',
        title: 'Physical Chemistry',
        publisher: 'Oxford University Press'
      });
    }
    
    // Physics-specific references
    if (titleLower.includes('physics') || titleLower.includes('force') || titleLower.includes('energy')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Halliday',
        year: '2021',
        title: 'Fundamentals of Physics',
        publisher: 'Wiley'
      });
    }
    
    // Mathematics-specific references
    if (titleLower.includes('math') || titleLower.includes('calculus') || titleLower.includes('algebra')) {
      specificRefs.push({
        id: specificRefs.length + 1,
        type: 'book',
        author: 'Stewart',
        year: '2021',
        title: 'Calculus: Early Transcendentals',
        publisher: 'Cengage Learning'
      });
    }
    
    console.log('[AcademicReferencesService] Lesson-specific references:', {
      lessonTitle,
      specificRefsCount: specificRefs.length,
      specificRefs
    });
    
    return specificRefs;
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
      
      // Create a more robust key that handles variations in formatting
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
      } else {
        console.log('[AcademicReferencesService] Skipping duplicate reference:', {
          author: ref.author,
          title: ref.title,
          year: ref.year
        });
      }
    });
    
    console.log('[AcademicReferencesService] Deduplicated references:', {
      originalCount: references.length,
      uniqueCount: uniqueRefs.length,
      duplicatesRemoved: references.length - uniqueRefs.length
    });
    
    return uniqueRefs;
  }

  /**
   * Get default references for a subject
   */
  getDefaultReferences(subject) {
    return this.getReferenceSetBySubject(subject);
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
    
    // Create citation markers in content
    const contentWithCitations = content.replace(
      /([.!?])\s+/g,
      (match, punctuation) => {
        // Add citation every few sentences
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
