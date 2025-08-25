import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Supabase v2 sends a session when navigating from the reset link
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setError('Password reset session error. Try the link again.');
      }
      if (!session) {
        // Attempt to exchange from URL (hash params)
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) {
            setError('Password reset link invalid or expired.');
          }
        } catch (e) {
          // Ignore
        }
      }
    };
    init();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      setIsSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Your password has been updated. You can now log in.');
    } catch (err) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter a new password below.</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message && <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>}
          {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <div>
            <label htmlFor="password" className="sr-only">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;


