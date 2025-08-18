import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import SimpleImageService from '../services/SimpleImageService';
import { publicTTSService } from '../services/TTSService';
import PerformanceMonitorService from '../services/PerformanceMonitorService';
import markdownService from '../services/MarkdownService';
import academicReferencesService from '../services/AcademicReferencesService';
import AcademicReferencesFooter from './AcademicReferencesFooter';
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
          }, 100); // Reduced debounce to 100ms for better responsiveness
        }
      } catch (error) {
        console.warn('[PublicLessonView] TTS state sync error:', error);
        // If sync fails, reset to stopped state
        setTtsStatus(prev => ({ 
          ...prev, 
          isPlaying: false, 
          isPaused: false 
        }));
      }
    }, 1000); // Reduced to 1 second for more responsive state updates

    return () => {
      clearInterval(interval);
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]); // Added dependencies back for proper updates

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

  // Academic references state
  const [academicReferences, setAcademicReferences] = useState([]);
  const [contentWithCitations, setContentWithCitations] = useState('');
  const [highlightedCitation, setHighlightedCitation] = useState(null);

  // Generate academic references when lesson changes
  useEffect(() => {
    if (!lesson?.content || !subject) return;

    try {
      console.log('[PublicLessonView] Generating academic references for:', lesson.title);
      
      // Ensure lesson.content is a string
      const lessonContentString = typeof lesson.content === 'string' 
        ? lesson.content 
        : JSON.stringify(lesson.content);
      
      // Generate academic references
      const references = academicReferencesService.generateReferences(
        lessonContentString,
        subject,
        lesson.title
      );
      
      setAcademicReferences(references);
      
      // Generate content with inline citations
      const { content: contentWithInlineCitations } = academicReferencesService.generateInlineCitations(
        lessonContentString,
        references
      );
      
      setContentWithCitations(contentWithInlineCitations);
      
      console.log('[PublicLessonView] Academic references generated:', {
        referencesCount: references.length,
        hasCitations: !!contentWithInlineCitations
      });
    } catch (error) {
      console.error('[PublicLessonView] Error generating academic references:', error);
      setAcademicReferences([]);
      setContentWithCitations('');
    }
  }, [lesson?.id, lesson?.title, lesson?.content, subject]);

  // Handle citation click
  const handleCitationClick = useCallback((referenceId) => {
    setHighlightedCitation(referenceId);
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedCitation(null);
    }, 3000);
    
    console.log('[PublicLessonView] Citation clicked:', referenceId);
  }, []);

  // Cleanup TTS when component unmounts
  useEffect(() => {
    return () => {
      try {
        console.log('[PublicLessonView] Component unmounting, cleaning up TTS...');
        publicTTSService.stop();
        publicTTSService.reset();
        console.log('[PublicLessonView] Cleaned up TTS service on unmount');
      } catch (error) {
        console.warn('[PublicLessonView] Error cleaning up TTS service:', error);
        // Force reset even if stop fails
        try {
          publicTTSService.reset();
        } catch (resetError) {
          console.warn('[PublicLessonView] Error resetting TTS service:', resetError);
        }
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
    
    console.log('[PublicLessonView] handleStopAudio called, stopping TTS...');
    
    try {
      // Stop the TTS service
      await publicTTSService.stop();
      console.log('[PublicLessonView] TTS stop completed successfully');
      
      // Force reset the service state
      publicTTSService.reset();
      console.log('[PublicLessonView] TTS service reset completed');
      
      // Always reset state when stopping
      setTtsStatus(prev => ({ 
        ...prev, 
        isPlaying: false, 
        isPaused: false 
      }));
      
      console.log('[PublicLessonView] TTS state reset to stopped');
    } catch (error) {
      console.warn('[PublicLessonView] TTS stop error:', error);
      
      // Even if stop fails, try to reset the service
      try {
        publicTTSService.reset();
        console.log('[PublicLessonView] TTS service reset after stop error');
      } catch (resetError) {
        console.warn('[PublicLessonView] TTS reset error:', resetError);
      }
      
      // Always reset state when stopping, even on error
      setTtsStatus(prev => ({ 
        ...prev, 
        isPlaying: false, 
        isPaused: false 
      }));
    }
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
    
    // Remove in-text citations first, then apply markdown fix
    let processedText = markdownService.removeInTextCitations(text);
    
    // Use the efficient MarkdownService with content-specific parsing
    if (processedText.includes('The Formation of the Greek City-States') || 
        (processedText.includes('Polis') && (processedText.includes('Acropolis') || processedText.includes('Agora')))) {
      return markdownService.parseGreekCityStates(processedText);
    }
    
    // Try the Archaic Period parser
    if (processedText.includes('Archaic Period') && processedText.includes('Lyric Poetry')) {
      return markdownService.parseGreekContent(processedText);
    }
    
    // Check if content has bibliography and use bibliography-aware parsing
    if (processedText.includes('## References')) {
      return markdownService.parseWithBibliography(processedText);
    }
    
    // Fall back to general parsing
    return markdownService.parse(processedText);
  };

  // Additional cleanup function for any remaining malformed asterisks and citations
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





  // Function to ensure proper paragraph formatting and line breaks
  const fixParagraphFormatting = (text) => {
    if (!text) return text;
    
    return text
      // Ensure double line breaks create proper paragraphs
      .replace(/\n\n+/g, '\n\n')  // Normalize multiple line breaks to double
      .replace(/\n\s*\n/g, '\n\n')  // Remove extra spaces between paragraphs
      // Ensure proper paragraph breaks after sentences
      .replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2')  // Add paragraph break after sentences
      .replace(/([.!?])\s*([A-Z][a-z])/g, '$1\n\n$2')  // Add paragraph break when no line break exists
      // Ensure proper spacing around paragraph breaks
      .replace(/\n\s*([A-Z][a-z])/g, '\n\n$1')  // Add extra line break before capitalized words
      .replace(/([.!?])\s*\n/g, '$1\n\n')  // Add extra line break after sentences
      // Clean up any remaining formatting issues
      .replace(/\n{3,}/g, '\n\n')  // Limit to max 2 consecutive line breaks
      .trim();
  };



  // Helper function to clean and combine lesson content
  const cleanAndCombineContent = (content) => {
    if (!content) {
      console.warn('[PublicLessonView] No content provided to cleanAndCombineContent');
      return '';
    }
    
    // Single-pass content cleaning function
    const cleanContentOnce = (text) => {
      if (!text) return '';
      
      // Ensure text is a string
      const textString = typeof text === 'string' ? text : String(text);
      
      console.log('[PublicLessonView] Processing content:', {
        originalLength: textString.length,
        isJson: textString.trim().startsWith('{') && textString.trim().endsWith('}')
      });
      
      let cleaned = textString;
      
      // Step 1: Handle JSON structure if present
      // Check for JSON-like structure (starts with { and ends with })
      if (cleaned.trim().startsWith('{') && cleaned.trim().endsWith('}')) {
        console.log('[PublicLessonView] Detected JSON-like structure, attempting to parse...');
        try {
          // Replace smart quotes with standard quotes
          cleaned = cleaned
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            .replace(/"/g, '"');
          
          // Try to fix common JSON issues before parsing
          cleaned = cleaned
            // Fix empty keys
            .replace(/""\s*:/g, '"content":')
            .replace(/,\s*""\s*:/g, ',"content":')
            // Fix malformed JSON patterns that are close to words
            .replace(/(\w)\s*""\s*:\s*""/g, '$1')
            .replace(/(\w)\s*""\s*:/g, '$1')
            .replace(/""\s*:\s*""\s*(\w)/g, '$1')
            .replace(/""\s*:\s*(\w)/g, '$1')
            // Fix unescaped quotes in content
            .replace(/"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3"')
            // Fix newlines in strings
            .replace(/\n/g, '\\n')
            .replace(/\\n\\n/g, '\\n\\n');
          
          const parsed = JSON.parse(cleaned);
          const { introduction, main_content, conclusion } = parsed;
          
          // Combine content parts
          cleaned = [introduction, main_content, conclusion]
            .filter(Boolean)
            .join('\n\n');
          
          console.log('[PublicLessonView] JSON parsed successfully:', {
            hasIntro: !!introduction,
            hasMain: !!main_content,
            hasConclusion: !!conclusion,
            combinedLength: cleaned.length
          });
        } catch (error) {
          console.warn('[PublicLessonView] JSON parsing failed, treating as regular text:', error);
          // If JSON parsing fails, treat the content as regular text and clean it up
          cleaned = cleaned
            // Remove JSON structure indicators
            .replace(/^\{/, '')
            .replace(/\}$/, '')
            // Remove JSON key patterns
            .replace(/"introduction"\s*:\s*"/g, '')
            .replace(/"main_content"\s*:\s*"/g, '')
            .replace(/"conclusion"\s*:\s*"/g, '')
            .replace(/"content"\s*:\s*"/g, '')
            .replace(/""\s*:\s*"/g, '')
            // Remove trailing quotes and commas
            .replace(/",?\s*$/g, '')
            .replace(/",\s*"/g, '\n\n')
            .replace(/"/g, '')
            // Clean up any remaining JSON artifacts
            .replace(/\[object Object\]/g, '')
            .replace(/\[object\s+Object\]/g, '')
            // Normalize line breaks
            .replace(/\\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          
          console.log('[PublicLessonView] Converted malformed JSON to text:', {
            cleanedLength: cleaned.length,
            sampleContent: cleaned.substring(0, 200) + '...'
          });
        }
      }
      
      // Step 2: Remove all unwanted patterns in one pass
      cleaned = cleaned
        // Remove separator patterns
        .replace(/Content generation completed\./g, '')
        .replace(/\|\|\|---\|\|\|/g, '')
        .replace(/\|\|\|/g, '')
        // Remove JSON structure words - more comprehensive
        .replace(/\bintroduction\b/gi, '')
        .replace(/\bmain_content\b/gi, '')
        .replace(/\bconclusion\b/gi, '')
        .replace(/\bmain\b/gi, '')
        .replace(/\bintro\b/gi, '')
        .replace(/\bIntroduction\b/g, '')
        .replace(/\bMain Content\b/g, '')
        .replace(/\bConclusion\b/g, '')
        .replace(/\bMain\b/g, '')
        .replace(/\bIntro\b/g, '')
        // Remove additional JSON structure variations
        .replace(/\bINTRODUCTION\b/g, '')
        .replace(/\bMAIN_CONTENT\b/g, '')
        .replace(/\bCONCLUSION\b/g, '')
        .replace(/\bMAIN\b/g, '')
        .replace(/\bINTRO\b/g, '')
        // Remove JSON key patterns
        .replace(/"introduction":/gi, '')
        .replace(/"main_content":/gi, '')
        .replace(/"conclusion":/gi, '')
        .replace(/"main":/gi, '')
        .replace(/"intro":/gi, '')
        // Remove JSON artifacts and formatting issues
        .replace(/[{}]/g, '')  // Remove curly brackets
        .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
        .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
        .replace(/"/g, '"')  // Replace any remaining smart quotes
        .replace(/\[object Object\]/g, '')  // Remove [object Object] artifacts
        .replace(/\[object\s+Object\]/g, '')  // Remove [object Object] with spaces
        // Remove JSON key patterns with empty quotes - more comprehensive
        .replace(/""\s*:\s*/g, '')  // Remove "" : patterns
        .replace(/""\s*:/g, '')  // Remove "" : patterns
        .replace(/""\s*:\s*"/g, '')  // Remove "" : " patterns
        .replace(/""\s*:\s*""/g, '')  // Remove "" : "" patterns
        .replace(/,\s*""\s*:\s*"/g, '')  // Remove ,"" : " patterns
        .replace(/,\s*""\s*:\s*""/g, '')  // Remove ,"" : "" patterns
        .replace(/,\s*""\s*:/g, '')  // Remove ,"" : patterns
        // Remove standalone colons and commas that are not part of grammar
        .replace(/:\s*"/g, '')  // Remove : " patterns
        .replace(/,\s*"/g, '')  // Remove , " patterns
        .replace(/:\s*$/gm, '')  // Remove trailing colons at end of lines
        .replace(/,\s*$/gm, '')  // Remove trailing commas at end of lines
        // Fix line breaks and paragraph formatting
        .replace(/\\n/g, '\n')  // Convert \n to actual line breaks
        .replace(/\\n\\n/g, '\n\n')  // Convert \n\n to actual paragraph breaks
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // Normalize multiple line breaks to double
        .replace(/\n\s*\n/g, '\n\n')  // Normalize double line breaks
        .replace(/\n{3,}/g, '\n\n')  // Limit to max 2 consecutive line breaks
        // Normalize spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      // Step 3: Apply paragraph formatting
      cleaned = fixParagraphFormatting(cleaned);
      
      // Step 4: Apply markdown processing
      cleaned = fixMalformedMarkdown(cleaned);
      
      // Step 5: Final cleanup
      cleaned = cleanupRemainingAsterisks(cleaned);
      
      // Step 6: Final JSON artifact cleanup
      cleaned = cleaned
        // Final pass to remove any remaining JSON structure words
        .replace(/\bintroduction\b/gi, '')
        .replace(/\bmain_content\b/gi, '')
        .replace(/\bconclusion\b/gi, '')
        .replace(/\bmain\b/gi, '')
        .replace(/\bintro\b/gi, '')
        .replace(/\bIntroduction\b/g, '')
        .replace(/\bMain Content\b/g, '')
        .replace(/\bConclusion\b/g, '')
        .replace(/\bMain\b/g, '')
        .replace(/\bIntro\b/g, '')
        .replace(/\bINTRODUCTION\b/g, '')
        .replace(/\bMAIN_CONTENT\b/g, '')
        .replace(/\bCONCLUSION\b/g, '')
        .replace(/\bMAIN\b/g, '')
        .replace(/\bINTRO\b/g, '')
        // Remove any remaining JSON patterns
        .replace(/"introduction":/gi, '')
        .replace(/"main_content":/gi, '')
        .replace(/"conclusion":/gi, '')
        .replace(/"main":/gi, '')
        .replace(/"intro":/gi, '')
        // Remove all remaining JSON artifacts and formatting issues
        .replace(/[{}]/g, '')  // Remove curly brackets
        .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
        .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
        .replace(/"/g, '"')  // Replace any remaining smart quotes
        .replace(/\[object Object\]/g, '')  // Remove [object Object] artifacts
        .replace(/\[object\s+Object\]/g, '')  // Remove [object Object] with spaces
        // Remove JSON key patterns with empty quotes - more comprehensive
        .replace(/""\s*:\s*/g, '')  // Remove "" : patterns
        .replace(/""\s*:/g, '')  // Remove "" : patterns
        .replace(/""\s*:\s*"/g, '')  // Remove "" : " patterns
        .replace(/""\s*:\s*""/g, '')  // Remove "" : "" patterns
        .replace(/,\s*""\s*:\s*"/g, '')  // Remove ,"" : " patterns
        .replace(/,\s*""\s*:\s*""/g, '')  // Remove ,"" : "" patterns
        .replace(/,\s*""\s*:/g, '')  // Remove ,"" : patterns
        // Remove standalone colons and commas that are not part of grammar
        .replace(/:\s*"/g, '')  // Remove : " patterns
        .replace(/,\s*"/g, '')  // Remove , " patterns
        .replace(/:\s*$/gm, '')  // Remove trailing colons at end of lines
        .replace(/,\s*$/gm, '')  // Remove trailing commas at end of lines
        // Final paragraph break normalization
        .replace(/\\n\\n/g, '\n\n')  // Convert \n\n to actual paragraph breaks
        .replace(/\\n/g, '\n')  // Convert \n to actual line breaks
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // Normalize multiple line breaks to double
        .replace(/\n\s*\n/g, '\n\n')  // Normalize double line breaks
        .replace(/\n{3,}/g, '\n\n')  // Limit to max 2 consecutive line breaks
        // Final space normalization
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('[PublicLessonView] Content processing complete:', {
        finalLength: cleaned.length,
        hasContent: cleaned.trim().length > 0,
        sampleContent: cleaned.substring(0, 200) + '...'
      });
      
      return cleaned;
    };
    
    // Process content once
    return cleanContentOnce(content);
  };

  // Early return if no lesson
  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No lesson selected</p>
      </div>
    );
  }

  // Get lesson content and process with academic references
  let lessonContent = '';
  try {
    lessonContent = cleanAndCombineContent(lesson.content);
  } catch (error) {
    console.error('[PublicLessonView] Error processing lesson content:', error);
    lessonContent = typeof lesson.content === 'string' ? lesson.content : '';
  }
  
  // Use content with citations if available, otherwise use original content
  const displayContent = contentWithCitations || lessonContent;
  
  // Apply markdown parsing to the content
  let parsedContent = '';
  try {
    parsedContent = fixMalformedMarkdown(displayContent);
  } catch (error) {
    console.error('[PublicLessonView] Error parsing markdown:', error);
    parsedContent = displayContent || '';
  }
  
  // Final cleanup of any remaining JSON structure words after markdown processing
  const beforeCleanup = parsedContent;
  parsedContent = parsedContent
    // Remove any remaining JSON structure words that might have survived
    .replace(/\bintroduction\b/gi, '')
    .replace(/\bmain_content\b/gi, '')
    .replace(/\bconclusion\b/gi, '')
    .replace(/\bmain\b/gi, '')
    .replace(/\bintro\b/gi, '')
    .replace(/\bIntroduction\b/g, '')
    .replace(/\bMain Content\b/g, '')
    .replace(/\bConclusion\b/g, '')
    .replace(/\bMain\b/g, '')
    .replace(/\bIntro\b/g, '')
    .replace(/\bINTRODUCTION\b/g, '')
    .replace(/\bMAIN_CONTENT\b/g, '')
    .replace(/\bCONCLUSION\b/g, '')
    .replace(/\bMAIN\b/g, '')
    .replace(/\bINTRO\b/g, '')
    // Remove any remaining JSON patterns
    .replace(/"introduction":/gi, '')
    .replace(/"main_content":/gi, '')
    .replace(/"conclusion":/gi, '')
    .replace(/"main":/gi, '')
    .replace(/"intro":/gi, '')
    // Remove all curly brackets and quotes
    .replace(/[{}]/g, '')  // Remove curly brackets
    .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
    .replace(/[""]/g, '"')  // Replace smart quotes with standard quotes
    .replace(/"/g, '"')  // Replace any remaining smart quotes
    // Fix paragraph breaks and formatting
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Normalize multiple line breaks to double
    .replace(/\n\s*\n/g, '\n\n')  // Normalize double line breaks
    .replace(/\n{3,}/g, '\n\n')  // Limit to max 2 consecutive line breaks
    // Remove any remaining JSON artifacts
    .replace(/\[object Object\]/g, '')  // Remove [object Object] artifacts
    .replace(/\[object\s+Object\]/g, '')  // Remove [object Object] with spaces
    // Remove specific JSON patterns that are still appearing (more comprehensive)
    .replace(/""\s*:\s*""/g, '')  // Remove "" : "" patterns
    .replace(/""\s*:/g, '')  // Remove "" : patterns
    .replace(/:\s*""/g, '')  // Remove : "" patterns
    .replace(/,\s*""\s*:\s*""/g, '')  // Remove ,"" : "" patterns
    .replace(/,\s*""\s*:/g, '')  // Remove ,"" : patterns
    // Remove JSON patterns that are close to words
    .replace(/(\w)\s*""\s*:\s*""/g, '$1')  // Remove "" : "" after words
    .replace(/(\w)\s*""\s*:/g, '$1')  // Remove "" : after words
    .replace(/""\s*:\s*""\s*(\w)/g, '$1')  // Remove "" : "" before words
    .replace(/""\s*:\s*(\w)/g, '$1')  // Remove "" : before words
    // Remove any remaining quotes that are artifacts
    .replace(/^"/g, '')  // Remove leading quotes
    .replace(/"$/g, '')  // Remove trailing quotes
    .replace(/^,\s*/g, '')  // Remove leading commas
    .replace(/,\s*$/g, '')  // Remove trailing commas
    // Improve paragraph break handling (more aggressive)
    .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2')  // Add paragraph breaks after sentences
    .replace(/([.!?])\s*([A-Z][a-z])/g, '$1\n\n$2')  // Add paragraph breaks after sentences (no space)
    .replace(/\n\s*([A-Z][a-z])/g, '\n\n$1')  // Ensure proper spacing before capitalized words
    // Convert paragraph breaks to HTML
    .replace(/\n\n/g, '</p><p>')  // Convert double line breaks to paragraph tags
    .replace(/^([^<])/, '<p>$1')  // Wrap first paragraph
    .replace(/([^>])$/, '$1</p>')  // Wrap last paragraph
    // Final space normalization
    .replace(/\s+/g, ' ')
    .trim();
  
  // Debug logging to see if cleanup made a difference
  if (beforeCleanup !== parsedContent) {
    console.log('[PublicLessonView] Final cleanup removed JSON artifacts:', {
      beforeLength: beforeCleanup.length,
      afterLength: parsedContent.length,
      removed: beforeCleanup.length - parsedContent.length,
      sampleBefore: beforeCleanup.substring(0, 200) + '...',
      sampleAfter: parsedContent.substring(0, 200) + '...'
    });
  }
  
  // Create academic references footer
  let referencesFooter = null;
  try {
    if (academicReferences && academicReferences.length > 0) {
      referencesFooter = academicReferencesService.createReferencesFooter(academicReferences);
    }
  } catch (error) {
    console.warn('[PublicLessonView] Error creating references footer:', error);
    referencesFooter = null;
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
          
                  {/* Academic References Footer */}
        {referencesFooter && referencesFooter.references && (
          <AcademicReferencesFooter 
            references={referencesFooter.references}
            onCitationClick={handleCitationClick}
          />
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
