import React, { memo } from 'react';
import markdownService from '../services/MarkdownService';

/**
 * Academic References Footer Component
 * Displays academic references with proper citation formatting and styling
 */
const AcademicReferencesFooter = memo(({ references, onCitationClick }) => {
  if (!references || references.length === 0) {
    return null;
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
        <h2 className="academic-references-header text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <span className="mr-3">📚</span>
          Academic References
        </h2>
        
        <div className="academic-references-list space-y-4">
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
        </div>
        
        {/* Footer note */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            References follow academic citation standards. Click citation numbers to highlight related content in the text.
          </p>
        </div>
      </div>
    </footer>
  );
});

AcademicReferencesFooter.displayName = 'AcademicReferencesFooter';

export default AcademicReferencesFooter;
