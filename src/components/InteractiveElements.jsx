// src/components/InteractiveElements.jsx
import React, { useState } from 'react';
import Flashcard from './Flashcard';
import './InteractiveElements.css';

const InteractiveElements = ({ element, lessonContext, lessonTitle }) => {
  const [userResponse, setUserResponse] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  
  if (!element) return null;

  const { elementType, elementData, instructions } = element;

  const renderElement = () => {
    switch (elementType) {
      case 'flashcards':
        return <FlashcardElement data={elementData} />;
      case 'fill-in-blank':
        return <FillInBlankElement data={elementData} />;
      case 'matching':
        return <MatchingElement data={elementData} />;
      case 'practice-question':
        return (
          <PracticeQuestionElement 
            data={elementData} 
            userResponse={userResponse} 
            setUserResponse={setUserResponse}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
          />
        );
      case 'code-sandbox':
        return <CodeSandboxElement data={elementData} />;
      default:
        return (
          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <p>Unknown interactive element type: {elementType}</p>
          </div>
        );
    }
  };

  return (
    <div className="interactive-element-container">
      <div className="interactive-element-header">
        <h3 className="interactive-element-title">{instructions}</h3>
      </div>
      <div className="interactive-element-body">
        {renderElement()}
      </div>
    </div>
  );
};

export const FlashcardElement = ({ data }) => {
  const { cards } = data;

  if (!cards || cards.length === 0) return <p className="no-content-message">No flashcards available for this lesson.</p>;

  return (
    <div className="flashcards-grid-container">
      {cards.map((card, index) => (
        <Flashcard
          key={index}
          term={card.term}
          definition={card.definition}
        />
      ))}
    </div>
  );
};

