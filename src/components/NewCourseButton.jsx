import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// New Course Button Component
const NewCourseButton = React.memo(() => {
  const navigate = useNavigate();
  
  const handleNewCourse = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
    console.log('NewCourseButton: Clicked', {
              timestamp: new Date().toISOString()
      });
    }
    localStorage.removeItem('currentCourseId');
    navigate('/');
  }, [navigate]);
  
  return (
    <button
      onClick={handleNewCourse}
      className="fixed top-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span>New Course</span>
    </button>
  );
});

export default NewCourseButton; 