import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import SimpleImageService from '../services/SimpleImageService';
import { publicTTSService } from '../services/TTSService';
import PerformanceMonitorService from '../services/PerformanceMonitorService';
import markdownService from '../services/MarkdownService';
import Flashcard from './Flashcard';
import './LessonView.css';

const PublicLessonView = ({ 
  lesson, 
  moduleTitle, 
  subject, 
  courseId, 
  onNextLesson, 
  onPreviousLesson, 
  onTakeQuiz, 
  currentLessonIndex, 
  totalLessonsInModule, 
  activeModule,
  courseDescription,
  sessionId // Add sessionId prop
}) => {
  const [imageData, setImageData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [view, setView] = useState('content'); // 'content' or 'flashcards'
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showFailMessage, setShowFailMessage] = useState(false);
  const [usedImageTitles, setUsedImageTitles] = useState(new Set());
  const [usedImageUrls, setUsedImageUrls] = useState(new Set());
  const [imageTitleCounts, setImageTitleCounts] = useState({});
  const [imageUrlCounts, setImageUrlCounts] = useState({});
  
  // TTS state management (matching private LessonView)
  const [ttsStatus, setTtsStatus] = useState({
    isPlaying: false,
    isPaused: false,
    isSupported: true // Assume supported for public courses
  });
  
  // Use isolated public TTS service
  const performanceMonitor = useRef(PerformanceMonitorService);
  const renderStartTime = useRef(performance.now());
  const abortControllerRef = useRef(null);
  const ttsStateUpdateTimeoutRef = useRef(null); // For debouncing state updates
  const isLessonChanging = useRef(false); // Track lesson changes to prevent TTS conflicts

  // Get flashcards data
  const flashcardData = lesson?.flashcards || lesson?.content?.flashcards || [];

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      try {
        publicTTSService.stop();
      } catch (error) {
        console.warn('[PublicLessonView] TTS cleanup error:', error);
      }
    };
  }, []);

  // Clean up any remaining malformed asterisks after content is rendered
  useEffect(() => {
    if (lesson?.content) {
      const timer = setTimeout(() => {
        const markdownElements = document.querySelectorAll('.lesson-content .markdown-body');
        markdownElements.forEach(element => {
          element.innerHTML = element.innerHTML
            .replace(/\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*\*/g, '**');
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [lesson?.content]);

  // Performance monitoring
  useEffect(() => {
    try {
      const renderTime = performance.now() - renderStartTime.current;
      if (performanceMonitor.current && typeof performanceMonitor.current.trackComponentRender === 'function') {
        performanceMonitor.current.trackComponentRender('PublicLessonView', renderTime);
      }
    } catch (error) {
      console.warn('[PublicLessonView] Performance monitoring error:', error);
    }
  }, [lesson?.id]);

  // Auto-pause TTS when lesson changes
  useEffect(() => {
    // Only trigger on actual lesson ID changes, not TTS status changes
    if (!lesson?.id) return;
    
    // Prevent multiple rapid triggers
    if (isLessonChanging.current) {
      console.log('[PublicLessonView] Lesson change already in progress, skipping');
      return;
    }
    
    // Only stop TTS if it's actually playing or paused
    const currentStatus = publicTTSService.getStatus();
    if (!currentStatus.isPlaying && !currentStatus.isPaused) {
      console.log('[PublicLessonView] TTS not playing, no need to stop on lesson change');
      return;
    }
    
    // Set flag to prevent TTS conflicts during lesson change
    isLessonChanging.current = true;
    console.log('[PublicLessonView] Lesson change detected, pausing TTS');
    
    // Stop TTS if it's currently playing or paused
    try {
      publicTTSService.stop(); // This will reset pause data via resetPauseData()
      console.log('[PublicLessonView] Stopped TTS and reset pause data on lesson change');
    } catch (error) {
      console.warn('[PublicLessonView] TTS auto-pause error:', error);
      // If stop fails, try to reset the service
      try {
        publicTTSService.reset();
        console.log('[PublicLessonView] Reset TTS service after stop error');
      } catch (resetError) {
        console.warn('[PublicLessonView] Error resetting TTS service:', resetError);
      }
    }
    
    // Update TTS status to reflect stopped state
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    
    // Clear the flag after a delay to prevent rapid re-triggers
    setTimeout(() => {
      isLessonChanging.current = false;
      console.log('[PublicLessonView] Lesson change flag cleared, TTS can resume');
    }, 1000); // Increased to 1 second to prevent rapid re-triggers
  }, [lesson?.id]); // Only depend on lesson ID, not TTS status

  // Sync TTS state with service state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const serviceStatus = publicTTSService.getStableStatus();
          
          // Only update state if there's an actual meaningful change
          const hasSignificantChange = (
            serviceStatus.isPlaying !== ttsStatus.isPlaying || 
            serviceStatus.isPaused !== ttsStatus.isPaused
          );
          
          if (hasSignificantChange) {
            // Clear any pending state update
            if (ttsStateUpdateTimeoutRef.current) {
              clearTimeout(ttsStateUpdateTimeoutRef.current);
            }
            
            // Debounce the state update to prevent rapid changes
            ttsStateUpdateTimeoutRef.current = setTimeout(() => {
              console.log('[PublicLessonView] TTS state changed:', {
                wasPlaying: ttsStatus.isPlaying,
                wasPaused: ttsStatus.isPaused,
                nowPlaying: serviceStatus.isPlaying,
                nowPaused: serviceStatus.isPaused
              });
              
              setTtsStatus(prev => ({
                ...prev,
                isPlaying: serviceStatus.isPlaying,
                isPaused: serviceStatus.isPaused
              }));
            }, 500); // Reduced debounce to 500ms for better responsiveness
        }
      } catch (error) {
        console.warn('[PublicLessonView] TTS state sync error:', error);
      }
    }, 5000); // Increased to 5 seconds to reduce rapid changes

    return () => {
      clearInterval(interval);
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, []); // Removed dependencies to prevent effect recreation

  // Handle image loading for public courses (simplified)
  useEffect(() => {
    if (!lesson?.title) return;

    let ignore = false;
    setImageLoading(true);
    setImageData(null);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    async function fetchImage() {
      try {
        // For public courses, use a simplified image search
        const result = await SimpleImageService.searchWithContext(
          lesson.title,
          subject,
          cleanAndCombineContent(lesson.content),
          usedImageTitles,
          usedImageUrls,
          courseId,
          lesson.id,
          courseDescription
        );
        
        if (!ignore && !abortController.signal.aborted) {
          setImageData(result ? { ...result, url: result.url } : null);
        }
      } catch (e) {
        if (!ignore && !abortController.signal.aborted) {
          console.warn('[PublicLessonView] Image fetch error:', e);
          setImageData(null);
        }
      } finally {
        if (!ignore && !abortController.signal.aborted) {
          setImageLoading(false);
        }
      }
    }
    
    fetchImage();
    
    return () => { 
      ignore = true;
      abortController.abort();
    };
  }, [lesson, subject, courseId, courseDescription]);

  // Cleanup TTS when component unmounts
  useEffect(() => {
    return () => {
      try {
        publicTTSService.stop();
        console.log('[PublicLessonView] Cleaned up TTS service on unmount');
      } catch (error) {
        console.warn('[PublicLessonView] Error cleaning up TTS service:', error);
      }
      
      // Clear any pending timeouts
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, []);

  const handleStartAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Check if TTS is already playing
      if (ttsStatus.isPlaying) {
        console.log('[PublicLessonView] TTS already playing, stopping first');
        publicTTSService.stop();
        setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        return;
      }

      // Check if TTS is paused and can resume
      if (ttsStatus.isPaused) {
        console.log('[PublicLessonView] Resuming paused TTS');
        publicTTSService.resume();
        setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        return;
      } else {
        // Start new reading - only read the currently displayed content
        let contentToRead = '';
        
        if (view === 'content') {
          // Read the full lesson content including introduction and conclusion
          if (lesson.content && typeof lesson.content === 'object') {
            // For object content, combine introduction, main_content, and conclusion
            const parts = [];
            if (lesson.content.introduction) {
              parts.push(lesson.content.introduction);
            }
            if (lesson.content.main_content) {
              parts.push(lesson.content.main_content);
            } else if (lesson.content.content) {
              parts.push(lesson.content.content);
            }
            if (lesson.content.conclusion) {
              parts.push(lesson.content.conclusion);
            }
            contentToRead = parts.join('\n\n');
          } else if (typeof lesson.content === 'string') {
            // For string content, use it as is
            contentToRead = lesson.content;
          }
        } else if (view === 'flashcards') {
          // For flashcards view, read the flashcard terms and definitions
          const flashcardData = lesson?.flashcards || lesson?.content?.flashcards || [];
          if (flashcardData.length > 0) {
            contentToRead = flashcardData.map((fc, index) => 
              `Flashcard ${index + 1}: ${fc.term || 'Unknown Term'}. Definition: ${fc.definition || 'Definition not provided.'}`
            ).join('. ');
          }
        }
        
        // Clean the content for TTS
        if (contentToRead) {
          contentToRead = contentToRead
            .replace(/Content generation completed\./g, '')
            .replace(/\|\|\|---\|\|\|/g, '')
            .replace(/\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*\*/g, '**')
            .trim();
        }
        
        // Validate content before attempting TTS
        if (!contentToRead || typeof contentToRead !== 'string' || contentToRead.trim().length < 10) {
          console.warn('[PublicLessonView] Content too short or invalid for TTS:', {
            view: view,
            hasContent: !!contentToRead,
            type: typeof contentToRead,
            length: contentToRead ? contentToRead.length : 0,
            trimmedLength: contentToRead ? contentToRead.trim().length : 0
          });
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
          return;
        }
        
        console.log('[PublicLessonView] Starting TTS with content:', {
          view: view,
          contentLength: contentToRead.length,
          contentPreview: contentToRead.substring(0, 100) + '...'
        });
        
        const started = await publicTTSService.readLesson({ ...lesson, content: contentToRead }, lesson.id);
        
        if (started) {
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        } else {
          console.warn('[PublicLessonView] TTS failed to start');
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        }
      }
    } catch (error) {
      console.error('[PublicLessonView] TTS error:', error);
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [ttsStatus.isPlaying, ttsStatus.isPaused, view, lesson]); // Added view and lesson dependencies

  const handleStopAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      publicTTSService.stop();
    } catch (error) {
      console.warn('[PublicLessonView] TTS stop error:', error);
    }
    // Always reset state when stopping
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  }, []);

  const handlePauseResumeAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[PublicLessonView] handlePauseResumeAudio called with state:', {
      isPlaying: ttsStatus.isPlaying,
      isPaused: ttsStatus.isPaused
    });
    
    try {
      if (ttsStatus.isPaused) {
        console.log('[PublicLessonView] Attempting to resume TTS');
        const resumed = await publicTTSService.resume();
        console.log('[PublicLessonView] Resume result:', resumed);
        if (resumed) {
        setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        }
      } else if (ttsStatus.isPlaying) {
        console.log('[PublicLessonView] Attempting to pause TTS');
        await publicTTSService.pause();
        setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: true }));
      }
    } catch (error) {
      console.warn('[PublicLessonView] TTS pause/resume error:', error);
      // Reset state on error
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]);

  const handleTabChange = useCallback((newView) => {
    setView(newView);
  }, []);

  // Memoized flashcard renderer
  const renderFlashcards = useCallback(() => {
    if (!flashcardData || flashcardData.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">No flashcards available for this lesson.</p>
          <p className="text-sm text-gray-500">Flashcard content will be generated automatically for new lessons.</p>
        </div>
      );
    }

    // Deduplicate flashcards based on the term
    const uniqueFlashcards = Array.from(
      new Map(flashcardData.map(card => [(card.term || '').toLowerCase(), card])).values()
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {uniqueFlashcards.map((fc, index) => (
          <Flashcard
            key={`${fc.term || 'unknown'}-${index}`}
            term={fc.term || 'Unknown Term'}
            definition={fc.definition || 'Definition not provided.'}
          />
        ))}
      </div>
    );
  }, [flashcardData]);

  // Enhanced markdown parsing with resilient error handling using Marked
  const fixMalformedMarkdown = (text) => {
    if (!text) return text;
    
    // Use the efficient MarkdownService with content-specific parsing
    if (text.includes('The Formation of the Greek City-States') || 
        (text.includes('Polis') && (text.includes('Acropolis') || text.includes('Agora')))) {
      return markdownService.parseGreekCityStates(text);
    }
    
    // Try the Archaic Period parser
    if (text.includes('Archaic Period') && text.includes('Lyric Poetry')) {
      return markdownService.parseGreekContent(text);
    }
    
    // Fall back to general parsing
    return markdownService.parse(text);
  };

  // Additional cleanup function for any remaining malformed asterisks
  const cleanupRemainingAsterisks = (text) => {
    if (!text) return text;
    
    return text
      // Remove standalone ** patterns that are clearly malformed
      .replace(/\*\*([^*\n]+?)\*\*/g, '**$1**')  // Fix unclosed bold
      .replace(/\*\*([^*\n]+?)$/gm, '**$1**')    // Fix unclosed bold at end
      .replace(/^([^*\n]+?)\*\*/gm, '**$1**')    // Fix unclosed bold at start
      // Remove any remaining standalone ** patterns
      .replace(/\*\*(?!\w)/g, '')                // Remove ** not followed by word
      .replace(/(?<!\w)\*\*/g, '')               // Remove ** not preceded by word
      // Clean up multiple consecutive asterisks
      .replace(/\*\*\*\*/g, '**')
      .replace(/\*\*\*\*\*/g, '**')
      .replace(/\*\*\*\*\*\*/g, '**');
  };

  // Function to extract references from content
  const extractReferences = (content) => {
    if (!content || typeof content !== 'string') return { contentWithoutRefs: content, references: [] };
    
    // Look for References section with various patterns
    const refPatterns = [
      /## References\s*([\s\S]*?)(?=\n## |\n# |$)/i,
      /## References\s*\[(\d+)\]\s*([\s\S]*?)(?=\n## |\n# |$)/i,
      /References\s*\[(\d+)\]\s*([\s\S]*?)(?=\n## |\n# |$)/i
    ];
    
    let refMatch = null;
    let referencesText = '';
    
    // Try each pattern
    for (const pattern of refPatterns) {
      refMatch = content.match(pattern);
      if (refMatch) {
        referencesText = refMatch[1] || refMatch[2] || '';
        break;
      }
    }
    
    if (!refMatch) return { contentWithoutRefs: content, references: [] };
    
    const references = [];
    
    // Parse individual references - handle multiple formats
    const refLines = referencesText.split(/\n+/).filter(line => line.trim());
    
    refLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // Look for numbered references like [1], [2], etc.
        const numberedMatch = trimmedLine.match(/^\[(\d+)\]\s*(.+)$/);
        if (numberedMatch) {
          references.push({
            number: numberedMatch[1],
            citation: numberedMatch[2].trim()
          });
        } else {
          // Look for patterns like "## References [1] Encyclopaedia Britannica..."
          const inlineMatch = trimmedLine.match(/\[(\d+)\]\s*(.+)$/);
          if (inlineMatch) {
            references.push({
              number: inlineMatch[1],
              citation: inlineMatch[2].trim()
            });
          } else {
            // If no number found, just add the line as a reference
            references.push({
              number: (references.length + 1).toString(),
              citation: trimmedLine
            });
          }
        }
      }
    });
    
    // Remove the References section from the content
    const contentWithoutRefs = content.replace(/## References\s*[\s\S]*?(?=\n## |\n# |$)/i, '').trim();
    
    return { contentWithoutRefs, references };
  };

  // Frontend-level fix for malformed References sections
  const fixMalformedReferencesAtFrontend = (text) => {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let fixedText = text
      // Fix the specific problematic pattern: "## References [1] ... [2] ..."
      .replace(/## References\s*\[(\d+)\]/g, '\n## References\n\n[$1]')
      // Ensure each citation is on its own line
      .replace(/\]\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Add proper line breaks between citations
      .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Clean up any remaining issues
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple line breaks

    return fixedText;
  };

  // ReferencesFooter component
  const ReferencesFooter = memo(({ references }) => {
    if (!references || references.length === 0) return null;

    // Debug logging for references footer
    if (process.env.NODE_ENV === 'development') {
      console.log('[ReferencesFooter] Rendering references:', references);
    }

    return (
      <footer className="references-footer mt-8 pt-6 border-t border-gray-200">
        <h2 className="references-header text-xl font-semibold text-gray-900 mb-4">
          References
        </h2>
        <div className="references-list space-y-3">
          {references.map((ref, index) => {
            // Parse the citation to handle markdown formatting
            const parsedCitation = fixMalformedMarkdown(ref.citation);
            
            return (
              <div key={index} className="citation-item p-3 bg-gray-50 border-l-4 border-blue-500 rounded">
                <span className="font-medium text-blue-600">[{ref.number}]</span>
                <span className="ml-2" dangerouslySetInnerHTML={{ 
                  __html: parsedCitation 
                }} />
              </div>
            );
          })}
        </div>
      </footer>
    );
  });

  // Helper function to clean and combine lesson content
  const cleanAndCombineContent = (content) => {
    if (!content) {
      console.warn('[PublicLessonView] No content provided to cleanAndCombineContent');
      return '';
    }
    
    // Helper function to clean individual content parts
    const cleanContentPart = (part) => {
      if (!part) return '';
      
      // First, remove all separator patterns before any other processing
      let cleaned = part
        .replace(/Content generation completed\./g, '')
        .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
        .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
        .trim();
      
      // Then apply markdown processing
      cleaned = fixMalformedMarkdown(cleaned);
      
      // Final cleanup of any separators that might have been reintroduced
      cleaned = cleaned
        .replace(/\|\|\|---\|\|\|/g, '')
        .replace(/\|\|\|/g, '');
      
      return cleaned;
    };
    
    if (typeof content === 'string') {
      const cleaned = cleanContentPart(content);
      const result = cleanupRemainingAsterisks(cleaned);
      
      // Final separator cleanup after all processing
      const finalResult = result
        .replace(/\|\|\|---\|\|\|/g, '')
        .replace(/\|\|\|/g, '');
      
      console.log('[PublicLessonView] String content processed:', {
        originalLength: content.length,
        cleanedLength: finalResult.length,
        hasContent: finalResult.trim().length > 0
      });
      return finalResult;
    }
    
    const { introduction, main_content, conclusion } = content;
    
    const cleanedIntro = introduction 
      ? cleanupRemainingAsterisks(cleanContentPart(introduction))
      : '';

    const cleanedMain = main_content ? cleanupRemainingAsterisks(cleanContentPart(main_content)) : '';
    const cleanedConclusion = conclusion ? cleanupRemainingAsterisks(cleanContentPart(conclusion)) : '';
    
    const result = [cleanedIntro, cleanedMain, cleanedConclusion]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\|\|\|---\|\|\|/g, '') // Final cleanup of any remaining patterns
      .replace(/\|\|\|/g, ''); // Final cleanup of any remaining ||| patterns
      
    console.log('[PublicLessonView] Object content processed:', {
      hasIntro: !!introduction,
      hasMain: !!main_content,
      hasConclusion: !!conclusion,
      introLength: cleanedIntro.length,
      mainLength: cleanedMain.length,
      conclusionLength: cleanedConclusion.length,
      resultLength: result.length,
      hasContent: result.trim().length > 0
    });
    
    return result;
  };

  // Early return if no lesson
  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No lesson selected</p>
      </div>
    );
  }

  const lessonContent = cleanAndCombineContent(lesson.content);
  
  // Apply markdown fix before rendering - use bibliography-aware parsing
  let fixedContent = lessonContent.includes('## References') 
    ? markdownService.parseWithBibliography(lessonContent)
    : fixMalformedMarkdown(lessonContent);

  // Frontend-level fix for malformed References sections
  fixedContent = fixMalformedReferencesAtFrontend(fixedContent);

  // Extract references from the content
  const { contentWithoutRefs, references } = extractReferences(fixedContent);

  // Apply markdown parsing to content without references
  const parsedContent = fixMalformedMarkdown(contentWithoutRefs);

  // Debug logging for references processing
  if (process.env.NODE_ENV === 'development') {
    console.log('[PublicLessonView] References processing:', {
      hasReferences: lessonContent?.includes('## References'),
      referencesCount: references?.length || 0,
      references: references,
      contentWithoutRefsLength: contentWithoutRefs?.length || 0,
      parsedContentLength: parsedContent?.length || 0,
      lessonContentPreview: lessonContent?.substring(0, 200) + '...',
      fixedContentPreview: fixedContent?.substring(0, 200) + '...'
    });
  }

  // Add bibliography if available and not already in content
  let finalReferences = references;
  if (lesson.bibliography && lesson.bibliography.length > 0 && !lessonContent.includes('## References')) {
    const bibliographyMarkdown = '\n\n## References\n\n' + 
      lesson.bibliography.map((ref, index) => `[${index + 1}] ${ref}`).join('\n\n');
    const { contentWithoutRefs: contentWithoutBib, references: bibRefs } = extractReferences(bibliographyMarkdown);
    finalReferences = bibRefs;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] Bibliography processing:', {
        bibliographyCount: lesson.bibliography?.length || 0,
        bibRefsCount: bibRefs?.length || 0,
        bibRefs: bibRefs
      });
    }
  }

  // Fallback: if no references were extracted but lesson has bibliography, create references from it
  if ((!finalReferences || finalReferences.length === 0) && lesson.bibliography && lesson.bibliography.length > 0) {
    finalReferences = lesson.bibliography.map((ref, index) => ({
      number: (index + 1).toString(),
      citation: ref
    }));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] Using fallback bibliography:', {
        bibliographyCount: lesson.bibliography?.length || 0,
        finalReferences: finalReferences
      });
    }
  }

  // Final debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[PublicLessonView] Final references state:', {
      finalReferencesCount: finalReferences?.length || 0,
      finalReferences: finalReferences,
      willShowFooter: finalReferences && finalReferences.length > 0
    });
  }

  // Temporary test: Add a test reference if none exist (for debugging)
  if (process.env.NODE_ENV === 'development' && (!finalReferences || finalReferences.length === 0)) {
    finalReferences = [
      {
        number: '1',
        citation: 'Test Reference - Encyclopaedia Britannica. (2024). *Academic Edition*. Encyclopaedia Britannica, Inc.'
      },
      {
        number: '2', 
        citation: 'Test Reference - Oxford University Press. (2012). *Oxford Classical Dictionary*. Oxford University Press.'
      }
    ];
    console.log('[PublicLessonView] Added test references for debugging:', finalReferences);
  }

  return (
    <div className="lesson-view bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Lesson Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onPreviousLesson}
              disabled={currentLessonIndex === 0}
              className="p-2 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous lesson"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onNextLesson}
              disabled={currentLessonIndex === totalLessonsInModule - 1}
              className="p-2 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next lesson"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center space-x-3">
            {lesson.quiz && lesson.quiz.length > 0 && (
              <button
                onClick={onTakeQuiz}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                Take Quiz
              </button>
            )}
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
        {moduleTitle && (
          <p className="text-blue-100 text-lg">{moduleTitle}</p>
        )}
        <div className="flex items-center space-x-4 mt-4 text-sm text-blue-100">
          <span>Lesson {currentLessonIndex + 1} of {totalLessonsInModule}</span>
          {lesson.quiz && lesson.quiz.length > 0 && (
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              Quiz Available
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-4 p-6 pb-0">
        <button
          onClick={() => handleTabChange('content')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === 'content' 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <i className="fas fa-book mr-2"></i>Content
        </button>
        <button
          onClick={() => handleTabChange('flashcards')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === 'flashcards'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <i className="fas fa-clone mr-2"></i>Flashcards {flashcardData?.length ? `(${flashcardData.length})` : ''}
        </button>
        <button
          onClick={ttsStatus.isPlaying ? handlePauseResumeAudio : ttsStatus.isPaused ? handlePauseResumeAudio : handleStartAudio}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            ttsStatus.isPlaying || ttsStatus.isPaused
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={ttsStatus.isPlaying ? 'Pause reading' : ttsStatus.isPaused ? 'Resume reading' : 'Start reading aloud'}
        >
          <i className={`mr-2 ${ttsStatus.isPlaying ? 'fas fa-pause' : ttsStatus.isPaused ? 'fas fa-play' : 'fas fa-volume-up'}`}></i>
          {ttsStatus.isPlaying ? 'Pause' : ttsStatus.isPaused ? 'Resume' : 'Read Aloud'}
        </button>
        {(ttsStatus.isPlaying || ttsStatus.isPaused) && (
          <button
            onClick={handleStopAudio}
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700"
            title="Stop reading"
          >
            <i className="fas fa-stop mr-2"></i>
            Stop
          </button>
        )}
      </div>

      {/* Content View */}
      {view === 'content' && (
        <div className="p-6">
          {/* Image Section - Above content like private LessonView */}
          {imageLoading && (
            <div className="lesson-image-container loading mb-6">
              <div className="image-loading">Loading image...</div>
            </div>
          )}
          
          {imageData && imageData.url && !imageLoading && (
            <figure className="lesson-image-container mb-6" style={{ maxWidth: 700, margin: '0 auto' }}>
              <img
                src={imageData.url}
                alt={lesson?.title || 'Lesson illustration'}
                className="lesson-image"
                style={{ width: '100%', height: 'auto' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <figcaption className="image-description" style={{ 
                textAlign: 'center', 
                marginTop: '8px', 
                fontSize: '14px', 
                color: '#000',
                fontStyle: 'italic'
              }}>
                {(() => {
                  const { uploader, attribution } = imageData || {};
                  // Prefer explicit uploader if present; strip leading 'User:'
                  if (typeof uploader === 'string' && uploader.trim()) {
                    return uploader.replace(/^user:\s*/i, '').trim();
                  }
                  // Fallback: derive from attribution string
                  if (typeof attribution === 'string') {
                    const withoutHtml = attribution.replace(/<[^>]*>/g, '');
                    const byIdx = withoutHtml.toLowerCase().indexOf('image by ');
                    if (byIdx !== -1) {
                      const after = withoutHtml.substring(byIdx + 'image by '.length);
                      const viaIdx = after.toLowerCase().indexOf(' via');
                      const extracted = (viaIdx !== -1 ? after.substring(0, viaIdx) : after).trim();
                      return extracted.replace(/^user:\s*/i, '').trim();
                    }
                  }
                  return '';
                })()}
                {imageData?.pageURL ? (
                  <>
                    <span style={{ margin: '0 6px' }}>·</span>
                    <a href={imageData.pageURL} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontStyle: 'normal' }}>
                      Source
                    </a>
                  </>
                ) : null}
              </figcaption>
            </figure>
          )}

          {/* Lesson Content */}
          <div className="lesson-content max-w-none">
            <div 
              className="markdown-body prose max-w-none"
              dangerouslySetInnerHTML={{ __html: parsedContent }}
            />
          </div>
          
          {/* References Footer */}
          {finalReferences && finalReferences.length > 0 && (
            <ReferencesFooter references={finalReferences} />
          )}
        </div>
      )}

      {/* Flashcards View */}
      {view === 'flashcards' && (
        <div className="p-6">
          {renderFlashcards()}
        </div>
      )}

      {/* Success/Fail Messages */}
      {showSuccessMessage && (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          <strong className="font-bold">Perfect Score!</strong>
          <span className="block sm:inline"> Great job on the quiz!</span>
        </div>
      )}

      {showFailMessage && (
        <div className="fixed bottom-5 right-5 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          <strong className="font-bold">Keep Trying!</strong>
          <span className="block sm:inline"> Review the lesson and try again.</span>
        </div>
      )}
    </div>
  );
};

export default PublicLessonView;
