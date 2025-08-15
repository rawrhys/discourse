import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const Image = ({ src, alt, className = '', style = {}, lazy = true, placeholder, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const pictureRef = useRef(null);

  useEffect(() => {
    if (!lazy) {
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
      { rootMargin: '200px' }
    );

    if (pictureRef.current) {
      observer.observe(pictureRef.current);
    }

    return () => {
        if (observer && observer.disconnect) {
            observer.disconnect();
        }
    };
  }, [lazy]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (e) => {
    e.target.style.display = 'none';
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = `placeholder-image ${className}`;
    placeholderDiv.style.cssText = `
      width: 100%;
      height: 200px;
      background-color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #6b7280;
      font-size: 14px;
    `;
    placeholderDiv.textContent = alt || 'Image not available';
    if (e.target.parentNode) {
        e.target.parentNode.insertBefore(placeholderDiv, e.target);
    }
  };

  const imageSizes = [320, 480, 800, 1200, 1600];
  const webpSrcSet = isInView ? imageSizes.map(size => `${src.replace('/images/', '/api/images/')}?w=${size}&format=webp ${size}w`).join(', ') : '';
  const jpegSrcSet = isInView ? imageSizes.map(size => `${src.replace('/images/', '/api/images/')}?w=${size} ${size}w`).join(', ') : '';

  return (
    <picture ref={pictureRef} className={className} style={{...style, position: 'relative'}}>
        {placeholder && !isLoaded && (
            <img src={placeholder} alt="placeholder" className="absolute top-0 left-0 w-full h-full object-cover filter blur-md" style={{ zIndex: 1 }} />
        )}
        {isInView && (
            <>
                <source type="image/webp" srcSet={webpSrcSet} sizes="(max-width: 800px) 100vw, 800px" />
                <source type="image/jpeg" srcSet={jpegSrcSet} sizes="(max-width: 800px) 100vw, 800px" />
            </>
        )}
        <img
            src={isInView ? src : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
            alt={alt}
            className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handleLoad}
            onError={handleError}
            style={{ width: '100%', height: 'auto', borderRadius: '8px', position: 'relative', zIndex: 2 }}
            {...props}
        />
    </picture>
  );
};

Image.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  lazy: PropTypes.bool,
  placeholder: PropTypes.string
};

export default Image; 