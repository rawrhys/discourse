import React from 'react';

// Memoized Error component
const ErrorState = React.memo(({ error, onRetry }) => (
  <div className="flex justify-center items-center h-screen bg-red-50">
    <div className="text-center p-8 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Course Generation Failed</h2>
      <p className="text-gray-700">{error}</p>
      <button
        onClick={onRetry}
        className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  </div>
));

export default ErrorState; 