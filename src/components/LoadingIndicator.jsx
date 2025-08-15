import React from 'react';
import PropTypes from 'prop-types';

const LoadingIndicator = ({ message, progress, showSpinner = true }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      {showSpinner && (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      )}
      {message && (
        <div className="text-gray-600 text-center mb-2">{message}</div>
      )}
      {progress > 0 && (
        <div className="w-full max-w-md">
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

LoadingIndicator.propTypes = {
  message: PropTypes.string,
  progress: PropTypes.number,
  showSpinner: PropTypes.bool
};

export default LoadingIndicator; 