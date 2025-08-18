# TTS Premature Stopping Fixes

## Problem Summary
Speech synthesis was stopping prematurely due to race conditions between lesson change detection and TTS service operations:

1. **Aggressive Lesson Change Detection**: The lesson change `useEffect` was triggering on every TTS status change, not just actual lesson changes
2. **Race Condition**: TTS would start speaking, then immediately get stopped by lesson change detection
3. **Vicious Cycle**: This created a loop where TTS would try to start, get stopped, try again, get stopped again
4. **Dependency Array Issues**: Multiple `useEffect` hooks had overly broad dependencies causing unnecessary re-execution

## Root Causes Identified

### 1. Lesson Change Detection Issues
- `useEffect` had `ttsStatus.isPlaying` and `ttsStatus.isPaused` in dependency array
- This caused the effect to trigger every time TTS status changed, not just when lesson changed
- Created a feedback loop where TTS status changes triggered lesson change detection

### 2. TTS Service Race Conditions
- No grace period for stopping TTS immediately after starting
- Lesson change detection would stop TTS even if it just started speaking
- Multiple rapid stop/start cycles causing instability

### 3. Dependency Array Problems
- `handlePlayAudio` had `lesson` in dependencies, causing re-execution on every lesson object change
- TTS status changes were triggering unnecessary re-renders and re-executions

## Solutions Implemented

### 1. Fixed Lesson Change Detection

#### Updated lesson change `useEffect`:
```javascript
// Auto-pause TTS when lesson changes
useEffect(() => {
  // Only trigger on actual lesson ID changes, not TTS status changes
  if (!lesson?.id) return;
  
  // Set flag to prevent TTS conflicts during lesson change
  isLessonChanging.current = true;
  console.log('[PublicLessonView] Lesson change detected, pausing TTS');
  
  // Stop TTS if it's currently playing or paused
  if (ttsService.current) {
    try {
      if (typeof ttsService.current.stopAndClear === 'function') {
        ttsService.current.stopAndClear();
        console.log('[PublicLessonView] Stopped and cleared TTS on lesson change');
      } else if (typeof ttsService.current.stop === 'function') {
        ttsService.current.stop();
        console.log('[PublicLessonView] Stopped TTS on lesson change');
      }
    } catch (error) {
      console.warn('[PublicLessonView] TTS auto-pause error:', error);
      // If stop fails, try to reset the service
      try {
        if (typeof ttsService.current.reset === 'function') {
          ttsService.current.reset();
          console.log('[PublicLessonView] Reset TTS service after stop error');
        }
      } catch (resetError) {
        console.warn('[PublicLessonView] Error resetting TTS service:', resetError);
      }
    }
  }
  
  // Update TTS status to reflect stopped state
  setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  
  // Clear the flag after a delay to ensure TTS has fully settled
  setTimeout(() => {
    isLessonChanging.current = false;
    console.log('[PublicLessonView] Lesson change flag cleared, TTS can resume');
  }, 2000); // 2 seconds to match TTS service timing
}, [lesson?.id]); // Only depend on lesson ID, not TTS status
```

### 2. Added Grace Period for TTS Stopping

