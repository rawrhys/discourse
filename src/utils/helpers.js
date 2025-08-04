// src/utils/helpers.js
/**
 * Helper utilities for the LMS Generator application
 */

/**
 * Create a URL-friendly slug from a string
 * @param {string} text - The text to convert to a slug
 * @returns {string} - The slugified string
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w-]+/g, '')        // Remove all non-word characters
    .replace(/--+/g, '-')           // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

/**
 * Format a date in a readable format
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Truncate text to a specified length and add ellipsis
 * @param {string} text - The text to truncate
 * @param {number} length - Maximum length before truncation
 * @returns {string} - Truncated text
 */
export const truncateText = (text, length = 100) => {
  if (!text) return '';
  if (text.length <= length) return text;
  
  return text.slice(0, length).trim() + '...';
};

/**
 * Generate a random ID
 * @returns {string} - A random ID
 */
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Calculate reading time for text content
 * @param {string} content - The text content
 * @param {number} wordsPerMinute - Reading speed in words per minute
 * @returns {number} - Estimated reading time in minutes
 */
export const calculateReadingTime = (content, wordsPerMinute = 200) => {
  if (!content) return 0;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};

/**
 * Deep clone an object
 * @param {Object} obj - The object to clone
 * @returns {Object} - A deep copy of the object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Debounce a function to limit how often it can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait between calls
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Create a title case string (capitalize first letter of each word)
 * @param {string} str - The string to convert
 * @returns {string} - Title cased string
 */
export const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
};

/**
 * Get a random item from an array
 * @param {Array} array - The array to pick from
 * @returns {*} - A random item from the array
 */
export const getRandomItem = (array) => {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Check if an object is empty
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if the object is empty
 */
export const isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
};