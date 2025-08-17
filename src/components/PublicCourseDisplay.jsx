import React, { useState, useEffect, useCallback, useMemo, memo, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLessonView from './PublicLessonView';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import NoCourseState from './NoCourseState';
import Module from '../models/Module';
import publicCourseSessionService from '../services/PublicCourseSessionService';

// Lazy load QuizView
const QuizView = lazy(() => import('./QuizView'));

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const PublicCourseDisplay = () => {
  const { courseId, lessonId: activeLessonIdFromParam } = useParams();
  const navigate = useNavigate();
  const api = useApiWrapper();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const [showQuiz, setShowQuiz] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(new Set());
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState('');
  
  const handleQuizCompletion = useCallback(async (lessonId, score) => {
    if (!course || !sessionId) return;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PublicQuizCompletion] Received score: ${score} for lessonId: ${lessonId}`);
    }

    let moduleOfCompletedQuizId = null;

    // Find the module containing this lesson
    const module = course.modules.find(m => m.lessons.some(l => l.id === lessonId));
    if (module) {
      moduleOfCompletedQuizId = module.id;
    }

    try {
      // Save quiz score to session
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
        console.log(`[PublicCourseDisplay] Quiz score saved for session ${sessionId}, lesson ${lessonId}: ${score}`);
        
        // Update the lesson with the quiz score
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

        // Check if all quizzes in the module are perfect
        const updatedModule = updatedCourse.modules.find(m => m.id === moduleOfCompletedQuizId);
        const lessonsWithQuizzes = updatedModule?.lessons.filter(l => l.quiz && l.quiz.length > 0) || [];
        const perfectScores = lessonsWithQuizzes.filter(l => l.quizScore === 5);

        if (process.env.NODE_ENV === 'development') {
          console.log('[PublicQuizCompletion] Module completion check:', {
            moduleId: moduleOfCompletedQuizId,
            moduleTitle: updatedModule?.title,
            totalLessonsWithQuizzes: lessonsWithQuizzes.length,
            perfectScores: perfectScores.length,
            lessonScores: updatedModule?.lessons.map(l => ({
              id: l.id,
              title: l.title,
              score: l.quizScore
            }))
          });
        }

        // If all quizzes in the module are perfect, unlock the next module
        if (perfectScores.length === lessonsWithQuizzes.length && lessonsWithQuizzes.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[PublicQuizCompletion] All quizzes perfect! Unlocking next module.');
          }

          // Find the current module index
          const currentModuleIndex = course.modules.findIndex(m => m.id === moduleOfCompletedQuizId);
          const nextModuleIndex = currentModuleIndex + 1;

          // Update unlocked modules state
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

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        
        // Get or create session ID from URL or localStorage
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          const urlParams = new URLSearchParams(window.location.search);
          currentSessionId = urlParams.get('sessionId');
          
          if (!currentSessionId) {
            currentSessionId = publicCourseSessionService.createSession(courseId);
            // Update URL with session ID
            const newUrl = `${window.location.pathname}?sessionId=${currentSessionId}`;
            window.history.replaceState({}, '', newUrl);
          }
          
          setSessionId(currentSessionId);
        }
        
        const courseData = await api.getPublicCourse(courseId, currentSessionId);
        
        if (courseData && courseData.modules) {
          courseData.modules = courseData.modules.map(m => Module.fromJSON(m));
        }

        setCourse(courseData);
        if (courseData.modules && courseData.modules.length > 0) {
          const firstModule = courseData.modules[0];
          setActiveModuleId(firstModule.id);
          if (firstModule.lessons && firstModule.lessons.length > 0) {
            setActiveLessonId(firstModule.lessons[0].id);
          }
        }
      } catch (err) {
        setError('Failed to load course.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, api, sessionId]);

  useEffect(() => {
    const checkMobile = () => window.innerWidth < 768;
    const isMobile = checkMobile();
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, []);

  // Calculate unlocked modules based on quiz completion (similar to original CourseDisplay)
  useEffect(() => {
    if (course && sessionId) {
      const initialUnlocked = new Set();
      initialUnlocked.add(course.modules[0]?.id); // First module is always unlocked
      
      // Check quiz completion for subsequent modules
      for (let i = 1; i < course.modules.length; i++) {
        const previousModule = course.modules[i - 1];
        const lessonsWithQuizzes = previousModule.lessons.filter(l => l.quiz && l.quiz.length > 0);
        
        if (lessonsWithQuizzes.length === 0) {
          // If no quizzes, unlock the next module
          initialUnlocked.add(course.modules[i].id);
        } else {
          // Check if all quizzes have perfect scores
          const perfectScores = lessonsWithQuizzes.filter(l => l.quizScore === 5);
          if (perfectScores.length === lessonsWithQuizzes.length) {
            initialUnlocked.add(course.modules[i].id);
          }
        }
      }
      
      setUnlockedModules(initialUnlocked);
    }
  }, [course, sessionId]);

  const handleModuleSelect = useCallback((moduleId) => {
    if (!course?.modules) return;
    const moduleData = course.modules.find(m => m.id === moduleId);
    if (!moduleData || !unlockedModules.has(moduleId)) return;
    
    setActiveModuleId(moduleId);
    if (moduleData.lessons.length > 0) {
      const firstLessonId = moduleData.lessons[0].id;
      setActiveLessonId(firstLessonId);
      navigate(`/public/course/${courseId}/lesson/${firstLessonId}`, { replace: true });
    }
    setShowQuiz(false);
  }, [course, unlockedModules, courseId, navigate, setActiveModuleId, setActiveLessonId]);

  const handleLessonClick = (lessonId) => {
    setActiveLessonId(lessonId);
    navigate(`/public/course/${courseId}/lesson/${lessonId}`, { replace: true });
    setShowQuiz(false);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNextLesson = useCallback(() => {
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLesson = currentModule.lessons[currentLessonIndex + 1];
      handleLessonClick(nextLesson.id);
    }
  }, [course, activeModuleId, activeLessonId]);

  const handlePreviousLesson = useCallback(() => {
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex > 0) {
      const previousLesson = currentModule.lessons[currentLessonIndex - 1];
      handleLessonClick(previousLesson.id);
    }
  }, [course, activeModuleId, activeLessonId]);

  const handleShare = () => {
    const publicUrl = window.location.href;
    navigator.clipboard.writeText(publicUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Find the current module - first try by activeModuleId, then fallback to finding module containing current lesson
  let currentModule = course ? course.modules.find(m => m.id === activeModuleId) : null;
  let currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);
  
  // If currentModule is null but we have activeLessonId, try to find the module containing this lesson
  if (!currentModule && activeLessonId && course) {
    currentModule = course.modules.find(m => m.lessons.some(l => l.id === activeLessonId));
    if (currentModule) {
      currentLesson = currentModule.lessons.find(l => l.id === activeLessonId);
      // Update activeModuleId to match the found module
      if (activeModuleId !== currentModule.id) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[PublicCourseDisplay] Updating activeModuleId from ${activeModuleId} to ${currentModule.id}`);
        }
        setActiveModuleId(currentModule.id);
      }
    }
  }
  
  // Calculate lesson index and total lessons for navigation
  const currentLessonIndex = currentModule?.lessons.findIndex(l => l.id === activeLessonId) ?? 0;
  const totalLessonsInModule = currentModule?.lessons?.length ?? 0;
  
  // Debug logging to help identify the issue (only log once per render cycle)
  if (process.env.NODE_ENV === 'development') {
    console.log('[PublicCourseDisplay] Module/Lesson Debug:', {
      courseId: course?.id,
      activeModuleId,
      activeLessonId,
      currentModule: currentModule ? { id: currentModule.id, title: currentModule.title } : null,
      currentLesson: currentLesson ? { id: currentLesson.id, title: currentLesson.title } : null,
      totalModules: course?.modules?.length,
      currentLessonIndex,
      totalLessonsInModule
    });
  }



  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <NoCourseState />;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-gray-800 leading-tight">{course.title}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{course.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course.modules.map((module, moduleIndex) => {
            const isLocked = !unlockedModules.has(module.id);
            const lessonsWithQuizzes = module.lessons.filter(l => l.quiz && l.quiz.length > 0);
            // For public courses, we don't have user-specific quiz scores, so we'll show all modules as unlocked
            const perfectScores = []; // Empty for public courses
            const quizProgress = lessonsWithQuizzes.length > 0 ? `0/${lessonsWithQuizzes.length}` : null;
            
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
                {module.id === activeModuleId && !isLocked && (
                  <ul className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1">
                    {module.lessons.map(lesson => (
                      <li key={lesson.id}>
                        <button
                          onClick={() => handleLessonClick(lesson.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150 flex items-center justify-between
                            ${lesson.id === activeLessonId 
                              ? 'bg-blue-100 text-blue-700 font-medium' 
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                          `}
                        >
                          <span>{lesson.title}</span>
                          {lesson.quiz && lesson.quiz.length > 0 && (
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
        <div className="p-4 border-t">
          <button onClick={handleShare} className="w-full relative bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center shadow">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
              Share
              {shareCopied && <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg">Copied!</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 mr-4 md:hidden">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div className="text-center flex-1">
            {currentLesson && <h1 className="text-2xl font-bold text-gray-900 truncate">{currentLesson.title}</h1>}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {showQuiz && currentLesson ? (
            <Suspense fallback={<div>Loading Quiz...</div>}>
              <QuizView
                key={currentLesson.id}
                questions={currentLesson.quiz}
                onComplete={(score) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[PublicCourseDisplay] Quiz completed with score: ${score} for lesson: ${currentLesson.id}`);
                  }
                  handleQuizCompletion(currentLesson.id, score);
                  // Don't automatically switch back to content - let user choose
                }}
                lessonId={currentLesson.id}
                module={currentModule}
              />
            </Suspense>
          ) : (
            currentLesson ? (
              <PublicLessonView
                  lesson={currentLesson}
                  moduleTitle={currentModule?.title}
                  subject={course.subject}
                  courseId={courseId}
                  onNextLesson={handleNextLesson}
                  onPreviousLesson={handlePreviousLesson}
                  onTakeQuiz={() => setShowQuiz(true)}
                  currentLessonIndex={currentLessonIndex}
                  totalLessonsInModule={totalLessonsInModule}
                  activeModule={currentModule}
                  courseDescription={course.description}
              />
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

export default memo(PublicCourseDisplay);