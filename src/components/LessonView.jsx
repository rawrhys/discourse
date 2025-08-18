import React, { useState, useEffect, useCallback, useMemo, memo, useRef, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatInterface from './ChatInterface';
import { useApiWrapper } from '../services/api';
import { API_BASE_URL, debugApiConfig, testBackendConnection } from '../config/api';
import LoadingIndicator from './LoadingIndicator';
import logger from '../utils/logger';
import SimpleImageService from '../services/SimpleImageService.js';
import Image from './Image.jsx';

import { privateTTSService } from '../services/TTSService.js';
import Flashcard from './Flashcard';
import { useThrottledLogger, useDebounce, useStableValue } from '../hooks/usePerformanceOptimization';
import performanceMonitor from '../services/PerformanceMonitorService';
import api from '../services/api.js';
import quizPersistenceService from '../services/QuizPersistenceService';
import markdownService from '../services/MarkdownService';

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

  // Add CSS classes for styling
  fixedText = fixedText
    // Add class to References headers
    .replace(/<h2>References<\/h2>/g, '<h2 class="references-header">References</h2>')
    // Add class to citation paragraphs
    .replace(/<p>\[(\d+)\]/g, '<p class="citation-item">[$1]')
    // Fix citations that are running together in the same paragraph
    .replace(/<p class="citation-item">\[(\d+)\](.*?)<\/p>\s*<p class="citation-item">\[(\d+)\]/g, 
             '<p class="citation-item">[$1]$2</p>\n\n<p class="citation-item">[$3]')
    // Ensure proper paragraph separation
    .replace(/<\/p>\s*<p class="citation-item">/g, '</p>\n\n<p class="citation-item">');

  return fixedText;
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

// Lazy load components
const LazyQuizView = lazy(() => import('./QuizView'));

// Memoized Loading component
const LoadingSpinner = memo(() => (
  <div className="flex justify-center items-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
));

// Memoized TTS Button component
const TTSButton = memo(({ isPlaying, isPaused, onToggle, isSupported }) => {
  if (!isSupported) {
    return (
      <button
        disabled
        className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-500 cursor-not-allowed transition-colors"
        title="Text-to-speech not supported in this browser"
      >
        <i className="fas fa-volume-mute mr-2"></i>Read Aloud
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        isPlaying || isPaused
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
      title={isPlaying ? 'Pause reading' : isPaused ? 'Resume reading' : 'Start reading aloud'}
    >
      <i className={`mr-2 ${isPlaying ? 'fas fa-pause' : isPaused ? 'fas fa-play' : 'fas fa-volume-up'}`}></i>
      {isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Read Aloud'}
    </button>
  );
});

TTSButton.propTypes = {
  isPlaying: PropTypes.bool.isRequired,
  isPaused: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  isSupported: PropTypes.bool.isRequired
};

// Memoized Content component to prevent unnecessary re-renders
const Content = memo(({ content, bibliography, lessonTitle, courseSubject }) => {
  const contentStr = typeof content === 'string' 
    ? content 
    : content?.main_content || '';

  if (!contentStr || contentStr.includes('Content generation failed')) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">Content generation failed. Please try again.</p>
      </div>
    );
  }

  // Use embedded bibliography from lesson data if available, otherwise fall back to separate service
  let finalBibliography = bibliography;
  if (!finalBibliography || finalBibliography.length === 0) {
    // Check if lesson has embedded bibliography data
    if (content && typeof content === 'object' && content.bibliography) {
      finalBibliography = content.bibliography;
    } else {
      // Fall back to API service bibliography generation
      finalBibliography = api.generateBibliography(lessonTitle, courseSubject, 5);
    }
  }

  // Apply markdown fix before rendering - use bibliography-aware parsing
  let fixedContent = contentStr.includes('## References') 
    ? markdownService.parseWithBibliography(contentStr)
    : fixMalformedMarkdown(contentStr);

  // Frontend-level fix for malformed References sections
  fixedContent = fixMalformedReferencesAtFrontend(fixedContent);

  // Append bibliography to the content if we have references and it's not already in the content
  if (finalBibliography && finalBibliography.length > 0 && !contentStr.includes('## References')) {
    const bibliographyMarkdown = api.formatBibliographyAsMarkdown(finalBibliography);
    fixedContent += bibliographyMarkdown;
  }

  // Debug logging for markdown processing
  if (process.env.NODE_ENV === 'development') {
    console.log('[LessonView] Content processing:', {
      original: contentStr?.substring(0, 200) + '...',
      fixed: fixedContent?.substring(0, 200) + '...',
      hasAsterisks: contentStr?.includes('**'),
      hasFixedAsterisks: fixedContent?.includes('**'),
      bibliographyCount: finalBibliography?.length || 0
    });
  }

  return (
    <div className="prose max-w-none lesson-content">
      <div 
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: fixedContent }}
      />
    </div>
  );
});

