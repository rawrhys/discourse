/**
 * Robust JSON Parser Utility
 * Handles various edge cases including "data:" prefixes, malformed JSON, and streaming responses
 */

import logger from './logger';

export class RobustJsonParser {
  /**
   * Safely parse JSON with multiple fallback strategies
   * @param {string|object} input - The input to parse
   * @param {string} context - Context for logging (e.g., 'Mistral API', 'Streaming Response')
   * @returns {object|null} - Parsed JSON object or null if parsing failed
   */
  static parse(input, context = 'Unknown') {
    if (!input) {
      console.warn(`[${context}] No input provided for JSON parsing`);
      return null;
    }

    // If input is already an object, return it
    if (typeof input === 'object' && input !== null) {
      return input;
    }

    // Convert to string if needed
    let text = typeof input === 'string' ? input : String(input);
    
    logger.debug(`[${context}] Attempting to parse JSON: ${text.substring(0, 200)}...`);

    // Strategy 1: Direct JSON parsing
    try {
      const result = JSON.parse(text);
      logger.debug(`[${context}] Direct JSON parsing successful`);
      return result;
    } catch (error) {
      logger.debug(`[${context}] Direct JSON parsing failed: ${error.message}`);
    }

    // Strategy 2: Handle "data:" prefixes
    const cleanedText = this.removeDataPrefix(text);
    if (cleanedText !== text) {
      logger.debug(`[${context}] Removed "data:" prefix, attempting to parse cleaned text`);
      try {
        const result = JSON.parse(cleanedText);
        logger.debug(`[${context}] JSON parsing successful after removing "data:" prefix`);
        return result;
      } catch (error) {
        logger.debug(`[${context}] JSON parsing failed after removing "data:" prefix: ${error.message}`);
      }
    }

    // Strategy 3: Extract JSON from markdown code blocks
    const markdownJson = this.extractJsonFromMarkdown(text);
    if (markdownJson) {
      logger.debug(`[${context}] Extracted JSON from markdown, attempting to parse`);
      try {
        const result = JSON.parse(markdownJson);
        logger.debug(`[${context}] JSON parsing successful from markdown extraction`);
        return result;
      } catch (error) {
        logger.debug(`[${context}] JSON parsing failed from markdown extraction: ${error.message}`);
      }
    }

    // Strategy 4: Find and extract JSON object/array
    const extractedJson = this.extractJsonFromText(text);
    if (extractedJson) {
      logger.debug(`[${context}] Extracted JSON from text, attempting to parse`);
      try {
        const result = JSON.parse(extractedJson);
        logger.debug(`[${context}] JSON parsing successful from text extraction`);
        return result;
      } catch (error) {
        logger.debug(`[${context}] JSON parsing failed from text extraction: ${error.message}`);
      }
    }

    // Strategy 5: Try to fix common JSON issues
    const fixedJson = this.attemptJsonFix(text);
    if (fixedJson) {
      logger.debug(`[${context}] Attempting to parse fixed JSON`);
      try {
        const result = JSON.parse(fixedJson);
        logger.debug(`[${context}] JSON parsing successful after fixing`);
        return result;
      } catch (error) {
        logger.debug(`[${context}] JSON parsing failed after fixing: ${error.message}`);
      }
    }

    // Strategy 6: Aggressive JSON reconstruction
    const reconstructedJson = this.attemptJsonReconstruction(text);
    if (reconstructedJson) {
      logger.debug(`[${context}] Attempting to parse reconstructed JSON`);
      try {
        const result = JSON.parse(reconstructedJson);
        logger.debug(`[${context}] JSON parsing successful after reconstruction`);
        return result;
      } catch (error) {
        logger.debug(`[${context}] JSON parsing failed after reconstruction: ${error.message}`);
      }
    }

    console.error(`[${context}] All JSON parsing strategies failed`);
    console.error(`[${context}] Original input: ${text.substring(0, 500)}...`);
    return null;
  }

