import React, { memo, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import performanceMonitor from '../services/PerformanceMonitorService';

/**
 * Performance wrapper component that automatically optimizes child components
 * and tracks performance metrics to prevent excessive re-renders
 */
const PerformanceWrapper = memo(({ 
  children, 
  componentName, 
  shouldRender, 
  dependencies = [],
  enableMemoization = true,
  enablePerformanceTracking = true,
  className = '',
  ...props 
}) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  const shouldRenderRef = useRef(shouldRender);

  // Update shouldRender ref when it changes
  useEffect(() => {
    shouldRenderRef.current = shouldRender;
  }, [shouldRender]);

  // Performance tracking
  useEffect(() => {
    if (!enablePerformanceTracking) return;
    
    renderCount.current++;
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTime.current;
    
    // Track render time
    performanceMonitor.trackRenderTime(componentName || 'PerformanceWrapper', renderTime);
    
    // Track component render count
    performanceMonitor.trackComponentRender(componentName || 'PerformanceWrapper');
    
    // Warn if rendering too frequently
    if (renderCount.current > 50) {
      console.warn(`[Performance] Component ${componentName || 'PerformanceWrapper'} has rendered ${renderCount.current} times - consider optimization`);
    }
    
    lastRenderTime.current = currentTime;
  });

  // Memoized render function to prevent unnecessary re-renders
  const renderChildren = useCallback(() => {
    if (shouldRenderRef.current) {
      return children;
    }
    return null;
  }, [children]);

  // If memoization is disabled, render normally
  if (!enableMemoization) {
    return (
      <div className={`performance-wrapper ${className}`} {...props}>
        {renderChildren()}
      </div>
    );
  }

  // Memoized render with performance tracking
  return (
    <div className={`performance-wrapper ${className}`} {...props}>
      {renderChildren()}
    </div>
  );
});

PerformanceWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  componentName: PropTypes.string,
  shouldRender: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  dependencies: PropTypes.array,
  enableMemoization: PropTypes.bool,
  enablePerformanceTracking: PropTypes.bool,
  className: PropTypes.string
};

PerformanceWrapper.defaultProps = {
  shouldRender: true,
  enableMemoization: true,
  enablePerformanceTracking: true
};

export default PerformanceWrapper; 