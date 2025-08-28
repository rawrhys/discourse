import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { loadStripe } from '@stripe/stripe-js';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: form, 2: payment, 3: processing
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
    // Move to payment step
    setCurrentStep(2);
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
        
        // Now log in the user
        await register(finalEmail, finalPassword, finalName, { gdprConsent: true, policyVersion: finalPolicyVersion, captchaToken });
        try { captcha.current?.resetCaptcha(); } catch {}
        // Clear pending registration details
        try { localStorage.removeItem(PENDING_REG_KEY); } catch {}
        navigate('/dashboard');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete registration');
      }
    } catch (error) {
      setError(error?.message || 'Failed to create an account. Please try again.');
      setCurrentStep(2); // Go back to payment step if account creation fails
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async () => {
    setIsLoading(true);
    try {
      await register(email, password, name, { gdprConsent: true, policyVersion: '1.0', captchaToken });
      try { captcha.current?.resetCaptcha(); } catch {}
      navigate('/dashboard');
    } catch (error) {
      setError(error?.message || 'Failed to create an account. Please try again.');
      setCurrentStep(2); // Go back to payment step if account creation fails
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
      // Load Stripe
      const stripe = await loadStripe('sb_publishable__L8wUuiplUn-qz6ZBk29gw_DvVzzqu3'); // your publishable key
      
      // Call a tiny Supabase Edge Function that creates the session
      // (you could also call a regular server, but an Edge Function is quick)
      const resp = await fetch('https://gaapqvkjblqvpokmhlmh.functions.supabase.co/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!resp.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { sessionId } = await resp.json();
      
      // Redirect to Stripe checkout
      const result = await stripe.redirectToCheckout({ sessionId });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('Payment redirect error:', error);
      setError('Failed to redirect to payment. Please try again.');
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
                Complete Registration
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
                  // Advance to payment step immediately after verification
                  setCurrentStep(2);
                }}
              />
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // Step 2: Payment Required
  if (currentStep === 2) {
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
              Complete Your Registration
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              To create your account, please complete the payment below
            </p>
          </div>

          {/* Captcha is presented in a floating modal when needed */}

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Account Setup Required</h3>
              <p className="text-sm text-gray-600">
                Your account details have been saved. Complete your registration by purchasing course credits.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-900">Account Creation</span>
                <span className="text-sm text-gray-600">Free</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-900">Course Credits</span>
                <span className="text-sm text-gray-600">Free for a limited time</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">Total</span>
                  <span className="text-base font-medium text-gray-900">Free for a limited time</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handlePaymentRedirect}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Proceed to Payment
              </button>
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Back to Form
              </button>
            </div>
          </div>
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
              />
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // Step 3: Processing
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
              Creating Your Account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please wait while we set up your account...
            </p>
          </div>

          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">
              {isLoading ? 'Creating your account...' : 'Setting up your learning environment...'}
            </p>
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