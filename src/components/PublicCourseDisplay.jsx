import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LessonView from './LessonView';
import QuizView from './QuizView';
import './CourseDisplay.css';
import { useApiWrapper } from '../services/api';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import NoCourseState from './NoCourseState';
import Module from '../models/Module'; // Import the Module model

const PublicCourseDisplay = () => {
  const { courseId, lessonId: activeLessonIdFromParam } = useParams();
  const navigate = useNavigate();
  const api = useApiWrapper();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);

  const [showQuiz, setShowQuiz] = useState(false);
  const [unlockedModules, setUnlockedModules] = useState([]);
  const [lockMessage, setLockMessage] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const courseData = await api.getPublicCourse(courseId);
        
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
  }, [courseId, api]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleModuleSelect = (moduleId) => {
    setActiveModuleId(moduleId);
    const module = course.modules.find(m => m.id === moduleId);
    if (module && module.lessons.length > 0) {
        setActiveLessonId(module.lessons[0].id);
        navigate(`/public/course/${courseId}/lesson/${module.lessons[0].id}`);
    }
  };

  const handleLessonClick = (lesson) => {
    setActiveLessonId(lesson.id);
    navigate(`/public/course/${courseId}/lesson/${lesson.id}`);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleShare = () => {
    const publicUrl = window.location.href;
    navigator.clipboard.writeText(publicUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <NoCourseState />;

  const currentModule = course.modules.find(m => m.id === activeModuleId);
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLessonId);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out bg-white w-80 shadow-lg z-30 flex flex-col`}>
        <div className="p-5 border-b">
          <h1 className="text-2xl font-bold text-gray-800 truncate">{course.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{course.subject}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {course.modules.map((module) => (
            <div key={module.id}>
              <h2
                onClick={() => handleModuleSelect(module.id)}
                className="text-lg font-semibold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {module.title}
              </h2>
              {module.id === activeModuleId && (
                <ul className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1">
                  {module.lessons.map(lesson => (
                    <li key={lesson.id}>
                      <button
                        onClick={() => handleLessonClick(lesson)}
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
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={handleShare} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center shadow relative">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
            Share
            {shareCopied && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg">Copied!</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 mr-4 md:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          {currentLesson && <h1 className="text-2xl font-bold text-gray-900 truncate">{currentLesson.title}</h1>}
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {currentLesson ? (
            <LessonView lesson={currentLesson} />
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

export default memo(PublicCourseDisplay);