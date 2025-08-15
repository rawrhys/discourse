import React, { useState, useEffect } from 'react';
import './QuizView.css'; // We'll create this for styling

// Helper to shuffle an array in place (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Shuffle questions and, for each question, shuffle options.
// Ensures the correct answer position is not identical for all questions.
function shuffleQuestionsAndOptions(questions) {
  if (!Array.isArray(questions)) return [];

  // Shuffle question order
  const questionsShuffled = shuffleArray([...questions]);

  // Shuffle options per question
  const withShuffledOptions = questionsShuffled.map((q) => {
    const options = Array.isArray(q.options) ? [...q.options] : [];
    shuffleArray(options);
    return { ...q, options };
  });

  // Ensure distribution: avoid all correct answers sharing the same index
  const correctPositions = withShuffledOptions.map((q) => (Array.isArray(q.options) ? q.options.indexOf(q.answer) : -1));
  const uniquePositions = new Set(correctPositions.filter((idx) => idx >= 0));

  if (uniquePositions.size <= 1 && withShuffledOptions.length > 1) {
    // Move at least one question's correct answer to a different index
    for (let qi = 0; qi < withShuffledOptions.length; qi++) {
      const q = withShuffledOptions[qi];
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      const currentIndex = q.options.indexOf(q.answer);
      if (currentIndex < 0) continue;
      const candidateIndexes = q.options.map((_, i) => i).filter((i) => i !== currentIndex);
      if (candidateIndexes.length === 0) continue;
      const newIndex = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];
      [q.options[currentIndex], q.options[newIndex]] = [q.options[newIndex], q.options[currentIndex]];
      break; // One change is enough to break the uniformity
    }
  }

  return withShuffledOptions;
}

function QuizView({ questions = [], onComplete, lessonContent, lessonTitle, onRetakeQuiz, lessonId, module, onModuleUpdate, checkAndUnlockNextModule }) {
  const [selectedAnswers, setSelectedAnswers] = useState({}); // Stores { questionIndex: selectedOptionIndex }
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizStatus, setQuizStatus] = useState('pending'); // 'pending', 'passed', 'failed'
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [incorrectAnswers, setIncorrectAnswers] = useState({}); // Store incorrect answers with feedback
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  // Debug logging
  console.log('[QuizView] Component props:', {
    questions,
    questionsLength: questions?.length,
    lessonTitle,
    lessonId,
    hasModule: !!module
  });

  // Initialize shuffled questions
  useEffect(() => {
    console.log('[QuizView] useEffect triggered with questions:', {
      hasQuestions: !!questions,
      questionsLength: questions?.length,
      questions: questions
    });
    
    if (questions && questions.length > 0) {
      const shuffled = shuffleQuestionsAndOptions(questions);
      console.log('[QuizView] Questions shuffled successfully:', {
        originalCount: questions.length,
        shuffledCount: shuffled.length,
        shuffled: shuffled
      });
      setShuffledQuestions(shuffled);
      setSelectedAnswers({});
      setShowResult(false);
      setScore(0);
      setQuizStatus('pending');
    } else {
      console.warn('[QuizView] No questions provided or questions array is empty');
      setShuffledQuestions([]);
    }
  }, [questions]);

  const handleAnswerSelect = (questionIndex, answer) => {
    if (showResult) return; // Prevent changing answers after submission
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleSubmit = () => {
    if (shuffledQuestions.length === 0) {
      console.warn('No questions available to submit');
      return;
    }

    let correctCount = 0;
    const incorrect = {};

    shuffledQuestions.forEach((question, index) => {
      const selectedAnswer = selectedAnswers[index];
      if (selectedAnswer === question.answer) {
        correctCount++;
      } else {
        incorrect[index] = {
          selected: selectedAnswer,
          correct: question.answer,
          explanation: question.explanation
        };
      }
    });

    const finalScore = Math.round((correctCount / shuffledQuestions.length) * 5);
    setScore(finalScore);
    setShowResult(true);
    setIncorrectAnswers(incorrect);
    setQuizStatus(finalScore === 5 ? 'passed' : 'failed');

    // Notify parent component of quiz completion
    if (onComplete) {
      onComplete(finalScore);
    }

    // Update module progress if score is perfect
    if (finalScore === 5) {
      if (module && onModuleUpdate) {
        const updatedModule = { ...module };
        if (!updatedModule.perfectQuizzes) updatedModule.perfectQuizzes = 0;
        updatedModule.perfectQuizzes += 1;
        onModuleUpdate(updatedModule);
      }
      if (checkAndUnlockNextModule) {
        checkAndUnlockNextModule(lessonId);
      }
    }
  };

  const handleRetake = async () => {
    setIsGeneratingQuestions(true);
    try {
      let newQuestions = null;
      if (typeof AIService !== 'undefined' && AIService.generateQuizQuestions) {
        newQuestions = await AIService.generateQuizQuestions(lessonContent, lessonTitle);
      }

      if (newQuestions && newQuestions.length > 0) {
        // Shuffle questions and options for the new questions
        const shuffled = shuffleQuestionsAndOptions(newQuestions);
        setShuffledQuestions(shuffled);
      } else {
        // Fallback: reshuffle current questions and options to vary positions
        const reshuffled = shuffleQuestionsAndOptions(questions);
        setShuffledQuestions(reshuffled);
      }
    } catch (error) {
      console.error('Error generating new questions:', error);
      // Fallback on error: reshuffle current questions
      const reshuffled = shuffleQuestionsAndOptions(questions);
      setShuffledQuestions(reshuffled);
    } finally {
      setIsGeneratingQuestions(false);
    }
    
    setSelectedAnswers({});
    setShowResult(false);
    setScore(0);
    setQuizStatus('pending');
    if (onRetakeQuiz) onRetakeQuiz();
  };

  if (isGeneratingQuestions) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Generating new questions...</span>
      </div>
    );
  }

  // Debug render conditions
  console.log('[QuizView] Render conditions:', {
    hasQuestions: !!questions,
    questionsLength: questions?.length,
    questionsType: typeof questions,
    isArray: Array.isArray(questions),
    shuffledQuestionsLength: shuffledQuestions.length,
    showResult,
    isGeneratingQuestions
  });

  if (!questions || questions.length === 0) {
    console.warn('[QuizView] Early return - no questions available');
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">No quiz questions available for this lesson.</p>
        <p className="text-sm text-gray-500 mt-2">Debug: questions={JSON.stringify(questions)}</p>
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
                  className={`w-full text-left p-3 rounded ${
                    showResult
                      ? option === question.answer
                        ? 'bg-green-100 text-green-800'
                        : selectedAnswers[index] === option
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                      : selectedAnswers[index] === option
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-white hover:bg-gray-100'
                  } transition-colors duration-200`}
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
                  {score === 5 ? 'Quiz passed!' : 'To move to the next module, you must score 5/5 on all quizzes within this module.'}
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

export default QuizView; 