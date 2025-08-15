// Error handling utility for managing various application errors

export class ErrorHandler {
  static isStripeError(error) {
    const stripePatterns = [
      'stripe.com',
      'errors.stripe.com',
      'r.stripe.com',
      'ERR_BLOCKED_BY_CLIENT',
      'Cannot read properties of undefined (reading \'payload\')',
      'FetchError'
    ];
    
    return stripePatterns.some(pattern => 
      error.message?.includes(pattern) || 
      error.toString().includes(pattern)
    );
  }

  static isAdBlockerError(error) {
    const adBlockerPatterns = [
      'ERR_BLOCKED_BY_CLIENT',
      'net::ERR_BLOCKED_BY_CLIENT',
      'Failed to fetch'
    ];
    
    return adBlockerPatterns.some(pattern => 
      error.message?.includes(pattern) || 
      error.toString().includes(pattern)
    );
  }

  static isAuthError(error) {
    const authPatterns = [
      '401',
      '403',
      'Unauthorized',
      'Forbidden',
      'Session expired',
      'Invalid token'
    ];
    
    return authPatterns.some(pattern => 
      error.message?.includes(pattern) || 
      error.toString().includes(pattern)
    );
  }

  static handleError(error, context = '') {
    console.error(`❌ [ERROR HANDLER] ${context}:`, error);

    // Suppress Stripe-related errors that are blocked by ad blockers
    if (this.isStripeError(error)) {
      console.warn('⚠️ [STRIPE ERROR] Suppressed Stripe error (likely blocked by ad blocker):', error.message);
      return {
        type: 'stripe_blocked',
        message: 'Payment system temporarily unavailable. Please try again later.',
        suppressed: true
      };
    }

    // Handle ad blocker errors
    if (this.isAdBlockerError(error)) {
      console.warn('⚠️ [AD BLOCKER] Resource blocked by ad blocker:', error.message);
      return {
        type: 'ad_blocker',
        message: 'Some features may be blocked by your ad blocker. Please disable it for this site.',
        suppressed: true
      };
    }

    // Handle authentication errors
    if (this.isAuthError(error)) {
      console.warn('🔒 [AUTH ERROR] Authentication issue:', error.message);
      return {
        type: 'auth_error',
        message: 'Please log in again to continue.',
        action: 'redirect_to_login'
      };
    }

    // Default error handling
    return {
      type: 'general_error',
      message: error.message || 'An unexpected error occurred.',
      suppressed: false
    };
  }

  static suppressConsoleErrors() {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = function(...args) {
      const message = args.join(' ');
      
      // Suppress Stripe and ad blocker errors
      if (this.isStripeError({ message }) || this.isAdBlockerError({ message })) {
        console.warn('⚠️ [SUPPRESSED]', message);
        return;
      }
      
      originalConsoleError.apply(console, args);
    }.bind(this);

    console.warn = function(...args) {
      const message = args.join(' ');
      
      // Suppress Stripe and ad blocker warnings
      if (this.isStripeError({ message }) || this.isAdBlockerError({ message })) {
        return;
      }
      
      originalConsoleWarn.apply(console, args);
    }.bind(this);
  }
}

export default ErrorHandler; 