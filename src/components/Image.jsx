import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const pictureRef = useRef(null);
  const imgRef = useRef(null);

  // Determine if we should show the image
  const shouldShowImage = isInView || preload;

  // Generate responsive image sizes
  const imageSizes = [320, 480, 800, 1200, 1600];
  
  // Create optimized srcSet for different formats
  const createSrcSet = useCallback((baseUrl, format) => {
    if (!baseUrl || !isInView) return '';
    
    // Use enhanced image proxy for better performance
    const proxyUrl = baseUrl.replace('/images/', '/api/images/');
    return imageSizes
      .map(size => `${proxyUrl}?w=${size}&format=${format} ${size}w`)
      .join(', ');
  }, [isInView]);

  // Generate low-quality placeholder
  const generateLowQualityPlaceholder = useCallback(async (imageUrl) => {
    try {
      // Create a very small version for blur-up effect
      const placeholderUrl = `${imageUrl.replace('/images/', '/api/images/')}?w=20&format=jpeg&quality=10`;
      setLowQualitySrc(placeholderUrl);
    } catch (error) {
      console.warn('[Image] Failed to generate low-quality placeholder:', error);
    }
  }, []);

  // Handle intersection observer for lazy loading
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
        rootMargin: '200px', // Increased for better preloading
        threshold: 0.1 
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

  // Preload image if priority is set
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
    
    // Basic performance tracking (without external services)
    try {
      const loadTime = Date.now() - (imgRef.current?.dataset?.startTime || Date.now());
      console.log(`[Image] Loaded ${src} in ${loadTime}ms`);
    } catch (error) {
      console.warn('[Image] Performance tracking error:', error);
    }
  }, [src]);

  const handleError = useCallback((e) => {
    console.error('[Image] Failed to load image:', src);
    setIsError(true);
    setIsLoaded(false);
    
    // Create fallback placeholder
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = `placeholder-image ${className}`;
    placeholderDiv.style.cssText = `
      width: 100%;
      height: 200px;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
    `;
    placeholderDiv.textContent = alt || 'Image not available';
    
    if (e.target.parentNode) {
      e.target.parentNode.insertBefore(placeholderDiv, e.target);
    }
  }, [src, alt, className]);

  // Create srcSet for different formats
  const webpSrcSet = createSrcSet(src, 'webp');
  const jpegSrcSet = createSrcSet(src, 'jpeg');

  const actualSrc = shouldShowImage ? src : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  return (
    <picture 
      ref={pictureRef} 
      className={`image-container ${className}`} 
      style={{
        ...style, 
        position: 'relative',
        display: 'block',
        overflow: 'hidden'
      }}
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

      {/* Progressive loading skeleton */}
      {!isLoaded && !lowQualitySrc && !placeholder && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
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

      {/* Main image element */}
      <img
        ref={imgRef}
        src={actualSrc}
        alt={alt}
        className={`
          transition-all duration-500 ease-out
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
          display: 'block'
        }}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        {...props}
      />

      {/* Loading indicator */}
      {!isLoaded && !isError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75"
          style={{ zIndex: 3 }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </picture>
  );
};

Image.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  lazy: PropTypes.bool,
  placeholder: PropTypes.string,
  preload: PropTypes.bool,
  sizes: PropTypes.string,
  priority: PropTypes.bool
};

export default Image; 