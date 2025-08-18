/**
 * Security Middleware for The Discourse AI
 * Implements rate limiting, input validation, and security headers
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import UserAgent from 'user-agents';

// In-memory storage for CAPTCHA challenges (since we don't have express-session)
const captchaChallenges = new Map();
const botDetectionData = new Map();

// Cleanup function to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean up old CAPTCHA challenges (older than 5 minutes)
  for (const [key, challenge] of captchaChallenges.entries()) {
    if (now - challenge.timestamp > 5 * 60 * 1000) {
      captchaChallenges.delete(key);
    }
  }
  
  // Clean up old bot detection data (older than 1 hour)
  for (const [key, data] of botDetectionData.entries()) {
    if (now - data.lastRequest > 60 * 60 * 1000) {
      botDetectionData.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Bot detection patterns
const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i, /scraping/i,
  /curl/i, /wget/i, /python/i, /java/i, /perl/i, /ruby/i,
  /phantomjs/i, /headless/i, /selenium/i, /puppeteer/i,
  /chrome-lighthouse/i, /googlebot/i, /bingbot/i, /yandex/i,
  /baiduspider/i, /facebookexternalhit/i, /twitterbot/i,
  /linkedinbot/i, /whatsapp/i, /telegrambot/i, /discordbot/i,
  /slackbot/i, /alexa/i, /siri/i, /cortana/i, /okhttp/i,
  /apache-httpclient/i, /axios/i, /fetch/i, /request/i
];

// Suspicious IP patterns (VPNs, proxies, etc.)
const SUSPICIOUS_IP_PATTERNS = [
  /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
  /^127\./, /^169\.254\./, /^224\./, /^240\./
];

// Rate limiting for public course endpoints
export const publicCourseRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for authenticated users
    return req.user && req.user.id;
  },
  keyGenerator: (req) => {
    // Use IP + User-Agent for better bot detection
    return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
  }
});

// Slow down requests for suspicious patterns
export const publicCourseSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skip: (req) => {
    return req.user && req.user.id;
  }
});

// Bot detection middleware
export const botDetection = (req, res, next) => {
  try {
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || 'unknown';
  
  // Check for bot patterns in User-Agent
  const isBot = BOT_PATTERNS.some(pattern => pattern.test(userAgent));
  
  // Check for suspicious IP patterns
  const isSuspiciousIP = SUSPICIOUS_IP_PATTERNS.some(pattern => pattern.test(ip));
  
  // Check for missing or suspicious headers
  const hasAcceptHeader = req.get('Accept');
  const hasAcceptLanguage = req.get('Accept-Language');
  const hasAcceptEncoding = req.get('Accept-Encoding');
  const hasConnection = req.get('Connection');
  
  // Check for rapid requests (simple heuristic)
  const requestTime = Date.now();
  const clientKey = `${ip}-${userAgent}`;
  
  if (!botDetectionData.has(clientKey)) {
    botDetectionData.set(clientKey, {
      requestCount: 0,
      firstRequest: requestTime,
      lastRequest: requestTime
    });
  }
  
  const botData = botDetectionData.get(clientKey);
  botData.requestCount++;
  botData.lastRequest = requestTime;
  
  // Calculate requests per second
  const timeSpan = (requestTime - botData.firstRequest) / 1000;
  const requestsPerSecond = timeSpan > 0 ? botData.requestCount / timeSpan : 0;
  
  // Bot detection criteria
  const botScore = (isBot ? 3 : 0) +
                   (isSuspiciousIP ? 2 : 0) +
                   (!hasAcceptHeader ? 1 : 0) +
                   (!hasAcceptLanguage ? 1 : 0) +
                   (!hasAcceptEncoding ? 1 : 0) +
                   (!hasConnection ? 1 : 0) +
                   (requestsPerSecond > 10 ? 3 : 0) +
                   (userAgent.length < 20 ? 2 : 0);
  
  // Log suspicious activity
  if (botScore > 3) {
    console.warn(`[BOT_DETECTION] Suspicious activity detected:`, {
      ip,
      userAgent,
      botScore,
      requestsPerSecond,
      isBot,
      isSuspiciousIP,
      hasHeaders: { hasAcceptHeader, hasAcceptLanguage, hasAcceptEncoding, hasConnection }
    });
  }
  
  // Block high-scoring bots
  if (botScore > 7) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Suspicious activity detected'
    });
  }
  
  // Add bot score to request for logging
  req.botScore = botScore;
  
  next();
  } catch (error) {
    console.error('[BOT_DETECTION] Error in bot detection middleware:', error);
    // Continue without bot detection if there's an error
    req.botScore = 0;
    next();
  }
};

// CAPTCHA verification middleware (simple challenge-response)
export const captchaChallenge = (req, res, next) => {
  try {
    // Skip for authenticated users
    if (req.user && req.user.id) {
      return next();
    }
  
  const sessionId = req.query.sessionId;
  const challenge = req.query.challenge;
  const response = req.query.response;
  
  console.log('[CAPTCHA] Processing request:', { sessionId, challenge: !!challenge, response: !!response });
  
  // Generate simple math challenge for every public access
  if (!challenge) {
    console.log('[CAPTCHA] Generating new challenge for public course access');
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const challengeData = `${num1}+${num2}`;
    const expectedResponse = num1 + num2;
    
    // Generate a unique challenge key even if no sessionId exists yet
    const uniqueId = sessionId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const challengeKey = `${uniqueId}_${Date.now()}`;
    captchaChallenges.set(challengeKey, {
      challenge: challengeData,
      expectedResponse: expectedResponse,
      timestamp: Date.now(),
      sessionId: sessionId || null
    });
    
    console.log('[CAPTCHA] Returning CAPTCHA challenge:', { challengeData, challengeKey });
    return res.status(200).json({
      requiresCaptcha: true,
      challenge: challengeData,
      challengeKey: challengeKey,
      message: 'Please solve this simple math problem to continue'
    });
  }
  
  // Verify response using challenge key
  const challengeKey = req.query.challengeKey;
  const storedChallenge = captchaChallenges.get(challengeKey);
  if (!storedChallenge) {
    console.log('[CAPTCHA] Invalid challenge key:', challengeKey);
    return res.status(400).json({
      error: 'Invalid challenge session'
    });
  }
  
  // Clean up old challenges (older than 5 minutes)
  const now = Date.now();
  for (const [key, challenge] of captchaChallenges.entries()) {
    if (now - challenge.timestamp > 5 * 60 * 1000) {
      captchaChallenges.delete(key);
    }
  }
  
  if (parseInt(response) !== storedChallenge.expectedResponse) {
    return res.status(400).json({
      error: 'Incorrect answer',
      message: 'Please try again'
    });
  }
  
  // Mark this specific challenge as completed and allow access
  captchaChallenges.delete(challengeKey);
  
  next();
  } catch (error) {
    console.error('[CAPTCHA] Error in CAPTCHA middleware:', error);
    // Continue without CAPTCHA if there's an error
    next();
  }
};

// Session verification middleware - Always require CAPTCHA for public access
export const verifySession = (req, res, next) => {
  const sessionId = req.query.sessionId;
  
  // Skip for authenticated users
  if (req.user && req.user.id) {
    return next();
  }
  
  // Always require CAPTCHA for public course access
  return captchaChallenge(req, res, next);
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Request logging for security monitoring
export const securityLogging = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      botScore: req.botScore || 0,
      userId: req.user?.id || 'anonymous'
    };
    
    // Log suspicious activity
    if (req.botScore > 3 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn('[SECURITY_LOG] Suspicious activity:', logData);
    }
    
    // Log all public course access
    if (req.url.includes('/api/public/courses/')) {
      console.log('[SECURITY_LOG] Public course access:', logData);
    }
  });
  
  next();
};
