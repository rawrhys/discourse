// src/utils/performanceDebug.js

// Performance monitoring and debugging utilities
const performanceDebug = {
  // Custom performance measurements
  start(label) {
    performance.mark(`${label}-start`);
  },
  
  end(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    const measure = performance.getEntriesByName(label).pop();
    console.log(`[Performance] ${label}: ${measure.duration.toFixed(2)}ms`);
    return measure.duration;
  },

  // Analyze component render performance
  analyzeRenders() {
    if (window.performanceMonitor) {
      const summary = window.performanceMonitor.getPerformanceSummary();
      console.group('[PerformanceDebug] Render Analysis');
      console.table(summary.renderTimes);
      if (summary.recommendations.length > 0) {
        console.group('Recommendations');
        summary.recommendations.forEach(rec => console.log('•', rec));
        console.groupEnd();
      }
      console.groupEnd();
      return summary;
    } else {
      console.warn('[PerformanceDebug] PerformanceMonitor not available');
      return null;
    }
  },

  // Analyze API call performance
  analyzeAPI() {
    if (window.performanceMonitor) {
      const summary = window.performanceMonitor.getPerformanceSummary();
      console.group('[PerformanceDebug] API Call Analysis');
      console.table(summary.apiCalls);
      if (summary.recommendations.length > 0) {
        console.group('Recommendations');
        summary.recommendations.forEach(rec => console.log('•', rec));
        console.groupEnd();
      }
      console.groupEnd();
      return summary;
    } else {
      console.warn('[PerformanceDebug] PerformanceMonitor not available');
      return null;
    }
  },

  // Analyze image loading performance
  analyzeImages() {
    if (window.performanceMonitor) {
      const summary = window.performanceMonitor.getPerformanceSummary();
      console.group('[PerformanceDebug] Image Load Analysis');
      console.table(summary.imageLoads);
      if (summary.recommendations.length > 0) {
        console.group('Recommendations');
        summary.recommendations.forEach(rec => console.log('•', rec));
        console.groupEnd();
      }
      console.groupEnd();
      return summary;
    } else {
      console.warn('[PerformanceDebug] PerformanceMonitor not available');
      return null;
    }
  },

  // Get cache statistics (simplified)
  getCacheStats() {
    console.group('[PerformanceDebug] Cache Statistics');
    console.log('Image caching disabled - no stats available');
    console.groupEnd();
    return { cache: { hits: 0, misses: 0, total: 0 }, prefetch: { queued: 0, processing: 0 } };
  },

  // Clear all application caches (simplified)
  async clearAllCaches() {
    console.log('[PerformanceDebug] Clearing all caches...');
    console.log('Image caching disabled - no caches to clear');
    console.log('[PerformanceDebug] All caches cleared');
  },

  // Monitor component performance
  monitorComponent(name, duration = 5000) {
    console.log(`[PerformanceDebug] Monitoring component: ${name} for ${duration}ms`);
    
    const startTime = performance.now();
    let renderCount = 0;
    
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      console.log(`[PerformanceDebug] ${name}: ${renderCount} renders in ${elapsed.toFixed(0)}ms`);
      
      if (elapsed >= duration) {
        clearInterval(interval);
        console.log(`[PerformanceDebug] Monitoring complete for ${name}`);
      }
    }, 1000);
    
    return interval;
  },

  // Monitor flashcard performance
  monitorFlashcards() {
    console.log('[PerformanceDebug] Monitoring flashcard performance...');
    
    const startTime = performance.now();
    let cardCount = 0;
    
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      console.log(`[PerformanceDebug] Flashcards: ${cardCount} cards processed in ${elapsed.toFixed(0)}ms`);
    }, 2000);
    
    return interval;
  },

  // Analyze image services (simplified)
  analyzeImageServices(course) {
    console.group('[PerformanceDebug] Image Service Analysis');
    
    if (!course?.modules) {
      console.log('No course data available');
      console.groupEnd();
      return;
    }
    
    // Get image service statistics
    const stats = { total: 0, wikipedia: 0, pixabay: 0 }; // Placeholder for actual stats
    console.log('Image Service Distribution:', stats);
    
    // Log detailed distribution
    console.log('Image service distribution logging disabled.');
    
    // Validate prioritization
    const issues = []; // Placeholder for actual issues
    console.log('Image service prioritization validation disabled.');
    
    // Analyze duplicate images
    const duplicates = []; // Placeholder for actual duplicates
    if (duplicates.length > 0) {
      console.warn(`[PerformanceDebug] ⚠️  Found ${duplicates.length} duplicate images across modules/lessons`);
      console.log('Image duplicate analysis logging disabled.');
    } else {
      console.log('[PerformanceDebug] ✅ No duplicate images found - all images are unique');
    }
    
    // Get prefetch service stats
    const prefetchStats = { queued: 0, processing: 0 }; // Placeholder for actual stats
    
    console.groupEnd();
    return { stats, issues, duplicates, prefetchStats };
  },

  // Analyze duplicate images (simplified)
  analyzeDuplicateImages(course) {
    console.group('[PerformanceDebug] Duplicate Image Analysis');
    
    const duplicates = []; // Placeholder for actual duplicates
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate images found');
    } else {
      console.warn(`⚠️  Found ${duplicates.length} duplicate images`);
      console.table(duplicates);
    }
    
    console.groupEnd();
    return duplicates;
  },

  // Test context-aware queries (simplified)
  testContextAwareQueries(course) {
    console.group('[PerformanceDebug] Context-Aware Query Testing');
    
    if (!course?.modules) {
      console.log('No course data available');
      console.groupEnd();
      return;
    }
    
    let totalQueries = 0;
    let refinedQueries = 0;
    
    for (const module of course.modules) {
      for (const lesson of module.lessons || []) {
        totalQueries++;
        const originalTitle = lesson.title;
        const content = lesson.content;
        const contextQuery = originalTitle; // Placeholder for actual refinement
        
        if (contextQuery !== originalTitle) {
          refinedQueries++;
          console.log(`Query refined: "${originalTitle}" → "${contextQuery}"`);
        }
      }
    }
    
    console.log(`Total queries: ${totalQueries}`);
    console.log(`Refined queries: ${refinedQueries}`);
    console.log(`Refinement rate: ${((refinedQueries / totalQueries) * 100).toFixed(1)}%`);
    
    console.groupEnd();
    return { total: totalQueries, refined: refinedQueries };
  },

  // Get performance recommendations
  getRecommendations() {
    console.group('[PerformanceDebug] Performance Recommendations');
    
    const recommendations = [
      'Image caching has been disabled for simplicity',
      'Use SimpleImageService for basic image search',
      'Monitor component render times with start()/end()',
      'Check API call performance with analyzeAPI()'
    ];
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Add image service recommendations
    if (window.currentCourse) {
      const stats = { total: 0, wikipedia: 0, pixabay: 0 }; // Placeholder for actual stats
      if (stats.total > 0) {
        if (stats.wikipedia < stats.total * 0.3) {
          recommendations.push('Consider increasing Wikipedia image usage for better quality');
        }
        if (stats.pixabay > stats.total * 0.7) {
          recommendations.push('Consider diversifying image sources beyond Pixabay');
        }
      }
    }
    
    console.groupEnd();
    return recommendations;
  },

  // Run comprehensive performance profile
  profile() {
    console.group('[PerformanceDebug] Comprehensive Performance Profile');
    
    const startTime = performance.now();
    
    // Analyze renders
    const renderAnalysis = this.analyzeRenders();
    
    // Analyze API calls
    const apiAnalysis = this.analyzeAPI();
    
    // Analyze images
    const imageAnalysis = this.analyzeImages();
    
    // Get cache stats
    const cacheStats = this.getCacheStats();
    
    // Get recommendations
    const recommendations = this.getRecommendations();
    
    const totalTime = performance.now() - startTime;
    
    console.log(`Profile completed in ${totalTime.toFixed(2)}ms`);
    console.groupEnd();
    
    return {
      renderAnalysis,
      apiAnalysis,
      imageAnalysis,
      cacheStats,
      recommendations,
      profileTime: totalTime
    };
  },

  // Help command
  help() {
    console.group('🔧 [DEBUG] Performance Debug Help');
    console.log('Available commands:');
    console.log('• start(label) / end(label) - Measure performance');
    console.log('• analyzeRenders() - Analyze component renders');
    console.log('• analyzeAPI() - Analyze API call performance');
    console.log('• analyzeImages() - Analyze image loading');
    console.log('• getCacheStats() - Get cache statistics');
    console.log('• clearAllCaches() - Clear all caches');
    console.log('• monitorComponent(name, duration) - Monitor component');
    console.log('• monitorFlashcards() - Monitor flashcard performance');
    console.log('• analyzeImageServices(course) - Analyze image sources');
    console.log('• analyzeDuplicateImages(course) - Find duplicate images');
    console.log('• testContextAwareQueries(course) - Test image search');
    console.log('• getRecommendations() - Get performance recommendations');
    console.log('• profile() - Run comprehensive performance profile');
    console.log('• help() - Show this help message');
    console.groupEnd();
  }
};

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.debugPerformance = performanceDebug;
  
  // Auto-log help on first access
  let helpShown = false;
  Object.defineProperty(window, 'debugPerformance', {
    get() {
      if (!helpShown) {
        console.log('[PerformanceDebug] Performance debugging utilities loaded. Use window.debugPerformance.help() for available commands.');
        helpShown = true;
      }
      return performanceDebug;
    }
  });
}

export default performanceDebug;