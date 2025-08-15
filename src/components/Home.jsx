import React, { Suspense, lazy } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChatInterface from './ChatInterface';
const CourseDisplay = lazy(() => import('./CourseDisplay'));

const Home = () => {
  const {
    course,
    isGenerating,
    handleGenerateCourse,
    error
  } = useOutletContext();

  if (course) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <CourseDisplay />
      </Suspense>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow flex flex-col items-center justify-center min-h-screen">
      <div className="chat-interface w-full flex justify-center">
        <ChatInterface 
          onGenerateCourse={handleGenerateCourse}
          isGenerating={isGenerating}
          error={error}
        />
      </div>
    </div>
  );
};

export default Home; 