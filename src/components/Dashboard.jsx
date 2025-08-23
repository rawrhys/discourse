import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './ChatInterface';
import ReportProblem from './ReportProblem';
import { useApiWrapper } from '../services/api';
import { API_BASE_URL, debugApiConfig, testBackendConnection } from '../config/api';
import LoadingIndicator from './LoadingIndicator';
import logger from '../utils/logger';
import ConfettiAnimation from './ConfettiAnimation';
import { supabase } from '../config/supabase';
import courseNotificationService from '../services/CourseNotificationService';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [savedCourses, setSavedCourses] = useState([]);
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
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
  
  // ETA countdown for generation
  const [etaTotalSec, setEtaTotalSec] = useState(0);
  const [etaStartMs, setEtaStartMs] = useState(0);
  const [etaRemainingSec, setEtaRemainingSec] = useState(0);
  
  // Connection diagnostic state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showConnectionDiagnostic, setShowConnectionDiagnostic] = useState(false);

  // State for user profile data from backend
  const [userProfile, setUserProfile] = useState(null);
  
  // Report Problem modal state
  const [showReportProblem, setShowReportProblem] = useState(false);
  
  // Get the user's name from backend profile data, fallback to auth context
  const userName = userProfile?.name || user?.name || user?.email || 'Guest';
  
  // Debug log to verify user data
  logger.debug('👤 [DASHBOARD] User data:', {
    user: user,
    userProfile: userProfile,
    userName: userName,
    hasName: !!userProfile?.name,
    hasEmail: !!user?.email,
    timestamp: new Date().toISOString()
  });

  // Early return if user is not ready
  if (!user) {
    return <div className="text-center mt-10 text-gray-500">Loading user...</div>;
  }
  
  // Define fetchSavedCourses before it's used in useEffect
  const fetchSavedCourses = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous fetches unless forced
    if (isLoadingCourses && !forceRefresh) {
      logger.debug('🔄 [DASHBOARD] Skipping fetch - already loading courses');
      return;
    }
    
    // Track if we've attempted to fetch courses
    hasAttemptedFetch.current = true;
    
    setIsLoadingCourses(true);
    setError(null);
    
    try {
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
      
      // Debug: Log the course loading state
      logger.info('🔄 [DASHBOARD] Main course fetch comparison:', {
        previousCount: savedCourses.length,
        newCount: validCourses.length,
        previousCourses: savedCourses.map(c => ({ id: c.id, title: c.title })),
        newCourses: validCourses.map(c => ({ id: c.id, title: c.title })),
        timestamp: new Date().toISOString()
      });
      
      setSavedCourses(validCourses);
      
      // Clear any errors since we successfully fetched courses
      setError(null);
      
      // Check if we have any very recent courses (created in the last 5 minutes)
      // This helps catch courses that were generated but the user didn't see the success notification
      const recentCourses = validCourses.filter(course => {
        if (!course.createdAt) return false;
        const courseDate = new Date(course.createdAt);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return courseDate > fiveMinutesAgo;
      });
      
      if (recentCourses.length > 0) {
        logger.info('🎉 [DASHBOARD] Found recent courses, showing success message:', recentCourses.map(c => c.title));
        setSuccessMessage(`Found ${recentCourses.length} recently generated course${recentCourses.length > 1 ? 's' : ''}!`);
        setShowSuccessToast(true);
        
        // Hide success message after a delay
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 3000);
      }
      
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
  
  // Cleanup effect to reset state update flag on unmount
  useEffect(() => {
    return () => {
      setIsUpdatingCourseState(false);
    };
  }, []);

  // Setup SSE connection for course generation notifications
  useEffect(() => {
    if (user) {
      // Get the auth token from localStorage or Supabase
      const token = localStorage.getItem('token') || user.access_token;
      
      logger.debug('🔗 [DASHBOARD] Setting up SSE connection with token:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
        user: user?.id
      });
      
      if (token) {
        // Connect to SSE notifications
        courseNotificationService.connect(token);
        
        // Add event listener for course generation notifications
        const handleCourseGenerated = (data) => {
          logger.info('🎉 [DASHBOARD] Received course generation notification:', data);
          
          // Clear any existing errors since we got a success notification
          setError(null);
          
          // Close the generation modal and reset ETA
          setIsGenerating(false);
          setEtaTotalSec(0);
          setEtaRemainingSec(0);
          setEtaStartMs(0);
          
          // Show success message
          setSuccessMessage(`Course "${data.courseTitle}" generated successfully!`);
          setShowSuccessToast(true);
          
          // Close the generation form
          setShowNewCourseForm(false);
          
          // Fetch updated course list after a short delay
          setTimeout(async () => {
            try {
              // Use a local function to avoid dependency issues
              const refreshCourses = async () => {
                // Always allow forced refreshes, even if we've attempted before
                if (hasAttemptedFetch.current) {
                  logger.debug('⏳ [DASHBOARD] Forced refresh after SSE notification');
                }
                
                // Don't override local state updates if we're in the middle of updating
                if (isUpdatingCourseState) {
                  logger.debug('🔄 [DASHBOARD] Skipping fetch - course state update in progress');
                  return;
                }
                
                logger.debug('📚 [DASHBOARD] Fetching saved courses after SSE notification');
                
                // Add timeout to prevent hanging requests
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
                });
                
                const coursesPromise = api.getSavedCourses();
                const courses = await Promise.race([coursesPromise, timeoutPromise]);
                
                logger.debug('✅ [DASHBOARD] Successfully fetched saved courses after SSE notification', {
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
                
                // Debug: Log the current state vs new state
                logger.info('🔄 [DASHBOARD] Course list refresh comparison:', {
                  currentCount: savedCourses.length,
                  newCount: validCourses.length,
                  currentCourses: savedCourses.map(c => ({ id: c.id, title: c.title })),
                  newCourses: validCourses.map(c => ({ id: c.id, title: c.title })),
                  timestamp: new Date().toISOString()
                });
                
                setSavedCourses(validCourses);
                
                // Clear any errors since we successfully fetched courses
                setError(null);
                
              };
              
              await refreshCourses();
              logger.info('✅ [DASHBOARD] Course list updated after SSE notification');
            } catch (error) {
              logger.error('❌ [DASHBOARD] Failed to update course list after SSE notification:', error);
              // Even if the fetch fails, we know the course was generated, so show a success message
              setSuccessMessage('Course generated successfully! You can find it in your course list.');
              setShowSuccessToast(true);
            }
          }, 1000);
        };
        
        courseNotificationService.addEventListener('course_generated', handleCourseGenerated);
        
        // Cleanup on unmount
        return () => {
          courseNotificationService.removeEventListener('course_generated', handleCourseGenerated);
          courseNotificationService.disconnect();
        };
      }
    }
  }, [user, api, isUpdatingCourseState]);

  // Add a global course generation monitoring system
  useEffect(() => {
    let monitoringInterval = null;
    
    // Start monitoring if we're currently generating a course
    if (isMonitoring) {
      logger.info('🔍 [DASHBOARD] Starting global course generation monitoring');
      
      const startTime = Date.now();
      const maxMonitoringTime = 10 * 60 * 1000; // 10 minutes
      
      monitoringInterval = setInterval(async () => {
        try {
          // Check if we've been monitoring for too long
          if (Date.now() - startTime > maxMonitoringTime) {
            logger.warn('⚠️ [DASHBOARD] Max monitoring time reached, stopping course generation monitoring');
            setIsMonitoring(false);
            clearInterval(monitoringInterval);
            return;
          }
          
          // Check if we're still generating
          if (!isMonitoring) {
            logger.info('✅ [DASHBOARD] Course generation completed, stopping monitoring');
            clearInterval(monitoringInterval);
            return;
          }
          
          logger.debug('🔍 [DASHBOARD] Checking for new courses during generation...');
          const courses = await api.getSavedCourses();
          
          // Check if we have a new course that wasn't there before
          const currentCourseCount = savedCourses.length;
          if (Array.isArray(courses) && courses.length > currentCourseCount) {
            logger.info('🎉 [DASHBOARD] New course detected during monitoring!');
            setSavedCourses(courses);
            setSuccessMessage('Course generation completed! New course found.');
            setShowSuccessToast(true);
            setError(null); // Clear any errors
            setIsGenerating(false); // Stop generation state just in case
            setIsMonitoring(false); // Stop monitoring
            setShowNewCourseForm(false); // Close the form
            clearInterval(monitoringInterval);
          }
        } catch (error) {
          logger.error('❌ [DASHBOARD] Error during course generation monitoring:', error);
          // Don't stop monitoring on error, just log it
        }
      }, 5000); // Check every 5 seconds
    }
    
    // Cleanup function
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        logger.info('🛑 [DASHBOARD] Stopped course generation monitoring');
      }
    };
  }, [isMonitoring, api, savedCourses.length]);

  // Check for recently generated courses when dashboard loads
  useEffect(() => {
    if (user && savedCourses.length > 0) {
      // Check if any courses were created in the last 10 minutes
      const recentCourses = savedCourses.filter(course => {
        if (!course.createdAt) return false;
        const courseDate = new Date(course.createdAt);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        return courseDate > tenMinutesAgo;
      });
      
      if (recentCourses.length > 0 && !showSuccessToast) {
        logger.info('🎉 [DASHBOARD] Found recently generated courses on dashboard load:', recentCourses.map(c => c.title));
        setSuccessMessage(`Welcome back! You have ${recentCourses.length} recently generated course${recentCourses.length > 1 ? 's' : ''} available.`);
        setShowSuccessToast(true);
        
        // Hide success message after a delay
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 5000);
      }
    }
  }, [user, savedCourses, showSuccessToast]);

  // Removed periodic and focus/visibility auto-refresh per request

  const handleGenerateCourse = useCallback(async (courseParams) => {
    logger.debug('🎯 [COURSE GENERATION] Starting simplified course generation process', {
      params: courseParams,
      timestamp: new Date().toISOString(),
      user: user?.id
    });
    
    setIsGenerating(true);
    setError(null);
    
    // Proactively refresh the list before starting generation
    try { await fetchSavedCourses(true); } catch {}

    // Compute a rough ETA based on requested size (clamped 60-600s)
    const modules = courseParams.numModules || 3;
    const lessons = courseParams.numLessonsPerModule || 3;
    const estimated = Math.min(600, Math.max(60, modules * lessons * 15 + 30));
    setEtaTotalSec(estimated);
    setEtaStartMs(Date.now());
    setEtaRemainingSec(estimated);

    // Fire and forget the API call
    api.generateCourse(
      courseParams.prompt, 
      courseParams.difficultyLevel || 'intermediate',
      modules,
      lessons
    ).then(result => {
      logger.debug('✅ [COURSE GENERATION] API call returned a result (this might be rare for long generations):', result);
    }).catch(error => {
      logger.error('💥 [COURSE GENERATION] API call failed or timed out (expected for long generations):', error.message);
    });

    // Immediately update UI and start monitoring
    setShowNewCourseForm(false);
    setIsMonitoring(true);
    setSuccessMessage(`Course generation for "${courseParams.prompt}" has started. It will appear on your dashboard shortly.`);
    setShowSuccessToast(true);
    
    setTimeout(() => setShowSuccessToast(false), 8000);
    
    // Multiple fallback refreshes to catch courses that might not trigger SSE
    // First fallback: 10 seconds
    setTimeout(async () => {
      try {
        logger.debug('🔄 [COURSE GENERATION] First fallback refresh (10s)');
        await fetchSavedCourses(true);
      } catch (error) {
        logger.warn('⚠️ [COURSE GENERATION] First fallback refresh failed:', error.message);
      }
    }, 10000);
    
    // Second fallback: 30 seconds
    setTimeout(async () => {
      try {
        logger.debug('🔄 [COURSE GENERATION] Second fallback refresh (30s)');
        await fetchSavedCourses(true);
        
        // Check if we got a new course
        const currentCount = savedCourses.length;
        const newCourses = await api.getSavedCourses();
        if (Array.isArray(newCourses) && newCourses.length > currentCount) {
          logger.info('🎉 [COURSE GENERATION] Second fallback refresh found new course!');
          setSavedCourses(newCourses);
          setSuccessMessage('Course generation completed! New course found via fallback refresh.');
          setShowSuccessToast(true);
          setIsGenerating(false);
          setIsMonitoring(false);
        }
      } catch (error) {
        logger.warn('⚠️ [COURSE GENERATION] Second fallback refresh failed:', error.message);
      }
    }, 30000);

  }, [api, user?.id, savedCourses.length, fetchSavedCourses]);

  // Drive ETA countdown while generating
  useEffect(() => {
    if (!isGenerating || !etaStartMs || !etaTotalSec) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - etaStartMs) / 1000);
      const remaining = Math.max(0, etaTotalSec - elapsed);
      setEtaRemainingSec(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isGenerating, etaStartMs, etaTotalSec]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteCourse = useCallback(async (courseId) => {
    try {
      // Clear any existing errors first
      setError(null);
      
      logger.debug('🗑️ [DASHBOARD] Deleting course:', courseId);
      
      const deleteResult = await api.deleteCourse(courseId);
      logger.debug('✅ [DASHBOARD] Course deletion API call completed:', deleteResult);
      
      // Immediately refresh from server to ensure UI sync
      try {
        await fetchSavedCourses(true);
      } catch (e) {
        logger.warn('⚠️ [DASHBOARD] Immediate post-delete refresh failed:', e?.message);
      }
      
      // Clear the course to delete state immediately
      setCourseToDelete(null);
      
      // Show success message
      setSuccessMessage('Course deleted successfully! Refreshing course list...');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      // --- NEW: Force a refresh of the course list ---
      // await fetchSavedCourses(true); // `true` forces a refetch
      
    } catch (error) {
      logger.error('❌ [DASHBOARD] Error deleting course:', error);
      setCourseToDelete(null);
      
      if (error.message && !error.message.includes('Course not found')) {
        setError(error.message || 'Failed to delete course');
      } else {
        // If course was already not found, just refresh the list to sync up
        fetchSavedCourses(true);
      }
    }
  }, [api, fetchSavedCourses]);

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
      
      // Refresh user profile from backend to get the most up-to-date count
      await fetchUserProfile();
      
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

  // Fetch user profile from backend
  const fetchUserProfile = useCallback(async () => {
    try {
      logger.debug('👤 [DASHBOARD] Fetching user profile from backend...');
      const userData = await api.getCurrentUser();
      
      if (userData) {
        logger.debug('✅ [DASHBOARD] User profile fetched:', {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          courseCredits: userData.courseCredits
        });
        setUserProfile(userData);
        
        // Also update credits from the same response
        if (userData.courseCredits !== undefined) {
          setCredits(userData.courseCredits);
        }
      } else {
        logger.warn('⚠️ [DASHBOARD] No user data in response:', userData);
        setUserProfile(null);
        setCredits(0);
      }
    } catch (error) {
      logger.error('❌ [DASHBOARD] Error fetching user profile:', error);
      setUserProfile(null);
      setCredits(0);
    }
  }, [api]);

  // Fetch user credits from backend (deprecated - now handled by fetchUserProfile)
  const fetchUserCredits = useCallback(async () => {
    try {
      logger.debug('💳 [DASHBOARD] Fetching user credits from backend...');
      const userData = await api.getCurrentUser();
      
      if (userData && userData.courseCredits !== undefined) {
        logger.debug('✅ [DASHBOARD] User credits fetched:', userData.courseCredits);
        setCredits(userData.courseCredits);
      } else {
        logger.warn('⚠️ [DASHBOARD] No credits data in user response:', userData);
        setCredits(0);
      }
    } catch (error) {
      logger.error('❌ [DASHBOARD] Error fetching user credits:', error);
      setCredits(0);
    }
  }, [api]);

  useEffect(() => {
    // Fetch user profile when component mounts or user changes
    if (user) {
      fetchUserProfile();
    }
  }, [user, fetchUserProfile]);

  // Fetch saved courses on component mount
  useEffect(() => {
    if (user) {
      try {
        // Clear any existing errors when component mounts
        setError(null);
        
        // Force a fresh fetch immediately after login to avoid stale cache
        const token = localStorage.getItem('token');
        if (token) {
          fetchSavedCourses(true);
        } else {
          fetchSavedCourses();
        }
        
        // If returning from Stripe payment, refresh user info
        if (urlParams.get('payment') === 'success') {
          handlePaymentSuccess();
        }
        
      } catch (error) {
        logger.error('❌ [DASHBOARD] Error in initial data fetch:', error);
        // Don't let errors propagate - just log them
      }
    }
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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {userName}!</span>

              <button
                onClick={() => setShowReportProblem(true)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
                </svg>
                Report Problem
              </button>
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
            <button
              onClick={fetchUserProfile}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
              title="Refresh user data"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
        
        {/* Debug Information */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center justify-between">
              <div>
                <strong>Debug Info:</strong>
                <p className="text-sm mt-1">
                  Courses: {savedCourses.length} | 
                  SSE Connected: {courseNotificationService.isConnected ? 'Yes' : 'No'} | 
                  User ID: {user?.id}
                </p>
              </div>
              <button
                onClick={() => {
                  logger.info('🔍 [DASHBOARD] Debug info:', {
                    coursesCount: savedCourses.length,
                    courses: savedCourses.map(c => ({ id: c.id, title: c.title, userId: c.userId })),
                    user: { id: user?.id, email: user?.email },
                    timestamp: new Date().toISOString()
                  });
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Log Debug
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
                  error={error}
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
              <p className="text-sm text-gray-600 mb-2">
                Please wait while we create your course. This may take a few minutes.
              </p>
              {etaTotalSec > 0 && (
                <div className="mt-2 mb-4">
                  <div className="text-xs text-gray-500">Estimated time remaining</div>
                  <div className="text-base font-semibold">
                    {String(Math.floor(etaRemainingSec / 60)).padStart(2,'0')}
                    :
                    {String(etaRemainingSec % 60).padStart(2,'0')}
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded"
                      style={{ width: `${Math.min(100, Math.max(0, ((etaTotalSec - etaRemainingSec) / etaTotalSec) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  logger.debug('🛑 [DASHBOARD] User closed generation modal');
                  setIsGenerating(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Hide
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

        {/* Report Problem Modal */}
        <ReportProblem
          isOpen={showReportProblem}
          onClose={() => setShowReportProblem(false)}
          onSuccess={() => {
            // Optional: Show a success toast or notification
            console.log('Report submitted successfully');
          }}
        />
      </main>
    </div>
  );
};

export default Dashboard;