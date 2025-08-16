import React, { useState, useEffect, useCallback, useMemo, memo, useRef, Suspense, lazy } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import LessonView from './LessonView';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import NewCourseButton from './NewCourseButton';
import NoCourseState from './NoCourseState';

// Lazy load QuizView
const QuizView = lazy(() => import('./QuizView'));

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const CourseDisplay = () => {
  const context = useOutletContext();
  const { saveCourse } = useApiWrapper();
  const { user } = useAuth();
  const { courseId, lessonId: activeLessonIdFromParam } = useParams();
  const navigate = useNavigate();

  const {
    course,
    setCourse,
    activeModuleId,
    setActiveModuleId,
    activeLessonId,
    setActiveLessonId,
    handleUpdateLesson,
  } = context;

  const [showQuiz, setShowQuiz] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(new Set());
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState('');

  const handleQuizCompletion = useCallback(async (lessonId, score) => {
    if (!course) return;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[QuizCompletion] Received score: ${score} for lessonId: ${lessonId}`);
    }

    let moduleOfCompletedQuizId = null;

    // Find the module containing this lesson
    const module = course.modules.find(m => m.lessons.some(l => l.id === lessonId));
    if (module) {
      moduleOfCompletedQuizId = module.id;
    }

    // Check if all quizzes in the module are perfect (frontend check)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[QuizCompletion] Starting quiz submission for lesson:`, {
        lessonId,
        score,
        moduleId: moduleOfCompletedQuizId,
        moduleTitle: module?.title
      });
    }

    // Call the backend API to submit the quiz score
    try {
      const token = localStorage.getItem('token');
      if (process.env.NODE_ENV === 'development') {
        console.log(`[QuizCompletion] Token check:`, {
          hasToken: !!token,
          tokenLength: token ? token.length : 0,
          tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
        });
      }
      
      const response = await fetch(`${API_BASE_URL}/api/quizzes/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId: course.id,
          moduleId: moduleOfCompletedQuizId,
          lessonId: lessonId,
          score: score
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[QuizCompletion] Backend response:`, result);
      }

      // Update local state with the backend response
      const newModules = course.modules.map(module => {
        let lessonFound = false;
        const newLessons = module.lessons.map(lesson => {
          if (lesson.id === lessonId) {
            lessonFound = true;

            return {
              ...lesson,
              quizScores: {
                ...(lesson.quizScores || {}),
                [user.id]: score
              }
            };
          }
          return lesson;
        });
        if (lessonFound) {
          moduleOfCompletedQuizId = module.id;
        }
        return { ...module, lessons: newLessons };
      });

      const updatedCourse = { ...course, modules: newModules };
      setCourse(updatedCourse);
      
      // Also store in localStorage for debugging purposes
      if (process.env.NODE_ENV === 'development') {
        const existingScores = JSON.parse(localStorage.getItem('quizScores') || '{}');
        existingScores[`${course.id}_${lessonId}`] = {
          score,
          userId: user.id,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('quizScores', JSON.stringify(existingScores));
        console.log('[QuizCompletion] Stored quiz score in localStorage:', existingScores);
      }

      // NOW calculate if all quizzes are perfect with the updated course state
      const updatedModule = newModules.find(m => m.id === moduleOfCompletedQuizId);
      const lessonsWithQuizzes = updatedModule?.lessons.filter(l => l.quiz && l.quiz.length > 0) || [];
      const perfectScores = lessonsWithQuizzes.filter(l => 
        l.quizScores && l.quizScores[user.id] === 5
      );
      const allQuizzesPerfect = lessonsWithQuizzes.length > 0 && perfectScores.length === lessonsWithQuizzes.length;

      if (process.env.NODE_ENV === 'development') {
        console.log('[QuizCompletion] Updated module completion check:', {
          moduleId: moduleOfCompletedQuizId,
          moduleTitle: updatedModule?.title,
          lessonsWithQuizzes: lessonsWithQuizzes.length,
          perfectScores: perfectScores.length,
          allQuizzesPerfect,
          lessonScores: updatedModule?.lessons.map(l => ({
            lessonId: l.id,
            lessonTitle: l.title,
            hasQuiz: !!(l.quiz && l.quiz.length > 0),
            score: l.quizScores ? l.quizScores[user.id] : undefined
          }))
        });
      }

      // Check if the backend unlocked the next module OR if frontend detects all quizzes perfect
      if (result.unlockedNextModule || allQuizzesPerfect) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[QuizCompletion] ${result.unlockedNextModule ? 'Backend' : 'Frontend'} detected module completion!`);
        }
        const currentModuleIndex = course.modules.findIndex(m => m.id === moduleOfCompletedQuizId);
        
        if (currentModuleIndex !== -1 && currentModuleIndex + 1 < course.modules.length) {
          const nextModule = course.modules[currentModuleIndex + 1];
          if (process.env.NODE_ENV === 'development') {
            console.log(`[QuizCompletion] Unlocking module: ${nextModule.title}`);
          }
          
          // Update unlocked modules state
          setUnlockedModules(prev => {
            const newUnlocked = new Set(prev);
            newUnlocked.add(nextModule.id);
            return newUnlocked;
          });
          
          // Update course state to mark the current module as completed and next module as unlocked
          const updatedCourseWithCompletion = {
            ...updatedCourse,
            modules: updatedCourse.modules.map((m, index) => {
              if (m.id === moduleOfCompletedQuizId) {
                return { ...m, isCompleted: true };
              }
              if (index === currentModuleIndex + 1) {
                return { ...m, isLocked: false };
              }
              return m;
            })
          };
          setCourse(updatedCourseWithCompletion);
          
          setUnlockedModuleName(nextModule.title);
          setShowUnlockToast(true);
          setTimeout(() => setShowUnlockToast(false), 5000);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[QuizCompletion] No next module to unlock or module index not found`);
          }
        }
      } else if (result.moduleCompleted) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[QuizCompletion] Module completed but no next module to unlock.`);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[QuizCompletion] Module not yet complete.`);
        }
      }

      // Force a complete re-render to ensure UI updates
      if (process.env.NODE_ENV === 'development') {
        console.log('[QuizCompletion] Forcing complete re-render');
        setTimeout(() => {
          setCourse(prev => ({ ...prev }));
          setUnlockedModules(prev => new Set(prev));
        }, 200);
      }

    } catch (error) {
      console.error(`[QuizCompletion] Error submitting quiz score:`, error);
      // Still update local state even if backend call fails
      const newModules = course.modules.map(module => {
        let lessonFound = false;
        const newLessons = module.lessons.map(lesson => {
          if (lesson.id === lessonId) {
            lessonFound = true;

            return {
              ...lesson,
              quizScores: {
                ...(lesson.quizScores || {}),
                [user.id]: score
              }
            };
          }
          return lesson;
        });
        if (lessonFound) {
          moduleOfCompletedQuizId = module.id;
        }
        return { ...module, lessons: newLessons };
      });

      const updatedCourse = { ...course, modules: newModules };
      setCourse(updatedCourse);
    }
  }, [course, setCourse]);


  const unlockAudioRef = useRef(null);
  useEffect(() => {
    // Try to load unlock sound, but don't fail if it doesn't exist
    try {
      const audio = new Audio('/sounds/unlock.mp3');
      audio.preload = 'auto';
      audio.volume = 0.7;
      
      // Handle audio loading errors gracefully
      audio.addEventListener('error', (e) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CourseDisplay] Unlock sound file not found, audio disabled');
        }
        unlockAudioRef.current = null;
      });
      
      audio.addEventListener('canplaythrough', () => {
        unlockAudioRef.current = audio;
        if (process.env.NODE_ENV === 'development') {
          console.log('[CourseDisplay] Unlock sound loaded successfully');
        }
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CourseDisplay] Could not load unlock sound:', error.message);
      }
      unlockAudioRef.current = null;
    }
  }, []);

  const prevUnlockedModules = usePrevious(unlockedModules);

  useEffect(() => {
    if (prevUnlockedModules && unlockedModules.size > prevUnlockedModules.size) {
      if (unlockAudioRef.current) {
        unlockAudioRef.current.play().catch(e => {
          // Only log if it's not a "not supported" error (which is expected if no audio file)
          if (!e.message.includes('NotSupportedError')) {
            console.warn('[CourseDisplay] Audio play failed:', e.message);
          }
        });
      }
    }
  }, [unlockedModules, prevUnlockedModules]);
  
  useEffect(() => {
    if (course && course.modules) {
      const initialUnlocked = new Set();
      course.modules.forEach((module, index) => {
        // First module is always unlocked
        if (index === 0) {
          initialUnlocked.add(module.id);
        } else {
          // For subsequent modules, check if they should be unlocked based on previous module completion
          const previousModule = course.modules[index - 1];
          if (previousModule) {
            // Check if previous module has all quizzes completed with perfect scores
            const lessonsWithQuizzes = previousModule.lessons.filter(l => l.quiz && l.quiz.length > 0);
            const perfectScores = lessonsWithQuizzes.filter(l => 
              l.quizScores && l.quizScores[user?.id] === 5
            );
            
            // Unlock if all lessons with quizzes have perfect scores
            if (lessonsWithQuizzes.length > 0 && perfectScores.length === lessonsWithQuizzes.length) {
              initialUnlocked.add(module.id);
            }
          }
        }
      });
      setUnlockedModules(initialUnlocked);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[CourseDisplay] Module unlock status:', course.modules.map((module, index) => ({
          index,
          title: module.title,
          isUnlocked: initialUnlocked.has(module.id),
          lessonsWithQuizzes: module.lessons.filter(l => l.quiz && l.quiz.length > 0).length,
          perfectScores: module.lessons.filter(l => l.quiz && l.quiz.length > 0 && l.quizScores && l.quizScores[user?.id] === 5).length
        })));
      }
    }
  }, [course, user?.id]);
  
  const handleModuleSelect = useCallback((moduleId) => {
    if (!course?.modules) return;
    const moduleData = course.modules.find(m => m.id === moduleId);
    if (!moduleData || !unlockedModules.has(moduleId)) return;
    
    setActiveModuleId(moduleId);
    if (moduleData.lessons.length > 0) {
      const firstLessonId = moduleData.lessons[0].id;
      setActiveLessonId(firstLessonId);
      navigate(`/course/${courseId}/lesson/${firstLessonId}`);
    }
    setShowQuiz(false);
  }, [course, unlockedModules, courseId, navigate, setActiveModuleId, setActiveLessonId]);

  const handleLessonClick = (lessonId) => {
    setActiveLessonId(lessonId);
    navigate(`/course/${courseId}/lesson/${lessonId}`);
    setShowQuiz(false);
    if (window.innerWidth < 768) { // isMobile
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
    const publicUrl = `${window.location.origin}/public/course/${courseId}`;
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
          console.log(`[CourseDisplay] Updating activeModuleId from ${activeModuleId} to ${currentModule.id}`);
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
    console.log('[CourseDisplay] Module/Lesson Debug:', {
      courseId: course?.id,
      activeModuleId,
      activeLessonId,
      currentModule: currentModule ? { id: currentModule.id, title: currentModule.title } : null,
      currentLesson: currentLesson ? { id: currentLesson.id, title: currentLesson.title } : null,
      totalModules: course?.modules?.length,
      currentLessonIndex,
      totalLessonsInModule
    });
    
    // Expose course data to window for debugging
    window.currentCourseData = {
      courseId: course?.id,
      courseTitle: course?.title,
      activeModuleId,
      activeLessonId,
      currentModule: currentModule ? { id: currentModule.id, title: currentModule.title } : null,
      currentLesson: currentLesson ? { id: currentLesson.id, title: currentLesson.title } : null
    };
  }

  const allImageUrls = useMemo(() => {
    if (!course) return [];
    return course.modules.flatMap(m => m.lessons.map(l => l.image?.imageUrl).filter(Boolean));
  }, [course]);

  const allImageTitles = useMemo(() => {
    if (!course) return [];
    return course.modules.flatMap(m => m.lessons.map(l => l.image?.imageTitle).filter(Boolean));
  }, [course]);

  if (!course) return <NoCourseState />;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-gray-800 leading-tight">{course.title}</h1>
             <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
             </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{course.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course.modules.map((module, moduleIndex) => {
            const isLocked = !unlockedModules.has(module.id);
            const lessonsWithQuizzes = module.lessons.filter(l => l.quiz && l.quiz.length > 0);
            const perfectScores = lessonsWithQuizzes.filter(l => 
              l.quizScores && l.quizScores[user?.id] === 5
            );
            const quizProgress = lessonsWithQuizzes.length > 0 ? `${perfectScores.length}/${lessonsWithQuizzes.length}` : null;
            
            // Debug logging for quiz progress
            if (process.env.NODE_ENV === 'development' && moduleIndex === 0) {
              console.log('[CourseDisplay] Quiz Progress Debug:', {
                moduleTitle: module.title,
                lessonsWithQuizzes: lessonsWithQuizzes.length,
                perfectScores: perfectScores.length,
                quizProgress,
                lessonScores: module.lessons.map(l => ({
                  title: l.title,
                  hasQuiz: !!(l.quiz && l.quiz.length > 0),
                  score: l.quizScores ? l.quizScores[user?.id] : undefined
                }))
              });
            }
            
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
                          {lesson.quiz && lesson.quiz.length > 0 && lesson.quizScores && lesson.quizScores[user?.id] === 5 && (
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
          <div className="flex-1 flex justify-end">
            <NewCourseButton />
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
                    console.log(`[CourseDisplay] Quiz completed with score: ${score} for lesson: ${currentLesson.id}`);
                  }
                  handleQuizCompletion(currentLesson.id, score);
                  setShowQuiz(false);
                }}
                lessonId={currentLesson.id}
                module={currentModule}
              />
            </Suspense>
          ) : (
            currentLesson ? (
              <LessonView
                  lesson={currentLesson}
                  moduleTitle={currentModule?.title}
                  subject={course.subject}
                  onUpdateLesson={handleUpdateLesson}
                  usedImageTitles={allImageTitles}
                  usedImageUrls={allImageUrls}
                  courseId={courseId}
                  onNextLesson={handleNextLesson}
                  onPreviousLesson={handlePreviousLesson}
                  onTakeQuiz={() => setShowQuiz(true)}
                  currentLessonIndex={currentLessonIndex}
                  totalLessonsInModule={totalLessonsInModule}
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

export default memo(CourseDisplay);