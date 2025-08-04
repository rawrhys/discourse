// src/App.jsx
import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import './styles/App.css';
import CourseDisplay from './components/CourseDisplay';
import Module from './models/Module';
import { useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { useApiWrapper } from './services/api';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
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

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    const fetchCourse = async () => {
      setLoading(true);
      setError(null);
      try {
        const courseData = await api.getCourse(courseId);

        if (courseData.modules) {
          courseData.modules = courseData.modules.map(moduleData => Module.fromJSON(moduleData));
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
            navigate(`/course/${courseData.id}/lesson/${firstLesson.id}`, { replace: true });
          }
        }

      } catch (error) {
        console.error('Error fetching course:', error);
        setError(error.message || 'Failed to load course');
        localStorage.removeItem('currentCourseId');
      } finally {
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
            if (lesson) Object.assign(lesson, updates);
        }
        return newCourse;
    });
  };

  const clearCache = useCallback(() => {
    localStorage.removeItem('currentCourseId');
    setCourse(null);
    setActiveModuleId(null);
    setActiveLessonId(null);
    navigate('/dashboard');
  }, [navigate]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="text-red-500 text-center mt-10">{error}</div>;

  return course ? (
    <Outlet context={{
        course, setCourse,
        activeModuleId, setActiveModuleId,
        activeLessonId, setActiveLessonId,
        loading, setLoading,
        error, setError,
        clearCache, handleUpdateLesson
    }} />
  ) : <Navigate to="/dashboard" />;
};

function App() {
  const location = useLocation();
  useEffect(() => {
    //
  }, [location.pathname]);

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/course/:courseId/*" element={<ProtectedRoute><CourseLayout /></ProtectedRoute>}>
                <Route path="*" element={<CourseDisplay />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;