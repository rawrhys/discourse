import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import imagePreloadService from '../services/ImagePreloadService';
import SimpleImageService from '../services/SimpleImageService';
import CacheService from '../services/CacheService';
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
  responsive = true,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
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

  // Check if image is already cached
  const isCached = useMemo(() => {
    return CacheService.isImageCached(src);
  }, [src]);

  // Generate responsive image URLs with WebP support
  const responsiveUrls = useMemo(() => {
    if (!src || !responsive || typeof src !== 'string') return null;
    
    try {
      return SimpleImageService.generateResponsiveUrls(src, {
        sizes: [400, 800, 1200],
        format: 'webp',
        quality: 80
      });
    } catch (error) {
      console.warn('[Image] Failed to generate responsive URLs for:', src, error);
      return null;
    }
  }, [src, responsive]);

  // Create optimized srcSet for different formats with caching
  const createSrcSet = useCallback((baseUrl, format) => {
    if (!baseUrl || !isInView) return '';
    
    if (responsiveUrls) {
      // Use responsive URLs if available
      return Object.entries(responsiveUrls)
        .map(([size, url]) => `${url} ${size}`)
        .join(', ');
    }
    
    // Fallback to original logic
    const proxyUrl = baseUrl.replace('/api/image/enhanced', '/api/image/fast');
    return `${proxyUrl} 800w`;
  }, [isInView, responsiveUrls]);

  // Generate low-quality placeholder with better error handling - only if not already loaded
  const generateLowQualityPlaceholder = useCallback(async (imageUrl) => {
    if (!imageUrl || lowQualitySrc || isLoaded || typeof imageUrl !== 'string') return;
    
    try {
      // Use optimized thumbnail for placeholder
      const placeholderUrl = SimpleImageService.generateOptimizedUrl(imageUrl, {
        width: 100,
        format: 'webp',
        quality: 30
      });
      setLowQualitySrc(placeholderUrl);
    } catch (error) {
      console.warn('[Image] Failed to generate low-quality placeholder for:', imageUrl, error);
      // Fallback to original URL
      setLowQualitySrc(imageUrl);
    }
  }, [lowQualitySrc, isLoaded]);

  // Optimized intersection observer with better settings
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
        rootMargin: '100px 0px 100px 0px', // Balanced margins for better performance
        threshold: 0.1 // Higher threshold to reduce unnecessary loads
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

  const handleLoad = useCallback(() => {
    // Prevent duplicate load handling
    if (isLoaded) {
      console.log('[Image] Ignoring duplicate load event for:', src);
      return;
    }
    
    setIsLoaded(true);
    setIsError(false);
    
    // Calculate aspect ratio for better layout stability
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth && naturalHeight) {
        setAspectRatio(naturalHeight / naturalWidth);
      }
    }
    
    // Performance tracking with enhanced monitoring
    try {
      const startTime = parseInt(imgRef.current?.dataset?.startTime || Date.now());
      const loadTime = Date.now() - startTime;
      
      // Track performance with enhanced metadata
      const fileSize = imgRef.current?.naturalWidth * imgRef.current?.naturalHeight * 4; // Rough estimate
      const format = SimpleImageService.detectFormatFromUrl ? SimpleImageService.detectFormatFromUrl(src) : 'unknown';
      
      imagePerformanceMonitor.trackImageLoad(
        src, 
        loadTime, 
        isCached, 
        fileSize, 
        format
      );
      
      // Cache the successfully loaded image
      CacheService.cacheImage(src, {
        width: imgRef.current?.naturalWidth,
        height: imgRef.current?.naturalHeight,
        loadTime,
        format
      });
      
      console.log(`[Image] Loaded ${src} in ${loadTime}ms (cached: ${isCached})`);
    } catch (error) {
      console.warn('[Image] Performance tracking error:', error);
    }
  }, [src, isCached, isLoaded]);

  const handleError = useCallback((e) => {
    console.error('[Image] Failed to load image:', src);
    setIsError(true);
    setIsLoaded(false);
    
    // Track error with performance monitor
    imagePerformanceMonitor.trackImageError(src, e.message || 'Image load failed');
    
    // Clean up preload link on error
    if (preloadLinkRef.current && document.head.contains(preloadLinkRef.current)) {
      document.head.removeChild(preloadLinkRef.current);
      preloadLinkRef.current = null;
    }
  }, [src]);

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

      {/* WebP source for modern browsers */}
      {shouldShowImage && webpSrcSet && SimpleImageService.supportsWebP() && (
        <source
          srcSet={webpSrcSet}
          sizes={sizes}
          type="image/webp"
        />
      )}

      {/* JPEG fallback source */}
      {shouldShowImage && jpegSrcSet && (
        <source
          srcSet={jpegSrcSet}
          sizes={sizes}
          type="image/jpeg"
        />
      )}

      {/* Main image element with better loading attributes */}
      <img
        ref={imgRef}
        src={actualSrc}
        alt={alt}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        fetchPriority={isInView ? "high" : "auto"}
        srcSet={shouldShowImage && !webpSrcSet ? createSrcSet(src, 'jpeg') : undefined}
        sizes={shouldShowImage ? sizes : undefined}
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
        onLoad={handleLoad}
        onError={handleError}
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
  placeholder: PropTypes.string,
  responsive: PropTypes.bool,
  sizes: PropTypes.string
};

export default Image; 