import React, { useState, useEffect, useCallback, Suspense, lazy, useMemo, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import Module from '../models/Module';
import Flashcard from './Flashcard';
import Image from './Image';
import markdownService from '../services/MarkdownService';
import { fixMalformedContent, formatContentForDisplay, cleanContentFormatting, validateContent, getContentAsString } from '../utils/contentFormatter';

// Lazy load QuizView
const QuizView = lazy(() => import('./QuizView'));

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

// Helper function to clean remaining malformed asterisks
const cleanupRemainingAsterisks = (text) => {
  if (!text) return text;
  return text
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

// Memoized Flashcard component to prevent unnecessary re-renders
const MemoizedFlashcard = memo(Flashcard);

// Memoized flashcard renderer with proper dependency tracking
const FlashcardRenderer = memo(({ flashcards }) => {
  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 mb-4">No flashcards available for this lesson.</p>
        <p className="text-sm text-gray-500">Flashcard content will be generated automatically for new lessons.</p>
      </div>
    );
  }

  // Deduplicate flashcards based on the term
  const uniqueFlashcards = useMemo(() => {
    return Array.from(new Map(flashcards.map(card => [(card.term || card.question || '').toLowerCase(), card])).values());
  }, [flashcards]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {uniqueFlashcards.map((fc, index) => (
        <MemoizedFlashcard
          key={`${fc.term || fc.question || 'unknown'}-${index}`}
          term={fc.term || fc.question || 'Unknown Term'}
          definition={fc.definition || fc.answer || 'Definition not provided.'}
        />
      ))}
    </div>
  );
});