Content.propTypes = {
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  bibliography: PropTypes.array,
  lessonTitle: PropTypes.string,
  courseSubject: PropTypes.string
};

// Memoized Flashcard component to prevent unnecessary re-renders
const MemoizedFlashcard = memo(Flashcard);

// Memoized flashcard renderer with proper dependency tracking and performance monitoring
const FlashcardRenderer = memo(({ flashcards }) => {
  // Use throttled logger to prevent console spam
  const throttledLog = useThrottledLogger('FlashcardRenderer', 2);
  
  // Track component renders for performance monitoring
  useEffect(() => {
    performanceMonitor.trackComponentRender('FlashcardRenderer');
  });

  // Only log once per render to reduce console spam
  useEffect(() => {
    if (flashcards?.length > 0) {
      throttledLog('Rendering flashcards:', {
        count: flashcards.length,
        hasFlashcards: true
      });
    }
  }, [flashcards?.length, throttledLog]);

  if (process.env.NODE_ENV === 'development') {
    console.log('[FlashcardRenderer] Received flashcards:', {
      hasFlashcards: !!flashcards,
      count: flashcards?.length,
      data: flashcards
    });
  }

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 mb-4">No flashcards available for this lesson.</p>
        <p className="text-sm text-gray-500">Flashcard content will be generated automatically for new lessons.</p>
      </div>
    );
  }

  // Deduplicate flashcards based on the term - memoized to prevent recalculation
  const uniqueFlashcards = useMemo(() => {
    return Array.from(new Map(flashcards.map(card => [(card.term || '').toLowerCase(), card])).values());
  }, [flashcards]);

  // Only log deduplication once
  useEffect(() => {
    if (uniqueFlashcards.length !== flashcards.length) {
      throttledLog('Unique flashcards after deduplication:', {
        originalCount: flashcards.length,
        uniqueCount: uniqueFlashcards.length
      });
    }
  }, [uniqueFlashcards.length, flashcards.length, throttledLog]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {uniqueFlashcards.map((fc, index) => (
        <MemoizedFlashcard
          key={`${fc.term || 'unknown'}-${index}`}
          term={fc.term || 'Unknown Term'}
          definition={fc.definition || 'Definition not provided.'}
        />
      ))}
    </div>
  );
});

FlashcardRenderer.propTypes = {
  flashcards: PropTypes.array
};

