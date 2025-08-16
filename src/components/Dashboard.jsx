import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './ChatInterface';
import { useApiWrapper } from '../services/api';
import { API_BASE_URL, debugApiConfig, testBackendConnection } from '../config/api';
import LoadingIndicator from './LoadingIndicator';
import logger from '../utils/logger';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [savedCourses, setSavedCourses] = useState([]);
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [hoveredCourseId, setHoveredCourseId] = useState(null);
  const hasAttemptedFetch = useRef(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const api = useApiWrapper();
  const [isBuying, setIsBuying] = useState(false);
  const [credits, setCredits] = useState(1); // Default to 1 credit for all users
  const urlParams = new URLSearchParams(window.location.search);
  
  // Connection diagnostic state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showConnectionDiagnostic, setShowConnectionDiagnostic] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    stage: 'idle', // idle, starting, generating, completed, error
    currentModule: 0,
    totalModules: 0,
    currentLesson: 0,
    totalLessons: 0,
    message: '',
    details: []
  });

  // Get the user's name from the user object
  const userName = user?.name || user?.email || 'Guest';
  
  // Debug log to verify user data
  logger.debug('👤 [DASHBOARD] User data:', {
    user: user,
    userName: userName,
    hasName: !!user?.name,
    hasEmail: !!user?.email,
    timestamp: new Date().toISOString()
  });

  // Early return if user is not ready
  if (!user) {
    return <div className="text-center mt-10 text-gray-500">Loading user...</div>;
  }

  
  const fetchSavedCourses = useCallback(async (force = false) => {
    if (hasAttemptedFetch.current && !force) return; // Prevent duplicate calls unless forced
    
    logger.debug('📚 [DASHBOARD] Fetching saved courses', {
      force: force,
      hasAttemptedFetch: hasAttemptedFetch.current,
      timestamp: new Date().toISOString()
    });
    
    setIsLoadingCourses(true);
    hasAttemptedFetch.current = true;
    
    try {
      // Clear any existing errors before fetching
      setError(null);
      
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
      });
      
      const coursesPromise = api.getSavedCourses();
      const courses = await Promise.race([coursesPromise, timeoutPromise]);
      
      logger.debug('✅ [DASHBOARD] Successfully fetched saved courses', {
        coursesCount: Array.isArray(courses) ? courses.length : 0,
        courses: Array.isArray(courses) ? courses : [],
        timestamp: new Date().toISOString()
      });
      
      // Ensure we always set a valid array
      const validCourses = Array.isArray(courses) ? courses : [];
      setSavedCourses(validCourses);
      
      // Clear any errors since we successfully fetched courses
      setError(null);
      
      // If we have no courses and this was a forced refresh (like after deletion),
      // ensure we don't show any error state
      if (validCourses.length === 0 && force) {
        logger.debug('📭 [DASHBOARD] No courses found after forced refresh - clearing any error state');
        setError(null);
      }
      
    } catch (error) {
      // Enhanced error handling to prevent stack trace issues
      logger.warn('⚠️ [DASHBOARD] Could not fetch courses (likely new user or network issue):', {
        error: error.message,
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
      });
      
      // Always set empty array to prevent undefined errors
      setSavedCourses([]);
      
      // Only set error for non-401 errors (401 is handled gracefully for new users)
      if (error.status !== 401) {
        setError(error.message || 'Failed to load courses');
      } else {
        setError(null); // Don't show error for 401 (new user or session issues)
      }
      
      // Don't re-throw the error to prevent React error boundaries from triggering
    } finally {
      setIsLoadingCourses(false);
    }
  }, [api]);

  const handleGenerateCourse = useCallback(async (courseParams) => {
    logger.debug('🎯 [COURSE GENERATION] Starting course generation process', {
      params: courseParams,
      timestamp: new Date().toISOString(),
      user: user?.id
    });
    
    setIsGenerating(true);
    setError(null);
    
    // Reset generation progress
    setGenerationProgress({
      stage: 'starting',
      currentModule: 0,
      totalModules: 0,
      currentLesson: 0,
      totalLessons: 0,
      message: 'Initializing course generation...',
      details: []
    });
    
    // Add a timeout to handle cases where course_complete might not be received
    const generationTimeout = setTimeout(() => {
      logger.warn('⏰ [COURSE GENERATION] Generation timeout reached, checking for completion...');
      if (isGenerating) {
        logger.debug('🔄 [COURSE GENERATION] Forcing completion check...');
        // Force refresh saved courses and close modal
        fetchSavedCourses(true);
        setIsGenerating(false);
        setShowNewCourseForm(false);
      }
    }, 900000); // 15 minutes timeout
    
    // Define the progress handler
    const onProgress = (data) => {
      logger.debug('📡 [DASHBOARD] Received streaming data:', data);
      logger.debug('📡 [DASHBOARD] Data type:', data.type);
      logger.debug('📡 [DASHBOARD] Current generation state:', {
        stage: generationProgress.stage,
        currentModule: generationProgress.currentModule,
        totalModules: generationProgress.totalModules,
        message: generationProgress.message
      });
      
      setGenerationProgress(prev => {
        let updatedState = { ...prev };

        switch (data.type) {
          case 'course_complete':
            logger.debug('🎉 [DASHBOARD] Course generation completed:', data);
            // Clear the timeout since we received completion
            clearTimeout(generationTimeout);
            
            // Update credits immediately if provided
            if (data.creditsRemaining !== undefined) {
              logger.debug('💳 [DASHBOARD] Updating credits from completion data:', data.creditsRemaining);
              setCredits(data.creditsRemaining);
            }
            
            updatedState = {
              ...prev,
              stage: 'completed',
              message: 'Course generation completed successfully! Your course has been saved.',
              details: [...prev.details, { 
                timestamp: new Date().toISOString(), 
                message: '🎉 Course generation completed successfully!' 
              }]
            };
            
            // Immediately update the state
            setGenerationProgress(updatedState);
            
            // Add a small delay to show completion message, then navigate
            setTimeout(() => {
              logger.debug('🚀 [DASHBOARD] Navigating to course:', data.courseId);
              setIsGenerating(false);
              setShowNewCourseForm(false);
              
              if (data.courseId && typeof data.courseId === 'string' && data.courseId.trim()) {
                logger.debug('📍 [DASHBOARD] Navigating to course page:', `/course/${data.courseId}`);
                navigate(`/course/${data.courseId}`);
              } else {
                logger.debug('📋 [DASHBOARD] No courseId provided, refreshing saved courses');
                fetchSavedCourses(true);
              }
            }, 2000); // Increased delay to show completion message
            break;

          case 'error':
            logger.error('💥 [DASHBOARD] Course generation error:', data);
            setError(data.message || 'Course generation failed. Please try again.');
            
            // Update credits if refunded
            if (data.creditsRefunded && data.creditsRemaining !== undefined) {
              logger.debug('💳 [DASHBOARD] Updating credits after error refund:', data.creditsRemaining);
              setCredits(data.creditsRemaining);
            }
            
            updatedState = {
              ...prev,
              stage: 'error',
              message: data.message || 'Course generation failed. Please try again.',
              details: [...prev.details, { 
                timestamp: new Date().toISOString(), 
                message: `💥 Error: ${data.message || 'Course generation failed'}` 
              }]
            };
            setTimeout(() => setIsGenerating(false), 3000);
            break;

          case 'status':
            updatedState = { ...prev, stage: 'starting', message: data.message };
            break;
          
          case 'progress':
            updatedState = {
              ...prev,
              stage: 'generating',
              currentModule: data.currentModule || prev.currentModule,
              totalModules: data.totalModules || prev.totalModules,
              currentLesson: data.currentLesson || prev.currentLesson,
              totalLessons: data.totalLessons || prev.totalLessons,
              message: data.message || prev.message,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: data.message }]
            };
            break;

          case 'module_start':
            updatedState = {
              ...prev,
              stage: 'generating',
              currentModule: data.moduleIndex + 1,
              totalModules: data.totalModules,
              message: `Generating Module ${data.moduleIndex + 1}: ${data.moduleTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `Starting Module ${data.moduleIndex + 1}: ${data.moduleTitle}` }]
            };
            break;

          case 'lesson_start':
            updatedState = {
              ...prev,
              stage: 'generating',
              currentLesson: data.lessonIndex + 1,
              totalLessons: data.totalLessons,
              message: `Generating Lesson ${data.lessonIndex + 1}: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `Starting Lesson ${data.lessonIndex + 1}: ${data.lessonTitle}` }]
            };
            break;

          case 'lesson_complete':
            updatedState = {
              ...prev,
              message: `Completed Lesson: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Completed: ${data.lessonTitle}` }]
            };
            break;

          case 'quiz_generating':
            updatedState = {
              ...prev,
              message: `Generating quiz for: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `🎯 Generating quiz for: ${data.lessonTitle}` }]
            };
            break;

          case 'quiz_complete':
            updatedState = {
              ...prev,
              message: `Quiz completed for: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Quiz completed for: ${data.lessonTitle}` }]
            };
            break;

          case 'flashcards_generating':
            updatedState = {
              ...prev,
              message: `Generating flashcards for: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `🧠 Generating flashcards for: ${data.lessonTitle}` }]
            };
            break;

          case 'flashcards_complete':
            updatedState = {
              ...prev,
              message: `Flashcards created for: ${data.lessonTitle}`,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: `✅ Flashcards created for: ${data.lessonTitle}` }]
            };
            break;

          default:
            updatedState = {
              ...prev,
              details: [...prev.details, { timestamp: new Date().toISOString(), message: JSON.stringify(data) }]
            };
        }
        return updatedState;
      });
    };
    
    try {
      logger.debug('📋 [COURSE GENERATION] Processing course parameters:', courseParams);
      
      const { prompt, ...rest } = courseParams;
      logger.debug('🔤 [COURSE GENERATION] Extracted prompt:', prompt);
      logger.debug('⚙️ [COURSE GENERATION] Additional parameters:', rest);
      
      logger.debug('📡 [COURSE GENERATION] Making streaming API call to generate course...');
      const result = await api.generateCourse(
        prompt, 
        rest.difficultyLevel || 'intermediate',
        rest.numModules || 3,
        rest.numLessonsPerModule || 3,
        onProgress
      );
      
      logger.debug('✅ [COURSE GENERATION] Streaming API call completed:', result);
      
    } catch (error) {
      logger.error('💥 [COURSE GENERATION] Course generation failed:', {
        error: error.message,
        stack: error.stack,
        params: courseParams,
        timestamp: new Date().toISOString()
      });
      
      // Clear the timeout on error
      clearTimeout(generationTimeout);
      
      // Show a more helpful error message
      let errorMessage = error.message || 'Failed to generate course';
      
      if (error.message.includes('Mistral API key is not configured')) {
        errorMessage = 'AI service is not configured. Please contact support to set up the AI service.';
        logger.error('🔌 [COURSE GENERATION] AI service configuration issue');
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        logger.error('🌐 [COURSE GENERATION] Network connectivity issue');
      } else if (error.message.includes('No course credits left')) {
        errorMessage = 'You have no credits left. Please purchase more credits to generate courses.';
        logger.error('💳 [COURSE GENERATION] Insufficient credits');
      } else if (error.message.includes('NSFW') || error.message.includes('inappropriate') || error.message.includes('CONTENT_POLICY_BLOCKED')) {
        errorMessage = 'The course topic contains inappropriate content and cannot be generated.';
        logger.error('🚫 [COURSE GENERATION] Content policy violation');
      }
      
      logger.error('❌ [COURSE GENERATION] Setting error message:', errorMessage);
      setError(errorMessage);
      setIsGenerating(false);
    }
  }, [api, navigate, fetchSavedCourses, user, isGenerating]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteCourse = useCallback(async (courseId) => {
    try {
      // Clear any existing errors first, especially "Course not found" errors
      setError(null);
      
      // Normalize course ID to remove timestamp suffix
      const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
      logger.debug('🗑️ [DASHBOARD] Deleting course:', courseId, 'normalized:', normalizedCourseId);
      
      await api.deleteCourse(normalizedCourseId);
      
      // Clear the course to delete state immediately
      setCourseToDelete(null);
      
      // Force refresh after deletion with a small delay to ensure backend has processed the deletion
      setTimeout(async () => {
        try {
          await fetchSavedCourses(true);
          // Double-check that no error state persists after refresh
          setError(null);
        } catch (refreshError) {
          logger.warn('⚠️ [DASHBOARD] Error during post-deletion refresh:', refreshError);
          // Don't set error for refresh issues, just ensure courses are cleared
          setSavedCourses([]);
          setError(null);
        }
      }, 100);
      
    } catch (error) {
      logger.error('❌ [DASHBOARD] Error deleting course:', error);
      
      // Clear the course to delete state even on error
      setCourseToDelete(null);
      
      // Only set error for actual deletion failures, not for "course not found"
      if (error.message && !error.message.includes('Course not found')) {
        setError(error.message || 'Failed to delete course');
      } else {
        // If it's a "Course not found" error, just refresh to show empty state
        setError(null);
      }
      
      // Always refresh the courses list to ensure UI is in sync
      setTimeout(async () => {
        try {
          await fetchSavedCourses(true);
          setError(null);
        } catch (refreshError) {
          logger.warn('⚠️ [DASHBOARD] Error during post-deletion refresh:', refreshError);
          setSavedCourses([]);
          setError(null);
        }
      }, 100);
    }
  }, [api, fetchSavedCourses]);

  // Connection diagnostic function
  const runConnectionDiagnostic = useCallback(async () => {
    setShowConnectionDiagnostic(true);
    setConnectionStatus({ status: 'testing', message: 'Testing backend connection...' });
    
    try {
      const result = await testBackendConnection();
      
      if (result.success) {
        setConnectionStatus({ 
          status: 'success', 
          message: 'Backend connection successful!',
          details: `Server responded with status ${result.status}`
        });
      } else {
        setConnectionStatus({ 
          status: 'error', 
          message: 'Backend connection failed',
          details: result.error,
          suggestion: result.suggestion
        });
      }
    } catch (error) {
      setConnectionStatus({ 
        status: 'error', 
        message: 'Connection test failed',
        details: error.message
      });
    }
  }, []);

  // Cleanup effect for streaming callbacks and timeouts
  useEffect(() => {
    // Return a cleanup function
    return () => {
      // Clear the timeout when the component unmounts or the effect re-runs
      if (window.courseGenerationTimeout) {
        clearTimeout(window.courseGenerationTimeout);
      }
    };
  }, []);

  // Effect to handle generation state changes
  useEffect(() => {
    if (!isGenerating) {
      logger.debug('🔄 [DASHBOARD] Generation stopped, clearing any pending operations');
    }
  }, [isGenerating]);

  // Effect to automatically clear "Course not found" errors when courses list is empty
  useEffect(() => {
    if (savedCourses.length === 0 && error && error.includes('Course not found')) {
      logger.debug('🧹 [DASHBOARD] Clearing "Course not found" error since courses list is empty');
      setError(null);
    }
  }, [savedCourses.length, error]);

  // Fetch saved courses on component mount
  useEffect(() => {
    if (user) {
      try {
        // Clear any existing errors when component mounts
        setError(null);
        
        // Automatically fetch saved courses for existing users
        fetchSavedCourses();
        
        // If returning from Stripe payment, refresh user info
        if (urlParams.get('payment') === 'success') {
          handlePaymentSuccess();
        }
        
      } catch (error) {
        logger.error('❌ [DASHBOARD] Error in initial data fetch:', error);
        // Don't let errors propagate - just log them
      }
    }
  }, [user, fetchSavedCourses]); // Added refreshUserData dependency

  const handlePaymentSuccess = async () => {
    try {
      logger.debug('💳 [PAYMENT] Processing payment success...');
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        logger.error('❌ [PAYMENT] No authentication token found');
        alert('Authentication required. Please log in again.');
        return;
      }

      // Debug API configuration
      debugApiConfig();
      logger.debug('📡 [PAYMENT] Making request to:', `${API_BASE_URL}/api/payment-success`);

      // Call backend to process payment success and add tokens
      const response = await fetch(`${API_BASE_URL}/api/payment-success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Payment server responded with status: ${response.status}`);
      }

      const data = await response.json();
      logger.debug('✅ [PAYMENT] Payment success processed:', data);
      
      // Update local credits state with the new total
      setCredits(data.courseCredits);
      
      // Show success message with credit details
      const message = `${data.message}\n\nCredits: ${data.previousCredits} → ${data.courseCredits} (+${data.creditsAdded})`;
      alert(message);
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } catch (error) {
      logger.error('❌ [PAYMENT] Error handling payment success:', error);
      alert('Payment successful, but there was an issue adding tokens. Please contact support.');
    }
  };

  useEffect(() => {
    // Keep credits in sync with user object
    const userCredits = user?.courseCredits || 0;
    setCredits(userCredits); // Use actual credit count, don't force minimum
  }, [user]);

  const handleBuyMore = async () => {
    setIsBuying(true);
    try {
      logger.debug('🛒 [PAYMENT] Starting payment flow');
      
      // First, try to create a checkout session via our backend
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch('/api-proxy.php/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        logger.debug('🛒 [PAYMENT] Checkout session created, redirecting to:', data.url);
        window.location.href = data.url;
        return;
      } else {
        logger.warn('🛒 [PAYMENT] Backend checkout failed, using direct Stripe URL');
      }
    } catch (error) {
      logger.error('🛒 [PAYMENT] Error with backend checkout:', error);
    }

    // Fallback to direct Stripe URL if backend fails
    try {
      const successUrl = encodeURIComponent(`${window.location.origin}/dashboard?payment=success`);
      const stripeCheckoutUrl = `https://buy.stripe.com/aFa8wP1Ba6Xu46abXq6oo00?success_url=${successUrl}`;
      logger.debug('🛒 [PAYMENT] Using direct Stripe checkout:', stripeCheckoutUrl);
      window.location.href = stripeCheckoutUrl;
    } catch (err) {
      logger.error('🛒 [PAYMENT] Error redirecting to checkout:', err);
      alert('Error redirecting to checkout: ' + err.message);
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Remove problematic Stripe script tag */}
      
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Course Dashboard</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4">Welcome, {userName}!</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Credits and Buy More */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="text-lg font-semibold text-gray-700">
              Tokens: <span className={credits === 0 ? 'text-red-500' : 'text-green-600'}>{credits}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBuyMore}
              disabled={isBuying}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBuying ? 'Processing...' : 'Buy More Tokens'}
            </button>
            {/* Remove problematic Stripe buy button */}
          </div>
        </div>
        
        {credits === 0 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            You have no course tokens left. Please buy more to generate new courses.
          </div>
        )}
        
        {/* Payment Success Message */}
        {urlParams.get('payment') === 'success' && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center justify-between">
              <div>
                <strong>Payment Successful!</strong>
                <p className="text-sm mt-1">Thank you for your purchase. Your tokens should be added automatically.</p>
              </div>
              <button
                onClick={handlePaymentSuccess}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Add Tokens Now
              </button>
            </div>
          </div>
        )}
        
        {!showNewCourseForm ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h2 className="text-2xl font-bold text-gray-900">Your Saved Courses</h2>
                <button
                  onClick={() => fetchSavedCourses(true)}
                  disabled={isLoadingCourses}
                  className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title="Refresh courses"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setShowNewCourseForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={credits === 0}
              >
                Generate New Course
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
                {(error.includes('SSL') || error.includes('Mixed Content') || error.includes('Backend server is unreachable')) && (
                  <div className="mt-2">
                    <button
                      onClick={runConnectionDiagnostic}
                      className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Run Connection Diagnostic
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Connection Diagnostic Modal */}
            {showConnectionDiagnostic && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold mb-4">Connection Diagnostic</h3>
                  
                  {connectionStatus && (
                    <div className={`p-4 rounded mb-4 ${
                      connectionStatus.status === 'success' ? 'bg-green-100 text-green-700' :
                      connectionStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <div className="font-medium">{connectionStatus.message}</div>
                      {connectionStatus.details && (
                        <div className="text-sm mt-1">{connectionStatus.details}</div>
                      )}
                      {connectionStatus.suggestion && (
                        <div className="text-sm mt-2 font-medium">
                          Suggestion: {connectionStatus.suggestion}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600 mb-4">
                    <p><strong>Backend URL:</strong> {API_BASE_URL}</p>
                    <p><strong>Frontend Protocol:</strong> {window.location.protocol}</p>
                    <p><strong>Mixed Content Risk:</strong> {
                      window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:') ? 'Yes' : 'No'
                    }</p>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={runConnectionDiagnostic}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      disabled={connectionStatus?.status === 'testing'}
                    >
                      {connectionStatus?.status === 'testing' ? 'Testing...' : 'Test Again'}
                    </button>
                    <button
                      onClick={() => setShowConnectionDiagnostic(false)}
                      className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoadingCourses ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading your courses...</p>
              </div>
            ) : savedCourses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300">
                <div className="max-w-md mx-auto">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No courses yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by generating your first course.</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setShowNewCourseForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      disabled={credits === 0}
                    >
                      Generate Your First Course
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.isArray(savedCourses) ? savedCourses.map((course) => {
                      // Defensive programming - ensure course has required properties
                      if (!course || typeof course !== 'object') {
                        logger.warn('⚠️ [DASHBOARD] Invalid course object:', course);
                        return null;
                      }
                      
                      const courseId = course.id || `course_${Date.now()}_${Math.random()}`;
                      const canPublish = !!course.id && !course.published;
                      const courseTitle = course.title || 'Untitled Course';
                      const courseDescription = course.description || 'No description available';
                      const modulesCount = Array.isArray(course.modules) ? course.modules.length : 0;
                      const lessonsCount = Array.isArray(course.modules) ? course.modules.reduce((sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0) : 0;
                      
                      return (
                        <div
                          key={courseId}
                          className="bg-gray-50 overflow-hidden shadow rounded-lg relative group hover:shadow-md transition-shadow duration-200"
                        >
                          <div className="px-4 py-5 sm:p-6">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 mb-2">{courseTitle}</h3>
                                <p className="mt-1 text-sm text-gray-500 mb-4">{courseDescription}</p>
                                <div className="text-xs text-gray-400">
                                  {modulesCount} modules • {lessonsCount} lessons
                                </div>
                              </div>
                              <button
                                onClick={() => setCourseToDelete(course)}
                                className="ml-4 text-gray-400 hover:text-red-500 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                                title="Delete course"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => {
                                  try {
                                    localStorage.setItem('currentCourseId', course.id);
                                    navigate(`/course/${course.id}`);
                                  } catch (error) {
                                    logger.error('❌ [DASHBOARD] Error navigating to course:', error);
                                    alert('Error opening course. Please try again.');
                                  }
                                }}
                                className="flex-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-md transition-colors duration-200"
                              >
                                Continue Learning →
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    if (!course.id) {
                                      alert('This course cannot be published because it has no ID.');
                                      return;
                                    }
                                    
                                    if (course.published) {
                                      // Unpublish the course
                                      // Normalize course ID to remove timestamp suffix
                                      const normalizedCourseId = String(course.id || '').replace(/_[0-9]{10,}$/, '');
                                      logger.debug('Attempting to unpublish course:', course.id, 'normalized:', normalizedCourseId);
                                      const updated = await api.unpublishCourse(normalizedCourseId);
                                      await fetchSavedCourses(true); // Force refresh after unpublishing
                                      alert('Course unpublished!');
                                    } else {
                                      // Publish the course
                                      // Normalize course ID to remove timestamp suffix
                                      const normalizedCourseId = String(course.id || '').replace(/_[0-9]{10,}$/, '');
                                      logger.debug('Attempting to publish course:', course.id, 'normalized:', normalizedCourseId);
                                      const updated = await api.publishCourse(normalizedCourseId);
                                      await fetchSavedCourses(true); // Force refresh after publishing
                                      alert('Course published!');
                                    }
                                  } catch (err) {
                                    logger.error('❌ [DASHBOARD] Error with course publish/unpublish:', err);
                                    alert('Failed to ' + (course.published ? 'unpublish' : 'publish') + ' course: ' + (err.message || 'Unknown error'));
                                  }
                                }}
                                onMouseEnter={() => setHoveredCourseId(course.id)}
                                onMouseLeave={() => setHoveredCourseId(null)}
                                disabled={!course.id}
                                className={`text-sm font-medium rounded px-3 py-2 transition-colors duration-200 ${
                                  course.published 
                                    ? hoveredCourseId === course.id 
                                      ? 'bg-red-600 text-white hover:bg-red-700' 
                                      : 'bg-green-200 text-green-700 hover:bg-green-300'
                                    : !course.id 
                                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                      : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                title={
                                  course.published 
                                    ? hoveredCourseId === course.id 
                                      ? 'Click to unpublish this course' 
                                      : 'Course is published - hover to unpublish'
                                    : !course.id 
                                      ? 'Cannot publish: missing course ID' 
                                      : 'Publish this course to share publicly'
                                }
                              >
                                {course.published 
                                  ? hoveredCourseId === course.id 
                                    ? 'Unpublish' 
                                    : 'Published'
                                  : 'Publish'
                                }
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }).filter(Boolean) : (
                      <div className="col-span-full text-center text-gray-500">
                        No courses available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowNewCourseForm(false)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    disabled={isGenerating}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Dashboard
                  </button>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Generate New Course
                  </h3>
                </div>
              </div>
              <div className="mt-4">
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                <ChatInterface
                  onGenerateCourse={handleGenerateCourse}
                  onCancel={() => setShowNewCourseForm(false)}
                  isGenerating={isGenerating}
                  generationProgress={generationProgress}
                />
              </div>
            </div>
          </div>
        )}

        {/* Course Generation Progress Modal */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Creating Your Course</h3>
              
              <LoadingIndicator 
                message={generationProgress.message}
                progress={generationProgress.totalModules > 0 ? 
                  (generationProgress.currentModule / generationProgress.totalModules) * 100 : 0}
                showSpinner={generationProgress.stage !== 'completed'}
              />
              
              {/* Progress Details */}
              <div className="mt-4 space-y-2">
                {generationProgress.details.map((detail, index) => (
                  <div key={`${detail.timestamp}-${index}`} className="text-sm text-gray-600">
                    {detail.message}
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {courseToDelete && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Course</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to delete "{courseToDelete.title}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setCourseToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCourse(courseToDelete.id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;