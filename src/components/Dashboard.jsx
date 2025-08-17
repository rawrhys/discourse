import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './ChatInterface';
import { useApiWrapper } from '../services/api';
import { API_BASE_URL, debugApiConfig, testBackendConnection } from '../config/api';
import LoadingIndicator from './LoadingIndicator';
import logger from '../utils/logger';
import ConfettiAnimation from './ConfettiAnimation';

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isUpdatingCourseState, setIsUpdatingCourseState] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  
  // Connection diagnostic state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showConnectionDiagnostic, setShowConnectionDiagnostic] = useState(false);

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
  
  // Cleanup effect to reset state update flag on unmount
  useEffect(() => {
    return () => {
      setIsUpdatingCourseState(false);
    };
  }, []);

  
  const fetchSavedCourses = useCallback(async (force = false) => {
    // Always allow forced refreshes, even if we've attempted before
    if (hasAttemptedFetch.current && !force) {
      logger.debug('⏳ [DASHBOARD] Skipping fetch - already attempted and not forced');
      return;
    }
    
    // Don't override local state updates if we're in the middle of updating
    if (isUpdatingCourseState && !force) {
      logger.debug('🔄 [DASHBOARD] Skipping fetch - course state update in progress');
      return;
    }
    
    logger.debug('📚 [DASHBOARD] Fetching saved courses', {
      force: force,
      hasAttemptedFetch: hasAttemptedFetch.current,
      isUpdatingCourseState: isUpdatingCourseState,
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
      
      logger.debug('📡 [DASHBOARD] Making API call to getSavedCourses...');
      const coursesPromise = api.getSavedCourses();
      const courses = await Promise.race([coursesPromise, timeoutPromise]);
      
      logger.debug('✅ [DASHBOARD] Successfully fetched saved courses', {
        coursesCount: Array.isArray(courses) ? courses.length : 0,
        courses: Array.isArray(courses) ? courses.map(c => ({ 
          id: c.id, 
          title: c.title, 
          published: c.published,
          publishedType: typeof c.published 
        })) : [],
        timestamp: new Date().toISOString()
      });
      
      // Ensure we always set a valid array
      const validCourses = Array.isArray(courses) ? courses : [];
      setSavedCourses(validCourses);
      
      // Clear any errors since we successfully fetched courses
      setError(null);
      
    } catch (error) {
      logger.error('❌ [DASHBOARD] Error fetching saved courses:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Set a user-friendly error message
      setError('Failed to load courses. Please try refreshing the page.');
      
      // Don't clear existing courses on error, just show the error
    } finally {
      setIsLoadingCourses(false);
    }
  }, [api, isUpdatingCourseState]);

  const handleGenerateCourse = useCallback(async (courseParams) => {
    logger.debug('🎯 [COURSE GENERATION] Starting simplified course generation process', {
      params: courseParams,
      timestamp: new Date().toISOString(),
      user: user?.id
    });
    
    setIsGenerating(true);
    setError(null);
    
    try {
      logger.debug('📋 [COURSE GENERATION] Processing course parameters:', courseParams);
      
      const { prompt, ...rest } = courseParams;
      logger.debug('🔤 [COURSE GENERATION] Extracted prompt:', prompt);
      logger.debug('⚙️ [COURSE GENERATION] Additional parameters:', rest);
      
      logger.debug('📡 [COURSE GENERATION] Making API call to generate course...');
      const result = await api.generateCourse(
        prompt, 
        rest.difficultyLevel || 'intermediate',
        rest.numModules || 3,
        rest.numLessonsPerModule || 3
      );
      
      logger.debug('✅ [COURSE GENERATION] Course generation completed:', result);
      
      // Course generation completed successfully
      setIsGenerating(false);
      setShowNewCourseForm(false);
      
      // Refresh the courses list to show the new course
      await fetchSavedCourses(true);
      
      // Show success message
      logger.info('🎉 [COURSE GENERATION] Course generated successfully!');
      
    } catch (error) {
      logger.error('💥 [COURSE GENERATION] Course generation failed:', {
        error: error.message,
        stack: error.stack,
        params: courseParams,
        timestamp: new Date().toISOString()
      });
      
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
        errorMessage = 'The requested topic violates our content policy and cannot be generated. Please try a different topic.';
        logger.error('🚫 [COURSE GENERATION] Content policy violation');
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again with a simpler topic or fewer modules.';
        logger.error('⏰ [COURSE GENERATION] Request timeout');
      }
      
      setError(errorMessage);
      setIsGenerating(false);
    }
  }, [api, user?.id, fetchSavedCourses]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteCourse = useCallback(async (courseId) => {
    try {
      // Clear any existing errors first, especially "Course not found" errors
      setError(null);
      
      logger.debug('🗑️ [DASHBOARD] Deleting course:', courseId);
      
      const deleteResult = await api.deleteCourse(courseId);
      logger.debug('✅ [DASHBOARD] Course deletion API call completed:', deleteResult);
      
      // Clear the course to delete state immediately
      setCourseToDelete(null);
      
      // Show a brief success message
      setError(null);
      // You could add a success state here if needed
      
      // Force refresh after deletion with a small delay to ensure backend has processed the deletion
      setTimeout(async () => {
        try {
          logger.debug('🔄 [DASHBOARD] Starting post-deletion refresh...');
          await fetchSavedCourses(true);
          logger.debug('✅ [DASHBOARD] Post-deletion refresh completed successfully');
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
          logger.debug('🔄 [DASHBOARD] Starting error-recovery refresh...');
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
      logger.debug('📡 [PAYMENT] Making request to: /api/payment-success');

      // Call backend to process payment success and add tokens
      const response = await fetch('/api/payment-success', {
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

      const response = await fetch('/api/create-checkout-session', {
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
      {/* Confetti Animation */}
      <ConfettiAnimation 
        isActive={showConfetti} 
        onComplete={() => {
          setShowConfetti(false);
          // Force a state refresh after confetti completes to ensure button state is correct
          setTimeout(() => {
            setSavedCourses(current => [...current]);
          }, 100);
        }} 
      />
      
      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}
      
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
                  onClick={() => {
                    logger.debug('🔄 [DASHBOARD] Manual refresh triggered by user');
                    fetchSavedCourses(true);
                  }}
                  disabled={isLoadingCourses}
                  className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors duration-200"
                  title="Refresh courses"
                >
                  <svg className={`h-5 w-5 ${isLoadingCourses ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      
                      // Debug logging for course state
                      logger.debug('🎯 [DASHBOARD] Rendering course card:', {
                        courseId: course.id,
                        courseTitle: course.title,
                        published: course.published,
                        publishedType: typeof course.published,
                        courseIdType: typeof course.id,
                        timestamp: new Date().toISOString()
                      });
                      
                      return (
                        <div
                          key={`${courseId}-${course.published}-${isUpdatingCourseState}`}
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
                              {course.published && (
                                <button
                                  onClick={() => {
                                    const publicUrl = `${window.location.origin}/public/course/${course.id}`;
                                    navigator.clipboard.writeText(publicUrl);
                                    // Show a brief success message
                                    const originalText = 'Share';
                                    const button = event.target;
                                    button.textContent = 'Copied!';
                                    button.className = 'text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md transition-colors duration-200';
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                      button.className = 'text-sm font-medium text-blue-600 hover:text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors duration-200';
                                    }, 2000);
                                  }}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors duration-200"
                                  title="Copy public course link"
                                >
                                  Share
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  // Prevent multiple clicks
                                  if (isUpdatingCourseState) {
                                    return;
                                  }
                                  try {
                                    if (!course.id) {
                                      alert('This course cannot be published because it has no ID.');
                                      return;
                                    }
                                    
                                    if (course.published) {
                                      // Unpublish the course
                                      logger.debug('Attempting to unpublish course:', course.id);
                                      setIsUpdatingCourseState(true);
                                      
                                      const updated = await api.unpublishCourse(course.id);
                                      logger.debug('✅ [DASHBOARD] Course unpublished successfully:', updated);
                                      
                                      // Update local state immediately with callback to ensure proper update
                                      setSavedCourses(prevCourses => {
                                        logger.debug('🔄 [DASHBOARD] Updating local state for unpublish:', {
                                          courseId: course.id,
                                          prevCourses: prevCourses.map(c => ({ id: c.id, published: c.published })),
                                          updatingTo: false
                                        });
                                        
                                        const updatedCourses = prevCourses.map(c => {
                                          const courseIdMatch = String(c.id) === String(course.id);
                                          if (courseIdMatch) {
                                            logger.debug('🎯 [DASHBOARD] Found matching course for unpublish:', {
                                              courseId: course.id,
                                              courseIdType: typeof course.id,
                                              cId: c.id,
                                              cIdType: typeof c.id,
                                              currentPublished: c.published,
                                              updatingTo: false
                                            });
                                          }
                                          return courseIdMatch 
                                            ? { ...c, published: false }
                                            : c;
                                        });
                                        
                                        logger.debug('✅ [DASHBOARD] Local state updated:', {
                                          updatedCourses: updatedCourses.map(c => ({ id: c.id, published: c.published }))
                                        });
                                        
                                        // Log the specific course that was updated
                                        const updatedCourse = updatedCourses.find(c => String(c.id) === String(course.id));
                                        if (updatedCourse) {
                                          logger.debug('🎯 [DASHBOARD] Updated course state:', {
                                            courseId: updatedCourse.id,
                                            published: updatedCourse.published,
                                            publishedType: typeof updatedCourse.published
                                          });
                                        }
                                        
                                        return updatedCourses;
                                      });
                                      
                                      // Force multiple re-renders to ensure button state updates immediately
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 0);
                                      
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 50);
                                      
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 100);
                                      
                                      setSuccessMessage('Course unpublished successfully!');
                                      setShowSuccessToast(true);
                                      setTimeout(() => setShowSuccessToast(false), 3000);
                                      
                                      // Reset state update flag after a short delay
                                      setTimeout(() => {
                                        setIsUpdatingCourseState(false);
                                      }, 500);
                                    } else {
                                      // Publish the course
                                      logger.debug('Attempting to publish course:', course.id);
                                      setIsUpdatingCourseState(true);
                                      
                                      const updated = await api.publishCourse(course.id);
                                      logger.debug('✅ [DASHBOARD] Course published successfully:', updated);
                                      
                                      // Update local state immediately with callback to ensure proper update
                                      setSavedCourses(prevCourses => {
                                        logger.debug('🔄 [DASHBOARD] Updating local state for publish:', {
                                          courseId: course.id,
                                          prevCourses: prevCourses.map(c => ({ id: c.id, published: c.published })),
                                          updatingTo: true
                                        });
                                        
                                        const updatedCourses = prevCourses.map(c => {
                                          const courseIdMatch = String(c.id) === String(course.id);
                                          if (courseIdMatch) {
                                            logger.debug('🎯 [DASHBOARD] Found matching course for publish:', {
                                              courseId: course.id,
                                              courseIdType: typeof course.id,
                                              cId: c.id,
                                              cIdType: typeof c.id,
                                              currentPublished: c.published,
                                              updatingTo: true
                                            });
                                          }
                                          return courseIdMatch 
                                            ? { ...c, published: true }
                                            : c;
                                        });
                                        
                                        logger.debug('✅ [DASHBOARD] Local state updated:', {
                                          updatedCourses: updatedCourses.map(c => ({ id: c.id, published: c.published }))
                                        });
                                        
                                        // Log the specific course that was updated
                                        const updatedCourse = updatedCourses.find(c => String(c.id) === String(course.id));
                                        if (updatedCourse) {
                                          logger.debug('🎯 [DASHBOARD] Updated course state:', {
                                            courseId: updatedCourse.id,
                                            published: updatedCourse.published,
                                            publishedType: typeof updatedCourse.published
                                          });
                                        }
                                        
                                        return updatedCourses;
                                      });
                                      
                                      // Force multiple re-renders to ensure button state updates immediately
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 0);
                                      
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 50);
                                      
                                      setTimeout(() => {
                                        setSavedCourses(current => [...current]);
                                      }, 100);
                                      
                                      // Trigger confetti animation
                                      setShowConfetti(true);
                                      setSuccessMessage('Course published successfully! 🎉');
                                      setShowSuccessToast(true);
                                      setTimeout(() => setShowSuccessToast(false), 3000);
                                      
                                      // Reset state update flag after confetti completes
                                      setTimeout(() => {
                                        setIsUpdatingCourseState(false);
                                      }, 2000);
                                    }
                                  } catch (err) {
                                    logger.error('❌ [DASHBOARD] Error with course publish/unpublish:', err);
                                    setIsUpdatingCourseState(false);
                                    
                                    // Revert the local state change on error by fetching fresh data
                                    setTimeout(async () => {
                                      await fetchSavedCourses(true);
                                    }, 100);
                                    
                                    alert('Failed to ' + (course.published ? 'unpublish' : 'publish') + ' course: ' + (err.message || 'Unknown error'));
                                  }
                                }}
                                onMouseEnter={() => setHoveredCourseId(course.id)}
                                onMouseLeave={() => setHoveredCourseId(null)}
                                disabled={!course.id || isUpdatingCourseState}
                                className={`text-sm font-medium rounded px-3 py-2 transition-colors duration-200 ${
                                  isUpdatingCourseState
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : course.published 
                                      ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                                      : !course.id 
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                title={
                                  isUpdatingCourseState
                                    ? 'Updating...'
                                    : course.published 
                                      ? 'Click to unpublish this course'
                                      : !course.id 
                                        ? 'Cannot publish: missing course ID' 
                                        : 'Publish this course to share publicly'
                                }
                              >
                                {isUpdatingCourseState ? 'Updating...' : (course.published ? 'Unpublish' : 'Publish')}
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
                />
              </div>
            </div>
          </div>
        )}

        {/* Simple Course Generation Loading Modal */}
        {isGenerating && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Your Course</h3>
              <p className="text-sm text-gray-600 mb-6">
                Please wait while we create your course. This may take a few minutes.
              </p>
              <button
                onClick={() => {
                  logger.debug('🛑 [DASHBOARD] User cancelled course generation');
                  setIsGenerating(false);
                  setShowNewCourseForm(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel Generation
              </button>
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