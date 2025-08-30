import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      console.log('[VERIFY EMAIL] Starting verification with:', { token: token ? token.substring(0, 10) + '...' : 'none', email });

      if (!token || !email) {
        console.error('[VERIFY EMAIL] Missing token or email:', { token: !!token, email: !!email });
        setVerificationStatus('error');
        setError('Invalid verification link. Please check your email and try again.');
        return;
      }

      try {
        console.log('[VERIFY EMAIL] Calling verification API...');
        const response = await fetch(`https://thediscourse.ai/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`);
        const data = await response.json();

        console.log('[VERIFY EMAIL] API response:', { status: response.status, data });

        if (response.ok) {
          setVerificationStatus('success');
          setMessage(data.message || 'Email verified successfully!');
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          console.error('[VERIFY EMAIL] Verification failed:', data.error);
          setVerificationStatus('error');
          setError(data.error || 'Verification failed. Please try again.');
        }
      } catch (error) {
        console.error('[VERIFY EMAIL] Network error:', error);
        setVerificationStatus('error');
        setError('Network error. Please check your connection and try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  const handleResendVerification = async () => {
    const email = searchParams.get('email');
    if (!email) {
      setError('Email not found in verification link.');
      return;
    }

    try {
      const response = await fetch('https://thediscourse.ai/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Verification email sent successfully!');
        setError('');
      } else {
        setError(data.error || 'Failed to resend verification email.');
        setMessage('');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      setMessage('');
    }
  };

  if (verificationStatus === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-blue-600">
              <ExclamationTriangleIcon className="h-12 w-12 animate-pulse" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Verifying Your Email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your email address...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-green-600">
              <CheckCircleIcon className="h-12 w-12" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Email Verified!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {message}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Redirecting you to login page...
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-600">
            <XCircleIcon className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verification Failed
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {error}
          </p>
          
          {message && (
            <p className="mt-2 text-sm text-green-600">
              {message}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <button
              onClick={handleResendVerification}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Resend Verification Email
            </button>
            
            <Link
              to="/login"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
