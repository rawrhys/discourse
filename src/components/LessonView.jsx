import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import ImageService from '../services/ImageService';
import Flashcard from './Flashcard';
import QuizView from './QuizView';
import AIService from "../services/AIService.js";
import ReactMarkdown from 'react-markdown';
import PropTypes from 'prop-types';
import './LessonView.css';
import ModuleView from './ModuleView';
import WikimediaService from '../services/WikimediaService';

// Lazy load components
const LazyQuizView = lazy(() => import('./QuizView'));
const LazyFlashcard = lazy(() => import('./Flashcard'));

// Memoized Loading component
const LoadingSpinner = memo(() => (
  <div className="flex justify-center items-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
));

// Memoized Content component
const Content = memo(({ content }) => {
  const cleanContent = useCallback((text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(Introduction|Main Content|Conclusion)[:.]?\*\*/gi, '')
      .replace(/^(Introduction|Main Content|Conclusion)[:.]?\s*/gim, '')
      .replace(/\n(Introduction|Main Content|Conclusion)[:.]?\s*/gim, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\*\*/g, '')
      .trim();
  }, []);

  const parseContent = useCallback(() => {
    let sections = {
      introduction: '',
      mainContent: '',
      conclusion: ''
    };

    if (typeof content === 'string') {
      const parts = content.split(/(?=\*\*(?:Introduction|Main Content|Conclusion)|(?:^|\n)(?:Introduction|Main Content|Conclusion)[:.])/i);
      
      parts.forEach(part => {
        const trimmedPart = part.trim();
        if (trimmedPart.match(/^\*\*Introduction|^Introduction/i)) {
          sections.introduction = cleanContent(trimmedPart);
        } else if (trimmedPart.match(/^\*\*Main Content|^Main Content/i)) {
          sections.mainContent = cleanContent(trimmedPart);
        } else if (trimmedPart.match(/^\*\*Conclusion|^Conclusion/i)) {
          sections.conclusion = cleanContent(trimmedPart);
        } else if (!sections.mainContent) {
          sections.mainContent = cleanContent(trimmedPart);
        }
      });
    } else {
      sections = {
        introduction: cleanContent(content?.introduction || ''),
        mainContent: cleanContent(content?.main_content || ''),
        conclusion: cleanContent(content?.conclusion || '')
      };
    }

    return sections;
  }, [content, cleanContent]);

  const renderContent = useCallback(() => {
    const sections = parseContent();
    const parts = [];

    if (sections.introduction) {
      parts.push(`### Introduction\n${sections.introduction}`);
    }

    if (sections.mainContent) {
      parts.push(`### Main Content\n${sections.mainContent}`);
    }

    if (sections.conclusion) {
      parts.push(`### Conclusion\n${sections.conclusion}`);
    }

    const contentToRender = parts.join('\n\n').trim();

    return (
      <div className="prose max-w-none">
        <ReactMarkdown>{contentToRender}</ReactMarkdown>
        <div className="mt-8 pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">References</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li className="text-sm text-gray-600">Livy. (c. 27 BC). Ab Urbe Condita.</li>
            <li className="text-sm text-gray-600">Cornell, T. J. (1995). The Beginnings of Rome: Italy and Rome from the Bronze Age to the Punic Wars (c. 1000-264 BC). Routledge.</li>
            <li className="text-sm text-gray-600">Forsythe, G. (2005). A Critical History of Early Rome: From Prehistory to the First Punic War. University of California Press.</li>
            <li className="text-sm text-gray-600">Claridge, A. (1998). Rome (Oxford Archaeological Guides). Oxford University Press.</li>
            <li className="text-sm text-gray-600">Beard, M. (2015). SPQR: A History of Ancient Rome. Profile Books.</li>
          </ul>
        </div>
      </div>
    );
  }, [parseContent]);

  return renderContent();
});

Content.propTypes = {
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      introduction: PropTypes.string,
      main_content: PropTypes.string,
      conclusion: PropTypes.string
    })
  ])
};

