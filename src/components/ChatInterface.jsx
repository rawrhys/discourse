// src/components/ChatInterface.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const ChatInterface = ({ onGenerateCourse, isGenerating, generationProgress: parentGenerationProgress }) => {
  const [prompt, setPrompt] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  const [numModules, setNumModules] = useState(3);
  const [numLessonsPerModule, setNumLessonsPerModule] = useState(3);
  // Add a local loading state to ensure animations work correctly
  const [localLoading, setLocalLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [error, setError] = useState(null);
  
  // Use parent's generation progress if available, otherwise use local state
  const [localGenerationProgress, setLocalGenerationProgress] = useState({
    stage: 'idle', // idle, starting, generating, completed, error
    currentModule: 0,
    totalModules: 0,
    currentLesson: 0,
    totalLessons: 0,
    message: '',
    details: []
  });
  
  const generationProgress = parentGenerationProgress || localGenerationProgress;

  // Sync the local loading state with the prop
  useEffect(() => {
    if (isGenerating) {
      setLocalLoading(true);
      setLocalGenerationProgress(prev => ({ 
        ...prev, 
        stage: 'starting', 
        message: 'Initializing course generation...' 
      }));
    } else {
      // Add a small delay before resetting states to ensure smooth transitions
      setTimeout(() => {
        setLocalLoading(false);
        setLocalGenerationProgress({
          stage: 'idle',
          currentModule: 0,
          totalModules: 0,
          currentLesson: 0,
          totalLessons: 0,
          message: '',
          details: []
        });
        // Clear any error messages when generation completes or is cancelled
        setError(null);
        setStreamingStatus('');
      }, 500);
    }
  }, [isGenerating]);

  // Handle progress updates from streaming
  const handleProgressUpdate = (data) => {
    if (!data) return;

    console.log('📡 [CHAT INTERFACE] Progress update:', data);

    // Update streaming status
    if (data.message) {
      setStreamingStatus(data.message);
    }

    // Handle different update types
    switch (data.type) {
      case 'status':
        setLocalGenerationProgress(prev => ({
          ...prev,
          stage: 'starting',
          message: data.message
        }));
        break;
      case 'progress':
        setLocalGenerationProgress(prev => ({
          ...prev,
          stage: 'generating',
          currentModule: data.currentModule || prev.currentModule,
          totalModules: data.totalModules || prev.totalModules,
          currentLesson: data.currentLesson || prev.currentLesson,
          totalLessons: data.totalLessons || prev.totalLessons,
          message: data.message || prev.message,
          details: [...prev.details, { 
            timestamp: new Date().toISOString(), 
            message: data.message 
          }]
        }));
        break;
      case 'error':
        setError(data.message || 'An error occurred during course generation');
        setLocalGenerationProgress(prev => ({
          ...prev,
          stage: 'error',
          message: data.message || 'Course generation failed'
        }));
        break;
      case 'complete':
        setLocalGenerationProgress(prev => ({
          ...prev,
          stage: 'completed',
          message: 'Course generation completed successfully!'
        }));
        break;
      default:
        // Handle any other updates
        setLocalGenerationProgress(prev => ({
          ...prev,
          details: [...prev.details, { 
            timestamp: new Date().toISOString(), 
            message: typeof data === 'string' ? data : JSON.stringify(data) 
          }]
        }));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // No cleanup needed for streaming
    };
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault(); // Prevent default form submission if event exists
    
    if (!prompt.trim() || localLoading) return; // Prevent submission if prompt is empty or already loading

    console.log('🎯 [CHAT INTERFACE] Starting course generation request', {
      prompt: prompt,
      difficultyLevel: difficultyLevel,
      numModules: numModules,
      numLessonsPerModule: numLessonsPerModule,
      timestamp: new Date().toISOString()
    });

    // Set local loading state immediately for better UX feedback
    setLocalLoading(true);
    setStreamingStatus('Starting course generation...');
    setError(null); // Clear previous errors
    
    const courseParams = {
      prompt,
      difficultyLevel,
      numModules: parseInt(numModules),
      numLessonsPerModule: parseInt(numLessonsPerModule),
      onStream: (chunk) => {
        // Handle different types of streaming updates
        console.log('📡 [CHAT INTERFACE] Received streaming chunk:', {
          chunk: chunk,
          timestamp: new Date().toISOString()
        });

        if (typeof chunk === 'object' && chunk.type) {
          // Handle structured progress updates
          switch (chunk.type) {
            case 'progress':
              setLocalGenerationProgress(prev => ({
                ...prev,
                stage: 'generating',
                currentModule: chunk.currentModule || prev.currentModule,
                totalModules: chunk.totalModules || prev.totalModules,
                currentLesson: chunk.currentLesson || prev.currentLesson,
                totalLessons: chunk.totalLessons || prev.totalLessons,
                message: chunk.message || prev.message,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: chunk.message }]
              }));
              break;
            case 'module_start':
              setLocalGenerationProgress(prev => ({
                ...prev,
                stage: 'generating',
                currentModule: chunk.moduleIndex + 1,
                totalModules: chunk.totalModules,
                message: `Generating Module ${chunk.moduleIndex + 1}: ${chunk.moduleTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `Starting Module ${chunk.moduleIndex + 1}: ${chunk.moduleTitle}` }]
              }));
              break;
            case 'lesson_start':
              setLocalGenerationProgress(prev => ({
                ...prev,
                stage: 'generating',
                currentLesson: chunk.lessonIndex + 1,
                totalLessons: chunk.totalLessons,
                message: `Generating Lesson ${chunk.lessonIndex + 1}: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `Starting Lesson ${chunk.lessonIndex + 1}: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'lesson_complete':
              setLocalGenerationProgress(prev => ({
                ...prev,
                message: `Completed Lesson: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Completed: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'quiz_generating':
              setLocalGenerationProgress(prev => ({
                ...prev,
                message: `Generating quiz for: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `🎯 Generating quiz for: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'quiz_complete':
              setLocalGenerationProgress(prev => ({
                ...prev,
                message: `Quiz completed for: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Quiz completed for: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'flashcards_generating':
              setLocalGenerationProgress(prev => ({
                ...prev,
                message: `Generating flashcards for: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `🧠 Generating flashcards for: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'flashcards_complete':
              setLocalGenerationProgress(prev => ({
                ...prev,
                message: `Flashcards created for: ${chunk.lessonTitle}`,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Flashcards created for: ${chunk.lessonTitle}` }]
              }));
              break;
            case 'course_complete':
              setLocalGenerationProgress(prev => ({
                ...prev,
                stage: 'completed',
                message: 'Course generation completed successfully!',
                details: [...prev.details, { timestamp: new Date().toISOString(), message: '🎉 Course generation completed successfully!' }]
              }));
              break;
            default:
              // Handle generic updates
              const chunkString = JSON.stringify(chunk, null, 2);
              setStreamingStatus(prev => prev + '\n' + chunkString);
              setLocalGenerationProgress(prev => ({
                ...prev,
                details: [...prev.details, { timestamp: new Date().toISOString(), message: chunkString }]
              }));
          }
        } else {
          // Handle plain text updates
          const chunkString = typeof chunk === 'object' ? JSON.stringify(chunk, null, 2) : chunk;
          setStreamingStatus(prev => prev + '\n' + chunkString);
          setLocalGenerationProgress(prev => ({
            ...prev,
            details: [...prev.details, { timestamp: new Date().toISOString(), message: chunkString }]
          }));
        }
      }
    };
    
    console.log('📤 [CHAT INTERFACE] Sending course parameters to parent component:', courseParams);
    
    try {
      const result = await onGenerateCourse(courseParams);
      console.log('✅ [CHAT INTERFACE] Course generation completed successfully:', {
        result: result,
        hasDebugInfo: !!result?.debugInfo,
        timestamp: new Date().toISOString()
      });
      
      // Removed debugInfo handling
    } catch (error) {
      console.error('💥 [CHAT INTERFACE] Course generation failed:', {
        error: error.message,
        stack: error.stack,
        params: courseParams,
        timestamp: new Date().toISOString()
      });
      setError(error.message || 'Failed to generate course');
      setStreamingStatus(prev => prev + '\nError: ' + error.message);
    } finally {
      console.log('🏁 [CHAT INTERFACE] Course generation request completed');
      // Don't reset localLoading here - let the parent component handle it
      // setLocalLoading(false);
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            
            <div>
              <label htmlFor="numLessonsPerModule" className="block text-sm font-medium text-gray-700 mb-1">
                Lessons per Module
              </label>
              <input
                type="number"
                id="numLessonsPerModule"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="5"
                value={numLessonsPerModule}
                onChange={(e) => setNumLessonsPerModule(e.target.value)}
                disabled={localLoading} // Disable when loading
              />
            </div>
          </div>
          
          {/* Removed Learning Objectives and Debug Mode sections */}
          
          <div className="flex justify-center">
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

      {/* Removed Debug Modal */}
    </div>
  );
};

ChatInterface.propTypes = {
  onGenerateCourse: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isGenerating: PropTypes.bool,
  generationProgress: PropTypes.shape({
    stage: PropTypes.string,
    currentModule: PropTypes.number,
    totalModules: PropTypes.number,
    currentLesson: PropTypes.number,
    totalLessons: PropTypes.number,
    message: PropTypes.string,
    details: PropTypes.array
  })
};

export default ChatInterface;