// Main LessonView component with performance optimizations
const LessonView = ({ 
  lesson, 
  moduleTitle, 
  subject,
  onNextLesson,
  onPreviousLesson,
  currentLessonIndex = 0,
  totalLessonsInModule = 0,
  onUpdateLesson,
  activeModule, 
  handleModuleUpdate,
  usedImageTitles = [],
  usedImageUrls = [],
  imageTitleCounts = {},
  imageUrlCounts = {},
  courseId,
  courseDescription = null
}) => {
  const { user } = useAuth(); // Add this line to get the user
  const { lessonId: lessonIdFromParams } = useParams();
  const lessonId = lesson?.id || lessonIdFromParams;
  const [lessonState, setLessonState] = useState(lesson);
  const [view, setView] = useState('content');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [imageFallbackTried, setImageFallbackTried] = useState(false);
  
  // Manage used images as local state like PublicLessonView
  const [localUsedImageTitles, setLocalUsedImageTitles] = useState(new Set(usedImageTitles));
  const [localUsedImageUrls, setLocalUsedImageUrls] = useState(new Set(usedImageUrls));
  
  // Use the lesson prop as the main lesson data
  const propLesson = lesson;
  
  // Performance monitoring
  const renderStartTime = useRef(performance.now());
  
  // Use stable value hook to prevent unnecessary re-renders
  const stableLessonId = useStableValue(propLesson?.id);
  const stableFlashcardData = useStableValue(
    propLesson?.flashcards || propLesson?.content?.flashcards || [],
    (prev, curr) => {
      if (!prev || !curr) return prev !== curr;
      if (prev.length !== curr.length) return true;
      // Deep comparison for flashcards
      return prev.some((card, index) => 
        card.term !== curr[index]?.term || 
        card.definition !== curr[index]?.definition
      );
    }
  );

  // Use throttled logger for performance monitoring
  const throttledLog = useThrottledLogger('LessonView', 3);

  const normalizeImageUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return url;
    // Absolute URLs are used as-is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    let normalized = url;

    // Prevent double-prefixing: if the URL already starts with the API base, leave it unchanged
    const base = API_BASE_URL || '';
    if (base && normalized.startsWith(base)) {
      return normalized; // Already has prefix
    }

    // Ensure leading slash for root-relative paths
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;

    return `${base}${normalized}`;
  }, [API_BASE_URL]);
  
  // Reset image fallback flag when lesson changes
  useEffect(() => {
    setImageFallbackTried(false);
  }, [propLesson?.id]);
  
  // If the lesson's current image fails to load (e.g., legacy /images/*.jpg that no longer exists),
  // fetch a fresh remote image and update the lesson.
  const handleImageError = useCallback(async () => {
    if (imageFallbackTried) return;
    setImageFallbackTried(true);
    
    // Create AbortController for this fallback request
    const fallbackController = new AbortController();
    
    try {
      const result = await SimpleImageService.searchWithContext(
        propLesson?.title,
        subject, // Pass the course subject here
        cleanAndCombineContent(propLesson?.content),
        localUsedImageTitles,
        localUsedImageUrls,
        courseId,
        propLesson?.id || lessonId,
        courseDescription
      );
      
      // Check if request was aborted before setting state
      if (!fallbackController.signal.aborted && result && result.url) {
        console.log('[LessonView] Setting fallback image data:', result);
        setImageData({ ...result, url: normalizeImageUrl(result.url) });
        
        // Update local used image tracking when a new image is found
        if (result) {
          setLocalUsedImageTitles(prev => new Set([...prev, result.title]));
          setLocalUsedImageUrls(prev => new Set([...prev, result.url]));
        }
        
        if (onUpdateLesson && propLesson?.id) {
          onUpdateLesson(propLesson.id, { image: {
            imageTitle: result.title,
            imageUrl: result.url,
            pageURL: result.pageURL,
            attribution: result.attribution,
          }});
        }
      }
    } catch (e) {
      // Only handle errors if not aborted
      if (!fallbackController.signal.aborted) {
        console.warn('[LessonView] Image fallback error:', e);
      }
    }
    
    // Cleanup function to abort if component unmounts
    return () => fallbackController.abort();
  }, [imageFallbackTried, propLesson, usedImageTitles, usedImageUrls, courseId, lessonId, normalizeImageUrl, onUpdateLesson, subject]);
  
  const [imageData, setImageData] = useState(propLesson?.image ? {
    url: normalizeImageUrl(propLesson.image.imageUrl || propLesson.image.url),
    title: propLesson.image.imageTitle || propLesson.image.title,
    pageURL: propLesson.image.pageURL,
    attribution: propLesson.image.attribution,
    uploader: undefined,
  } : null);
  const [imageLoading, setImageLoading] = useState(false);
  const navigate = useNavigate();
  const context = useOutletContext();
  const [showFailMessage, setShowFailMessage] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // TTS state
  const [ttsStatus, setTtsStatus] = useState({
    isPlaying: false,
    isPaused: false,
    isSupported: privateTTSService.isSupported()
  });

  // Synchronize TTS service state with UI state
  useEffect(() => {
    const syncTTSState = () => {
      const serviceStatus = privateTTSService.getStatus();
      setTtsStatus(prev => ({
        ...prev,
        isPlaying: serviceStatus.isPlaying,
        isPaused: serviceStatus.isPaused,
        isSupported: serviceStatus.isSupported
      }));
    };

    // Sync immediately
    syncTTSState();

    // Set up interval to sync state periodically
    const intervalId = setInterval(syncTTSState, 500);

    return () => clearInterval(intervalId);
  }, []);

  // Comprehensive quiz and flashcard data extraction
  const quizData = useMemo(() => {
    // Check multiple possible locations for quiz data
    const quiz = propLesson?.quiz || 
                 propLesson?.content?.quiz || 
                 propLesson?.questions ||
                 propLesson?.assessment;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] Quiz data extraction:', {
        directQuiz: propLesson?.quiz,
        contentQuiz: propLesson?.content?.quiz,
        questions: propLesson?.questions,
        assessment: propLesson?.assessment,
        finalQuiz: quiz
      });
    }
    
    return quiz;
  }, [propLesson]);

  const flashcardData = useMemo(() => {
    // Check multiple possible locations for flashcard data
    const flashcards = propLesson?.flashcards || 
                      propLesson?.content?.flashcards || 
                      propLesson?.cards ||
                      propLesson?.studyCards;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] Flashcard data extraction:', {
        directFlashcards: propLesson?.flashcards,
        contentFlashcards: propLesson?.content?.flashcards,
        cards: propLesson?.cards,
        studyCards: propLesson?.studyCards,
        finalFlashcards: flashcards
      });
    }
    
    return flashcards;
  }, [propLesson]);

  // Memoized renderFlashcards function to prevent recreation on every render
  const renderFlashcards = useCallback(() => {
    // Track flashcard rendering for performance monitoring
    performanceMonitor.trackFlashcardRender();
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] renderFlashcards called with data:', flashcardData);
    }
    return <FlashcardRenderer flashcards={flashcardData} />;
  }, [flashcardData]);

  // Update lesson state when prop changes
  useEffect(() => {
    if (!propLesson) return;
    
    setLessonState(propLesson);
    setIsLoading(false);
    
    // Reset TTS if lesson changes
    if (propLesson?.id && privateTTSService.getStatus().currentLessonId !== propLesson.id) {
      privateTTSService.stop();
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [propLesson]);

  // Handle quiz completion with API submission and module unlock
  const handleQuizComplete = useCallback(
    async (score) => {
      if (!activeModule || !propLesson) return;

      // Save to localStorage immediately for persistence
      quizPersistenceService.saveQuizScore(courseId, propLesson.id, score, user?.id);

      try {
        // Submit quiz score to backend
        const response = await fetch('/api/quizzes/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            courseId: courseId,
            moduleId: activeModule.id,
            lessonId: propLesson.id,
            score: score
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[LessonView] Quiz submission result:', result);
        }

        // Update local lesson state
        if (onUpdateLesson) {
          onUpdateLesson(propLesson.id, { quizScore: score });
        }

        // Handle module completion
        if (result.moduleCompleted) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[LessonView] Module completed! Next module unlocked.');
          }
          // Trigger module update to refresh the course state
          if (handleModuleUpdate) {
            handleModuleUpdate();
          }
        }

        // Show success/failure message
        if (score === 5) {
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        } else {
          setShowFailMessage(true);
          setTimeout(() => setShowFailMessage(false), 3000);
        }

      } catch (error) {
        console.error('[LessonView] Error submitting quiz score:', error);
        // Fallback to local state update
        if (onUpdateLesson) {
          onUpdateLesson(propLesson.id, { quizScore: score });
        }
        
        if (score < 5) {
          setShowFailMessage(true);
          setTimeout(() => setShowFailMessage(false), 3000);
        }
      }
    },
    [activeModule, propLesson, onUpdateLesson, handleModuleUpdate]
  );

  // Memoized content to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => {
    if (!propLesson) return null;
    
    const contentStr = cleanAndCombineContent(propLesson.content);
    
    if (!contentStr || contentStr.includes('Content generation failed')) {
      return (
        <div className="text-center p-8">
          <p className="text-red-600 mb-4">Content generation failed. Please try again.</p>
        </div>
      );
    }
    
    return (
      <Content 
        content={contentStr} 
        lessonTitle={propLesson.title}
        courseSubject={subject || 'history'}
        bibliography={propLesson.bibliography}
      />
    );
  }, [propLesson, subject]);

  // Memoized quiz view to prevent unnecessary re-renders
  const memoizedQuizView = useMemo(() => {
    // Console logging disabled to prevent overload
    
    if (!quizData || quizData.length === 0) {
      console.warn('[LessonView] No quiz data available for lesson:', propLesson?.title);
      return (
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">No quiz questions available for this lesson.</p>
          <p className="text-sm text-gray-500">Quiz content will be generated automatically for new lessons.</p>
        </div>
      );
    }
    
    return (
      <LazyQuizView
        questions={quizData} // Use extracted quiz data
        onComplete={handleQuizComplete}
        lessonContent={propLesson.content}
        lessonTitle={propLesson.title}
        lessonId={propLesson.id}
        module={activeModule}
      />
    );
  }, [quizData, propLesson, activeModule, handleQuizComplete]);

  // Handle TTS toggle
  const handleTTSToggle = useCallback(async () => {
    if (!propLesson) return;
    
    const contentStr = cleanAndCombineContent(propLesson.content);
    
    // Get current TTS service status
    const serviceStatus = privateTTSService.getStatus();
    
    // Check if TTS service is ready for requests
    if (!privateTTSService.isReadyForRequests()) {
      console.log('[LessonView] TTS service not ready, attempting to reset...');
      privateTTSService.forceResetStoppingFlag();
      // Wait a moment for the reset to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      if (serviceStatus.isPlaying) {
        console.log('[LessonView] Attempting to pause TTS...');
        await privateTTSService.pause();
        
        // Wait a moment and check if pause was successful
        await new Promise(resolve => setTimeout(resolve, 100));
        const newStatus = privateTTSService.getStatus();
        
        if (newStatus.isPaused) {
          console.log('[LessonView] TTS paused successfully');
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: true }));
        } else {
          console.warn('[LessonView] TTS pause may not have worked, forcing state update');
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: true }));
        }
      } else if (serviceStatus.isPaused) {
        console.log('[LessonView] Attempting to resume TTS...');
        privateTTSService.resume();
        
        // Wait a moment and check if resume was successful
        await new Promise(resolve => setTimeout(resolve, 100));
        const newStatus = privateTTSService.getStatus();
        
        if (newStatus.isPlaying) {
          console.log('[LessonView] TTS resumed successfully');
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        } else {
          console.warn('[LessonView] TTS resume may not have worked, forcing state update');
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        }
      } else {
        console.log('[LessonView] Starting TTS...');
        // Use readLesson instead of speak
        const success = await privateTTSService.readLesson({ ...propLesson, content: contentStr }, propLesson.id);
        
        if (success) {
          console.log('[LessonView] TTS started successfully');
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        } else {
          console.warn('[LessonView] TTS start failed');
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        }
      }
    } catch (error) {
      console.error('[LessonView] Error in TTS toggle:', error);
      // Reset state on error
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [propLesson]);

  // Handle next lesson with TTS cleanup
  const handleNextLessonWithTTS = useCallback(() => {
    privateTTSService.stop();
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    if (onNextLesson) onNextLesson();
  }, [onNextLesson]);

  // Handle previous lesson with TTS cleanup
  const handlePreviousLessonWithTTS = useCallback(() => {
    privateTTSService.stop();
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    if (onPreviousLesson) onPreviousLesson();
  }, [onPreviousLesson]);

  // Handle tab change
  const handleTabChange = useCallback((newView) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] handleTabChange called with:', newView, 'current view:', view);
    }
    setView(newView);
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] View state updated to:', newView);
    }
  }, [view]);

  // Image handling effect
  useEffect(() => {
    let ignore = false;
    
    // If image is already present on lesson, use it
    if (propLesson?.image && (propLesson.image.imageUrl || propLesson.image.url)) {
      const existing = {
        url: normalizeImageUrl(propLesson.image.imageUrl || propLesson.image.url),
        title: propLesson.image.imageTitle || propLesson.image.title,
        pageURL: propLesson.image.pageURL,
        attribution: propLesson.image.attribution,
        uploader: undefined,
      };
      const currentTitle = existing.title;
      const currentUrl = existing.url;
      const appearsMoreThanOnce = (currentTitle && imageTitleCounts[currentTitle] > 1) || (currentUrl && imageUrlCounts[currentUrl] > 1);
      if (!appearsMoreThanOnce) {
        setImageData(existing);
        setImageLoading(false);
        return () => { ignore = true; };
      }
      // If duplicate, fall through to fetch a replacement
    }
    
    setImageLoading(true);
    setImageData(null);
    
    let abortController = new AbortController();
    
    async function fetchImage() {
      try {
        // Use the same simplified approach as PublicLessonView
        const result = await SimpleImageService.searchWithContext(
          propLesson.title,
          subject,
          cleanAndCombineContent(propLesson.content),
          localUsedImageTitles,
          localUsedImageUrls,
          courseId,
          propLesson?.id || lessonId,
          courseDescription
        );
        
        if (!ignore && !abortController.signal.aborted) {
          console.log('[LessonView] Setting image data:', result);
          setImageData(result ? { ...result, url: normalizeImageUrl(result.url) } : null);
          
          // Update local used image tracking when a new image is found
          if (result) {
            setLocalUsedImageTitles(prev => new Set([...prev, result.title]));
            setLocalUsedImageUrls(prev => new Set([...prev, result.url]));
          }
          
          // Persist replacement image into lesson if we fetched a new one
          if (result && onUpdateLesson && propLesson?.id) {
            onUpdateLesson(propLesson.id, { image: {
              imageTitle: result.title,
              imageUrl: result.url,
              pageURL: result.pageURL,
              attribution: result.attribution,
            }});
          }
        }
      } catch (e) {
        if (!ignore && !abortController.signal.aborted) {
          console.warn('[LessonView] Image fetch error:', e);
          setImageData(null);
        }
      } finally {
        if (!ignore && !abortController.signal.aborted) {
          setImageLoading(false);
        }
      }
    }
    
    // Run in background (non-blocking)
    fetchImage();
    
    return () => { 
      ignore = true;
      // Abort any pending request
      abortController.abort();
    };
  }, [propLesson, subject, courseId, courseDescription]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      privateTTSService.stop();
    };
  }, []);

  // Clean up any remaining malformed asterisks after content is rendered
  useEffect(() => {
    if (propLesson?.content) {
      const lessonContent = cleanAndCombineContent(propLesson.content);
      // Use a timeout to ensure the DOM is updated
      const timer = setTimeout(() => {
        const markdownElements = document.querySelectorAll('.lesson-content .markdown-body');
        markdownElements.forEach(element => {
          // Only clean up obvious malformed patterns, not entire paragraphs
          element.innerHTML = element.innerHTML
            .replace(/\*\*\*\*/g, '**')                // Clean up multiple asterisks
            .replace(/\*\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*\*/g, '**');
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [propLesson?.content]);

  // Performance monitoring (console logging disabled)
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    performanceMonitor.trackComponentRender('LessonView', renderTime);
    // Console logging disabled to prevent overload
  }, [propLesson?.id, view]); // Only track when lesson or view changes

  // Early return if no lesson
  if (!propLesson) {
    console.warn('[LessonView] No lesson provided');
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No lesson selected</p>
      </div>
    );
  }

  // Console logging disabled to prevent overload

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading lesson: {error}</p>
          <button
            onClick={() => setRetryCount(prev => prev + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Debug logging for image data
  console.log('[LessonView] Current imageData state:', imageData);
  console.log('[LessonView] imageLoading state:', imageLoading);
  
  return (
    <div className="flex-1 flex flex-col p-6 bg-white overflow-y-auto">
      <header className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">{propLesson?.title}</h2>
        <p className="text-md text-gray-600">{moduleTitle}</p>
        {imageLoading && (
          <div className="lesson-image-container loading">
            <div className="image-loading">Loading image...</div>
          </div>
        )}
        {imageData && imageData.url && !imageLoading && (
          <figure className="lesson-image-container" style={{ maxWidth: 700, margin: '0 auto' }}>
            <Image
              src={imageData.url}
              alt={propLesson?.title || 'Lesson illustration'}
              className="lesson-image"
              style={{ width: '100%', height: 'auto' }}
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
      </header>
      <div className="flex-grow">
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[LessonView] Switching to content view');
              }
              handleTabChange('content');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'content' 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <i className="fas fa-book-open mr-2"></i>Lesson
          </button>
          <button
            onClick={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[LessonView] Switching to quiz view');
              }
              handleTabChange('quiz');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'quiz' 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : propLesson.quizScores && propLesson.quizScores[user?.id] === 5
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={!quizData || quizData.length === 0}
          >
            <i className={`mr-2 ${propLesson.quizScores && propLesson.quizScores[user?.id] === 5 ? 'fas fa-check' : 'fas fa-question-circle'}`}></i>
            Quiz {quizData?.length ? `(${quizData.length})` : ''}
            {propLesson.quizScores && propLesson.quizScores[user?.id] === 5 && ' ✓'}
          </button>
          <button
            onClick={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[LessonView] Switching to flashcards view');
              }
              handleTabChange('flashcards');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'flashcards' 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={false}
          >
            <i className="fas fa-clone mr-2"></i>Flashcards {flashcardData?.length ? `(${flashcardData.length})` : ''}
          </button>
          <button
            onClick={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[LessonView] TTS toggle clicked');
              }
              handleTTSToggle();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              ttsStatus.isPlaying || ttsStatus.isPaused
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            disabled={!ttsStatus.isSupported}
            title={ttsStatus.isPlaying ? 'Pause reading' : ttsStatus.isPaused ? 'Resume reading' : 'Start reading aloud'}
          >
            <i className={'mr-2 ' + (ttsStatus.isPlaying ? 'fas fa-pause' : ttsStatus.isPaused ? 'fas fa-play' : 'fas fa-volume-up')}></i>
            {ttsStatus.isPlaying ? 'Pause' : ttsStatus.isPaused ? 'Resume' : 'Read Aloud'}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingSpinner />}>
            {view === 'content' && (
              <div>
                {memoizedContent}
              </div>
            )}
            {view === 'quiz' && (
              <div>
                {memoizedQuizView}
              </div>
            )}
            {view === 'flashcards' && (
              <div>
                {renderFlashcards()}
              </div>
            )}
          </Suspense>
        </div>
        {showFailMessage && (
          <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded text-center text-sm">
            To move to the next module, you must score 5/5 on all quizzes within this module.
          </div>
        )}
        {showSuccessMessage && (
          <div className="p-3 mb-4 bg-green-100 text-green-800 rounded text-center text-sm">
            Perfect Score! 🎉 Module progress updated successfully.
          </div>
        )}
        {propLesson.quizScores && propLesson.quizScores[user?.id] === 5 && !showSuccessMessage && (
          <div className="p-3 mb-4 bg-green-50 text-green-700 rounded text-center text-sm border border-green-200">
            <i className="fas fa-check-circle mr-2"></i>
            Quiz completed successfully! You scored 5/5 on this lesson.
          </div>
        )}
      </div>

      <footer className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={handlePreviousLessonWithTTS}
              disabled={currentLessonIndex === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <i className="fas fa-arrow-left mr-2"></i>Previous
            </button>
            <span className="text-sm text-gray-600 text-center">
              {currentLessonIndex + 1} / {Math.max(totalLessonsInModule, 1)}
            </span>
            <button
              onClick={handleNextLessonWithTTS}
              disabled={currentLessonIndex >= totalLessonsInModule - 1}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              Next<i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

LessonView.propTypes = {
  lesson: PropTypes.object.isRequired,
  moduleTitle: PropTypes.string,
  subject: PropTypes.string,
  onNextLesson: PropTypes.func,
  onPreviousLesson: PropTypes.func,
  currentLessonIndex: PropTypes.number,
  totalLessonsInModule: PropTypes.number,
  onUpdateLesson: PropTypes.func,
  activeModule: PropTypes.object,
  handleModuleUpdate: PropTypes.func,
  usedImageTitles: PropTypes.array,
  usedImageUrls: PropTypes.array,
  imageTitleCounts: PropTypes.object,
  imageUrlCounts: PropTypes.object,
  courseId: PropTypes.string
};

export default memo(LessonView);