import React, { memo, useState } from 'react';
import markdownService from '../services/MarkdownService';

/**
 * Academic References Footer Component
 * Displays academic references with proper citation formatting and styling in an accordion format
 */
const AcademicReferencesFooter = memo(({ references, onCitationClick, isLoading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Debug logging
  console.log('[AcademicReferencesFooter] Component rendered with:', {
    hasReferences: !!references,
    referencesCount: references?.length || 0,
    references: references,
    isLoading: isLoading
  });

  if (isLoading) {
    return (
      <footer className="academic-references-footer mt-12 pt-8 border-t-2 border-gray-300 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="academic-references-header w-full text-left text-2xl font-bold text-black mb-6 flex items-center justify-between p-3 rounded-lg">
            <span style={{ color: '#000000 !important', fontWeight: 'bold' }}>Academic References</span>
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Generating authentic references...</span>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  if (!references || references.length === 0) {
    console.log('[AcademicReferencesFooter] No references provided, showing debug message');
    return (
      <footer className="academic-references-footer mt-12 pt-8 border-t-2 border-gray-300 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="academic-references-header w-full text-left text-2xl font-bold text-black mb-6 flex items-center justify-between hover:bg-gray-100 p-3 rounded-lg transition-colors duration-200"
            style={{ color: '#000000 !important' }}
          >
            <span style={{ color: '#000000 !important', fontWeight: 'bold' }}>Academic References</span>
            <svg
              className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: '#000000' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div className={`academic-references-list space-y-4 transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="citation-item bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-center text-gray-600">
                <p className="font-semibold mb-2">No academic references available for this lesson.</p>
                <p className="text-sm mb-2">References are generated dynamically based on lesson content.</p>
                <p className="text-sm mb-3">If you're seeing this message, the AI reference generation may need to be configured.</p>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-left">
                  <p className="text-sm font-medium text-blue-800 mb-2">Troubleshooting:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Check if the AI service is properly configured</li>
                    <li>• Verify the lesson has sufficient content (100+ characters)</li>
                    <li>• Check browser console for error messages</li>
                    <li>• Ensure you're authenticated and have proper permissions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  const handleCitationClick = (referenceId) => {
    if (onCitationClick && typeof onCitationClick === 'function') {
      onCitationClick(referenceId);
    }
  };

  const formatCitationText = (citation) => {
    try {
      // Use markdown service to properly format the citation
      return markdownService.parse(citation);
    } catch (error) {
      console.warn('[AcademicReferencesFooter] Error formatting citation:', error);
      return citation;
    }
  };

  return (
    <footer className="academic-references-footer mt-12 pt-8 border-t-2 border-gray-300 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="academic-references-header w-full text-left text-2xl font-bold text-black mb-6 flex items-center justify-between hover:bg-gray-100 p-3 rounded-lg transition-colors duration-200"
          style={{ color: '#000000 !important' }}
        >
          <span style={{ color: '#000000 !important', fontWeight: 'bold' }}>Academic References</span>
          <svg
            className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: '#000000' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className={`academic-references-list space-y-4 transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {references.map((ref) => (
            <div 
              key={ref.id} 
              className="citation-item bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start">
                <span 
                  className="citation-number inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white text-sm font-bold rounded-full mr-4 mt-1 cursor-pointer hover:bg-blue-700 transition-colors duration-200"
                  onClick={() => handleCitationClick(ref.id)}
                  title="Click to highlight citations in text"
                >
                  {ref.id}
                </span>
                
                <div 
                  className="citation-text flex-1 text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: formatCitationText(ref.citation) 
                  }}
                />
              </div>
              
              {/* Citation type indicator */}
              <div className="mt-2 ml-12">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  {ref.type || 'Academic Source'}
                </span>
              </div>
            </div>
          ))}
          
          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});

AcademicReferencesFooter.displayName = 'AcademicReferencesFooter';

export default AcademicReferencesFooter;
