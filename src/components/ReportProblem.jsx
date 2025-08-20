import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const ReportProblem = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message describing your issue.');
      return;
    }
    
    if (!userEmail.trim() || !userEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Get the current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const formData = new FormData();
      formData.append('message', message.trim());
      formData.append('userEmail', userEmail.trim());
      formData.append('userId', user?.id || '');
      formData.append('timestamp', new Date().toISOString());
      formData.append('userAgent', navigator.userAgent);
      formData.append('url', window.location.href);

      // Add image files if any
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file, index) => {
          formData.append(`image_${index}`, file);
        });
        formData.append('imageCount', selectedFiles.length.toString());
      }

      const response = await fetch('/api/report-problem', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        setSuccess(true);
        setMessage('');
        setTimeout(() => {
          onClose();
          setSuccess(false);
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to submit report. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      return isValidType && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      setError('Some files were rejected. Only JPEG, PNG, GIF, and WebP images under 5MB are allowed.');
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 3)); // Max 3 images
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setMessage('');
      setUserEmail(user?.email || '');
      setError('');
      setSuccess(false);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Report a Problem</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat-like Interface */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Bot Message */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 max-w-xs">
                <p className="text-sm text-gray-800">
                  Hi there! 👋 Please describe the technical issue you're experiencing. Include as much detail as possible to help us resolve it quickly.
                </p>
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                                 <div className="bg-green-50 rounded-lg p-3 max-w-xs">
                   <p className="text-sm text-green-800">
                     Thank you! Your report has been submitted successfully. We'll contact you at {userEmail} to follow up on your issue.
                   </p>
                 </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="bg-red-50 rounded-lg p-3 max-w-xs">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

                 {/* Input Area */}
         <div className="p-4 border-t border-gray-200">
           <form onSubmit={handleSubmit} className="space-y-3">
             {/* Email Input */}
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Your Email Address *
               </label>
               <input
                 type="email"
                 value={userEmail}
                 onChange={(e) => setUserEmail(e.target.value)}
                 placeholder="Enter your email address"
                 className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                 disabled={isSubmitting || success}
                 required
               />
             </div>

             {/* Message Input */}
             <div className="relative">
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Describe the Issue *
               </label>
               <textarea
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 placeholder="Please describe the technical issue you're experiencing in detail..."
                 className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                 rows="4"
                 disabled={isSubmitting || success}
                 maxLength="1000"
                 required
               />
               <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                 {message.length}/1000
               </div>
             </div>

             {/* Image Upload Section */}
             <div className="space-y-2">
               <label className="block text-sm font-medium text-gray-700">
                 Attach Images (Optional)
               </label>
               <div className="flex items-center space-x-2">
                 <input
                   ref={fileInputRef}
                   type="file"
                   accept="image/*"
                   multiple
                   onChange={handleFileSelect}
                   disabled={isSubmitting || success || selectedFiles.length >= 3}
                   className="hidden"
                 />
                 <button
                   type="button"
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isSubmitting || success || selectedFiles.length >= 3}
                   className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-md hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                 >
                   <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                   Add Images
                 </button>
                 <span className="text-xs text-gray-500">
                   {selectedFiles.length}/3 images (max 5MB each)
                 </span>
               </div>

               {/* Selected Files Preview */}
               {selectedFiles.length > 0 && (
                 <div className="grid grid-cols-3 gap-2">
                   {selectedFiles.map((file, index) => (
                     <div key={index} className="relative group">
                       <img
                         src={URL.createObjectURL(file)}
                         alt={`Preview ${index + 1}`}
                         className="w-full h-20 object-cover rounded border border-gray-200"
                       />
                       <button
                         type="button"
                         onClick={() => removeFile(index)}
                         className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                       >
                         ×
                       </button>
                       <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                         {file.name}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Your report will include your email and technical details to help us assist you.
              </p>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim() || success}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportProblem;

