import React from 'react';

const PublicCourseDisplay = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-black truncate">Test Course</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="text-center text-gray-500 pt-10">
            <p>Minimal component test</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PublicCourseDisplay;