import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    
    // Set flag to prevent TTS conflicts during lesson change
    isLessonChanging.current = true;
    console.log('[PublicLessonView] Lesson change detected, pausing TTS');
    
    // Stop TTS if it's currently playing or paused
    try {
      publicTTSService.stopAndClear();
      console.log('[PublicLessonView] Stopped and cleared TTS on lesson change');
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
    
    // Clear the flag after a delay to ensure TTS has fully settled
    setTimeout(() => {
      isLessonChanging.current = false;
      console.log('[PublicLessonView] Lesson change flag cleared, TTS can resume');
    }, 2000); // 2 seconds to match TTS service timing
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
            }, 500); // Increased debounce to 500ms
        }
      } catch (error) {
        console.warn('[PublicLessonView] TTS state sync error:', error);
      }
    }, 2000); // Increased to 2 seconds to reduce rapid changes

    return () => {
      clearInterval(interval);
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]);

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
          lesson.content,
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
    };
  }, []);

  const handlePlayAudio = useCallback(async () => {
    if (!lesson?.content) return;
    
    // Prevent TTS during lesson changes
    if (isLessonChanging.current) {
      console.log('[PublicLessonView] Skipping TTS request during lesson change');
      return;
    }
    
    // Prevent starting TTS if it's already playing
    if (ttsStatus.isPlaying) {
      console.log('[PublicLessonView] TTS already playing, ignoring request');
      return;
    }
    
    try {
      if (ttsStatus.isPaused) {
        // Resume if paused
        publicTTSService.resume();
        setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
      } else {
        // Start new reading
        const contentStr = cleanAndCombineContent(lesson.content);
        
        // Validate content before attempting TTS
        if (!contentStr || typeof contentStr !== 'string' || contentStr.trim().length < 10) {
          console.warn('[PublicLessonView] Content too short or invalid for TTS:', {
            hasContent: !!contentStr,
            type: typeof contentStr,
            length: contentStr ? contentStr.length : 0,
            trimmedLength: contentStr ? contentStr.trim().length : 0
          });
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
          return;
        }
        
        const started = await publicTTSService.readLesson({ ...lesson, content: contentStr }, lesson.id);
        
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
  }, [lesson?.id, lesson?.content, ttsStatus.isPaused, ttsStatus.isPlaying]); // More specific dependencies

  const handleStopAudio = useCallback(() => {
    try {
      publicTTSService.stop();
    } catch (error) {
      console.warn('[PublicLessonView] TTS stop error:', error);
    }
    // Always reset state when stopping
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  }, []);

  const handlePauseResumeAudio = useCallback(() => {
    try {
      if (ttsStatus.isPaused) {
        publicTTSService.resume();
        setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
      } else if (ttsStatus.isPlaying) {
        publicTTSService.pause();
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

  // Helper function to clean and combine lesson content
  const cleanAndCombineContent = (content) => {
    if (!content) {
      console.warn('[PublicLessonView] No content provided to cleanAndCombineContent');
      return '';
    }
    
    if (typeof content === 'string') {
      const cleaned = fixMalformedMarkdown(
        content.replace(/Content generation completed\./g, '')
               .replace(/\|\|\|---\|\|\|/g, '')
               .trim()
      );
      const result = cleanupRemainingAsterisks(cleaned);
      console.log('[PublicLessonView] String content processed:', {
        originalLength: content.length,
        cleanedLength: result.length,
        hasContent: result.trim().length > 0
      });
      return result;
    }
    
    const { introduction, main_content, conclusion } = content;
    
    const cleanedIntro = introduction 
      ? cleanupRemainingAsterisks(fixMalformedMarkdown(introduction.replace(/Content generation completed\./g, '').trim()))
      : '';

    const cleanedMain = main_content ? cleanupRemainingAsterisks(fixMalformedMarkdown(main_content.trim())) : '';
    const cleanedConclusion = conclusion ? cleanupRemainingAsterisks(fixMalformedMarkdown(conclusion.trim())) : '';
    
    const result = [cleanedIntro, cleanedMain, cleanedConclusion]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\|\|\|---\|\|\|/g, '');
      
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
  
  // Process the content for rendering
  let fixedContent = lessonContent;
  
  // Add bibliography if available
  if (lesson.bibliography && lesson.bibliography.length > 0) {
    const bibliographyMarkdown = '\n\n## References\n\n' + 
      lesson.bibliography.map((ref, index) => `[${index + 1}] ${ref}`).join('\n\n');
    fixedContent += bibliographyMarkdown;
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
            onClick={ttsStatus.isPlaying ? handlePauseResumeAudio : ttsStatus.isPaused ? handlePauseResumeAudio : handlePlayAudio}
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
               dangerouslySetInnerHTML={{ __html: fixedContent }}
             />
           </div>
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