function LessonView({
  lesson: propLesson,
  moduleTitle,
  subject,
  onNextLesson,
  onPreviousLesson,
  currentLessonIndex,
  totalLessonsInModule,
  onUpdateLesson,
  activeModule,
  handleModuleUpdate,
}) {
  const [lesson, setLesson] = useState(propLesson);
  const [view, setView] = useState('content');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const context = useOutletContext();
  const onUnlockAndNavigateNextModule = context?.onUnlockAndNavigateNextModule;
  const [dynamicDefinitions, setDynamicDefinitions] = useState({});
  const [loadingDefinitions, setLoadingDefinitions] = useState({});
  const [showPerfectMessage, setShowPerfectMessage] = useState(false);
  const [pendingModuleUnlock, setPendingModuleUnlock] = useState(false);

  const allKeyTerms = useMemo(() => {
    if (!propLesson?.content) return [];
    let mainContent = '';
    if (typeof propLesson.content === 'string') {
      // Try to extract main content between delimiters
      const parts = propLesson.content.split('|||---|||');
      mainContent = parts.length === 3 ? parts[1] : propLesson.content;
    } else {
      mainContent = propLesson.content?.main_content || '';
    }
    const cleanContent = mainContent
      .replace(/`/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    const boldedTerms = Array.from(cleanContent.matchAll(/\*\*([^*]+)\*\*/g))
      .map(m => m[1].trim())
      .filter(Boolean);
    const stopwords = [
      'and', 'or', 'the', 'a', 'an', 'of', 'for', 'with', 'by', 'in', 'on', 'at', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'will', 'should', 'could', 'would', 'can', 'may', 'might', 'must', 'shall', 'let', 'lets', 'we', 'you', 'your', 'they', 'their', 'it', 'its', 'but', 'if', 'not', 'no', 'yes', 'up', 'out', 'about', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how'
    ];
    return Array.from(new Set(boldedTerms))
      .filter(term => {
        const normalized = term.toLowerCase().replace(/[^a-z ]/g, '').trim();
        return (
          term.length > 1 &&
          term.split(' ').length <= 5 &&
          !['introduction', 'main content', 'conclusion'].includes(normalized) &&
          !stopwords.includes(normalized) &&
          !normalized.startsWith('welcome to our lesson')
        );
      });
  }, [propLesson?.content]);

  useEffect(() => {
    let isCancelled = false;
    async function processTermsSequentially() {
      for (const term of allKeyTerms) {
        if (isCancelled) break;
        if (!dynamicDefinitions[term] && !loadingDefinitions[term]) {
          setLoadingDefinitions(prev => ({ ...prev, [term]: true }));
          try {
            const def = await AIService.generateDefinitionForTerm(propLesson.content, propLesson.title, term);
            if (!isCancelled) {
              setDynamicDefinitions(prev => ({ ...prev, [term]: def }));
            }
          } catch {
            if (!isCancelled) {
              setDynamicDefinitions(prev => ({ ...prev, [term]: 'Definition not available.' }));
            }
          } finally {
            if (!isCancelled) {
              setLoadingDefinitions(prev => ({ ...prev, [term]: false }));
            }
          }
          // Add a delay between requests (e.g., 1 second)
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }
    processTermsSequentially();
    return () => { isCancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propLesson.content, propLesson.title, allKeyTerms.join(',')]);

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    try {
      const aiService = new AIService();
      const updatedLesson = await aiService.regenerateLesson(lesson);
      if (updatedLesson) {
        setLesson(updatedLesson);
        if (onUpdateLesson) {
          onUpdateLesson(updatedLesson);
        }
      }
    } catch (err) {
      setError('Failed to regenerate content. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [lesson, onUpdateLesson]);

  const renderFlashcards = useCallback(() => {
    console.log('[LessonView] Starting flashcard render with:', {
      hasFlashcards: !!lesson?.flashcards,
      flashcardsLength: lesson?.flashcards?.length,
      view,
      lessonContent: typeof lesson?.content === 'string' ? 'string' : 'object'
    });

    // Extract flashcards from lesson content if they exist
    let flashcardsToShow = [];
    if (lesson?.content) {
      // Handle both string and object content formats
      const contentStr = typeof lesson.content === 'string' 
        ? lesson.content 
        : `${lesson.content?.introduction || ''}\n${lesson.content?.main_content || ''}\n${lesson.content?.conclusion || ''}`;
      
      // Clean up markdown formatting before processing
      const cleanContent = contentStr
        .replace(/`/g, '')    // Remove code markers
        .replace(/\n{2,}/g, '\n') // Normalize multiple newlines
        .trim();

      // Remove section headers and their content
      const contentWithoutSections = cleanContent
        .replace(/^(?:Introduction|Main Content|Conclusion)[:.]?\s*(?:\n|$)/gim, '')
        .replace(/\n(?:Introduction|Main Content|Conclusion)[:.]?\s*(?:\n|$)/gim, '\n');

      // First, try to use existing flashcards if available
      if (Array.isArray(lesson?.flashcards) && lesson.flashcards.length > 0) {
        console.log('[LessonView] Raw AI-generated flashcards:', lesson.flashcards);
        lesson.flashcards.forEach((fc, index) => {
          if (fc.term && fc.definition) {
            const cleanTerm = fc.term.trim();
            const cleanDef = fc.definition.trim();
            // Skip invalid flashcards
            if (
              cleanTerm.match(/^(?:Introduction|Main Content|Conclusion|Welcome|Today|In our next)/i) ||
              cleanTerm.includes('Click to flip') ||
              cleanTerm.split(' ').length > 5 ||
              cleanTerm.length < 2 ||
              ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'with', 'by', 'in', 'on', 'at', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'will', 'should', 'could', 'would', 'can', 'may', 'might', 'must', 'shall', 'let', 'lets', 'we', 'you', 'your', 'they', 'their', 'it', 'its', 'but', 'if', 'not', 'no', 'yes', 'up', 'out', 'about', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how'].includes(cleanTerm.toLowerCase()) ||
              cleanTerm.toLowerCase().startsWith('welcome to our lesson')
            ) {
              console.log(`[LessonView] Skipping invalid flashcard ${index}:`, { term: cleanTerm });
              return;
            }
            // Loosen validation: allow short definitions
            if (cleanTerm.length > 0 && cleanDef.length > 1) {
              flashcardsToShow.push({
                term: cleanTerm,
                definition: cleanDef
              });
              console.log(`[LessonView] Added existing flashcard ${index}:`, { term: cleanTerm });
            }
          }
        });
      }

      // Extract all unique bolded (**term**) and linked ([term](url)) terms as flashcards
      allKeyTerms.forEach(term => {
        const cleanTerm = term.trim();
        if (
          cleanTerm.length > 1 &&
          cleanTerm.split(' ').length <= 5 &&
          !['introduction', 'main content', 'conclusion'].includes(cleanTerm.toLowerCase()) &&
          !['and', 'or', 'the', 'a', 'an', 'of', 'for', 'with', 'by', 'in', 'on', 'at', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'will', 'should', 'could', 'would', 'can', 'may', 'might', 'must', 'shall', 'let', 'lets', 'we', 'you', 'your', 'they', 'their', 'it', 'its', 'but', 'if', 'not', 'no', 'yes', 'up', 'out', 'about', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how'].includes(cleanTerm.toLowerCase()) &&
          !cleanTerm.toLowerCase().startsWith('welcome to our lesson') &&
          !flashcardsToShow.some(fc => fc.term.toLowerCase() === cleanTerm.toLowerCase())
        ) {
          let definition = dynamicDefinitions[cleanTerm];
          if (!definition) {
            definition = 'Key term in this lesson.';
          }
          flashcardsToShow.push({
            term: cleanTerm,
            definition
          });
        }
      });

      console.log('[LessonView] All flashcards before deduplication:', {
        count: flashcardsToShow.length,
        cards: flashcardsToShow
      });
    }

    // Remove duplicates while preserving order
    const uniqueCards = Array.from(
      new Map(
        flashcardsToShow.map(card => [card.term.toLowerCase(), card])
      ).values()
    );

    console.log('[LessonView] Final unique flashcards:', {
      count: uniqueCards.length,
      cards: uniqueCards
    });

    if (uniqueCards.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">No flashcards available for this lesson.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {uniqueCards.map((fc, index) => {
          const isLoading = loadingDefinitions[fc.term];
          const dynamicDef = dynamicDefinitions[fc.term];
          let definition = fc.definition;
          if (definition === 'Key term in this lesson.') {
            if (isLoading) definition = 'Loading definition...';
            else if (dynamicDef) definition = dynamicDef;
          }
          return (
            <Suspense key={`${fc.term}-${index}`} fallback={<LoadingSpinner />}>
              <LazyFlashcard
                key={`${fc.term}-${index}`}
                term={fc.term || ''}
                definition={definition || ''}
                index={index}
              />
            </Suspense>
          );
        })}
      </div>
    );
  }, [lesson?.flashcards, lesson?.content, view, dynamicDefinitions, loadingDefinitions, allKeyTerms]);

  useEffect(() => {
    setLesson(propLesson);
    // Only set view to 'content' if this is the first mount
    setIsLoading(false);
    const contentStr = typeof propLesson.content === 'string' 
      ? propLesson.content 
      : propLesson.content?.main_content || '';
    if (!contentStr || contentStr.includes('Content generation failed')) {
      setError('Content generation failed. Please try again.');
    } else {
      setError(null);
    }
    // Do not reset view here
    // setView('content');
  }, [propLesson]);

  useEffect(() => {
    let ignore = false;
    setImageLoading(true);
    setImageData(null);
    async function fetchImage() {
      if (propLesson?.title) {
        try {
          const result = await WikimediaService.searchImage(propLesson.title, { content: propLesson.content });
          if (!ignore) setImageData(result);
        } catch (e) {
          if (!ignore) setImageData(null);
        } finally {
          if (!ignore) setImageLoading(false);
        }
      } else {
        setImageLoading(false);
      }
    }
    // Run in background (non-blocking)
    fetchImage();
    return () => { ignore = true; };
  }, [propLesson]);

  const handleTabChange = useCallback((newView) => {
    console.log('[LessonView] Changing view to:', newView, 'Current view:', view);
    setView(newView);
  }, [view]);

  const handleQuizComplete = useCallback((score) => {
    console.log(`[LessonView] onUpdateLesson called for lesson:`, lesson?.id, 'score:', score);
    if (onUpdateLesson && lesson?.id) {
      onUpdateLesson(lesson.id, { 
        quizScore: score, 
        quizCompleted: true 
      });
    }
    if (score === 5) {
      setShowPerfectMessage(true);
      setPendingModuleUnlock(true);
    }
  }, [lesson?.id, onUpdateLesson]);

  const handleRetakeQuiz = useCallback(() => {
    console.log('Retaking quiz');
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!lesson) {
    return <div className="p-8 text-center text-gray-600">Lesson not found.</div>;
  }

  return (
    <div className="flex-1 flex flex-col p-6 bg-white overflow-y-auto">
      <header className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">{lesson?.title}</h2>
        <p className="text-md text-gray-600">{moduleTitle}</p>
        {imageLoading && (
          <div className="lesson-image-container loading">
            <div className="image-loading">Loading image...</div>
          </div>
        )}
        {imageData && imageData.imageUrl && !imageLoading && (
          <figure className="lesson-image-container" style={{ maxWidth: 700, margin: '0 auto' }}>
            <img
              src={imageData.imageUrl}
              alt={lesson?.title || 'Lesson illustration'}
              className="lesson-image"
              style={{
                width: '100%',
                height: 'auto',
                maxWidth: '100%',
                display: 'block',
                background: '#f5f5f5',
                borderRadius: '0.5rem',
                margin: '0 auto'
              }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            {(imageData.attribution || imageData.pageURL) && (
              <figcaption className="image-attribution">
                {imageData.attribution && <span>{imageData.attribution}</span>}
                {imageData.pageURL && (
                  <>
                    {' '}
                    <a href={imageData.pageURL} target="_blank" rel="noopener noreferrer">Source</a>
                  </>
                )}
              </figcaption>
            )}
          </figure>
        )}
      </header>
      <div className="flex-grow">
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => handleTabChange('content')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${view === 'content' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            <i className="fas fa-book-open mr-2"></i>Lesson
          </button>
          <button
            onClick={() => handleTabChange('quiz')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${view === 'quiz' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            disabled={!lesson?.quiz || lesson.quiz.length === 0}
          >
            <i className="fas fa-question-circle mr-2"></i>Quiz {lesson?.quiz?.length ? `(${lesson.quiz.length})` : ''}
          </button>
          <button
            onClick={() => handleTabChange('flashcards')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${view === 'flashcards' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            disabled={false}
          >
            <i className="fas fa-clone mr-2"></i>Flashcards {Array.isArray(lesson?.flashcards) && lesson?.flashcards?.length > 0 ? `(${lesson.flashcards.length})` : ''}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingSpinner />}>
            {view === 'content' && <Content content={lesson?.content} />}
            {view === 'quiz' && (
              <LazyQuizView
                questions={lesson?.quiz || []}
                onComplete={handleQuizComplete}
                lessonContent={lesson?.content}
                lessonTitle={lesson?.title}
                onRetakeQuiz={handleRetakeQuiz}
                lessonId={lesson?.id}
                module={activeModule}
                onModuleUpdate={handleModuleUpdate}
              />
            )}
            {view === 'flashcards' && renderFlashcards()}
          </Suspense>
        </div>
        {showPerfectMessage && (
          <div className="p-4 mb-4 bg-green-100 text-green-800 rounded text-center text-lg font-semibold">
            🎉 Perfect score! The next module is now unlocked. Moving you forward...
          </div>
        )}
      </div>

      <footer className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={onPreviousLesson}
            disabled={currentLessonIndex === 0}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-arrow-left mr-2"></i>Previous
          </button>
          <span className="text-sm text-gray-600">
            {currentLessonIndex + 1} / {totalLessonsInModule}
          </span>
          <button
            onClick={onNextLesson}
            disabled={currentLessonIndex >= totalLessonsInModule - 1}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next<i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </footer>
    </div>
  );
}

LessonView.propTypes = {
  lesson: PropTypes.object,
  moduleTitle: PropTypes.string,
  subject: PropTypes.string,
  onNextLesson: PropTypes.func.isRequired,
  onPreviousLesson: PropTypes.func.isRequired,
  currentLessonIndex: PropTypes.number.isRequired,
  totalLessonsInModule: PropTypes.number.isRequired,
  onUpdateLesson: PropTypes.func.isRequired,
  activeModule: PropTypes.object,
  handleModuleUpdate: PropTypes.func,
};

export default memo(LessonView);