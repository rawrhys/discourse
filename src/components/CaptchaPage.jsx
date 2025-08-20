import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const CaptchaPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [captchaData, setCaptchaData] = useState(null);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    checkAccess();
  }, [courseId]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[CaptchaPage] Checking access for course:', courseId);
      
      // Get sessionId from URL if available
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('sessionId');
      
      // Use the dedicated CAPTCHA endpoint with sessionId if available
      const verifyUrl = sessionId 
        ? `/api/captcha/verify/${courseId}?sessionId=${encodeURIComponent(sessionId)}`
        : `/api/captcha/verify/${courseId}`;
      
      const response = await fetch(verifyUrl);
      const result = await response.json();
      
      if (result.requiresCaptcha) {
        console.log('[CaptchaPage] CAPTCHA required:', result);
        setCaptchaData(result);
      } else {
        console.log('[CaptchaPage] Course access granted, redirecting to course');
        // Redirect to the actual course page
        navigate(`/public/course/${courseId}?sessionId=${result.sessionId}`);
        return;
      }
    } catch (err) {
      console.error('[CaptchaPage] Error checking access:', err);
      setError('Failed to verify access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!response.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      console.log('[CaptchaPage] Submitting CAPTCHA response:', response);
      
      // Submit CAPTCHA response to the dedicated endpoint
      const verifyUrl = `/api/captcha/verify/${courseId}?challenge=${encodeURIComponent(captchaData.challenge)}&response=${encodeURIComponent(response)}&challengeKey=${encodeURIComponent(captchaData.challengeKey)}`;
      
      const fetchResponse = await fetch(verifyUrl);
      const result = await fetchResponse.json();

      if (fetchResponse.ok && result.success) {
        console.log('[CaptchaPage] CAPTCHA passed, redirecting to course');
        // CAPTCHA passed, redirect to course
        navigate(`/public/course/${courseId}?sessionId=${result.sessionId}`);
        return;
      } else {
        // CAPTCHA failed
        setAttempts(prev => prev + 1);
        setResponse('');
        
        // Check if it's a challenge match error and provide better feedback
        if (result.message && result.message.includes('Invalid or expired challenge')) {
          setError('Challenge verification failed. Please try the "New Challenge" button to get a fresh challenge.');
        } else {
          setError(result.message || 'Incorrect answer. Please try again.');
        }
        
        if (attempts >= 2) {
          setError('Too many failed attempts. Please refresh the page to try again.');
          setCaptchaData(null);
        } else {
          // Get new CAPTCHA
          await checkAccess();
        }
      }
    } catch (err) {
      console.error('[CaptchaPage] Error submitting CAPTCHA:', err);
      setError('Failed to verify CAPTCHA. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setAttempts(0);
      setError(null);
      setResponse('');
      setLoading(true);
      
      console.log('[CaptchaPage] Requesting new challenge for course:', courseId);
      
      // Request new challenge from server
      const response = await fetch(`/api/captcha/new/${courseId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('[CaptchaPage] New challenge received:', result);
        setCaptchaData(result);
        setError(null); // Clear any previous errors
      } else {
        console.error('[CaptchaPage] Failed to get new challenge:', result);
        setError('Failed to generate new challenge. Please try again.');
      }
    } catch (err) {
      console.error('[CaptchaPage] Error requesting new challenge:', err);
      setError('Failed to generate new challenge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (error && !captchaData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!captchaData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Security Verification Required</h2>
            <p className="text-gray-600 mb-6">
              This course requires security verification to prevent automated access. 
              Please complete the verification to continue.
            </p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Verification
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-blue-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Security Verification</h2>
            <p className="text-gray-600">Please solve this verification challenge to continue</p>
          </div>

          <div className="bg-gray-100 rounded-lg p-6 mb-6 text-center">
            <span className="text-2xl font-bold text-gray-800 leading-relaxed">
              {captchaData.challenge}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="number"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Enter your answer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                autoFocus
                required
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                New Challenge
              </button>
              
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={submitting || !response}
              >
                {submitting ? 'Verifying...' : 'Submit'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              This verification helps protect against automated access and ensures a better learning experience for all users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaptchaPage;

