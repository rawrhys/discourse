import React, { useState, useEffect } from 'react';

const CaptchaChallenge = ({ onSuccess, onCancel, challengeData, challengeKey }) => {
  const [challenge, setChallenge] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Use the challenge data from server
    if (challengeData) {
      setChallenge(challengeData);
    } else {
      // Fallback to local generation
      generateChallenge();
    }
  }, [challengeData]);

  const generateChallenge = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setChallenge(`${num1} + ${num2}`);
    setResponse('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // If we have a challenge key, verify with server
      if (challengeKey) {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        const courseId = window.location.pathname.split('/').pop();
        
        const verifyUrl = `/api/public/courses/${courseId}?sessionId=${sessionId}&challenge=${challenge}&response=${response}&challengeKey=${challengeKey}`;
        
        const response = await fetch(verifyUrl);
        if (response.ok) {
          onSuccess();
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Incorrect answer. Please try again.');
          // Request new challenge from server
          onCancel(); // This will trigger a new request
        }
      } else {
        // Fallback to local verification
        const expectedResponse = eval(challenge.replace(' + ', '+'));
        
        if (parseInt(response) === expectedResponse) {
          onSuccess();
        } else {
          setError('Incorrect answer. Please try again.');
          generateChallenge();
        }
      }
    } catch (err) {
      setError('Invalid input. Please try again.');
      generateChallenge();
    } finally {
      setLoading(false);
    }
  };

  const handleNewChallenge = () => {
    generateChallenge();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Security Verification
          </h2>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Please solve this simple math problem to continue:
            </p>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <span className="text-3xl font-bold text-gray-800">
                {challenge} = ?
              </span>
            </div>
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
                onClick={handleNewChallenge}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                New Challenge
              </button>
              
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={loading || !response}
              >
                {loading ? 'Verifying...' : 'Submit'}
              </button>
            </div>
          </form>

          <button
            onClick={onCancel}
            className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaptchaChallenge;
