import React, { useState, useEffect } from 'react';

const NameEntryModal = ({ isOpen, onClose, onNameSubmit, courseId, sessionId }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inappropriateWarning, setInappropriateWarning] = useState('');

  // List of inappropriate words/phrases to detect
  const inappropriateWords = [
    'mike oxlong', 'mike ox long', 'mikeoxlong',
    'hugh jass', 'hugh j ass', 'hughjass',
    'ben dover', 'ben d over', 'bendover',
    'dixie normous', 'dixie n ormous', 'dixienormous',
    'mike hunt', 'mike h unt', 'mikehunt',
    'dick head', 'dick h ead', 'dickhead',
    'ass hole', 'ass h ole', 'asshole',
    'fuck', 'shit', 'bitch', 'damn', 'hell',
    'stupid', 'idiot', 'moron', 'retard',
    'test', 'testing', 'test123', 'asdf', 'qwerty',
    'admin', 'root', 'user', 'guest'
  ];

  // Function to check for inappropriate content
  const checkInappropriateContent = (text) => {
    if (!text) return false;
    
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    
    for (const word of inappropriateWords) {
      if (normalizedText.includes(word.toLowerCase())) {
        return word;
      }
    }
    
    // Check for obvious fake names (very short, numbers, special characters)
    if (normalizedText.length < 2 || /\d/.test(normalizedText) || /[^a-zA-Z\s]/.test(normalizedText)) {
      return 'invalid_format';
    }
    
    return false;
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    } else {
      const inappropriate = checkInappropriateContent(firstName);
      if (inappropriate) {
        if (inappropriate === 'invalid_format') {
          newErrors.firstName = 'Please enter a valid first name';
        } else {
          newErrors.firstName = 'Please enter an appropriate first name';
          setInappropriateWarning(`Warning: "${inappropriate}" is not appropriate. Please use your real name.`);
        }
      }
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else {
      const inappropriate = checkInappropriateContent(lastName);
      if (inappropriate) {
        if (inappropriate === 'invalid_format') {
          newErrors.lastName = 'Please enter a valid last name';
        } else {
          newErrors.lastName = 'Please enter an appropriate last name';
          setInappropriateWarning(`Warning: "${inappropriate}" is not appropriate. Please use your real name.`);
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Save the name to the session
      const response = await fetch(`/api/public/courses/${courseId}/username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          firstName: firstName.trim(),
          lastName: lastName.trim()
        })
      });
      
      if (response.ok) {
        onNameSubmit({
          firstName: firstName.trim(),
          lastName: lastName.trim()
        });
        onClose();
      } else {
        const error = await response.json();
        setErrors({ general: error.message || 'Failed to save name. Please try again.' });
      }
    } catch (error) {
      console.error('Error saving name:', error);
      setErrors({ general: 'Failed to save name. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear inappropriate warning when user starts typing
  useEffect(() => {
    if (inappropriateWarning) {
      const timer = setTimeout(() => {
        setInappropriateWarning('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [inappropriateWarning]);

  // Clear errors when user starts typing
  const handleInputChange = (field, value) => {
    if (field === 'firstName') {
      setFirstName(value);
    } else {
      setLastName(value);
    }
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Clear general error
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600">
            Please enter your name to continue with the course. This helps us personalize your learning experience.
          </p>
        </div>

        {inappropriateWarning && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">{inappropriateWarning}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.firstName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter your first name"
              disabled={isSubmitting}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.lastName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter your last name"
              disabled={isSubmitting}
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
            )}
          </div>

          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Your name will be used to personalize your learning experience and track your progress.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NameEntryModal;
