app.post('/api/quizzes/submit', authenticateToken, async (req, res) => {
  const { courseId, moduleId, lessonId, score } = req.body;
  const userId = req.user.id;

  if (!courseId || !moduleId || !lessonId || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.read();
    const course = db.data.courses.find(c => c.id === courseId && c.userId === userId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const module = course.modules.find(m => m.id === moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const lesson = module.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Update or add the quiz score for the lesson
    if (!lesson.quizScores) {
      lesson.quizScores = {};
    }
    lesson.quizScores[userId] = score;
    lesson.lastQuizScore = score; // Keep track of the last score for display

    // Check if the module is now complete.
    // A lesson is considered "passed" for progression if it either has no quiz,
    // or if the user has achieved a perfect score on its quiz.
    const allQuizzesPerfect = module.lessons.every(l => {
      if (l.quiz && l.quiz.length > 0) {
        // If there is a quiz, a perfect score is required.
        return l.quizScores && l.quizScores[userId] === 5;
      }
      // If there is no quiz, it doesn't block progression.
      return true;
    });

    let unlockedNextModule = false;
    if (allQuizzesPerfect) {
      module.isCompleted = true; // Mark module as completed
      const currentModuleIndex = course.modules.findIndex(m => m.id === moduleId);
      
      // Unlock the next module if there is one
      if (currentModuleIndex !== -1 && currentModuleIndex + 1 < course.modules.length) {
        course.modules[currentModuleIndex + 1].isLocked = false;
        unlockedNextModule = true;
      }
    }

    await db.write();

    res.json({
      message: 'Quiz score submitted successfully',
      unlockedNextModule,
      moduleCompleted: allQuizzesPerfect
    });

  } catch (error) {
    console.error('Error submitting quiz score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});