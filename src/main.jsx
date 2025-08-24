import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import './index.css';
import App from './App';
import Home from './components/Home';
import { AuthProvider } from './contexts/AuthContext';
import ErrorHandler from './utils/errorHandler.js';
import './utils/performanceDebug.js'; // Import performance debugger
import './utils/apiDebugger.js';
import './utils/academicReferencesManager.js'; // Import academic references manager
import api from './services/api';

// Expose api to window for debugging
window.api = api;

// Initialize error handling
ErrorHandler.suppressConsoleErrors();

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  const error = event.error || new Error(event.message);
  const handled = ErrorHandler.handleError(error, 'Global Error Handler');
  
  if (handled.suppressed) {
    event.preventDefault();
    return false;
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const handled = ErrorHandler.handleError(error, 'Unhandled Promise Rejection');
  
  if (handled.suppressed) {
    event.preventDefault();
    return false;
  }
});

// Use React 19 compatible initialization
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
);
