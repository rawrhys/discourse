# Music Image Service

## Overview
The `MusicImageService` is a specialized image service designed specifically for music-related topics. It ensures highly relevant images for music history, theory, instruments, and cultural content by using curated search terms and music-specific filtering.

## Features

### 🎵 **Music Category Detection**
Automatically detects the type of music content:
- **Classical/Orchestral**: orchestra, symphony, conductor, violin, piano, etc.
- **Jazz**: jazz band, saxophone, improvisation, swing, bebop, etc.
- **Rock/Pop**: electric guitar, rock band, concert, stage, etc.
- **Folk/Traditional**: acoustic guitar, banjo, traditional music, etc.
- **Electronic/Digital**: synthesizer, DJ equipment, music production, etc.
- **Historical/Period**: medieval, renaissance, baroque, classical period, etc.
- **Cultural/World**: African, Asian, Latin, Middle Eastern, Indian, etc.

### 🔍 **Intelligent Search Queries**
Generates music-specific search queries that combine:
- Original lesson title
- Category-specific terms
- Instrument mentions
- Period/style references
- General music vocabulary

### 🎯 **Relevance Filtering**
- **Music-specific filtering**: Only returns images with music-related content
- **Category matching**: Ensures images match the detected music category
- **Instrument relevance**: Prioritizes images showing relevant instruments
- **Cultural accuracy**: Maintains cultural context for world music topics

### 💾 **Smart Caching**
- 30-minute cache timeout
- 100-item cache limit
- Music-specific cache keys
- Automatic cache cleanup

## Usage

### Basic Usage
```javascript
import musicImageService from './services/MusicImageService.js';

// Search for music images
const image = await musicImageService.searchMusicImages(
  'Jazz Improvisation Techniques',
  'course123',
  'lesson456',
  [], // usedImageTitles
  []  // usedImageUrls
);
```

### Integration with SimpleImageService
The `SimpleImageService` automatically detects music content and routes to `MusicImageService`:

```javascript
import SimpleImageService from './services/SimpleImageService.js';

// Automatically uses MusicImageService for music content
const image = await SimpleImageService.search(
  'The History of Jazz',
  'course123',
  'lesson456'
);
```

## API Endpoints

### Server-Side Integration
The service integrates with the main image search API:

```javascript
// POST /api/image-search/search
{
  "lessonTitle": "Jazz Improvisation",
  "content": "Music lesson about Jazz Improvisation. Category: jazz",
  "musicContext": true,
  "musicCategory": "jazz",
  "courseId": "course123",
  "lessonId": "lesson456"
}
```

### Music-Specific Headers
- `musicContext: true` - Enables music-specific processing
- `musicCategory: "jazz"` - Specifies music category for better results

## Search Strategy

### 1. **Primary Search** (Main API)
- Uses the main image search API with music context
- Enhanced search phrases for music relevance
- Category-specific query generation

### 2. **Fallback Search** (Pixabay)
- Direct Pixabay search with music terms
- Enhanced queries: `"music jazz improvisation"`
- Filters results for music relevance

### 3. **Curated Fallbacks**
- Category-specific fallback images
- High-quality Unsplash images
- Guaranteed music-relevant content

## Example Search Queries

### Classical Music
- "orchestra symphony"
- "classical music conductor"
- "violin concerto"
- "piano sonata"

### Jazz
- "jazz music saxophone"
- "jazz band performance"
- "improvisation jazz"
- "swing music"

### Rock/Pop
- "rock music electric guitar"
- "rock band concert"
- "stage performance"
- "music festival"

## Configuration

### Environment Variables
```bash
PIXABAY_API_KEY=your_pixabay_api_key
```

### Cache Settings
```javascript
cacheTimeout: 30 * 60 * 1000, // 30 minutes
maxCacheSize: 100              // 100 items
```

## Performance

### Search Timeouts
- **Main API**: 15 seconds
- **Pixabay Fallback**: 10 seconds
- **Cache Lookup**: < 1ms

### Cache Performance
- **Hit Rate**: Typically 60-80% for repeated searches
- **Memory Usage**: ~2-5MB for 100 cached images
- **Cleanup**: Automatic LRU eviction

## Error Handling

### Graceful Degradation
1. **API Failure**: Falls back to Pixabay search
2. **Pixabay Failure**: Returns curated fallback images
3. **Network Issues**: Uses cached results when available
4. **No Results**: Returns category-specific fallback

### Logging
Comprehensive logging for debugging:
```javascript
[MusicImageService] Searching for music image: Jazz Improvisation
[MusicImageService] Detected music category: jazz
[MusicImageService] Generated search queries: ["Jazz Improvisation", "jazz music", "improvisation"]
[MusicImageService] Found music image via API: Jazz Band Performance
```

## Benefits

### 🎯 **Relevance**
- No more irrelevant images for music topics
- Category-specific image selection
- Cultural accuracy for world music

### 🚀 **Performance**
- Faster music-specific searches
- Intelligent caching
- Reduced API calls

### 🎵 **Quality**
- Curated music vocabulary
- Instrument-specific matching
- Period-appropriate content

### 🔧 **Maintainability**
- Dedicated music service
- Easy to extend for new categories
- Clear separation of concerns

## Future Enhancements

### Planned Features
- **Genre-specific filtering**: More granular music categories
- **Instrument recognition**: AI-powered instrument detection
- **Period accuracy**: Historical period matching
- **Cultural sensitivity**: Enhanced world music support

### Integration Opportunities
- **Spotify API**: Real-time music data
- **MusicBrainz**: Comprehensive music database
- **Last.fm**: Music tagging and categorization
- **YouTube Music**: Video content integration

## Troubleshooting

### Common Issues

#### 1. **No Music Images Found**
- Check if content is detected as music-related
- Verify music category detection
- Ensure fallback images are accessible

#### 2. **Irrelevant Results**
- Review music category detection
- Check search query generation
- Verify music context flags

#### 3. **Performance Issues**
- Monitor cache hit rates
- Check API response times
- Review fallback search performance

### Debug Commands
```javascript
// Check cache statistics
console.log(musicImageService.getCacheStats());

// Clear cache
musicImageService.clearCache();

// Force music detection
const category = musicImageService.detectMusicCategory('Jazz History');
console.log('Detected category:', category);
```

## Contributing

### Adding New Music Categories
1. Add category terms to `musicCategories` object
2. Include relevant fallback images
3. Update detection logic if needed
4. Add tests for new categories

### Improving Search Queries
1. Review `generateMusicSearchQueries` method
2. Add new music vocabulary
3. Test with various music topics
4. Validate relevance improvements

## License
This service is part of the Discourse AI project and follows the same licensing terms.
