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
import imagePreloadService from '../services/ImagePreloadService';
import lessonImagePreloader from '../services/LessonImagePreloader';
import Image from './Image.jsx';

import { privateTTSService } from '../services/TTSService.js';
import Flashcard from './Flashcard';
import { useThrottledLogger, useDebounce, useStableValue } from '../hooks/usePerformanceOptimization';
import performanceMonitor from '../services/PerformanceMonitorService';
import imagePerformanceMonitor from '../services/ImagePerformanceMonitor';
import predictiveAnalyticsService from '../services/PredictiveAnalyticsService';
import api from '../services/api.js';
import quizPersistenceService from '../services/QuizPersistenceService';
import markdownService from '../services/MarkdownService';
import { fixMalformedContent, formatContentForDisplay, cleanContentFormatting, validateContent, getContentAsString } from '../utils/contentFormatter';
import AcademicReferencesFooter from './AcademicReferencesFooter';
import academicReferencesService from '../services/AcademicReferencesService';

// Import test utilities for development
if (process.env.NODE_ENV === 'development') {
  import('../utils/testReferences.js').then(module => {
    module.testReferencesFormat();
    module.testBibliographyFormatting();
  });
  import('../utils/testCitationRemoval.js').then(module => {
    module.testCitationRemoval();
  });
}

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

// Test function for references extraction (development only)
const testReferencesExtraction = () => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const testContent = `Some lesson content here.

## References [1] Encyclopaedia Britannica. (2024). *Academic Edition*. Encyclopaedia Britannica, Inc.. [2] Oxford University Press. (2012). *Oxford Classical Dictionary*. Oxford University Press.`;

  const result = extractReferences(testContent);
  console.log('[Test] References extraction result:', result);
  
  return result;
};

// Run test in development
if (process.env.NODE_ENV === 'development') {
  testReferencesExtraction();
}

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
    
    // Final separator cleanup after all processing
    return result
      .replace(/\|\|\|---\|\|\|/g, '')
      .replace(/\|\|\|/g, '');
  };

// Lazy load components
const LazyQuizView = lazy(() => import('./QuizView'));

// Memoized Loading component
const LoadingSpinner = memo(() => (
  <div className="flex justify-center items-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
));

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

  // Generate academic references using the same service as PublicLessonView
  const [highlightedCitation, setHighlightedCitation] = useState(null);
  
  // Memoize academic references to prevent regeneration on every render
  const academicReferences = useMemo(() => {
    if (!content || !lessonTitle || !courseSubject) return [];
    
    try {
      const lessonContentString = getContentAsString(content);
      
      // Only generate if content is substantial
      if (lessonContentString.length < 100) return [];
      
      console.log('[LessonView] Generating academic references for:', {
        lessonTitle,
        courseSubject,
        contentLength: lessonContentString?.length || 0
      });
      
      // Generate academic references using the same method as PublicLessonView
      const references = academicReferencesService.generateReferences(
        lessonContentString,
        courseSubject,
        lessonTitle
      );
      
      console.log('[LessonView] Academic references generated:', {
        referencesCount: references.length,
        references: references,
        lessonContentStringLength: lessonContentString?.length || 0,
        courseSubject,
        lessonTitle
      });
      
      return references;
    } catch (error) {
      console.error('[LessonView] Error generating academic references:', error);
      return [];
    }
  }, [content, lessonTitle, courseSubject]);

  // Handle citation click
  const handleCitationClick = useCallback((referenceId) => {
    setHighlightedCitation(referenceId);
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedCitation(null);
    }, 3000);
    
    console.log('[LessonView] Citation clicked:', referenceId);
  }, []);

  // Remove in-text citations first, then apply markdown fix
  let fixedContent = markdownService.removeInTextCitations(contentStr);
  
  // Apply markdown fix after citation removal - use bibliography-aware parsing
  fixedContent = fixedContent.includes('## References') 
    ? markdownService.parseWithBibliography(fixedContent)
    : fixMalformedMarkdown(fixedContent);

  // Frontend-level fix for malformed References sections
  fixedContent = fixMalformedReferencesAtFrontend(fixedContent);

  // Extract references from the content
  const { contentWithoutRefs, references } = extractReferences(fixedContent);

  // Apply markdown parsing to content without references
  const parsedContent = fixMalformedMarkdown(contentWithoutRefs);

  // Debug logging for references processing
  if (process.env.NODE_ENV === 'development') {
    console.log('[LessonView] References processing:', {
      hasReferences: contentStr?.includes('## References'),
      referencesCount: references?.length || 0,
      references: references,
      contentWithoutRefsLength: contentWithoutRefs?.length || 0,
      parsedContentLength: parsedContent?.length || 0
    });
  }

  // Use academic references instead of old bibliography processing

  // Create academic references footer using the same method as PublicLessonView
  let referencesFooter = null;
  try {
    if (academicReferences && academicReferences.length > 0) {
      referencesFooter = academicReferencesService.createReferencesFooter(academicReferences);
      console.log('[LessonView] Created references footer:', referencesFooter);
    } else {
      console.log('[LessonView] No academic references available:', academicReferences);
    }
  } catch (error) {
    console.warn('[LessonView] Error creating references footer:', error);
    referencesFooter = null;
  }

  // Debug logging for markdown processing
  if (process.env.NODE_ENV === 'development') {
    console.log('[LessonView] Content processing:', {
      original: contentStr?.substring(0, 200) + '...',
      fixed: fixedContent?.substring(0, 200) + '...',
      hasAsterisks: contentStr?.includes('**'),
      hasFixedAsterisks: fixedContent?.includes('**'),
      bibliographyCount: finalBibliography?.length || 0,
      referencesCount: references?.length || 0
    });
  }

  return (
    <div className="prose max-w-none lesson-content">
      <div 
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: parsedContent }}
      />
      {referencesFooter && referencesFooter.references && (
        <AcademicReferencesFooter 
          references={referencesFooter.references}
          onCitationClick={handleCitationClick}
        />
      )}
    </div>
  );
});

