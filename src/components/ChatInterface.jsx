// src/components/ChatInterface.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const ChatInterface = ({ onGenerateCourse, isGenerating, onCancel, error: parentError }) => {
  const [prompt, setPrompt] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  const [numModules, setNumModules] = useState(3);
  const [numLessonsPerModule, setNumLessonsPerModule] = useState(3);
  const [error, setError] = useState(null);
  
  // Use parent error if available, otherwise use local error
  const displayError = parentError || error;
  
  // Clear error when generation starts
  useEffect(() => {
    if (isGenerating) {
        setError(null);
    }
  }, [isGenerating]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('Please enter a topic for your course.');
      return;
    }
    
    if (isGenerating) {
      return; // Prevent multiple submissions
    }
    
    setError(null); // Clear previous errors
    
    const courseParams = {
      prompt: prompt.trim(),
      difficultyLevel,
      numModules: parseInt(numModules),
      numLessonsPerModule: parseInt(numLessonsPerModule)
    };
    
    try {
      await onGenerateCourse(courseParams);
      // Reset form on success
      setPrompt('');
      setDifficultyLevel('intermediate');
      setNumModules(3);
      setNumLessonsPerModule(3);
    } catch (error) {
      setError(error.message || 'Failed to generate course. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topic Input */}
          <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            What topic would you like to learn about?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Ancient Egyptian History, Python Programming, Art History, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            disabled={isGenerating}
              required
          />
          </div>
          
        {/* Difficulty Level */}
            <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <select
                id="difficulty"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
        {/* Course Structure */}
        <div className="grid grid-cols-2 gap-4">
            <div>
            <label htmlFor="modules" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Modules
              </label>
            <select
              id="modules"
                value={numModules}
                onChange={(e) => setNumModules(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isGenerating}
            >
              <option value={2}>2 Modules</option>
              <option value={3}>3 Modules</option>
              <option value={4}>4 Modules</option>
              <option value={5}>5 Modules</option>
            </select>
            </div>
            <div>
            <label htmlFor="lessons" className="block text-sm font-medium text-gray-700 mb-2">
                Lessons per Module
              </label>
            <select
              id="lessons"
                value={numLessonsPerModule}
                onChange={(e) => setNumLessonsPerModule(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isGenerating}
            >
              <option value={2}>2 Lessons</option>
              <option value={3}>3 Lessons</option>
              <option value={4}>4 Lessons</option>
              <option value={5}>5 Lessons</option>
            </select>
          </div>
            </div>

        {/* Error Display */}
        {displayError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <div className="flex items-center justify-between">
              <span>{displayError}</span>
              {displayError.includes('Backend server temporarily unavailable') || 
               displayError.includes('server may be restarting') || 
               displayError.includes('try again in a moment') && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isGenerating}
                  className="ml-3 px-3 py-1 text-xs font-medium text-red-700 bg-red-200 hover:bg-red-300 rounded transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isGenerating}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Course...
              </div>
            ) : (
              'Generate Course'
            )}
            </button>
          </div>
        </form>
    </div>
  );
};

ChatInterface.propTypes = {
  onGenerateCourse: PropTypes.func.isRequired,
  isGenerating: PropTypes.bool.isRequired,
  onCancel: PropTypes.func,
  error: PropTypes.string
};

export default ChatInterface;