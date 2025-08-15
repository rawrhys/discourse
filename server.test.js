import test from 'tape';
import request from 'supertest';
import { app, server, db } from './server.js';

test('Setup: Mock Database', (t) => {
  db.data = {
    courses: [
      {
        id: 'course1',
        modules: [
          {
            id: 'module1',
            unlocked: true,
            lessons: [
              { id: 'l1-m1', quiz: [{}], quizScore: 0 },
              { id: 'l2-m1', quiz: [{}], quizScore: 0 },
            ],
          },
          {
            id: 'module2',
            unlocked: false,
            lessons: [{ id: 'l1-m2', quiz: [{}], quizScore: 0 }],
          },
          {
            id: 'module3',
            unlocked: false,
            lessons: [{ id: 'l1-m3', quiz: [{}], quizScore: 0 }],
          }
        ],
      },
    ],
  };
  t.end();
});

test('POST /api/lessons/:lessonId/complete - should not unlock if not all quizzes are perfect', async (t) => {
  db.data.courses[0].modules[0].lessons[0].quizScore = 5;
  db.data.courses[0].modules[0].lessons[1].quizScore = 4; // Not perfect

  const res = await request(app)
    .post('/api/lessons/l1-m1/complete')
    .send({ courseId: 'course1' });

  t.equal(res.status, 200, 'should return 200');
  t.equal(res.body.unlockedModuleId, undefined, 'should not unlock the next module');
  t.end();
});

test('POST /api/lessons/:lessonId/complete - should unlock the next module', async (t) => {
  db.data.courses[0].modules[0].lessons[0].quizScore = 5;
  db.data.courses[0].modules[0].lessons[1].quizScore = 5; // All perfect

  const res = await request(app)
    .post('/api/lessons/l2-m1/complete')
    .send({ courseId: 'course1' });

  t.equal(res.status, 200, 'should return 200');
  t.equal(res.body.unlockedModuleId, 'module2', 'should unlock the next module');
  t.end();
});

test('POST /api/lessons/:lessonId/complete - should handle course completion', async (t) => {
    db.data.courses[0].modules[2].lessons[0].quizScore = 5;
  
    const res = await request(app)
      .post('/api/lessons/l1-m3/complete')
      .send({ courseId: 'course1' });
  
    t.equal(res.status, 200, 'should return 200');
    t.equal(res.body.courseCompleted, true, 'should signal course completion');
    t.end();
  });

test('Teardown: Close Server', (t) => {
  server.close(() => {
    t.end();
  });
});
