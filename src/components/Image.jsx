import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

const Image = ({ 
  src, 
  alt, 
  className = '', 
  style = {}, 
  lazy = true, 
  placeholder, 
  preload = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || preload);
  const [isError, setIsError] = useState(false);
  const [lowQualitySrc, setLowQualitySrc] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(null);
  const pictureRef = useRef(null);
  const imgRef = useRef(null);
  const preloadLinkRef = useRef(null);

  // Determine if we should show the image
  const shouldShowImage = isInView || preload;

  // Optimized responsive image sizes - reduced for better performance
  const imageSizes = useMemo(() => [480, 800, 1200], []);
  
  // Create optimized srcSet for different formats with caching
  const createSrcSet = useCallback((baseUrl, format) => {
    if (!baseUrl || !isInView) return '';
    
    // Use enhanced image proxy for better performance
    const proxyUrl = baseUrl.replace('/images/', '/api/images/');
    return imageSizes
      .map(size => `${proxyUrl}?w=${size}&format=${format}&quality=85 ${size}w`)
      .join(', ');
  }, [isInView, imageSizes]);

  // Generate low-quality placeholder with better error handling
  const generateLowQualityPlaceholder = useCallback(async (imageUrl) => {
    if (!imageUrl || lowQualitySrc) return;
    
    try {
      // Create a very small version for blur-up effect with better quality settings
      const placeholderUrl = `${imageUrl.replace('/images/', '/api/images/')}?w=40&format=jpeg&quality=30&blur=2`;
      setLowQualitySrc(placeholderUrl);
    } catch (error) {
      console.warn('[Image] Failed to generate low-quality placeholder:', error);
    }
  }, [lowQualitySrc]);

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
        rootMargin: '50px 0px 200px 0px', // Reduced top margin, increased bottom for better performance
        threshold: 0.01 // Lower threshold for earlier loading
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

  // Generate low-quality placeholder when image comes into view
  useEffect(() => {
    if (isInView && src && !lowQualitySrc) {
      generateLowQualityPlaceholder(src);
    }
  }, [isInView, src, lowQualitySrc, generateLowQualityPlaceholder]);

  // Track start time when image begins loading
  useEffect(() => {
    if (shouldShowImage && imgRef.current) {
      imgRef.current.dataset.startTime = Date.now().toString();
    }
  }, [shouldShowImage]);

  // Improved preload strategy with cleanup
  useEffect(() => {
    if (priority && src && shouldShowImage) {
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
      
      return () => {
        if (preloadLinkRef.current && document.head.contains(preloadLinkRef.current)) {
          document.head.removeChild(preloadLinkRef.current);
          preloadLinkRef.current = null;
        }
      };
    }
  }, [priority, src, shouldShowImage]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
    
    // Calculate aspect ratio for better layout stability
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth && naturalHeight) {
        setAspectRatio(naturalHeight / naturalWidth);
      }
    }
    
    // Basic performance tracking
    try {
      const startTime = parseInt(imgRef.current?.dataset?.startTime || Date.now());
      const loadTime = Date.now() - startTime;
      console.log(`[Image] Loaded ${src} in ${loadTime}ms`);
    } catch (error) {
      console.warn('[Image] Performance tracking error:', error);
    }
  }, [src]);

  const handleError = useCallback((e) => {
    console.error('[Image] Failed to load image:', src);
    setIsError(true);
    setIsLoaded(false);
    
    // Clean up preload link on error
    if (preloadLinkRef.current && document.head.contains(preloadLinkRef.current)) {
      document.head.removeChild(preloadLinkRef.current);
      preloadLinkRef.current = null;
    }
  }, [src]);

  // Memoized srcSet creation for better performance
  const webpSrcSet = useMemo(() => createSrcSet(src, 'webp'), [createSrcSet, src]);
  const jpegSrcSet = useMemo(() => createSrcSet(src, 'jpeg'), [createSrcSet, src]);

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
      {/* Low-quality placeholder for blur-up effect */}
      {lowQualitySrc && !isLoaded && (
        <img 
          src={lowQualitySrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          style={{ 
            zIndex: 1,
            opacity: 0.8,
            transition: 'opacity 0.3s ease-out'
          }}
          onLoad={() => {
            // Fade out placeholder when main image loads
            const placeholder = document.querySelector('.blur-lg');
            if (placeholder) {
              placeholder.style.opacity = '0';
            }
          }}
        />
      )}

      {/* Custom placeholder if provided */}
      {placeholder && !isLoaded && !lowQualitySrc && (
        <img 
          src={placeholder} 
          alt="placeholder" 
          className="absolute inset-0 w-full h-full object-cover filter blur-md" 
          style={{ zIndex: 1 }} 
        />
      )}

      {/* Progressive loading skeleton with better styling */}
      {!isLoaded && !lowQualitySrc && !placeholder && (
        <div 
          className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Main image with responsive sources */}
      {shouldShowImage && (
        <>
          <source 
            type="image/webp" 
            srcSet={webpSrcSet} 
            sizes={sizes}
          />
          <source 
            type="image/jpeg" 
            srcSet={jpegSrcSet} 
            sizes={sizes}
          />
        </>
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
        `}
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          width: '100%', 
          height: 'auto', 
          borderRadius: '8px', 
          position: 'relative', 
          zIndex: 2,
          ...(isLoaded ? {} : { filter: 'blur(1px)' })
        }}
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
  placeholder: PropTypes.string,
  preload: PropTypes.bool,
  sizes: PropTypes.string,
  priority: PropTypes.bool
};

export default Image; 