  /**
   * Remove "data:" prefix from text
   * @param {string} text - Input text
   * @returns {string} - Text with "data:" prefix removed
   */
  static removeDataPrefix(text) {
    if (!text || typeof text !== 'string') return text;
    
    let cleaned = text.trim();
    
    // Remove multiple "data:" prefixes (in case of nested SSE)
    while (cleaned.startsWith('data: ')) {
      cleaned = cleaned.substring(6).trim();
    }
    
    // Also handle "data:" without space
    while (cleaned.startsWith('data:')) {
      cleaned = cleaned.substring(5).trim();
    }
    
    // Handle other common prefixes that might cause issues
    const prefixesToRemove = [
      'event: ',
      'id: ',
      'retry: ',
      'data:',
      'event:',
      'id:',
      'retry:'
    ];
    
    for (const prefix of prefixesToRemove) {
      while (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    return cleaned;
  }

  /**
   * Extract JSON from markdown code blocks
   * @param {string} text - Input text
   * @returns {string|null} - Extracted JSON or null
   */
  static extractJsonFromMarkdown(text) {
    if (!text || typeof text !== 'string') return null;
    
    // Try different markdown patterns
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/,
      /```\s*([\s\S]*?)\s*```/,
      /`([^`]+)`/,
      /"([^"]*)"/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        // Check if it looks like JSON
        if (extracted.startsWith('{') || extracted.startsWith('[')) {
          return extracted;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract JSON object or array from text
   * @param {string} text - Input text
   * @returns {string|null} - Extracted JSON or null
   */
  static extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    
    const content = text.trim();
    
    // Find the first JSON object or array
    let firstBracket = content.indexOf('{');
    let firstSquare = content.indexOf('[');
    
    if (firstBracket === -1 && firstSquare === -1) {
      return null;
    }

    let start = -1;
    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);

    const openChar = content[start];
    const closeChar = openChar === '{' ? '}' : ']';
    
    let openCount = 1;
    for (let i = start + 1; i < content.length; i++) {
      const char = content[i];
      if (char === openChar) openCount++;
      else if (char === closeChar) openCount--;
      
      if (openCount === 0) {
        return content.substring(start, i + 1);
      }
    }
    
    return null;
  }

  /**
   * Attempt to fix common JSON issues
   * @param {string} text - Input text
   * @returns {string|null} - Fixed JSON or null
   */
  static attemptJsonFix(text) {
    if (!text || typeof text !== 'string') return null;
    
    let fixed = text.trim();
    
    // Remove any text before the first { or [
    const firstBracket = Math.min(
      fixed.indexOf('{') !== -1 ? fixed.indexOf('{') : Infinity,
      fixed.indexOf('[') !== -1 ? fixed.indexOf('[') : Infinity
    );
    
    if (firstBracket !== Infinity) {
      fixed = fixed.substring(firstBracket);
    }
    
    // Remove any text after the last } or ]
    const lastBracket = Math.max(
      fixed.lastIndexOf('}'),
      fixed.lastIndexOf(']')
    );
    
    if (lastBracket !== -1) {
      fixed = fixed.substring(0, lastBracket + 1);
    }
    
    // Try to fix common issues
    fixed = fixed
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t'); // Escape tabs
    
    return fixed;
  }

  /**
   * Attempt aggressive JSON reconstruction for severely malformed JSON
   * @param {string} text - Input text
   * @returns {string|null} - Reconstructed JSON or null
   */
  static attemptJsonReconstruction(text) {
    if (!text || typeof text !== 'string') return null;
    
    let reconstructed = text.trim();
    
    // Remove all whitespace and newlines to make parsing easier
    reconstructed = reconstructed.replace(/\s+/g, ' ');
    
    // Try to find JSON-like structures and fix them
    const jsonPatterns = [
      // Look for object patterns
      /\{[^{}]*\}/g,
      // Look for array patterns
      /\[[^\[\]]*\]/g,
      // Look for key-value pairs
      /"[^"]*"\s*:\s*"[^"]*"/g,
      /"[^"]*"\s*:\s*\{[^{}]*\}/g,
      /"[^"]*"\s*:\s*\[[^\[\]]*\]/g
    ];
    
    // Try to extract and fix each pattern
    for (const pattern of jsonPatterns) {
      const matches = reconstructed.match(pattern);
      if (matches && matches.length > 0) {
        for (const match of matches) {
          try {
            // Try to parse this fragment
            const parsed = JSON.parse(match);
            // If it works, try to build a complete object around it
            const completeJson = `{"extracted": ${match}}`;
            JSON.parse(completeJson); // Test if it's valid
            return completeJson;
          } catch (e) {
            // Continue to next pattern
          }
        }
      }
    }
    
    // If no patterns work, try to extract just the content between braces
    const braceMatch = reconstructed.match(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (braceMatch) {
      try {
        const extracted = `{${braceMatch[1]}}`;
        // Try to fix common issues in the extracted content
        const fixed = extracted
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*,/g, ',')
          .replace(/:\s*,/g, ': null,')
          .replace(/,\s*$/g, '');
        
        JSON.parse(fixed); // Test if it's valid
        return fixed;
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    return null;
  }

  /**
   * Safe JSON stringify with error handling
   * @param {any} obj - Object to stringify
   * @returns {string|null} - JSON string or null
   */
  static stringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.error('JSON stringify failed:', error);
      return null;
    }
  }

  /**
   * Check if a string is valid JSON
   * @param {string} text - Text to check
   * @returns {boolean} - True if valid JSON
   */
  static isValidJson(text) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
}

// Export a simple function for backward compatibility
export const parseJson = (input, context) => RobustJsonParser.parse(input, context); 