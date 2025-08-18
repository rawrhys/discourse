# Public Course Session Management

## Overview

The public course session management system ensures that multiple users accessing the same public course link don't interfere with each other's quiz progress. Each user gets their own isolated session for quiz data storage.

## How It Works

### Session Creation
- When a user accesses a public course, a unique session ID is generated
- The session ID is included in the URL as a query parameter: `?sessionId=session_1234567890_abc123`
- Each session stores quiz scores and lesson progress independently

### Session Isolation
- **New Users**: Users without a session ID get a new session automatically
- **Existing Sessions**: If a session ID is provided in the URL:
  - If the session exists and is active, it's restored
  - If the session doesn't exist or is expired, a new session is created
  - If the session is already in use by another user, a new session is created

### Session Conflicts
When multiple users try to access the same session ID:

1. **First User**: Gets the original session
2. **Subsequent Users**: Automatically get new sessions to prevent interference
3. **URL Updates**: The URL is automatically updated with the new session ID
4. **Transparent to User**: The user experience remains seamless

### Session Lifecycle

#### Creation
```javascript
// New session created when user accesses course
const sessionId = publicCourseSessionService.createSession(courseId);
// Returns: "session_1703123456789_abc123def"
```

#### Restoration/Conflict Resolution
```javascript
// Try to restore existing session or create new one
const sessionId = publicCourseSessionService.restoreOrCreateSession(courseId, existingSessionId);
// If existingSessionId is in use, returns new sessionId
```

#### Quiz Score Storage
```javascript
// Save quiz score to user's session
publicCourseSessionService.saveQuizScore(sessionId, lessonId, score);
```

#### Cleanup
- Sessions expire after 30 minutes of inactivity
- Expired sessions are automatically cleaned up every 5 minutes
- Manual cleanup available for testing/admin purposes

## API Endpoints

### Get Public Course
```
GET /api/public/courses/:courseId?sessionId=session_123
```
- Returns course data with session management
- Creates new session if none provided
- Handles session conflicts automatically

### Save Quiz Score
```
POST /api/public/courses/:courseId/quiz-score
{
  "sessionId": "session_123",
  "lessonId": "lesson_456", 
  "score": 5
}
```
- Saves quiz score to user's session
- Creates new session if current session is unavailable
- Returns new session ID if session conflict occurred

### Get Quiz Scores
```
GET /api/public/courses/:courseId/quiz-scores?sessionId=session_123
```
- Returns all quiz scores for the user's session

## Frontend Integration

### URL Management
- Session ID is automatically added to URL when course is loaded
- URL is updated if session conflicts occur
- Users can bookmark/share URLs with their session ID

### Session State
- Session ID is stored in component state
- Quiz scores are loaded from session on course load
- Session conflicts are handled transparently

### User Experience
- Users don't need to know about session management
- Session conflicts are resolved automatically
- Quiz progress is preserved within each user's session

## Benefits

1. **Isolation**: Each user's quiz progress is completely isolated
2. **No Interference**: Multiple users can't affect each other's progress
3. **Transparent**: Users don't need to understand session management
4. **Automatic**: Session conflicts are resolved automatically
5. **Persistent**: Quiz progress is maintained within a session
6. **Clean**: Expired sessions are automatically cleaned up

## Example Scenarios

### Scenario 1: Single User
1. User accesses `/public/course/123`
2. New session created: `session_1703123456789_abc123`
3. URL becomes: `/public/course/123?sessionId=session_1703123456789_abc123`
4. User completes quizzes, progress saved to their session

### Scenario 2: Multiple Users, Same Link
1. User A shares link: `/public/course/123?sessionId=session_1703123456789_abc123`
2. User B clicks the link
3. System detects session conflict, creates new session for User B
4. User B's URL becomes: `/public/course/123?sessionId=session_1703123456790_def456`
5. Both users have independent quiz progress

### Scenario 3: Expired Session
1. User returns to course after 30+ minutes
2. Original session has expired
3. New session is automatically created
4. User starts fresh (previous progress lost, but no interference with others)

## Technical Implementation

### Session Service
- `PublicCourseSessionService` manages all session operations
- In-memory storage with automatic cleanup
- Session timeout: 30 minutes
- Cleanup interval: 5 minutes

### Conflict Detection
- Sessions are marked as "active" when in use
- Multiple users accessing same session triggers conflict resolution
- New sessions are created automatically for conflicting users

### Data Storage
- Quiz scores stored per session
- Lesson progress tracked per session
- Session metadata includes creation time and last activity

## Monitoring

### Session Statistics
```javascript
const stats = publicCourseSessionService.getStats();
// Returns: { totalSessions, activeSessions, activeSessionIds }
```

### Logging
- All session operations are logged for debugging
- Session conflicts are logged with details
- Cleanup operations are logged

## Future Enhancements

1. **Persistent Storage**: Store sessions in database for longer persistence
2. **User Accounts**: Link sessions to user accounts when available
3. **Session Transfer**: Allow users to transfer progress between sessions
4. **Analytics**: Track session usage patterns
5. **Custom Timeouts**: Configurable session timeout per course
