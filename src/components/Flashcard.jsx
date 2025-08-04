import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import PropTypes from 'prop-types';
import './Flashcard.css';

function Flashcard({ term, definition, index }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState(null);

  // Validate and sanitize props
  useEffect(() => {
    console.log('[Flashcard] Initializing flashcard:', { 
      index,
      termLength: term?.length,
      definitionLength: definition?.length,
      term: term?.substring(0, 50),
      definition: definition?.substring(0, 50) + '...'
    });
    
    try {
      // Basic validation
      if (!term) {
        throw new Error('Missing term');
      }
      if (!definition) {
        throw new Error('Missing definition');
      }
      
      // Sanitize content
      const sanitizedTerm = term.trim();
      const sanitizedDefinition = definition.trim();
      
      // More lenient validation
      if (sanitizedTerm.length < 1) {
        throw new Error('Empty term');
      }
      if (sanitizedDefinition.length < 1) {
        throw new Error('Empty definition');
      }
      
      setIsValid(true);
      setError(null);
      
      console.log('[Flashcard] Validation successful:', { index, term: sanitizedTerm });
    } catch (err) {
      console.warn('[Flashcard] Validation failed:', { 
        index, 
        error: err.message,
        term,
        definition: definition?.substring(0, 50) + '...'
      });
      setIsValid(false);
      setError(err.message);
    }
  }, [term, definition, index]);

  // Reset to term side when content changes
  useEffect(() => {
    setIsFlipped(false);
  }, [term, definition]);

  const handleClick = () => {
    if (!isValid) return;
    setIsFlipped(!isFlipped);
  };

  if (!isValid) {
    return (
      <div className="flashcard-error p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600 text-center">
          {error || 'Invalid flashcard data'}
        </p>
        <p className="text-xs text-red-400 mt-1">
          Card {index + 1}
        </p>
      </div>
    );
  }

  return (
    <div className="flashcard-container">
      <div 
        className={`flashcard ${isFlipped ? 'flipped' : ''}`}
        onClick={handleClick}
      >
        <div className="flashcard-inner">
          <div className="flashcard-front">
            <div className="flashcard-content">
              <ReactMarkdown>{term}</ReactMarkdown>
              <div className="flip-hint">Click to flip</div>
            </div>
          </div>
          <div className="flashcard-back">
            <div className="flashcard-content">
              <ReactMarkdown>{definition}</ReactMarkdown>
              <div className="flip-hint">Click to flip back</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Flashcard.propTypes = {
  term: PropTypes.string.isRequired,
  definition: PropTypes.string.isRequired,
  index: PropTypes.number
};

export default Flashcard; 