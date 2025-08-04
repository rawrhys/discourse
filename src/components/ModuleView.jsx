// src/components/ModuleView.jsx
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LessonView from './LessonView';
import Flashcard from './Flashcard';
import PropTypes from 'prop-types';
import './ModuleView.css';
import { FixedSizeList as List } from 'react-window';
import Module from '../models/Module';

// Memoized Module Header component
const ModuleHeader = memo(({ module, completionStatus }) => (
  <div className="bg-blue-50 p-4 rounded-lg">
    <h3 className="text-lg font-semibold text-blue-800 mb-1">{module.title}</h3>
    <p className="text-sm text-blue-600">{module.description}</p>
    <div className="mt-2 flex items-center justify-between">
      <div className="text-sm text-blue-700">
        Progress: {Math.round(completionStatus.progress)}%
      </div>
      {completionStatus.completed && (
        <div className="text-sm text-green-600 font-medium">
          ✓ Module Completed
        </div>
      )}
    </div>
  </div>
));

// Memoized Lesson Item component
const LessonItem = memo(({ lesson, isActive, onSelect, quizScore }) => {
  const isCompleted = quizScore === 5;
  
  return (
    <button
      onClick={() => onSelect(lesson.id)}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150
        ${lesson.id === isActive 
          ? 'bg-blue-100 text-blue-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
        ${!isCompleted ? 'opacity-75' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span>{lesson.title}</span>
        {quizScore !== undefined && (
          <span className={`text-xs font-medium ${
            isCompleted ? 'text-green-600' : 'text-yellow-600'
          }`}>
            Quiz: {quizScore}/5
          </span>
        )}
      </div>
    </button>
  );
});

// Memoized Module Overview component
const ModuleOverview = memo(({ module, onSelect, completionStatus, modules, moduleIndex, isLocked }) => {
  return (
    <div 
      className={`p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer ${
        !completionStatus.completed ? 'opacity-50' : ''
      }`}
      onClick={() => !isLocked && onSelect(module.id)}
      style={isLocked ? { pointerEvents: 'none', opacity: 0.5 } : {}}
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{module.title}</h3>
      <p className="text-sm text-gray-600 mb-2">{module.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{module.lessons.length} lessons</span>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${completionStatus.progress}%` }}
            />
          </div>
          <span>{Math.round(completionStatus.progress)}%</span>
          {isLocked && (
            <svg className="h-4 w-4 text-gray-400 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      {isLocked && (
        <div className="mt-2 text-xs text-red-500">
          Get 5/5 on at least 3 quizzes in the previous module to unlock
        </div>
      )}
    </div>
  );
});

const ModuleView = ({ module, isActive, onSelect, onLessonSelect, activeLessonId, moduleFlashcards, onModuleUpdate }) => {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processedLessons, setProcessedLessons] = useState(new Set());
  const [activeTab, setActiveTab] = useState('lesson');
  const navigate = useNavigate();

  // Memoize module completion status
  const moduleCompletionStatus = useMemo(() => {
    if (!module) return { completed: false, progress: 0 };
    
    console.log('[ModuleView] Type check for module:', module instanceof Module, module);

    // Calculate completion status using methods from the Module instance
    const progress = module.getModuleProgress();
    const completed = module.isCompleted();
    
    return {
      completed: completed,
      progress: progress
    };
  }, [module]);

  // Memoize lesson selection handler
  const handleLessonSelect = useCallback((lessonId) => {
    if (!lessonId) {
      console.warn('ModuleView: No lesson ID provided');
      return;
    }

    if (!isActive) {
      onSelect(module.id);
    }

    const lesson = module.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      console.warn('ModuleView: Lesson not found in module:', {
        lessonId,
        moduleId: module.id,
        availableLessons: module.lessons.map(l => l.id)
      });
      return;
    }

    onLessonSelect(lessonId);
  }, [module, isActive, onSelect, onLessonSelect]);

  // Update current lesson index when active lesson changes
  useEffect(() => {
    if (activeLessonId && module?.lessons && module.lessons.length > 0) {
      const newIndex = module.lessons.findIndex(l => l.id === activeLessonId);
      if (newIndex !== -1 && newIndex !== currentLessonIndex) {
        setCurrentLessonIndex(newIndex);
      }
    }
  }, [activeLessonId, module?.lessons, currentLessonIndex]);

  // Auto-select first lesson when module becomes active
  useEffect(() => {
    if (isActive && module?.lessons?.length > 0 && !activeLessonId) {
      const firstLesson = module.lessons[0];
      handleLessonSelect(firstLesson.id);
    }
  }, [isActive, module, activeLessonId, handleLessonSelect]);

  // Memoize lesson list renderer for virtualization
  const LessonList = useMemo(() => {
    if (!module?.lessons) return null;

    const itemCount = module.lessons.length;
    const itemSize = 48; // Height of each lesson item in pixels

    return (
      <List
        height={Math.min(itemCount * itemSize, 400)} // Max height of 400px
        itemCount={itemCount}
        itemSize={itemSize}
        width="100%"
      >
        {({ index, style }) => {
          const lesson = module.lessons[index];
          const quizScore = module.quizScores?.[lesson.id];
          
          return (
            <div style={style}>
              <LessonItem
                lesson={lesson}
                isActive={lesson.id === activeLessonId}
                onSelect={handleLessonSelect}
                quizScore={quizScore}
              />
            </div>
          );
        }}
      </List>
    );
  }, [module?.lessons, module?.quizScores, activeLessonId, handleLessonSelect]);

  if (!module || !module.lessons || module.lessons.length === 0) {
    return null;
  }

  return (
    <div className="module-view">
      {!isActive ? (
        <ModuleOverview
          module={module}
          onSelect={onSelect}
          completionStatus={moduleCompletionStatus}
          modules={modules}
          moduleIndex={moduleIndex}
          isLocked={isLocked}
        />
      ) : (
        <div className="space-y-2">
          <ModuleHeader
            module={module}
            completionStatus={moduleCompletionStatus}
          />
          <div className="space-y-1">
            {LessonList}
          </div>
        </div>
      )}
    </div>
  );
};

ModuleView.propTypes = {
  module: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    lessons: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired
    })).isRequired
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onLessonSelect: PropTypes.func.isRequired,
  activeLessonId: PropTypes.string,
  moduleFlashcards: PropTypes.array,
  onModuleUpdate: PropTypes.func
};

export default memo(ModuleView);