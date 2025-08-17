/**
 * Security Middleware for The Discourse AI
 * Implements rate limiting, input validation, and security headers
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createHash } from 'crypto';

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`[SECURITY] Rate limit exceeded for ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

// Stricter rate limiting for authentication endpoints
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later.'
);

// Course generation rate limiting
export const courseGenerationLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 course generations per hour
  'Too many course generation attempts, please try again later.'
);

// Public course access rate limiting
export const publicCourseLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  50, // 50 requests per window
  'Too many requests to public courses, please try again later.'
);

// Input validation and sanitization
export const validateInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Content validation for course generation
export const validateCourseContent = (req, res, next) => {
  const { topic, difficulty, numModules, numLessonsPerModule } = req.body;

  // Validate required fields
  if (!topic || !difficulty || !numModules || !numLessonsPerModule) {
    return res.status(400).json({
      error: 'All fields are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  // Validate topic length and content
  if (typeof topic !== 'string' || topic.length < 3 || topic.length > 200) {
    return res.status(400).json({
      error: 'Topic must be between 3 and 200 characters',
      code: 'INVALID_TOPIC_LENGTH'
    });
  }

  // Validate difficulty
  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (!validDifficulties.includes(difficulty.toLowerCase())) {
    return res.status(400).json({
      error: 'Difficulty must be beginner, intermediate, or advanced',
      code: 'INVALID_DIFFICULTY'
    });
  }

  // Validate numeric fields
  const numModulesInt = parseInt(numModules);
  const numLessonsInt = parseInt(numLessonsPerModule);

  if (isNaN(numModulesInt) || numModulesInt < 1 || numModulesInt > 10) {
    return res.status(400).json({
      error: 'Number of modules must be between 1 and 10',
      code: 'INVALID_MODULE_COUNT'
    });
  }

  if (isNaN(numLessonsInt) || numLessonsInt < 1 || numLessonsInt > 20) {
    return res.status(400).json({
      error: 'Number of lessons per module must be between 1 and 20',
      code: 'INVALID_LESSON_COUNT'
    });
  }

  // Enhanced content moderation
  const enhancedBlocklist = [
    // NSFW and explicit content
    'porn', 'pornography', 'nsfw', 'erotic', 'sex', 'sexual', 'incest', 'rape', 'bestiality', 'pedophile', 'child porn',
    'adult content', 'explicit', 'nude', 'nudity', 'sexual content', 'sexual material',
    
    // Extremism and terrorism
    'terrorism', 'terrorist', 'isis', 'al-qaeda', 'daesh', 'extremist', 'extremism', 'bomb making', 'how to make a bomb',
    'weapon making', 'explosive making', 'terrorist training', 'jihad', 'radicalization',
    
    // Hate speech and discrimination
    'kill all', 'ethnic cleansing', 'genocide', 'hate speech', 'racism', 'discrimination',
    'white supremacy', 'neo-nazi', 'fascist', 'supremacist',
    
    // Illegal activities
    'drug making', 'drug manufacturing', 'illegal drugs', 'counterfeit', 'fraud',
    'identity theft', 'hacking', 'cyber attack', 'malware', 'virus making',
    
    // Harmful content
    'self harm', 'suicide', 'harmful', 'dangerous', 'lethal', 'deadly',
    'weapon', 'firearm', 'gun making', 'ammunition', 'explosive'
  ];

  const topicText = String(topic || '').toLowerCase();
  const containsBlocked = enhancedBlocklist.some(term => topicText.includes(term));
  
  if (containsBlocked) {
    console.warn('[SECURITY] Blocked course generation attempt:', {
      topic,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      error: 'The requested topic violates our content policy and cannot be generated.',
      code: 'CONTENT_POLICY_VIOLATION'
    });
  }

  next();
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://checkout.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  frameguard: { action: 'deny' }
});

// Request logging for security monitoring
export const securityLogging = (req, res, next) => {
  const startTime = Date.now();
  
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
    /javascript:/i // Protocol injection
  ];

  const requestString = JSON.stringify({
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));
  
  if (isSuspicious) {
    console.warn('[SECURITY] Suspicious request detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestData: requestString.substring(0, 500)
    });
  }

  // Log response time for performance monitoring
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 5000) { // Log slow requests
      console.warn('[PERFORMANCE] Slow request detected:', {
        url: req.url,
        method: req.method,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

// Session validation for public courses
export const validatePublicSession = (req, res, next) => {
  const { sessionId } = req.query;
  
  if (sessionId) {
    // Validate session ID format
    const sessionIdPattern = /^session_\d+_[a-z0-9]{9}$/;
    if (!sessionIdPattern.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format',
        code: 'INVALID_SESSION_ID'
      });
    }
  }

  next();
};

// IP-based blocking for known malicious IPs
const maliciousIPs = new Set(); // In production, use Redis or database

export const ipBlocking = (req, res, next) => {
  const clientIP = req.ip;
  
  if (maliciousIPs.has(clientIP)) {
    console.warn('[SECURITY] Blocked request from malicious IP:', clientIP);
    return res.status(403).json({
      error: 'Access denied',
      code: 'IP_BLOCKED'
    });
  }

  next();
};

// Request size limiting
export const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      error: 'Request too large',
      code: 'REQUEST_TOO_LARGE'
    });
  }

  next();
};

// Export all middleware
export default {
  apiLimiter,
  authLimiter,
  courseGenerationLimiter,
  publicCourseLimiter,
  validateInput,
  validateCourseContent,
  securityHeaders,
  securityLogging,
  validatePublicSession,
  ipBlocking,
  requestSizeLimit
};
