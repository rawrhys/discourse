import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import SimpleImageService from '../services/SimpleImageService';
import imagePreloadService from '../services/ImagePreloadService';
import lessonImagePreloader from '../services/LessonImagePreloader';
import imagePerformanceMonitor from '../services/ImagePerformanceMonitor';
import { publicTTSService } from '../services/TTSService';
import PerformanceMonitorService from '../services/PerformanceMonitorService';
const performanceMonitor = PerformanceMonitorService;
import markdownService from '../services/MarkdownService';
import academicReferencesService from '../services/AcademicReferencesService';
import { fixMalformedContent, formatContentForDisplay, cleanContentFormatting, validateContent, stripSectionKeys, getContentAsString } from '../utils/contentFormatter';
import AcademicReferencesFooter from './AcademicReferencesFooter';

// Import test utilities for development
if (process.env.NODE_ENV === 'development') {
  import('../utils/testContentFormatter.js').then(module => {
    module.runContentFormatterTests();
  });
}
import Flashcard from './Flashcard';
import Image from './Image.jsx';
import './LessonView.css';

// Add CSS for proper paragraph spacing in public lesson view
const publicLessonStyles = `
  .lesson-content-text p {
    margin-top: 1.5rem !important;
    margin-bottom: 1.5rem !important;
    line-height: 1.8 !important;
    color: #374151 !important;
    text-align: justify !important;
    display: block !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  .lesson-content-text p:first-child {
    margin-top: 0 !important;
  }
  
  .lesson-content-text p:last-child {
    margin-bottom: 0 !important;
  }
  
  .lesson-content-text {
    line-height: 1.7 !important;
  }
  
  .lesson-content-text h1,
  .lesson-content-text h2,
  .lesson-content-text h3,
  .lesson-content-text h4,
  .lesson-content-text h5,
  .lesson-content-text h6 {
    margin-top: 2rem !important;
    margin-bottom: 1rem !important;
    line-height: 1.4 !important;
    color: #1f2937 !important;
    font-weight: 600 !important;
  }
  
  /* Ensure proper paragraph breaks */
  .lesson-content-text > * {
    margin-bottom: 1.5rem !important;
  }
  
  .lesson-content-text > *:last-child {
    margin-bottom: 0 !important;
  }
  
  /* Force paragraph spacing even if CSS is overridden */
  .lesson-content-text p + p {
    margin-top: 1.5rem !important;
  }
  
  /* Ensure proper spacing after headers */
  .lesson-content-text h1 + p,
  .lesson-content-text h2 + p,
  .lesson-content-text h3 + p,
  .lesson-content-text h4 + p,
  .lesson-content-text h5 + p,
  .lesson-content-text h6 + p {
    margin-top: 1rem !important;
  }
  
  /* Enhanced line break styling */
  .lesson-content-text br {
    display: block !important;
    content: "" !important;
    margin: 0.5rem 0 !important;
  }
  
  /* Double line breaks for sentence endings */
  .lesson-content-text br + br {
    margin: 1rem 0 !important;
  }
  
  /* Force paragraph spacing even if CSS is overridden */
  .lesson-content-text p {
    margin-top: 1.5rem !important;
    margin-bottom: 1.5rem !important;
    line-height: 1.8 !important;
    color: #374151 !important;
    text-align: justify !important;
    display: block !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  /* Ensure proper spacing between paragraphs */
  .lesson-content-text p + p {
    margin-top: 2rem !important;
  }
  
  /* Ensure proper spacing after headers */
  .lesson-content-text h1 + p,
  .lesson-content-text h2 + p,
  .lesson-content-text h3 + p,
  .lesson-content-text h4 + p,
  .lesson-content-text h5 + p,
  .lesson-content-text h6 + p {
    margin-top: 1.5rem !important;
  }
  
  /* Ensure proper spacing before headers */
  .lesson-content-text p + h1,
  .lesson-content-text p + h2,
  .lesson-content-text p + h3,
  .lesson-content-text p + h4,
  .lesson-content-text p + h5,
  .lesson-content-text p + h6 {
    margin-top: 2.5rem !important;
  }
  
  /* Override any conflicting styles */
  .lesson-content-text .markdown-body p {
    margin-top: 1.5rem !important;
    margin-bottom: 1.5rem !important;
    line-height: 1.8 !important;
    color: #374151 !important;
    text-align: justify !important;
    display: block !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  /* Ensure proper text wrapping and readability */
  .lesson-content-text {
    max-width: 100% !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    hyphens: auto !important;
  }
  
  /* Improve readability for long paragraphs */
  .lesson-content-text p {
    max-width: 65ch !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  
  /* Enhanced horizontal rule styling for section breaks */
  .lesson-content-text hr {
    border: none !important;
    height: 2px !important;
    background: linear-gradient(to right, transparent, #e5e7eb, transparent) !important;
    margin: 3rem auto !important;
    max-width: 80% !important;
  }
  
  /* Section header styling */
  .lesson-content-text h2 {
    color: #1f2937 !important;
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    margin-top: 3rem !important;
    margin-bottom: 1.5rem !important;
    text-align: center !important;
    border-bottom: 2px solid #e5e7eb !important;
    padding-bottom: 0.5rem !important;
  }
  
  /* First section header should not have top margin */
  .lesson-content-text h2:first-of-type {
    margin-top: 0 !important;
  }
  
  /* Custom section header styling */
  .lesson-content-text .section-header {
    color: #1f2937 !important;
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    margin-top: 3rem !important;
    margin-bottom: 1.5rem !important;
    text-align: center !important;
    border-bottom: 2px solid #e5e7eb !important;
    padding-bottom: 0.5rem !important;
  }
  
  /* Custom section divider styling */
  .lesson-content-text .section-divider {
    border: none !important;
    height: 2px !important;
    background: linear-gradient(to right, transparent, #e5e7eb, transparent) !important;
    margin: 3rem auto !important;
    max-width: 80% !important;
  }
`;

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

  // Clean up any remaining malformed asterisks after content is rendered (optimized for performance)
  useEffect(() => {
    if (lesson?.content) {
      // Use requestIdleCallback for better performance if available, otherwise use timeout
      const cleanupFunction = () => {
        const markdownElements = document.querySelectorAll('.lesson-content .markdown-body');
        markdownElements.forEach(element => {
          element.innerHTML = element.innerHTML
            .replace(/\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*/g, '**')
            .replace(/\*\*\*\*\*\*/g, '**');
        });
      };
      
      if (window.requestIdleCallback) {
        const idleId = requestIdleCallback(cleanupFunction, { timeout: 1000 });
        return () => window.cancelIdleCallback(idleId);
      } else {
        const timer = setTimeout(cleanupFunction, 100);
        return () => clearTimeout(timer);
      }
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

  // Start image performance monitoring
  useEffect(() => {
    try {
      imagePerformanceMonitor.startPerformanceMonitoring();
      console.log('[PublicLessonView] Image performance monitoring started');
    } catch (error) {
      console.warn('[PublicLessonView] Failed to start image performance monitoring:', error);
    }
  }, []);

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
      // Only reset if stop fails, but don't clear the stopped state
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
              
              // Only update if the service is actually in a different state
              // This prevents unnecessary re-renders that might trigger other effects
              setTtsStatus(prev => {
                if (prev.isPlaying === serviceStatus.isPlaying && prev.isPaused === serviceStatus.isPaused) {
                  return prev; // No change needed
                }
                return {
                  ...prev,
                  isPlaying: serviceStatus.isPlaying,
                  isPaused: serviceStatus.isPaused
                };
              });
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

  // Handle image loading for public courses (simplified) - with debounce
  useEffect(() => {
    if (!lesson?.title) return;

    let ignore = false;
    setImageLoading(true);
    setImageData(null);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Add debounce to prevent rapid successive searches
    const timeoutId = setTimeout(async function fetchImage() {
      const startTime = performance.now();
      
      // Check if we already have a cached result for this lesson
      if (imageData && imageData.url && imageData.title) {
        console.log('[PublicLessonView] Using existing image data, skipping fetch');
        setImageLoading(false);
        return;
      }

      // Check if we have a preloaded image
      const preloadedImage = lessonImagePreloader.getPreloadedImage(lesson.id, lesson.title, subject);
      if (preloadedImage) {
        console.log('[PublicLessonView] Using preloaded image data:', preloadedImage.title);
        setImageData(preloadedImage);
        setImageLoading(false);
        return;
      }
      
      try {
        // For public courses, use a simplified image search
        const result = await SimpleImageService.searchWithContext(
          lesson.title,
          subject,
          cleanAndCombineContent(lesson.content),
          Array.from(usedImageTitles), // Convert Set to Array
          Array.from(usedImageUrls),   // Convert Set to Array
          courseId,
          lesson.id,
          courseDescription
        );
        
        // Track image fetch performance
        const fetchTime = performance.now() - startTime;
        if (result && result.url) {
          performanceMonitor.trackImageLoad(result.url, fetchTime, false);
        }
        
        // Log slow image fetches
        if (fetchTime > 2000) {
          console.warn('[PublicLessonView] Slow image fetch detected:', fetchTime + 'ms');
        }
        
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
    }, 300); // 300ms debounce
    
    return () => { 
      ignore = true;
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [lesson?.id, lesson?.title, subject, courseId]); // Only depend on stable values

  // Start preloading lesson image as soon as lesson data is available
  useEffect(() => {
    if (!lesson || !subject || !courseId) return;

    // Start preloading in background immediately
    const startPreload = async () => {
      try {
        console.log('[PublicLessonView] Starting background image preload for:', lesson.title);
        await lessonImagePreloader.preloadLessonImage(
          lesson,
          subject,
          courseId,
          Array.from(usedImageTitles),
          Array.from(usedImageUrls),
          courseDescription
        );
      } catch (error) {
        console.warn('[PublicLessonView] Background preload error:', error);
      }
    };

    startPreload();
  }, [lesson?.id, lesson?.title, subject, courseId]);

  // Preload current lesson image for better performance (public courses) - optimized
  useEffect(() => {
    if (!lesson || !lesson.image) return;

    const imageUrl = lesson.image.imageUrl || lesson.image.url;
    if (!imageUrl) return;

    // Only preload if not already preloaded and not already loaded
    if (!imagePreloadService.isPreloaded(imageUrl) && !imageData?.url) {
      const preloadCurrentImage = async () => {
        const startTime = performance.now();
        try {
          // Preload the current lesson's image with high priority
          await imagePreloadService.preloadLessonImages(lesson, 10);
          console.log('[PublicLessonView] Preloaded current lesson image');
          
          // Track performance
          const preloadTime = performance.now() - startTime;
          performanceMonitor.trackImageLoad(imageUrl, preloadTime, true);
        } catch (error) {
          console.warn('[PublicLessonView] Image preloading error:', error);
        }
      };

      // Run preloading in background
      preloadCurrentImage();
    } else {
      console.log('[PublicLessonView] Image already preloaded or loaded, skipping preload');
    }
  }, [lesson?.id, lesson?.image, imageData?.url]);

  // Academic references state (optimized with useMemo)
  const [highlightedCitation, setHighlightedCitation] = useState(null);

  // Memoize academic references to prevent regeneration on every render
  const academicReferences = useMemo(() => {
    if (!lesson?.content || !subject || !lesson?.title) return [];
    
    try {
      console.log('[PublicLessonView] Generating academic references for:', lesson.title);
      
      // Ensure lesson.content is a string - use content formatter to strip keys
      const lessonContentString = typeof lesson.content === 'string' 
        ? getContentAsString(lesson.content)
        : getContentAsString(lesson.content);
      
      // Only generate if content is substantial
      if (lessonContentString.length < 100) return [];
      
      // Debug logging - reduced frequency
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.05) { // Reduced to 5% frequency
        console.log('[PublicLessonView] Content processing debug:', {
          originalContentType: typeof lesson.content,
          originalContentLength: typeof lesson.content === 'string' ? lesson.content.length : 'object',
          lessonContentStringLength: lessonContentString.length,
          hasIntroductionKey: lessonContentString.includes('"introduction":'),
          hasMainContentKey: lessonContentString.includes('"main_content":'),
          hasConclusionKey: lessonContentString.includes('"conclusion":')
        });
      }
      
      // Generate academic references
      const references = academicReferencesService.generateReferences(
        lessonContentString,
        subject,
        lesson.title
      );
      
      console.log('[PublicLessonView] Academic references generated:', {
        referencesCount: references.length,
        hasCitations: !!references.length
      });
      
      return references;
    } catch (error) {
      console.error('[PublicLessonView] Error generating academic references:', error);
      return [];
    }
  }, [lesson?.content, subject, lesson?.title]);

  // Memoize content with citations to prevent regeneration on every render
  const contentWithCitations = useMemo(() => {
    if (!lesson?.content || !academicReferences.length) return '';
    
    try {
      const lessonContentString = typeof lesson.content === 'string' 
        ? getContentAsString(lesson.content)
        : getContentAsString(lesson.content);
      
      // Generate content with inline citations
      const { content: contentWithInlineCitations } = academicReferencesService.generateInlineCitations(
        lessonContentString,
        academicReferences
      );
      
      return contentWithInlineCitations;
    } catch (error) {
      console.error('[PublicLessonView] Error generating content with citations:', error);
      return '';
    }
  }, [lesson?.content, academicReferences]);

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
        // Don't call reset() after stop() - this clears the stopped state and allows restarts
        console.log('[PublicLessonView] Cleaned up TTS service on unmount (stopped without reset)');
      } catch (error) {
        console.warn('[PublicLessonView] Error cleaning up TTS service:', error);
        // Only reset if stop fails, but don't clear the stopped state
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
    
    // Guard against automatic calls - only allow manual button clicks
    console.log('[PublicLessonView] handleStartAudio called - manual start only');
    
    // Check if TTS service has been stopped - if so, restart it
    const serviceStatus = publicTTSService.getStatus();
    if (serviceStatus.isStopped) {
      console.log('[PublicLessonView] TTS service was stopped, restarting service...');
      try {
        const restartSuccess = await publicTTSService.restart();
        if (!restartSuccess) {
          console.error('[PublicLessonView] Failed to restart TTS service');
          return;
        }
        console.log('[PublicLessonView] TTS service restarted successfully');
      } catch (error) {
        console.error('[PublicLessonView] Failed to restart TTS service:', error);
        return;
      }
    }
    
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
          // Use the new content formatter to handle malformed JSON and strip section keys
          contentToRead = getContentAsString(lesson.content);
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
  }, [view, lesson]); // Removed ttsStatus dependencies to prevent auto-restart

  const handleStopAudio = useCallback(async () => {
    console.log('[PublicLessonView] handleStopAudio called');
    
    try {
      // Stop the TTS service
      await publicTTSService.stop();
      console.log('[PublicLessonView] TTS stop completed successfully');
      
      // Don't call reset() after stop() - this clears the stopped state and allows restarts
      console.log('[PublicLessonView] TTS service stopped (without reset to preserve stopped state)');
      
      // Always reset state when stopping
      setTtsStatus(prev => ({ 
        ...prev, 
        isPlaying: false, 
        isPaused: false 
      }));
      
      console.log('[PublicLessonView] TTS state reset to stopped');
    } catch (error) {
      console.warn('[PublicLessonView] TTS stop error:', error);
      
      // Only reset if stop fails, but don't clear the stopped state
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

  // Enhanced content preprocessing for better line breaks and formatting
  const preprocessContentForDisplay = (content) => {
    if (!content || typeof content !== 'string') return content;
    
    return content
      // Preserve section breaks and horizontal rules
      .replace(/\n\n---\n\n/g, '\n\n<hr>\n\n') // Convert markdown horizontal rules to HTML
      // Preserve intentional line breaks
      .replace(/\n\n+/g, '\n\n') // Normalize multiple newlines to double newlines
      .replace(/\n/g, '  \n') // Convert single newlines to markdown line breaks (two spaces + newline)
      // Add spacing around headers for better readability
      .replace(/(^|\n)(#{1,6}\s+)/g, '\n\n$2')
      .replace(/(#{1,6}.*?)(\n|$)/g, '$1\n\n')
      // Ensure proper spacing around horizontal rules
      .replace(/(<hr>)/g, '\n\n$1\n\n')
      // Clean up excessive spacing
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  };

  // Custom markdown parsing that preserves section structure
  const parseWithSectionPreservation = (content) => {
    if (!content || typeof content !== 'string') return content;
    
    // First, let's preserve our section markers by temporarily replacing them
    let processedContent = content
      // Temporarily replace section headers to protect them
      .replace(/## Introduction/g, '___SECTION_INTRO___')
      .replace(/## Main Content/g, '___SECTION_MAIN___')
      .replace(/## Conclusion/g, '___SECTION_CONCL___')
      // Temporarily replace horizontal rules
      .replace(/\n\n---\n\n/g, '___HORIZONTAL_RULE___');
    
    // Apply the standard markdown parsing
    processedContent = fixMalformedMarkdown(processedContent);
    
    // Restore our section markers as proper HTML
    processedContent = processedContent
      .replace(/___SECTION_INTRO___/g, '<h2 class="section-header">Introduction</h2>')
      .replace(/___SECTION_MAIN___/g, '<h2 class="section-header">Main Content</h2>')
      .replace(/___SECTION_CONCL___/g, '<h2 class="section-header">Conclusion</h2>')
      .replace(/___HORIZONTAL_RULE___/g, '<hr class="section-divider">');
    
    return processedContent;
  };

  // Helper function to clean and combine lesson content (copied from working LessonView)
  const cleanAndCombineContent = (content) => {
    if (!content) return '';
    
    // Helper function to clean individual content parts (without markdown processing)
    const cleanContentPart = (part) => {
      if (!part) return '';
      
      // Only clean separator patterns, don't apply markdown processing yet
      let cleaned = part
        .replace(/Content generation completed\./g, '')
        .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
        .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
        .trim();
      
      // Clean up remaining asterisks
      cleaned = cleanupRemainingAsterisks(cleaned);
      
      return cleaned;
    };
    
    if (typeof content === 'string') {
      const cleaned = cleanContentPart(content);
      
      // Final separator cleanup after all processing
      const finalResult = cleaned
        .replace(/\|\|\|---\|\|\|/g, '')
        .replace(/\|\|\|/g, '');
      
      return finalResult;
    }
    
    const { introduction, main_content, conclusion } = content;
    
    const cleanedIntro = introduction 
      ? cleanContentPart(introduction)
      : '';

    const cleanedMain = main_content ? cleanContentPart(main_content) : '';
    const cleanedConclusion = conclusion ? cleanContentPart(conclusion) : '';
    
    // Create sections with clear section headers and proper spacing
    const sections = [];
    
    if (cleanedIntro) {
      sections.push(`## Introduction\n\n${cleanedIntro}`);
    }
    
    if (cleanedMain) {
      sections.push(`## Main Content\n\n${cleanedMain}`);
    }
    
    if (cleanedConclusion) {
      sections.push(`## Conclusion\n\n${cleanedConclusion}`);
    }
    
    const result = sections.join('\n\n---\n\n')
      .replace(/\|\|\|---\|\|\|/g, '') // Final cleanup of any remaining patterns
      .replace(/\|\|\|/g, ''); // Final cleanup of any remaining ||| patterns
    
    // Final separator cleanup after all processing
    return result
      .replace(/\|\|\|---\|\|\|/g, '')
      .replace(/\|\|\|/g, '');
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
    // Use the same content processing approach as private LessonView
    lessonContent = cleanAndCombineContent(lesson.content);
    
    // Debug logging for main content processing - reduced frequency
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) { // Only log 10% of the time
      console.log('[PublicLessonView] Main content processing:', {
        originalContentType: typeof lesson.content,
        lessonContentLength: lessonContent.length,
        hasContent: !!lessonContent,
        isEmpty: lessonContent.trim() === ''
      });
    }
  } catch (error) {
    console.error('[PublicLessonView] Error processing lesson content:', error);
    lessonContent = typeof lesson.content === 'string' ? lesson.content : '';
  }
  
  // Use content with citations if available, otherwise use original content
  const displayContent = contentWithCitations 
    ? (contentWithCitations.includes('"introduction":') || contentWithCitations.includes('"main_content":') || contentWithCitations.includes('"conclusion":'))
      ? cleanAndCombineContent(contentWithCitations)
      : contentWithCitations
    : lessonContent;
  
  // Debug logging for display content - reduced frequency
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) { // Only log 10% of the time
    console.log('[PublicLessonView] Display content processing:', {
      hasContentWithCitations: !!contentWithCitations,
      contentWithCitationsLength: contentWithCitations ? contentWithCitations.length : 0,
      lessonContentLength: lessonContent.length,
      displayContentLength: displayContent.length,
      hasContent: !!displayContent,
      isEmpty: displayContent.trim() === ''
    });
  }
  
  // Apply markdown parsing to the content (same approach as private LessonView)
  let parsedContent = '';
  try {
    // Preprocess content for better line breaks and formatting
    let processedContent = preprocessContentForDisplay(displayContent);
    
    // Debug the preprocessing step
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] Preprocessing debug:', {
        originalLength: displayContent.length,
        processedLength: processedContent.length,
        hasSectionHeaders: processedContent.includes('## Introduction') || processedContent.includes('## Main Content') || processedContent.includes('## Conclusion'),
        hasHorizontalRules: processedContent.includes('---'),
        processedPreview: processedContent.substring(0, 300) + '...'
      });
    }
    
    // Remove in-text citations first, then apply markdown fix
    let fixedContent = markdownService.removeInTextCitations(processedContent);
    
    // Apply markdown fix after citation removal - use bibliography-aware parsing
    fixedContent = fixedContent.includes('## References') 
      ? markdownService.parseWithBibliography(fixedContent)
      : fixMalformedMarkdown(fixedContent);

    // Frontend-level fix for malformed References sections
    fixedContent = fixMalformedReferencesAtFrontend(fixedContent);
    
    // Apply markdown parsing to the fixed content
    parsedContent = parseWithSectionPreservation(fixedContent);
    
          // Enhanced paragraph structure and line break formatting
      if (parsedContent) {
        // Force paragraph breaks for better readability
        parsedContent = parsedContent
          // Ensure proper spacing between paragraphs
          .replace(/<\/p>\s*<p>/g, '</p>\n\n<p>')
          .replace(/<\/p>\s*<h/g, '</p>\n\n<h')
          .replace(/<\/h[1-6]>\s*<p>/g, '</h$1>\n\n<p>')
          // Ensure proper spacing around horizontal rules
          .replace(/<\/p>\s*<hr[^>]*>\s*<p>/g, '</p>\n\n<hr>\n\n<p>')
          // FORCE REMOVE line breaks after circa abbreviations
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})/g, 'c. $1') // Remove <br> after c.
          .replace(/c\.\s*<br[^>]*>\s*<br[^>]*>\s*(\d{4})/g, 'c. $1') // Remove double <br> after c.
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s*–\s*(\d{4})/g, 'c. $1–$2') // Remove <br> in date ranges
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s*-\s*(\d{4})/g, 'c. $1-$2') // Remove <br> in date ranges (hyphen)
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+BCE/g, 'c. $1 BCE') // Remove <br> before BCE
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+CE/g, 'c. $1 CE') // Remove <br> before CE
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+BC/g, 'c. $1 BC') // Remove <br> before BC
          .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+AD/g, 'c. $1 AD') // Remove <br> before AD
          // Clean up excessive whitespace
          .replace(/\n{3,}/g, '\n\n');
      
      // If the content doesn't have paragraph tags, add them
      if (!parsedContent.includes('<p>')) {
        // Split by double newlines and wrap each section in <p> tags
        const paragraphs = parsedContent.split(/\n\n+/).filter(p => p.trim());
        parsedContent = paragraphs.map(p => {
          // Add line breaks within paragraphs for better readability
          const formattedParagraph = p.trim()
            .replace(/\n/g, '<br>') // Convert single newlines to <br> tags
            .replace(/([.!?])\s+/g, '$1<br><br>') // Add double line breaks after sentences
            .replace(/<br><br><br>/g, '<br><br>'); // Clean up excessive breaks
          return `<p>${formattedParagraph}</p>`;
        }).join('\n\n');
      } else {
              // If it already has paragraph tags, enhance the formatting
      parsedContent = parsedContent
        // Add line breaks within existing paragraphs for better readability
        .replace(/(<p[^>]*>)([^<]+)(<\/p>)/g, (match, openTag, content, closeTag) => {
          const formattedContent = content
            .replace(/\n/g, '<br>') // Convert single newlines to <br> tags
            // First, temporarily protect circa abbreviations from line break insertion
            .replace(/\bc\.\s+(\d{4})/g, 'CIRCA_YEAR_$1')
            .replace(/\bc\.\s+(\d{4})\s*–\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
            .replace(/\bc\.\s+(\d{4})\s*-\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
            .replace(/\bc\.\s+(\d{4})\s+BCE/g, 'CIRCA_BCE_$1')
            .replace(/\bc\.\s+(\d{4})\s+CE/g, 'CIRCA_CE_$1')
            .replace(/\bc\.\s+(\d{4})\s+BC/g, 'CIRCA_BC_$1')
            .replace(/\bc\.\s+(\d{4})\s+AD/g, 'CIRCA_AD_$1')
            // Add line breaks after sentences (but not after circa)
            .replace(/([.!?])\s+/g, '$1<br><br>') // Add double line breaks after sentences
            .replace(/<br><br><br>/g, '<br><br>') // Clean up excessive breaks
            // Restore circa abbreviations
            .replace(/CIRCA_YEAR_(\d{4})/g, 'c. $1')
            .replace(/CIRCA_RANGE_(\d{4})_(\d{4})/g, 'c. $1–$2')
            .replace(/CIRCA_BCE_(\d{4})/g, 'c. $1 BCE')
            .replace(/CIRCA_CE_(\d{4})/g, 'c. $1 CE')
            .replace(/CIRCA_BC_(\d{4})/g, 'c. $1 BC')
            .replace(/CIRCA_AD_(\d{4})/g, 'c. $1 AD');
          return `${openTag}${formattedContent}${closeTag}`;
        });
      }
      
      // Additional formatting improvements
      parsedContent = parsedContent
        // Ensure proper spacing around headers
        .replace(/(<h[1-6][^>]*>)/g, '\n\n$1')
        .replace(/(<\/h[1-6]>)/g, '$1\n\n')
        // Ensure proper spacing around horizontal rules
        .replace(/(<hr[^>]*>)/g, '\n\n$1\n\n')
        // FINAL FORCE REMOVE any remaining line breaks after circa
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})/g, 'c. $1') // Remove <br> after c.
        .replace(/c\.\s*<br[^>]*>\s*<br[^>]*>\s*(\d{4})/g, 'c. $1') // Remove double <br> after c.
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s*–\s*(\d{4})/g, 'c. $1–$2') // Remove <br> in date ranges
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s*-\s*(\d{4})/g, 'c. $1-$2') // Remove <br> in date ranges (hyphen)
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+BCE/g, 'c. $1 BCE') // Remove <br> before BCE
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+CE/g, 'c. $1 CE') // Remove <br> before CE
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+BC/g, 'c. $1 BC') // Remove <br> before BC
        .replace(/c\.\s*<br[^>]*>\s*(\d{4})\s+AD/g, 'c. $1 AD') // Remove <br> before AD
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    
    // FALLBACK: If still no paragraph tags, force create them from the raw content
    if (!parsedContent.includes('<p>') && displayContent) {
      console.log('[PublicLessonView] No paragraph tags found, forcing paragraph creation from raw content');
      
      // Split the raw content into sentences and create paragraphs
      const sentences = displayContent
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/([.!?])\s+/g, '$1|') // Mark sentence endings
        .split('|')
        .filter(s => s.trim().length > 10); // Filter out very short fragments
      
      parsedContent = sentences.map(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length === 0) return '';
        
        // Add line breaks after sentences for better readability, but preserve circa abbreviations
        const formattedSentence = trimmed
          // First, temporarily protect circa abbreviations from line break insertion
          .replace(/\bc\.\s+(\d{4})/g, 'CIRCA_YEAR_$1')
          .replace(/\bc\.\s+(\d{4})\s*–\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
          .replace(/\bc\.\s+(\d{4})\s*-\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
          .replace(/\bc\.\s+(\d{4})\s+BCE/g, 'CIRCA_BCE_$1')
          .replace(/\bc\.\s+(\d{4})\s+CE/g, 'CIRCA_CE_$1')
          .replace(/\bc\.\s+(\d{4})\s+BC/g, 'CIRCA_BC_$1')
          .replace(/\bc\.\s+(\d{4})\s+AD/g, 'CIRCA_AD_$1')
          // Add line breaks after sentences (but not after circa)
          .replace(/([.!?])\s+/g, '$1<br><br>') // Add double line breaks after sentences
          .replace(/<br><br><br>/g, '<br><br>') // Clean up excessive breaks
          // Restore circa abbreviations
          .replace(/CIRCA_YEAR_(\d{4})/g, 'c. $1')
          .replace(/CIRCA_RANGE_(\d{4})_(\d{4})/g, 'c. $1–$2')
          .replace(/CIRCA_BCE_(\d{4})/g, 'c. $1 BCE')
          .replace(/CIRCA_CE_(\d{4})/g, 'c. $1 CE')
          .replace(/CIRCA_BC_(\d{4})/g, 'c. $1 BC')
          .replace(/CIRCA_AD_(\d{4})/g, 'c. $1 AD');
        
        return `<p>${formattedSentence}</p>`;
      }).join('\n\n');
      
      console.log('[PublicLessonView] Forced paragraph creation result:', {
        sentenceCount: sentences.length,
        paragraphCount: (parsedContent.match(/<p>/g) || []).length,
        contentPreview: parsedContent.substring(0, 300) + '...'
      });
    }
    
    // Debug log to check if JSON keys are still present
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] Content processing debug:', {
        hasIntroductionKey: displayContent.includes('"introduction":'),
        hasMainContentKey: displayContent.includes('"main_content":'),
        hasConclusionKey: displayContent.includes('"conclusion":'),
        displayContentLength: displayContent.length,
        parsedContentLength: parsedContent.length,
        hasParagraphTags: parsedContent.includes('<p>'),
        hasSectionHeaders: parsedContent.includes('<h2>'),
        hasHorizontalRules: parsedContent.includes('<hr>'),
        hasCustomSectionHeaders: parsedContent.includes('section-header'),
        hasCustomDividers: parsedContent.includes('section-divider'),
        contentPreview: parsedContent.substring(0, 500) + '...',
        rawContentPreview: displayContent.substring(0, 200) + '...',
        paragraphCount: (parsedContent.match(/<p>/g) || []).length,
        lineBreakCount: (parsedContent.match(/<br>/g) || []).length
      });
    }
  } catch (error) {
    console.error('[PublicLessonView] Error parsing markdown:', error);
    parsedContent = displayContent || '';
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
      <style>{publicLessonStyles}</style>
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
        <div className="flex space-x-2 mb-6 p-6 pb-0">
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
         <div>
           {/* Image Section - Above content like private LessonView */}
           {imageLoading && (
             <div className="lesson-image-container loading mb-6" style={{ maxWidth: 700, margin: '0 auto' }}>
               <div className="bg-gray-200 animate-pulse rounded-lg" style={{ 
                 width: '100%', 
                 height: '300px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 color: '#6b7280',
                 fontSize: '14px'
               }}>
                 Loading image...
               </div>
             </div>
           )}
           
           {imageData && imageData.url && !imageLoading && (
             <figure className="lesson-image-container mb-6" style={{ 
               maxWidth: 700, 
               margin: '0 auto',
               minHeight: '300px',
               position: 'relative'
             }}>
               <Image
                 src={imageData.url}
                 alt={lesson?.title || 'Lesson illustration'}
                 className="lesson-image"
                 priority={true}
                 preload={true}
                 lazy={false}
                 sizes="(max-width: 768px) 100vw, 700px"
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

           {/* Lesson Content - Match private LessonView structure exactly */}
           <div className="prose max-w-none lesson-content" style={{ padding: '0 2rem 2rem 2rem' }}>
             <div 
               className="markdown-body lesson-content-text"
               style={{ 
                 fontSize: '1.1rem',
                 lineHeight: '1.8',
                 color: '#374151',
                 textAlign: 'justify'
               }}
              dangerouslySetInnerHTML={{ 
                __html: parsedContent 
              }}
             />
           </div>
          
           {/* Academic References Footer */}
           <div className="mt-8">
             {referencesFooter && referencesFooter.references && (
               <AcademicReferencesFooter 
                 references={referencesFooter.references}
                 onCitationClick={handleCitationClick}
               />
             )}
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