const FillInBlankElement = ({ data }) => {
  const [answers, setAnswers] = useState({});
  const [showCorrect, setShowCorrect] = useState(false);
  const { text, blanks } = data;

  // Replace [blank1], [blank2], etc. with input fields
  const renderText = () => {
    let parts = text.split(/\[blank(\d+)\]/);
    return parts.map((part, index) => {
      // Even indices are text, odd indices are the blank numbers
      if (index % 2 === 0) {
        return <span key={index}>{part}</span>;
      } else {
        const blankIndex = parseInt(part, 10);
        const blank = blanks.find(b => b.id === blankIndex);
        const isCorrect = showCorrect && answers[blankIndex] === blank.answer;
        const isIncorrect = showCorrect && answers[blankIndex] !== blank.answer;
        
        return (
          <input
            key={index}
            type="text"
            value={answers[blankIndex] || ''}
            onChange={(e) => setAnswers({ ...answers, [blankIndex]: e.target.value })}
            className={`mx-1 px-2 py-1 border rounded inline-block w-36 
              ${isCorrect ? 'border-green-500 bg-green-50' : ''} 
              ${isIncorrect ? 'border-red-500 bg-red-50' : ''}`
            }
          />
        );
      }
    });
  };

  return (
    <div className="fill-in-blank">
      <div className="mb-4">
        {renderText()}
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => setShowCorrect(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Check Answers
        </button>
        
        {showCorrect && (
          <button
            onClick={() => {
              setShowCorrect(false);
              setAnswers({});
            }}
            className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Reset
          </button>
        )}
      </div>
      
      {showCorrect && (
        <div className="mt-4 bg-blue-50 p-2 rounded">
          <p className="font-medium">Correct answers:</p>
          <ul className="list-disc list-inside">
            {blanks.map(blank => (
              <li key={blank.id}>
                Blank {blank.id}: <span className="font-medium">{blank.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const MatchingElement = ({ data }) => {
  const [matches, setMatches] = useState({});
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const { pairs } = data;

  const handleLeftClick = (id) => {
    setSelectedLeft(id);
  };

  const handleRightClick = (id) => {
    if (selectedLeft !== null) {
      setMatches({ ...matches, [selectedLeft]: id });
      setSelectedLeft(null);
    }
  };

  const isMatched = (leftId) => {
    return matches[leftId] !== undefined;
  };

  const getMatchedRightId = (leftId) => {
    return matches[leftId];
  };

  const isCorrectMatch = (leftId, rightId) => {
    const correctPair = pairs.find(pair => pair.left.id === leftId);
    return correctPair.right.id === rightId;
  };

  const reset = () => {
    setMatches({});
    setSelectedLeft(null);
    setShowCorrect(false);
  };

  return (
    <div className="matching-activity">
      <div className="flex justify-between mb-4">
        <div className="w-5/12">
          {pairs.map(pair => (
            <div 
              key={`left-${pair.left.id}`}
              onClick={() => !isMatched(pair.left.id) && handleLeftClick(pair.left.id)}
              className={`p-3 mb-2 rounded-md cursor-pointer border
                ${selectedLeft === pair.left.id ? 'bg-blue-200 border-blue-400' : ''}
                ${isMatched(pair.left.id) ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'}
                ${showCorrect && isMatched(pair.left.id) && isCorrectMatch(pair.left.id, getMatchedRightId(pair.left.id)) 
                  ? 'bg-green-100 border-green-400' 
                  : ''}
                ${showCorrect && isMatched(pair.left.id) && !isCorrectMatch(pair.left.id, getMatchedRightId(pair.left.id)) 
                  ? 'bg-red-100 border-red-400' 
                  : ''}
              `}
            >
              {pair.left.text}
            </div>
          ))}
        </div>
        
        <div className="w-5/12">
          {pairs.map(pair => (
            <div 
              key={`right-${pair.right.id}`}
              onClick={() => selectedLeft !== null && handleRightClick(pair.right.id)}
              className={`p-3 mb-2 rounded-md cursor-pointer border
                ${Object.values(matches).includes(pair.right.id) ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'}
                ${showCorrect && Object.entries(matches).some(([leftId, rightId]) => 
                  rightId === pair.right.id && isCorrectMatch(parseInt(leftId), rightId)
                ) ? 'bg-green-100 border-green-400' : ''}
                ${showCorrect && Object.entries(matches).some(([leftId, rightId]) => 
                  rightId === pair.right.id && !isCorrectMatch(parseInt(leftId), rightId)
                ) ? 'bg-red-100 border-red-400' : ''}
              `}
            >
              {pair.right.text}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => setShowCorrect(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Check Matches
        </button>
        
        <button
          onClick={reset}
          className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
      
      {showCorrect && (
        <div className="mt-4 bg-blue-50 p-2 rounded">
          <p className="font-medium">Correct matches:</p>
          <ul className="list-disc list-inside">
            {pairs.map(pair => (
              <li key={`pair-${pair.left.id}`}>
                {pair.left.text} → {pair.right.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const PracticeQuestionElement = ({ data, userResponse, setUserResponse, showAnswer, setShowAnswer }) => {
  const { question, answer } = data;

  return (
    <div className="practice-question">
      <p className="font-medium mb-3">{question}</p>
      
      <textarea
        value={userResponse}
        onChange={(e) => setUserResponse(e.target.value)}
        placeholder="Type your answer here..."
        className="w-full h-20 p-2 border border-gray-300 rounded-md"
        disabled={showAnswer}
      ></textarea>
      
      <div className="mt-4">
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Show Answer
          </button>
        ) : (
          <div className="bg-green-50 border border-green-200 p-3 rounded-md">
            <p className="font-medium text-green-800 mb-1">Sample Answer:</p>
            <p>{answer}</p>
            
            <button
              onClick={() => {
                setShowAnswer(false);
                setUserResponse('');
              }}
              className="mt-3 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CodeSandboxElement = ({ data }) => {
  const [code, setCode] = useState(data.initialCode || '');
  const [output, setOutput] = useState('');
  const { language, instructions, sampleSolution } = data;

  const runCode = () => {
    // In a real implementation, this would send the code to a backend for execution
    setOutput('This is a simulated output. In a real application, this would execute your code in a safe environment and display the results here.');
  };

  return (
    <div className="code-sandbox">
      <div className="mb-3">
        <label htmlFor="code-editor" className="block mb-2 font-medium">{language} Code Editor:</label>
        <textarea
          id="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-48 font-mono p-2 border border-gray-300 rounded-md bg-gray-800 text-white"
          spellCheck="false"
        ></textarea>
      </div>
      
      <div className="mb-3">
        <button
          onClick={runCode}
          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Run Code
        </button>
        
        <button
          onClick={() => setCode(data.initialCode || '')}
          className="ml-2 px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
      
      {output && (
        <div className="mb-3">
          <label className="block mb-2 font-medium">Output:</label>
          <div className="w-full min-h-16 font-mono p-2 border border-gray-300 rounded-md bg-gray-100">
            {output}
          </div>
        </div>
      )}
      
      <div className="mt-4">
        <button
          onClick={() => setCode(sampleSolution)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Solution
        </button>
      </div>
    </div>
  );
};

export default InteractiveElements;