import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: form, 2: payment, 3: processing, 4: email verification
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [captchaToken, setCaptchaToken] = useState();
  const captcha = useRef();
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const PENDING_REG_KEY = 'pendingRegistration';

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (!acceptedPolicy) {
      return setError('You must accept the Privacy Policy to create an account.');
    }

    if (!acceptedTerms) {
      return setError('You must accept the User Agreement to create an account.');
    }

    if (!captchaToken) {
      setShowCaptchaModal(true);
      return;
    }
    
    // Go directly to Stripe checkout
    await handlePaymentRedirect();
  };

  const resetCaptcha = () => {
    setCaptchaToken(null);
    if (captcha.current) {
      try {
        captcha.current.resetCaptcha();
      } catch (error) {
        console.log('Captcha reset error:', error);
      }
    }
  };

  const handlePaymentComplete = () => {
    setIsPaymentComplete(true);
    setCurrentStep(3);
    // Proceed with account creation using the complete-registration endpoint
    createAccountAfterPayment();
  };

  const createAccountAfterPayment = async () => {
    setIsLoading(true);
    try {
      // Retrieve pending registration details saved before redirect
      let pending = null;
      try {
        pending = JSON.parse(localStorage.getItem(PENDING_REG_KEY) || 'null');
      } catch {}

      const finalEmail = pending?.email || email;
      const finalName = pending?.name || name;
      const finalPassword = pending?.password || password;
      const finalPolicyVersion = pending?.policyVersion || '1.0';

      if (!finalEmail || !finalName || !finalPassword) {
        throw new Error('Missing registration details after payment. Please try again.');
      }

      // Use the complete-registration endpoint for users who have paid
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: finalEmail,
          name: finalName,
          password: finalPassword,
          policyVersion: finalPolicyVersion
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Account created successfully after payment:', data);
        
        // Clear pending registration details
        try { localStorage.removeItem(PENDING_REG_KEY); } catch {}
        
        // Show success message and redirect to login
        setError(''); // Clear any previous errors
        setCurrentStep(3); // Show success step
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete registration');
      }
    } catch (error) {
      setError(error?.message || 'Failed to create an account. Please try again.');
      // No need to go back to payment step since we go directly to Stripe
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async () => {
    setIsLoading(true);
    try {
      const result = await register(email, password, name, { gdprConsent: true, policyVersion: '1.0', captchaToken });
      try { captcha.current?.resetCaptcha(); } catch {}
      
      if (result.requiresEmailConfirmation) {
        setCurrentStep(4); // Show email verification step
        setError('');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setError(error?.message || 'Failed to create an account. Please try again.');
      // No need to go back to payment step since we go directly to Stripe
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentRedirect = async () => {
    // Store email/password in sessionStorage for the webhook
    sessionStorage.setItem('reg_email', email);
    sessionStorage.setItem('reg_password', password);
    
    // Persist registration details across Stripe redirect
    try {
      localStorage.setItem(PENDING_REG_KEY, JSON.stringify({
        email,
        name,
        password,
        policyVersion: '1.0'
      }));
    } catch {}

    try {
      console.log('[Registration] Creating checkout session for email:', email);
      
      // Call our production backend API to create the Stripe checkout session
      const resp = await fetch('https://thediscourse.ai/api/auth/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log('[Registration] Server response status:', resp.status);
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('[Registration] Server error response:', errorText);
        throw new Error(`Failed to create checkout session: ${resp.status} ${errorText}`);
      }
      
      const responseData = await resp.json();
      console.log('[Registration] Server response data:', responseData);
      
      if (!responseData.url) {
        throw new Error('No checkout URL received from server');
      }
      
      // Redirect directly to Stripe checkout using the provided URL
      window.location = responseData.url;
      
      console.log('[Registration] Stripe redirect successful');
    } catch (error) {
      console.error('[Registration] Payment redirect error:', error);
      setError(`Failed to redirect to payment: ${error.message}`);
    }
  };

  // Check for payment success on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      handlePaymentComplete();
    }
  }, []);

  // Step 1: Registration Form
  if (currentStep === 1) {
    return (
      <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              src={"/assets/images/discourse-logo.png"}
              alt="Discourse Logo"
              style={{ width: '200px', margin: '0 auto', display: 'block' }}
            />
            <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Pricing Information</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>• 14-day free trial (no charge)</p>
                    <p>• £20/month after trial period</p>
                    <p>• Card verification required to start trial</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleFormSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="name" className="sr-only">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="privacy-policy"
                  name="privacy-policy"
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={(e) => setAcceptedPolicy(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  required
                />
              </div>
              <div className="ml-2 text-sm text-gray-600">
                I have read and accept the{' '}
                <Link to="/privacy" className="text-indigo-600 hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="user-agreement"
                  name="user-agreement"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  required
                />
              </div>
              <div className="ml-2 text-sm text-gray-600">
                I have read and accept the{' '}
                <Link to="/terms" className="text-indigo-600 hover:text-indigo-500" target="_blank" rel="noopener noreferrer">
                  User Agreement & Terms of Service
                </Link>
                , including the AI content disclaimers.
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isLoading ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCaptchaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <button
              type="button"
              onClick={() => setShowCaptchaModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              aria-label="Close captcha"
              title="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">Verify you are human</h3>
            <div className="flex justify-center">
              <HCaptcha
                ref={captcha}
                sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || '47c451f8-8dde-4b54-b3b8-3ac6d1c26874'}
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setShowCaptchaModal(false);
                }}
                onError={(error) => {
                  console.error('Captcha error:', error);
                  setError('Captcha verification failed. Please try again.');
                  resetCaptcha();
                }}
                onExpire={() => {
                  console.log('Captcha expired');
                  setError('Captcha expired. Please complete it again.');
                  resetCaptcha();
                }}
              />
            </div>
          </div>
        </div>
      )}
      </>
    );
  }



  // Step 3: Success
  if (currentStep === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              src={"/assets/images/discourse-logo.png"}
              alt="Discourse Logo"
              style={{ width: '200px', margin: '0 auto', display: 'block' }}
            />
            <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">
              Account Created Successfully!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account has been created and your subscription is active.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Subscription Active</h3>
              <p className="mt-1 text-sm text-gray-600">
                You're now on a 14-day free trial, then £20/month thereafter.
              </p>
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
              <p>✅ 14-day free trial activated</p>
              <p>✅ Card verification completed</p>
              <p>✅ Account ready to use</p>
            </div>
            
            <div className="mt-6">
              <p className="text-xs text-gray-500 text-center">
                Redirecting to login in a few seconds...
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 4: Email Verification Required
  if (currentStep === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              src={"/assets/images/discourse-logo.png"}
              alt="Discourse Logo"
              style={{ width: '200px', margin: '0 auto', display: 'block' }}
            />
            <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">
              Check Your Email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've sent a verification link to <strong>{email}</strong>
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Email Verification Required</h3>
              <p className="mt-1 text-sm text-gray-600">
                To complete your registration, please click the verification link in your email.
              </p>
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
              <p>📧 Check your inbox (and spam folder)</p>
              <p>🔗 Click the verification link</p>
              <p>✅ Complete your account setup</p>
            </div>
            
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  // Resend verification email
                  fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  }).then(() => {
                    alert('Verification email resent!');
                  }).catch(() => {
                    alert('Failed to resend verification email. Please try again.');
                  });
                }}
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

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Register; 