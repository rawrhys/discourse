# TTS Timeout Issues Resolution

## Problem Summary
The application was experiencing TTS (Text-to-Speech) timeout issues with the following symptoms:
- Speech synthesis promises being rejected
- Retry mechanisms receiving empty text
- Infinite retry loops with no valid content
- TTS state inconsistencies

## Root Causes Identified
1. **Empty Text Processing**: The `cleanAndCombineContent` function was sometimes returning empty or invalid text
2. **Insufficient Validation**: TTS service was attempting to speak empty or very short text
3. **Multiple Simultaneous Calls**: No protection against concurrent TTS requests
4. **Inconsistent State Management**: TTS service could get stuck in error states
5. **Missing Cleanup**: No proper cleanup when components unmount or lessons change

## Fixes Implemented

### 1. Enhanced Text Validation in TTSService.js

#### Added comprehensive text validation in `speak()` method:
```javascript
// Enhanced text validation with early return for empty content
if (!text) {
  console.warn(`[${this.serviceType} TTS] No text provided to speak`);
  this.isPlaying = false;
  this.isPaused = false;
  ttsCoordinator.releaseTTS(this.serviceId);
  return;
}

if (typeof text !== 'string') {
  console.warn(`[${this.serviceType} TTS] Text is not a string:`, typeof text, text);
  this.isPlaying = false;
  this.isPaused = false;
  ttsCoordinator.releaseTTS(this.serviceId);
  return;
}

if (text.trim().length === 0) {
  console.warn(`[${this.serviceType} TTS] Text is empty or only whitespace`);
  this.isPlaying = false;
  this.isPaused = false;
  ttsCoordinator.releaseTTS(this.serviceId);
  return;
}

// Additional validation to ensure text is substantial
if (text.trim().length < 5) {
  console.warn(`[${this.serviceType} TTS] Text too short to speak: "${text.trim()}"`);
  this.isPlaying = false;
  this.isPaused = false;
  ttsCoordinator.releaseTTS(this.serviceId);
  return;
}
```

#### Enhanced validation in `readLesson()` method:
```javascript
// Enhanced validation for extracted text
if (!text) {
  console.warn(`[${this.serviceType} TTS] No text content extracted from lesson - lessonId: ${lessonId}, lesson title: ${lesson.title || 'unknown'}`);
  ttsCoordinator.releaseTTS(this.serviceId);
  return false;
}

if (typeof text !== 'string') {
  console.warn(`[${this.serviceType} TTS] Extracted text is not a string: ${typeof text} - lessonId: ${lessonId}`);
  ttsCoordinator.releaseTTS(this.serviceId);
  return false;
}

if (!text.trim()) {
  console.warn(`[${this.serviceType} TTS] Extracted text is empty or only whitespace - lessonId: ${lessonId}, lesson title: ${lesson.title || 'unknown'}`);
  ttsCoordinator.releaseTTS(this.serviceId);
  return false;
}

if (text.trim().length < 10) {
  console.warn(`[${this.serviceType} TTS] Extracted text too short (${text.trim().length} chars): "${text.trim()}" - lessonId: ${lessonId}`);
  ttsCoordinator.releaseTTS(this.serviceId);
  return false;
}
```

### 2. Improved Retry Logic

#### Enhanced retry mechanism to prevent infinite loops:
```javascript
if (this.errorCount < this.maxRetries) {
  console.log(`[${this.serviceType} TTS] Retrying after promise rejection... (${this.errorCount}/${this.maxRetries})`);
  setTimeout(() => {
    // Only retry if we have valid text to speak
    if (this.fullText && this.fullText.trim().length > 5) {
      this.speak(this.fullText).then(resolve);
    } else {
      console.warn(`[${this.serviceType} TTS] No valid text for retry, resolving gracefully`);
      ttsCoordinator.releaseTTS(this.serviceId);
      resolve();
    }
  }, 1000);
}
```

### 3. Concurrent Call Prevention

#### Added guards to prevent multiple simultaneous TTS calls:
```javascript
// Prevent multiple simultaneous speak calls
if (this.isPlaying) {
  console.warn(`[${this.serviceType} TTS] Already playing, ignoring new speak request`);
  return;
}

// Prevent multiple simultaneous read requests
if (this.isPlaying) {
  console.warn(`[${this.serviceType} TTS] Already playing, ignoring new read request`);
  ttsCoordinator.releaseTTS(this.serviceId);
  return false;
}
```

