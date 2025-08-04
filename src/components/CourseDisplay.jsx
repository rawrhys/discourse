// src/components/CourseDisplay.jsx
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ModuleView from './ModuleView';
import LessonView from './LessonView';
import QuizView from './QuizView';
import Flashcard from './Flashcard';
import './CourseDisplay.css';
import PropTypes from 'prop-types';
import { useApiWrapper } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AIService from '../services/AIService.js';
import Lesson from '../models/Lesson';
import Module from '../models/Module';
import NewCourseButton from './NewCourseButton';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import NoCourseState from './NoCourseState';

// Helper function to generate unique IDs
const generateId = (prefix, index = 1) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}_${index}_${timestamp}_${random}`;
};

// Memoized ModuleCard component
const ModuleCard = memo(({ module, isActive, onSelect, isLocked }) => (
  <button
    onClick={() => !isLocked && onSelect()}
    disabled={isLocked}
    className={`flex-shrink-0 text-left px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150
               ${isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : isLocked
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
  >
    <div className="flex items-center justify-between">
      <span>{module.title}</span>
      {isLocked && (
        <svg 
          className="h-4 w-4 text-gray-400" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" 
            clipRule="evenodd" 
          />
        </svg>
      )}
    </div>
  </button>
));

// Memoized LessonCard component
const LessonCard = memo(({ lesson, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`block p-4 rounded-lg shadow-md transition-transform transform hover:scale-105
               ${isActive 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white hover:bg-gray-50'}`}
  >
    <h4 className="text-md font-semibold">{lesson.title}</h4>
  </button>
));

