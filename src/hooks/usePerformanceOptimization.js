import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Hook for debouncing function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const useDebounce = (func, delay) => {
  const timeoutRef = useRef(null);
  
  const debouncedFunc = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      func(...args);
    }, delay);
  }, [func, delay]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedFunc;
};

/**
 * Hook for throttling function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const useThrottle = (func, limit) => {
  const inThrottle = useRef(false);
  
  const throttledFunc = useCallback((...args) => {
    if (!inThrottle.current) {
      func(...args);
      inThrottle.current = true;
      
      setTimeout(() => {
        inThrottle.current = false;
      }, limit);
    }
  }, [func, limit]);
  
  return throttledFunc;
};

/**
 * Hook for preventing excessive re-renders by tracking previous values
 * @param {*} value - Value to track
 * @param {Function} shouldUpdate - Function to determine if update is needed
 * @returns {boolean} Whether the value has changed significantly
 */
export const useStableValue = (value, shouldUpdate = (prev, curr) => prev !== curr) => {
  const ref = useRef();
  const hasChanged = ref.current === undefined || shouldUpdate(ref.current, value);
  
  if (hasChanged) {
    ref.current = value;
  }
  
  return hasChanged;
};

/**
 * Hook for batching multiple state updates to prevent excessive re-renders
 * @param {Function} initialState - Function to get initial state
 * @returns {[Object, Function]} State object and batch update function
 */
export const useBatchedState = (initialState) => {
  const [state, setState] = useState(initialState);
  const batchRef = useRef(new Map());
  const timeoutRef = useRef(null);
  
  const batchUpdate = useCallback((updates) => {
    // Add updates to batch
    Object.entries(updates).forEach(([key, value]) => {
      batchRef.current.set(key, value);
    });
    
    // Schedule batch update
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const batchedUpdates = Object.fromEntries(batchRef.current);
      setState(prev => ({ ...prev, ...batchedUpdates }));
      batchRef.current.clear();
    }, 16); // One frame at 60fps
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return [state, batchUpdate];
};

/**
 * Hook for preventing excessive API calls
 * @param {Function} apiCall - API function to call
 * @param {number} cooldown - Cooldown period in milliseconds
 * @returns {Function} Throttled API call function
 */
export const useApiThrottle = (apiCall, cooldown = 1000) => {
  const lastCallRef = useRef(0);
  
  const throttledApiCall = useCallback(async (...args) => {
    const now = Date.now();
    
    if (now - lastCallRef.current < cooldown) {
      console.log('[API Throttle] Call blocked, cooldown active');
      return null;
    }
    
    lastCallRef.current = now;
    return await apiCall(...args);
  }, [apiCall, cooldown]);
  
  return throttledApiCall;
};

/**
 * Hook for optimizing expensive calculations
 * @param {Function} calculation - Expensive calculation function
 * @param {Array} dependencies - Dependencies for the calculation
 * @param {number} maxCalls - Maximum number of calls per second
 * @returns {*} Result of the calculation
 */
export const useOptimizedCalculation = (calculation, dependencies, maxCalls = 10) => {
  const [result, setResult] = useState(null);
  const lastCalculationRef = useRef(0);
  const callCountRef = useRef(0);
  const lastResetRef = useRef(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    
    // Reset call count every second
    if (now - lastResetRef.current >= 1000) {
      callCountRef.current = 0;
      lastResetRef.current = now;
    }
    
    // Check if we can perform the calculation
    if (callCountRef.current < maxCalls && 
        (now - lastCalculationRef.current) >= (1000 / maxCalls)) {
      
      callCountRef.current++;
      lastCalculationRef.current = now;
      
      try {
        const newResult = calculation();
        setResult(newResult);
      } catch (error) {
        console.warn('[Optimized Calculation] Error:', error);
      }
    }
  }, dependencies);
  
  return result;
};

/**
 * Hook for preventing excessive console logging
 * @param {string} key - Unique key for this logger
 * @param {number} maxLogs - Maximum logs per second
 * @returns {Function} Throttled console.log function
 */
export const useThrottledLogger = (key, maxLogs = 5) => {
  const logCountRef = useRef(0);
  const lastResetRef = useRef(Date.now());
  
  const throttledLog = useCallback((...args) => {
    const now = Date.now();
    
    // Reset log count every second
    if (now - lastResetRef.current >= 1000) {
      logCountRef.current = 0;
      lastResetRef.current = now;
    }
    
    // Only log if under the limit
    if (logCountRef.current < maxLogs) {
      logCountRef.current++;
      console.log(`[${key}]`, ...args);
    } else if (logCountRef.current === maxLogs) {
      logCountRef.current++;
      console.log(`[${key}] Logging throttled - too many logs per second`);
    }
  }, [key, maxLogs]);
  
  return throttledLog;
};

/**
 * Hook for optimizing component re-renders
 * @param {Function} shouldRender - Function to determine if re-render is needed
 * @param {Array} dependencies - Dependencies for the shouldRender function
 * @returns {boolean} Whether the component should re-render
 */
export const useRenderOptimization = (shouldRender, dependencies) => {
  const [shouldUpdate, setShouldUpdate] = useState(false);
  const lastCheckRef = useRef(0);
  
  useEffect(() => {
    const now = Date.now();
    
    // Only check every 16ms (60fps) to prevent excessive checks
    if (now - lastCheckRef.current >= 16) {
      lastCheckRef.current = now;
      const needsUpdate = shouldRender();
      setShouldUpdate(needsUpdate);
    }
  }, dependencies);
  
  return shouldUpdate;
};

export default {
  useDebounce,
  useThrottle,
  useStableValue,
  useBatchedState,
  useApiThrottle,
  useOptimizedCalculation,
  useThrottledLogger,
  useRenderOptimization
}; 