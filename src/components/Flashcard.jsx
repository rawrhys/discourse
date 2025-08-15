import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './Flashcard.css';

const Flashcard = ({ term, definition }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`flashcard-container ${isFlipped ? 'flipped' : ''}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className="flashcard-inner">
        <div className="flashcard-front">
          <p>{term}</p>
        </div>
        <div className="flashcard-back">
          <p>{definition}</p>
        </div>
      </div>
    </div>
  );
};

Flashcard.propTypes = {
  term: PropTypes.string.isRequired,
  definition: PropTypes.string.isRequired,
};

export default Flashcard; 