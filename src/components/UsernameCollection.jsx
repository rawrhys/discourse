import React, { useState } from 'react';
import usernameService from '../services/UsernameService';

const UsernameCollection = ({ sessionId, onUsernameSet, onSkip }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Validate username
    const result = usernameService.setUsername(sessionId, username);
    
    if (result.valid) {
      onUsernameSet(result.username);
    } else {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="username-collection">
      <div className="username-collection-content">
        <div className="username-collection-header">
          <h2>Choose Your Display Name</h2>
          <p>Enter a username to track your progress and receive a certificate when you complete the course.</p>
        </div>

        <form onSubmit={handleSubmit} className="username-form">
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={20}
              disabled={isSubmitting}
              className={error ? 'error' : ''}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting || !username.trim()}
              className="btn-primary"
            >
              {isSubmitting ? 'Setting...' : 'Continue'}
            </button>
            
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              Skip (Anonymous)
            </button>
          </div>
        </form>

        <div className="username-guidelines">
          <h4>Username Guidelines:</h4>
          <ul>
            <li>2-20 characters long</li>
            <li>Must start with a letter</li>
            <li>Only letters, numbers, underscores, and hyphens allowed</li>
            <li>No inappropriate content</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .username-collection {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .username-collection-content {
          background: white;
          border-radius: 12px;
          padding: 30px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .username-collection-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .username-collection-header h2 {
          color: #1f2937;
          margin-bottom: 10px;
          font-size: 24px;
        }

        .username-collection-header p {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.5;
        }

        .username-form {
          margin-bottom: 30px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #374151;
        }

        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-group input.error {
          border-color: #ef4444;
        }

        .error-message {
          color: #ef4444;
          font-size: 14px;
          margin-top: 5px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-primary, .btn-secondary {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 2px solid #e5e7eb;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-secondary:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .username-guidelines {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }

        .username-guidelines h4 {
          margin: 0 0 10px 0;
          color: #1f2937;
          font-size: 16px;
        }

        .username-guidelines ul {
          margin: 0;
          padding-left: 20px;
          color: #6b7280;
        }

        .username-guidelines li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

export default UsernameCollection;
