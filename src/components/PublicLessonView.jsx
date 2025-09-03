import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import SimpleImageService from '../services/SimpleImageService';
import imagePreloadService from '../services/ImagePreloadService';
import lessonImagePreloader from '../services/LessonImagePreloader';
import performanceMonitor from '../services/ImagePerformanceMonitor';
import AcademicReferencesService from '../services/AcademicReferencesService';
import AcademicReferencesFooter from './AcademicReferencesFooter';
import { getContentAsString } from '../utils/contentFormatter';
import Image from './Image.jsx';
import { publicTTSService } from '../services/TTSService.js';
import markdownService from '../services/MarkdownService';
import quizPersistenceService from '../services/QuizPersistenceService';
import { useApiWrapper } from '../services/api';
import './LessonView.css';

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

// Debounce utility for image search
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

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

// Image URL normalization function (matching private LessonView)
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  // Absolute URLs are used as-is
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  let normalized = url;

  // Prevent double-prefixing: if the URL already starts with the API base, leave it unchanged
  const base = process.env.REACT_APP_API_BASE_URL || '';
  if (base && normalized.startsWith(base)) {
    return normalized; // Already has prefix
  }

  // Ensure leading slash for root-relative paths
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;

  return `${base}${normalized}`;
};

// Helper function to clean and combine lesson content (matching private LessonView)
const cleanAndCombineContent = (content) => {
  if (!content) return '';
  
  // Helper function to clean individual content parts
  const cleanContentPart = (part) => {
    if (!part) return '';
    
    // First, remove all separator patterns before any other processing
    let cleaned = part
      .replace(/Content generation completed\./g, '')
      .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
      .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
      .trim();
    
    // Final cleanup of any separators that might have been reintroduced
    cleaned = cleaned
      .replace(/\|\|\|---\|\|\|/g, '')
      .replace(/\|\|\|/g, '');
    
    return cleaned;
  };
  
  if (typeof content === 'string') {
    const cleaned = cleanContentPart(content);
    return cleaned;
  }
  
  const { introduction, main_content, conclusion } = content;
  
  const cleanedIntro = introduction 
    ? cleanContentPart(introduction)
    : '';

  const cleanedMain = main_content ? cleanContentPart(main_content) : '';
  const cleanedConclusion = conclusion ? cleanContentPart(conclusion) : '';
  
  const result = [cleanedIntro, cleanedMain, cleanedConclusion]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\|\|\|---\|\|\|/g, '') // Final cleanup of any remaining patterns
    .replace(/\|\|\|/g, ''); // Final cleanup of any remaining ||| patterns
  
  // Final separator cleanup after all processing
  return result
    .replace(/\|\|\|---\|\|\|/g, '')
    .replace(/\|\|\|/g, '');
};

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
  const api = useApiWrapper();
  
  // Debug logging to see what props are received
  console.log('[PublicLessonView] Component rendered with props:', {
    hasLesson: !!lesson,
    lessonTitle: lesson?.title,
    subject,
    courseId,
    hasModuleTitle: !!moduleTitle,
    currentLessonIndex,
    totalLessonsInModule,
    hasActiveModule: !!activeModule,
    hasCourseDescription: !!courseDescription,
    sessionId
  });

  const [imageData, setImageData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [view, setView] = useState('content'); // 'content' or 'flashcards'
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showFailMessage, setShowFailMessage] = useState(false);
  const [usedImageTitles, setUsedImageTitles] = useState(new Set());
  const [usedImageUrls, setUsedImageUrls] = useState(new Set());
  const [imageTitleCounts, setImageTitleCounts] = useState({});
  const [imageUrlCounts, setImageUrlCounts] = useState({});
  const [imageFallbackTried, setImageFallbackTried] = useState(false);
  
  // Academic references state
  const [academicReferences, setAcademicReferences] = useState([]);
  const [referencesFooter, setReferencesFooter] = useState(null);
  const [isGeneratingBibliography, setIsGeneratingBibliography] = useState(false);
  
  // TTS state management (matching private LessonView)
  const [ttsStatus, setTtsStatus] = useState({
    isPlaying: false,
    isPaused: false,
    isSupported: true // Assume supported for public courses
  });
  
  // Use isolated public TTS service
  const performanceMonitor = useRef(performanceMonitor);
  const renderStartTime = useRef(performance.now());
  const abortControllerRef = useRef(null);
  const ttsStateUpdateTimeoutRef = useRef(null); // For debouncing state updates
  const isLessonChanging = useRef(false); // Track lesson changes to prevent TTS conflicts

  // Deferred rendering for better performance
  const [renderPhase, setRenderPhase] = useState('initial'); // initial, content, images, references
  const [deferredContent, setDeferredContent] = useState(null);
  const [deferredReferences, setDeferredReferences] = useState(null);
  const renderQueueRef = useRef([]);

  // Initial render - just the essential content
  useEffect(() => {
    if (!lesson?.content) return;
    
    setRenderPhase('initial');
    
    // Render core content immediately
    const coreContent = cleanAndCombineContent(lesson.content);
    setDeferredContent(coreContent);
    
    // Schedule deferred rendering for non-essential elements
    const scheduleDeferredRender = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          setRenderPhase('content');
          
          // Schedule image rendering
          requestIdleCallback(() => {
            setRenderPhase('images');
          }, { timeout: 1000 });
          
          // Schedule references rendering
          requestIdleCallback(() => {
            setRenderPhase('references');
          }, { timeout: 2000 });
        }, { timeout: 500 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => setRenderPhase('content'), 100);
        setTimeout(() => setRenderPhase('images'), 500);
        setTimeout(() => setRenderPhase('references'), 1000);
      }
    };
    
    scheduleDeferredRender();
  }, [lesson?.content]);

  // Deferred academic references generation
  useEffect(() => {
    if (renderPhase !== 'references' || !deferredContent || !subject) return;
    
    const generateReferences = async () => {
      try {
        const currentLessonId = lesson.id || `${lesson.title}_${subject}`;
        const lastLessonId = AcademicReferencesService.getLastProcessedLessonId();
        
        // Check if we already have references in state for this lesson
        if (academicReferences.length > 0 && lastLessonId === currentLessonId) {
          console.log('[PublicLessonView] References already loaded for lesson:', currentLessonId);
          return;
        }
        
        // If switching to a different lesson, clear the current references first
        if (lastLessonId && lastLessonId !== currentLessonId) {
          console.log('[PublicLessonView] Switching to new lesson, clearing previous references');
          setAcademicReferences([]);
          setReferencesFooter(null);
        }
        
        // Check if this lesson is already being processed to prevent duplicate generation
        if (AcademicReferencesService.isLessonBeingProcessed(currentLessonId)) {
          console.log('[PublicLessonView] Lesson is already being processed:', currentLessonId);
          return;
        }
        
        // Check if we already have saved references for this lesson
        const savedReferences = AcademicReferencesService.getSavedReferences(currentLessonId);
        
        if (savedReferences && savedReferences.length > 0) {
          console.log('[PublicLessonView] Using saved references for lesson:', currentLessonId);
          setAcademicReferences(savedReferences);
          
          // Generate content with inline citations using saved references
          const { content: contentWithInlineCitations } = AcademicReferencesService.generateInlineCitations(
            deferredContent,
            savedReferences
          );
          
          setDeferredContent(contentWithInlineCitations);
          
          // Create references footer for saved references
          try {
            const footer = AcademicReferencesService.createReferencesFooter(savedReferences);
            setReferencesFooter(footer);
            console.log('[PublicLessonView] Created references footer from saved references:', footer);
          } catch (error) {
            console.warn('[PublicLessonView] Failed to create references footer from saved references:', error);
          }
          
          // Mark this lesson as processed
          AcademicReferencesService.setLastProcessedLessonId(currentLessonId);
          // Ensure processing flag is cleared
          AcademicReferencesService.markLessonAsNotProcessing(currentLessonId);
          return;
        }
        
        console.log('[PublicLessonView] Generating authentic academic references for:', lesson.title);
        
        // Mark this lesson as being processed to prevent duplicate generation
        AcademicReferencesService.markLessonAsProcessing(currentLessonId);
        
        // Use AI service to generate authentic academic references
        const references = await api.generateAuthenticBibliography(
          lesson.title,
          subject,
          5, // Number of references
          deferredContent
        );
        
        setAcademicReferences(references);
        
        // Generate content with inline citations
        const { content: contentWithInlineCitations } = AcademicReferencesService.generateInlineCitations(
          deferredContent,
          references
        );
        
        setDeferredContent(contentWithInlineCitations);
        
        console.log('[PublicLessonView] Authentic academic references generated:', references);
        
        // Save the generated references for future use
        AcademicReferencesService.saveReferences(currentLessonId, references);
        console.log('[PublicLessonView] References saved for future use');
        
        // Mark this lesson as processed
        AcademicReferencesService.setLastProcessedLessonId(currentLessonId);
        
        // Create references footer
        try {
          if (references && references.length > 0) {
            const footer = AcademicReferencesService.createReferencesFooter(references);
            setReferencesFooter(footer);
            console.log('[PublicLessonView] Created references footer:', footer);
          }
        } catch (error) {
          console.warn('[PublicLessonView] Failed to create references footer:', error);
        }
        
      } catch (error) {
        console.error('[PublicLessonView] Failed to generate authentic academic references:', error);
        // No fallback to static references - just log the error and continue
        console.warn('[PublicLessonView] AI reference generation failed, no fallback available');
        setAcademicReferences([]);
      } finally {
        // Mark this lesson as no longer processing
        const currentLessonId = lesson.id || `${lesson.title}_${subject}`;
        AcademicReferencesService.markLessonAsNotProcessing(currentLessonId);
      }
    };
    
    generateReferences();
  }, [renderPhase, subject, lesson?.id, lesson?.title]); // Only depend on lesson ID and title, not content

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
      performanceMonitor.startPerformanceMonitoring();
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
              // Only log significant changes, not every state update
              if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
                console.log('[PublicLessonView] TTS state changed:', {
                  wasPlaying: ttsStatus.isPlaying,
                  wasPaused: ttsStatus.isPaused,
                  nowPlaying: serviceStatus.isPlaying,
                  nowPaused: serviceStatus.isPaused
                });
              }
              
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
    }, 2000); // Increased interval to reduce frequency

    return () => {
      clearInterval(interval);
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]); // Added dependencies back for proper updates

  // Debounced image search to prevent multiple simultaneous requests
  const debouncedImageSearch = useMemo(
    () => debounce(async (lessonData, subject, courseId) => {
      const startTime = performance.now();
      
      try {
        // Check for preloaded image first
        const preloadedImage = await lessonImagePreloader.getPreloadedImage(lessonData.id, lessonData.title, subject);
        if (preloadedImage) {
          console.log('[PublicLessonView] Using preloaded image data:', preloadedImage.title);
          setImageData(preloadedImage);
          setImageLoading(false);
          return;
        }
        
        // Simple image search
        const result = await SimpleImageService.search(
          lessonData.title,
          courseId,
          lessonData.id,
          Array.from(usedImageTitles),
          Array.from(usedImageUrls)
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
        
        // Always set image data - result should never be null due to fallbacks
        if (result && result.url) {
          console.log('[PublicLessonView] Setting image data:', result.title);
          setImageData(result);
        } else {
          console.warn('[PublicLessonView] No image result, using fallback');
          // This should never happen due to fallbacks, but just in case
          setImageData({
            url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
            title: 'Educational Content',
            pageURL: '',
            attribution: 'Wikimedia Commons',
            uploader: 'Wikimedia'
          });
        }
      } catch (e) {
        console.warn('[PublicLessonView] Image fetch error:', e);
        // Use fallback placeholder on error
        setImageData({
          url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
          title: 'Educational Content',
          pageURL: '',
          attribution: 'Wikimedia Commons',
          uploader: 'Wikimedia'
        });
      } finally {
        setImageLoading(false);
      }
    }, 300), // 300ms debounce
    [courseId, subject]
  );

  // Start image performance monitoring
  useEffect(() => {
    try {
      performanceMonitor.startPerformanceMonitoring();
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

  // Handle image loading for public courses with enhanced logic (matching private LessonView)
  useEffect(() => {
    if (!lesson?.title || !subject || !courseId) return;
    
    console.log('[PublicLessonView] Image loading effect triggered:', {
      lessonTitle: lesson?.title,
      subject,
      courseId,
      hasLessonImage: !!(lesson?.image && (lesson.image.imageUrl || lesson.image.url)),
      imageData: imageData,
      imageLoading
    });
    
    let ignore = false;
    
    // If image is already present on lesson, use it (optimized check)
    if (lesson?.image && (lesson.image.imageUrl || lesson.image.url)) {
      const imageUrl = lesson.image.imageUrl || lesson.image.url;
      const imageTitle = lesson.image.imageTitle || lesson.image.title;
      
      // Check if this image is already being used too frequently
      const appearsMoreThanOnce = (imageTitle && imageTitleCounts[imageTitle] > 1) || (imageUrl && imageUrlCounts[imageUrl] > 1);
      
      if (!appearsMoreThanOnce) {
        const existing = {
          url: normalizeImageUrl(imageUrl),
          title: imageTitle,
          pageURL: lesson.image.pageURL,
          attribution: lesson.image.attribution,
          uploader: undefined,
        };
        
        setImageData(existing);
        setImageLoading(false);
        console.log('[PublicLessonView] Using existing lesson image');
        return;
      }
      // If duplicate, fall through to fetch a replacement
      console.log('[PublicLessonView] Image appears too frequently, fetching replacement');
    }
    
    setImageLoading(true);
    setImageData(null);
    
    let abortController = new AbortController();
    
    // Run in background (non-blocking)
    (async function fetchImage() {
      const startTime = performance.now();
      
      // Check if we have a preloaded image first
      const preloadedImage = lessonImagePreloader.getPreloadedImage(lesson.id, lesson.title, subject);
      if (preloadedImage) {
        console.log('[PublicLessonView] Using preloaded image data:', preloadedImage.title);
        if (!ignore && !abortController.signal.aborted) {
          setImageData(preloadedImage);
          setImageLoading(false);
        }
        return;
      }
      
      try {
        // Use the simplified approach with better error handling
        console.log('[PublicLessonView] Fetching new image for lesson:', lesson.title);
        const result = await SimpleImageService.search(
          lesson.title,
          courseId,
          lesson?.id,
          Array.from(usedImageTitles),
          Array.from(usedImageUrls)
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
          console.log('[PublicLessonView] Setting image data:', result);
          
          // Always set image data - result should never be null due to fallbacks
          if (result && result.url) {
            // Only update if the image data has actually changed
            const newImageData = { ...result, url: normalizeImageUrl(result.url) };
            setImageData(prevData => {
              if (prevData?.url === newImageData?.url && prevData?.title === newImageData?.title) {
                return prevData; // No change needed
              }
              return newImageData;
            });
            
            // Update local used image tracking when a new image is found
            setUsedImageTitles(prev => new Set([...prev, result.title]));
            setUsedImageUrls(prev => new Set([...prev, result.url]));
          } else {
            console.warn('[PublicLessonView] No image result, using fallback');
            // This should never happen due to fallbacks, but just in case
            const fallbackImage = {
              url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
              title: 'Educational Content',
              pageURL: '',
              attribution: 'Wikimedia Commons',
              uploader: 'Wikimedia'
            };
            setImageData(fallbackImage);
          }
        }
      } catch (e) {
        if (!ignore && !abortController.signal.aborted) {
          console.warn('[PublicLessonView] Image fetch error:', e);
          // Use fallback placeholder on error
          const fallbackImage = {
            url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
            title: 'Educational Content',
            pageURL: '',
            attribution: 'Wikimedia Commons',
            uploader: 'Wikimedia'
          };
          setImageData(fallbackImage);
        }
      } finally {
        if (!ignore && !abortController.signal.aborted) {
          setImageLoading(false);
        }
      }
    })();
    
    return () => { 
      ignore = true;
      // Abort any pending request
      abortController.abort();
    };
  }, [lesson?.id, lesson?.title, lesson?.image, subject, courseId, courseDescription, imageTitleCounts, imageUrlCounts, usedImageTitles, usedImageUrls, normalizeImageUrl]);

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
          courseId
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

  // Reset image fallback flag when lesson changes
  useEffect(() => {
    setImageFallbackTried(false);
  }, [lesson?.id]);

  // If the lesson's current image fails to load (e.g., legacy /images/*.jpg that no longer exists),
  // fetch a fresh remote image and update the lesson.
  const handleImageError = useCallback(async () => {
    if (imageFallbackTried) return;
    setImageFallbackTried(true);
    
    // Create AbortController for this fallback request
    const fallbackController = new AbortController();
    
    try {
      const result = await SimpleImageService.search(
        lesson?.title,
        courseId,
        lesson?.id,
        Array.from(usedImageTitles), // Convert Set to Array
        Array.from(usedImageUrls)   // Convert Set to Array
      );
      
      // Check if request was aborted before setting state
      if (!fallbackController.signal.aborted && result && result.url) {
        console.log('[PublicLessonView] Setting fallback image data:', result);
        setImageData({ ...result, url: normalizeImageUrl(result.url) });
        
        // Update local used image tracking when a new image is found
        if (result) {
          setUsedImageTitles(prev => new Set([...prev, result.title]));
          setUsedImageUrls(prev => new Set([...prev, result.url]));
        }
      } else if (!fallbackController.signal.aborted) {
        // If no result, use fallback image
        console.warn('[PublicLessonView] Fallback search failed, using fallback image');
        const fallbackImage = {
          url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
          title: 'Educational Content',
          pageURL: '',
          attribution: 'Wikimedia Commons',
          uploader: 'Wikimedia'
        };
        setImageData(fallbackImage);
      }
    } catch (e) {
      // Only handle errors if not aborted
      if (!fallbackController.signal.aborted) {
        console.warn('[PublicLessonView] Image fallback error:', e);
        // Use fallback placeholder on error
        const fallbackImage = {
          url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
          title: 'Educational Content',
          pageURL: '',
          attribution: 'Wikimedia Commons',
          uploader: 'Wikimedia'
        };
        setImageData(fallbackImage);
      }
    }
    
    // Cleanup function to abort if component unmounts
    return () => fallbackController.abort();
  }, [imageFallbackTried, lesson, usedImageTitles, usedImageUrls, courseId, normalizeImageUrl, subject, courseDescription]);

  // Academic references state (optimized with useMemo)
  const [highlightedCitation, setHighlightedCitation] = useState(null);

  // Update academic references when lesson content changes
  useEffect(() => {
    if (!lesson?.content || !subject || !lesson?.title) {
      setAcademicReferences([]);
      return;
    }
    
    try {
      console.log('[PublicLessonView] Processing references for:', lesson.title);
      
      // Ensure lesson.content is a string - use content formatter to strip keys
      const lessonContentString = typeof lesson.content === 'string' 
        ? getContentAsString(lesson.content)
        : getContentAsString(lesson.content);
      
      // Only process if content is substantial
      if (lessonContentString.length < 100) {
        setAcademicReferences([]);
        return;
      }
      
      // First, extract references from the content
      const { contentWithoutRefs, references: extractedReferences } = extractReferences(lessonContentString);
      
      // If we found references in the content, use them
      if (extractedReferences && extractedReferences.length > 0) {
        console.log('[PublicLessonView] Found references in content:', {
          referencesCount: extractedReferences.length,
          references: extractedReferences
        });
        
        // Convert extracted references to the format expected by AcademicReferencesService
        const formattedReferences = extractedReferences.map(ref => ({
          id: ref.number,
          citation: ref.citation,
          source: 'lesson_content'
        }));
        
        setAcademicReferences(formattedReferences);
        return;
      }
      
      // If no references found in content, try to use AI-generated references
      console.log('[PublicLessonView] No references found in content, checking for AI-generated references');
      
      // Check if we have saved AI-generated references for this lesson
      const currentLessonId = lesson.id || `${lesson.title}_${subject}`;
      const savedReferences = AcademicReferencesService.getSavedReferences(currentLessonId);
      
      if (savedReferences && savedReferences.length > 0) {
        console.log('[PublicLessonView] Using saved AI-generated references:', {
          referencesCount: savedReferences.length,
          references: savedReferences
        });
        setAcademicReferences(savedReferences);
        return;
      }
      
      // If no saved references, try to generate new ones via AI
      console.log('[PublicLessonView] No saved references found, attempting AI generation');
      
      try {
        // Mark this lesson as being processed to prevent duplicate generation
        if (!AcademicReferencesService.isLessonBeingProcessed(currentLessonId)) {
          AcademicReferencesService.markLessonAsProcessing(currentLessonId);
          
          // Use AI service to generate authentic academic references
          const references = await api.generateAuthenticBibliography(
            lesson.title,
            subject,
            5, // Number of references
            lessonContentString,
            true // isPublic = true for public courses
          );
          
          if (references && references.length > 0) {
            console.log('[PublicLessonView] AI-generated references:', {
              referencesCount: references.length,
              references: references
            });
            
            setAcademicReferences(references);
            
            // Save the generated references for future use
            AcademicReferencesService.saveReferences(currentLessonId, references);
            console.log('[PublicLessonView] AI-generated references saved for future use');
            
            // Mark this lesson as processed
            AcademicReferencesService.setLastProcessedLessonId(currentLessonId);
          } else {
            console.log('[PublicLessonView] No AI-generated references returned');
            setAcademicReferences([]);
          }
          
          // Mark this lesson as no longer processing
          AcademicReferencesService.markLessonAsNotProcessing(currentLessonId);
        } else {
          console.log('[PublicLessonView] Lesson is already being processed, skipping AI generation');
        }
      } catch (error) {
        console.error('[PublicLessonView] Error generating AI references:', error);
        setAcademicReferences([]);
        
        // Ensure processing flag is cleared on error
        AcademicReferencesService.markLessonAsNotProcessing(currentLessonId);
      }
    } catch (error) {
      console.error('[PublicLessonView] Error processing references:', error);
      setAcademicReferences([]);
    }
  }, [lesson?.content, subject, lesson?.title]);

  // Memoize content with citations to prevent regeneration on every render
  const contentWithCitations = useMemo(() => {
    if (!lesson?.content || !academicReferences.length) return '';
    
    try {
      const lessonContentString = typeof lesson.content === 'string' 
        ? getContentAsString(lesson.content)
        : getContentAsString(lesson.content);
      
      // Extract references from content to get content without references
      const { contentWithoutRefs } = extractReferences(lessonContentString);
      
      // Use content without references for citation generation
      const contentToProcess = contentWithoutRefs || lessonContentString;
      
      // Generate content with inline citations
      const { content: contentWithInlineCitations } = AcademicReferencesService.generateInlineCitations(
        contentToProcess,
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

  // Handle bibliography generation
  const handleGenerateBibliography = useCallback(async () => {
    if (!lesson?.title || !subject || isGeneratingBibliography) return;
    
    setIsGeneratingBibliography(true);
    
    try {
      console.log('[PublicLessonView] Generating bibliography for:', lesson.title);
      
      const currentLessonId = lesson.id || `${lesson.title}_${subject}`;
      
              // Use AI service to generate authentic academic references
        const references = await api.generateAuthenticBibliography(
          lesson.title,
          subject,
          5, // Number of references
          deferredContent || cleanAndCombineContent(lesson.content),
          true // isPublic = true for public courses
        );
      
      if (references && references.length > 0) {
        console.log('[PublicLessonView] Generated bibliography:', references);
        
        // Update the academic references
        setAcademicReferences(references);
        
        // Save the generated references for future use
        AcademicReferencesService.saveReferences(currentLessonId, references);
        
        // Mark this lesson as processed
        AcademicReferencesService.setLastProcessedLessonId(currentLessonId);
        
        // Create references footer
        const footer = AcademicReferencesService.createReferencesFooter(references);
        setReferencesFooter(footer);
        
        // Generate content with inline citations
        const { content: contentWithInlineCitations } = AcademicReferencesService.generateInlineCitations(
          deferredContent || cleanAndCombineContent(lesson.content),
          references
        );
        
        setDeferredContent(contentWithInlineCitations);
        
        console.log('[PublicLessonView] Bibliography generated and applied successfully');
      } else {
        console.warn('[PublicLessonView] No bibliography generated');
      }
    } catch (error) {
      console.error('[PublicLessonView] Error generating bibliography:', error);
    } finally {
      setIsGeneratingBibliography(false);
    }
  }, [lesson, subject, deferredContent, isGeneratingBibliography]);

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
          console.warn('[PublicLessonView] TTS reset error:', resetError);
        }
      }
      
      // Clear any pending timeouts
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, []);

  // TTS handlers (matching private LessonView)
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
  }, [view, lesson, ttsStatus.isPlaying, ttsStatus.isPaused]);

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

  // Handle tab change
  const handleTabChange = useCallback((newView) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] handleTabChange called with:', newView, 'current view:', view);
    }
    setView(newView);
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] View state updated to:', newView);
    }
  }, [view]);

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

  // Early return if no lesson
  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No lesson selected</p>
      </div>
    );
  }

  // Process content for display with enhanced markdown parsing
  let displayContent = '';
  let parsedContent = '';
  
  try {
    // Use the content formatter to clean and combine content
    displayContent = cleanAndCombineContent(lesson.content);
    
    // Remove in-text citations first, then apply markdown fix
    let fixedContent = markdownService.removeInTextCitations(displayContent);
    
    // Apply markdown fix after citation removal - use bibliography-aware parsing
    fixedContent = fixedContent.includes('## References') 
      ? markdownService.parseWithBibliography(fixedContent)
      : markdownService.parse(fixedContent);

    // Frontend-level fix for malformed References sections
    fixedContent = fixedContent
      // Fix the specific problematic pattern: "## References [1] ... [2] ..."
      .replace(/## References\s*\[(\d+)\]/g, '\n## References\n\n[$1]')
      // Ensure each citation is on its own line
      .replace(/\]\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Add proper line breaks between citations
      .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Clean up any remaining issues
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple line breaks

    // Extract references from the content
    const { contentWithoutRefs, references } = extractReferences(fixedContent);

    // Apply markdown parsing to content without references
    parsedContent = markdownService.parse(contentWithoutRefs);

    // Debug logging for references processing
    if (process.env.NODE_ENV === 'development') {
      console.log('[PublicLessonView] References processing:', {
        hasReferences: displayContent?.includes('## References'),
        referencesCount: references?.length || 0,
        references: references,
        contentWithoutRefsLength: contentWithoutRefs?.length || 0,
        parsedContentLength: parsedContent?.length || 0
      });
    }
  } catch (error) {
    console.error('[PublicLessonView] Error processing markdown:', error);
    parsedContent = displayContent || '';
  }
  
  // Create academic references footer
  useEffect(() => {
    try {
      if (academicReferences && academicReferences.length > 0) {
        const footer = AcademicReferencesService.createReferencesFooter(academicReferences);
        setReferencesFooter(footer);
      } else {
        setReferencesFooter(null);
      }
    } catch (error) {
      console.warn('[PublicLessonView] Error creating references footer:', error);
      setReferencesFooter(null);
    }
  }, [academicReferences]);

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
          <button
            onClick={handleGenerateBibliography}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-purple-600 text-white hover:bg-purple-700"
            title="Generate bibliography for this lesson"
            disabled={isGeneratingBibliography}
          >
            <i className={`mr-2 ${isGeneratingBibliography ? 'fas fa-spinner fa-spin' : 'fas fa-book'}`}></i>
            {isGeneratingBibliography ? 'Generating...' : 'Generate Bibliography'}
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
                 style={{ width: '100%', height: 'auto' }}
                 priority={true}
                 preload={true}
                 lazy={false}
                 sizes="(max-width: 768px) 100vw, 700px"
                 onError={handleImageError}
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
