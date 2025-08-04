// src/components/ChatInterface.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const ChatInterface = ({ onGenerateCourse, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  const [numModules, setNumModules] = useState(3);
  const [learningObjectives, setLearningObjectives] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  // Add a local loading state to ensure animations work correctly
  const [localLoading, setLocalLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [error, setError] = useState(null);

  // Sync the local loading state with the prop
  useEffect(() => {
    setLocalLoading(isGenerating);
  }, [isGenerating]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault(); // Prevent default form submission if event exists
    
    if (!prompt.trim() || localLoading) return; // Prevent submission if prompt is empty or already loading

    // Set local loading state immediately for better UX feedback
    setLocalLoading(true);
    setStreamingStatus('Starting course generation...');
    setError(null); // Clear previous errors
    
    const courseParams = {
      prompt,
      difficultyLevel,
      numModules: parseInt(numModules),
      learningObjectives: learningObjectives.split('\n').filter(obj => obj.trim() !== ''),
      debug: debugMode,
      onStream: (chunk) => {
        // The chunk is now an object, so we stringify it for display
        const chunkString = typeof chunk === 'object' ? JSON.stringify(chunk, null, 2) : chunk;
        setStreamingStatus(prev => prev + '\n' + chunkString);
      }
    };
    
    try {
      const result = await onGenerateCourse(courseParams);
      if (debugMode && result?.debugInfo) {
        setDebugInfo(result.debugInfo);
      }
    } catch (error) {
      console.error('Error generating course:', error);
      setError(error.message || 'Failed to generate course');
      setStreamingStatus(prev => prev + '\nError: ' + error.message);
    } finally {
      // Ensure localLoading is reset even if there's an error from onGenerateCourse
      // or if onGenerateCourse doesn't manage its parent's isGenerating state quickly enough.
      // However, App.jsx should manage the primary isGenerating state.
      // setLocalLoading(false); // This might be too quick if parent state is slow.
      setLocalLoading(false);
      setStreamingStatus('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline in textarea
      handleSubmit(); // Call handleSubmit directly
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      {error && <div className="error-message">{error}</div>}
      <div className="px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">LMS Course Generator</h2>
        <p className="text-gray-600 mb-4">
          Enter a subject or topic to generate a complete learning module with lessons and quizzes.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
              Subject or Topic
            </label>
            <textarea
              id="prompt"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="E.g., Introduction to Machine Learning, JavaScript for beginners, History of Ancient Rome..."
              required
              disabled={localLoading} // Disable when loading
            ></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty Level
              </label>
              <select
                id="difficulty"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                disabled={localLoading} // Disable when loading
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="numModules" className="block text-sm font-medium text-gray-700 mb-1">
                Number of Modules
              </label>
              <input
                type="number"
                id="numModules"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
                value={numModules}
                onChange={(e) => setNumModules(e.target.value)}
                disabled={localLoading} // Disable when loading
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="objectives" className="block text-sm font-medium text-gray-700 mb-1">
              Learning Objectives (Optional, one per line)
            </label>
            <textarea
              id="objectives"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={learningObjectives}
              onChange={(e) => setLearningObjectives(e.target.value)}
              placeholder="E.g.,&#10;Understand the basics of machine learning&#10;Implement simple algorithms&#10;Evaluate model performance"
              disabled={localLoading} // Disable when loading
            ></textarea>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="debugMode"
                checked={debugMode}
                onChange={() => setDebugMode(!debugMode)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={localLoading} // Disable when loading
              />
              <label htmlFor="debugMode" className="ml-2 block text-sm text-gray-700">
                Debug Mode
              </label>
              {debugInfo && (
                <button
                  type="button"
                  onClick={() => setShowDebugModal(true)}
                  className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                  disabled={localLoading} // Disable when loading
                >
                  View Debug Info
                </button>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors disabled:bg-gray-400"
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? 'Generating...' : 'Generate Course'}
            </button>
          </div>
        </form>
      </div>

      {/* Enhanced loading overlay with streaming status */}
      {localLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full pointer-events-auto">
            <div className="flex items-center justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Creating Your Course</h3>
            
            {/* Streaming status display */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {streamingStatus || 'Initializing...'}
              </pre>
            </div>

            <div className="mb-3 text-sm text-gray-500 text-center">
              <p className="mb-2">Our AI is generating custom learning materials based on your specifications.</p>
              <p className="italic">This process may take a minute or two. Please don't refresh the page.</p>
            </div>
            
            {/* Progress bar animation */}
            <div className="h-1 w-full bg-gray-200 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-progress"></div>
            </div>
          </div>
        </div>
      )}

      {showDebugModal && debugInfo && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Debug Information</h3>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <h4 className="font-semibold mb-2">API Responses:</h4>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                {JSON.stringify(debugInfo.apiResponses || {}, null, 2)}
              </pre>
            </div>
            {debugInfo.errors && debugInfo.errors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Errors:</h4>
                <pre className="bg-red-50 text-red-700 p-4 rounded overflow-x-auto">
                  {JSON.stringify(debugInfo.errors, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

ChatInterface.propTypes = {
  onGenerateCourse: PropTypes.func.isRequired,
  isGenerating: PropTypes.bool.isRequired,
};

export default ChatInterface;