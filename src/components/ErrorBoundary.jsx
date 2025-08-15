import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // You can also log the error to an error reporting service here
    console.error('Error caught by boundary:', error, errorInfo);
  }

  // Helper function to get user-friendly error message
  getUserFriendlyErrorMessage(error) {
    if (!error) return 'An unexpected error occurred';
    
    const message = error.message || '';
    
    // Handle JSON parsing errors
    if (message.includes('Unexpected token') && message.includes('<!doctype')) {
      return 'Server is not responding correctly. Please check your connection and try again.';
    }
    
    // Handle network errors
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    
    // Handle API errors
    if (message.includes('API') || message.includes('server')) {
      return 'Server is temporarily unavailable. Please try again in a few moments.';
    }
    
    // Return the original message if it's user-friendly, otherwise a generic message
    if (message.length < 100 && !message.includes('Unexpected token')) {
      return message;
    }
    
    return 'Something went wrong. Please try again.';
  }

  render() {
    if (this.state.hasError) {
      const userFriendlyMessage = this.getUserFriendlyErrorMessage(this.state.error);
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {userFriendlyMessage}
              </p>
            </div>
            <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <div className="mt-4 bg-red-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-red-800">Error Details:</h3>
                <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 