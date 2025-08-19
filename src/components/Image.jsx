import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import imagePreloadService from '../services/ImagePreloadService';

const Image = ({ 
  src, 
  alt = '', 
  className = '', 
  style = {}, 
  lazy = true, 
  preload = false, 
  priority = false,
  placeholder = null,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || preload);
  const [lowQualitySrc, setLowQualitySrc] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(null);
  
  const pictureRef = useRef(null);
  const imgRef = useRef(null);
  const preloadLinkRef = useRef(null);

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
    }
  }, [shouldShowImage]);

  // Handle image load with timeout and performance monitoring
  const handleImageLoad = useCallback((event) => {
    const img = event.target;
    const startTime = parseInt(img.dataset.startTime || '0');
    const loadTime = Date.now() - startTime;
    
    setIsLoaded(true);
    setIsError(false);
    
    // Log slow loads for monitoring
    if (loadTime > 3000) {
      console.warn(`[Image] Slow image load detected for ${src}: ${loadTime}ms`);
    } else {
      console.log(`[Image] Loaded ${src} in ${loadTime}ms`);
    }
  }, [src]);

  // Handle image error with fallback
  const handleImageError = useCallback((event) => {
    console.error(`[Image] Failed to load: ${src}`);
    setIsError(true);
    
    // Try fallback to original URL if using proxy
    if (src && src.includes('/api/image/')) {
      const originalUrl = src.replace(/.*url=/, '').replace(/&.*/, '');
      if (originalUrl && originalUrl !== src) {
        console.log(`[Image] Trying fallback: ${originalUrl}`);
        event.target.src = decodeURIComponent(originalUrl);
        return;
      }
    }
  }, [src]);

  // Improved preload strategy with cleanup - only preload if not already loaded and not handled by ImagePreloadService
  useEffect(() => {
    if (priority && src && shouldShowImage && !isLoaded) {
      // Check if ImagePreloadService is already handling this image
      const isHandledByService = imagePreloadService.isPreloaded(src);
      
      if (!isHandledByService) {
        // Remove existing preload link if any
        if (preloadLinkRef.current) {
          document.head.removeChild(preloadLinkRef.current);
        }
        
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        link.fetchPriority = 'high';
        preloadLinkRef.current = link;
        document.head.appendChild(link);
      }
      
      return () => {
        if (preloadLinkRef.current && document.head.contains(preloadLinkRef.current)) {
          document.head.removeChild(preloadLinkRef.current);
          preloadLinkRef.current = null;
        }
      };
    }
  }, [priority, src, shouldShowImage, isLoaded]);

  // Memoized srcSet creation for better performance - only create if needed
  const webpSrcSet = useMemo(() => {
    if (!shouldShowImage || isLoaded) return '';
    return createSrcSet(src, 'webp');
  }, [createSrcSet, src, shouldShowImage, isLoaded]);
  
  const jpegSrcSet = useMemo(() => {
    if (!shouldShowImage || isLoaded) return '';
    return createSrcSet(src, 'jpeg');
  }, [createSrcSet, src, shouldShowImage, isLoaded]);

  const actualSrc = shouldShowImage ? src : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  // Calculate container styles to prevent layout shifts
  const containerStyle = useMemo(() => ({
    ...style, 
    position: 'relative',
    display: 'block',
    overflow: 'hidden',
    aspectRatio: aspectRatio ? `${1 / aspectRatio}` : 'auto',
    minHeight: aspectRatio ? '200px' : 'auto'
  }), [style, aspectRatio]);

  return (
    <picture 
      ref={pictureRef} 
      className={`image-container ${className}`} 
      style={containerStyle}
    >
      {/* Low-quality placeholder for blur-up effect - only show if not loaded */}
      {!isLoaded && lowQualitySrc && !placeholder && (
        <img
          src={lowQualitySrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        />
      )}

      {/* Progressive loading skeleton - only show if not loaded and no placeholder */}
      {!isLoaded && !lowQualitySrc && !placeholder && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Main image element with better loading attributes */}
      <img
        ref={imgRef}
        src={actualSrc}
        alt={alt}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        className={`
          transition-all duration-300 ease-out
          ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
          ${isError ? 'hidden' : ''}
          w-full h-full object-cover
        `}
        style={{
          position: 'relative',
          zIndex: 2,
          ...(isLoaded ? {} : { filter: 'blur(1px)' })
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        {...props}
      />

      {/* Error state with better styling */}
      {isError && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-lg flex items-center justify-center"
          style={{ zIndex: 3 }}
        >
          <div className="text-center p-4">
            <div className="text-red-500 text-sm font-medium mb-2">Image not available</div>
            <div className="text-red-400 text-xs">{alt || 'Failed to load image'}</div>
          </div>
        </div>
      )}
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
  placeholder: PropTypes.string
};

export default Image; 