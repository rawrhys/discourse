// src/components/CourseDisplay.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import LessonView from './LessonView';
import QuizView from './QuizView';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import NewCourseButton from './NewCourseButton';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import NoCourseState from './NoCourseState';
// No need to import Module model if it's not used directly

// Custom hook to get the previous value of a prop or state
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const CourseDisplay = () => {
  const context = useOutletContext();
  const { getQuizScoresForModule, saveCourse } = useApiWrapper();
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
  
  // The useMemo hook that was here has been removed.
  // The component will now directly use the `course` object from the context.
  
  const [showQuiz, setShowQuiz] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(new Set());
  const [showPerfectScoreMessage, setShowPerfectScoreMessage] = useState(false);
  const isInitialMount = React.useRef(true);
  const prevCourse = usePrevious(course);
  const prevUnlockedModules = usePrevious(unlockedModules);
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState('');

  useEffect(() => {
    if (courseId) {
      const savedUnlocked = localStorage.getItem(`unlockedModules_${courseId}`);
      if (savedUnlocked) {
        setUnlockedModules(new Set(JSON.parse(savedUnlocked)));
      } else if (course && course.modules && course.modules.length > 0) {
        // Unlock the first module by default
          setUnlockedModules(new Set([course.modules[0].id]));
      }
    }
  }, [courseId, course]);

  // Native audio for unlock sound (avoids extra deps)
  const unlockAudioRef = useRef(null);
  useEffect(() => {
    const audio = new Audio('/sounds/unlock.mp3');
    audio.preload = 'auto';
    audio.volume = 0.7;
    unlockAudioRef.current = audio;
    return () => {
      if (unlockAudioRef.current) {
        try { unlockAudioRef.current.pause(); } catch {}
        unlockAudioRef.current = null;
      }
    };
  }, []);

  // Play sound when a new module gets added to the unlocked set
  useEffect(() => {
    if (prevUnlockedModules && unlockedModules.size > prevUnlockedModules.size) {
      const a = unlockAudioRef.current;
      if (a) {
        try {
          a.currentTime = 0;
          a.play().catch(() => {});
        } catch {}
      }
    }
  }, [unlockedModules, prevUnlockedModules]);

  const handleModuleUpdate = useCallback((moduleId, updatedData) => {
    setCourse(prevCourse => {
      const updatedModules = prevCourse.modules.map(m => 
        m.id === moduleId ? { ...m, ...updatedData } : m
      );
      return { ...prevCourse, modules: updatedModules };
    });
  }, [setCourse]);

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

  const handleQuizCompletion = useCallback((lessonId, score) => {
    if (!course) return;

    let updatedCourse = course;

    // 1. Update quiz score in a new course object
    const newModules = course.modules.map(module => {
      const newLessons = module.lessons.map(lesson => {
        if (lesson.id === lessonId) {
          return { ...lesson, quizScore: score };
        }
        return lesson;
      });
      return { ...module, lessons: newLessons };
    });
    
    updatedCourse = { ...course, modules: newModules };
    setCourse(updatedCourse); // Update state with the new score

    // Call the backend to check for module completion
    fetch(`/api/lessons/${lessonId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.unlockedModuleId) {
        const unlockedModule = course.modules.find(m => m.id === data.unlockedModuleId);
        if (unlockedModule) {
          setUnlockedModuleName(unlockedModule.title);
          setShowUnlockToast(true);
          setTimeout(() => setShowUnlockToast(false), 5000); // Hide after 5 seconds
          
          // Also update the local state to reflect the unlock
          setUnlockedModules(prev => new Set(prev).add(data.unlockedModuleId));
        }
      } else if (data.courseCompleted) {
        // Handle course completion feedback
        setShowPerfectScoreMessage(true);
        setTimeout(() => {
          navigate(`/course/${courseId}/complete`);
          setShowPerfectScoreMessage(false);
        }, 3000);
      }
    });
  }, [course, courseId, setCourse, unlockedModules, navigate]);

  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  
  const isModuleLocked = useCallback((moduleId) => {
    return !unlockedModules.has(moduleId);
  }, [unlockedModules]);
  
  const handleLessonClick = (lessonId) => {
    setActiveLessonId(lessonId);
    navigate(`/course/${courseId}/lesson/${lessonId}`);
    setShowQuiz(false);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
  const handleNextLesson = useCallback(() => {
    if (!activeModule) return;
    const currentLessonIndex = activeModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex < activeModule.lessons.length - 1) {
      const nextLesson = activeModule.lessons[currentLessonIndex + 1];
      handleLessonClick(nextLesson.id);
    }
  }, [activeModule, activeLessonId, handleLessonClick]);

  const handlePreviousLesson = useCallback(() => {
    if (!activeModule) return;
    const currentLessonIndex = activeModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex > 0) {
      const previousLesson = activeModule.lessons[currentLessonIndex - 1];
      handleLessonClick(previousLesson.id);
    }
  }, [activeModule, activeLessonId, handleLessonClick]);
  
  const handleShare = () => {
    const publicUrl = `${window.location.origin}/public/course/${courseId}`;
    navigator.clipboard.writeText(publicUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  if (!course) return <NoCourseState />;

  const currentModule = course.modules.find(m => m.id === activeModuleId);
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);

  const allImageUrls = useMemo(() => {
    if (!course) return [];
    return course.modules.flatMap(m => m.lessons.map(l => l.image?.imageUrl).filter(Boolean));
  }, [course]);

  const allImageTitles = useMemo(() => {
    if (!course) return [];
    return course.modules.flatMap(m => m.lessons.map(l => l.image?.imageTitle).filter(Boolean));
  }, [course]);

  const imageUrlCounts = useMemo(() => {
    return allImageUrls.reduce((acc, url) => {
      acc[url] = (acc[url] || 0) + 1;
      return acc;
    }, {});
  }, [allImageUrls]);

  const imageTitleCounts = useMemo(() => {
    return allImageTitles.reduce((acc, title) => {
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {});
  }, [allImageTitles]);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4 min-w-0">
              <button onClick={() => navigate('/dashboard')} className="flex-shrink-0 text-gray-500 hover:text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">{course.title}</h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">{course.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course.modules.map((module, index) => {
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
        <div className="p-4 border-t space-y-2 flex justify-between items-center">
          <button onClick={handleShare} className="w-full relative bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center shadow">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
              Share
              {shareCopied && <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg">Copied!</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <div className="flex items-center flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 mr-4 md:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
          <div className="flex-1 text-center">
            {currentLesson && <h1 className="text-2xl font-bold text-gray-900 truncate">{currentLesson.title}</h1>}
          </div>
          <div className="flex-1 flex justify-end">
            <NewCourseButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {showQuiz && currentModule ? (
            <QuizView
              key={activeModuleId}
              lessons={currentModule.lessons}
              onComplete={(score) => {
                handleQuizCompletion(activeLessonId, score);
                setShowQuiz(false);
              }}
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
                  imageTitleCounts={imageTitleCounts}
                  imageUrlCounts={imageUrlCounts}
                  courseId={courseId}
                  onNextLesson={handleNextLesson}
                  onPreviousLesson={handlePreviousLesson}
                  currentLessonIndex={currentModule?.lessons.findIndex(l => l.id === activeLessonId)}
                  totalLessonsInModule={currentModule?.lessons.length}
                  activeModule={activeModule}
                  handleModuleUpdate={handleModuleUpdate}
                  onQuizComplete={handleQuizCompletion}
              />
            ) : (
              <div className="text-center text-gray-500 pt-10">
                <p>Select a lesson to begin.</p>
              </div>
            )
          )}
          {showPerfectScoreMessage && (
            <div className="fixed bottom-5 right-5 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50">
              <strong className="font-bold">Congratulations!</strong>
              <span className="block sm:inline"> You've perfected this module. Unlocking the next one...</span>
            </div>
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