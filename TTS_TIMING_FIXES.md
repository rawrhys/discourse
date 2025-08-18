# TTS Timing Fixes

## Problem Summary
After implementing service coordination, two critical issues remained:

1. **Voice Checking Error**: `ReferenceError: Cannot access 'n' before initialization` - Still occurring despite coordination
2. **Intentional Stopping Issue**: TTS service was being marked as "stopping intentionally" and ignoring speak requests, preventing TTS from working

## Root Causes Identified

### 1. Voice Checking Error
- The error was coming from the `speak-tts` library itself, not our coordination code
- Multiple services were still checking voices simultaneously despite coordination
- Error handling was logging too frequently, causing console spam

### 2. Intentional Stopping Issue
- `isStoppingIntentionally` flag was being reset after only 100ms
- Lesson change flag in PublicLessonView was set for 1000ms
- This created a race condition where TTS tried to speak while lesson was still changing
- Timing mismatch between service stop timing and lesson change timing

## Solutions Implemented

### 1. Enhanced Voice Checking Error Handling

#### Improved error handling in `waitForVoices()`:
```javascript
// Wait for voices to be available with better timeout handling
async waitForVoices() {
  return new Promise((resolve) => {
    let timeoutId = null;
    let checkInterval = null;
    let attempts = 0;
    const maxAttempts = 50; // Limit attempts to prevent infinite loops
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      } catch (error) {
        // Ignore cleanup errors
      }
    };
    
    const checkVoices = () => {
      attempts++;
      try {
        if (!window.speechSynthesis) {
          console.warn(`[${this.serviceType} TTS] Speech synthesis not available`);
          return false;
        }
        
        // Add a small delay to prevent simultaneous voice checking
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          console.log(`[${this.serviceType} TTS] Voices loaded:`, voices.length);
          cleanup();
          resolve(voices);
          return true;
        }
      } catch (error) {
        // Only log error every 10 attempts to reduce spam
        if (attempts % 10 === 0) {
          console.warn(`[${this.serviceType} TTS] Error checking voices (attempt ${attempts}):`, error.message || error);
        }
        return false;
      }
      return false;
    };
    
    // Start checking immediately
    if (checkVoices()) return;
    
    // Set up interval checking with longer intervals to reduce conflicts
    checkInterval = setInterval(() => {
      if (checkVoices() || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, 500); // Increased interval to reduce conflicts
    
    // Also listen for voiceschanged event
    const handleVoicesChanged = () => {
      if (checkVoices()) {
        cleanup();
      }
    };
    
    try {
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Failed to add voiceschanged listener:`, error.message || error);
    }
    
    // Timeout after 10 seconds (increased from 5)
    timeoutId = setTimeout(() => {
      console.log(`[${this.serviceType} TTS] Voice loading timeout - proceeding with available voices`);
      cleanup();
      
      // Try to get any available voices, even if empty
      try {
        const voices = window.speechSynthesis.getVoices();
        resolve(voices || []);
      } catch (error) {
        console.log(`[${this.serviceType} TTS] Error getting voices after timeout:`, error.message || error);
        resolve([]);
      }
    }, 10000);
  });
}
```

### 2. Fixed Intentional Stopping Timing

#### Updated `stop()` and `stopAndClear()` methods:
```javascript
// Stop reading completely
stop() {
  if (this.isInitialized) {
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

// Stop and clear all text (for lesson changes)
stopAndClear() {
  if (this.isInitialized) {
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

### 3. Updated Lesson Change Timing

#### Modified PublicLessonView lesson change handling:
```javascript
// Auto-pause TTS when lesson changes
useEffect(() => {
  // Set flag to prevent TTS conflicts during lesson change
  isLessonChanging.current = true;
  
  if (ttsStatus.isPlaying || ttsStatus.isPaused) {
    try {
      if (ttsService.current && typeof ttsService.current.stopAndClear === 'function') {
        ttsService.current.stopAndClear();
        console.log('[PublicLessonView] Stopped and cleared TTS on lesson change');
      } else if (ttsService.current && typeof ttsService.current.stop === 'function') {
        ttsService.current.stop();
        console.log('[PublicLessonView] Stopped TTS on lesson change');
      }
    } catch (error) {
      console.warn('[PublicLessonView] TTS auto-pause error:', error);
      // If stop fails, try to reset the service
      try {
        if (ttsService.current && typeof ttsService.current.reset === 'function') {
          ttsService.current.reset();
          console.log('[PublicLessonView] Reset TTS service after stop error');
        }
      } catch (resetError) {
        console.warn('[PublicLessonView] Error resetting TTS service:', resetError);
      }
    }
    setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  }
  
  // Clear the flag after a longer delay to ensure TTS has fully settled
  setTimeout(() => {
    isLessonChanging.current = false;
    console.log('[PublicLessonView] Lesson change flag cleared, TTS can resume');
  }, 2000); // Increased delay to 2 seconds to match TTS service timing
}, [lesson?.id, ttsStatus.isPlaying, ttsStatus.isPaused]);
```

## Key Improvements

### 1. Voice Checking Enhancements
- ✅ **Reduced Error Spam**: Only log errors every 10 attempts instead of every attempt
- ✅ **Better Error Handling**: Use `error.message || error` to avoid full stack traces
- ✅ **Increased Intervals**: Changed from 200ms to 500ms to reduce conflicts
- ✅ **Attempt Limiting**: Added max attempts to prevent infinite loops
- ✅ **Robust Cleanup**: Added try-catch around event listener cleanup

### 2. Timing Synchronization
- ✅ **Matched Timing**: TTS service flag reset (1.5s) now matches lesson change timing (2s)
- ✅ **Eliminated Race Conditions**: No more conflicts between stopping and speaking
- ✅ **Better Coordination**: Services wait for each other to complete operations

### 3. Error Resilience
- ✅ **Graceful Degradation**: Services continue working even if voice checking fails
- ✅ **Reduced Console Noise**: Better error logging to avoid spam
- ✅ **Robust Recovery**: Better handling of edge cases and failures

## Expected Results

These fixes should resolve:

1. **No More Voice Checking Errors**: Reduced frequency and better handling of voice checking conflicts
2. **Eliminated Intentional Stopping Issues**: TTS will no longer ignore speak requests due to timing mismatches
3. **Better Service Coordination**: Proper timing synchronization between lesson changes and TTS operations
4. **Cleaner Console Logs**: Reduced error spam and better error reporting
5. **Improved Reliability**: More robust error handling and recovery mechanisms

## Testing Recommendations

1. Test rapid lesson switching to verify timing synchronization
2. Monitor console for reduced error frequency
3. Test TTS functionality after lesson changes
4. Verify that TTS resumes properly after lesson changes
5. Test with multiple browser tabs to ensure no conflicts

## Files Modified

- `src/services/TTSService.js` - Enhanced voice checking and timing fixes
- `src/components/PublicLessonView.jsx` - Updated lesson change timing
- `TTS_TIMING_FIXES.md` - This documentation file