// AcademicReferencesFooter is now imported and used instead of the old ReferencesFooter

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
  const [lessonStartTime, setLessonStartTime] = useState(Date.now());
  
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
        Array.from(localUsedImageTitles), // Convert Set to Array
        Array.from(localUsedImageUrls),   // Convert Set to Array
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
      } else if (!fallbackController.signal.aborted) {
        // If no result, use fallback image
        console.warn('[LessonView] Fallback search failed, using fallback image');
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
        console.warn('[LessonView] Image fallback error:', e);
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

  // TTS state management (matching PublicLessonView)
  const ttsStateUpdateTimeoutRef = useRef(null); // For debouncing state updates
  const isLessonChanging = useRef(false); // Track lesson changes to prevent TTS conflicts

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      try {
        privateTTSService.stop();
      } catch (error) {
        console.warn('[LessonView] TTS cleanup error:', error);
      }
    };
  }, []);

  // Auto-pause TTS when lesson changes
  useEffect(() => {
    if (!propLesson?.id) return;
    
    // Only trigger on actual lesson ID changes, not TTS status changes
    if (isLessonChanging.current) {
      console.log('[LessonView] Lesson change already in progress, skipping');
      return;
    }

    try {
      // Only stop TTS if it's actually playing or paused
      const currentStatus = privateTTSService.getStatus();
      if (!currentStatus.isPlaying && !currentStatus.isPaused) {
        console.log('[LessonView] TTS not playing, no need to stop on lesson change');
        return;
      }

      // Set flag to prevent TTS conflicts during lesson change
      isLessonChanging.current = true;
      console.log('[LessonView] Lesson change detected, pausing TTS');

      // Stop TTS if it's currently playing or paused
      try {
        privateTTSService.stop(); // This will reset pause data via resetPauseData()
        console.log('[LessonView] Stopped TTS and reset pause data on lesson change');
      } catch (error) {
        console.warn('[LessonView] TTS auto-pause error:', error);
        // Only reset if stop fails, but don't clear the stopped state
        try {
          privateTTSService.reset();
          console.log('[LessonView] Reset TTS service after stop error');
        } catch (resetError) {
          console.warn('[LessonView] Error resetting TTS service:', resetError);
        }
      }

      // Update TTS status to reflect stopped state
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));

      // Clear lesson change flag after a delay
      setTimeout(() => {
        isLessonChanging.current = false;
        console.log('[LessonView] Lesson change flag cleared, TTS can resume');
      }, 1000);
    } catch (error) {
      console.warn('[LessonView] Lesson change TTS handling error:', error);
      isLessonChanging.current = false;
    }
  }, [propLesson?.id]); // Only depend on lesson ID, not TTS status

  // Sync TTS state with service state periodically
  useEffect(() => {
    const syncTTSState = () => {
      try {
        const serviceStatus = privateTTSService.getStableStatus();
        
        // Only update if there's an actual change
        if (
          serviceStatus.isPlaying !== ttsStatus.isPlaying ||
          serviceStatus.isPaused !== ttsStatus.isPaused
        ) {
          // Debounce state updates to prevent rapid changes
          if (ttsStateUpdateTimeoutRef.current) {
            clearTimeout(ttsStateUpdateTimeoutRef.current);
          }

          ttsStateUpdateTimeoutRef.current = setTimeout(() => {
            console.log('[LessonView] TTS state changed:', {
              wasPlaying: ttsStatus.isPlaying,
              wasPaused: ttsStatus.isPaused,
              newPlaying: serviceStatus.isPlaying,
              newPaused: serviceStatus.isPaused
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
                isPaused: serviceStatus.isPaused,
                isSupported: serviceStatus.isSupported
              };
            });
          }, 100);
        }
      } catch (error) {
        console.warn('[LessonView] TTS state sync error:', error);
      }
    };

    // Sync immediately
    syncTTSState();

    // Set up interval to sync state periodically
    const intervalId = setInterval(syncTTSState, 500);

    return () => {
      clearInterval(intervalId);
      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]);

  // Cleanup TTS when component unmounts
  useEffect(() => {
    return () => {
      try {
        privateTTSService.stop();
        console.log('[LessonView] Cleaned up TTS service on unmount');
      } catch (error) {
        console.warn('[LessonView] Error cleaning up TTS service:', error);
      }

      if (ttsStateUpdateTimeoutRef.current) {
        clearTimeout(ttsStateUpdateTimeoutRef.current);
      }
    };
  }, []);

  const handleStartAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Guard against automatic calls - only allow manual button clicks
    console.log('[LessonView] handleStartAudio called - manual start only');
    
    // Check if TTS service has been stopped - if so, restart it
    const serviceStatus = privateTTSService.getStatus();
    if (serviceStatus.isStopped) {
      console.log('[LessonView] TTS service was stopped, restarting service...');
      try {
        const restartSuccess = await privateTTSService.restart();
        if (!restartSuccess) {
          console.error('[LessonView] Failed to restart TTS service');
          return;
        }
        console.log('[LessonView] TTS service restarted successfully');
      } catch (error) {
        console.error('[LessonView] Failed to restart TTS service:', error);
        return;
      }
    }
    
    try {
      // Check if TTS is already playing
      if (ttsStatus.isPlaying) {
        console.log('[LessonView] TTS already playing, stopping first');
        privateTTSService.stop();
        setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        return;
      }

      // Check if TTS is paused and can resume
      if (ttsStatus.isPaused) {
        console.log('[LessonView] Resuming paused TTS');
        privateTTSService.resume();
        setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        return;
      } else {
        // Start new reading - only read the currently displayed content
        let contentToRead = '';
        
        if (view === 'content') {
          // Read the full lesson content including introduction and conclusion
          if (propLesson.content && typeof propLesson.content === 'object') {
            // For object content, combine introduction, main_content, and conclusion
            const parts = [];
            if (propLesson.content.introduction) {
              parts.push(propLesson.content.introduction);
            }
            if (propLesson.content.main_content) {
              parts.push(propLesson.content.main_content);
            } else if (propLesson.content.content) {
              parts.push(propLesson.content.content);
            }
            if (propLesson.content.conclusion) {
              parts.push(propLesson.content.conclusion);
            }
            contentToRead = parts.join('\n\n');
          } else if (typeof propLesson.content === 'string') {
            // For string content, use it as is
            contentToRead = propLesson.content;
          }
        } else if (view === 'flashcards') {
          // For flashcards view, read the flashcard terms and definitions
          const flashcardData = propLesson?.flashcards || propLesson?.content?.flashcards || [];
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
          console.warn('[LessonView] Content too short or invalid for TTS:', {
            view: view,
            hasContent: !!contentToRead,
            type: typeof contentToRead,
            length: contentToRead ? contentToRead.length : 0,
            trimmedLength: contentToRead ? contentToRead.trim().length : 0
          });
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
          return;
        }
        
        console.log('[LessonView] Starting TTS with content:', {
          view: view,
          contentLength: contentToRead.length,
          contentPreview: contentToRead.substring(0, 100) + '...'
        });
        
        const started = await privateTTSService.readLesson({ ...propLesson, content: contentToRead }, propLesson.id);
        
        if (started) {
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        } else {
          console.warn('[LessonView] TTS failed to start');
          setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        }
      }
    } catch (error) {
      console.error('[LessonView] TTS error:', error);
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [view, propLesson]); // Removed ttsStatus dependencies to prevent auto-restart

  const handleStopAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      privateTTSService.stop();
    } catch (error) {
      console.warn('[LessonView] TTS stop error:', error);
    }
    // Always reset state when stopping
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  }, []);

  const handlePauseResumeAudio = useCallback(async () => {
    // Add a small delay to prevent rapid button clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[LessonView] handlePauseResumeAudio called with state:', {
      isPlaying: ttsStatus.isPlaying,
      isPaused: ttsStatus.isPaused
    });
    
    try {
      if (ttsStatus.isPaused) {
        console.log('[LessonView] Attempting to resume TTS');
        const resumed = await privateTTSService.resume();
        console.log('[LessonView] Resume result:', resumed);
        if (resumed) {
          setTtsStatus(prev => ({ ...prev, isPlaying: true, isPaused: false }));
        }
      } else if (ttsStatus.isPlaying) {
        console.log('[LessonView] Attempting to pause TTS');
        await privateTTSService.pause();
        setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: true }));
      }
    } catch (error) {
      console.warn('[LessonView] TTS pause/resume error:', error);
      // Reset state on error
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [ttsStatus.isPlaying, ttsStatus.isPaused]);

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
    const startTime = performance.now();
    
    // Track flashcard rendering for performance monitoring
    performanceMonitor.trackFlashcardRender();
    
    const result = <FlashcardRenderer flashcards={flashcardData} />;
    
    // Track render time for performance monitoring
    const renderTime = performance.now() - startTime;
    imagePerformanceMonitor.trackRenderTime('FlashcardRenderer', renderTime);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[LessonView] renderFlashcards called with data:', flashcardData);
    }
    
    return result;
  }, [flashcardData]);

  // Update lesson state when prop changes
  useEffect(() => {
    if (!propLesson) return;
    
    setLessonState(propLesson);
    setIsLoading(false);
    
    // Reset TTS if lesson changes
    if (propLesson?.id && privateTTSService.getStatus().currentLessonId !== propLesson.id) {
      console.log('[LessonView] Lesson changed, stopping TTS and resetting pause data');
      privateTTSService.stop(); // This will also reset pause data via resetPauseData()
      setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }
  }, [propLesson]);

  // Track navigation for predictive analytics
  useEffect(() => {
    if (propLesson?.id && activeModule?.id && courseId) {
      // Update lesson start time
      setLessonStartTime(Date.now());
      
      // Record navigation to current lesson
      predictiveAnalyticsService.recordNavigation(
        'previous', // We don't know the previous lesson yet
        propLesson.id,
        {
          timeSpent: 0, // Will be updated when leaving
          scrollDepth: 0,
          interactions: 0
        }
      );
    }
  }, [propLesson?.id, activeModule?.id, courseId]);

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
    
    // If image is already present on lesson, use it (optimized check)
    if (propLesson?.image && (propLesson.image.imageUrl || propLesson.image.url)) {
      const imageUrl = propLesson.image.imageUrl || propLesson.image.url;
      const imageTitle = propLesson.image.imageTitle || propLesson.image.title;
      
      // Check if this image is already being used too frequently
      const appearsMoreThanOnce = (imageTitle && imageTitleCounts[imageTitle] > 1) || (imageUrl && imageUrlCounts[imageUrl] > 1);
      
      if (!appearsMoreThanOnce) {
        const existing = {
          url: normalizeImageUrl(imageUrl),
          title: imageTitle,
          pageURL: propLesson.image.pageURL,
          attribution: propLesson.image.attribution,
          uploader: undefined,
        };
        
        setImageData(existing);
        setImageLoading(false);
        console.log('[LessonView] Using existing lesson image');
        return;
      }
      // If duplicate, fall through to fetch a replacement
      console.log('[LessonView] Image appears too frequently, fetching replacement');
    }
    
    setImageLoading(true);
    setImageData(null);
    
    let abortController = new AbortController();
    
    // Run in background (non-blocking)
    (async function fetchImage() {
      const startTime = performance.now();
      
      // Create a cache key for this lesson
      const cacheKey = `${propLesson.id}-${propLesson.title}-${subject}`;
      
          // Check if we already have a cached result for this lesson
    if (imageData && imageData.url && imageData.title) {
      console.log('[LessonView] Using existing image data, skipping fetch');
      return;
    }

    // Check if we have a preloaded image
    const preloadedImage = lessonImagePreloader.getPreloadedImage(propLesson.id, propLesson.title, subject);
    if (preloadedImage) {
      console.log('[LessonView] Using preloaded image data:', preloadedImage.title);
      setImageData(preloadedImage);
      setImageLoading(false);
      return;
    }
      
      try {
        // Use the simplified approach
        const result = await SimpleImageService.search(
          propLesson.title,
          courseId,
          propLesson?.id || lessonId
        );
        
        // Track image fetch performance
        const fetchTime = performance.now() - startTime;
        if (result && result.url) {
          performanceMonitor.trackImageLoad(result.url, fetchTime, false);
        }
        
        // Log slow image fetches
        if (fetchTime > 2000) {
          console.warn('[LessonView] Slow image fetch detected:', fetchTime + 'ms');
        }
        
        if (!ignore && !abortController.signal.aborted) {
          console.log('[LessonView] Setting image data:', result);
          
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
            setLocalUsedImageTitles(prev => new Set([...prev, result.title]));
            setLocalUsedImageUrls(prev => new Set([...prev, result.url]));
            
            // Persist replacement image into lesson if we fetched a new one
            if (onUpdateLesson && propLesson?.id) {
              onUpdateLesson(propLesson.id, { image: {
                imageTitle: result.title,
                imageUrl: result.url,
                pageURL: result.pageURL,
                attribution: result.attribution,
              }});
            }
          } else {
            console.warn('[LessonView] No image result, using fallback');
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
          console.warn('[LessonView] Image fetch error:', e);
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
  }, [propLesson, subject, courseId, courseDescription]);

  // Start preloading lesson image as soon as lesson data is available
  useEffect(() => {
    if (!propLesson || !subject || !courseId) return;

    // Start preloading in background immediately
    const startPreload = async () => {
      try {
        console.log('[LessonView] Starting background image preload for:', propLesson.title);
        await lessonImagePreloader.preloadLessonImage(
          propLesson,
          subject,
          courseId,
          Array.from(localUsedImageTitles),
          Array.from(localUsedImageUrls),
          courseDescription
        );
      } catch (error) {
        console.warn('[LessonView] Background preload error:', error);
      }
    };

    startPreload();
  }, [propLesson?.id, propLesson?.title, subject, courseId]);

  // Preload current lesson image for better performance (only if not already loaded)
  useEffect(() => {
    if (!propLesson || !propLesson.image) return;

    const imageUrl = propLesson.image.imageUrl || propLesson.image.url;
    if (!imageUrl) return;

    // Only preload if not already preloaded and not already loaded
    if (!imagePreloadService.isPreloaded(imageUrl) && !imageData?.url) {
      const preloadCurrentImage = async () => {
        try {
          // Preload the current lesson's image with high priority
          await imagePreloadService.preloadLessonImages(propLesson, 10);
          console.log('[LessonView] Preloaded current lesson image');
          
          // Track performance
          const preloadTime = performance.now() - renderStartTime.current;
          performanceMonitor.trackImageLoad(imageUrl, preloadTime, true);
        } catch (error) {
          console.warn('[LessonView] Image preloading error:', error);
        }
      };

      // Run preloading in background with higher priority
      preloadCurrentImage();
    } else {
      console.log('[LessonView] Image already preloaded or loaded, skipping preload');
    }
  }, [propLesson?.id, propLesson?.image, imageData?.url]);

  // Clean up any remaining malformed asterisks after content is rendered (optimized for performance)
  useEffect(() => {
    if (propLesson?.content) {
      const lessonContent = cleanAndCombineContent(propLesson.content);
      
      // Use requestIdleCallback for better performance if available, otherwise use timeout
      const cleanupFunction = () => {
        const markdownElements = document.querySelectorAll('.lesson-content .markdown-body');
        markdownElements.forEach(element => {
          // Only clean up obvious malformed patterns, not entire paragraphs
          element.innerHTML = element.innerHTML
            .replace(/\*\*\*\*/g, '**')                // Clean up multiple asterisks
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
  }, [propLesson?.content]);

  // Performance monitoring with enhanced tracking
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    performanceMonitor.trackComponentRender('LessonView', renderTime);
    
    // Track render performance and provide recommendations
    if (renderTime > 100) {
      console.warn('[LessonView] Slow render detected:', renderTime + 'ms');
    }
    
    // Track component render count
    performanceMonitor.trackComponentRender('LessonView');
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

  // Debug logging for image data (reduced frequency to prevent spam)
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.05) {
  console.log('[LessonView] Current imageData state:', imageData);
  console.log('[LessonView] imageLoading state:', imageLoading);
  }
  
  // Track main component render time
  const currentRenderTime = performance.now();
  
  const componentJSX = (
    <div className="flex-1 flex flex-col p-6 bg-white overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{propLesson?.title}</h2>
        <p className="text-md text-gray-600">{moduleTitle}</p>
        {imageLoading && (
          <div className="lesson-image-container loading" style={{ 
            minHeight: '300px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px'
          }}>
            <div className="image-loading">Loading image...</div>
          </div>
        )}
        {imageData && imageData.url && !imageLoading && (
          <figure className="lesson-image-container" style={{ 
            maxWidth: 700, 
            margin: '0 auto',
            minHeight: '300px',
            position: 'relative'
          }}>
            <Image
              src={imageData.url}
              alt={propLesson?.title || 'Lesson illustration'}
              className="lesson-image"
              style={{ width: '100%', height: 'auto' }}
              priority={true}
              preload={true}
              lazy={false}
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
        
        {/* Spacing between navigation and content */}
        <div className="mb-6"></div>
        
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
        
        {/* Spacing between content and messages */}
        <div className="mb-4"></div>
        
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
        
        {/* Spacing between messages and footer */}
        <div className="mb-6"></div>
      </div>

      <footer className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={() => {
                // Track navigation for analytics
                if (propLesson?.id && activeModule?.id) {
                  predictiveAnalyticsService.recordNavigation(
                    propLesson.id,
                    'previous',
                    {
                      timeSpent: Date.now() - (lessonStartTime || Date.now()),
                      scrollDepth: window.scrollY / document.body.scrollHeight,
                      interactions: 0
                    }
                  );
                }
                
                handleStopAudio();
                if (onPreviousLesson) onPreviousLesson();
              }}
              disabled={currentLessonIndex === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <i className="fas fa-arrow-left mr-2"></i>Previous
            </button>
            <span className="text-sm text-gray-600 text-center">
              {currentLessonIndex + 1} / {Math.max(totalLessonsInModule, 1)}
            </span>
            <button
              onClick={() => {
                // Track navigation for analytics
                if (propLesson?.id && activeModule?.id) {
                  predictiveAnalyticsService.recordNavigation(
                    propLesson.id,
                    'next',
                    {
                      timeSpent: Date.now() - (lessonStartTime || Date.now()),
                      scrollDepth: window.scrollY / document.body.scrollHeight,
                      interactions: 0
                    }
                  );
                }
                
                handleStopAudio();
                if (onNextLesson) onNextLesson();
              }}
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
  
  // Track render time and return component
  const renderTime = performance.now() - currentRenderTime;
  imagePerformanceMonitor.trackRenderTime('LessonView', renderTime);
  
  return componentJSX;
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