// src/App.jsx
import React, { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import './styles/App.css';
import Module from './models/Module';
import { useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { useApiWrapper } from './services/api';
import useApi from './hooks/useApi'; // Import the refactored hook
import './utils/debug'; // Import debug utilities

// Lazy load the components
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CourseDisplay = lazy(() => import('./components/CourseDisplay'));
const PublicCourseDisplay = lazy(() => import('./components/PublicCourseDisplay'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy.jsx'));
const ImageTest = lazy(() => import('./components/ImageTest'));


const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
  // If we have a token but user hasn't been hydrated (e.g., backend 5xx),
  // keep showing a loader instead of redirecting to login.
  if (loading || (hasToken && !user)) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const CourseLayout = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApiWrapper();

  // Add detailed logging for courseId
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [COURSE LAYOUT] CourseId parameter received:', {
      courseId: courseId,
      courseIdType: typeof courseId,
      courseIdLength: courseId?.length,
      pathname: location.pathname,
      urlParts: location.pathname.split('/'),
      params: Object.fromEntries(new URLSearchParams(location.search)),
      timestamp: new Date().toISOString()
    });
  }
    
    // If courseId is "saved", this is wrong - log an error and try to redirect
    if (courseId === 'saved') {
      console.error('❌ [COURSE LAYOUT] INVALID courseId "saved" detected!', {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        state: location.state,
        timestamp: new Date().toISOString()
      });
      
      // Try to get the current course ID from localStorage as a fallback
      const storedCourseId = localStorage.getItem('currentCourseId');
      if (storedCourseId && storedCourseId !== 'saved') {
        if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [COURSE LAYOUT] Found stored courseId, redirecting:', storedCourseId);
      }
        navigate(`/course/${storedCourseId}`, { replace: true });
        return;
      }
      
      // If no valid stored courseId, redirect to dashboard
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [COURSE LAYOUT] No valid courseId found, redirecting to dashboard');
      }
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [courseId, location, navigate]);

  useEffect(() => {
    if (!courseId || courseId === 'saved') {
      setLoading(false);
      return;
    }

    const fetchCourse = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 [COURSE LAYOUT] Starting to fetch course:', {
          courseId: courseId,
          timestamp: new Date().toISOString()
        });
      }
      
      setLoading(true);
      setError(null);
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('📡 [COURSE LAYOUT] Making API call to get course:', courseId);
        }
        const courseData = await api.getCourse(courseId);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [COURSE LAYOUT] Course data received:', {
            courseId: courseData?.id,
            title: courseData?.title,
            modulesCount: courseData?.modules?.length,
            hasModules: !!courseData?.modules,
            userId: courseData?.userId,
            quizScoresInfo: courseData?.modules?.map(m => ({
              moduleTitle: m.title,
              lessonsWithScores: m.lessons?.map(l => ({
                lessonTitle: l.title,
                hasQuizScores: !!l.quizScores,
                userScore: l.quizScores?.[user?.id],
                allScores: l.quizScores
              }))
            })),
            timestamp: new Date().toISOString()
          });
        }

        if (!courseData) {
          throw new Error('No course data received from server');
        }

        if (!courseData.modules || !Array.isArray(courseData.modules)) {
          console.error('❌ [COURSE LAYOUT] Course data missing modules:', courseData);
          throw new Error('Course data is missing modules');
        }

        if (courseData.modules.length === 0) {
          console.error('❌ [COURSE LAYOUT] Course has no modules:', courseData);
          throw new Error('Course has no modules');
        }

        courseData.modules = courseData.modules.map(moduleData => Module.fromJSON(moduleData));
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [COURSE LAYOUT] Modules converted to Module instances:', {
            modulesCount: courseData.modules.length,
            firstModuleTitle: courseData.modules[0]?.title,
            firstModuleLessons: courseData.modules[0]?.lessons?.length
          });
        }
        
        setCourse(courseData);
        localStorage.setItem('currentCourseId', courseId);
        
        const pathParts = location.pathname.split('/');
        const lessonId = pathParts.length > 3 && pathParts[3] === 'lesson' ? pathParts[4] : null;

        if (lessonId) {
          const module = courseData.modules.find(m => m.lessons.some(l => l.id === lessonId));
          if (module) {
            setActiveModuleId(module.id);
            setActiveLessonId(lessonId);
          }
        } else {
          const firstLesson = courseData.modules[0]?.lessons[0];
          if (firstLesson) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🚀 [COURSE LAYOUT] Navigating to first lesson:', firstLesson.id);
            }
            navigate(`/course/${courseData.id}/lesson/${firstLesson.id}`, { replace: true });
          } else {
            console.error('❌ [COURSE LAYOUT] No lessons found in first module');
          }
        }

      } catch (error) {
        console.error('💥 [COURSE LAYOUT] Error fetching course:', {
          courseId: courseId,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        setError(error.message || 'Failed to load course');
        localStorage.removeItem('currentCourseId');
      } finally {
        if (process.env.NODE_ENV === 'development') {
          console.log('🏁 [COURSE LAYOUT] Course fetch completed:', {
            courseId: courseId,
            loading: false,
            hasError: !!error,
            timestamp: new Date().toISOString()
          });
        }
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId, navigate, location.key]);

  const handleUpdateLesson = (lessonId, updates) => {
    setCourse(prev => {
        if (!prev) return null;
        const newCourse = { ...prev };
        const module = newCourse.modules.find(m => m.lessons.some(l => l.id === lessonId));
        if (module) {
            const lesson = module.lessons.find(l => l.id === lessonId);
            if (lesson) {
                // Handle quizScore to quizScores conversion
                if (updates.quizScore !== undefined) {
                    if (!lesson.quizScores) {
                        lesson.quizScores = {};
                    }
                    lesson.quizScores[user?.id] = updates.quizScore;
                    // Also keep the old quizScore for backward compatibility
                    lesson.quizScore = updates.quizScore;
                } else {
                    Object.assign(lesson, updates);
                }
            }
        }
        return newCourse;
    });
  };

  if (loading) return <LoadingScreen />;
  if (error) return <div className="text-red-500 text-center mt-10">{error}</div>;

  return course ? (
    <Outlet context={{
        course, setCourse,
        activeModuleId, setActiveModuleId,
        activeLessonId, setActiveLessonId,
        loading, setLoading,
        error, setError,
        handleUpdateLesson
    }} />
  ) : <Navigate to="/dashboard" />;
};

function App() {
  const location = useLocation();
  useApi(); // Activate the global auth error listener

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 [APP] Application loaded', {
        pathname: location.pathname,
        timestamp: new Date().toISOString()
      });
    }
  }, [location.pathname]);

  // Log when course generation routes are accessed
  useEffect(() => {
    if (location.pathname.includes('/dashboard')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 [APP] Dashboard accessed', {
          pathname: location.pathname,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [location.pathname]);

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/course/:courseId" element={<ProtectedRoute><CourseLayout /></ProtectedRoute>}>
                <Route index element={<CourseDisplay />} />
                <Route path="lesson/:lessonId" element={<CourseDisplay />} />
            </Route>
            <Route path="/public/course/:courseId/*" element={<PublicCourseDisplay />} />
            <Route path="/image-test" element={<ImageTest />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;