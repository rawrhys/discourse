import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

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
      // Use the complete-registration endpoint for users who have paid
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          password,
          policyVersion: '1.0'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Account created successfully after payment:', data);
        
        // Now log in the user
        await register(email, password, name, { gdprConsent: true, policyVersion: '1.0' });
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
      await register(email, password, name, { gdprConsent: true, policyVersion: '1.0' });
      navigate('/dashboard');
    } catch (error) {
      setError(error?.message || 'Failed to create an account. Please try again.');
      setCurrentStep(2); // Go back to payment step if account creation fails
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentRedirect = () => {
    // Redirect to Stripe checkout
    const successUrl = encodeURIComponent(`${window.location.origin}/register?payment=success`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/register`);
    const stripeCheckoutUrl = `https://buy.stripe.com/3cIaEWgNC6uZdzx2SJdby00?success_url=${successUrl}&cancel_url=${cancelUrl}`;
    window.location.href = stripeCheckoutUrl;
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
    );
  }

  // Step 2: Payment Required
  if (currentStep === 2) {
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
              Complete Your Registration
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              To create your account, please complete the payment below
            </p>
          </div>

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