### 4. Error Recovery Mechanism

#### Added automatic reset for error states:
```javascript
// Reset if we have too many errors
if (this.errorCount >= this.maxRetries) {
  console.warn(`[${this.serviceType} TTS] Too many errors, resetting TTS state`);
  this.reset();
  this.errorCount = 0;
}
```

#### Added reset method for state recovery:
```javascript
// Reset TTS state - useful for recovery from inconsistent states
reset() {
  console.log(`[${this.serviceType} TTS] Resetting TTS state`);
  this.stop();
  
  // Cancel any ongoing speech synthesis
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    try {
      window.speechSynthesis.cancel();
      console.log(`[${this.serviceType} TTS] Canceled ongoing speech synthesis during reset`);
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Failed to cancel speech synthesis during reset:`, error);
    }
  }
  
  // Release TTS control
  try {
    ttsCoordinator.releaseTTS(this.serviceId);
  } catch (error) {
    console.warn(`[${this.serviceType} TTS] Failed to release TTS during reset:`, error);
  }
}
```

### 5. Enhanced Content Processing in PublicLessonView.jsx

#### Added validation before TTS calls:
```javascript
// Validate content before attempting TTS
if (!contentStr || typeof contentStr !== 'string' || contentStr.trim().length < 10) {
  console.warn('[PublicLessonView] Content too short or invalid for TTS:', {
    hasContent: !!contentStr,
    type: typeof contentStr,
    length: contentStr ? contentStr.length : 0,
    trimmedLength: contentStr ? contentStr.trim().length : 0
  });
  setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  return;
}
```

#### Enhanced content processing with debugging:
```javascript
// Helper function to clean and combine lesson content
const cleanAndCombineContent = (content) => {
  if (!content) {
    console.warn('[PublicLessonView] No content provided to cleanAndCombineContent');
    return '';
  }
  
  if (typeof content === 'string') {
    const cleaned = fixMalformedMarkdown(
      content.replace(/Content generation completed\./g, '')
             .replace(/\|\|\|---\|\|\|/g, '')
             .trim()
    );
    const result = cleanupRemainingAsterisks(cleaned);
    console.log('[PublicLessonView] String content processed:', {
      originalLength: content.length,
      cleanedLength: result.length,
      hasContent: result.trim().length > 0
    });
    return result;
  }
  
  // ... rest of the function with enhanced logging
};
```

### 6. Improved Cleanup Mechanisms

#### Added cleanup on component unmount:
```javascript
// Cleanup TTS when component unmounts
useEffect(() => {
  return () => {
    if (ttsService.current) {
      try {
        ttsService.current.stopAndRelease();
        console.log('[PublicLessonView] Cleaned up TTS service on unmount');
      } catch (error) {
        console.warn('[PublicLessonView] Error cleaning up TTS service:', error);
      }
    }
  };
}, []);
```

#### Enhanced lesson change handling:
```javascript
// Auto-pause TTS when lesson changes
useEffect(() => {
  if (ttsStatus.isPlaying || ttsStatus.isPaused) {
    try {
      if (ttsService.current && typeof ttsService.current.stop === 'function') {
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
}, [lesson?.id, ttsStatus.isPlaying, ttsStatus.isPaused]);
```

## Expected Results

These fixes should resolve the TTS timeout issues by:

1. **Preventing Empty Text**: Comprehensive validation ensures TTS only processes valid content
2. **Eliminating Infinite Loops**: Retry logic only attempts retries with valid text
3. **Preventing Concurrent Calls**: Guards prevent multiple simultaneous TTS requests
4. **Recovering from Errors**: Automatic reset mechanisms handle error states
5. **Proper Cleanup**: Component lifecycle management prevents resource leaks
6. **Better Debugging**: Enhanced logging helps identify issues quickly

## Testing Recommendations

1. Test with lessons that have minimal content
2. Test rapid lesson switching
3. Test TTS controls (play, pause, stop) in quick succession
4. Test with network interruptions
5. Monitor console logs for any remaining issues

## Files Modified

- `src/services/TTSService.js` - Core TTS service enhancements
- `src/components/PublicLessonView.jsx` - Component-level improvements
- `TTS_TIMEOUT_FIXES.md` - This documentation file
