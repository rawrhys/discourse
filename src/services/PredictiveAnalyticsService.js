class PredictiveAnalyticsService {
  constructor() {
    this.userPatterns = new Map();
    this.navigationHistory = [];
    this.predictionModel = {
      weights: {
        recency: 0.4,
        frequency: 0.3,
        context: 0.2,
        userBehavior: 0.1
      },
      thresholds: {
        confidence: 0.6,
        minOccurrences: 2
      }
    };
    this.maxHistorySize = 100;
    this.analyticsData = {
      predictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      patterns: new Map()
    };
  }

  /**
   * Record user navigation
   */
  recordNavigation(fromLesson, toLesson, context = {}) {
    const navigation = {
      from: fromLesson,
      to: toLesson,
      timestamp: Date.now(),
      context: {
        timeSpent: context.timeSpent || 0,
        scrollDepth: context.scrollDepth || 0,
        interactions: context.interactions || 0,
        ...context
      }
    };

    this.navigationHistory.push(navigation);

    // Keep history size manageable
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }

    // Update user patterns
    this.updateUserPatterns(navigation);
  }

  /**
   * Update user navigation patterns
   */
  updateUserPatterns(navigation) {
    const patternKey = `${navigation.from}->${navigation.to}`;
    const existing = this.userPatterns.get(patternKey) || {
      count: 0,
      totalTime: 0,
      contexts: [],
      lastUsed: 0
    };

    existing.count++;
    existing.totalTime += navigation.context.timeSpent;
    existing.contexts.push(navigation.context);
    existing.lastUsed = navigation.timestamp;

    // Keep only recent contexts
    if (existing.contexts.length > 10) {
      existing.contexts = existing.contexts.slice(-10);
    }

    this.userPatterns.set(patternKey, existing);
  }

  /**
   * Predict next likely lessons based on current lesson
   */
  predictNextLessons(currentLesson, moduleId, courseId, limit = 5) {
    const predictions = [];
    const now = Date.now();
    const timeDecay = 24 * 60 * 60 * 1000; // 24 hours

    // Get all patterns from current lesson
    for (const [pattern, data] of this.userPatterns.entries()) {
      if (pattern.startsWith(`${currentLesson}->`)) {
        const targetLesson = pattern.split('->')[1];
        const confidence = this.calculateConfidence(data, now, timeDecay);
        
        if (confidence > this.predictionModel.thresholds.confidence) {
          predictions.push({
            lesson: targetLesson,
            confidence,
            pattern: data
          });
        }
      }
    }

    // Sort by confidence and return top predictions
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
      .map(p => ({
        lesson: p.lesson,
        confidence: p.confidence,
        reason: this.getPredictionReason(p.pattern)
      }));
  }

  /**
   * Calculate confidence score for a prediction
   */
  calculateConfidence(patternData, currentTime, timeDecay) {
    const { weights } = this.predictionModel;
    
    // Recency score (0-1)
    const timeSinceLastUse = currentTime - patternData.lastUsed;
    const recencyScore = Math.max(0, 1 - (timeSinceLastUse / timeDecay));

    // Frequency score (0-1)
    const frequencyScore = Math.min(1, patternData.count / 10);

    // Context similarity score (0-1)
    const contextScore = this.calculateContextSimilarity(patternData.contexts);

    // User behavior score (0-1)
    const behaviorScore = this.calculateBehaviorScore(patternData);

    // Weighted combination
    const confidence = 
      weights.recency * recencyScore +
      weights.frequency * frequencyScore +
      weights.context * contextScore +
      weights.userBehavior * behaviorScore;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Calculate context similarity score
   */
  calculateContextSimilarity(contexts) {
    if (contexts.length < 2) return 0.5;

    const recentContexts = contexts.slice(-5);
    const avgTimeSpent = recentContexts.reduce((sum, ctx) => sum + ctx.timeSpent, 0) / recentContexts.length;
    const avgScrollDepth = recentContexts.reduce((sum, ctx) => sum + ctx.scrollDepth, 0) / recentContexts.length;

    // Calculate variance (lower variance = higher similarity)
    const timeVariance = recentContexts.reduce((sum, ctx) => sum + Math.pow(ctx.timeSpent - avgTimeSpent, 2), 0) / recentContexts.length;
    const scrollVariance = recentContexts.reduce((sum, ctx) => sum + Math.pow(ctx.scrollDepth - avgScrollDepth, 2), 0) / recentContexts.length;

    const normalizedTimeVariance = Math.min(1, timeVariance / 1000000); // Normalize to 0-1
    const normalizedScrollVariance = Math.min(1, scrollVariance / 10000);

    return 1 - ((normalizedTimeVariance + normalizedScrollVariance) / 2);
  }

  /**
   * Calculate behavior score based on user interaction patterns
   */
  calculateBehaviorScore(patternData) {
    const recentContexts = patternData.contexts.slice(-5);
    const avgInteractions = recentContexts.reduce((sum, ctx) => sum + ctx.interactions, 0) / recentContexts.length;
    
    // Higher interaction rate suggests more engagement
    return Math.min(1, avgInteractions / 10);
  }

  /**
   * Get human-readable reason for prediction
   */
  getPredictionReason(patternData) {
    const reasons = [];
    
    if (patternData.count >= 5) {
      reasons.push('Frequently visited');
    } else if (patternData.count >= 2) {
      reasons.push('Occasionally visited');
    }

    const avgTime = patternData.totalTime / patternData.count;
    if (avgTime > 60000) { // More than 1 minute
      reasons.push('High engagement');
    }

    const timeSinceLastUse = Date.now() - patternData.lastUsed;
    if (timeSinceLastUse < 3600000) { // Less than 1 hour
      reasons.push('Recently accessed');
    }

    return reasons.join(', ') || 'Based on navigation patterns';
  }

  /**
   * Record prediction accuracy
   */
  recordPredictionAccuracy(predictedLesson, actualLesson) {
    this.analyticsData.predictions++;
    
    if (predictedLesson === actualLesson) {
      this.analyticsData.correctPredictions++;
    }

    this.analyticsData.accuracy = this.analyticsData.correctPredictions / this.analyticsData.predictions;
  }

  /**
   * Get analytics data
   */
  getAnalytics() {
    return {
      ...this.analyticsData,
      totalPatterns: this.userPatterns.size,
      historySize: this.navigationHistory.length,
      recentPredictions: this.getRecentPredictions()
    };
  }

  /**
   * Get recent predictions for analysis
   */
  getRecentPredictions() {
    const recent = this.navigationHistory.slice(-10);
    return recent.map(nav => ({
      from: nav.from,
      to: nav.to,
      timestamp: nav.timestamp,
      timeSpent: nav.context.timeSpent
    }));
  }

  /**
   * Get prediction recommendations for preloading
   */
  getPreloadRecommendations(currentLesson, moduleId, courseId) {
    const predictions = this.predictNextLessons(currentLesson, moduleId, courseId, 3);
    
    return predictions.map(pred => ({
      lessonId: pred.lesson,
      priority: this.getPriority(pred.confidence),
      confidence: pred.confidence,
      reason: pred.reason
    }));
  }

  /**
   * Get priority level based on confidence
   */
  getPriority(confidence) {
    if (confidence > 0.8) return 'high';
    if (confidence > 0.6) return 'medium';
    return 'low';
  }

  /**
   * Clear old data to prevent memory bloat
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - (7 * 24 * 60 * 60 * 1000); // 7 days

    // Clean up old navigation history
    this.navigationHistory = this.navigationHistory.filter(nav => nav.timestamp > cutoff);

    // Clean up old patterns
    for (const [pattern, data] of this.userPatterns.entries()) {
      if (data.lastUsed < cutoff && data.count < 3) {
        this.userPatterns.delete(pattern);
      }
    }

    console.log('[PredictiveAnalyticsService] Cleanup completed');
  }

  /**
   * Export analytics data for debugging
   */
  exportData() {
    return {
      userPatterns: Object.fromEntries(this.userPatterns),
      navigationHistory: this.navigationHistory,
      analytics: this.getAnalytics(),
      model: this.predictionModel
    };
  }

  /**
   * Import analytics data
   */
  importData(data) {
    if (data.userPatterns) {
      this.userPatterns = new Map(Object.entries(data.userPatterns));
    }
    if (data.navigationHistory) {
      this.navigationHistory = data.navigationHistory;
    }
    if (data.analytics) {
      this.analyticsData = { ...this.analyticsData, ...data.analytics };
    }
  }

  /**
   * Reset all data
   */
  reset() {
    this.userPatterns.clear();
    this.navigationHistory = [];
    this.analyticsData = {
      predictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      patterns: new Map()
    };
  }
}

// Export singleton instance
const predictiveAnalyticsService = new PredictiveAnalyticsService();

// Start cleanup interval
setInterval(() => {
  predictiveAnalyticsService.cleanup();
}, 24 * 60 * 60 * 1000); // Daily cleanup

export default predictiveAnalyticsService;
