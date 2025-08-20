# Image Cultural Relevance Fixes

## Problem Identified
The image service was fetching culturally irrelevant images for historical courses. For example, Thor's hammer (Norse mythology) was being displayed for Ancient Egypt courses, which is completely inappropriate.

## Root Cause Analysis
1. **Insufficient cultural filtering**: The search phrase generation and image scoring didn't properly filter out culturally inappropriate terms
2. **Weak penalties**: Cultural mismatches weren't penalized heavily enough
3. **No minimum score threshold**: Images with low relevance scores were still being selected
4. **Generic search terms**: Search phrases weren't specific enough to the course context

## Fixes Implemented

### 1. Enhanced Cultural Mismatch Penalties (`server.js`)
- **Increased penalty from -500 to -1000** for cultural mismatches
- **Added Norse/Germanic terms** to the cultural mismatch lists for Egypt, Rome, and Greek courses
- **Added specific terms**: 'thor', 'hammer', 'mjolnir', 'nordic', 'scandinavian', 'germanic', 'north germanic'

### 2. Improved Search Phrase Filtering (`server.js`)
- **Added cultural query filtering**: Removes search queries that contain culturally inappropriate terms
- **Enhanced Egyptian-specific queries**: Added more specific terms like 'egyptian pharaoh', 'egyptian temple', 'egyptian tomb'
- **Added cultural specificity**: Terms like 'egyptian hieroglyphics', 'egyptian mummy', 'egyptian sphinx', 'egyptian obelisk', 'egyptian papyrus'

### 3. Minimum Score Threshold Implementation
- **Added 50-point minimum threshold** for historical content in both Wikipedia and Pixabay image services
- **Context-aware threshold**: Only applies to courses with historical themes
- **Rejection of low-scoring images**: Images below the threshold are rejected rather than selected

### 4. Enhanced Cultural Context Awareness
- **Improved course context passing**: Better integration of course title and subject into image scoring
- **Cultural civilization detection**: Automatically detects if a course is about Egypt, Rome, or Greece
- **Dynamic filtering**: Applies different filtering rules based on the detected civilization

## Technical Details

### Cultural Mismatch Detection
```javascript
const culturalMismatches = {
  'egypt': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'roman', 'greek', ...],
  'rome': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'egyptian', ...],
  'greek': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'egyptian', ...]
};
```

### Search Query Filtering
```javascript
// Filter out culturally inappropriate queries for history courses
if (isHistoryCourse) {
  const inappropriateTerms = {
    'egypt': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', ...],
    // ... other civilizations
  };
  // Filter queries based on civilization
}
```

### Minimum Score Threshold
```javascript
const minScoreThreshold = isHistoricalContent ? 50 : 0;
if (best.score >= minScoreThreshold) {
  // Accept image
} else {
  // Reject image
}
```

## Expected Results
1. **No more Norse artifacts** in Ancient Egypt courses
2. **Culturally appropriate images** for each historical civilization
3. **Higher quality image selection** with better relevance scores
4. **Improved user experience** with contextually correct visual content

## Testing Recommendations
1. Test Ancient Egypt courses to ensure no Norse/Greek/Roman artifacts appear
2. Test Roman courses to ensure no Egyptian/Norse artifacts appear
3. Test Greek courses to ensure no Egyptian/Norse artifacts appear
4. Verify that relevant cultural artifacts are still being selected
5. Check that the minimum score threshold doesn't prevent appropriate images from being selected

## Monitoring
- Watch console logs for cultural mismatch penalties
- Monitor image scoring to ensure thresholds are appropriate
- Track query filtering to ensure culturally inappropriate terms are being removed
