import React, { useState, useEffect, useRef, useCallback } from 'react';
import SimpleImageService from '../services/SimpleImageService';
import TTSService from '../services/TTSService';
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
  courseDescription 
}) => {
  const [imageData, setImageData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [view, setView] = useState('content'); // 'content' or 'flashcards'
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showFailMessage, setShowFailMessage] = useState(false);
  const [usedImageTitles, setUsedImageTitles] = useState(new Set());
  const [usedImageUrls, setUsedImageUrls] = useState(new Set());
  const [imageTitleCounts, setImageTitleCounts] = useState({});
  const [imageUrlCounts, setImageUrlCounts] = useState({});
  
  // Use singleton instances directly - both services are exported as singletons
  const ttsService = useRef(TTSService);
  const performanceMonitor = useRef(PerformanceMonitorService);
  const renderStartTime = useRef(performance.now());
  const abortControllerRef = useRef(null);

  // Get flashcards data
  const flashcardData = lesson?.flashcards || lesson?.content?.flashcards || [];

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      try {
        if (ttsService.current && typeof ttsService.current.stop === 'function') {
          ttsService.current.stop();
        }
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
    if (isPlaying || isPaused) {
      try {
        if (ttsService.current && typeof ttsService.current.stop === 'function') {
          ttsService.current.stop();
        }
      } catch (error) {
        console.warn('[PublicLessonView] TTS auto-pause error:', error);
      }
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [lesson?.id, isPlaying, isPaused]);

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

  const handlePlayAudio = useCallback(async () => {
    if (!lesson?.content) return;
    
    try {
      if (isPaused) {
        // Resume if paused
        if (ttsService.current && typeof ttsService.current.resume === 'function') {
          ttsService.current.resume();
          setIsPlaying(true);
          setIsPaused(false);
        }
      } else {
        // Start new reading
        setIsPlaying(true);
        setIsPaused(false);
        if (ttsService.current && typeof ttsService.current.readLesson === 'function') {
          const contentStr = cleanAndCombineContent(lesson.content);
          await ttsService.current.readLesson({ ...lesson, content: contentStr }, lesson.id);
        } else {
          console.warn('[PublicLessonView] TTS service not available');
        }
      }
    } catch (error) {
      console.error('[PublicLessonView] TTS error:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [lesson, isPaused]);

  const handleStopAudio = useCallback(() => {
    try {
      if (ttsService.current && typeof ttsService.current.stop === 'function') {
        ttsService.current.stop();
      }
    } catch (error) {
      console.warn('[PublicLessonView] TTS stop error:', error);
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const handlePauseResumeAudio = useCallback(() => {
    try {
      if (ttsService.current) {
        if (isPaused && typeof ttsService.current.resume === 'function') {
          ttsService.current.resume();
          setIsPaused(false);
        } else if (isPlaying && typeof ttsService.current.pause === 'function') {
          ttsService.current.pause();
          setIsPaused(true);
        }
      }
    } catch (error) {
      console.warn('[PublicLessonView] TTS pause/resume error:', error);
    }
  }, [isPlaying, isPaused]);

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
    if (!content) return '';
    if (typeof content === 'string') {
      const cleaned = fixMalformedMarkdown(
        content.replace(/Content generation completed\./g, '')
               .replace(/\|\|\|---\|\|\|/g, '')
               .trim()
      );
      return cleanupRemainingAsterisks(cleaned);
    }
    
    const { introduction, main_content, conclusion } = content;
    
    const cleanedIntro = introduction 
      ? cleanupRemainingAsterisks(fixMalformedMarkdown(introduction.replace(/Content generation completed\./g, '').trim()))
      : '';

    const cleanedMain = main_content ? cleanupRemainingAsterisks(fixMalformedMarkdown(main_content.trim())) : '';
    const cleanedConclusion = conclusion ? cleanupRemainingAsterisks(fixMalformedMarkdown(conclusion.trim())) : '';
    
    return [cleanedIntro, cleanedMain, cleanedConclusion]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\|\|\|---\|\|\|/g, '');
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
                         <button
               onClick={isPlaying || isPaused ? handleStopAudio : handlePlayAudio}
               className="p-2 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
               title={isPlaying ? "Pause audio" : isPaused ? "Resume audio" : "Play audio"}
             >
               {isPlaying ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               ) : isPaused ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                 </svg>
               )}
             </button>
            
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
