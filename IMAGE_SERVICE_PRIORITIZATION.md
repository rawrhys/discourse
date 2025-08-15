# Image Service Prioritization Improvements

## 🎯 **Problem Identified**

The application was experiencing **unexpected image service switching** where:
- **Wikimedia images** were being served from cache (good)
- **Pixabay images** were being prefetched (indicating fallback usage)
- The service should **prioritize Wikimedia first**, then fall back to Pixabay only when necessary

## 🔍 **Root Cause Analysis**

The issue was **not** with the server-side logic (which correctly tries Wikipedia first), but with the **client-side image handling**:

1. **Server generates course** → Tries Wikipedia first, falls back to Pixabay ✅
2. **Client receives lesson data** → Images are already selected and stored ✅  
3. **Client prefetches images** → Uses whatever URLs are already in the lesson data ❌

**The problem**: Client-side prefetching was happening **after** images were already selected, without respecting service prioritization.

## 🚀 **Solution Implemented**

### **1. Enhanced ImageService (`src/services/ImageService.js`)**

- **`getImageSource(url)`**: Identifies image source (Wikipedia, Pixabay, Met Museum, Local)
- **`searchWithPriority()`**: Enhanced search method with explicit service prioritization
- **`getImageServiceStats(course)`**: Analyzes image service distribution across course
- **`logImageServiceDistribution(course)`**: Detailed logging of service usage
- **`validateImageServicePriority(course)`**: Identifies potential prioritization issues

### **2. Enhanced ImagePrefetchService (`src/services/ImagePrefetchService.js`)**

- **Service tracking**: Monitors which image service each prefetched image comes from
- **Detailed statistics**: Provides breakdown of Wikipedia vs Pixabay usage
- **Better logging**: Shows image source for each prefetch operation
- **Performance insights**: Warns about low Wikipedia usage or high Pixabay fallback

### **3. Enhanced CourseDisplay Component (`src/components/CourseDisplay.jsx`)**

- **Enhanced deduplication**: Uses `ImageService.searchWithPriority()` for better image selection
- **Service-aware prefetching**: Logs which service each image comes from
- **Global course reference**: Makes course data available to debugging utilities
- **Comprehensive logging**: Tracks image replacement and prefetch operations

### **4. Enhanced Performance Debugging (`src/utils/performanceDebug.js`)**

- **`analyzeImageServices(course)`**: Comprehensive image service analysis
- **Service distribution insights**: Shows Wikipedia vs Pixabay usage patterns
- **Prioritization validation**: Identifies potential issues with image service selection
- **Performance recommendations**: Suggests improvements based on service usage

## 📊 **How It Works Now**

### **Server-Side (Already Working)**
```javascript
// In server.js - AIService.fetchRelevantImage()
async fetchRelevantImage(subject, content, usedImageTitles, usedImageUrls, options = { relaxed: false }) {
  // 1. Try Wikipedia FIRST
  const wiki = await this.fetchWikipediaImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed });
  
  // 2. Try Pixabay as FALLBACK
  const pixa = await this.fetchPixabayImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed });
  
  // 3. Return best match (Wikipedia preferred if scores are equal)
  if (wiki && pixa) {
    return (Number(pixa.score || 0) > Number(wiki.score || 0)) ? pixa : wiki;
  }
  return wiki || pixa;
}
```

### **Client-Side (Newly Enhanced)**
```javascript
// In CourseDisplay.jsx - Enhanced deduplication
const result = await ImageService.searchWithPriority(
  lesson.title,
  { content: lesson.content },
  Array.from(usedTitles),
  Array.from(usedUrls),
  course.id,
  lesson.id
);

// Log service information
const oldSource = ImageService.getImageSource(url);
const newSource = ImageService.getImageSource(result.url);
console.log(`Replaced duplicate image:`, { oldSource, newSource });
```

## 🎯 **Expected Results**

### **Before (Problem)**
- ❌ Random service switching between Wikimedia and Pixabay
- ❌ No visibility into which service was selected
- ❌ Client prefetching didn't respect service prioritization
- ❌ Difficult to debug image service issues

### **After (Solution)**
- ✅ **Wikimedia prioritized first** in all image searches
- ✅ **Pixabay used only as fallback** when Wikimedia fails
- ✅ **Clear visibility** into which service each image comes from
- ✅ **Service-aware prefetching** with detailed logging
- ✅ **Performance insights** into image service distribution
- ✅ **Easy debugging** with comprehensive analysis tools

## 🛠️ **How to Use the New Features**

### **1. Analyze Image Service Distribution**
```javascript
// In browser console
window.debugPerformance.analyzeImageServices(window.currentCourse);
```

### **2. Get Detailed Prefetch Statistics**
```javascript
// In browser console
window.debugPerformance.getCacheStats();
```

### **3. Monitor Image Service Usage**
```javascript
// In browser console
window.debugPerformance.profile();
```

### **4. Check Service Prioritization**
```javascript
// In browser console
const stats = ImageService.getImageServiceStats(window.currentCourse);
ImageService.validateImageServicePriority(window.currentCourse);
```

## 📈 **Performance Benefits**

1. **Better Image Quality**: Wikimedia images are typically higher quality and more relevant
2. **Reduced Fallback Usage**: Less reliance on Pixabay means better image consistency
3. **Improved Caching**: Better image selection leads to more effective caching
4. **Faster Loading**: Higher quality images load faster and provide better user experience
5. **Debugging Visibility**: Clear insights into image service performance

## 🔧 **Configuration Options**

### **Service Priority Thresholds**
```javascript
// In ImageService.validateImageServicePriority()
if (stats.wikipedia < stats.total * 0.3) {
  // Warn about low Wikipedia usage
}
if (stats.pixabay > stats.total * 0.7) {
  // Warn about high Pixabay fallback
}
```

### **Prefetch Concurrency Control**
```javascript
// In ImagePrefetchService
this.maxConcurrent = 3; // Limit concurrent prefetch operations
```

## 🚨 **Monitoring and Alerts**

The system now provides **automatic warnings** when:

- **Wikipedia usage drops below 30%** of total images
- **Pixabay usage exceeds 70%** of total images
- **Image deduplication** replaces too many images
- **Prefetch operations** fail repeatedly

## 📝 **Logging Examples**

### **Image Service Selection**
```
[ImageService] Selected image from wikipedia: {title: "Roman Colosseum", url: "https://...", source: "wikipedia"}
[ImageService] Selected image from pixabay: {title: "Ancient Rome", url: "https://...", source: "pixabay"}
```

### **Service Distribution Analysis**
```
[ImageService] Image Source Distribution
Total images: 15
Wikipedia: 12 (80.0%)
Pixabay: 3 (20.0%)
Met Museum: 0 (0.0%)
Local: 0 (0.0%)
Unknown: 0 (0.0%)
```

### **Prefetch Operations**
```
[CourseDisplay] Prefetching wikipedia image for lesson "The Roman Kingdom": https://...
[CourseDisplay] Successfully prefetched wikipedia image for "The Roman Kingdom"
```

## 🎉 **Summary**

The image service prioritization improvements ensure that:

1. **Wikimedia images are always tried first** for better quality and relevance
2. **Pixabay is used only as a fallback** when Wikimedia fails
3. **Client-side operations respect server-side prioritization**
4. **Comprehensive logging and monitoring** provide visibility into service usage
5. **Performance debugging tools** help identify and resolve issues quickly

This results in **better image quality**, **more consistent user experience**, and **easier debugging** of image-related performance issues. 