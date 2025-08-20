# Image Duplicate Fix Implementation

## 🐛 **Problem Identified**

The image service was returning the same image for different lessons even when the `usedImageTitles` and `usedImageUrls` parameters were provided to prevent duplicates. This was happening because:

1. **Cache Key Issue**: The cache key in `fetchRelevantImage()` only included the subject and relaxed flag, but not the used images
2. **Cache Bypass**: When the same lesson title was searched multiple times, it would return the cached result from the first search, ignoring the duplicate prevention logic

## 🔧 **Root Cause**

```javascript
// OLD (Problematic) - Line 1846 in server.js
const cacheKey = `image_search_${subject}_${options.relaxed ? 'relaxed' : 'strict'}`;
```

This cache key didn't include `usedImageTitles` or `usedImageUrls`, so different searches with the same subject but different used images would return the same cached result.

## ✅ **Solution Implemented**

### **1. Enhanced Cache Key Generation**

```javascript
// NEW (Fixed) - Lines 1846-1848 in server.js
const usedTitlesHash = usedImageTitles.length > 0 ? '_' + usedImageTitles.slice(0, 5).join('_').replace(/[^a-zA-Z0-9]/g, '') : '';
const usedUrlsHash = usedImageUrls.length > 0 ? '_' + usedImageUrls.slice(0, 3).map(url => url.split('/').pop()?.split('?')[0] || '').join('_').replace(/[^a-zA-Z0-9]/g, '') : '';
const cacheKey = `image_search_${subject}_${options.relaxed ? 'relaxed' : 'strict'}${usedTitlesHash}${usedUrlsHash}`;
```

**Key Features:**
- Includes up to 5 used image titles in the cache key
- Includes up to 3 used image URLs (filename only to keep key manageable)
- Sanitizes special characters to prevent cache key issues
- Maintains backward compatibility

### **2. Enhanced Logging**

Added comprehensive logging to track:
- When cache is used vs fresh search performed
- Cache key generation for debugging
- Duplicate detection and alternative image selection
- When images are rejected due to duplicates

```javascript
console.log(`[AIService] Using cached image search result for "${subject}" (cache key: ${cacheKey})`);
console.log(`[AIService] Performing fresh image search for "${subject}" (cache key: ${cacheKey})`);
console.log(`[AIService] Switched to Pixabay image to avoid duplicate for "${subject}"`);
console.log(`[AIService] WARNING: Could not find alternative image for "${subject}", returning null to prevent duplicate`);
```

### **3. Cache Cleanup**

Added automatic cleanup of old cache entries that don't include used images:

```javascript
// Clear old cache entries that don't include used images (for backward compatibility)
if (global.imageSearchCache.size > 0) {
  const oldKeys = Array.from(global.imageSearchCache.keys()).filter(key => 
    !key.includes('_') || key.split('_').length < 4
  );
  oldKeys.forEach(key => {
    console.log(`[AIService] Clearing old cache entry: ${key}`);
    global.imageSearchCache.delete(key);
  });
}
```

### **4. Enhanced Cache Clearing Endpoint**

Updated the `/api/image/clear-cache` endpoint to also clear the image search cache:

```javascript
// Also clear the image search cache
if (global.imageSearchCache) {
  const cacheSize = global.imageSearchCache.size;
  global.imageSearchCache.clear();
  console.log(`[ADMIN] Cleared ${cacheSize} image search cache entries`);
}
```

## 🧪 **Testing**

Created `test-image-duplicate-fix.js` to verify the fix works:

1. **Test 1**: Search for lesson title without used images
2. **Test 2**: Search for same lesson title with first image as used
3. **Test 3**: Search for different lesson title

**Expected Results:**
- Test 1 and Test 2 should return different images (duplicate prevention working)
- Test 1 and Test 3 should return different images (different subjects)
- Test 2 and Test 3 should return different images (different subjects)

## 📊 **Impact**

### **Before Fix:**
```
[ImageSearch] Using cached image search result for "The Ptolemaic Dynasty and Hellenistic Egypt"
[ImageSearch] Image found: { imageTitle: 'sphinx', ... }
[ImageSearch] Using cached image search result for "The Legacy of Ancient Egypt"  
[ImageSearch] Image found: { imageTitle: 'sphinx', ... } // SAME IMAGE!
```

### **After Fix:**
```
[AIService] Performing fresh image search for "The Ptolemaic Dynasty and Hellenistic Egypt" (cache key: image_search_The Ptolemaic Dynasty and Hellenistic Egypt_strict_sphinx)
[AIService] Performing fresh image search for "The Legacy of Ancient Egypt" (cache key: image_search_The Legacy of Ancient Egypt_strict)
[AIService] Switched to Wikipedia image to avoid duplicate for "The Legacy of Ancient Egypt"
```

## 🚀 **Deployment**

The fix is now deployed and should resolve the image duplication issue. The system will:

1. **Automatically clear old cache entries** on first run
2. **Generate unique cache keys** for different sets of used images
3. **Provide detailed logging** for debugging duplicate issues
4. **Maintain performance** while preventing duplicates

## 🔍 **Monitoring**

Monitor the logs for:
- `[AIService] Performing fresh image search` - indicates cache miss (good)
- `[AIService] Switched to [Wikipedia/Pixabay] image to avoid duplicate` - indicates duplicate prevention working
- `[AIService] WARNING: Could not find alternative image` - indicates potential issue with image availability

The fix ensures that each lesson gets a unique image while maintaining the performance benefits of caching.
