import React, { useEffect } from 'react';
import './FullscreenImageView.css';

function FullscreenImageView({ imageUrl, onClose }) {
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle click outside the image
  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fullscreen-image-container" onClick={handleBackdropClick}>
      <div className="fullscreen-image-content">
        <button className="close-button" onClick={onClose} aria-label="Close fullscreen view">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={imageUrl}
          alt="Fullscreen view"
          className="fullscreen-image"
          onError={(e) => {
            console.error('Error loading fullscreen image:', e);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

export default FullscreenImageView; 