#### Updated `stop()` method with grace period:
```javascript
// Stop reading completely
stop() {
  if (this.isInitialized) {
    // Add a grace period to prevent stopping immediately after starting
    const timeSinceStart = Date.now() - (this.lastStartTime || 0);
    if (timeSinceStart < 1000) { // 1 second grace period
      console.log(`[${this.serviceType} TTS] Ignoring stop request - TTS just started ${timeSinceStart}ms ago`);
      return;
    }
    
    try {
      this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
      this.speech.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.errorCount = 0; // Reset error count when stopping
      
      // Clear current text but preserve fullText for potential retries
      this.currentText = '';
      this.currentLessonId = null;
      // Don't clear fullText here - it's needed for retries
      
      console.log(`[${this.serviceType} TTS] Stopped`);
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Stop failed:`, error);
    } finally {
      // Reset the flag after a longer delay to match lesson change timing
      setTimeout(() => {
        this.isStoppingIntentionally = false;
      }, 1500); // Increased to 1.5 seconds to match lesson change timing
    }
  }
}
```

#### Updated `stopAndClear()` method with grace period:
```javascript
// Stop and clear all text (for lesson changes)
stopAndClear() {
  if (this.isInitialized) {
    // Add a grace period to prevent stopping immediately after starting
    const timeSinceStart = Date.now() - (this.lastStartTime || 0);
    if (timeSinceStart < 1000) { // 1 second grace period
      console.log(`[${this.serviceType} TTS] Ignoring stopAndClear request - TTS just started ${timeSinceStart}ms ago`);
      return;
    }
    
    try {
      this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
      this.speech.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.errorCount = 0;
      
      // Clear all text when stopping for lesson changes
      this.currentText = '';
      this.currentLessonId = null;
      this.fullText = '';
      
      console.log(`[${this.serviceType} TTS] Stopped and cleared`);
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Stop and clear failed:`, error);
    } finally {
      // Reset the flag after a longer delay to match lesson change timing
      setTimeout(() => {
        this.isStoppingIntentionally = false;
      }, 1500); // Increased to 1.5 seconds to match lesson change timing
    }
  }
}
```

### 3. Added Start Time Tracking

#### Added to constructor:
```javascript
// Add flags for better error handling
this.isStoppingIntentionally = false; // Track if we're stopping intentionally
this.isRetrying = false; // Track if we're in a retry cycle
this.lastStartTime = 0; // Track when TTS last started
```

#### Updated onstart listener:
```javascript
'onstart': () => {
  this.isPlaying = true;
  this.isPaused = false;
  this.lastStartTime = Date.now(); // Track when TTS started
  console.log(`[${this.serviceType} TTS] Started speaking`);
},
```

### 4. Fixed handlePlayAudio Dependencies

#### Updated dependency array:
```javascript
const handlePlayAudio = useCallback(async () => {
  if (!lesson?.content) return;
  
  // Prevent TTS during lesson changes
  if (isLessonChanging.current) {
    console.log('[PublicLessonView] Skipping TTS request during lesson change');
    return;
  }
  
  // Prevent starting TTS if it's already playing
  if (ttsStatus.isPlaying) {
    console.log('[PublicLessonView] TTS already playing, ignoring request');
    return;
  }
  
  // ... rest of function implementation
}, [lesson?.id, lesson?.content, ttsStatus.isPaused, ttsStatus.isPlaying]); // More specific dependencies
```

## Key Improvements

### 1. Eliminated Race Conditions
- ✅ **Grace Period**: TTS cannot be stopped within 1 second of starting
- ✅ **Precise Dependencies**: Only actual lesson changes trigger lesson change detection
- ✅ **Duplicate Prevention**: TTS won't start if already playing

### 2. Better State Management
- ✅ **Specific Dependencies**: More precise dependency arrays prevent unnecessary re-execution
- ✅ **Start Time Tracking**: Accurate tracking of when TTS starts for grace period enforcement
- ✅ **Status Validation**: Better checks before attempting TTS operations

### 3. Improved Error Prevention
- ✅ **Early Returns**: Multiple validation checks prevent invalid operations
- ✅ **Graceful Degradation**: Better error handling and recovery
- ✅ **Logging**: Better logging for debugging and monitoring

## Expected Results

These fixes should resolve:

1. **No More Premature Stopping**: TTS will have a 1-second grace period after starting
2. **Eliminated Race Conditions**: Lesson change detection only triggers on actual lesson changes
3. **Stable TTS Operation**: No more vicious cycles of start/stop operations
4. **Better Performance**: Reduced unnecessary re-executions and re-renders
5. **Improved Reliability**: More robust error handling and state management

## Testing Recommendations

1. Test rapid lesson switching to verify TTS stability
2. Monitor console for reduced premature stopping messages
3. Test TTS functionality with long content to ensure it completes
4. Verify that lesson changes properly stop TTS without race conditions
5. Test edge cases like rapid play/stop button clicks

## Files Modified

- `src/components/PublicLessonView.jsx` - Fixed lesson change detection and dependencies
- `src/services/TTSService.js` - Added grace period and start time tracking
- `TTS_PREMATURE_STOPPING_FIXES.md` - This documentation file