const PublicCourseDisplay = () => {
  console.log('[PublicCourseDisplay] Component initializing...');
  
  const { courseId, lessonId: activeLessonIdFromParam } = useParams();
  const navigate = useNavigate();
  const api = useApiWrapper();
  
  console.log('[PublicCourseDisplay] Hooks initialized:', { courseId, activeLessonIdFromParam, navigate: !!navigate, api: !!api });

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(new Set());
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [isReading, setIsReading] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Guard clause to ensure all dependencies are available
  console.log('[PublicCourseDisplay] Checking dependencies...');
  
  if (!courseId) {
    console.warn('[PublicCourseDisplay] No courseId available');
    return <LoadingState />;
  }
  
  if (!navigate) {
    console.warn('[PublicCourseDisplay] No navigate function available');
    return <LoadingState />;
  }
  
  if (!api) {
    console.warn('[PublicCourseDisplay] No api available');
    return <LoadingState />;
  }
  
  console.log('[PublicCourseDisplay] All dependencies available, proceeding...');

  // Load quiz scores from session
  const loadSessionQuizScores = useCallback(async (courseData, sessionId) => {
    if (!courseData || !sessionId || !courseId) return courseData;
    
    try {
      const response = await fetch(`/api/public/courses/${courseId}/quiz-scores?sessionId=${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        const quizScores = sessionData.quizScores || {};
        
        const updatedCourseData = {
          ...courseData,
          modules: courseData.modules.map(module => ({
            ...module,
            lessons: module.lessons.map(lesson => ({
              ...lesson,
              quizScore: quizScores[lesson.id] || lesson.quizScore
            }))
          }))
        };
        
        return updatedCourseData;
      }
    } catch (error) {
      console.warn('[PublicCourseDisplay] Failed to load session quiz scores:', error);
    }
    
    return courseData;
  }, [courseId]);

  // Handle quiz completion
  const handleQuizCompletion = useCallback(async (lessonId, score) => {
    if (!course?.modules || !sessionId || !courseId) return;

    let moduleOfCompletedQuizId = null;
    const module = course.modules.find(m => m.lessons.some(l => l.id === lessonId));
    if (module) {
      moduleOfCompletedQuizId = module.id;
    }

    try {
      const response = await fetch(`/api/public/courses/${courseId}/quiz-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          lessonId,
          score
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.newSession && result.sessionId) {
          setSessionId(result.sessionId);
          const newUrl = `${window.location.pathname}?sessionId=${result.sessionId}`;
          window.history.replaceState({}, '', newUrl);
        }
        
        const updatedCourse = {
          ...course,
          modules: course.modules.map(m => {
            if (m.id === moduleOfCompletedQuizId) {
              return {
                ...m,
                lessons: m.lessons.map(l => 
                  l.id === lessonId ? { ...l, quizScore: score } : l
                )
              };
            }
            return m;
          })
        };

        setCourse(updatedCourse);

        const updatedModule = updatedCourse.modules.find(m => m.id === moduleOfCompletedQuizId);
        const lessonsWithQuizzes = updatedModule?.lessons.filter(l => l.quiz && l.quiz.length > 0) || [];
        const perfectScores = lessonsWithQuizzes.filter(l => l.quizScore === 5);

        if (perfectScores.length === lessonsWithQuizzes.length && lessonsWithQuizzes.length > 0) {
          const currentModuleIndex = course.modules.findIndex(m => m.id === moduleOfCompletedQuizId);
          const nextModuleIndex = currentModuleIndex + 1;

          const newUnlockedModules = new Set(unlockedModules);
          if (nextModuleIndex < course.modules.length) {
            const nextModule = course.modules[nextModuleIndex];
            newUnlockedModules.add(nextModule.id);
            setUnlockedModules(newUnlockedModules);
            setShowUnlockToast(true);
            setUnlockedModuleName(nextModule.title);
            setTimeout(() => setShowUnlockToast(false), 5000);
          }
        }
      }
    } catch (error) {
      console.error('[PublicCourseDisplay] Failed to save quiz score:', error);
    }
  }, [course, sessionId, courseId, unlockedModules]);

  // Handle read aloud functionality
  const handleReadAloud = useCallback((lessonContent) => {
    if (!lessonContent) return;
    
    if (isReading) {
      // Stop reading
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsReading(false);
    } else {
      // Start reading
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(lessonContent);
        utterance.onend = () => setIsReading(false);
        utterance.onerror = () => setIsReading(false);
        window.speechSynthesis.speak(utterance);
        setIsReading(true);
      }
    }
  }, [isReading]);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        
        const oldSessionKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('session_') || key.includes('quizScore') || key.includes('courseProgress')
        );
        if (oldSessionKeys.length > 0) {
          oldSessionKeys.forEach(key => localStorage.removeItem(key));
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const existingSessionId = urlParams.get('sessionId');
        
        let currentSessionId = null;
        
        try {
          let courseData;
          
          if (!existingSessionId) {
            navigate(`/captcha/${courseId}`);
            return;
          }
          
          try {
            courseData = await api.getPublicCourse(courseId, existingSessionId);
          } catch (error) {
            if (error.message && error.message.includes('401')) {
              navigate(`/captcha/${courseId}`);
              return;
            }
            throw error;
          }
          
          currentSessionId = courseData.sessionId;
          
          const newUrl = `${window.location.pathname}?sessionId=${currentSessionId}`;
          window.history.replaceState({}, '', newUrl);
          
          if (courseData && courseData.modules) {
            courseData.modules = courseData.modules.map(m => Module.fromJSON(m));
          }

          const courseDataWithScores = await loadSessionQuizScores(courseData, currentSessionId);
          setCourse(courseDataWithScores);
          if (courseData.modules && courseData.modules.length > 0) {
            const firstModule = courseData.modules[0];
            setActiveModuleId(firstModule.id);
            if (firstModule.lessons && firstModule.lessons.length > 0) {
              setActiveLessonId(firstModule.lessons[0].id);
            }
          }
        } catch (error) {
          console.error('[PublicCourseDisplay] Error fetching course:', error);
          setError('Failed to load course.');
        }
        
        setSessionId(currentSessionId);
      } catch (err) {
        setError('Failed to load course.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, api, navigate, loadSessionQuizScores]);

  // Handle mobile layout
  useEffect(() => {
    const checkMobile = () => window.innerWidth < 768;
    const isMobile = checkMobile();
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, []);

  // Calculate unlocked modules
  useEffect(() => {
    if (course?.modules && sessionId) {
      const initialUnlocked = new Set();
      initialUnlocked.add(course.modules[0]?.id);
      
      for (let i = 1; i < course.modules.length; i++) {
        const previousModule = course.modules[i - 1];
        const lessonsWithQuizzes = previousModule.lessons.filter(l => l.quiz && l.quiz.length > 0);
        
        if (lessonsWithQuizzes.length === 0) {
          initialUnlocked.add(course.modules[i].id);
        } else {
          const perfectScores = lessonsWithQuizzes.filter(l => l.quizScore === 5);
          if (perfectScores.length === lessonsWithQuizzes.length) {
            initialUnlocked.add(course.modules[i].id);
          }
        }
      }
      
      setUnlockedModules(initialUnlocked);
    }
  }, [course, sessionId]);

  // Handle module selection
  const handleModuleSelect = useCallback((moduleId) => {
    if (!course?.modules || !courseId) return;
    const moduleData = course.modules.find(m => m.id === moduleId);
    if (!moduleData || !unlockedModules.has(moduleId)) return;
    
    setActiveModuleId(moduleId);
    if (moduleData.lessons.length > 0) {
      const firstLessonId = moduleData.lessons[0].id;
      setActiveLessonId(firstLessonId);
      navigate(`/public/course/${courseId}/lesson/${firstLessonId}`, { replace: true });
    }
    setShowQuiz(false);
  }, [course, unlockedModules, courseId, navigate]);

  // Handle lesson click
  const handleLessonClick = useCallback((lessonId) => {
    if (!courseId) return;
    setActiveLessonId(lessonId);
    navigate(`/public/course/${courseId}/lesson/${lessonId}`, { replace: true });
    setShowQuiz(false);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [courseId, navigate]);

  // Handle next lesson
  const handleNextLesson = useCallback(() => {
    if (!course?.modules || !courseId) return;
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLesson = currentModule.lessons[currentLessonIndex + 1];
      handleLessonClick(nextLesson.id);
    }
  }, [course, activeModuleId, activeLessonId, handleLessonClick, courseId]);

  // Handle previous lesson
  const handlePreviousLesson = useCallback(() => {
    if (!course?.modules || !courseId) return;
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex > 0) {
      const previousLesson = currentModule.lessons[currentLessonIndex - 1];
      handleLessonClick(previousLesson.id);
    }
  }, [course, activeModuleId, activeLessonId, handleLessonClick, courseId]);

  // Find current module and lesson
  const currentModule = course ? course.modules.find(m => m.id === activeModuleId) : null;
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);
  const currentLessonIndex = currentModule?.lessons.findIndex(l => l.id === activeLessonId) ?? 0;
  const totalLessonsInModule = currentModule?.lessons?.length ?? 0;

  // Extract and process flashcard data
  const flashcardData = useMemo(() => {
    // Check multiple possible locations for flashcard data
    const flashcards = currentLesson?.flashcards || 
                      currentLesson?.content?.flashcards || 
                      currentLesson?.cards ||
                      currentLesson?.studyCards;
    
    return flashcards;
  }, [currentLesson]);

  // Process lesson content
  const processedContent = useMemo(() => {
    if (!currentLesson?.content) return '';
    return cleanAndCombineContent(currentLesson.content);
  }, [currentLesson?.content]);

  // Handle image display
  useEffect(() => {
    if (currentLesson?.image && (currentLesson.image.imageUrl || currentLesson.image.url)) {
      const imageUrl = currentLesson.image.imageUrl || currentLesson.image.url;
      const imageTitle = currentLesson.image.imageTitle || currentLesson.image.title;
      
      setImageData({
        url: imageUrl,
        title: imageTitle,
        pageURL: currentLesson.image.pageURL,
        attribution: currentLesson.image.attribution,
      });
      setImageLoading(false);
    } else {
      setImageData(null);
      setImageLoading(false);
    }
  }, [currentLesson?.image]);

  // Handle module ID updates
  useEffect(() => {
    if (!currentModule && activeLessonId && course?.modules) {
      const foundModule = course.modules.find(m => m.lessons.some(l => l.id === activeLessonId));
      if (foundModule && activeModuleId !== foundModule.id) {
        setActiveModuleId(foundModule.id);
      }
    }
  }, [course, activeLessonId, activeModuleId, currentModule]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <LoadingState />;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-black leading-tight">{course?.title}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{course?.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course?.modules?.map((module, moduleIndex) => {
            const isLocked = !unlockedModules.has(module?.id);
            const lessonsWithQuizzes = module?.lessons?.filter(l => l.quiz && l.quiz.length > 0) || [];
            const perfectScores = lessonsWithQuizzes.filter(l => l.quizScore === 5);
            const quizProgress = lessonsWithQuizzes.length > 0 ? `${perfectScores.length}/${lessonsWithQuizzes.length}` : null;
            
            return (
              <div key={module.id}>
                <h2 
                  onClick={() => handleModuleSelect(module.id)}
                  className={`text-lg font-semibold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors flex items-center justify-between ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center">
                    {isLocked && (
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                    )}
                    {module.title}
                  </div>
                  {quizProgress && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      perfectScores.length === lessonsWithQuizzes.length 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {quizProgress}
                    </span>
                  )}
                </h2>
                {module?.id === activeModuleId && !isLocked && (
                  <ul className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1">
                    {module?.lessons?.map(lesson => (
                      <li key={lesson.id}>
                        <button
                          onClick={() => handleLessonClick(lesson?.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150 flex items-center justify-between
                            ${lesson?.id === activeLessonId 
                              ? 'bg-blue-100 text-blue-700 font-medium' 
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                          `}
                        >
                          <span>{lesson?.title}</span>
                          {lesson?.quiz && lesson.quiz.length > 0 && lesson.quizScore === 5 && (
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {lesson?.quiz && lesson.quiz.length > 0 && lesson.quizScore !== 5 && (
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 mr-4 md:hidden">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div className="text-center flex-1">
            {currentLesson && <h1 className="text-2xl font-bold text-black truncate">{currentLesson.title}</h1>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {showQuiz && currentLesson ? (
            <Suspense fallback={<div>Loading Quiz...</div>}>
              <QuizView
                key={currentLesson.id}
                questions={currentLesson.quiz}
                onComplete={(score) => {
                  handleQuizCompletion(currentLesson.id, score);
                }}
                lessonId={currentLesson.id}
                module={currentModule}
              />
            </Suspense>
          ) : (
            currentLesson ? (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm">
                  {/* Tab Navigation */}
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                      <button
                        onClick={() => setActiveTab('content')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'content'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Content
                      </button>
                      {flashcardData && flashcardData.length > 0 && (
                        <button
                          onClick={() => setActiveTab('flashcards')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'flashcards'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Flashcards
                        </button>
                      )}
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="p-8">
                    {activeTab === 'content' && (
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-3xl font-bold text-gray-900">{currentLesson.title}</h2>
                          <button
                            onClick={() => handleReadAloud(processedContent)}
                            className={`px-4 py-2 rounded-md text-white font-medium ${
                              isReading ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isReading ? 'Stop Reading' : 'Read Aloud'}
                          </button>
                        </div>
                        
                        {/* Image Display */}
                        {imageLoading && (
                          <div className="lesson-image-container loading mb-6" style={{ 
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
                          <figure className="lesson-image-container mb-6" style={{ 
                            maxWidth: 700, 
                            margin: '0 auto',
                            minHeight: '300px',
                            position: 'relative'
                          }}>
                            <Image
                              src={imageData.url}
                              alt={currentLesson?.title || 'Lesson illustration'}
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
                              {imageData.title || ''}
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
                        
                        <div 
                          className="prose prose-lg max-w-none lesson-content-text"
                          dangerouslySetInnerHTML={{ __html: processedContent }}
                          style={{
                            lineHeight: '1.8',
                            color: '#374151',
                            textAlign: 'justify'
                          }}
                        />
                      </div>
                    )}

                    {activeTab === 'flashcards' && (
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Flashcards</h2>
                        <FlashcardRenderer flashcards={flashcardData} />
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="border-t border-gray-200 p-6">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={handlePreviousLesson}
                        disabled={currentLessonIndex === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous Lesson
                      </button>
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                          Lesson {currentLessonIndex + 1} of {totalLessonsInModule}
                        </span>
                        {currentLesson.quiz && currentLesson.quiz.length > 0 && (
                          <button
                            onClick={() => setShowQuiz(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            Take Quiz
                          </button>
                        )}
                      </div>
                      
                      <button
                        onClick={handleNextLesson}
                        disabled={currentLessonIndex === totalLessonsInModule - 1}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next Lesson
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 pt-10">
                <p>Select a lesson to begin.</p>
              </div>
            )
          )}
          {showUnlockToast && (
            <div className="fixed bottom-5 right-5 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
              <strong className="font-bold">Module Unlocked!</strong>
              <span className="block sm:inline"> You can now access {unlockedModuleName}.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PublicCourseDisplay;