// src/services/CacheService.js
import apiClient from './apiClient.js';

const CacheService = {
  async purgeImageCache({ substring, substrings, useDisallowed = false, all = false, courseId } = {}) {
    const body = {};
    if (Array.isArray(substrings) && substrings.length > 0) body.substrings = substrings;
    if (typeof substring === 'string' && substring.trim()) body.substring = substring.trim();
    if (useDisallowed) body.useDisallowed = true;
    if (all) body.all = true;
    if (courseId) body.courseId = courseId;
    return apiClient('/api/image-cache/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async banImage({ url, pageURL, title, courseId } = {}) {
    const body = {};
    if (url) body.url = url;
    if (pageURL) body.pageURL = pageURL;
    if (title) body.title = title;
    if (courseId) body.courseId = courseId;
    return apiClient('/api/image-cache/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

export default CacheService; 