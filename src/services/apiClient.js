/* jshint esversion: 11, module: true, browser: true */
/* jshint esversion: 11 */
/* eslint-env browser, es2020 */
import JsonParser from '../utils/jsonParser';
import { API_BASE_URL } from '../config/api';
import logger from '../utils/logger';

const apiClient = async (url, options = {}) => {
  const { onProgress, ...fetchOptions } = options;
  const token = localStorage.getItem('token');
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  const config = {
    ...fetchOptions,
    headers: {
      ...defaultHeaders,
      ...fetchOptions.headers,
    },
    body: fetchOptions.body,
  };

  // Log the outgoing request (info level)
  logger.info('📡 [API REQUEST]', {
    url: url,
    method: config.method || 'GET',
    headers: config.headers,
    body: config.body ? JSON.parse(config.body) : undefined,
    timestamp: new Date().toISOString()
  });

  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Log the response status and headers (info level)
    logger.info('📥 [API RESPONSE]', {
      url: url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Get the error response to check for specific error types
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        // Check for email confirmation error
        if (errorData.code === 'EMAIL_NOT_CONFIRMED' ||
            (errorData.error && errorData.error.includes('confirm your email'))) {
          logger.warn('🔒 [AUTH ERROR] Email not confirmed');
          throw new Error('Please confirm your email address before signing in. Check your inbox and spam folder for the confirmation link.');
        }
        // Handle specific JWT errors
        if (errorData.code === 'TOKEN_SIGNATURE_INVALID' ||
            errorData.code === 'TOKEN_EXPIRED' ||
            errorData.code === 'TOKEN_FORMAT_INVALID') {
          logger.warn('🔒 [AUTH ERROR] Token is invalid:', errorData.code);
          // Clear the invalid token
          localStorage.removeItem('token');
          // Broadcast auth error event
          window.dispatchEvent(new CustomEvent('auth-error'));
          throw new Error('Your session has expired. Please log in again.');
        }
        // Special handling for courses/saved endpoint - return empty array instead of throwing
        if (url.includes('/courses/saved')) {
          logger.warn('⚠️ [AUTH WARNING] 401 error on courses/saved - likely new user or session issue');
          return [];
        }
        // Special handling for user/current endpoint - return null instead of throwing
        if (url.includes('/user/current')) {
          logger.warn('⚠️ [AUTH WARNING] 401 error on user/current - likely session expired');
          // Clear the invalid token
          localStorage.removeItem('token');
          return null;
        }

        // Login-specific handling: incorrect credentials should not show session expired
        if (url.includes('/auth/login')) {
          logger.warn('🔑 [LOGIN ERROR] Invalid credentials during login');
          throw new Error('Incorrect email or password.');
        }
        // Broadcast an event for invalid token (include status for consumers)
        window.dispatchEvent(new CustomEvent('auth-error', { detail: { status: response.status, url } }));
        logger.warn('🔒 [AUTH ERROR] Session expired or unauthorized access');
        throw new Error('Session expired. Please log in again.');
      }
      // Use robust JSON parser for error responses
      const errorText = await response.text();
      const errorData = JsonParser.RobustJsonParser.parse(errorText, 'API Error Response') || {};
      const errorMessage = errorData.error || response.statusText;
      logger.error('❌ [API ERROR]', {
        url: url,
        status: response.status,
        error: errorData,
        message: errorMessage
      });
      const err = new Error(errorMessage);
      err.status = response.status;
      err.url = url;
      err.data = errorData;
      throw err;
    }

    if (response.status === 204) {
      logger.info('✅ [API SUCCESS] No content response (204)');
      return null;
    }
    // For course generation, handle streaming response
    if (url.includes('/api/courses/generate')) {
      logger.debug('🔄 [API STREAMING] Starting streaming response for course generation');
      // Check if response is actually streaming
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/event-stream')) {
        logger.warn('⚠️ [API STREAMING] Expected streaming response but got:', contentType);
        // Fall back to robust JSON handling
        const responseText = await response.text();
        const responseData = JsonParser.RobustJsonParser.parse(responseText, 'Non-Streaming Fallback');
        if (responseData) {
          logger.info('✅ [API SUCCESS] Non-streaming response:', responseData);
          return responseData;
        } else {
          throw new Error('Failed to parse non-streaming response');
        }
      }
      // Read the response as a stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let hasReceivedCompletion = false;
      logger.debug('📡 [API STREAMING] Starting to read stream...');
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            logger.debug('✅ [API STREAMING] Stream completed after', chunkCount, 'chunks');
            if (!hasReceivedCompletion) {
              logger.warn('⚠️ [API STREAMING] Stream ended without completion event');
              // Send a completion event if we didn't receive one
              if (onProgress) {
                onProgress({
                  type: 'course_complete',
                  message: 'Course generation completed (stream ended)',
                  courseId: null
                });
              }
            }
            break;
          }
          chunkCount++;
          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          logger.debug(`📡 [API STREAMING] Received chunk ${chunkCount}, buffer length: ${buffer.length}`);
          // Process complete JSON objects from the buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              logger.debug(`📡 [API STREAMING] Processing line: ${line.substring(0, 100)}...`);
              // Use robust JSON parser for streaming chunks
              const data = JsonParser.RobustJsonParser.parse(line.slice(6), 'Streaming Chunk');
              if (data) {
                logger.debug('📡 [API STREAMING] Successfully parsed chunk:', data);
                // Track completion events
                if (data.type === 'course_complete' || data.type === 'error') {
                  hasReceivedCompletion = true;
                  logger.debug('🎯 [API STREAMING] Received completion event:', data.type);
                }
                // Special handling for course_complete
                if (data.type === 'course_complete') {
                  logger.debug('🎉 [API STREAMING] Course completion detected:', {
                    courseId: data.courseId,
                    courseTitle: data.courseTitle,
                    hasCourseId: !!data.courseId,
                    courseIdType: typeof data.courseId,
                    courseIdLength: data.courseId ? data.courseId.length : 0
                  });
                }
                // Emit the streaming data
                if (onProgress) {
                  logger.debug('📡 [API STREAMING] Calling streaming callback with data type:', data.type);
                  onProgress(data);
                } else {
                  logger.warn('⚠️ [API STREAMING] No streaming callback available for data:', data);
                }
              } else {
                logger.warn('⚠️ [API STREAMING] Failed to parse chunk:', line);
              }
            }
          }
        }
        // Process any remaining data in buffer
        if (buffer.trim() && buffer.startsWith('data: ')) {
          logger.debug('📡 [API STREAMING] Processing final buffer:', buffer.substring(0, 100) + '...');
          // Use robust JSON parser for final chunk
          const data = JsonParser.RobustJsonParser.parse(buffer.slice(6), 'Final Streaming Chunk');
          if (data) {
            logger.debug('📡 [API STREAMING] Final chunk parsed successfully:', data);
            if (data.type === 'course_complete' || data.type === 'error') {
              hasReceivedCompletion = true;
            }
            if (onProgress) {
              logger.debug('📡 [API STREAMING] Calling streaming callback with final data type:', data.type);
              onProgress(data);
            } else {
              logger.warn('⚠️ [API STREAMING] No streaming callback available for final data:', data);
            }
          } else {
            logger.warn('⚠️ [API STREAMING] Failed to parse final chunk:', buffer);
          }
        }
        logger.debug('✅ [API STREAMING] Stream processing completed');
        return { success: true, message: 'Course generation completed' };
      } catch (streamError) {
        logger.error('💥 [API STREAMING] Stream error:', streamError);
        throw new Error('Streaming failed: ' + streamError.message);
      }
    }
    // For non-streaming responses, use robust JSON parser
    const responseText = await response.text();

    // Handle empty response body by treating it as a null response
    if (!responseText.trim()) {
        logger.info('✅ [API SUCCESS] Empty response body, returning null.');
        return null;
    }
    const responseData = JsonParser.RobustJsonParser.parse(responseText, 'API Response');
    // The parser returns null on failure. We need to distinguish a failed parse
    // from a successful parse of a literal "null".
    if (responseData === null && responseText.trim().toLowerCase() !== 'null') {
      logger.error('❌ [API ERROR] Failed to parse response as JSON');
      logger.error('❌ [API ERROR] Response text:', responseText.substring(0, 500));
      throw new Error('Server returned invalid JSON response');
    }
    // Log successful response data (info level)
    logger.info('✅ [API SUCCESS]', {
      url: url,
      data: responseData,
      dataSize: JSON.stringify(responseData).length,
      timestamp: new Date().toISOString()
    });
    return responseData;

  } catch (error) {
    // AbortErrors are expected when the request is cancelled
    if (error.name === 'AbortError') {
      logger.warn('Request aborted (timeout or user action)');
      throw new Error('Request timed out.');
    }

    // Check for network errors (server is offline)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        logger.error('💥 [FETCH ERROR] Backend server is not available.', {
            url: url,
            timestamp: new Date().toISOString(),
            error: error
        });
        throw new Error('Backend server unavailable');
    }
    // Enhanced error handling for common network issues
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // This is likely a CORS, mixed content, or network connectivity issue
      logger.warn('🌐 [NETWORK ERROR]', {
        url: url,
        protocol: window.location.protocol,
        backendProtocol: API_BASE_URL.startsWith('https:') ? 'HTTPS' : 'HTTP',
        mixedContent: window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:'),
        error: error.message
      });
      if (window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:')) {
        throw new Error('Mixed Content Error: Cannot connect to HTTP backend from HTTPS frontend. Please check your backend configuration or contact support.');
      } else {
        throw new Error('Backend server is unreachable. Please check your connection or contact support.');
      }
    }
    if (error.message.includes('Unexpected token') && error.message.includes('<!doctype')) {
      logger.warn('🔧 [SERVER ERROR] Server returned HTML instead of JSON', {
        url: url,
        error: error.message
      });
      throw new Error('Server is not responding correctly. Please check your connection and try again.');
    }
    // Handle SSL protocol errors specifically
    if (error.message.toLowerCase().includes('ssl') || error.message.toLowerCase().includes('protocol')) {
      logger.error('🔐 [SSL ERROR] SSL connection issue', {
        url: url,
        error: error.message
      });
      throw new Error('SSL connection error. The backend server may be temporarily unavailable or misconfigured.');
    }
    logger.error('💥 [UNEXPECTED ERROR]', {
      url: url,
      error: error.message,
      stack: error.stack
    });
    // If this is a handled HTTP error with status, broadcast for listeners
    if (typeof error.status === 'number') {
      window.dispatchEvent(new CustomEvent('api-error', { detail: { status: error.status, url } }));
      if (error.status === 401 || error.status === 403) {
        window.dispatchEvent(new CustomEvent('auth-error', { detail: { status: error.status, url } }));
      }
    }

    throw error;
  }
};

export default apiClient;