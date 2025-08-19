import React, { useState, useEffect, useCallback } from 'react';
import imagePerformanceMonitor from '../services/ImagePerformanceMonitor';

const PerformanceDashboard = ({ isVisible = false, onClose }) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update performance data every 2 seconds
  const updatePerformanceData = useCallback(() => {
    const stats = imagePerformanceMonitor.getPerformanceStats();
    const suggestions = imagePerformanceMonitor.getOptimizationSuggestions();
    const slowImages = imagePerformanceMonitor.getSlowImages().slice(0, 5);
    
    setPerformanceData({
      stats,
      suggestions,
      slowImages,
      timestamp: new Date().toISOString()
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Initial update
    updatePerformanceData();

    // Set up interval for updates
    const interval = setInterval(updatePerformanceData, 2000);

    return () => clearInterval(interval);
  }, [isVisible, updatePerformanceData]);

  if (!isVisible) return null;

  const getStatusColor = (value, threshold) => {
    if (value <= threshold * 0.7) return 'text-green-600';
    if (value <= threshold) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (value, threshold) => {
    if (value <= threshold * 0.7) return '🟢';
    if (value <= threshold) return '🟡';
    return '🔴';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`bg-white border border-gray-300 rounded-lg shadow-lg transition-all duration-300 ${
        isExpanded ? 'w-96 h-96' : 'w-80 h-64'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            Performance Monitor
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '📉' : '📊'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-full">
          {performanceData ? (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Avg Load Time</div>
                  <div className={`text-lg font-semibold ${getStatusColor(performanceData.stats.averageLoadTime, 1000)}`}>
                    {getStatusIcon(performanceData.stats.averageLoadTime, 1000)} {performanceData.stats.averageLoadTime}ms
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Slow Images</div>
                  <div className={`text-lg font-semibold ${getStatusColor(performanceData.stats.slowImages, 5)}`}>
                    {getStatusIcon(performanceData.stats.slowImages, 5)} {performanceData.stats.slowImages}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Total Images</div>
                  <div className="text-lg font-semibold text-blue-600">
                    📊 {performanceData.stats.totalImages}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Slow %</div>
                  <div className={`text-lg font-semibold ${getStatusColor(performanceData.stats.slowPercentage, 20)}`}>
                    {getStatusIcon(performanceData.stats.slowPercentage, 20)} {performanceData.stats.slowPercentage}%
                  </div>
                </div>
              </div>

              {/* Render Performance */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600 mb-2">Render Performance</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Avg Render:</span>
                    <span className={`ml-1 font-semibold ${getStatusColor(performanceData.stats.averageRenderTime, 500)}`}>
                      {performanceData.stats.averageRenderTime}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Slow Renders:</span>
                    <span className={`ml-1 font-semibold ${getStatusColor(performanceData.stats.slowRenders, 2)}`}>
                      {performanceData.stats.slowRenders}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              {performanceData.suggestions.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                  <div className="text-sm font-semibold text-yellow-800 mb-2">Optimization Suggestions</div>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {performanceData.suggestions.slice(0, 3).map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Slow Images (expanded view) */}
              {isExpanded && performanceData.slowImages.length > 0 && (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <div className="text-sm font-semibold text-red-800 mb-2">Slow Images</div>
                  <div className="space-y-2">
                    {performanceData.slowImages.map((img, index) => (
                      <div key={index} className="text-xs">
                        <div className="text-red-700 font-medium truncate">
                          {new URL(img.url).hostname}
                        </div>
                        <div className="text-red-600">
                          {img.loadTime.toFixed(0)}ms • {img.size > 0 ? `${(img.size / 1024).toFixed(1)}KB` : 'Unknown size'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="text-xs text-gray-500 text-center">
                Last updated: {new Date(performanceData.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading performance data...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
