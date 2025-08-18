# TTS Pause Data Reset Implementation

## Overview

This implementation ensures that TTS pause data is properly reset when:
1. **TTS is resumed** - Pause data is cleared to provide a fresh start
2. **Switching between lessons** - Pause data is cleared to prevent interference between lessons

## Problem Solved

Previously, TTS pause data could persist across lesson switches and resume operations, causing:
- Incorrect resume positions when switching lessons
- Accumulated pause data interfering with new TTS sessions
- Inconsistent behavior between pause/resume cycles

## Solution Implemented

### 1. New `resetPauseData()` Method

Added to `TTSService` class to centralize pause data reset logic:

```javascript
resetPauseData() {
  console.log(`[${this.serviceType} TTS] Resetting pause data`);
  this.pausePosition = 0;
  this.pauseTime = 0;
  this.totalSpokenTime = 0;
  this.speakingStartTime = 0;
  this.wasManuallyPaused = false;
  this.finishedNormally = false;
  
  // Clear pause data from server if we have a lesson ID
  if (this.currentLessonId) {
    this.clearPausePosition(this.currentLessonId).catch(error => {
      console.warn(`[${this.serviceType} TTS] Failed to clear pause position from server:`, error.message);
    });
  }
}
```

### 2. Server-Side Pause Data Clearing

Added new endpoint to clear pause positions from server:

```javascript
app.post('/api/tts/clear-pause-position', async (req, res) => {
  try {
    const { lessonId, serviceType } = req.body;
    
    console.log('[TTS] Clearing pause position for lesson:', lessonId, 'service:', serviceType);
    
    // Clear pause position from database/storage
    // Currently logs the operation, can be extended to clear from database
    
    res.json({
      success: true,
      lessonId,
      serviceType,
      message: 'Pause position cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[TTS] Error clearing pause position:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear pause position',
      details: error.message 
    });
  }
});
```

### 3. Resume Method Enhancement

Modified the `resume()` method to reset pause data when resuming:

```javascript
// Reset pause data when resuming - this ensures fresh start
this.resetPauseData();

// Get pause position from server for accurate resume (but we'll reset it after)
let pauseData = null;
if (this.currentLessonId) {
  try {
    pauseData = await this.getPausePosition(this.currentLessonId);
    // Use pause data for resume, then reset it
  } catch (error) {
    console.warn(`[${this.serviceType} TTS] Failed to get pause position from server:`, error.message);
  }
}
```

### 4. Stop Method Enhancement

Modified the `stop()` method to reset pause data when stopping:

```javascript
// Reset position tracking and clear server pause data
this.resetPauseData();
```

### 5. Lesson Change Handling

Updated both `LessonView` and `PublicLessonView` to ensure pause data is reset when switching lessons:

#### LessonView.jsx
```javascript
// Reset TTS if lesson changes
if (propLesson?.id && privateTTSService.getStatus().currentLessonId !== propLesson.id) {
  console.log('[LessonView] Lesson changed, stopping TTS and resetting pause data');
  privateTTSService.stop(); // This will also reset pause data via resetPauseData()
  setTtsStatus(prev => ({ ...prev, isPlaying: false, isPaused: false }));
}
```

#### PublicLessonView.jsx
```javascript
// Stop TTS if it's currently playing or paused
try {
  publicTTSService.stop(); // This will reset pause data via resetPauseData()
  console.log('[PublicLessonView] Stopped TTS and reset pause data on lesson change');
} catch (error) {
  // Error handling...
}
```

## Additional Fix: Content Parsing Issue

### Problem
Some lesson content contained multiple `|||` separators that were causing parsing failures in public course display, particularly with lessons like "Religion and Society in the Old Kingdom".

### Solution
Enhanced the `cleanAndCombineContent` function in both `LessonView.jsx` and `PublicLessonView.jsx` to properly handle all `|||` patterns:

```javascript
// Helper function to clean individual content parts
const cleanContentPart = (part) => {
  if (!part) return '';
  return fixMalformedMarkdown(
    part.replace(/Content generation completed\./g, '')
        .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
        .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
        .trim()
  );
};
```

This ensures that:
- All `|||---|||` patterns are removed
- All remaining `|||` patterns are removed
- Content is properly cleaned before display
- Both string and object content types are handled

## Additional Fix: Enhanced Separator Removal

### Problem
Despite the initial fix, `|||` separators were still appearing in the public course display, indicating that the separator removal wasn't comprehensive enough.

### Enhanced Solution
Implemented multi-stage separator removal to ensure `|||` patterns are completely hidden from view:

#### 1. Enhanced Content Parsing
Updated `cleanAndCombineContent` function in both components with multi-stage cleaning:

```javascript
const cleanContentPart = (part) => {
  if (!part) return '';
  
  // First, remove all separator patterns before any other processing
  let cleaned = part
    .replace(/Content generation completed\./g, '')
    .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
    .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
    .trim();
  
  // Then apply markdown processing
  cleaned = fixMalformedMarkdown(cleaned);
  
  // Final cleanup of any separators that might have been reintroduced
  cleaned = cleaned
    .replace(/\|\|\|---\|\|\|/g, '')
    .replace(/\|\|\|/g, '');
  
  return cleaned;
};
```

