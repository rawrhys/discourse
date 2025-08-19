import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import imagePreloadService from '../services/ImagePreloadService';
import imagePerformanceMonitor from '../services/ImagePerformanceMonitor';

const Image = ({ 
  src, 
  alt = '', 
  className = '', 
  style = {}, 
  lazy = true, 
  preload = false, 
  priority = false,
  placeholder = null,
  timeout = 3000, // 3 second timeout for fallback
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || preload);
  const [lowQualitySrc, setLowQualitySrc] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(null);
  const [showFallback, setShowFallback] = useState(false);
  
  const pictureRef = useRef(null);
  const imgRef = useRef(null);
  const preloadLinkRef = useRef(null);
  const timeoutRef = useRef(null);

  // Determine if we should show the image
  const shouldShowImage = isInView || preload;

  // Optimized image sizes for better performance - single size to reduce complexity
  const imageSizes = useMemo(() => [800], []);

  // Create optimized srcSet for different formats with caching
  const createSrcSet = useCallback((baseUrl, format) => {
    if (!baseUrl || !isInView) return '';
    
    // Use fast image proxy for maximum speed
    const proxyUrl = baseUrl.replace('/api/image/enhanced', '/api/image/fast');
    return imageSizes
      .map(size => `${proxyUrl} ${size}w`) // No parameters for maximum speed
      .join(', ');
  }, [isInView, imageSizes]);

  // Generate low-quality placeholder with better error handling - only if not already loaded
  const generateLowQualityPlaceholder = useCallback(async (imageUrl) => {
    if (!imageUrl || lowQualitySrc || isLoaded) return;
    
    try {
      // Use fast path for placeholder - no processing needed
      const placeholderUrl = imageUrl.replace('/api/image/enhanced', '/api/image/fast');
      setLowQualitySrc(placeholderUrl);
    } catch (error) {
      console.warn('[Image] Failed to generate low-quality placeholder:', error);
    }
  }, [lowQualitySrc, isLoaded]);

  // Optimized intersection observer with enhanced performance settings
  useEffect(() => {
    if (!lazy || preload) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: '200px 0px 200px 0px', // Increased margins for earlier loading
        threshold: 0.05 // Lower threshold for faster triggering
      }
    );

    if (pictureRef.current) {
      observer.observe(pictureRef.current);
    }

    return () => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    };
  }, [lazy, preload]);

  // Generate low-quality placeholder when image comes into view - only once
  useEffect(() => {
    if (isInView && src && !lowQualitySrc && !isLoaded) {
      generateLowQualityPlaceholder(src);
    }
  }, [isInView, src, lowQualitySrc, isLoaded, generateLowQualityPlaceholder]);

  // Track start time when image begins loading
  useEffect(() => {
    if (shouldShowImage && imgRef.current) {
      imgRef.current.dataset.startTime = Date.now().toString();
      // Track image load start for performance monitoring
      imagePerformanceMonitor.trackManualImageLoad(src, 0, 0);
    }
  }, [shouldShowImage, src]);

  // Handle image load with timeout and performance monitoring
  const handleImageLoad = useCallback((event) => {
    const img = event.target;
    const startTime = parseInt(img.dataset.startTime || '0');
    const loadTime = Date.now() - startTime;
    
    // Clear timeout since image loaded successfully
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsLoaded(true);
    setIsError(false);
    setShowFallback(false);
    
    // Track performance metrics asynchronously to avoid blocking
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const imageSize = img.naturalWidth * img.naturalHeight || 0;
        imagePerformanceMonitor.trackManualImageLoad(src, loadTime, imageSize);
        
        // Log slow loads for monitoring
        if (loadTime > 3000) {
          console.warn(`[Image] Slow image load detected for ${src}: ${loadTime}ms`);
        } else {
          console.log(`[Image] Loaded ${src} in ${loadTime}ms`);
        }
      }, { timeout: 1000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        const imageSize = img.naturalWidth * img.naturalHeight || 0;
        imagePerformanceMonitor.trackManualImageLoad(src, loadTime, imageSize);
        
        if (loadTime > 3000) {
          console.warn(`[Image] Slow image load detected for ${src}: ${loadTime}ms`);
        } else {
          console.log(`[Image] Loaded ${src} in ${loadTime}ms`);
        }
      }, 0);
    }
  }, [src]);

  // Handle image error with fallback
  const handleImageError = useCallback((event) => {
    console.error(`[Image] Failed to load: ${src}`);
    setIsError(true);
    
    // Clear timeout since we're handling the error
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Try fallback to original URL if using proxy
    if (src && src.includes('/api/image/')) {
      const originalUrl = src.replace(/.*url=/, '').replace(/&.*/, '');
      if (originalUrl && originalUrl !== src) {
        console.log(`[Image] Trying fallback: ${originalUrl}`);
        event.target.src = decodeURIComponent(originalUrl);
        return;
      }
    }
    
    // Show fallback placeholder
    setShowFallback(true);
  }, [src]);

  // Set up timeout for slow loading images
  useEffect(() => {
    if (shouldShowImage && src && !isLoaded && !isError) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`[Image] Timeout after ${timeout}ms for: ${src}`);
        setShowFallback(true);
      }, timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shouldShowImage, src, isLoaded, isError, timeout]);

  // Improved preload strategy with cleanup - only preload if not already loaded and not handled by ImagePreloadService
  useEffect(() => {
    if (!shouldShowImage || isLoaded || !src) return;

    // Use requestIdleCallback for non-critical preloading
    const preloadImage = () => {
      if (priority && imgRef.current) {
        // High priority images get immediate preload
        imagePreloadService.preloadImage(src, 'high');
      } else {
        // Low priority images use idle time
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            imagePreloadService.preloadImage(src, 'low');
          }, { timeout: 2000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            imagePreloadService.preloadImage(src, 'low');
          }, 100);
        }
      }
    };

    preloadImage();
  }, [priority, src, shouldShowImage, isLoaded]);

  // Memoized srcSet creation for better performance - only create if needed
  const srcSet = useMemo(() => {
    if (!shouldShowImage || !src) return '';
    return createSrcSet(src, 'webp');
  }, [shouldShowImage, src, createSrcSet]);

  // Fallback placeholder image
  const fallbackImage = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

  // If showing fallback, render placeholder
  if (showFallback) {
    return (
      <div 
        ref={pictureRef}
        className={`image-fallback ${className}`}
        style={{
          ...style,
          backgroundImage: `url(${fallbackImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px'
        }}
        {...props}
      >
        <span style={{ color: '#6b7280', fontSize: '14px' }}>
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <picture ref={pictureRef} className={className}>
      {/* WebP format for better performance */}
      {srcSet && (
        <source
          type="image/webp"
          srcSet={srcSet}
          sizes="(max-width: 768px) 100vw, 800px"
        />
      )}
      
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`image-component ${isLoaded ? 'loaded' : 'loading'}`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        style={{
          ...style,
          opacity: isLoaded ? 1 : 0.7,
          transition: 'opacity 0.3s ease-in-out',
          ...(isLoaded ? {} : { filter: 'blur(1px)' })
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        {...props}
      />
    </picture>
  );
};

Image.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  lazy: PropTypes.bool,
  preload: PropTypes.bool,
  priority: PropTypes.bool,
  placeholder: PropTypes.string,
  timeout: PropTypes.number // Added timeout prop
};

export default Image; 