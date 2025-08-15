import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import LessonView from './LessonView';
import QuizView from './QuizView';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import NewCourseButton from './NewCourseButton';
import NoCourseState from './NoCourseState';

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

    console.log(`[QuizCompletion] Received score: ${score} for lessonId: ${lessonId}`);

    let moduleOfCompletedQuizId = null;

    // Find the module containing this lesson
    const module = course.modules.find(m => m.lessons.some(l => l.id === lessonId));
    if (module) {
      moduleOfCompletedQuizId = module.id;
    }

    // Check if all quizzes in the module are perfect (frontend check)
    const allQuizzesPerfect = module.lessons.every(l => {
      if (l.quiz && l.quiz.length > 0) {
        // If there is a quiz, check if user has perfect score
        return l.quizScores && l.quizScores[user.id] === 5;
      }
      // If there is no quiz, it doesn't block progression
      return true;
    });

    console.log(`[QuizCompletion] Frontend module completion check:`, {
      moduleId: moduleOfCompletedQuizId,
      moduleTitle: module?.title,
      totalLessons: module?.lessons.length,
      lessonsWithQuizzes: module?.lessons.filter(l => l.quiz && l.quiz.length > 0).length,
      allQuizzesPerfect,
      lessonScores: module?.lessons.map(l => ({
        lessonId: l.id,
        lessonTitle: l.title,
        hasQuiz: !!(l.quiz && l.quiz.length > 0),
        score: l.quizScores ? l.quizScores[user.id] : undefined
      }))
    });

    // Call the backend API to submit the quiz score
    try {
      const token = localStorage.getItem('token');
      console.log(`[QuizCompletion] Token check:`, {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
      });
      
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
      console.log(`[QuizCompletion] Backend response:`, result);

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

          // Check if the backend unlocked the next module OR if frontend detects all quizzes perfect
      if (result.unlockedNextModule || allQuizzesPerfect) {
        console.log(`[QuizCompletion] ${result.unlockedNextModule ? 'Backend' : 'Frontend'} detected module completion!`);
        const currentModuleIndex = course.modules.findIndex(m => m.id === moduleOfCompletedQuizId);
        
        if (currentModuleIndex !== -1 && currentModuleIndex + 1 < course.modules.length) {
          const nextModule = course.modules[currentModuleIndex + 1];
          console.log(`[QuizCompletion] Unlocking module: ${nextModule.title}`);
          setUnlockedModules(prev => {
            const newUnlocked = new Set(prev);
            newUnlocked.add(nextModule.id);
            return newUnlocked;
          });
          setUnlockedModuleName(nextModule.title);
          setShowUnlockToast(true);
          setTimeout(() => setShowUnlockToast(false), 5000);
        } else {
          console.log(`[QuizCompletion] No next module to unlock or module index not found`);
        }
      } else if (result.moduleCompleted) {
        console.log(`[QuizCompletion] Module completed but no next module to unlock.`);
      } else {
        console.log(`[QuizCompletion] Module not yet complete.`);
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
    const audio = new Audio('/sounds/unlock.mp3');
    audio.preload = 'auto';
    audio.volume = 0.7;
    unlockAudioRef.current = audio;
  }, []);

  const prevUnlockedModules = usePrevious(unlockedModules);

  useEffect(() => {
    if (prevUnlockedModules && unlockedModules.size > prevUnlockedModules.size) {
      if (unlockAudioRef.current) {
        unlockAudioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
    }
  }, [unlockedModules, prevUnlockedModules]);
  
  useEffect(() => {
    if (course && course.modules) {
      const initialUnlocked = new Set();
      course.modules.forEach((module, index) => {
        if (index === 0 || !module.isLocked) {
          initialUnlocked.add(module.id);
        }
      });
      setUnlockedModules(initialUnlocked);
    }
  }, [course]);
  
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

  const currentModule = course ? course.modules.find(m => m.id === activeModuleId) : null;
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);

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
          {course.modules.map((module) => {
            const isLocked = !unlockedModules.has(module.id);
            return (
              <div key={module.id}>
                <h2 
                  onClick={() => handleModuleSelect(module.id)}
                  className={`text-lg font-semibold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors flex items-center ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLocked && (
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  )}
                  {module.title}
                </h2>
                {module.id === activeModuleId && !isLocked && (
                  <ul className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1">
                    {module.lessons.map(lesson => (
                      <li key={lesson.id}>
                        <button
                          onClick={() => handleLessonClick(lesson.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150
                            ${lesson.id === activeLessonId 
                              ? 'bg-blue-100 text-blue-700 font-medium' 
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                          `}
                        >
                          {lesson.title}
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
            <QuizView
              key={currentLesson.id}
              questions={currentLesson.quiz}
              onComplete={(score) => {
                handleQuizCompletion(currentLesson.id, score);
                setShowQuiz(false);
              }}
              lessonId={currentLesson.id}
              module={currentModule}
            />
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
                  checkAndUnlockNextModule={(lessonId) => {
                    // This function is called when a perfect score is achieved
                    // The actual unlocking logic is handled in handleQuizCompletion
                    console.log(`[CourseDisplay] checkAndUnlockNextModule called for lesson: ${lessonId}`);
                  }}
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