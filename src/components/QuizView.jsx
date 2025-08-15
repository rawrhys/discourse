import React, { useState, useEffect } from 'react';
import './QuizView.css';

// Helper to shuffle an array in place (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Shuffle questions and, for each question, shuffle options.
function shuffleQuestionsAndOptions(questions) {
  if (!Array.isArray(questions)) return [];
  const questionsShuffled = shuffleArray([...questions]);
  return questionsShuffled.map((q) => {
    const options = Array.isArray(q.options) ? shuffleArray([...q.options]) : [];
    return { ...q, options };
  });
}

export default function QuizView({ questions = [], onComplete, lessonId }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [incorrectAnswers, setIncorrectAnswers] = useState({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setShuffledQuestions(shuffleQuestionsAndOptions(questions));
      setSelectedAnswers({});
      setShowResult(false);
      setScore(0);
    }
  }, [questions]);

  const handleAnswerSelect = (questionIndex, answer) => {
    if (showResult) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleSubmit = () => {
    if (shuffledQuestions.length === 0) return;

    let correctCount = 0;
    const incorrect = {};
    shuffledQuestions.forEach((question, index) => {
      if (selectedAnswers[index] === question.answer) {
        correctCount++;
      } else {
        incorrect[index] = {
          selected: selectedAnswers[index],
          correct: question.answer,
          explanation: question.explanation
        };
      }
    });

    const finalScore = Math.round((correctCount / shuffledQuestions.length) * 5);
    setScore(finalScore);
    setShowResult(true);
    setIncorrectAnswers(incorrect);

    if (onComplete) {
      onComplete(finalScore);
    }
  };

  const handleRetake = () => {
    setIsGeneratingQuestions(true);
    // This is where you would regenerate questions if needed
    setIsGeneratingQuestions(false);
    
    setSelectedAnswers({});
    setShowResult(false);
    setScore(0);
    // if (onRetakeQuiz) onRetakeQuiz(); // onRetakeQuiz is removed from props
  };

  if (isGeneratingQuestions) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Generating new questions...</span>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No quiz questions available for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="quiz-container p-6 bg-white rounded-lg shadow">
      <div className="space-y-6">
        {shuffledQuestions.map((question, index) => (
          <div key={index} className={`p-4 rounded-lg ${showResult ? (selectedAnswers[index] === question.answer ? 'bg-green-50' : 'bg-red-50') : 'bg-gray-50'}`}>
            <p className="font-medium text-gray-900 mb-4">{index + 1}. {question.question}</p>
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  onClick={() => handleAnswerSelect(index, option)}
                  disabled={showResult}
                  className={`w-full text-left p-3 rounded transition-colors duration-200 ${
                    showResult
                      ? option === question.answer
                        ? 'bg-green-100 text-green-800'
                        : selectedAnswers[index] === option
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                      : selectedAnswers[index] === option
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {showResult && incorrectAnswers[index] && (
              <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">
                <p className="font-medium">Incorrect Answer</p>
                <p>The correct answer is: {question.answer}</p>
                {question.explanation && (
                  <p className="mt-2 text-sm">{question.explanation}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(selectedAnswers).length !== shuffledQuestions.length}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Quiz
          </button>
        ) : (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-lg font-semibold">
                  Score: {score}/5
                  {score === 5 && <span className="ml-2 text-green-600">Perfect Score! 🎉</span>}
                </p>
                <p className={`text-sm ${score === 5 ? 'text-green-600' : 'text-red-600'}`}>
                  {score === 5 ? 'Quiz passed!' : 'You must score 5/5 to unlock the next module.'}
                </p>
              </div>
              <button
                onClick={handleRetake}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retake Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}