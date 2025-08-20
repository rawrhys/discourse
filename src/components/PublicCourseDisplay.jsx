import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './CourseDisplay.css';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

const PublicCourseDisplay = () => {
  const { courseId, lessonId: activeLessonIdFromParam } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState(new Set());

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        
        const urlParams = new URLSearchParams(window.location.search);
        const existingSessionId = urlParams.get('sessionId');
        
        if (!existingSessionId) {
          navigate(`/captcha/${courseId}`);
          return;
        }
        
        // For now, create a mock course structure for testing
        const mockCourse = {
          id: courseId,
          title: 'History of Ancient Egypt: An Intermediate Course',
          subject: 'history of ancient egypt',
          description: 'This course explores the rich history of Ancient Egypt.',
          modules: [
            {
              id: 'module_1',
              title: 'Introduction to Ancient Egypt',
              lessons: [
                {
                  id: 'lesson_1',
                  title: 'The Nile River and Early Settlements',
                  content: 'The Nile River was the lifeblood of Ancient Egypt...',
                  quiz: []
                },
                {
                  id: 'lesson_2',
                  title: 'The First Dynasties',
                  content: 'The Early Dynastic Period marked the beginning...',
                  quiz: []
                }
              ]
            },
            {
              id: 'module_2',
              title: 'The Old Kingdom',
              lessons: [
                {
                  id: 'lesson_3',
                  title: 'Pyramid Building',
                  content: 'The Old Kingdom is famous for the construction...',
                  quiz: []
                }
              ]
            }
          ]
        };
        
        setCourse(mockCourse);
        setSessionId(existingSessionId);
        
        // Set initial module and lesson
        if (mockCourse.modules.length > 0) {
          setActiveModuleId(mockCourse.modules[0].id);
          if (mockCourse.modules[0].lessons.length > 0) {
            setActiveLessonId(mockCourse.modules[0].lessons[0].id);
          }
        }
        
      } catch (err) {
        setError('Failed to load course.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, navigate]);

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
    if (course && sessionId) {
      const initialUnlocked = new Set();
      initialUnlocked.add(course.modules[0]?.id);
      setUnlockedModules(initialUnlocked);
    }
  }, [course, sessionId]);

  // Handle module selection
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
  }, [course, unlockedModules, courseId, navigate]);

  // Handle lesson click
  const handleLessonClick = useCallback((lessonId) => {
    setActiveLessonId(lessonId);
    navigate(`/public/course/${courseId}/lesson/${lessonId}`, { replace: true });
    setShowQuiz(false);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [courseId, navigate]);

  // Handle next lesson
  const handleNextLesson = useCallback(() => {
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLesson = currentModule.lessons[currentLessonIndex + 1];
      handleLessonClick(nextLesson.id);
    }
  }, [course, activeModuleId, activeLessonId, handleLessonClick]);

  // Handle previous lesson
  const handlePreviousLesson = useCallback(() => {
    const currentModule = course.modules.find(m => m.id === activeModuleId);
    if (!currentModule) return;
    const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLessonId);
    if (currentLessonIndex > 0) {
      const previousLesson = currentModule.lessons[currentLessonIndex - 1];
      handleLessonClick(previousLesson.id);
    }
  }, [course, activeModuleId, activeLessonId, handleLessonClick]);

  // Find current module and lesson
  const currentModule = course ? course.modules.find(m => m.id === activeModuleId) : null;
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);
  const currentLessonIndex = currentModule?.lessons.findIndex(l => l.id === activeLessonId) ?? 0;
  const totalLessonsInModule = currentModule?.lessons?.length ?? 0;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <LoadingState />;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-black leading-tight">{course.title}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{course.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course.modules.map((module, moduleIndex) => {
            const isLocked = !unlockedModules.has(module.id);
            
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
          {currentLesson ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{currentLesson.title}</h2>
                <div className="prose prose-lg max-w-none">
                  <p className="text-gray-700 leading-relaxed">{currentLesson.content}</p>
                </div>
                
                <div className="mt-8 flex justify-between items-center">
                  <button
                    onClick={handlePreviousLesson}
                    disabled={currentLessonIndex === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous Lesson
                  </button>
                  
                  <span className="text-sm text-gray-500">
                    Lesson {currentLessonIndex + 1} of {totalLessonsInModule}
                  </span>
                  
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
          ) : (
            <div className="text-center text-gray-500 pt-10">
              <p>Select a lesson to begin.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PublicCourseDisplay;