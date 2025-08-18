/**
 * Content Formatter Utility
 * Handles robust formatting of lesson content, including fixing malformed JSON
 */

/**
 * Fixes malformed JSON content by handling common issues
 * @param {string} content - The potentially malformed content
 * @returns {object} - Properly formatted content object
 */
export const fixMalformedContent = (content) => {
  if (!content) return { introduction: '', main_content: '', conclusion: '' };

  // If content is already an object, return it
  if (typeof content === 'object' && content !== null) {
    return {
      introduction: content.introduction || '',
      main_content: content.main_content || content.content || '',
      conclusion: content.conclusion || ''
    };
  }

  // If content is a string, try to parse it as JSON first
  if (typeof content === 'string') {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      return {
        introduction: parsed.introduction || '',
        main_content: parsed.main_content || parsed.content || '',
        conclusion: parsed.conclusion || ''
      };
    } catch (e) {
      // If JSON parsing fails, try to extract content from malformed string
      return extractContentFromMalformedString(content);
    }
  }

  return { introduction: '', main_content: '', conclusion: '' };
};

/**
 * Extracts content from malformed JSON strings
 * @param {string} malformedContent - The malformed content string
 * @returns {object} - Properly formatted content object
 */
const extractContentFromMalformedString = (malformedContent) => {
  const result = {
    introduction: '',
    main_content: '',
    conclusion: ''
  };

  try {
    // Handle common malformed JSON patterns
    let cleanedContent = malformedContent;

    // Fix missing quotes around property names
    cleanedContent = cleanedContent.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    
    // Fix missing quotes around string values
    cleanedContent = cleanedContent.replace(/:\s*([^"][^,}]*[^",}\s])\s*([,}])/g, ': "$1"$2');
    
    // Fix escaped newlines that should be actual newlines
    cleanedContent = cleanedContent.replace(/\\n\\n/g, '\n\n');
    cleanedContent = cleanedContent.replace(/\\n/g, '\n');
    
    // Fix double escaped quotes
    cleanedContent = cleanedContent.replace(/\\"/g, '"');
    
    // Try to parse the cleaned content
    const parsed = JSON.parse(cleanedContent);
    
    result.introduction = parsed.introduction || '';
    result.main_content = parsed.main_content || parsed.content || '';
    result.conclusion = parsed.conclusion || '';
    
  } catch (e) {
    // If all else fails, try regex extraction
    result.introduction = extractSection(malformedContent, 'introduction');
    result.main_content = extractSection(malformedContent, 'main_content');
    result.conclusion = extractSection(malformedContent, 'conclusion');
  }

  return result;
};

/**
 * Extracts a specific section from malformed content using regex
 * @param {string} content - The content to search in
 * @param {string} sectionName - The section name to extract
 * @returns {string} - The extracted section content
 */
const extractSection = (content, sectionName) => {
  const patterns = [
    new RegExp(`"${sectionName}"\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`"${sectionName}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, 'i'),
    new RegExp(`${sectionName}\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`${sectionName}\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, 'i')
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1]
        .replace(/\\n\\n/g, '\n\n')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
    }
  }

  return '';
};

/**
 * Formats content for display by combining sections with proper spacing
 * @param {object|string} content - The content to format
 * @returns {string} - Formatted content string
 */
export const formatContentForDisplay = (content) => {
  const formatted = fixMalformedContent(content);
  
  const parts = [
    formatted.introduction,
    formatted.main_content,
    formatted.conclusion
  ].filter(part => part && part.trim());

  return parts.join('\n\n');
};

/**
 * Cleans up common formatting issues in content
 * @param {string} content - The content to clean
 * @returns {string} - Cleaned content
 */
export const cleanContentFormatting = (content) => {
  if (!content || typeof content !== 'string') return content;

  return content
    // Fix escaped newlines
    .replace(/\\n\\n/g, '\n\n')
    .replace(/\\n/g, '\n')
    // Fix escaped quotes
    .replace(/\\"/g, '"')
    // Fix double asterisks
    .replace(/\*\*\*\*/g, '**')
    .replace(/\*\*\*\*\*/g, '**')
    .replace(/\*\*\*\*\*\*/g, '**')
    // Fix separator patterns
    .replace(/\|\|\|---\|\|\|/g, '')
    .replace(/\|\|\|/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Validates content structure and returns any issues found
 * @param {object|string} content - The content to validate
 * @returns {object} - Validation result with issues array
 */
export const validateContent = (content) => {
  const issues = [];
  
  if (!content) {
    issues.push('Content is empty or null');
    return { isValid: false, issues };
  }

  const formatted = fixMalformedContent(content);
  
  if (!formatted.introduction && !formatted.main_content && !formatted.conclusion) {
    issues.push('No content sections found (introduction, main_content, conclusion)');
  }

  if (!formatted.main_content) {
    issues.push('Main content section is missing');
  }

  // Check for common formatting issues
  const allContent = formatContentForDisplay(formatted);
  
  if (allContent.includes('\\n')) {
    issues.push('Contains escaped newlines that should be actual newlines');
  }

  if (allContent.includes('\\"')) {
    issues.push('Contains escaped quotes that should be regular quotes');
  }

  if (allContent.includes('****')) {
    issues.push('Contains malformed asterisks (****)');
  }

  return {
    isValid: issues.length === 0,
    issues,
    formatted
  };
};

/**
 * Auto-fixes common content issues
 * @param {object|string} content - The content to auto-fix
 * @returns {object} - Fixed content object
 */
export const autoFixContent = (content) => {
  const formatted = fixMalformedContent(content);
  
  return {
    introduction: cleanContentFormatting(formatted.introduction),
    main_content: cleanContentFormatting(formatted.main_content),
    conclusion: cleanContentFormatting(formatted.conclusion)
  };
};

export default {
  fixMalformedContent,
  formatContentForDisplay,
  cleanContentFormatting,
  validateContent,
  autoFixContent
};
