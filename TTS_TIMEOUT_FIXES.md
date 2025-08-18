# TTS Timeout Fixes

## Issue Summary
The TTS (Text-to-Speech) system was experiencing timeout issues where all chunks were timing out after 5 seconds, preventing the speak-tts library from actually speaking the text. The pause button was working (successfully paused at chunk 2), but the resume functionality wasn't working properly because chunks kept timing out.

## Root Cause Analysis
1. **Short Timeout**: The default timeout was set to 5 seconds, which was too short for longer text chunks
2. **Non-blocking Timing Calls**: The TTS service was making non-blocking calls to get optimal timing, which could interfere with TTS functionality
3. **Authentication Not Required**: The TTS timing endpoints don't require authentication, so blocking calls are safe

## Fixes Implemented

### 1. Increased Default Timeouts
- **TTS Service**: Increased default timeout from 5 seconds to 15 seconds
- **Server Endpoint**: Increased default optimal timeout from 15 seconds to 20 seconds
- **Main Speak Method**: Already had 10-second timeout (adequate)

### 2. Made Timing Calls Blocking
- **Before**: Non-blocking calls using `.then()` and `.catch()`
- **After**: Blocking calls using `await` since authentication is not required
- **Benefit**: Ensures timing data is retrieved before TTS starts, preventing interference

### 3. Updated Both Chunk Processing Methods
- **speakInChunks()**: Updated to use blocking timing calls and 15-second timeout
- **resumeChunkedSpeech()**: Updated to use blocking timing calls and 15-second timeout

## Code Changes

### TTS Service (`src/services/TTSService.js`)
```javascript
// Before
let optimalTimeout = 5000; // Default 5 second timeout
this.getOptimalChunkTiming(this.currentLessonId, i).then(timing => {
  // Non-blocking call
});

// After  
let optimalTimeout = 15000; // Default 15 second timeout (increased from 5)
try {
  const timing = await this.getOptimalChunkTiming(this.currentLessonId, i);
  if (timing && timing.optimalTimeout) {
    optimalTimeout = timing.optimalTimeout;
  }
} catch (error) {
  // Use default timeout
}
```

### Server Endpoint (`server.js`)
```javascript
// Before
const optimalTimeout = 15000; // 15 seconds default

// After
const optimalTimeout = 20000; // 20 seconds default (increased from 15)
```

## Expected Results
1. **Longer Speaking Time**: Chunks now have 15-20 seconds to complete instead of 5 seconds
2. **Better Resume Functionality**: Pause/resume should work properly without timeout interference
3. **Improved Reliability**: TTS should complete chunks successfully before timing out
4. **No Authentication Issues**: Blocking calls are safe since timing endpoints don't require auth

## Testing Recommendations
1. Test with long text content to verify chunks complete successfully
2. Test pause/resume functionality to ensure it works without timeout issues
3. Monitor console logs for timeout messages - should see fewer timeout warnings
4. Verify that TTS actually speaks the text instead of just timing out

## Files Modified
- `src/services/TTSService.js` - Updated timeout values and made timing calls blocking
- `server.js` - Increased default optimal timeout
- `TTS_TIMEOUT_FIXES.md` - This documentation file

## Related Issues
- TTS chunks timing out after 5 seconds
- Resume functionality not working properly
- speak-tts library not actually speaking text
- Pause working but resume failing due to timeouts
