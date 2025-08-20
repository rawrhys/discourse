import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

const PublicCourseDisplay = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);

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
        
        // For now, just set a basic course object to test
        setCourse({
          id: courseId,
          title: 'Test Course',
          subject: 'test',
          modules: []
        });
        
        setSessionId(existingSessionId);
        
      } catch (err) {
        setError('Failed to load course.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, navigate]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <LoadingState />;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-black truncate">{course.title}</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="text-center text-gray-500 pt-10">
            <p>Course loaded successfully: {course.title}</p>
            <p>Session ID: {sessionId}</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PublicCourseDisplay;