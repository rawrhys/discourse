import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const CourseGenerationProgress = ({ 
  generationProgress, 
  isGenerating, 
  onCancel 
}) => {
  const [startTime] = useState(Date.now());
  const [eta, setEta] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Calculate ETA based on progress and elapsed time
  useEffect(() => {
    if (!isGenerating || generationProgress.stage === 'completed' || generationProgress.stage === 'error') {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      setElapsedTime(elapsed);

      // Calculate ETA based on progress
      if (generationProgress.totalModules > 0 && generationProgress.currentModule > 0) {
        const progressPercent = (generationProgress.currentModule / generationProgress.totalModules);
        if (progressPercent > 0) {
          const estimatedTotalTime = elapsed / progressPercent;
          const remainingTime = estimatedTotalTime - elapsed;
          setEta(Math.max(0, remainingTime));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, generationProgress, startTime]);

  const formatTime = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return 'Calculating...';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'starting':
        return '🚀';
      case 'generating':
        return '⚡';
      case 'validating':
        return '🔍';
      case 'saving':
        return '💾';
      case 'checking':
        return '🔍';
      case 'ai_service_starting':
        return '🤖';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getProgressColor = (stage) => {
    switch (stage) {
      case 'completed':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      case 'generating':
      case 'validating':
      case 'saving':
      case 'checking':
      case 'ai_service_starting':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  const calculateProgress = () => {
    if (generationProgress.stage === 'completed') return 100;
    if (generationProgress.stage === 'error') return 0;
    
    if (generationProgress.totalModules > 0) {
      return Math.min(95, (generationProgress.currentModule / generationProgress.totalModules) * 100);
    }
    
    // Fallback progress based on stage
    switch (generationProgress.stage) {
      case 'starting':
        return 5;
      case 'generating':
        return 50;
      default:
        return 0;
    }
  };

  const progress = calculateProgress();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">{getStageIcon(generationProgress.stage)}</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Creating Your Course</h3>
              <p className="text-sm text-gray-500">
                {generationProgress.stage === 'completed' ? 'Course ready!' : 'Please wait while we generate your personalized course...'}
              </p>
            </div>
          </div>
          {onCancel && generationProgress.stage !== 'completed' && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Cancel generation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {Math.round(progress)}%
            </span>
            <span className="text-sm text-gray-500">
              {generationProgress.currentModule}/{generationProgress.totalModules} modules
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor(generationProgress.stage)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="text-blue-600">
              {generationProgress.stage === 'generating' && (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-blue-800 font-medium">{generationProgress.message}</p>
              {generationProgress.stage === 'generating' && (
                <p className="text-blue-600 text-sm">
                  Module {generationProgress.currentModule} of {generationProgress.totalModules}
                  {generationProgress.currentLesson > 0 && (
                    <span> • Lesson {generationProgress.currentLesson} of {generationProgress.totalLessons}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Time Information */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Elapsed Time</div>
            <div className="text-lg font-semibold text-gray-900">{formatTime(elapsedTime)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Estimated Time Remaining</div>
            <div className="text-lg font-semibold text-gray-900">{formatTime(eta)}</div>
          </div>
        </div>

        {/* Progress Details */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Activity</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {generationProgress.details.slice(-5).map((detail, index) => (
              <div key={`${detail.timestamp}-${index}`} className="flex items-start space-x-2">
                <div className="text-gray-400 text-xs mt-1">
                  {new Date(detail.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-sm text-gray-600 flex-1">{detail.message}</div>
              </div>
            ))}
            {generationProgress.details.length === 0 && (
              <div className="text-sm text-gray-500 italic">Initializing course generation...</div>
            )}
          </div>
        </div>

        {/* Success Message */}
        {generationProgress.stage === 'completed' && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="text-green-600 text-xl">✅</div>
              <div>
                <p className="text-green-800 font-medium">Course Generation Complete!</p>
                <p className="text-green-600 text-sm">Your course has been successfully created and saved.</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {generationProgress.stage === 'error' && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="text-red-600 text-xl">❌</div>
              <div>
                <p className="text-red-800 font-medium">Generation Failed</p>
                <p className="text-red-600 text-sm">{generationProgress.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

CourseGenerationProgress.propTypes = {
  generationProgress: PropTypes.shape({
    stage: PropTypes.string.isRequired,
    currentModule: PropTypes.number,
    totalModules: PropTypes.number,
    currentLesson: PropTypes.number,
    totalLessons: PropTypes.number,
    message: PropTypes.string,
    details: PropTypes.arrayOf(PropTypes.shape({
      timestamp: PropTypes.string,
      message: PropTypes.string
    }))
  }).isRequired,
  isGenerating: PropTypes.bool.isRequired,
  onCancel: PropTypes.func
};

export default CourseGenerationProgress;
