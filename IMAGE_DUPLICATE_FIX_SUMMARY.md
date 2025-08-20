# Image Duplicate Fix Summary

## 🐛 **Problem Identified**

The image service was returning the same image for different lessons even when the `usedImageTitles` and `usedImageUrls` parameters were provided to prevent duplicates. This was happening because:

1. **Cache Key Issue**: The cache key in `fetchRelevantImage()` only included the subject and relaxed flag, but not the used images
2. **Cache Bypass**: When the same lesson title was searched multiple times, it would return the cached result from the first search, ignoring the duplicate prevention logic

### **Example from Logs**
```
[AIService] Using cached image search result for "The Ptolemaic Dynasty and Hellenistic Egypt"
[AIService] Using cached image search result for "The Legacy of Ancient Egypt"
```

Both searches returned the same "sphinx" image despite having different used image lists.

## 🔧 **Solution Implemented**

### **1. Enhanced Cache Key Generation**
```javascript
// Before: Only subject and relaxed flag
const cacheKey = `image_search_${subject}_${options.relaxed ? 'relaxed' : 'strict'}`;

// After: Includes used images to prevent duplicates
const usedTitlesHash = usedImageTitles.length > 0 ? '_' + usedImageTitles.slice(0, 5).join('_').replace(/[^a-zA-Z0-9]/g, '') : '';
const usedUrlsHash = usedImageUrls.length > 0 ? '_' + usedImageUrls.slice(0, 3).map(url => url.split('/').pop()?.split('?')[0] || '').join('_').replace(/[^a-zA-Z0-9]/g, '') : '';
const cacheKey = `image_search_${subject}_${options.relaxed ? 'relaxed' : 'strict'}${usedTitlesHash}${usedUrlsHash}`;
```

### **2. Enhanced Logging**
- Added cache key logging to track when cached vs fresh searches occur
- Added duplicate detection logging to show when images are switched or rejected
- Added warnings when no alternative images can be found

### **3. Backward Compatibility**
- Automatically clears old cache entries that don't include used images
- Ensures existing functionality continues to work

### **4. Cache Management**
- Updated `/api/image/clear-cache` endpoint to also clear image search cache
- Added logging for cache clearing operations

## 📊 **How It Works Now**

### **Cache Key Examples**
```
// Same lesson, no used images
image_search_The Ptolemaic Dynasty and Hellenistic Egypt_strict

// Same lesson, with used images
image_search_The Ptolemaic Dynasty and Hellenistic Egypt_strict_sphinx_egypt_pyramid

// Different lesson, same used images
image_search_The Legacy of Ancient Egypt_strict_sphinx_egypt_pyramid
```

### **Duplicate Prevention Flow**
1. **Cache Check**: Look for existing result with same subject AND used images
2. **Fresh Search**: If no cache hit, perform new search with duplicate prevention
3. **Service Switching**: If selected image is already used, try other service
4. **Relaxed Search**: If still duplicate, try relaxed search for alternatives
5. **Rejection**: If no alternative found, return null to prevent duplicate

## 🧪 **Testing**

Created `test-image-duplicate-fix.js` to verify the fix:

```bash
node test-image-duplicate-fix.js
```

**Test Cases:**
1. Same lesson title, no used images → Should return first result
2. Same lesson title, with first image as used → Should return different image
3. Different lesson title, no used images → Should return different image
4. Same lesson title, with multiple used images → Should return different image or null

## 🚀 **Expected Results**

### **Before Fix**
- Same images returned for different lessons
- Duplicate prevention ignored due to caching
- Poor user experience with repetitive images

### **After Fix**
- Different images for different lessons
- Proper duplicate prevention working
- Better visual variety in courses
- Clear logging for debugging

## 📝 **Logging Examples**

### **Cache Hits**
```
[AIService] Using cached image search result for "The Ptolemaic Dynasty and Hellenistic Egypt" (cache key: image_search_The Ptolemaic Dynasty and Hellenistic Egypt_strict)
```

### **Fresh Searches**
```
[AIService] Performing fresh image search for "The Legacy of Ancient Egypt" (cache key: image_search_The Legacy of Ancient Egypt_strict_sphinx_egypt)
```

### **Duplicate Detection**
```
[AIService] Selected image is already used, trying alternative for "The Ptolemaic Dynasty and Hellenistic Egypt" (used URLs: 2)
[AIService] Switched to Pixabay image to avoid duplicate for "The Ptolemaic Dynasty and Hellenistic Egypt"
```

### **No Alternatives Found**
```
[AIService] WARNING: Could not find alternative image for "The Ptolemaic Dynasty and Hellenistic Egypt", returning null to prevent duplicate
```

## 🔄 **Deployment**

The fix is now live and will:
1. Clear old cache entries automatically
2. Use new cache keys for all future searches
3. Provide better logging for monitoring
4. Prevent image duplicates across lessons

No additional deployment steps required - the fix takes effect immediately.