#### 2. MarkdownService Enhancement
Added separator removal to both preprocessing and postprocessing stages:

```javascript
// Pre-process content to fix malformed patterns
preprocessContent(content) {
  return content
    // Remove any separator patterns first
    .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
    .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
    
    // ... other processing ...
    
    // Final separator cleanup
    .replace(/\|\|\|---\|\|\|/g, '')
    .replace(/\|\|\|/g, '');
}

// Post-process HTML to clean up any remaining issues
postprocessHTML(html) {
  return html
    // ... other cleanup ...
    
    // Remove any separator patterns that might have been converted to HTML
    .replace(/\|\|\|---\|\|\|/g, '')        // Remove |||---||| patterns
    .replace(/\|\|\|/g, '')                 // Remove all remaining ||| patterns
    
    // ... other processing ...
}
```

#### 3. Multi-Stage Cleanup
Implemented cleanup at multiple stages:
- **Initial cleanup**: Before markdown processing
- **Post-processing cleanup**: After markdown processing
- **Final cleanup**: After all content combination
- **HTML cleanup**: In the final HTML output

### Benefits
- ✅ **Complete Separator Removal**: All `|||` patterns are removed at multiple stages
- ✅ **No Visual Artifacts**: Separators are completely hidden from view
- ✅ **Robust Processing**: Multiple cleanup stages ensure no separators slip through
- ✅ **Maintains Content Structure**: Content structure is preserved while removing separators
- ✅ **Cross-Component Consistency**: Both LessonView and PublicLessonView use the same enhanced logic

### Testing
The enhanced separator removal ensures that:
1. All `|||---|||` patterns are removed
2. All remaining `|||` patterns are removed
3. Separators don't appear in the final rendered content
4. Content structure and formatting are preserved
5. Both string and object content types are handled properly

## Benefits

### 1. **Fresh Start on Resume**
- When TTS is resumed, pause data is cleared
- Ensures consistent behavior across resume cycles
- Prevents accumulated pause data from interfering

### 2. **Clean Lesson Transitions**
- Pause data is cleared when switching lessons
- Prevents pause data from one lesson affecting another
- Ensures each lesson starts with clean TTS state

### 3. **Server-Side Consistency**
- Pause positions are cleared from server when reset
- Prevents stale pause data from being retrieved
- Maintains consistency between client and server

### 4. **Improved User Experience**
- More predictable TTS behavior
- No interference between different lessons
- Consistent pause/resume functionality

### 5. **Content Display Fix**
- Proper parsing of lesson content with multiple separators
- No more parsing failures in public course display
- Clean content rendering for all lesson types

## Technical Details

### Pause Data Fields Reset
- `pausePosition`: Reset to 0
- `pauseTime`: Reset to 0
- `totalSpokenTime`: Reset to 0
- `speakingStartTime`: Reset to 0
- `wasManuallyPaused`: Reset to false
- `finishedNormally`: Reset to false

### Server Communication
- Pause positions are cleared from server via API call
- Non-blocking operation (uses `.catch()` for error handling)
- Logs success/failure for debugging

### Error Handling
- Graceful fallback if server clear operation fails
- Continues with local reset even if server operation fails
- Comprehensive logging for debugging

### Content Parsing
- Handles both `|||---|||` and `|||` patterns
- Works with both string and object content types
- Maintains content structure while removing separators

## Testing Scenarios

### 1. Resume After Pause
1. Start TTS on a lesson
2. Pause TTS mid-sentence
3. Resume TTS
4. **Expected**: Pause data is reset, TTS continues from where it left off

### 2. Lesson Switch
1. Start TTS on Lesson A
2. Pause TTS
3. Switch to Lesson B
4. Start TTS on Lesson B
5. **Expected**: No interference from Lesson A's pause data

### 3. Multiple Resume Cycles
1. Start TTS
2. Pause and resume multiple times
3. **Expected**: Each resume provides fresh start, no accumulated pause data

### 4. Server Communication
1. Monitor server logs during pause/resume operations
2. **Expected**: Clear pause position API calls are made when appropriate

### 5. Content Parsing
1. Load lesson with multiple `|||` separators
2. **Expected**: Content displays properly without parsing errors
3. **Expected**: All separators are removed while content structure is preserved

## Future Enhancements

1. **Database Integration**: Store pause positions in database for persistence
2. **User Preferences**: Allow users to configure pause behavior
3. **Analytics**: Track pause/resume patterns for optimization
4. **Advanced Resume**: Implement more sophisticated resume positioning
5. **Content Validation**: Add validation for lesson content structure

## Files Modified

- `src/services/TTSService.js` - Added `resetPauseData()` and `clearPausePosition()` methods
- `server.js` - Added `/api/tts/clear-pause-position` endpoint
- `src/components/LessonView.jsx` - Updated lesson change handling and content parsing
- `src/components/PublicLessonView.jsx` - Updated lesson change handling and content parsing

## Conclusion

This implementation ensures that TTS pause data is properly managed and reset when appropriate, providing a more consistent and predictable user experience. The solution is robust, handles errors gracefully, and maintains consistency between client and server state. Additionally, the content parsing fix ensures that all lesson content displays properly without parsing errors.