const CourseDisplay = () => {
  const context = useOutletContext();
  const { getQuizScoresForModule, saveCourse } = useApiWrapper();

  // Fallback if context is not available
  if (!context) {
    return <NoCourseState />;
  }
  
  const {
    course,
    setCourse,
    activeModuleId,
    setActiveModuleId,
    activeLessonId,
    setActiveLessonId,
    loading,
    setLoading,
    error,
    setError,
    clearCache,
    handleUpdateLesson
  } = context;

  const { courseId } = useParams();
  const navigate = useNavigate();

  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);

  useEffect(() => {
    if (course && course.modules) {
      const currentModule = course.modules.find(m => m.id === activeModuleId);
      setActiveModule(currentModule || null);
      if (currentModule) {
        const currentLesson = currentModule.lessons.find(l => l.id === activeLessonId);
        setActiveLesson(currentLesson || null);
        // Debug: print all lesson quizScores in this module
        console.log('[ActiveModule Lessons quizScores]', currentModule.lessons.map(l => ({ id: l.id, title: l.title, quizScore: l.quizScore })));
      }
    }
  }, [course, activeModuleId, activeLessonId]);

  const [showQuiz, setShowQuiz] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(() => {
    const saved = localStorage.getItem('unlockedModules');
    return saved ? JSON.parse(saved) : [];
  });

  const [lockMessage, setLockMessage] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // Remove lock icon and make modules clickable if unlocked
  const isModuleLocked = useCallback((moduleId) => {
    if (!course?.modules) return true;
    const moduleIndex = course.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === 0) return false; // First module is never locked
    return !unlockedModules.includes(moduleId);
  }, [course?.modules, unlockedModules]);

  // Memoize module selection handler
  const handleModuleSelect = useCallback((moduleId) => {
    if (!course?.modules) return;

    const moduleData = course.modules.find(m => m.id === moduleId);
    if (!moduleData) return;
    
    const module = Module.fromJSON(moduleData);

    const isFirstModule = course.modules[0].id === moduleId;
    const isLocked = isModuleLocked(moduleId);

    // Clear any existing error and lock message
    setError(null);
    setLockMessage('');

    // Check if module is locked
    if (isLocked && !isFirstModule) {
      setLockMessage('Get 5/5 on at least 3 quizzes in the previous module to unlock this module.');
      return; // Don't proceed with navigation
    }

    // Module is not locked, proceed with navigation
    setActiveModuleId(moduleId);
    if (module.lessons && module.lessons.length > 0) {
      const firstLessonId = module.lessons[0].id;
      setActiveLessonId(firstLessonId);
      navigate(`/course/${courseId}/lesson/${firstLessonId}`);
    }
    setShowQuiz(false);
  }, [course, setActiveModuleId, setActiveLessonId, courseId, navigate, setError, isModuleLocked]);

  // Memoize lesson selection handler
  const handleLessonSelect = useCallback((lessonId) => {
    setActiveLessonId(lessonId);
    navigate(`/course/${courseId}/lesson/${lessonId}`);
    setShowQuiz(false);
  }, [setActiveLessonId, courseId, navigate]);

  const handleLessonUpdate = useCallback((lessonId, update) => {
    setCourse(prevCourse => {
      if (!prevCourse) return prevCourse;
      // Update the lesson in ALL modules
      const updatedModules = prevCourse.modules.map(module => {
        const updatedLessons = module.lessons.map(lesson =>
          lesson.id === lessonId ? { ...lesson, ...update } : lesson
        );
        return { ...module, lessons: updatedLessons };
      });
      const updatedCourse = { ...prevCourse, modules: updatedModules };
      console.log('[handleLessonUpdate] Updated course:', updatedCourse);

      // Unlock logic: unlock next module if AT LEAST 3 lessons in CURRENT module have quizScore === 5
      updatedModules.forEach((module, index) => {
        if (index === updatedModules.length - 1) return; // No next module to unlock
        const perfectCount = module.lessons.filter(lesson => lesson.quizScore === 5).length;
        const nextModule = updatedModules[index + 1];
        if (perfectCount >= 3 && nextModule && !unlockedModules.includes(nextModule.id)) {
          setUnlockedModules(prev => {
            const newUnlocked = [...prev, nextModule.id];
            localStorage.setItem('unlockedModules', JSON.stringify(newUnlocked));
            console.log('[Unlock Debug] New unlockedModules:', newUnlocked);
            return newUnlocked;
          });
        }
      });

      saveCourse(updatedCourse);
      return updatedCourse;
    });
  }, [saveCourse, unlockedModules]);

  // Memoize module update handler
  const handleModuleUpdate = useCallback((updatedModule) => {
    setCourse(prevCourse => {
      if (!prevCourse) return null;
      
      // Update the module with new quiz completion data
      const updatedModules = prevCourse.modules.map(m => {
        if (m.id === updatedModule.id) {
          const module = Module.fromJSON(m);
          module.perfectQuizzes = updatedModule.perfectQuizzes;
          module.updateProgress(updatedModule.progress);
          if (updatedModule.isCompleted) {
            module.setCompleted(true);
          }
          return module;
        }
        return m;
      });

      return {
        ...prevCourse,
        modules: updatedModules
      };
    });
  }, [setCourse]);

  const currentLessonIndex = useMemo(() => 
    activeModule?.lessons?.findIndex(l => l.id === activeLessonId) ?? -1,
    [activeModule?.lessons, activeLessonId]
  );

  const totalLessonsInModule = useMemo(() => 
    activeModule?.lessons?.length ?? 0,
    [activeModule?.lessons]
  );

  const handleNextLesson = useCallback(() => {
    if (!activeModule?.lessons || currentLessonIndex === -1) return;
    const nextLesson = activeModule.lessons[currentLessonIndex + 1];
    if (nextLesson) {
      handleLessonSelect(nextLesson.id);
    }
  }, [activeModule?.lessons, currentLessonIndex, handleLessonSelect]);

  const handlePreviousLesson = useCallback(() => {
    if (!activeModule?.lessons || currentLessonIndex === -1) return;
    const prevLesson = activeModule.lessons[currentLessonIndex - 1];
    if (prevLesson) {
      handleLessonSelect(prevLesson.id);
    }
  }, [activeModule?.lessons, currentLessonIndex, handleLessonSelect]);

  // Memoize retry handler
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Memoize back handler
  const handleCreateNewCourse = useCallback(() => {
    if (clearCache) {
      clearCache();
    }
  }, [clearCache]);

  // Unlock and navigate to the next module
  const onUnlockAndNavigateNextModule = useCallback((nextModuleId) => {
    const nextModule = course.modules.find(m => m.id === nextModuleId);
    if (!nextModule) return;
    setActiveModuleId(nextModuleId);
    if (nextModule.lessons && nextModule.lessons.length > 0) {
      setActiveLessonId(nextModule.lessons[0].id);
      navigate(`/course/${courseId}/lesson/${nextModule.lessons[0].id}`);
    }
    setShowQuiz(false);
  }, [course, courseId, navigate]);

  const handleLessonCompleted = useCallback((lessonId, status) => {
    console.log(`Lesson ${lessonId} completed with status: ${status}`);
    // In a real app, you'd update the lesson's completion status in the course state
    // and maybe save it to the backend.
    if (!setCourse) return;
    setCourse(prevCourse => {
      const newModules = prevCourse.modules.map(module => {
        const newLessons = module.lessons.map(lesson => {
          if (lesson.id === lessonId) {
            return { ...lesson, completed: status };
          }
          return lesson;
        });
        // Check if all lessons in the module are complete
        const allLessonsCompleted = newLessons.every(l => l.completed);
        if (allLessonsCompleted) {
          module.setCompleted(true);
        }
        return { ...module, lessons: newLessons };
      });
      return { ...prevCourse, modules: newModules };
    });
  }, [setCourse]);

  // ADDED: Effect to ensure component re-renders when activeLesson is found
  useEffect(() => {
    // This effect exists to explicitly trigger a re-render when activeLesson is available.
    // The dependency array ensures it runs when the calculated activeLesson changes.
  }, [activeLesson]);

  const handleSaveCourse = async () => {
    try {
      await saveCourse(course);
      alert('Course saved successfully!');
    } catch (err) {
      console.error('Failed to save course:', err);
      alert('Error saving course.');
    }
  };

  // Share button handler
  const handleShare = useCallback(() => {
    if (!course?.id) return;
    const publicUrl = `${window.location.origin}/public/course/${course.id}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [course?.id]);

  // Render loading state
  if (loading) {
    return <LoadingState />;
  }

  // Render error state
  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  // Render no course state
  if (!course) {
    return <NoCourseState onCreateNew={handleCreateNewCourse} />;
  }

  // Main render
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="flex items-center min-w-0 gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
            aria-label="Return Home"
          >
            &#8592; Home
          </button>
          <div className="flex items-center gap-2">
            {/* Share button only if published */}
            {course.published && (
              <button
                onClick={handleShare}
                className="px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors relative"
                title="Copy public course link"
              >
                <svg className="inline-block w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 01-3 3H7a3 3 0 010-6h5a3 3 0 013 3zm0 0v1a3 3 0 003 3h1a3 3 0 000-6h-1a3 3 0 00-3 3v1z" />
                </svg>
                Share
                {shareCopied && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs rounded px-2 py-1 shadow">Link copied!</span>
                )}
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{course.title}</h1>
              <p className="text-sm text-gray-600">{course.subject}</p>
            </div>
          </div>
        </div>
      </header>
      {/* New Course Button below header */}
      <div className="w-full flex justify-start px-4 py-2">
        <NewCourseButton onNewCourse={handleCreateNewCourse} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 p-4 overflow-y-auto border-r border-gray-200">
          {lockMessage && (
            <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-sm text-center">
              {lockMessage}
            </div>
          )}
          <div className="space-y-4">
            {course?.modules?.map((module, index) => {
              const isLocked = isModuleLocked(module.id);
              const hasFailedLessons = module.lessons.some(lesson => {
                const contentStr = typeof lesson.content === 'string'
                  ? lesson.content
                  : lesson.content?.main_content || '';
                return !contentStr || contentStr.includes('Content generation failed');
              });
              
              return (
                <div key={module.id} className="space-y-2">
                  <ModuleCard
                    module={module}
                    isActive={module.id === activeModuleId}
                    onSelect={() => handleModuleSelect(module.id)}
                    isLocked={isLocked}
                  />
                  {module.id === activeModuleId && (
                    <div className="ml-4 space-y-2">
                      {module.lessons.map((lesson) => {
                        const contentStr = typeof lesson.content === 'string'
                          ? lesson.content
                          : lesson.content?.main_content || '';
                        const hasError = !contentStr || contentStr.includes('Content generation failed');
                        return (
                          <div key={lesson.id} className="flex items-center space-x-2">
                            <LessonCard
                              lesson={lesson}
                              isActive={lesson.id === activeLessonId}
                              onClick={() => handleLessonSelect(lesson.id)}
                            />
                            {hasError && (
                              <span className="text-red-500 text-sm">!</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
          ) : !course ? (
            <NoCourseState />
          ) : (
            <div className="h-full">
              {activeLesson && (
                <LessonView
                  lesson={activeLesson}
                  moduleTitle={activeModule?.title}
                  subject={course.subject}
                  onNextLesson={handleNextLesson}
                  onPreviousLesson={handlePreviousLesson}
                  currentLessonIndex={activeModule?.lessons.findIndex(l => l.id === activeLesson.id) ?? 0}
                  totalLessonsInModule={activeModule?.lessons.length ?? 0}
                  onUpdateLesson={handleLessonUpdate}
                  activeModule={activeModule}
                  handleModuleUpdate={handleModuleUpdate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

CourseDisplay.propTypes = {
  // PropTypes for CourseDisplay if it had them
};

export default memo(CourseDisplay);