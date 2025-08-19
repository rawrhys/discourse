import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';
import compression from 'compression';
import net from 'net';
import { WebSocketServer } from 'ws';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import ApiError from './src/utils/ApiError.js';
// import { execSync } from 'child_process';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { exec } from 'child_process';
import selfsigned from 'selfsigned';
import crypto from 'crypto';
import { compressImage, getOptimalFormat, getFileExtension, formatFileSize } from './server/utils/imageCompression.js';
import sharp from 'sharp';
import imageProxyHandler from './server/utils/proxy.js';
import enhancedImageProxy from './server/utils/enhancedImageProxy.js';
import {
  publicCourseRateLimit,
  publicCourseSlowDown,
  botDetection,
  captchaChallenge,
  verifySession,
  checkCaptcha,
  securityHeaders,
  securityLogging
} from './server/middleware/security.js';
// import { isValidFlashcardTerm } from './src/utils/flashcardUtils.js';



// Load environment variables from .env file
dotenv.config();

// Initialize global CAPTCHA challenges map
global.captchaChallenges = new Map();

// Initialize global image search cache
global.imageSearchCache = new Map();

// Initialize global image cache for better performance
global.imageCache = new Map();
global.imageCacheTimeout = 30 * 60 * 1000; // 30 minutes

// Clean up old cache entries every 5 minutes
setInterval(() => {
  if (global.imageCache) {
    const now = Date.now();
    for (const [key, value] of global.imageCache.entries()) {
      if (now - value.timestamp > global.imageCacheTimeout) {
        global.imageCache.delete(key);
      }
    }
  }
}, 5 * 60 * 1000); // 5 minutes

const app = express();

// Import PublicCourseSessionService singleton instance
import publicCourseSessionService from './src/services/PublicCourseSessionService.js';

// --- CORE MIDDLEWARE ---
// Apply compression to all responses
// app.use(compression());

// Set reverse proxy trust for correct protocol/IP detection
// Use a more secure trust proxy setting to avoid rate limiter warnings
const trustProxySetting = process.env.TRUST_PROXY;
if (trustProxySetting === 'true' || trustProxySetting === '1') {
  // Only trust the first proxy (most secure)
  app.set('trust proxy', 1);
} else if (trustProxySetting === 'false' || trustProxySetting === '0') {
  // Don't trust any proxies
  app.set('trust proxy', false);
} else {
  // Default: trust only the first proxy
  app.set('trust proxy', 1);
}

// CORS: explicit allowed origins with credentials
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://thediscourse.ai,https://api.thediscourse.ai')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// Ensure caches vary by Origin
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// Parse JSON bodies
app.use(express.json());

// Logging flags
const SHOULD_LOG_AUTH = String(process.env.AUTH_LOG || '').toLowerCase() === 'true';

// Admin emails allowed to hit maintenance endpoints (comma-separated)
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// --- IMAGE SEARCH SETTINGS & HELPERS (top-level) ---
const FETCH_TIMEOUT_MS = Number(process.env.IMAGE_SEARCH_TIMEOUT_MS || 8000);
const DISALLOWED_IMAGE_URL_SUBSTRINGS = [
  'e613b3a12ea22955fd9868b841af153a79db6a07',
  'api-proxy.php/cached-images/',
  // Explicitly block this Wikipedia image from appearing in results
  'upload.wikimedia.org/wikipedia/commons/8/8a/PGM-19A_Jupiter_missile-02.jpg'
];
const EXTRA_NEGATIVE_TERMS = [
  'orchestra','symphony','concert','conductor','musician','music','band','choir',
  'violin','cello','piano','guitar','stage','auditorium',
  // Finance/markets/modern economy terms to avoid when subject is historical
  'stock','stocks','stock market','market','markets','trader','traders','trading','broker','brokers','wall street','dow','nasdaq','nyse','finance','financial','economy','economic','bank','banking','banker','money','currency','currencies','dollar','euro','pound','yen','chart','graph','candlestick','ticker','exchange','bond','bonds','forex','cryptocurrency','bitcoin','ethereum','ftse','s&p','sp500','gold price','oil price','ipo','merger','acquisition','bankruptcy','bailout','recession',
  // Modern conflicts and contemporary military-specific terms (blocked unless present in subject)
  'world war i','world war 1','ww1','wwi',
  'world war ii','world war 2','ww2','wwii','nazi','nazis','hitler','swastika',
  'cold war','berlin wall','cuban missile crisis',
  'vietnam war','korean war','gulf war','iraq war','war in iraq','afghanistan war','war in afghanistan',
  'falklands war','yom kippur war','six-day war','six day war','bosnian war','kosovo war','syrian civil war','ukraine war','russian invasion','donbas','crimea','chechen war','chechnya',
  'american civil war','us civil war','spanish civil war','napoleonic wars','napoleonic war','crimean war','boer war','anglo-boer war',
  // Modern weaponry, platforms, and gear
  'tank','tanks','machine gun','assault rifle','ak-47','ak47','m16','m4','missile','missiles','rocket','rockets','icbm','warhead','ballistic',
  'nuclear','nuclear bomb','atomic bomb','hydrogen bomb','thermonuclear','hiroshima','nagasaki',
  'bomber','fighter jet','jet fighter','fighter','jet','stealth','helicopter','attack helicopter','apache','black hawk','uav','drone','drones',
  'howitzer','artillery gun','grenade','grenades','rocket launcher','bazooka','rpg',
  'submarine','submarines','aircraft carrier','carrier strike group','destroyer','frigate','battleship',
  'navy seals','special forces','camo','camouflage','kevlar','night vision',
  // Seasonal/ambiguous terms to avoid when subject implies historical events
  'autumn','fall season','fall foliage','autumn foliage','autumn leaves','fall leaves','leaf','leaves','pumpkin','halloween','thanksgiving','maple leaves','autumn colors','autumnal','scarecrow','harvest festival','corn maze'
];

const normalizeForCompare = (str) => String(str || '').toLowerCase().trim();

const normalizeUrlForCompare = (url) => {
    try {
        if (!url) return '';
        return String(url).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').trim();
    } catch {
        return String(url || '').trim();
    }
};

function containsAny(text, terms) {
  const lower = (text || '').toLowerCase();
  return terms.some(t => lower.includes(t));
}

function getDynamicExtraNegatives(subject) {
  const subj = (subject || '').toLowerCase();
  return EXTRA_NEGATIVE_TERMS.filter(term => !subj.includes(term));
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Extract the main text from lesson content
function extractMainLessonText(content) {
  try {
    if (!content) return '';
    if (typeof content === 'string') return content;
    const parts = [content.introduction, content.main_content, content.conclusion]
      .filter(Boolean)
      .map((s) => String(s))
      .join(' ');
    return parts;
  } catch {
    return '';
  }
}

// Enhanced heuristic to score image candidates for relevance with full course context
function computeImageRelevanceScore(subject, mainText, meta, courseContext = {}) {
  try {
    const subj = String(subject || '').toLowerCase();
    const text = String(mainText || '').toLowerCase();
    const title = String(meta?.title || '').toLowerCase();
    const desc = String(meta?.description || '').toLowerCase();
    const page = String(meta?.pageURL || '').toLowerCase();
    const uploader = String(meta?.uploader || '').toLowerCase();

    // Extract course context information
    const courseTitle = String(courseContext?.title || '').toLowerCase();
    const courseSubject = String(courseContext?.subject || '').toLowerCase();
    const allLessonTitles = Array.isArray(courseContext?.lessonTitles) 
      ? courseContext.lessonTitles.map(t => String(t || '').toLowerCase())
      : [];

    let score = 0;

    const haystack = `${title} ${desc} ${page} ${uploader}`;
    
    // Create comprehensive context text for better relevance scoring
    const contextText = `${subj} ${text} ${courseTitle} ${courseSubject} ${allLessonTitles.join(' ')}`.toLowerCase();

    // Heavy penalty for completely irrelevant objects
    const irrelevantObjects = ['bench', 'chair', 'table', 'furniture', 'modern', 'contemporary', 'office', 'kitchen', 'bathroom', 'bedroom', 'living room', 'garden', 'flower', 'tree', 'plant', 'animal', 'pet', 'car', 'vehicle', 'building', 'house', 'apartment'];
    
    // Heavy penalty for colonization-related content (often irrelevant to historical lessons)
    const colonizationTerms = ['colonization', 'colonial', 'colony', 'colonist', 'settler', 'colonialism'];
    for (const term of colonizationTerms) {
      if (haystack.includes(term)) {
        score -= 100; // Heavy penalty for colonization-related content
        console.log(`[ImageScoring] Heavy penalty for colonization term "${term}"`);
      }
    }
    const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subj) || /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(text);
    
    if (isHistoricalContent) {
      for (const obj of irrelevantObjects) {
        if (haystack.includes(obj)) {
          score -= 200; // Much heavier penalty for irrelevant objects in historical content
          console.log(`[ImageScoring] Heavy penalty for irrelevant object "${obj}" in historical content`);
        }
      }
    }

    // Strong bonus for exact subject phrase appearing
    if (subj && haystack.includes(subj)) score += 30;

    // Enhanced token-based matching using full course context
    const subjectTokens = extractSearchKeywords(subj, null, 6);
    const contentTokens = extractSearchKeywords(text, null, 6);
    const courseTokens = extractSearchKeywords(courseTitle + ' ' + courseSubject, null, 6);
    const allTokens = [...new Set([...subjectTokens, ...contentTokens, ...courseTokens])];
    
    for (const tok of allTokens) {
      if (tok.length < 3) continue;
      if (haystack.includes(tok)) score += 4;
    }

    // Course context relevance scoring - more lenient approach
    if (courseTitle || courseSubject) {
      const courseContextTerms = extractSearchKeywords(courseTitle + ' ' + courseSubject, null, 10);
      const hasCourseContextMatch = courseContextTerms.some(term => 
        term.length > 3 && haystack.includes(term)
      );
      
      if (!hasCourseContextMatch) {
        // Reduced penalty - only -10 instead of -50
        score -= 10;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ImageScoring] Minor penalty for image not matching course context: ${courseTitle}`);
        }
      } else {
        score += 20; // Bonus for images that match course context
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ImageScoring] Bonus for image matching course context: ${courseTitle}`);
        }
      }
    }

    // Additional bonus for historical content relevance
    if (isHistoricalContent) {
      // Bonus for historical terms in the image metadata
      const historicalTerms = ['ancient', 'historical', 'archaeological', 'classical', 'antiquity', 'rome', 'roman', 'greek', 'egypt', 'medieval', 'renaissance'];
      for (const term of historicalTerms) {
        if (haystack.includes(term)) {
          score += 8; // Bonus for historical relevance
        }
      }
      
      // Bonus for specific historical subjects
      if (subj.includes('rome') && haystack.includes('roman')) score += 15;
      if (subj.includes('greek') && haystack.includes('greek')) score += 15;
      if (subj.includes('egypt') && haystack.includes('egypt')) score += 15;
      if (subj.includes('medieval') && haystack.includes('medieval')) score += 15;
    }

    // Check if this is historical/educational content that should be more permissive
    const isHistorical = subj.includes('history') || 
                        subj.includes('ancient') || 
                        subj.includes('rome') || 
                        subj.includes('greek') || 
                        subj.includes('egypt') ||
                        subj.includes('medieval') ||
                        subj.includes('renaissance');

    // Penalize dynamic negatives for the subject, but be more lenient for historical content
    const dynamicNegs = getDynamicExtraNegatives(subject || '');
    if (containsAny(haystack, dynamicNegs)) {
      if (isHistorical) {
        // For historical content, only apply heavy penalties for extreme terms
        const extremeTerms = ['nazi', 'hitler', 'swastika', 'holocaust', 'genocide', 'terrorism', 'nsfw', 'porn'];
        if (containsAny(haystack, extremeTerms)) {
          score -= 50; // Heavy penalty for extreme terms
        } else {
          score -= 5; // Light penalty for other terms in historical context
        }
      } else {
        score -= 25; // Full penalty for non-historical content
      }
    }

    // Prefer larger images when available
    const w = Number(meta?.imageWidth || 0);
    const h = Number(meta?.imageHeight || 0);
    if (w * h > 600 * 400) score += 5;
    if (w * h > 1000 * 700) score += 5;

    // Reduced bonus for Wikipedia images in historical contexts
    if (isHistoricalContent && page.includes('wikimedia.org')) {
      score += 15; // Reduced bonus for Wikipedia images in historical content (was 50)
      console.log(`[ImageScoring] Reduced bonus for Wikipedia image in historical content`);
    }

    return Math.max(0, score);
  } catch {
    return 0;
  }
}

// Ban candidates that are known-bad or contextually inappropriate
function isBannedImageCandidate(candidate, courseId) {
  try {
    const url = String(candidate?.imageUrl || candidate?.url || '').toLowerCase();
    const pageURL = String(candidate?.pageURL || '').toLowerCase();
    const title = String(candidate?.imageTitle || candidate?.title || '').toLowerCase();
    const desc = String(candidate?.description || '').toLowerCase();
    const uploader = String(candidate?.uploader || '').toLowerCase();

    // Disallow data/blob schemes and explicitly disallowed substrings
    if (!url.startsWith('http://') && !url.startsWith('https://')) return true;
    if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => url.includes(s))) return true;
    if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => pageURL.includes(s))) return true;

    // If we have course context, apply dynamic negatives using the course title as subject
    try {
      if (courseId && Array.isArray(db?.data?.courses)) {
        const course = db.data.courses.find((c) => c.id === courseId);
        const subject = course?.title || '';
        const haystack = `${title} ${desc} ${pageURL} ${uploader}`;
        
        // Get dynamic negatives but be more lenient for historical/educational content
        const dynamicNegs = getDynamicExtraNegatives(subject);
        
        // Check if this is historical/educational content that should be more permissive
        const isHistorical = subject.toLowerCase().includes('history') || 
                           subject.toLowerCase().includes('ancient') || 
                           subject.toLowerCase().includes('rome') || 
                           subject.toLowerCase().includes('greek') || 
                           subject.toLowerCase().includes('egypt') ||
                           subject.toLowerCase().includes('medieval') ||
                           subject.toLowerCase().includes('renaissance');
        
        // For historical content, only ban extremely inappropriate terms
        if (isHistorical) {
          const extremeNegatives = [
            'nazi', 'hitler', 'swastika', 'holocaust', 'genocide',
            'terrorism', 'extremist', 'radical', 'nsfw', 'porn',
            'explicit', 'adult content', 'violence', 'gore'
          ];
          
          if (containsAny(haystack, extremeNegatives)) {
            return true;
          }
          
          // Allow historical military terms for historical topics
          return false;
        }
        
        // For non-historical content, apply full moderation
        if (containsAny(haystack, dynamicNegs)) return true;

        // Duplicate ban: prevent same image title/url from reappearing within the course
        if (course) {
          const seenTitles = new Set();
          const seenUrls = new Set();
          for (const mod of course.modules || []) {
            for (const lsn of mod.lessons || []) {
              const t = normalizeForCompare(lsn?.image?.imageTitle || lsn?.image?.title);
              const u = normalizeUrlForCompare(lsn?.image?.imageUrl || lsn?.image?.url);
              if (t) seenTitles.add(t);
              if (u) seenUrls.add(u);
            }
          }
          if (seenTitles.has(normalizeForCompare(candidate?.imageTitle || candidate?.title))) return true;
          if (seenUrls.has(normalizeUrlForCompare(candidate?.imageUrl || candidate?.url))) return true;
        }
      }
    } catch {}

    return false;
  } catch {
    return false;
  }
}

// Single-keyword extraction for image search
function extractSearchKeywords(subject, content, maxKeywords = 4) {
  const simpleNormalize = (str) => (String(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  const STOPWORDS = new Set(['the','a','an','and','or','of','in','on','to','for','by','with','at','from','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','about','over','under','between','through','during','before','after','above','below','up','down','out','off','than','introduction','overview','lesson','chapter','period','era','history','modern']);
  const simpleTokenize = (str) => simpleNormalize(str).split(/\s+/).filter(t => t && t.length > 2 && !STOPWORDS.has(t));

  const keywords = [];

  // 1) Try the full subject phrase first (most likely to be relevant)
  const subjectPhrase = String(subject || '').trim();
  if (subjectPhrase) {
    keywords.push(subjectPhrase);
    const normalizedPhrase = simpleNormalize(subjectPhrase);
    if (normalizedPhrase && normalizedPhrase !== subjectPhrase.toLowerCase()) {
      keywords.push(normalizedPhrase);
    }
  }

  // 2) Add a couple of subject tokens
  const subjectTokens = simpleTokenize(subjectPhrase);
  for (const tok of subjectTokens) {
    if (!keywords.includes(tok)) keywords.push(tok);
    if (keywords.length >= maxKeywords) break;
  }

  // 3) Optionally add 1-2 content tokens for breadth
  if (keywords.length < maxKeywords) {
    let contentText = '';
    if (content && typeof content === 'object') {
      const parts = [content.introduction, content.main_content, content.conclusion].filter(Boolean);
      contentText = parts.join(' ');
    } else if (typeof content === 'string') {
      contentText = content;
    }
    const contentTokens = simpleTokenize(contentText);
    for (const tok of contentTokens) {
      if (!keywords.includes(tok)) keywords.push(tok);
      if (keywords.length >= maxKeywords) break;
    }
  }

  return keywords.slice(0, maxKeywords);
}

// Build refined multi-word search phrases from extracted keywords and content without hardcoding subjects
function buildRefinedSearchPhrases(subject, content, maxQueries = 10, courseTitle = '') {
  const normalize = (str) => (String(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  const STOPWORDS = new Set(['the','a','an','and','or','of','in','on','to','for','by','with','at','from','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','about','over','under','between','through','during','before','after','above','below','up','down','out','off','than','introduction','overview','lesson','chapter','era','modern','course','explores','rich','covering','political','cultural','religious']);
  const GENERIC_EVENT_WORDS = new Set(['fall','collapse','decline','rise','war','battle','revolution','crisis','empire','dynasty','state','society']);
  const tokenize = (str) => normalize(str).split(/\s+/).filter(t => t && t.length > 2 && !STOPWORDS.has(t));

  const dedupePush = (arr, value) => {
    if (value && !arr.includes(value)) arr.push(value);
  };

  const subjectPhrase = String(subject || '').trim();
  const subjectTokens = tokenize(subjectPhrase);

  // Extract proper-noun-like phrases from raw text (e.g., "Roman Republic", "Ancient Egypt")
  const extractProperNounPhrases = (text) => {
    const phrases = new Set();
    const raw = String(text || '');
    // Multi-capitalized sequences
    for (const m of raw.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g)) {
      phrases.add(m[0]);
    }
    // Single proper nouns that are likely subjects (avoid very short/common words)
    for (const m of raw.matchAll(/\b[A-Z][a-z]{3,}\b/g)) {
      phrases.add(m[0]);
    }
    return Array.from(phrases);
  };

  // Consolidate content text (prefer the main body if available)
  let contentText = '';
  if (content && typeof content === 'object') {
    contentText = content.main_content || `${content.introduction || ''} ${content.conclusion || ''}`;
  } else if (typeof content === 'string') {
    contentText = content;
  }

  const contentProperPhrases = extractProperNounPhrases(contentText);
  const subjectProperPhrases = extractProperNounPhrases(subjectPhrase);

  // Start building queries with the most specific content first
  const queries = [];

  // Always include the full subject phrase as-is and normalized
  if (subjectPhrase) {
    dedupePush(queries, subjectPhrase);
    const normalizedSubject = normalize(subjectPhrase);
    if (normalizedSubject && normalizedSubject !== subjectPhrase.toLowerCase()) {
      dedupePush(queries, normalizedSubject);
    }
  }

  // Combine descriptive subject tokens with proper-noun phrases to specialize the query
  const properPhrases = [...subjectProperPhrases, ...contentProperPhrases];
  for (const token of subjectTokens.slice(0, 3)) {
    for (const phrase of properPhrases.slice(0, 8)) {
      const combined = `${token} ${normalize(phrase)}`.trim();
      dedupePush(queries, combined);
      if (queries.length >= maxQueries) break;
    }
    if (queries.length >= maxQueries) break;
  }

  // If we still have room, include raw proper-noun phrases (normalized) as stand-alone queries
  for (const phrase of properPhrases) {
    const normPhrase = normalize(phrase);
    dedupePush(queries, normPhrase);
    if (queries.length >= maxQueries) break;
  }

  // Finally, backfill with basic keyword tokens for breadth, but avoid generic standalone event words
  const baseKeywords = extractSearchKeywords(subject, content, Math.min(6, maxQueries));
  for (const kw of baseKeywords) {
    const isGenericStandalone = GENERIC_EVENT_WORDS.has(kw.toLowerCase()) && !kw.includes(' ');
    if (isGenericStandalone) continue;
    dedupePush(queries, kw);
    if (queries.length >= maxQueries) break;
  }

  // Add historical-context variants when subject appears to reference a historical event
  const normalizedSubject = normalize(subjectPhrase);
  const looksHistoricalEvent = /\b(fall|rise|decline|collapse|revolution|war|battle)\b/i.test(subjectPhrase) && /\b(republic|empire|kingdom|dynasty|state|civilization|city)\b/i.test(subjectPhrase);
  if (normalizedSubject && looksHistoricalEvent) {
    dedupePush(queries, `${normalizedSubject} historical event`);
    dedupePush(queries, `${normalizedSubject} political history`);
    // Prefer formulations that bias away from seasons
    if (/\bfall\b/i.test(subjectPhrase) && /\bof\b/i.test(subjectPhrase)) {
      dedupePush(queries, `${normalizedSubject} history`);
    }
  }

  // Add specific historical context for better image relevance ONLY for history courses
  const isHistoryCourse = /\b(history|ancient|rome|greek|egypt|medieval|renaissance|empire|republic|kingdom|dynasty|civilization)\b/i.test(subjectPhrase) && 
                         (/\b(history|ancient|rome|greek|egypt|medieval|renaissance|empire|republic|kingdom|dynasty|civilization)\b/i.test(contentText) || 
                          /\b(history|ancient|rome|greek|egypt|medieval|renaissance|empire|republic|kingdom|dynasty|civilization)\b/i.test(courseTitle || ''));

  if (isHistoryCourse) {
    // Add historical-specific queries that are more likely to find relevant images
    for (const phrase of properPhrases.slice(0, 4)) {
      dedupePush(queries, `${phrase} ancient history`);
      dedupePush(queries, `${phrase} historical artifact`);
      dedupePush(queries, `${phrase} archaeological site`);
      if (queries.length >= maxQueries) break;
    }
    
    // Add specific historical terms to avoid generic images
    const historicalTerms = ['ancient', 'historical', 'archaeological', 'classical', 'antiquity'];
    for (const term of historicalTerms) {
      if (queries.length < maxQueries) {
        dedupePush(queries, `${normalizedSubject} ${term}`);
      }
    }
    
    // Add Egypt-specific terms for better relevance
    if (/\b(egypt|egyptian|pharaoh|pyramid|dynastic|nile)\b/i.test(subjectPhrase) || 
        /\b(egypt|egyptian|pharaoh|pyramid|dynastic|nile)\b/i.test(contentText) ||
        /\b(egypt|egyptian|pharaoh|pyramid|dynastic|nile)\b/i.test(courseTitle || '')) {
      
      const egyptTerms = ['ancient egypt', 'egyptian civilization', 'pharaoh', 'pyramid', 'nile river', 'egyptian artifact'];
      for (const term of egyptTerms) {
        if (queries.length < maxQueries) {
          dedupePush(queries, `${normalizedSubject} ${term}`);
        }
      }
      
      // Add specific Egypt-related queries
      if (queries.length < maxQueries) {
        dedupePush(queries, 'ancient egypt civilization');
        dedupePush(queries, 'egyptian pharaoh dynasty');
        dedupePush(queries, 'ancient egyptian artifact');
      }
    }
  }

  // Filter out queries that might lead to irrelevant results
  const filteredQueries = queries.filter(query => {
    const lowerQuery = query.toLowerCase();
    
    // Avoid queries that might lead to colonization-related results
    const colonizationTerms = ['colonization', 'colonial', 'colony', 'colonist', 'settler'];
    if (colonizationTerms.some(term => lowerQuery.includes(term))) {
      return false;
    }
    
    // Avoid generic terms that might lead to irrelevant results for historical content
    const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subjectPhrase);
    if (isHistoricalContent) {
      const genericTerms = ['property', 'intellectual', 'business', 'modern', 'technology', 'computer', 'software', 'digital', 'online', 'web', 'internet'];
      if (genericTerms.some(term => lowerQuery.includes(term))) {
        return false;
      }
    }
    
    return true;
  });

  return filteredQueries.slice(0, maxQueries);
}

function getPixabayApiKey() {
  return process.env.PIXABAY_API_KEY || '';
}

// Robust JSON Parser Utility (inline version for server)
class RobustJsonParser {
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
    
  

    // Strategy 1: Direct JSON parsing
    try {
      const result = JSON.parse(text);

      return result;
    } catch (error) {
      
    }

    // Strategy 2: Handle "data:" prefixes
    const cleanedText = this.removeDataPrefix(text);
    if (cleanedText !== text) {

      try {
        const result = JSON.parse(cleanedText);
        
        return result;
      } catch (error) {
        
      }
    }

    // Strategy 3: Extract JSON from markdown code blocks
    const markdownJson = this.extractJsonFromMarkdown(text);
    if (markdownJson) {

      try {
        const result = JSON.parse(markdownJson);
        
        return result;
      } catch (error) {
        
      }
    }

    // Strategy 4: Find and extract JSON object/array
    const extractedJson = this.extractJsonFromText(text);
    if (extractedJson) {

      try {
        const result = JSON.parse(extractedJson);
        
        return result;
      } catch (error) {
        
      }
    }

    // Strategy 5: Try to fix common JSON issues
    const fixedJson = this.attemptJsonFix(text);
    if (fixedJson) {

      try {
        const result = JSON.parse(fixedJson);
        
        return result;
      } catch (error) {
        
      }
    }

    console.error(`[${context}] All JSON parsing strategies failed`);
    console.error(`[${context}] Original input: ${text.substring(0, 500)}...`);
    return null;
  }

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
    
    return cleaned;
  }

  static extractJsonFromMarkdown(text) {
    if (!text || typeof text !== 'string') return null;
    
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
        if (extracted.startsWith('{') || extracted.startsWith('[')) {
          return extracted;
        }
      }
    }
    
    return null;
  }

  static extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    
    const content = text.trim();
    
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

  static attemptJsonFix(text) {
    if (!text || typeof text !== 'string') return null;
    
    let fixed = text.trim();
    
    const firstBracket = Math.min(
      fixed.indexOf('{') !== -1 ? fixed.indexOf('{') : Infinity,
      fixed.indexOf('[') !== -1 ? fixed.indexOf('[') : Infinity
    );
    
    if (firstBracket !== Infinity) {
      fixed = fixed.substring(firstBracket);
    }
    
    const lastBracket = Math.max(
      fixed.lastIndexOf('}'),
      fixed.lastIndexOf(']')
    );
    
    if (lastBracket !== -1) {
      fixed = fixed.substring(0, lastBracket + 1);
    }
    
    fixed = fixed
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    
    return fixed;
  }
}

class AIService {
  constructor(apiKey) {
    // Do not throw if missing here; image search methods do not require Mistral
    this.apiKey = apiKey || null;
    this.textGenerationEnabled = !!apiKey;
    this.maxTokens = {
      course: 4000,
      lesson: 2000,
      quiz: 1500,
      flashcard: 1000,
      search: 300
    };
    
    // Initialize bibliography database
    this.initializeBibliographyDatabase();
  }

  /**
   * Initialize bibliography database with authentic academic references
   */
  initializeBibliographyDatabase() {
    this.referenceDatabase = {
      'roman history': {
        'founding of rome': [
          {
            author: 'Livy',
            title: 'Ab Urbe Condita (The History of Rome)',
            year: 'c. 27 BC',
            publisher: 'Oxford University Press',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Cornell, T.J.',
            title: 'The Beginnings of Rome: Italy and Rome from the Bronze Age to the Punic Wars (c. 1000-264 BC)',
            year: '1995',
            publisher: 'Routledge',
            type: 'academic',
            verified: true
          },
          {
            author: 'Forsythe, G.',
            title: 'A Critical History of Early Rome: From Prehistory to the First Punic War',
            year: '2005',
            publisher: 'University of California Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Dionysius of Halicarnassus',
            title: 'Roman Antiquities',
            year: 'c. 7 BC',
            publisher: 'Harvard University Press',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Beard, M.',
            title: 'SPQR: A History of Ancient Rome',
            year: '2015',
            publisher: 'Profile Books',
            type: 'academic',
            verified: true
          }
        ],
        'roman republic': [
          {
            author: 'Polybius',
            title: 'The Histories',
            year: 'c. 140 BC',
            publisher: 'Oxford University Press',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Cicero',
            title: 'De Re Publica (On the Republic)',
            year: '51 BC',
            publisher: 'Cambridge University Press',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Taylor, L.R.',
            title: 'Roman Voting Assemblies: From the Hannibalic War to the Dictatorship of Caesar',
            year: '1966',
            publisher: 'University of Michigan Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Beard, M., North, J., & Price, S.',
            title: 'Religions of Rome: A History',
            year: '1998',
            publisher: 'Cambridge University Press',
            type: 'academic',
            verified: true
          }
        ],
        'roman empire': [
          {
            author: 'Suetonius',
            title: 'The Twelve Caesars',
            year: 'c. 121 AD',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Tacitus',
            title: 'The Annals of Imperial Rome',
            year: 'c. 116 AD',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Goldsworthy, A.',
            title: 'Caesar: Life of a Colossus',
            year: '2006',
            publisher: 'Yale University Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Galinsky, K.',
            title: 'Augustan Culture: An Interpretive Introduction',
            year: '1996',
            publisher: 'Princeton University Press',
            type: 'academic',
            verified: true
          }
        ]
      },
      'greek history': {
        'ancient greece': [
          {
            author: 'Herodotus',
            title: 'The Histories',
            year: 'c. 440 BC',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Thucydides',
            title: 'History of the Peloponnesian War',
            year: 'c. 400 BC',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Hornblower, S.',
            title: 'The Greek World, 479-323 BC',
            year: '2011',
            publisher: 'Routledge',
            type: 'academic',
            verified: true
          },
          {
            author: 'Cartledge, P.',
            title: 'Ancient Greece: A History in Eleven Cities',
            year: '2009',
            publisher: 'Oxford University Press',
            type: 'academic',
            verified: true
          }
        ],
        'athenian democracy': [
          {
            author: 'Aristotle',
            title: 'Politics',
            year: 'c. 350 BC',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Ober, J.',
            title: 'Democracy and Knowledge: Innovation and Learning in Classical Athens',
            year: '2008',
            publisher: 'Princeton University Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Hansen, M.H.',
            title: 'The Athenian Democracy in the Age of Demosthenes',
            year: '1991',
            publisher: 'University of Oklahoma Press',
            type: 'academic',
            verified: true
          }
        ]
      },
      'egyptian history': {
        'ancient egypt': [
          {
            author: 'Herodotus',
            title: 'The Histories',
            year: 'c. 440 BC',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Shaw, I.',
            title: 'The Oxford History of Ancient Egypt',
            year: '2000',
            publisher: 'Oxford University Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Kemp, B.J.',
            title: 'Ancient Egypt: Anatomy of a Civilization',
            year: '2006',
            publisher: 'Routledge',
            type: 'academic',
            verified: true
          }
        ]
      },
      'medieval history': {
        'medieval europe': [
          {
            author: 'Bede',
            title: 'Ecclesiastical History of the English People',
            year: 'c. 731 AD',
            publisher: 'Penguin Classics',
            type: 'primary source',
            verified: true
          },
          {
            author: 'Bloch, M.',
            title: 'Feudal Society',
            year: '1961',
            publisher: 'University of Chicago Press',
            type: 'academic',
            verified: true
          },
          {
            author: 'Le Goff, J.',
            title: 'Medieval Civilization, 400-1500',
            year: '1988',
            publisher: 'Blackwell',
            type: 'academic',
            verified: true
          }
        ]
      }
    };

    // Default references - only authentic, verified sources
    this.defaultReferences = [
      {
        author: 'Encyclopaedia Britannica',
        title: 'Academic Edition',
        year: '2024',
        publisher: 'Encyclopaedia Britannica, Inc.',
        type: 'reference',
        verified: true
      },
      {
        author: 'Oxford University Press',
        title: 'Oxford Classical Dictionary',
        year: '2012',
        publisher: 'Oxford University Press',
        type: 'reference',
        verified: true
      }
    ];
  }

  async _makeApiRequest(prompt, intent, expectJsonResponse = true) {
    if (!this.apiKey) {
      throw new ApiError(500, 'MISTRAL_API_KEY is not configured on the server.');
    }
    let attempt = 0;
    const maxRetries = Infinity; // Never give up - retry indefinitely
    const maxParseRetries = 5; // Maximum retries for parsing failures

    while (attempt < maxRetries) {
      try {
        const cleanPrompt = prompt.trim();
        const actualMaxTokens = this.maxTokens[intent] || this.maxTokens.course;
        
    
        
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [{ role: 'user', content: cleanPrompt }],
            temperature: 0.6,
            max_tokens: actualMaxTokens,
            response_format: expectJsonResponse ? { type: "json_object" } : undefined
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            const delay = 1500 * Math.pow(2, attempt);
            console.warn(`[AIService] Rate limited on attempt ${attempt + 1}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
          const errorText = await response.text();
          console.error(`[AIService] API request failed with status ${response.status}: ${errorText}`);
  
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempt++;
          continue;
        }

        // Read response as text first to handle potential "data:" prefixes
        const responseText = await response.text();
        if (process.env.NODE_ENV === 'development') {
        console.log(`[AIService] Raw response received: ${responseText.substring(0, 200)}...`);
      }
        
        // Use robust JSON parser with retry mechanism for parsing failures
        let data = null;
        let parseAttempt = 0;
        
        while (parseAttempt < maxParseRetries && !data) {
          try {
            data = RobustJsonParser.parse(responseText, `Mistral API Response (parse attempt ${parseAttempt + 1})`);
            
            if (!data) {
              console.warn(`[AIService] JSON parsing failed on attempt ${parseAttempt + 1}, retrying...`);
              parseAttempt++;
              
              if (parseAttempt < maxParseRetries) {
                // Wait before retrying parsing
                await new Promise(resolve => setTimeout(resolve, 1000 * parseAttempt));
              }
            }
          } catch (parseError) {
            console.error(`[AIService] JSON parsing error on attempt ${parseAttempt + 1}:`, parseError.message);
            parseAttempt++;
            
            if (parseAttempt < maxParseRetries) {
              // Wait before retrying parsing
              await new Promise(resolve => setTimeout(resolve, 1000 * parseAttempt));
            }
          }
        }
        
        if (!data) {
          console.error(`[AIService] All JSON parsing attempts failed after ${maxParseRetries} tries`);
          console.error(`[AIService] Raw response: ${responseText.substring(0, 1000)}...`);
          
          // If parsing completely fails, retry the entire API request
          console.log(`[AIService] Retrying entire API request due to parsing failure...`);
          attempt++;
          
          // Exponential backoff for parsing failures
          const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
          console.log(`[AIService] Waiting ${delay}ms before retrying API request...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const content = data.choices[0]?.message?.content;

        if (expectJsonResponse) {
          const jsonString = this._extractJson(content);
          if (!jsonString) {
            console.warn(`[AIService] Non-JSON response received on attempt ${attempt + 1}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempt++;
            continue;
          }
          console.log(`[AIService] Successful API response for ${intent} on attempt ${attempt + 1}`);
          return JSON.parse(jsonString);
        }
        
        console.log(`[AIService] Successful API response for ${intent} on attempt ${attempt + 1}`);
        return content.trim();

      } catch (error) {
        console.error(`[AIService] Attempt ${attempt + 1} failed for intent ${intent}:`, error.message);
        attempt++;
        
        // Exponential backoff with a maximum delay of 30 seconds
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[AIService] Retrying in ${delay}ms... (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  _extractJson(text) {
    console.log(`[AIService] Extracting JSON from AI content: ${text.substring(0, 200)}...`);
    
    // Use robust JSON parser for AI content
    const parsed = RobustJsonParser.parse(text, 'AI Content Response');
    
    if (parsed) {
      console.log(`[AIService] JSON extraction successful, keys:`, Object.keys(parsed));
      return JSON.stringify(parsed);
    }
    
    console.error(`[AIService] Could not extract valid JSON from AI content`);
    return null;
  }
  
  constructCoursePrompt(topic, difficulty, numModules, numLessonsPerModule) {
    return `Generate a comprehensive course structure for a ${difficulty} level course on "${topic}". Create exactly ${numModules} modules, each with exactly ${numLessonsPerModule} lessons.
+Safety rules: If the topic involves NSFW/sexual content, child exploitation, illegal instruction (e.g., weapons/bomb making), hate speech, or extremist/terrorist propaganda, you must refuse and output a JSON object with {"error":"Content policy violation"}.
+The course must be suitable for general educational audiences and avoid graphic details. Present sensitive historical topics neutrally and factually.
The entire response MUST be a single, minified, valid JSON object.
Do NOT use markdown, comments, or any text outside the JSON object.
The root object must have keys "title", "description", "subject", "difficultyLevel", and "modules".
Each object in the "modules" array must have "title", "description", and a "lessons" array.
Each object in the "lessons" array must have "title" and a "key_terms" array.
Each object in the "key_terms" array must have "term" and "definition" fields.
CRITICAL: You MUST generate 5-10 key terms for each lesson. Each key term must have both "term" and "definition" fields.
The key_terms should be important concepts, people, places, or ideas that students need to learn from each lesson.
Example of a lesson object: {"title": "The Roman Republic", "key_terms": [{"term": "Senate", "definition": "The advisory council of Rome composed of patricians."}, {"term": "Consuls", "definition": "The two annually elected magistrates who replaced the king."}, {"term": "Plebeians", "definition": "The common people of Rome."}]}
Final JSON structure must follow this model: {"title":"...","description":"...","subject":"${topic}","difficultyLevel":"${difficulty}","modules":[{"title":"...","description":"...","lessons":[{"title":"...","key_terms":[{"term":"...","definition":"..."}]}]}]}`;
  }

  constructLessonPrompt(courseTitle, moduleTitle, lessonTitle, keyTerms) {
    const keyTermsString = keyTerms.map(kt => `"${kt.term}"`).join(', ');
    return `Generate rich, detailed content for a lesson titled "${lessonTitle}" within the module "${moduleTitle}" for the course "${courseTitle}".

Safety rules: Do not produce NSFW/sexual content, illegal instruction, hate speech, or extremist/terrorist propaganda. If requested content violates policy, respond only with: "REFUSED: Content policy violation".
For sensitive topics, write neutrally, factually, and age-appropriately. Do not include graphic details.

IMPORTANT: Your response MUST contain exactly three parts separated by "|||---|||" (three pipes, three dashes, three pipes):

1. INTRODUCTION: A brief, engaging overview of the lesson's topic and objectives (2-3 sentences)
2. MAIN CONTENT: The core lesson material with detailed explanations. Use newline characters for paragraphs. You MUST naturally incorporate and explain these key terms: ${keyTermsString}. 

CRITICAL FORMATTING RULES:
- Wrap ALL instances of key terms with EXACTLY two asterisks on each side: **term**
- NEVER use single asterisks (*) for key terms
- NEVER use more than two asterisks on each side
- Examples: **Polis**, **Acropolis**, **Democracy** (correct)
- Examples: *Polis*, *Polis**, **Polis* (incorrect)

3. CONCLUSION: A summary of the key takeaways and a brief look ahead (2-3 sentences)

FORMAT EXAMPLE:
Introduction text here.|||---|||Main content with **key concepts** like **${keyTerms[0]?.term || 'Etruscans'}** and detailed explanations. Use **proper formatting** for all key terms.|||---|||Conclusion text here.

Do NOT use JSON, markdown headers, or any other formatting. Only use the exact separator "|||---|||" between the three parts.`;
  }
  
  constructDefinitionPrompt(lessonContext, lessonTitle, term) {
    const context = typeof lessonContext === 'string' ? lessonContext : (lessonContext?.main_content || '');
    return `Given the context of the lesson "${lessonTitle}", define the term "**${term}**".
The definition should be concise (2-3 sentences) and easy for a beginner to understand.
Do not use JSON or special formatting. Just provide the plain text definition.
Context: "${context.substring(0, 1000)}..."`;
  }
  
  async generateDefinitionForTerm(lessonContext, lessonTitle, term) {
    // This function is now effectively a fallback and can be simplified or removed
    // if the main generation process is reliable.
    const prompt = this.constructDefinitionPrompt(lessonContext, lessonTitle, term);
    try {
      const definition = await this._makeApiRequest(prompt, 'flashcard', false);
      return definition.replace(/definition:|term:|["\\]/gi, '').trim();
    } catch (error) {
      console.error(`Error generating definition for "${term}":`, error);
      return `Could not generate a definition for "${term}".`;
    }
  }

  createBasicFlashcardsFromContent(content, lessonTitle) {
    try {
      console.log(`[AIService] Creating basic flashcards from content for: ${lessonTitle}`);
      
      // Combine all content parts
      const fullContent = `${content.introduction || ''} ${content.main_content || ''} ${content.conclusion || ''}`;
      
      // Extract key terms using simple text analysis
      const keyTerms = this.extractKeyTermsFromText(fullContent, lessonTitle);
      
      // Create flashcards from extracted terms
      const flashcards = keyTerms.map(term => ({
        term: term.term,
        definition: term.definition || `A key concept from ${lessonTitle}`
      }));
      
      console.log(`[AIService] Created ${flashcards.length} basic flashcards for: ${lessonTitle}`);
      return flashcards;
    } catch (error) {
      console.error(`[AIService] Error creating basic flashcards for ${lessonTitle}:`, error);
      return [];
    }
  }

  extractKeyTermsFromText(text, lessonTitle) {
    try {
      // Extract terms that are wrapped in ** (bold markdown)
      const boldTerms = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map(match => match[1]);
      
      // Extract capitalized terms that might be important
      const capitalizedTerms = [...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)].map(match => match[0]);
      
      // Combine and deduplicate terms
      const allTerms = [...new Set([...boldTerms, ...capitalizedTerms])];
      
      // Filter out common words and short terms
      const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'];
      const filteredTerms = allTerms.filter(term => 
        term.length > 3 && 
        !commonWords.includes(term.toLowerCase()) &&
        !term.match(/^\d+$/) // Not just numbers
      );
      
      // Take the first 5-8 most relevant terms
      const keyTerms = filteredTerms.slice(0, 8).map(term => ({
        term: term,
        definition: `A key concept from ${lessonTitle}`
      }));
      
      return keyTerms;
    } catch (error) {
      console.error(`[AIService] Error extracting key terms from text:`, error);
      return [];
    }
  }
  
  // --- IMAGE SEARCH SETTINGS & HELPERS ---
  // Fetch a Wikipedia thumbnail for a given subject/title
  async fetchWikipediaImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    if (!subject) return null;
    console.log(`[AIService] Fetching Wikipedia image (simplified) for "${subject}", excluding ${usedImageTitles.length} titles and ${usedImageUrls.length} urls.`);

    try {
        const base = 'https://en.wikipedia.org/w/api.php';
        const keywords = buildRefinedSearchPhrases(subject, content, options.relaxed ? 4 : 2, options.courseTitle || '');
        const dynamicNegs = getDynamicExtraNegatives(subject);
        const mainText = extractMainLessonText(content);
        
        console.log(`[AIService] Wikipedia search keywords for "${subject}":`, keywords);

        const candidates = [];

        for (const kw of keywords) {
          // Use generator=search with pageimages to directly get page thumbnails
          const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            generator: 'search',
            gsrsearch: kw,
            gsrlimit: options.relaxed ? '3' : '2',
            prop: 'pageimages|pageterms',
            piprop: 'thumbnail',
            pithumbsize: '800',
            origin: '*'
          });

          const resp = await fetchWithTimeout(`${base}?${params.toString()}`);
          if (!resp.ok) {
            continue;
          }
          const data = await resp.json();
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          if (!pages.length) continue;

          for (const page of pages) {
            const thumb = page?.thumbnail?.source;
            if (!thumb) continue;
            if (usedImageUrls.includes(thumb)) continue;
            if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => (thumb || '').includes(s))) continue;

            const pageTitle = page.title || subject;
            if (Array.isArray(usedImageTitles) && usedImageTitles.includes(pageTitle)) continue;
            const description = page?.terms?.description?.[0] || pageTitle;
            const pageURL = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
            const haystack = `${pageTitle} ${description} ${pageURL}`.toLowerCase();
            if (containsAny(haystack, dynamicNegs)) continue;

            const imageTitle = pageTitle;
            const attribution = `Image by ${page?.terms?.description?.[0] ? page.terms.description[0] : 'Unknown'} via Wikipedia`;

            const candidate = {
              imageTitle,
              imageUrl: thumb,
              pageURL,
              attribution,
              description,
              uploader: undefined,
            };
            const score = computeImageRelevanceScore(subject, mainText, {
              title: imageTitle,
              description,
              pageURL,
              uploader: undefined
            }, courseContext);
            
            // Debug logging for Wikipedia scoring
            if (candidates.length < 5) { // Only log first few candidates to avoid spam
              console.log(`[AIService] Wikipedia candidate scoring for "${subject}":`, {
                imageTitle,
                description: description.substring(0, 100),
                score,
                haystack: haystack.substring(0, 100)
              });
            }
            
            // Add a small bias to Wikipedia images to prioritize them
            const biasedScore = score + 3;
            candidates.push({ ...candidate, score: biasedScore });
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          console.log(`[AIService] Selected Wikipedia image for "${subject}" (score ${best.score}): ${best.imageUrl}`);
          console.log(`[AIService] Wikipedia candidates found: ${candidates.length}, best score: ${best.score}`);
          const originalUrl = best.imageUrl;
                  // Return fast proxied URL for maximum speed
        return { ...best, imageUrl: `/api/image/fast?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
        }

        console.warn(`[AIService] No Wikipedia image found for "${subject}" after simplified search.`);
        
        // Try a more relaxed search as final fallback
        if (!options.relaxed) {
          console.log(`[AIService] Trying relaxed Wikipedia search for "${subject}"`);
          return this.fetchWikipediaImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: true }, courseContext);
        }
        
        return null;
        
    } catch (err) {
        console.warn(`[AIService] Wikipedia image fetch failed for "${subject}":`, err.message);
        return null;
    }
  }
  
  async fetchPixabayImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    const apiKey = getPixabayApiKey();
    if (!apiKey) {
      return null;
    }
    try {
      const queries = buildRefinedSearchPhrases(subject, content, options.relaxed ? 4 : 2);
      // Ensure the full subject phrase is first
      if (String(subject || '').trim()) {
        const s = String(subject).trim();
        if (!queries.includes(s)) queries.unshift(s);
      }

      const perPage = options.relaxed ? 20 : 10;
      const dynamicNegs = getDynamicExtraNegatives(subject);
      const mainText = extractMainLessonText(content);

      const candidates = [];

      for (const q of queries) {
        const params = new URLSearchParams({
          key: apiKey,
          q,
          image_type: 'photo',
          safesearch: 'true',
          per_page: String(perPage),
          orientation: 'horizontal',
        });
        const url = `https://pixabay.com/api/?${params.toString()}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) {
          continue;
        }
        const data = await resp.json();
        const hits = Array.isArray(data?.hits) ? data.hits : [];
        for (const h of hits) {
          const candidateUrl = h.webformatURL || h.largeImageURL || h.previewURL;
          if (!candidateUrl) continue;
          if (usedImageUrls.includes(candidateUrl)) continue;
          if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => (candidateUrl || '').includes(s))) continue;

          const imageTitle = (h.tags || '').split(',')[0]?.trim() || `${subject}`;
          if (Array.isArray(usedImageTitles) && usedImageTitles.includes(imageTitle)) continue;
          const pageURL = h.pageURL || 'https://pixabay.com';
          const description = h.tags || imageTitle;
          const haystack = `${imageTitle} ${description} ${pageURL} ${h.user || ''}`.toLowerCase();
          if (containsAny(haystack, dynamicNegs)) continue;

          const attribution = `Image by ${h.user || 'Unknown'} via Pixabay`;

          const candidate = {
            imageTitle,
            imageUrl: candidateUrl,
            pageURL,
            attribution,
            description,
            uploader: h.user || undefined,
            imageWidth: h.imageWidth,
            imageHeight: h.imageHeight,
          };
          const score = computeImageRelevanceScore(subject, mainText, {
            title: imageTitle,
            description,
            pageURL,
            uploader: h.user,
            imageWidth: h.imageWidth,
            imageHeight: h.imageHeight,
          }, courseContext);
          
          // Debug logging for scoring issues
          if (candidates.length < 5) { // Only log first few candidates to avoid spam
            console.log(`[AIService] Pixabay candidate scoring for "${subject}":`, {
              imageTitle,
              description: description.substring(0, 100),
              score,
              haystack: haystack.substring(0, 100)
            });
          }
          
          candidates.push({ ...candidate, score });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        console.log(`[AIService] Selected Pixabay image for "${subject}" (score ${best.score}): ${best.imageUrl}`);
        console.log(`[AIService] Pixabay candidates found: ${candidates.length}, best score: ${best.score}`);
        const originalUrl = best.imageUrl;
        // Return fast proxied URL for maximum speed
        return { ...best, imageUrl: `/api/image/fast?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
      }
      return null;
    } catch (e) {
      console.warn('[AIService] Pixabay fetch failed:', e.message);
      return null;
    }
  }

  // Met Museum image service removed
   
  // Try Wikipedia first; then Pixabay - optimized with parallel execution and caching
  async fetchRelevantImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    // Create cache key for this search
    const cacheKey = `image_search_${subject}_${options.relaxed ? 'relaxed' : 'strict'}`;
    
    // Check if we have a cached result
    if (global.imageSearchCache && global.imageSearchCache.has(cacheKey)) {
      const cached = global.imageSearchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        console.log(`[AIService] Using cached image search result for "${subject}"`);
        return cached.result;
      } else {
        global.imageSearchCache.delete(cacheKey);
      }
    }
    
    // Initialize cache if it doesn't exist
    if (!global.imageSearchCache) {
      global.imageSearchCache = new Map();
    }
    
    // Execute both searches in parallel with timeout
    const searchPromises = [
      this.fetchWikipediaImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext),
      this.fetchPixabayImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext)
    ];
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Image search timeout')), 15000); // 15 second timeout
    });
    
    try {
      const [wiki, pixa] = await Promise.race([
        Promise.all(searchPromises),
        timeoutPromise
      ]);
    
    // Check if this is historical/educational content
    const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subject) || 
                               /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(content);
    
    // More balanced scoring between providers
    if (wiki && pixa) {
      const wikiScore = Number(wiki.score || 0);
      const pixaScore = Number(pixa.score || 0);
      
      if (isHistoricalContent) {
        // For historical content, use a more balanced threshold (5+ points instead of 15+)
        if (pixaScore > wikiScore + 5) {
          console.log(`[AIService] Selected Pixabay image (score ${pixaScore}) over Wikipedia (score ${wikiScore}) for historical content - balanced scoring`);
          return pixa;
        } else {
          console.log(`[AIService] Selected Wikipedia image (score ${wikiScore}) over Pixabay (score ${pixaScore}) for historical content - balanced scoring`);
          return wiki;
        }
      } else {
        // For non-historical content, use an even more balanced threshold (1+ points instead of 2+)
        if (pixaScore > wikiScore + 1) {
          console.log(`[AIService] Selected Pixabay image (score ${pixaScore}) over Wikipedia (score ${wikiScore}) due to balanced scoring`);
          return pixa;
        } else {
          console.log(`[AIService] Selected Wikipedia image (score ${wikiScore}) over Pixabay (score ${pixaScore}) - balanced scoring`);
          return wiki;
        }
      }
    }
    
    // If only one service returned results, use that
    let result = null;
    if (wiki) {
      console.log(`[AIService] Using Wikipedia image only (score ${wiki.score || 0})`);
      result = wiki;
    } else if (pixa) {
      console.log(`[AIService] Using Pixabay image only (score ${pixa.score || 0}) - Wikipedia failed`);
      result = pixa;
    } else {
      console.log(`[AIService] No images found from either service`);
      result = null;
    }
    
    // Cache the result
    global.imageSearchCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
    
    } catch (error) {
      console.warn(`[AIService] Image search failed for "${subject}":`, error.message);
      
      // Cache null result to prevent repeated failures
      global.imageSearchCache.set(cacheKey, {
        result: null,
        timestamp: Date.now()
      });
      
      return null;
    }
  }
  
  async generateCourse(topic, difficulty, numModules, numLessonsPerModule = 3, generationId = null) {
    let courseWithIds;
    const usedImageTitles = new Set(); // Track used image titles for this course
    const usedImageUrls = new Set();   // Track used image URLs for this course
    try {
  
      
      const coursePrompt = this.constructCoursePrompt(topic, difficulty, numModules, numLessonsPerModule);
      const courseStructure = await this._makeApiRequest(coursePrompt, 'course', true);
      
      if (!courseStructure || !this.validateCourseStructure(courseStructure)) {
        throw new ApiError(500, 'The AI returned an invalid course structure. Please try again.');
      }
      
      courseWithIds = this.assignIdsToModulesAndLessons(courseStructure);
  

      // Process modules in parallel for better performance
      const modulePromises = courseWithIds.modules.map(async (module, mIdx) => {
        if (!module.lessons) return;
        
        // Send module start progress update
        if (global.progressCallback) {
          global.progressCallback({
            type: 'module_start',
            moduleIndex: mIdx,
            totalModules: courseWithIds.modules.length,
            moduleTitle: module.title
          });
        }
        
        // Process lessons in parallel within each module
        const lessonPromises = module.lessons.map(async (lesson, lIdx) => {
          // Send lesson start progress update
          if (global.progressCallback) {
            global.progressCallback({
              type: 'lesson_start',
              lessonIndex: lIdx,
              totalLessons: module.lessons.length,
              lessonTitle: lesson.title
            });
          }
          
          // Update session progress for real-time updates
          if (generationId) {
            const session = global.generationSessions.get(generationId);
            if (session) {
              session.progress = {
                ...session.progress,
                stage: 'generating',
                currentModule: mIdx + 1,
                totalModules: courseWithIds.modules.length,
                currentLesson: lIdx + 1,
                totalLessons: module.lessons.length,
                message: `Generating Lesson ${lIdx + 1}: ${lesson.title}`,
                details: [...(session.progress.details || []), {
                  timestamp: new Date().toISOString(),
                  message: `Starting Lesson ${lIdx + 1}: ${lesson.title}`
                }]
              };
            }
          }
          
          try {
            // Generate lesson content with infinite retries
            const lessonPrompt = this.constructLessonPrompt(courseWithIds.title, module.title, lesson.title, lesson.key_terms || []);
            const lessonContentString = await this._makeApiRequest(lessonPrompt, 'lesson', false);
            
            // Optimized parsing logic with reduced logging
            let parts = lessonContentString.split(/\s*\|\|\|---\|\|\|\s*/);
            
            // If we don't get exactly 3 parts, try alternative separators
            if (parts.length !== 3) {
              // Try different separator patterns
              const separators = [
                /\s*---\s*/,
                /\s*\|\|\|\s*/,
                /\s*###\s*/,
                /\s*##\s*/,
                /\s*\*\*\*Introduction\*\*\*|\s*\*\*\*Main Content\*\*\*|\s*\*\*\*Conclusion\*\*\*/,
                /\s*Introduction:|\s*Main Content:|\s*Conclusion:/
              ];
              
              for (const separator of separators) {
                const testParts = lessonContentString.split(separator);
                if (testParts.length >= 3) {
                  parts = testParts;
                  break;
                }
              }
            }
            
            if (parts.length >= 3) {
              lesson.content = {
                introduction: parts[0].trim(),
                main_content: parts[1].trim(),
                conclusion: parts[2].trim(),
              };
            } else if (parts.length === 2) {
              // Handle case where we only get 2 parts
              lesson.content = {
                introduction: parts[0].trim(),
                main_content: parts[1].trim(),
                conclusion: `Summary of ${lesson.title}`
              };
            } else {
              // Fallback for when the AI doesn't produce structured content
              
              // Try to intelligently split the content
              const content = lessonContentString.trim();
              const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
              
              if (sentences.length >= 3) {
                const introEnd = Math.ceil(sentences.length * 0.2);
                const mainEnd = Math.ceil(sentences.length * 0.8);
                
                lesson.content = {
                  introduction: sentences.slice(0, introEnd).join('. ') + '.',
                  main_content: sentences.slice(introEnd, mainEnd).join('. ') + '.',
                  conclusion: sentences.slice(mainEnd).join('. ') + '.'
                };
              } else {
                // Last resort: clean the string and place it all in main_content
                const cleanedContent = lessonContentString.replace(/[|\-*#]/g, ' ').replace(/\s+/g, ' ').trim();
                lesson.content = {
                  introduction: `Overview of ${lesson.title}`,
                  main_content: cleanedContent,
                  conclusion: `Summary of ${lesson.title}`
                };
              }
            }

    
            
            // Optimized image fetching - only fetch if cache exists, otherwise skip for speed
            try {
              const cacheKey = buildImageCacheKey(lesson.title, lesson.content);
              const cached = findCachedImageByKey(cacheKey);
              if (cached) {
                lesson.image = { imageTitle: cached.title, imageUrl: cached.localUrl, pageURL: cached.pageURL, attribution: cached.attribution };
              } else {
                // Skip image fetching for speed - can be added later via background process
                lesson.image = null;
              }
            } catch (imageErr) {
              lesson.image = null;
            }
            
            // Send lesson complete progress update
            if (global.progressCallback) {
              global.progressCallback({
                type: 'lesson_complete',
                lessonTitle: lesson.title,
                message: `Completed: ${lesson.title}`
              });
            }
            
            // Update session progress for lesson completion
            if (generationId) {
              const session = global.generationSessions.get(generationId);
              if (session) {
                session.progress = {
                  ...session.progress,
                  stage: 'generating',
                  currentModule: mIdx + 1,
                  totalModules: courseWithIds.modules.length,
                  currentLesson: lIdx + 1,
                  totalLessons: module.lessons.length,
                  message: `Completed Lesson: ${lesson.title}`,
                  details: [...(session.progress.details || []), {
                    timestamp: new Date().toISOString(),
                    message: `✅ Completed: ${lesson.title}`
                  }]
                };
              }
            }
            
            // Generate quiz with minimal delay
            try {
              const quizQuestions = await this.generateQuiz(lesson.content, lesson.title);
              lesson.quiz = quizQuestions || [];
            } catch (quizError) {
              lesson.quiz = []; // Continue without quiz
            }

            // Generate bibliography for the lesson
            try {
              const bibliography = this.generateBibliography(lesson.title, courseWithIds.subject || 'history', 5);
              const bibliographyMarkdown = this.formatBibliographyAsMarkdown(bibliography);
              
              // Clean up any malformed References sections that might exist in the content
              lesson.content.conclusion = this.cleanupMalformedReferences(lesson.content.conclusion);
              
              // Append bibliography to the conclusion
              if (bibliographyMarkdown) {
                lesson.content.conclusion += bibliographyMarkdown;
              }
              
              // Store bibliography data for potential future use
              lesson.bibliography = bibliography;
            } catch (bibliographyError) {
              console.error(`[AIService] Bibliography generation failed for "${lesson.title}":`, bibliographyError.message);
              // Continue without bibliography
            }
            
            // Flashcards are now generated directly from the lesson's key_terms array
            
            // First try to generate flashcards from key_terms
            lesson.flashcards = (lesson.key_terms || []).map(kt => ({
                term: kt.term,
                definition: kt.definition
            })).filter(fc => fc.term && fc.definition);

            // If no flashcards were generated from key_terms, create them from lesson content
            if (lesson.flashcards.length === 0) {
                try {
                    // Extract key terms from lesson content using AI
                    const contentText = `${lesson.content.introduction} ${lesson.content.main_content} ${lesson.content.conclusion}`;
                    const flashcardPrompt = `Based on this lesson content, generate 5-8 key terms with definitions that would be important for students to learn. Return as JSON array with objects containing "term" and "definition" fields.

Lesson content: ${contentText.substring(0, 2000)}

Return only the JSON array, no other text.`;
                    
                    const generatedFlashcards = await this._makeApiRequest(flashcardPrompt, 'flashcard', true);
                    if (Array.isArray(generatedFlashcards) && generatedFlashcards.length > 0) {
                        lesson.flashcards = generatedFlashcards.filter(fc => fc.term && fc.definition);
                    } else {
                        // If AI generation fails, create basic flashcards from content
                        lesson.flashcards = this.createBasicFlashcardsFromContent(lesson.content, lesson.title);
                    }
                } catch (fallbackError) {
                    // Create basic flashcards as final fallback
                    lesson.flashcards = this.createBasicFlashcardsFromContent(lesson.content, lesson.title);
                }
            }
            
            if (global.progressCallback) {
                global.progressCallback({ type: 'flashcards_complete', lessonTitle: lesson.title, message: `Flashcards created for: ${lesson.title}` });
            }

            // Removed artificial delay for faster processing
            
          } catch (lessonError) {
            console.error(`[AIService] Lesson generation failed for "${lesson.title}":`, lessonError.message);
            // Create fallback content instead of failing completely
            lesson.content = {
              introduction: `Introduction to ${lesson.title}`,
              main_content: `Content for ${lesson.title} will be generated. Please try again later.`,
              conclusion: `Summary of ${lesson.title}`
            };
            lesson.quiz = [];
            lesson.flashcards = [];
          }
        });
        
        // Wait for all lessons in this module to complete
        await Promise.all(lessonPromises);
      });
      
      // Wait for all modules to complete
      await Promise.all(modulePromises);
      
      console.log(`[AIService] Course generation completed successfully for "${topic}"`);
      
      // Send course complete progress update
      /*
      if (global.progressCallback) {
        global.progressCallback({
          type: 'course_complete',
          courseTitle: courseWithIds.title
        });
      }
      */
      
      // ... (inside your course generation logic)
      for (const module of courseWithIds.modules) {
          for (const lesson of module.lessons) {
              if (lesson.image && lesson.image.imageUrl) {
                  const imagePath = path.join(__dirname, 'public', lesson.image.imageUrl);
                  // lesson.image.placeholder = await generatePlaceholder(imagePath);
              }
          }
      }
      // ... (return the modified course object)
      
      return courseWithIds;

    } catch (error) {
      console.error(`[AIService] Critical failure in course generation for "${topic}":`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `An unexpected error occurred during course generation: ${error.message}`);
    }
  }

  validateCourseStructure(data) {
    console.log(`[AIService] Validating course structure:`, {
      hasData: !!data,
      isObject: typeof data === 'object',
      hasTitle: !!data?.title,
      hasModules: Array.isArray(data?.modules),
      modulesCount: data?.modules?.length
    });
    
    if (!data || typeof data !== 'object') {
      console.error(`[AIService] Course structure validation failed: data is not an object`);
      return false;
    }
    
    if (!data.title) {
      console.error(`[AIService] Course structure validation failed: missing title`);
      return false;
    }
    
    if (!Array.isArray(data.modules)) {
      console.error(`[AIService] Course structure validation failed: modules is not an array`);
      return false;
    }
    
    for (let i = 0; i < data.modules.length; i++) {
      const module = data.modules[i];
      console.log(`[AIService] Validating module ${i + 1}:`, {
        hasTitle: !!module?.title,
        hasLessons: Array.isArray(module?.lessons),
        lessonsCount: module?.lessons?.length
      });
      
      if (!module.title) {
        console.error(`[AIService] Course structure validation failed: module ${i + 1} missing title`);
        return false;
      }
      
      if (!Array.isArray(module.lessons)) {
        console.error(`[AIService] Course structure validation failed: module ${i + 1} lessons is not an array`);
        return false;
      }
      
      for (let j = 0; j < module.lessons.length; j++) {
        const lesson = module.lessons[j];
        console.log(`[AIService] Validating lesson ${j + 1} in module ${i + 1}:`, {
          hasTitle: !!lesson?.title,
          hasKeyTerms: Array.isArray(lesson?.key_terms),
          keyTermsCount: lesson?.key_terms?.length || 0
        });
        
        if (!lesson.title) {
          console.error(`[AIService] Course structure validation failed: lesson ${j + 1} in module ${i + 1} missing title`);
          return false;
        }
        
        // Check if key_terms exist and have proper structure
        if (!Array.isArray(lesson.key_terms)) {
          console.warn(`[AIService] Lesson ${j + 1} in module ${i + 1} has no key_terms array`);
        } else if (lesson.key_terms.length === 0) {
          console.warn(`[AIService] Lesson ${j + 1} in module ${i + 1} has empty key_terms array`);
        } else {
          // Validate each key term has term and definition
          lesson.key_terms.forEach((kt, ktIdx) => {
            if (!kt.term || !kt.definition) {
              console.warn(`[AIService] Key term ${ktIdx + 1} in lesson ${j + 1} missing term or definition:`, kt);
            }
          });
        }
      }
    }
    
    console.log(`[AIService] Course structure validation successful`);
    return true;
  }

  assignIdsToModulesAndLessons(courseData) {
    if (!courseData || !courseData.modules) return courseData;
    courseData.modules.forEach((module, mIdx) => {
      module.id = `module_${mIdx}_${Date.now()}`;
      // Set module locking: first module is unlocked, others are locked
      module.isLocked = mIdx > 0;
      // Add missing properties for module unlock system
      module.isCompleted = false;
      module.perfectQuizzes = 0;
      module.progress = 0;
      module.order = mIdx;
      module.quizScores = {};
      
      if (module.lessons && Array.isArray(module.lessons)) {
        module.lessons.forEach((lesson, lIdx) => {
          lesson.id = `lesson_${mIdx}_${lIdx}_${Date.now()}`;
          // Add missing properties for lesson tracking
          lesson.isCompleted = false;
          lesson.order = lIdx;
          lesson.quizScores = {};
          lesson.lastQuizScore = null;
        });
      }
    });
    
    // Validate that all modules have proper isLocked properties
    this.validateModuleLocking(courseData);
    
    return courseData;
  }

  validateModuleLocking(courseData) {
    if (!courseData || !courseData.modules) return;
    
    // Ensure all modules have required properties for unlock system
    courseData.modules.forEach((module, mIdx) => {
      if (module.isCompleted === undefined) module.isCompleted = false;
      if (module.perfectQuizzes === undefined) module.perfectQuizzes = 0;
      if (module.progress === undefined) module.progress = 0;
      if (module.order === undefined) module.order = mIdx;
      if (!module.quizScores) module.quizScores = {};
      
      if (module.lessons && Array.isArray(module.lessons)) {
        module.lessons.forEach((lesson, lIdx) => {
          if (lesson.isCompleted === undefined) lesson.isCompleted = false;
          if (lesson.order === undefined) lesson.order = lIdx;
          if (!lesson.quizScores) lesson.quizScores = {};
          if (lesson.lastQuizScore === undefined) lesson.lastQuizScore = null;
        });
      }
    });
    
    // Module locking is now handled by the frontend unlock logic based on quiz scores
    console.log(`[AIService] Course validation complete for ${courseData.modules.length} modules with unlock system properties`);
  }
  
  constructQuizPrompt(content, lessonTitle) {
    return `Based on the lesson content for "${lessonTitle}", generate a 5-question multiple-choice quiz.
The entire response MUST be a single, valid JSON array of objects.
Each object must have "question" (string), "options" (array of 4 strings), and "answer" (string, one of the options).
Ensure the "answer" is an exact match to one of the options. Do NOT use markdown.
Lesson:
Introduction: ${content.introduction}
Main Content: ${content.main_content}
Conclusion: ${content.conclusion}`;
  }

  async generateQuiz(content, lessonTitle) {
    const prompt = this.constructQuizPrompt(content, lessonTitle);
    try {
      const result = await this._makeApiRequest(prompt, 'quiz', true);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`Error generating quiz for "${lessonTitle}":`, error);
      return []; // Return empty on failure
    }
  }

  /**
   * Generate bibliography for a lesson based on topic and subject
   * @param {string} topic - The lesson topic
   * @param {string} subject - The course subject
   * @param {number} numReferences - Number of references to generate (default: 5)
   * @returns {Array} Array of reference objects
   */
  generateBibliography(topic, subject, numReferences = 5) {
    const normalizedSubject = subject.toLowerCase();
    const normalizedTopic = topic.toLowerCase();
    
    let references = [];
    
    // Try to find specific references for the subject and topic
    if (this.referenceDatabase[normalizedSubject]) {
      // Look for exact topic match
      if (this.referenceDatabase[normalizedSubject][normalizedTopic]) {
        references = [...this.referenceDatabase[normalizedSubject][normalizedTopic]];
      } else {
        // Look for partial topic matches
        for (const [dbTopic, topicRefs] of Object.entries(this.referenceDatabase[normalizedSubject])) {
          if (normalizedTopic.includes(dbTopic) || dbTopic.includes(normalizedTopic)) {
            references = [...topicRefs];
            break;
          }
        }
      }
    }
    
    // If no specific references found, try to find subject-level references
    if (references.length === 0 && this.referenceDatabase[normalizedSubject]) {
      // Get all references for the subject
      for (const topicRefs of Object.values(this.referenceDatabase[normalizedSubject])) {
        references.push(...topicRefs);
      }
    }
    
    // Add default references if we don't have enough
    if (references.length < numReferences) {
      references.push(...this.defaultReferences);
    }
    
    // Limit to requested number and shuffle for variety
    references = this.shuffleArray(references).slice(0, numReferences);
    
    // Format references with proper citation numbers
    return references.map((ref, index) => ({
      ...ref,
      citationNumber: index + 1
    }));
  }

  /**
   * Format bibliography as markdown to be appended to lesson content
   * @param {Array} bibliography - Array of reference objects
   * @returns {string} Formatted markdown bibliography
   */
  formatBibliographyAsMarkdown(bibliography) {
    if (!bibliography || bibliography.length === 0) {
      return '';
    }

    let markdown = '\n\n## References\n\n';
    
    bibliography.forEach((ref, index) => {
      // Ensure proper citation number
      const citationNumber = ref.citationNumber || (index + 1);
      
      // Format citation with proper spacing and punctuation
      const citation = `[${citationNumber}] ${ref.author}. (${ref.year}). *${ref.title}*. ${ref.publisher}.`;
      
      // Add citation with proper line breaks
      markdown += citation + '\n\n';
    });
    
    return markdown;
  }

  /**
   * Shuffle array for variety in reference selection
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Verify that all references are authentic
   * @param {Array} bibliography - Bibliography array to verify
   * @returns {boolean} True if all references are verified
   */
  verifyBibliography(bibliography) {
    return bibliography.every(ref => ref.verified === true);
  }

  /**
   * Clean up malformed References sections in content
   * @param {string} content - Content that might contain malformed References
   * @returns {string} Cleaned content
   */
  cleanupMalformedReferences(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }

    return content
      // Fix the specific problematic pattern: "## References [1] ... [2] ..."
      .replace(/## References\s*\[(\d+)\]/g, '\n## References\n\n[$1]')
      // Ensure each citation is on its own line
      .replace(/\]\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Add proper line breaks between citations
      .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Clean up any remaining issues
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple line breaks
  }
}

// --- SETUP AND CONFIGURATION ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DATABASE SETUP ---
const dbFilePath = path.join(__dirname, 'db.json');

// Ensure the data directory exists
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new JSONFile(dbFilePath);
const defaultData = { users: [], courses: [], images: [], imageCache: [] };
const db = new Low(adapter, defaultData);

async function initializeDatabase() {
  try {
    // read() will create the file with defaultData if it doesn't exist or load existing data.
    await db.read();
    console.log(`[DB Debug] db.read() completed. File exists: ${fs.existsSync(dbFilePath)}`);
    // Belt-and-suspenders: ensure data object and arrays are present after read.
    db.data = db.data || defaultData;
    db.data.users = db.data.users || [];
    db.data.courses = db.data.courses || [];
    db.data.imageCache = db.data.imageCache || [];
    db.data.images = db.data.images || [];
    
    // Load courses from individual files if they exist
    await loadCoursesFromFiles();
    
    // Clean up orphaned course files
    await cleanupOrphanedCourseFiles();
    
    console.log('[DB] Database initialized successfully at:', dbFilePath);
  } catch (error) {
    console.error('[DB_ERROR] Could not initialize database:', error);
    process.exit(1);
  }
}

async function loadCoursesFromFiles() {
  try {
    const coursesDir = path.join(__dirname, 'data', 'courses');
    if (!fs.existsSync(coursesDir)) {
      console.log('[DB] No courses directory found, skipping course loading');
      return;
    }

    const courseFiles = fs.readdirSync(coursesDir).filter(file => file.endsWith('.json') && file !== 'undefined.json');
    console.log(`[DB] Found ${courseFiles.length} course files to load`);

    for (const file of courseFiles) {
      try {
        const filePath = path.join(coursesDir, file);
        const courseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Check if course already exists in database
        const existingCourse = db.data.courses.find(c => c.id === courseData.id);
        if (!existingCourse) {
          db.data.courses.push(courseData);
          console.log(`[DB] Loaded course: ${courseData.title} (${courseData.id})`);
        } else {
          console.log(`[DB] Course already exists: ${courseData.title} (${courseData.id})`);
        }
      } catch (error) {
        console.error(`[DB_ERROR] Failed to load course file ${file}:`, error.message);
      }
    }

    console.log(`[DB] Total courses in database: ${db.data.courses.length}`);
  } catch (error) {
    console.error('[DB_ERROR] Failed to load courses from files:', error);
  }
}

/**
 * Save a course to an individual JSON file
 * @param {Object} course - The course object to save
 */
async function saveCourseToFile(course) {
  try {
    const coursesDir = path.join(__dirname, 'data', 'courses');
    
    // Ensure courses directory exists
    if (!fs.existsSync(coursesDir)) {
      fs.mkdirSync(coursesDir, { recursive: true });
    }
    
    const courseFileName = `${course.id}.json`;
    const courseFilePath = path.join(coursesDir, courseFileName);
    
    // Save course to file
    fs.writeFileSync(courseFilePath, JSON.stringify(course, null, 2));
    console.log(`[DB] Saved course to file: ${courseFileName}`);
    
  } catch (error) {
    console.error(`[DB_ERROR] Failed to save course file for ${course.id}:`, error.message);
    // Don't throw error to avoid breaking course creation
  }
}

/**
 * Clean up orphaned course files (files that exist but don't have corresponding database entries)
 */
async function cleanupOrphanedCourseFiles() {
  try {
    const coursesDir = path.join(__dirname, 'data', 'courses');
    
    if (!fs.existsSync(coursesDir)) {
      return;
    }
    
    const courseFiles = fs.readdirSync(coursesDir).filter(file => file.endsWith('.json') && file !== 'undefined.json');
    const databaseCourseIds = db.data.courses.map(c => c.id);
    
    let orphanedCount = 0;
    
    for (const file of courseFiles) {
      const courseId = file.replace('.json', '');
      
      if (!databaseCourseIds.includes(courseId)) {
        const filePath = path.join(coursesDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`[DB] Cleaned up orphaned course file: ${file}`);
          orphanedCount++;
        } catch (error) {
          console.error(`[DB_ERROR] Failed to delete orphaned file ${file}:`, error.message);
        }
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`[DB] Cleaned up ${orphanedCount} orphaned course files`);
    }
    
  } catch (error) {
    console.error('[DB_ERROR] Failed to cleanup orphaned course files:', error.message);
  }
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://test.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'test-key';
const supabaseRedirectUrl = process.env.SUPABASE_REDIRECT_URL || 'https://thediscourse.ai';

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url-here' || supabaseAnonKey === 'your-supabase-anon-key-here') {
    console.warn('[SERVER_WARN] Supabase configuration is missing or invalid. Authentication will be disabled.');
    console.warn('[SERVER_WARN] Please check your environment variables or .env file.');
    console.warn(`[SERVER_DEBUG] SUPABASE_URL: ${supabaseUrl ? 'SET' : 'NOT SET'}`);
    console.warn(`[SERVER_DEBUG] VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
    console.warn(`[SERVER_DEBUG] SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'NOT SET'}`);
    console.warn(`[SERVER_DEBUG] VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);
    console.warn(`[SERVER_DEBUG] SUPABASE_REDIRECT_URL: ${supabaseRedirectUrl}`);
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                redirectTo: supabaseRedirectUrl,
            },
        });
        console.log('[SERVER] Supabase client initialized successfully');
        console.log(`[SERVER] Supabase redirect URL: ${supabaseRedirectUrl}`);
    } catch (error) {
        console.error('[SERVER_ERROR] Failed to initialize Supabase client:', error.message);
        supabase = null;
    }
}

// Helper to get user by id
// This function is no longer needed as we use req.user from the middleware.

// --- MIDDLEWARE ---

// Enhanced authentication middleware with Supabase token verification
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('[AUTH] Authentication attempt:', {
      path: req.path,
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
    });

    if (!token) {
      console.log('[AUTH] No token provided for:', req.path);
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Dev-mode fallback: accept tokens like "dev:<userId>" when Supabase is not configured
    if (!supabase && token.startsWith('dev:')) {
      const userId = token.slice(4);
      const dbUser = db.data.users.find(u => u.id === userId);
      if (!dbUser) {
        return res.status(401).json({ error: 'User not found in local database', code: 'USER_NOT_FOUND' });
      }
      req.user = dbUser;
      return next();
    }

    // Verify token using Supabase
    if (!supabase) {
      console.error('[AUTH_ERROR] Supabase client not initialized');
      return res.status(500).json({ 
        error: 'Authentication service not configured',
        code: 'AUTH_SERVICE_ERROR'
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('[AUTH] Supabase token verification failed for:', req.path, 'Error:', error?.message || 'No user data');
      
      let errorMessage = 'Invalid or expired token';
      let errorCode = 'TOKEN_INVALID';
      
      if (error?.message?.includes('expired')) {
        errorMessage = 'Token has expired. Please log in again.';
        errorCode = 'TOKEN_EXPIRED';
      } else if (error?.message?.includes('invalid')) {
        errorMessage = 'Invalid token. Please log in again.';
        errorCode = 'TOKEN_SIGNATURE_INVALID';
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        code: errorCode
      });
    }

    // Find user in local database to ensure they exist and have current data
    const dbUser = db.data.users.find(u => u.id === user.id);
    if (!dbUser) {
      console.log('[AUTH] User not found in local database:', user.id);
      return res.status(401).json({ 
        error: 'User not found in local database',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update req.user with fresh data from database
    req.user = dbUser;
    if (SHOULD_LOG_AUTH) {
      console.log('[AUTH] User authenticated:', {
        id: dbUser.id,
        email: dbUser.email,
        path: req.path,
        credits: dbUser.courseCredits
      });
    }
    next();
  } catch (error) {
    console.error('[AUTH_ERROR] Unexpected error in authenticateToken:', error);
    return res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Admin guard (if ADMIN_EMAILS is empty, allow any authenticated user)
const requireAdminIfConfigured = (req, res, next) => {
  if (ADMIN_EMAILS.size === 0) return next();
  const email = req.user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.has(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- API ROUTES ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiService: {
      configured: !!global.aiService,
      hasApiKey: !!(process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY),
      ready: !!(global.aiService && global.aiService.apiKey)
    }
  });
});

// AI service test endpoint
app.get('/api/test-ai', async (req, res) => {
  if (!global.aiService) {
    return res.status(503).json({
        status: 'error',
        message: 'AI service is not configured on the server.',
        configured: false,
        details: 'MISTRAL_API_KEY environment variable is not set or invalid',
        solution: 'Get a valid API key from https://console.mistral.ai/ and set MISTRAL_API_KEY environment variable'
    });
  }
  try {
    const testPrompt = 'Generate a simple test response. Just say "AI service is working correctly."';
    const response = await global.aiService._makeApiRequest(testPrompt, 'search', false);
    
    res.json({
      status: 'success',
      message: 'AI service appears to be working.',
      configured: true,
      testResponse: response,
    });
  } catch (error) {
    console.error('[AI Test] Error:', error);
    
    let errorDetails = {
      status: 'error',
      message: error.message,
      configured: true, // It's configured, but the request failed
      errorType: 'api_request_failed'
    };
    
    // Provide specific guidance based on error type
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      errorDetails.errorType = 'invalid_api_key';
      errorDetails.solution = 'The Mistral API key is invalid or expired. Get a new key from https://console.mistral.ai/';
    } else if (error.message.includes('429') || error.message.includes('Rate limited')) {
      errorDetails.errorType = 'rate_limited';
      errorDetails.solution = 'API rate limit exceeded. Wait a moment and try again.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
      errorDetails.errorType = 'network_error';
      errorDetails.solution = 'Network connectivity issue. Check your internet connection.';
    }
    
    res.status(500).json(errorDetails);
  }
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'Server is working!', 
    timestamp: new Date().toISOString(),
    endpoints: {
      imageSearch: '/api/image-search/search',
      test: '/api/test'
    }
  });
});

// Test endpoint for Stripe configuration
app.get('/api/test-stripe', (req, res) => {
  res.json({ 
    stripeConfigured: !!stripe,
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
  });
});

// Test endpoint for checkout session (without authentication)
app.get('/api/test-checkout', (req, res) => {
  res.json({ 
    message: 'Checkout endpoint is accessible',
    stripeConfigured: !!stripe,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/ai/generate', authenticateToken, async (req, res, next) => {
    if (!global.aiService) {
        return next(new ApiError(503, 'AI service is not configured.'));
    }

    try {
        const { prompt, intent, expectJsonResponse = true } = req.body;
        if (!prompt || !intent) {
            throw new ApiError(400, 'Missing required parameters: prompt, intent.');
        }

        const result = await global.aiService._makeApiRequest(prompt, intent, expectJsonResponse);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, gdprConsent, policyVersion } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Require explicit GDPR consent and a policy version
    if (gdprConsent !== true || !policyVersion) {
      return res.status(400).json({ 
        error: 'You must accept the Privacy Policy to create an account.',
        code: 'GDPR_CONSENT_REQUIRED'
      });
    }

    // Log registration attempt for debugging
    console.log(`[AUTH] Registration attempt for email: ${email}`);
    
    // Check for common blocked email domains (removed example.com for testing)
    const blockedDomains = [
      'test.com', 'temp.com', 'fake.com', 'disposable.com', '10minutemail.com',
      'guerrillamail.com', 'mailinator.com', 'tempmail.org', 'throwaway.email',
      'yopmail.com', 'getnada.com', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
      'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
      'fakeinbox.com', 'mailnesia.com', 'maildrop.cc', 'mailmetrash.com',
      'trashmail.com', 'tempr.email', 'tmpeml.com', 'tmpmail.org', 'tmpmail.net',
      'example.com', 'example.org', 'example.net', 'localhost.com', 'test.org',
      'invalid.com', 'nonexistent.com', 'dummy.com', 'placeholder.com'
    ];
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (blockedDomains.includes(emailDomain)) {
      console.warn(`[AUTH] Blocked email domain attempted: ${emailDomain}`);
      return res.status(400).json({ 
        error: 'Invalid email domain. Please use a valid email address.',
        code: 'email_domain_blocked'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format. Please enter a valid email address.',
        code: 'email_format_invalid'
      });
    }

    // Additional email validation checks
    const emailParts = email.split('@');
    const localPart = emailParts[0];
    const domainPart = emailParts[1];
    
    // Check for common invalid patterns
    if (localPart.length < 2 || localPart.length > 64) {
      return res.status(400).json({ 
        error: 'Email address is too short or too long.',
        code: 'email_length_invalid'
      });
    }
    
    if (domainPart.length < 3 || domainPart.length > 253) {
      return res.status(400).json({ 
        error: 'Invalid email domain.',
        code: 'email_domain_invalid'
      });
    }
    
    // Check for common disposable email patterns
    const disposablePatterns = [
      /^temp/, /^test/, /^fake/, /^dummy/, /^throwaway/, /^spam/, /^trash/,
      /^tmp/, /^disposable/, /^example/, /^sample/, /^demo/, /^placeholder/
    ];
    
    if (disposablePatterns.some(pattern => pattern.test(localPart.toLowerCase()))) {
      return res.status(400).json({ 
        error: 'Please use a valid email address from a real provider.',
        code: 'email_disposable_pattern'
      });
    }

    // --- Supabase Registration ---
    console.log(`[AUTH] Attempting Supabase registration for: ${email}`);
    console.log(`[AUTH] Supabase URL: ${supabaseUrl}`);
    console.log(`[AUTH] Supabase Key configured: ${supabaseAnonKey ? 'YES' : 'NO'}`);
    
    let data = { user: null, session: null };
    let error = null;
    if (supabase) {
      const resp = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name,
            gdpr_policy_version: policyVersion,
            gdpr_consent_at: new Date().toISOString()
          },
          emailRedirectTo: supabaseRedirectUrl
        }
      });
      data = resp.data;
      error = resp.error;
    }

    if (error) {
      // Enhanced error logging
      console.error('[AUTH] Supabase registration error:', {
        status: error.status,
        code: error.code,
        message: error.message,
        email: email,
        timestamp: new Date().toISOString()
      });
      
      // Handle specific error types with better user feedback
      if (error.code === 'email_address_invalid') {
        return res.status(400).json({ 
          error: 'Invalid email address. Please use a valid email from a real provider.',
          code: error.code 
        });
      }
      
      if (error.code === 'email_exists' || error.message.includes('User already registered')) {
        return res.status(400).json({ 
          error: 'An account with this email already exists. Please try logging in instead.',
          code: 'user_exists'
        });
      }
      
      if (error.code === 'signup_disabled') {
        return res.status(400).json({ 
          error: 'Account registration is currently disabled. Please contact support.',
          code: error.code 
        });
      }
      
      if (error.status === 401) {
        console.error('[AUTH] 401 Unauthorized - Possible Supabase configuration issue');
        return res.status(500).json({ 
          error: 'Authentication service configuration error. Please try again later.',
          code: 'auth_config_error'
        });
      }
      
      // Generic error response
      return res.status(500).json({ 
        error: 'Failed to register user. Please try again later.',
        code: error.code || 'registration_failed'
      });
    }

    if (!data.user) {
        console.error('[AUTH] Registration succeeded but no user data returned');
        return res.status(500).json({ error: 'Registration failed: User data not returned' });
    }
    
    console.log(`[AUTH] Registration successful for user: ${data.user.id}`);
      
    // --- Local DB User Creation (for credits) ---
    // This part remains to manage app-specific data like credits
    const localUser = {
      id: data.user.id,
      email: data.user.email,
      name: name,
      createdAt: new Date().toISOString(),
      courseCredits: 1, // New users get 1 free course generation
      gdprConsent: {
        accepted: true,
        policyVersion: policyVersion,
        acceptedAt: new Date().toISOString(),
        ip: (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim(),
        userAgent: req.headers['user-agent'] || ''
      }
    };
    db.data.users.push(localUser);
    await db.write();

    // Return a dev token when Supabase is not configured
    const token = supabase ? data.session?.access_token : `dev:${localUser.id}`;
    res.status(201).json({ 
        message: supabase ? 'Registration successful. Please check your email to confirm your account.' : 'Registration successful (dev mode).',
        token,
        user: {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            courseCredits: localUser.courseCredits,
            gdprConsent: localUser.gdprConsent
        }
    });

  } catch (error) {
    console.error('Registration process error:', error);
    res.status(500).json({ error: 'An unexpected error occurred during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('[LOGIN] Login attempt for email:', email);
    console.log('[LOGIN] Supabase configured:', !!supabase);

    // --- Supabase Login (or dev fallback) ---
    let data = { user: null, session: null };
    let error = null;
    if (supabase) {
      const resp = await supabase.auth.signInWithPassword({ email, password });
      data = resp.data;
      error = resp.error;
    } else {
      // Dev mode: create/find local user and issue dev token
      let local = db.data.users.find(u => u.email === email);
      if (!local) {
        local = { id: `dev_${Date.now()}`, email, name: email.split('@')[0], createdAt: new Date().toISOString(), courseCredits: 1 };
        db.data.users.push(local);
        await db.write();
      }
      data.user = { id: local.id, email: local.email, user_metadata: { name: local.name } };
      data.session = { access_token: `dev:${local.id}` };
    }

    if (error) {
      console.error('Supabase login error:', error);
      
      // Check for specific unconfirmed email error
      if (error.message && (
        error.message.includes('Email not confirmed') ||
        error.message.includes('not confirmed') ||
        error.message.includes('confirm your email') ||
        error.message.includes('email_confirmed_at') ||
        error.message.includes('unconfirmed')
      )) {
        return res.status(401).json({ 
          error: 'Please confirm your email address before signing in. Check your inbox and spam folder for the confirmation link.',
          code: 'EMAIL_NOT_CONFIRMED'
        });
      }
      
      // Check for invalid credentials error
      if (error.code === 'invalid_credentials' || error.message.includes('Invalid login credentials')) {
        return res.status(401).json({ 
          error: 'Invalid email or password. Please check your credentials and try again.',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      return res.status(401).json({ error: 'Invalid credentials', details: error.message });
    }

    if (!data.user || !data.session) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
      
    // --- Local User Sync ---
    // Ensure local user exists and has credits
    let localUser = db.data.users.find((u) => u.id === data.user.id);
    if (!localUser) {
        localUser = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email.split('@')[0],
            createdAt: new Date().toISOString(),
            courseCredits: 1
        };
        db.data.users.push(localUser);
        await db.write();
    } else {
        // Only ensure credits exist, don't force minimum of 1
        if (localUser.courseCredits === undefined || localUser.courseCredits === null) {
            localUser.courseCredits = 1;
            await db.write();
        }
    }

    res.json({ 
        message: 'Login successful',
        token: data.session.access_token,
        user: {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            courseCredits: localUser.courseCredits,
        }
    });

  } catch (error) {
    console.error('Login process error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  // The user object is attached by authenticateToken middleware
  const user = req.user;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  // Return safe fields from the local database user record
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    courseCredits: user.courseCredits,
  });
});

// Get current user info (for Supabase users)
// This route is now protected and will return user data
app.get('/api/user/current', authenticateToken, (req, res) => {
  try {
    if (req.user) {
      const { id, email, name, courseCredits } = req.user;
      return res.json({ id, email, name, courseCredits });
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(200).json(null);

    if (token.startsWith('dev:')) {
      const userId = token.slice(4);
      const dbUser = db.data.users.find(u => u.id === userId);
      if (dbUser) {
        const { id, email, name, courseCredits } = dbUser;
        return res.json({ id, email, name, courseCredits });
      }
      return res.status(200).json(null);
    }

    return res.status(200).json(null);
  } catch (e) {
    console.warn('[Auth] /api/user/current fallback error:', e.message);
    return res.status(200).json(null);
  }
});

// Debug endpoint to check user credits
app.get('/api/debug/credits', authenticateToken, (req, res) => {
  const user = req.user;
  const dbUser = db.data.users.find(u => u.id === user.id);
  
  console.log(`[DEBUG] User credits check for ${user.id}:`, {
    reqUserCredits: user.courseCredits,
    dbUserCredits: dbUser?.courseCredits,
    dbUserFound: !!dbUser,
    allUsers: db.data.users.map(u => ({ id: u.id, email: u.email, credits: u.courseCredits }))
  });
  
  res.json({
    reqUser: {
      id: user.id,
      email: user.email,
      courseCredits: user.courseCredits
    },
    dbUser: dbUser ? {
      id: dbUser.id,
      email: dbUser.email,
      courseCredits: dbUser.courseCredits
    } : null,
    allUsers: db.data.users.map(u => ({ id: u.id, email: u.email, credits: u.courseCredits }))
  });
});

// Temporary endpoint to reset credits for testing
app.post('/api/debug/reset-credits', authenticateToken, async (req, res) => {
  const user = req.user;
  const dbUser = db.data.users.find(u => u.id === user.id);
  
  if (dbUser) {
    dbUser.courseCredits = 5; // Give 5 credits for testing
    await db.write();
    console.log(`[DEBUG] Reset credits for user ${user.id} to 5`);
  }
  
  res.json({
    message: 'Credits reset to 5 for testing',
    user: {
      id: user.id,
      email: user.email,
      courseCredits: dbUser?.courseCredits || 5
    }
  });
});

// Add credits to specific user by email
app.post('/api/debug/add-credits', async (req, res) => {
  try {
    const { email, credits = 10 } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = db.data.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldCredits = user.courseCredits || 0;
    user.courseCredits = oldCredits + credits;
    await db.write();
    
    console.log(`[DEBUG] Added ${credits} credits to user ${email}. Old: ${oldCredits}, New: ${user.courseCredits}`);
    
    res.json({
      message: `Added ${credits} credits to ${email}`,
      user: {
        id: user.id,
        email: user.email,
        oldCredits: oldCredits,
        newCredits: user.courseCredits
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

app.get('/api/courses/saved', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    console.log(`[API] Fetching saved courses for user ${userId} (${userEmail})`);
    
    // First, try to find courses with the current user ID
    let userCourses = db.data.courses.filter(c => c.userId === userId);
    
    // If no courses found, check if there are courses with the same email but different user ID
    // This handles the migration from old user ID format to Supabase UUID
    if (userCourses.length === 0) {
      console.log(`[API] No courses found for user ID ${userId}, checking for email-based migration`);
      
      // Find the existing user in the database with the same email
      const existingUser = db.data.users.find(u => u.email === userEmail);
      
      if (existingUser && existingUser.id !== userId) {
        console.log(`[API] Found existing user with same email: ${existingUser.id} vs current: ${userId}`);
        
        // Find courses that belong to the existing user
        const existingUserCourses = db.data.courses.filter(c => c.userId === existingUser.id);
        
        if (existingUserCourses.length > 0) {
          console.log(`[API] Found ${existingUserCourses.length} courses to migrate from user ${existingUser.id} to ${userId}`);
          
          // Update these courses to belong to the current user
          for (const course of existingUserCourses) {
            console.log(`[API] Migrating course ${course.id} from user ${course.userId} to user ${userId}`);
            course.userId = userId;
          }
          
          // Also update the existing user record to use the new ID
          existingUser.id = userId;
          
          // Save the updated database
          await db.write();
          console.log(`[API] Successfully migrated ${existingUserCourses.length} courses and user record to user ${userId}`);
          
          // Now get the migrated courses
          userCourses = db.data.courses.filter(c => c.userId === userId);
        }
      } else {
        console.log(`[API] No existing user found with email ${userEmail} or user ID already matches`);
      }
    }
    
    console.log(`[API] Returning ${userCourses.length} courses for user ${userId}`);
    console.log(`[API] All courses in database:`, db.data.courses.map(c => ({ id: c.id, userId: c.userId, title: c.title })));
    console.log(`[API] User courses found:`, userCourses.map(c => ({ id: c.id, userId: c.userId, title: c.title })));
    res.json(userCourses);
  } catch (error) {
    console.error(`[API_ERROR] Failed to fetch saved courses for user ${req.user.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch saved courses' });
  }
});

app.get('/api/courses/:courseId', authenticateToken, (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log(`[API] Fetching course ${courseId} for user ${req.user.id}`);
    console.log(`[API] User details:`, {
      id: req.user.id,
      email: req.user.email,
      type: typeof req.user.id
    });
    
    // Try to find the course by exact ID first
    let course = db.data.courses.find(c => c.id === courseId);
    
    // If not found by exact ID, try normalized ID (for backward compatibility)
    if (!course) {
      const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
      course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
    }
    console.log(`[API] Course found:`, {
      found: !!course,
      courseId: courseId,
      totalCourses: db.data.courses.length,
      courseIds: db.data.courses.map(c => c.id),
      allCourses: db.data.courses.map(c => ({ id: c.id, userId: c.userId, title: c.title })),
      quizScoresInfo: course ? course.modules?.map(m => ({
        moduleTitle: m.title,
        lessonsWithScores: m.lessons?.map(l => ({
          lessonTitle: l.title,
          hasQuizScores: !!l.quizScores,
          userScore: l.quizScores?.[req.user.id],
          allScores: l.quizScores
        }))
      })) : null
    });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    console.log(`[API] Course ownership check:`, {
      courseUserId: course.userId,
      courseUserIdType: typeof course.userId,
      requestUserId: req.user.id,
      requestUserIdType: typeof req.user.id,
      isEqual: course.userId === req.user.id,
      isStrictEqual: course.userId === req.user.id
    });
    
    if (course.userId !== req.user.id) {
      console.log(`[API] Access denied - course belongs to user ${course.userId}, but request is from user ${req.user.id}`);
      return res.status(403).json({ error: 'Unauthorized to access this course' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('[API] Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

app.post('/api/courses/generate', authenticateToken, async (req, res, next) => {
    if (!global.aiService) {
        return next(new ApiError(503, 'Course generation is currently disabled.'));
    }

    const user = req.user; // Use req.user directly from middleware
    if (!user) {
        return next(new ApiError(404, 'User not found.'));
    }
    
    // Add debugging to see the actual credit value
    console.log(`[COURSE_GENERATION] Credit check for user ${user.id}:`, {
        courseCredits: user.courseCredits,
        type: typeof user.courseCredits,
        isNull: user.courseCredits === null,
        isUndefined: user.courseCredits === undefined,
        isZero: user.courseCredits === 0
    });
    
    // Fix the credit check - allow 0 credits but not null/undefined
    if (user.courseCredits === null || user.courseCredits === undefined || user.courseCredits < 1) {
        console.log(`[COURSE_GENERATION] Insufficient credits for user ${user.id}: ${user.courseCredits}`);
        return next(new ApiError(402, 'Insufficient course credits.'));
    }

    try {
        const { topic, difficulty, numModules, numLessonsPerModule } = req.body;
        
        console.log(`[COURSE_GENERATION] Starting generation for user ${user.id}:`, {
            topic,
            difficulty,
            numModules,
            numLessonsPerModule
        });

        // --- CONTENT MODERATION GATE ---
        const BLOCKLIST = [
          // NSFW and explicit sexual content
          'porn', 'pornography', 'nsfw', 'erotic', 'sex', 'sexual', 'incest', 'rape', 'bestiality', 'pedophile', 'child porn',
          // Extremism/terrorism
          'terrorism', 'terrorist', 'isis', 'al-qaeda', 'daesh', 'extremist', 'extremism', 'bomb making', 'how to make a bomb',
          // Hate speech / slurs (non-exhaustive placeholder)
          'kill all', 'ethnic cleansing', 'genocide'
        ];
        const topicText = String(topic || '').toLowerCase();
        const containsBlocked = BLOCKLIST.some(term => topicText.includes(term));
        if (!topicText || containsBlocked) {
          console.warn('[COURSE_GENERATION] Blocked by content policy. Topic:', topic);
          return next(new ApiError(400, 'The requested topic violates our content policy and cannot be generated.'));
        }

        // Deduct credit before starting generation
        user.courseCredits = Math.max(0, (user.courseCredits || 0) - 1);
        await db.write();
        
        console.log(`[COURSE_GENERATION] Credit deducted for user ${user.id}. Remaining credits: ${user.courseCredits}`);

        // Generate the course using the AI service
        console.log(`[COURSE_GENERATION] Calling AI service to generate course...`);
        
        const course = await global.aiService.generateCourse(
          topic,
          difficulty,
          numModules,
          numLessonsPerModule
        );

        // Assign user ID and save course to database
        course.userId = user.id;
        course.id = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        course.createdAt = new Date().toISOString();
        course.published = false;

              // Final validation: ensure all modules have proper isLocked properties
              if (course.modules && Array.isArray(course.modules)) {
                course.modules.forEach((module, mIdx) => {
                  if (module.isLocked === undefined) {
                    module.isLocked = mIdx > 0;
                  }
                });
            }

              // Save the course to database
              db.data.courses.push(course);
              await db.write();
              
              // Save course to individual file
              await saveCourseToFile(course);

        console.log(`[COURSE_GENERATION] Course generated and saved successfully for user ${user.id}:`, {
          courseId: course.id,
          courseTitle: course.title,
          modulesCount: course.modules.length
        });

        // Return the generated course
        res.json({
          success: true,
          course: course,
          message: 'Course generated successfully',
          creditsRemaining: user.courseCredits
        });

    } catch (error) {
        console.error(`[COURSE_GENERATION] Error generating course for user ${user.id}:`, error);
        
        // Refund the credit on error
        user.courseCredits = (user.courseCredits || 0) + 1;
        await db.write();
        
        console.log(`[COURSE_GENERATION] Credit refunded for user ${user.id}. Credits: ${user.courseCredits}`);
        
        // Return appropriate error response
        if (error.message.includes('Mistral API key is not configured')) {
            return next(new ApiError(503, 'AI service is not configured. Please contact support to set up the AI service.'));
        } else if (error.message.includes('Failed to fetch')) {
            return next(new ApiError(503, 'Unable to connect to the AI service. Please check your internet connection and try again.'));
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            return next(new ApiError(429, 'AI service is currently busy. Please try again in a few minutes.'));
        } else {
            return next(new ApiError(500, 'Course generation failed. Please try again.'));
        }
    }
});

// Helper function to send progress updates via SSE
function sendProgressUpdate(userId, progressData) {
  if (global.sseConnections && global.sseConnections.has(userId)) {
    const res = global.sseConnections.get(userId);
    res.write(`data: ${JSON.stringify(progressData)}\n\n`);
  }
}

// Endpoint to check generation session status
app.get('/api/courses/generation-status/:generationId', authenticateToken, async (req, res) => {
  try {
    const { generationId } = req.params;
    const user = req.user;
    
    const session = global.generationSessions?.get(generationId);
    if (!session) {
      return res.status(404).json({ error: 'Generation session not found' });
    }
    
    if (session.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      status: session.status,
      progress: session.progress,
      startTime: session.startTime,
      course: session.course,
      courseId: session.course?.id,
      courseTitle: session.course?.title,
      creditsRemaining: session.creditsRemaining,
      error: session.error
    });
  } catch (error) {
    console.error('[GENERATION_STATUS] Error checking generation status:', error);
    res.status(500).json({ error: 'Failed to check generation status' });
  }
});

// Endpoint to check and refund credits if course generation was interrupted
app.post('/api/courses/check-generation-status', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { generationStartTime } = req.body;
    
    // Check if there are any recent incomplete courses for this user
    const recentCourses = db.data.courses.filter(course => 
      course.userId === user.id && 
      course.createdAt && 
      new Date(course.createdAt) > new Date(generationStartTime)
    );
    
    if (recentCourses.length === 0) {
      // No recent courses found, generation might have failed
      // Check if credits were deducted but course wasn't created
      // This is a simple check - in production you might want more sophisticated tracking
      res.json({ 
        status: 'no_recent_courses',
        message: 'No recent courses found. If generation failed, credits will be refunded.',
        shouldRefund: true
      });
    } else {
      res.json({ 
        status: 'courses_found',
        courses: recentCourses.map(c => ({ id: c.id, title: c.title })),
        message: 'Recent courses found, no refund needed.'
      });
    }
  } catch (error) {
    console.error('[CREDIT_CHECK] Error checking generation status:', error);
    res.status(500).json({ error: 'Failed to check generation status' });
  }
});

app.post('/api/quizzes/submit', authenticateToken, async (req, res) => {
  const { courseId, moduleId, lessonId, score } = req.body;
  const userId = req.user.id;

  console.log(`[QUIZ_SUBMIT] Received quiz submission:`, {
    courseId,
    moduleId,
    lessonId,
    score,
    userId,
    timestamp: new Date().toISOString()
  });

  if (!courseId || !moduleId || !lessonId || score === undefined) {
    console.log(`[QUIZ_SUBMIT] Missing required fields:`, { courseId, moduleId, lessonId, score });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.read();
    const course = db.data.courses.find(c => c.id === courseId && c.userId === userId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const module = course.modules.find(m => m.id === moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const lesson = module.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Update or add the quiz score for the lesson
    if (!lesson.quizScores) {
      lesson.quizScores = {};
    }
    lesson.quizScores[userId] = score;
    lesson.lastQuizScore = score; // Keep track of the last score for display

    // Check if the module is now complete.
    // A lesson is considered "passed" for progression if it either has no quiz,
    // or if the user has achieved a perfect score on its quiz.
    const lessonsWithQuizzes = module.lessons.filter(l => l.quiz && l.quiz.length > 0);
    const perfectScores = lessonsWithQuizzes.filter(l => 
      l.quizScores && l.quizScores[userId] === 5
    );
    
    // Module is complete if all lessons with quizzes have perfect scores
    const allQuizzesPerfect = lessonsWithQuizzes.length > 0 && perfectScores.length === lessonsWithQuizzes.length;

    console.log(`[QUIZ_SUBMIT] Module completion check:`, {
      moduleId,
      moduleTitle: module.title,
      totalLessons: module.lessons.length,
      lessonsWithQuizzes: lessonsWithQuizzes.length,
      perfectScores: perfectScores.length,
      allQuizzesPerfect,
      lessonScores: module.lessons.map(l => ({
        lessonId: l.id,
        lessonTitle: l.title,
        hasQuiz: !!(l.quiz && l.quiz.length > 0),
        score: l.quizScores ? l.quizScores[userId] : undefined
      }))
    });

    let unlockedNextModule = false;
    if (allQuizzesPerfect) {
      console.log(`[QUIZ_SUBMIT] All quizzes perfect! Unlocking next module...`);
      module.isCompleted = true; // Mark module as completed
      const currentModuleIndex = course.modules.findIndex(m => m.id === moduleId);
      
      console.log(`[QUIZ_SUBMIT] Module index check:`, {
        currentModuleIndex,
        totalModules: course.modules.length,
        hasNextModule: currentModuleIndex !== -1 && currentModuleIndex + 1 < course.modules.length
      });
      
      // Unlock the next module if there is one
      if (currentModuleIndex !== -1 && currentModuleIndex + 1 < course.modules.length) {
        const nextModule = course.modules[currentModuleIndex + 1];
        nextModule.isLocked = false;
        unlockedNextModule = true;
        console.log(`[QUIZ_SUBMIT] Successfully unlocked next module:`, {
          nextModuleId: nextModule.id,
          nextModuleTitle: nextModule.title
        });
      } else {
        console.log(`[QUIZ_SUBMIT] No next module to unlock or module index not found`);
      }
    } else {
      console.log(`[QUIZ_SUBMIT] Module not yet complete - not all quizzes are perfect`);
    }

    await db.write();

    console.log(`[QUIZ_SUBMIT] Sending response:`, {
      unlockedNextModule,
      moduleCompleted: allQuizzesPerfect,
      message: 'Quiz score submitted successfully'
    });

    res.json({
      message: 'Quiz score submitted successfully',
      unlockedNextModule,
      moduleCompleted: allQuizzesPerfect
    });

  } catch (error) {
    console.error('Error submitting quiz score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to generate quiz questions for existing courses
app.post('/api/courses/:courseId/generate-quizzes', authenticateToken, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  console.log(`[GENERATE_QUIZZES] Generating quizzes for course: ${courseId}`);

  try {
    await db.read();
    const course = db.data.courses.find(c => c.id === courseId && c.userId === userId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!global.aiService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    let quizzesGenerated = 0;
    let totalLessons = 0;

    // Generate quiz questions for each lesson that doesn't have them
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        totalLessons++;
        if (!lesson.quiz || lesson.quiz.length === 0) {
          try {
            console.log(`[GENERATE_QUIZZES] Generating quiz for lesson: ${lesson.title}`);
            const quizQuestions = await global.aiService.generateQuiz(lesson.content, lesson.title);
            lesson.quiz = quizQuestions;
            quizzesGenerated++;
            console.log(`[GENERATE_QUIZZES] Generated ${quizQuestions.length} questions for lesson: ${lesson.title}`);
          } catch (error) {
            console.error(`[GENERATE_QUIZZES] Failed to generate quiz for lesson ${lesson.title}:`, error);
          }
        }
      }
    }

    await db.write();

    console.log(`[GENERATE_QUIZZES] Completed. Generated quizzes for ${quizzesGenerated}/${totalLessons} lessons`);

    res.json({
      message: 'Quiz generation completed',
      quizzesGenerated,
      totalLessons,
      courseId
    });

  } catch (error) {
    console.error('[GENERATE_QUIZZES] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New image search endpoint (handler and aliases)
async function imageSearchHandler(req, res) {
  console.log(`[ImageSearch] ${req.method} ${req.path} - Headers:`, req.headers);
  console.log(`[ImageSearch] Query:`, req.query);
  console.log(`[ImageSearch] Body:`, req.body);
  
  try {
    // Ensure AIService is initialized
    if (!global.aiService) {
      console.log('[ImageSearch] Initializing AIService...');
      const key = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || '';
      global.aiService = new AIService(key);
      console.log(`[ImageSearch] AIService initialized ${key ? 'with key' : 'without key'}`);
    }
    
    // Verify AIService is working
    if (!global.aiService || typeof global.aiService.fetchRelevantImage !== 'function') {
      console.error('[ImageSearch] AIService not properly initialized');
      return res.status(500).json({ error: 'Image search service not available' });
    }
    
    console.log('[ImageSearch] AIService is ready');
  } catch (e) {
    console.error('[ImageSearch] Failed to init AI service:', e.message);
    return res.status(500).json({ error: 'Failed to initialize image search service' });
  }

  const body = req.method === 'GET' ? (req.query || {}) : ((req.body && typeof req.body === 'object') ? req.body : {});
  const lessonTitle = typeof body.lessonTitle === 'string' ? body.lessonTitle : '';
  const content = body.content;
  const usedImageTitles = Array.isArray(body.usedImageTitles) ? body.usedImageTitles : [];
  const usedImageUrls = Array.isArray(body.usedImageUrls) ? body.usedImageUrls : [];
  const courseId = body.courseId ?? null;

  // Augment used lists with already-used images from the course (server-side guarantee)
  if (courseId && Array.isArray(db?.data?.courses)) {
    try {
      const course = db.data.courses.find((c) => c.id === courseId);
      if (course) {
        const titles = new Set(usedImageTitles.map(normalizeForCompare));
        const urls = new Set(usedImageUrls.map(normalizeUrlForCompare));
        for (const mod of course.modules || []) {
          for (const lsn of mod.lessons || []) {
            const t = normalizeForCompare(lsn?.image?.imageTitle || lsn?.image?.title);
            const u = normalizeUrlForCompare(lsn?.image?.imageUrl || lsn?.image?.url);
            if (t) titles.add(t);
            if (u) urls.add(u);
          }
        }
        // Re-materialize arrays
        req.body.usedImageTitles = Array.from(titles);
        req.body.usedImageUrls = Array.from(urls);
      }
    } catch (e) {
      console.warn('[ImageSearch API] Failed to augment used image lists from course:', e.message);
    }
  }

  if (process.env.DEBUG_IMAGE === '1') {
    console.log('[ImageSearch API] Request body:', {
      lessonTitle,
      contentHasKeys: content && typeof content === 'object' ? Object.keys(content).slice(0, 5) : typeof content,
      usedImageTitlesLen: usedImageTitles.length,
      usedImageUrlsLen: usedImageUrls.length,
      courseId
    });
  }
  
  if (!lessonTitle) {
    return res.status(400).json({ error: 'Missing lessonTitle parameter' });
  }

  try {
      console.log('[ImageSearch] Starting image search for:', lessonTitle);
      
      const safeUsedTitles = Array.isArray(req.body.usedImageTitles) ? req.body.usedImageTitles : usedImageTitles;
      const safeUsedUrls = Array.isArray(req.body.usedImageUrls) ? req.body.usedImageUrls : usedImageUrls;
      
      // Get course context for better image relevance scoring
      let courseContext = {};
      if (courseId) {
        try {
          const course = db.data.courses.find(c => c.id === courseId);
          if (course) {
            courseContext = {
              title: course.title || '',
              subject: course.subject || '',
              lessonTitles: course.modules?.flatMap(m => m.lessons?.map(l => l.title) || []) || []
            };
            console.log('[ImageSearch] Course context loaded:', {
              courseTitle: courseContext.title,
              courseSubject: courseContext.subject,
              lessonCount: courseContext.lessonTitles.length
            });
          }
        } catch (courseError) {
          console.warn('[ImageSearch] Failed to load course context:', courseError.message);
        }
      }
      
      console.log('[ImageSearch] Calling fetchRelevantImage...');
      
      // Add timeout to prevent hanging requests
      const searchTimeout = 12000; // 12 seconds - increased for better reliability
      const searchPromise = global.aiService.fetchRelevantImage(lessonTitle, content, safeUsedTitles, safeUsedUrls, { relaxed: false }, courseContext);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image search timeout')), searchTimeout);
      });
      
      let imageData;
      try {
        imageData = await Promise.race([searchPromise, timeoutPromise]);
      } catch (timeoutError) {
        console.warn('[ImageSearch] Strict search timed out, trying relaxed...');
        const relaxedPromise = global.aiService.fetchRelevantImage(lessonTitle, content, safeUsedTitles, safeUsedUrls, { relaxed: true }, courseContext);
        try {
          imageData = await Promise.race([relaxedPromise, timeoutPromise]);
        } catch (relaxedTimeoutError) {
          console.error('[ImageSearch] Both strict and relaxed searches timed out');
          imageData = null;
        }
      }
      
      if (!imageData) {
          console.log('[ImageSearch] No image found with strict search, trying relaxed...');
          const relaxedPromise = global.aiService.fetchRelevantImage(lessonTitle, content, safeUsedTitles, safeUsedUrls, { relaxed: true }, courseContext);
          try {
            imageData = await Promise.race([relaxedPromise, timeoutPromise]);
          } catch (relaxedError) {
            console.error('[ImageSearch] Relaxed search also failed:', relaxedError.message);
            imageData = null;
          }
      }
      
      if (imageData) {
          console.log('[ImageSearch] Image found:', imageData);
          
          const rawAttribution = imageData.attribution || '';
          const withoutHtml = rawAttribution.replace(/<[^>]*>/g, '');
          let uploader = withoutHtml;
          const byIdx = withoutHtml.toLowerCase().indexOf('image by ');
          if (byIdx !== -1) {
            const after = withoutHtml.substring(byIdx + 'image by '.length);
            const viaIdx = after.toLowerCase().indexOf(' via');
            uploader = (viaIdx !== -1 ? after.substring(0, viaIdx) : after).trim();
          }
          uploader = uploader.replace(/^user:\s*/i, '').trim();

          if (process.env.DEBUG_IMAGE === '1') {
            console.log('[ImageSearch API] Selected image:', {
              title: imageData.imageTitle || imageData.title,
              url: imageData.imageUrl,
              pageURL: imageData.pageURL,
              attribution: imageData.attribution
            });
          }
          return res.json({
            url: imageData.imageUrl,
            title: imageData.imageTitle || imageData.title,
            pageURL: imageData.pageURL,
            attribution: imageData.attribution,
            uploader,
          });
      }

      console.log('[ImageSearch] No image found, returning placeholder');
      // Fallback: return a neutral placeholder to avoid breaking the UI
      const placeholder = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
      return res.json({
        url: `/api/image/proxy?url=${encodeURIComponent(placeholder)}`,
        title: 'Placeholder image',
        pageURL: 'https://commons.wikimedia.org',
        attribution: 'Placeholder via Wikimedia Commons',
        uploader: 'Wikimedia Commons'
      });
  } catch (e) {
      console.error('[ImageSearch API] Error:', e);
      if (process.env.DEBUG_IMAGE === '1') {
        const payload = {
          error: 'Failed to fetch image',
          message: e.message,
          stack: e?.stack
        };
        return res.status(500).json(payload);
      }
      return res.status(500).json({ error: 'Failed to fetch image' });
  }
}

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    imageService: 'available'
  });
});

// --- IMAGE PROXY ---
app.get('/api/image/proxy', (req, res) => {
  enhancedImageProxy.serveImage(req, res);
});

// Fast image proxy with caching - direct serving without processing
app.get('/api/image/fast', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (urlError) {
      console.warn(`[FastImageProxy] Invalid URL format: ${url}`);
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Security validation
    const hostname = parsedUrl.hostname;
    const allowedDomains = ['upload.wikimedia.org', 'pixabay.com', 'images.unsplash.com', 'cdn.pixabay.com'];
    if (!allowedDomains.some(domain => hostname.endsWith(domain))) {
      console.warn(`[FastImageProxy] Forbidden domain: ${hostname}`);
      return res.status(403).json({ error: 'Forbidden domain' });
    }

    // Validate image format - allow all common image formats
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
    const hasValidExtension = validImageExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().includes(ext)
    );
    
    if (!hasValidExtension) {
      console.warn(`[FastImageProxy] Invalid image format: ${parsedUrl.pathname}`);
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // Check server-side cache first
    const cacheKey = `image_${Buffer.from(url).toString('base64')}`;
    const cachedImage = global.imageCache.get(cacheKey);
    
    if (cachedImage && Date.now() - cachedImage.timestamp < global.imageCacheTimeout) {
      console.log(`[FastImageProxy] Cache HIT for: ${url.substring(0, 50)}...`);
      res.set('Content-Type', cachedImage.contentType);
      res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600');
      res.set('X-Fast-Path', 'true');
      res.set('X-Cache-Hit', 'true');
      res.set('X-Image-Size', cachedImage.buffer.length.toString());
      return res.send(cachedImage.buffer);
    }

    // Enhanced fetch with better timeout and connection settings
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Fast-Image-Proxy/1.0',
        'Accept': 'image/*',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: 8000, // Increased timeout to 8 seconds
      keepalive: true, // Enable connection pooling
      compress: true // Enable compression
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Cache the image for future requests
    global.imageCache.set(cacheKey, {
      buffer: imageBuffer,
      contentType,
      timestamp: Date.now()
    });
    
    console.log(`[FastImageProxy] Cached image: ${url.substring(0, 50)}... (${imageBuffer.length} bytes)`);
    
    // Enhanced caching headers for better performance
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600');
    res.set('X-Fast-Path', 'true');
    res.set('X-Cache-Hit', 'false');
    res.set('X-Image-Size', imageBuffer.length.toString());
    res.send(imageBuffer);

  } catch (error) {
    console.error('[FastImageProxy] Error:', error);
    res.status(500).json({ error: 'Image service unavailable' });
  }
});

// Enhanced image proxy with additional features
app.get('/api/image/enhanced', (req, res) => {
  enhancedImageProxy.serveImage(req, res);
});

// Image service health check
app.get('/api/image/health', (req, res) => {
  const health = enhancedImageProxy.getHealth();
  res.json(health);
});

// Clear image cache (admin only)
app.post('/api/image/clear-cache', (req, res) => {
  const userEmail = req.user?.email?.toLowerCase();
  if (!ADMIN_EMAILS.has(userEmail)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  enhancedImageProxy.clearCache();
  res.json({ message: 'Image cache cleared successfully' });
});

// Clean up orphaned course files (admin only)
app.post('/api/admin/cleanup-courses', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user?.email?.toLowerCase();
    if (!ADMIN_EMAILS.has(userEmail)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await cleanupOrphanedCourseFiles();
    res.json({ message: 'Course cleanup completed successfully' });
  } catch (error) {
    console.error('[ADMIN] Failed to cleanup courses:', error);
    res.status(500).json({ error: 'Failed to cleanup courses' });
  }
});

// Image search endpoint
app.post('/api/image-search/search', imageSearchHandler);

app.post('/api/courses', authenticateToken, async (req, res) => {
  try {
    const course = req.body;
    if (!course || !course.id) {
      return res.status(400).json({ error: 'Invalid course data' });
    }
    course.userId = req.user.id;
    // Check if course exists for this user
    const existingIndex = db.data.courses.findIndex(c => c.id === course.id && c.userId === req.user.id);
    if (existingIndex !== -1) {
      db.data.courses[existingIndex] = course;
    } else {
      db.data.courses.push(course);
    }
    await db.write();
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to save course:', error);
    res.status(500).json({ error: 'Failed to save course' });
  }
});

// Publish a course (make it public)
app.post('/api/courses/:courseId/publish', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    console.log(`[API] Publish request:`, {
      originalCourseId: courseId,
      userId: userId,
      availableCourseIds: db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published }))
    });
    
    // Try to find the course by exact ID first
    let course = db.data.courses.find(c => c.id === courseId);
    
    // If not found by exact ID, try normalized ID (for backward compatibility)
    if (!course) {
      const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
      course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
    }
    if (!course) {
      console.log(`[API] Course not found for publish:`, {
        requestedId: courseId,
        normalizedId: normalizedCourseId,
        availableIds: db.data.courses.map(c => c.id)
      });
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to publish this course' });
    }
    course.published = true;
    await db.write();
    console.log(`[API] Successfully published course:`, {
      id: course.id,
      title: course.title,
      userId: course.userId
    });
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to publish course:', error);
    res.status(500).json({ error: 'Failed to publish course' });
  }
});

// Unpublish a course (make it private)
app.post('/api/courses/:courseId/unpublish', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    console.log(`[API] Unpublish request:`, {
      originalCourseId: courseId,
      userId: userId,
      availableCourseIds: db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published }))
    });

    // Try to find the course by exact ID first
    let course = db.data.courses.find(c => c.id === courseId);
    
    // If not found by exact ID, try normalized ID (for backward compatibility)
    if (!course) {
      const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
      course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
    }
    if (!course) {
      console.log(`[API] Course not found for unpublish:`, {
        requestedId: courseId,
        normalizedId: normalizedCourseId,
        availableIds: db.data.courses.map(c => c.id)
      });
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to unpublish this course' });
    }
    course.published = false;
    await db.write();
    console.log(`[API] Successfully unpublished course:`, {
      id: course.id,
      title: course.title,
      userId: course.userId
    });
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to unpublish course:', error);
    res.status(500).json({ error: 'Failed to unpublish course' });
  }
});

// CAPTCHA verification endpoint for public course access
app.get('/api/captcha/verify/:courseId', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    
    const { courseId } = req.params;
    const { challenge, response, challengeKey } = req.query;
    
    // Validate courseId parameter
    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '') {
      console.error('[API] Invalid courseId parameter:', courseId);
      return res.status(400).json({
        success: false,
        message: 'Invalid course identifier.',
        requiresCaptcha: true
      });
    }
    
    // Ensure global.captchaChallenges map exists
    if (!global.captchaChallenges || !(global.captchaChallenges instanceof Map)) {
      console.error('[API] Global captchaChallenges map not initialized');
      global.captchaChallenges = new Map();
    }
    
    console.log(`[API] CAPTCHA verification for course ${courseId}:`, { challenge, response, challengeKey });
    
    // Verify CAPTCHA response
    if (challenge && response && challengeKey) {
      const storedChallenge = global.captchaChallenges.get(challengeKey);
      
      console.log(`[API] CAPTCHA map size:`, global.captchaChallenges.size);
      console.log(`[API] Available challenge keys:`, Array.from(global.captchaChallenges.keys()));
      console.log(`[API] Looking for challenge key:`, challengeKey);
      console.log(`[API] Stored challenge found:`, !!storedChallenge);
      if (storedChallenge) {
        console.log(`[API] Stored challenge data:`, {
          challenge: storedChallenge.challenge,
          answer: storedChallenge.answer,
          timestamp: storedChallenge.timestamp
        });
      }
      
      console.log(`[API] CAPTCHA verification details:`, {
        receivedChallenge: challenge,
        storedChallenge: storedChallenge?.challenge,
        challengeKey: challengeKey,
        storedAnswer: storedChallenge?.answer,
        userResponse: response
      });
      
      // Normalize challenge strings for comparison (handle URL encoding issues)
      const normalizeChallenge = (challengeStr) => {
        if (!challengeStr || typeof challengeStr !== 'string') return '';
        // Decode URL-encoded characters and normalize spaces
        const decoded = decodeURIComponent(challengeStr);
        // Remove all extra spaces and normalize to single spaces
        // Also handle plus signs that might be URL-encoded
        // More robust normalization that handles various space patterns around operators
        return decoded
          .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
          .replace(/\s*\+\s*/g, ' + ') // Normalize spaces around plus
          .replace(/\s*-\s*/g, ' - ') // Normalize spaces around minus
          .replace(/\s*×\s*/g, ' × ') // Normalize spaces around multiplication
          .replace(/\s*÷\s*/g, ' ÷ ') // Normalize spaces around division
          .trim();
      };
      const normalizedReceived = normalizeChallenge(challenge);
      const normalizedStored = storedChallenge ? normalizeChallenge(storedChallenge.challenge) : null;
      
      console.log(`[API] CAPTCHA NORMALIZATION DEBUG:`, {
        originalChallenge: challenge,
        originalStoredChallenge: storedChallenge?.challenge,
        normalizedReceived,
        normalizedStored,
        challengeMatch: normalizedStored === normalizedReceived,
        challengeKey: challengeKey
      });
      
      // Debug logging for challenge comparison
      console.log(`[API] CAPTCHA verification details:`, {
        receivedChallenge: challenge,
        storedChallenge: storedChallenge?.challenge,
        normalizedReceived,
        normalizedStored,
        challengeKey,
        storedAnswer: storedChallenge?.answer,
        userResponse: response,
        challengeExists: !!storedChallenge,
        challengeMatch: normalizedStored === normalizedReceived
      });
      
      if (storedChallenge && normalizedStored === normalizedReceived) {
        let expectedAnswer;
        try {
          // Always use the stored answer - it's more reliable than recalculating
          if (storedChallenge.answer !== undefined && storedChallenge.answer !== null) {
            expectedAnswer = storedChallenge.answer;
          } else {
            // Fallback: try to calculate from the stored challenge (not the URL-encoded one)
            const storedChallengeText = storedChallenge.challenge;
            const sanitizedChallenge = storedChallengeText.replace(/[×÷]/g, (match) => {
              return match === '×' ? '*' : '/';
            });
            // Use Function constructor instead of eval for safer execution
            expectedAnswer = new Function(`return ${sanitizedChallenge}`)();
          }
        } catch (calcError) {
          console.error('[API] Error calculating expected answer:', calcError);
          console.error('[API] Challenge calculation details:', {
            storedAnswer: storedChallenge?.answer,
            storedChallenge: storedChallenge?.challenge,
            receivedChallenge: challenge
          });
          return res.status(400).json({
            success: false,
            message: 'Invalid challenge format. Please refresh and try again.',
            requiresCaptcha: true
          });
        }
        
        const userAnswer = parseInt(response);
        
        // Validate that we have a valid expected answer
        if (isNaN(expectedAnswer) || expectedAnswer === undefined) {
          console.error('[API] Invalid expected answer:', expectedAnswer);
          return res.status(400).json({
            success: false,
            message: 'Invalid challenge. Please refresh and try again.',
            requiresCaptcha: true
          });
        }
        
        if (userAnswer === expectedAnswer) {
          // CAPTCHA passed - create session and redirect to course
          let sessionId;
          try {
            if (!publicCourseSessionService || typeof publicCourseSessionService.createSession !== 'function') {
              throw new Error('Public course session service not available');
            }
            sessionId = publicCourseSessionService.createSession(courseId);
          } catch (sessionError) {
            console.error('[API] Error creating session:', sessionError);
            return res.status(500).json({
              success: false,
              message: 'Failed to create session. Please try again.',
              requiresCaptcha: true
            });
          }
          global.captchaChallenges.delete(challengeKey); // Clean up
          
          console.log(`[API] CAPTCHA passed for course ${courseId}, created session: ${sessionId}`);
          
          return res.json({
            success: true,
            sessionId: sessionId,
            redirectUrl: `/public/course/${courseId}?sessionId=${sessionId}`
          });
        } else {
          // CAPTCHA failed
          global.captchaChallenges.delete(challengeKey); // Clean up
          return res.status(400).json({
            success: false,
            message: 'Incorrect answer. Please try again.',
            requiresCaptcha: true
          });
        }
      } else {
        console.log(`[API] CAPTCHA verification failed:`, {
          challengeExists: !!storedChallenge,
          challengeMatch: storedChallenge ? normalizedStored === normalizedReceived : false,
          normalizedReceived,
          normalizedStored,
          challengeKey: challengeKey,
          storedChallengeExists: !!storedChallenge,
          storedChallengeData: storedChallenge ? {
            challenge: storedChallenge.challenge,
            answer: storedChallenge.answer,
            timestamp: storedChallenge.timestamp
          } : null
        });
        
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired challenge. Please refresh and try again.',
          requiresCaptcha: true
        });
      }
    }
    
    // No CAPTCHA parameters - generate new challenge
    
    // Generate more varied and simpler challenges
    const challengeTypes = [
      { type: 'simple_addition', operator: '+', generate: () => {
        const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
        const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        return { num1, num2, operator: '+', answer: num1 + num2 };
      }},
      { type: 'simple_subtraction', operator: '-', generate: () => {
        const num1 = Math.floor(Math.random() * 15) + 5; // 5-19
        const num2 = Math.floor(Math.random() * (num1 - 1)) + 1; // 1 to num1-1
        return { num1, num2, operator: '-', answer: num1 - num2 };
      }},
      { type: 'easy_multiplication', operator: '×', generate: () => {
        const num1 = Math.floor(Math.random() * 6) + 1; // 1-6
        const num2 = Math.floor(Math.random() * 6) + 1; // 1-6
        return { num1, num2, operator: '×', answer: num1 * num2 };
      }},
      { type: 'simple_division', operator: '÷', generate: () => {
        const num2 = Math.floor(Math.random() * 6) + 2; // 2-7
        const answer = Math.floor(Math.random() * 6) + 1; // 1-6
        const num1 = answer * num2; // Calculate num1 based on answer and num2
        return { num1, num2, operator: '÷', answer: answer };
      }}
      // Removed sequence, word count, and letter count challenges - keeping only simple math
    ];
    
    // Randomly select a challenge type
    const selectedType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    let challengeInfo;
    try {
      challengeInfo = selectedType.generate();
      
      // Validate challenge info
      if (!challengeInfo || typeof challengeInfo !== 'object') {
        throw new Error('Invalid challenge info generated');
      }
    } catch (genError) {
      console.error('[API] Error generating challenge:', genError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate verification challenge. Please try again.',
        requiresCaptcha: true
      });
    }
    
    // Generate challenge display text based on type
    let challengeData;
    try {
      if (challengeInfo.question && challengeInfo.displayText) {
        // For non-math challenges, use the question format
        challengeData = challengeInfo.question;
      } else {
        // For math challenges, use the standard format
        challengeData = `${challengeInfo.num1} ${challengeInfo.operator} ${challengeInfo.num2}`;
      }
      
      // Validate challenge data
      if (!challengeData || typeof challengeData !== 'string') {
        throw new Error('Invalid challenge data generated');
      }
    } catch (formatError) {
      console.error('[API] Error formatting challenge:', formatError);
      return res.status(500).json({
        success: false,
        message: 'Failed to format verification challenge. Please try again.',
        requiresCaptcha: true
      });
    }
    
    const newChallengeKey = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log the generated challenge for debugging
    console.log(`[API] Generated new CAPTCHA for course ${courseId}:`, {
      challenge: challengeData,
      challengeKey: newChallengeKey,
      type: selectedType.type,
      answer: challengeInfo.answer
    });
    
    try {
      // Validate challenge info before storing
      if (!challengeInfo.answer || isNaN(challengeInfo.answer)) {
        throw new Error('Invalid challenge answer');
      }
      
      global.captchaChallenges.set(newChallengeKey, {
        challenge: challengeData,
        answer: challengeInfo.answer,
        sessionId: null,
        timestamp: Date.now()
      });
    } catch (storageError) {
      console.error('[API] Error storing challenge:', storageError);
      return res.status(500).json({
        success: false,
        message: 'Failed to store verification challenge. Please try again.',
        requiresCaptcha: true
      });
    }
    
    console.log(`[API] Generated CAPTCHA for course ${courseId}:`, { 
      challenge: challengeData, 
      challengeKey: newChallengeKey,
      type: selectedType.type,
      answer: challengeInfo.answer
    });
    
    res.json({
      success: true,
      requiresCaptcha: true,
      challenge: challengeData,
      challengeKey: newChallengeKey,
      message: 'Please solve this verification challenge to access the course.'
    });
  } catch (error) {
    console.error('[API] CAPTCHA verification error:', error);
    console.error('[API] Error stack:', error.stack);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'CAPTCHA verification failed';
    let statusCode = 500;
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      errorMessage = 'Invalid challenge format. Please refresh and try again.';
      statusCode = 400;
    } else if (error.message && error.message.includes('challenge')) {
      errorMessage = 'Invalid challenge. Please refresh and try again.';
      statusCode = 400;
    } else if (error.message && error.message.includes('import')) {
      errorMessage = 'Service configuration error. Please try again.';
      statusCode = 500;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      requiresCaptcha: true 
    });
  }
});

// Generate new CAPTCHA challenge endpoint
app.get('/api/captcha/new/:courseId', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Generate new challenge
    
    // Generate more varied and simpler challenges
    const challengeTypes = [
      { type: 'simple_addition', operator: '+', generate: () => {
        const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
        const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
        return { num1, num2, operator: '+', answer: num1 + num2 };
      }},
      { type: 'simple_subtraction', operator: '-', generate: () => {
        const num1 = Math.floor(Math.random() * 15) + 5; // 5-19
        const num2 = Math.floor(Math.random() * (num1 - 1)) + 1; // 1 to num1-1
        return { num1, num2, operator: '-', answer: num1 - num2 };
      }},
      { type: 'easy_multiplication', operator: '×', generate: () => {
        const num1 = Math.floor(Math.random() * 6) + 1; // 1-6
        const num2 = Math.floor(Math.random() * 6) + 1; // 1-6
        return { num1, num2, operator: '×', answer: num1 * num2 };
      }},
      { type: 'simple_division', operator: '÷', generate: () => {
        const num2 = Math.floor(Math.random() * 6) + 2; // 2-7
        const answer = Math.floor(Math.random() * 6) + 1; // 1-6
        const num1 = answer * num2; // Calculate num1 based on answer and num2
        return { num1, num2, operator: '÷', answer: answer };
      }}
      // Removed sequence, word count, and letter count challenges - keeping only simple math
    ];
    
    // Randomly select a challenge type
    const selectedType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    const challengeInfo = selectedType.generate();
    
    // Generate challenge display text based on type
    let challengeData;
    if (challengeInfo.question && challengeInfo.displayText) {
      // For non-math challenges, use the question format
      challengeData = challengeInfo.question;
    } else {
      // For math challenges, use the standard format with proper encoding
      challengeData = `${challengeInfo.num1} ${challengeInfo.operator} ${challengeInfo.num2}`;
    }
    
    const newChallengeKey = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    global.captchaChallenges.set(newChallengeKey, {
      challenge: challengeData,
      answer: challengeInfo.answer,
      sessionId: null,
      timestamp: Date.now()
    });
    
    console.log(`[API] Generated new CAPTCHA for course ${courseId}:`, { 
      challenge: challengeData, 
      challengeKey: newChallengeKey,
      type: selectedType.type,
      answer: challengeInfo.answer
    });
    
    res.json({
      success: true,
      challenge: challengeData,
      challengeKey: newChallengeKey,
      message: 'New challenge generated.'
    });
  } catch (error) {
    console.error('[API] CAPTCHA generation error:', error);
    res.status(500).json({ error: 'Failed to generate new challenge' });
  }
});

// Handle public course access without specific course ID - redirect to a fallback course
app.get('/api/public/courses', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    // Find any published course or create a fallback
    let course = db.data.courses.find(c => c.published);
    
    if (!course) {
      // Create a fallback course
      const fallbackCourse = {
        id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'Welcome to Discourse AI',
        description: 'This is a sample course to get you started with our AI-powered learning platform.',
        difficulty: 'beginner',
        published: true,
        createdAt: new Date().toISOString(),
        modules: [
          {
            id: `module_${Date.now()}_1`,
            title: 'Getting Started',
            description: 'Introduction to the platform',
            lessons: [
              {
                id: `lesson_${Date.now()}_1`,
                title: 'Welcome to Discourse AI',
                content: `# Welcome to Discourse AI

This is your first lesson in our AI-powered learning platform. Here you'll discover:

## What You'll Learn
- How to navigate the platform
- Understanding the course structure
- Making the most of your learning experience

## Getting Started
Take your time to explore the interface and get comfortable with the learning environment.

## Next Steps
Complete this lesson to unlock more content and continue your learning journey.`,
                quiz: [
                  {
                    question: "What is the name of this learning platform?",
                    options: ["Discourse AI", "Learning Hub", "Study Central", "Knowledge Base"],
                    correctAnswer: 0
                  },
                  {
                    question: "What should you do to unlock more content?",
                    options: ["Skip lessons", "Complete lessons", "Just browse", "Take breaks"],
                    correctAnswer: 1
                  }
                ]
              }
            ]
          }
        ]
      };
      
      db.data.courses.push(fallbackCourse);
      await db.write();
      course = fallbackCourse;
    }
    
    // Create session for the course
    const sessionId = publicCourseSessionService.createSession(course.id);
    
    res.json({
      ...course,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('[API] Failed to handle public course access:', error);
    res.status(500).json({ error: 'Failed to access course' });
  }
});

// Get a published course (public access, no authentication required)
app.get('/api/public/courses/:courseId', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sessionId } = req.query;
    
    // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
    const normalizedId = String(courseId || '').replace(/_[0-9]{10,}$/,'');
    
    console.log(`[API] Fetching public course ${courseId} (normalized: ${normalizedId}) with sessionId: ${sessionId || 'none'}`);
    console.log(`[API] Available courses:`, db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published })));
    
    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedId);
    
    if (!course) {
      console.log(`[API] Public course not found: ${normalizedId}, creating fallback course`);
      
      // Create a fallback course with sample content
      const fallbackCourse = {
        id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'Welcome to Discourse AI',
        description: 'This is a sample course to get you started with our AI-powered learning platform.',
        difficulty: 'beginner',
        published: true,
        createdAt: new Date().toISOString(),
        modules: [
          {
            id: `module_${Date.now()}_1`,
            title: 'Getting Started',
            description: 'Introduction to the platform',
            lessons: [
              {
                id: `lesson_${Date.now()}_1`,
                title: 'Welcome to Discourse AI',
                content: `# Welcome to Discourse AI

This is your first lesson in our AI-powered learning platform. Here you'll discover:

## What You'll Learn
- How to navigate the platform
- Understanding the course structure
- Making the most of your learning experience

## Getting Started
Take your time to explore the interface and get comfortable with the learning environment.

## Next Steps
Complete this lesson to unlock more content and continue your learning journey.`,
                quiz: [
                  {
                    question: "What is the name of this learning platform?",
                    options: ["Discourse AI", "Learning Hub", "Study Central", "Knowledge Base"],
                    correctAnswer: 0
                  },
                  {
                    question: "What should you do to unlock more content?",
                    options: ["Skip lessons", "Complete lessons", "Just browse", "Take breaks"],
                    correctAnswer: 1
                  }
                ]
              }
            ]
          }
        ]
      };
      
      // Add the fallback course to the database
      db.data.courses.push(fallbackCourse);
      await db.write();
      
      console.log(`[API] Created fallback course: ${fallbackCourse.id}`);
      course = fallbackCourse;
    }
    
    if (!course.published) {
      console.log(`[API] Course ${normalizedId} is not published`);
      return res.status(404).json({ 
        error: 'Course not found',
        message: 'This course is not publicly available.'
      });
    }
    
    // Create or restore session
    const sessionIdToUse = publicCourseSessionService.restoreOrCreateSession(normalizedId, sessionId);
    
    console.log(`[API] Session management result:`, {
      originalSessionId: sessionId,
      finalSessionId: sessionIdToUse,
      isNewSession: !sessionId || sessionId !== sessionIdToUse
    });
    
    console.log(`[API] Returning public course data:`, {
      id: course.id,
      title: course.title,
      modulesCount: course.modules?.length,
      totalLessons: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
      sessionId: sessionIdToUse
    });
    
    res.json({
      ...course,
      sessionId: sessionIdToUse
    });
  } catch (error) {
    console.error('[API] Failed to fetch public course:', error);
    res.status(500).json({ error: 'Failed to fetch public course' });
  }
});

// Save quiz score for public course session
app.post('/api/public/courses/:courseId/quiz-score', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sessionId, lessonId, score } = req.body;
    
    if (!sessionId || !lessonId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, lessonId, score' });
    }
    
    console.log(`[API] Saving quiz score for public course:`, {
      courseId,
      sessionId,
      lessonId,
      score
    });
    
    // Use the PublicCourseSessionService to save the quiz score
    let saved = publicCourseSessionService.saveQuizScore(sessionId, lessonId, score);
    
    // If session doesn't exist or is not available, create a new one and save the score
    if (!saved) {
      console.log(`[API] Session ${sessionId} not found or not available, creating new session and saving score`);
      const newSessionId = publicCourseSessionService.createSession(courseId);
      saved = publicCourseSessionService.saveQuizScore(newSessionId, lessonId, score);
      
      if (saved) {
        console.log(`[API] Successfully saved quiz score in new session ${newSessionId}, lesson ${lessonId}: ${score}`);
        res.json({ 
          success: true, 
          message: 'Quiz score saved in new session',
          sessionId: newSessionId,
          lessonId,
          score,
          newSession: true
        });
        return;
      }
    } else {
      console.log(`[API] Successfully saved quiz score for session ${sessionId}, lesson ${lessonId}: ${score}`);
      res.json({ 
        success: true, 
        message: 'Quiz score saved for session',
        sessionId,
        lessonId,
        score
      });
      return;
    }
    
    // If we get here, saving failed
    console.log(`[API] Failed to save quiz score - could not create new session`);
    res.status(500).json({ error: 'Failed to save quiz score' });
    
  } catch (error) {
    console.error('[API] Failed to save quiz score:', error);
    res.status(500).json({ error: 'Failed to save quiz score' });
  }
});

// Get quiz score for public course session
app.get('/api/public/courses/:courseId/quiz-score/:lessonId', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    console.log(`[API] Getting quiz score for public course:`, {
      courseId,
      sessionId,
      lessonId
    });
    
    // Use the PublicCourseSessionService to get the quiz score
    const score = publicCourseSessionService.getQuizScore(sessionId, lessonId);
    
    console.log(`[API] Retrieved quiz score for session ${sessionId}, lesson ${lessonId}: ${score}`);
    
    res.json({ 
      sessionId,
      lessonId,
      score: score
    });
  } catch (error) {
    console.error('[API] Failed to get quiz score:', error);
    res.status(500).json({ error: 'Failed to get quiz score' });
  }
});

// Create session for public course
app.post('/api/public/courses/:courseId/session', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { oldSessionId } = req.body; // Ignore old session ID
    
    console.log(`[API] Creating new session for public course (ignoring old session ${oldSessionId}):`, {
      courseId,
      oldSessionId
    });
    
    // Always create a new session, never restore old ones
    const sessionId = publicCourseSessionService.createSession(courseId);
    
    console.log(`[API] Created new session: ${sessionId}`);
    
    res.json({ 
      sessionId,
      courseId,
      message: 'New session created'
    });
  } catch (error) {
    console.error('[API] Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get all quiz scores for public course session
app.get('/api/public/courses/:courseId/quiz-scores', 
  securityHeaders,
  securityLogging,
  botDetection,
  publicCourseRateLimit,
  publicCourseSlowDown,
  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    console.log(`[API] Getting all quiz scores for public course session:`, {
      courseId,
      sessionId
    });
    
    // Get session data from PublicCourseSessionService
    const session = publicCourseSessionService.getSession(sessionId);
    
    if (!session) {
      console.log(`[API] Session not found: ${sessionId}`);
      return res.json({ 
        sessionId,
        quizScores: {}
      });
    }
    
    console.log(`[API] Found session quiz scores:`, session.quizScores);
    
    res.json({ 
      sessionId,
      quizScores: session.quizScores || {}
    });
  } catch (error) {
    console.error('[API] Failed to get quiz scores:', error);
    res.status(500).json({ error: 'Failed to get quiz scores' });
  }
});

// Stripe: Create Checkout Session for £20 (10 credits)
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  console.log('[Stripe] Creating checkout session for user:', req.user.id);
  console.log('[Stripe] Stripe configured:', !!stripe);
  
  if (!stripe) {
    console.error('[Stripe] Stripe not configured - missing STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  try {
    console.log('[Stripe] Creating session with metadata:', { userId: req.user.id });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: '10 Course Generations',
              description: 'Generate up to 10 courses on the platform',
            },
            unit_amount: 2000, // £20.00 in pence
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.user.id,
      },
      success_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?payment=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?payment=cancel`,
    });
    
    console.log('[Stripe] Session created successfully:', session.id);
    console.log('[Stripe] Checkout URL:', session.url);
    
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Error creating checkout session:', err);
    console.error('[Stripe] Error details:', {
      message: err.message,
      type: err.type,
      code: err.code
    });
    res.status(500).json({ error: 'Failed to create Stripe checkout session', details: err.message });
  }
});

// Stripe: Webhook to handle successful payment and add credits
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const user = db.data.users.find(u => u.id === userId);
    if (user) {
      user.courseCredits = (user.courseCredits || 0) + 10;
      await db.write();
      console.log(`[Stripe] Added 10 credits to user ${userId}`);
    }
  }
  res.json({ received: true });
});

// API: Add credits to user account
app.post('/api/add-credits', authenticateToken, async (req, res) => {
  try {
    const { credits } = req.body;
    const user = req.user; // Use req.user directly
    
    console.log(`[API] Adding ${credits} credits to user ${user.id}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add credits to user account
    user.courseCredits = (user.courseCredits || 0) + credits;
    await db.write();
    
    console.log(`[API] Successfully added ${credits} credits to user ${user.id}. New total: ${user.courseCredits}`);
    
    res.json({
      success: true,
      courseCredits: user.courseCredits,
      creditsAdded: credits
    });
  } catch (error) {
    console.error('[API] Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// API: Get current user credits
app.get('/api/user/credits', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    console.log(`[API] Getting credits for user ${user.id}: ${user.courseCredits}`);
    
    res.json({
      credits: user.courseCredits || 0,
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    console.error('[API] Error getting user credits:', error);
    res.status(500).json({ error: 'Failed to get user credits' });
  }
});

// API: Manual payment success handler for direct Stripe URLs
app.post('/api/payment-success', authenticateToken, async (req, res) => {
  try {
    const user = req.user; // Use req.user directly
    
    console.log(`[API] Processing manual payment success for user ${user.id}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add 10 tokens to user account
    const previousCredits = user.courseCredits || 0;
    user.courseCredits = previousCredits + 10;
    await db.write();
    
    console.log(`[API] Successfully added 10 tokens to user ${user.id}. Previous: ${previousCredits}, New total: ${user.courseCredits}`);
    
    res.json({
      success: true,
      courseCredits: user.courseCredits,
      creditsAdded: 10,
      previousCredits: previousCredits,
      message: 'Payment successful! 10 tokens have been added to your account.'
    });
  } catch (error) {
    console.error('[API] Error processing payment success:', error);
    res.status(500).json({ error: 'Failed to process payment success' });
  }
});

// Debug endpoint to help troubleshoot user and course data
app.get('/api/debug/user-courses', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    const debugInfo = {
      currentUser: {
        id: userId,
        email: userEmail,
        courseCredits: req.user.courseCredits
      },
      allUsers: db.data.users.map(u => ({
        id: u.id,
        email: u.email,
        courseCredits: u.courseCredits
      })),
      allCourses: db.data.courses.map(c => ({
        id: c.id,
        title: c.title,
        userId: c.userId,
        published: c.published
      })),
      userCourses: db.data.courses.filter(c => c.userId === userId).map(c => ({
        id: c.id,
        title: c.title,
        published: c.published
      })),
      coursesWithSameEmail: db.data.courses.filter(c => {
        const courseUser = db.data.users.find(u => u.id === c.userId);
        return courseUser && courseUser.email === userEmail;
      }).map(c => ({
        id: c.id,
        title: c.title,
        userId: c.userId,
        published: c.published
      }))
    };
    
    console.log(`[DEBUG] User courses debug info for ${userId}:`, debugInfo);
    res.json(debugInfo);
  } catch (error) {
    console.error(`[DEBUG] Error in debug endpoint:`, error);
    res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

// Debug endpoint to help troubleshoot course saving issues
app.get('/api/debug/course/:courseId', authenticateToken, (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    console.log(`[DEBUG] Course debug request for ${courseId} by user ${userId}`);
    
    const course = db.data.courses.find(c => c.id === courseId);
    const userCourses = db.data.courses.filter(c => c.userId === userId);
    
    const debugInfo = {
      requestedCourseId: courseId,
      userId: userId,
      courseFound: !!course,
      courseDetails: course ? {
        id: course.id,
        title: course.title,
        userId: course.userId,
        modulesCount: course.modules?.length,
        totalLessons: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
        createdAt: course.createdAt
      } : null,
      userCoursesCount: userCourses.length,
      userCourses: userCourses.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt
      })),
      totalCoursesInDB: db.data.courses.length,
      allCourseIds: db.data.courses.map(c => c.id),
      timestamp: new Date().toISOString()
    };
    
    console.log(`[DEBUG] Debug info:`, debugInfo);
    res.json(debugInfo);
    
  } catch (error) {
    console.error(`[DEBUG] Error in course debug endpoint:`, error);
    res.status(500).json({ error: 'Debug endpoint failed', message: error.message });
  }
});

app.delete('/api/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log(`[API] Deleting course ${courseId} for user ${userId} (${userEmail})`);

    // Try to find the course by exact ID first
    let course = db.data.courses.find(c => c.id === courseId);
    
    // If not found by exact ID, try normalized ID (for backward compatibility)
    if (!course) {
      const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
      course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
    }

    if (!course) {
      console.log(`[API] Delete failed, course not found:`, {
        requestedId: courseId,
        availableIds: db.data.courses.map(c => c.id)
      });
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this course' });
    }

    // Remove course from database
    db.data.courses = db.data.courses.filter(c => c !== course);
    await db.write();

    // Delete course file from file system
    try {
      const coursesDir = path.join(__dirname, 'data', 'courses');
      const courseFileName = `${course.id}.json`;
      const courseFilePath = path.join(coursesDir, courseFileName);
      
      if (fs.existsSync(courseFilePath)) {
        fs.unlinkSync(courseFilePath);
        console.log(`[API] Deleted course file: ${courseFileName}`);
      } else {
        console.log(`[API] Course file not found: ${courseFileName}`);
      }
    } catch (fileError) {
      console.error(`[API] Failed to delete course file for ${course.id}:`, fileError.message);
      // Don't fail the entire deletion if file deletion fails
    }

    console.log(`[API] Course deleted successfully: ${course.title} (${course.id})`);
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('[API] Failed to delete course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// --- STATIC FILE SERVING & SPA FALLBACK ---
// Quick alias for legacy/mis-encoded asset path used by some clients
app.get(['/assets/images/discourse logo.png', '/assets/images/discourse%20logo.png'], (req, res) => {
  try {
    // Prefer a bundled PWA icon as a lightweight fallback
    return res.redirect(301, '/icon-192.png');
  } catch (e) {
    return res.status(404).end();
  }
});

// Serve static assets from the dist directory (local build) or public_html directory
const buildPath = process.env.FRONTEND_PATH || path.join(__dirname, 'dist') || path.join(process.env.HOME || process.env.USERPROFILE || '/root', 'public_html');
app.use(express.static(buildPath, {
  // Set cache control for assets. Index is handled separately.
  setHeaders: (res, filePath) => {
    if (!filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Serve cached images with aggressive caching
app.use('/cached-images', express.static(path.resolve(__dirname, 'data', 'image_cache'), {
  maxAge: '1y',
  immutable: true
}));

// Serve the public directory for sounds and other assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve the image library with caching
const imageLibraryDir = path.join(__dirname, 'data', 'images');
if (!fs.existsSync(imageLibraryDir)) {
  fs.mkdirSync(imageLibraryDir, { recursive: true });
}

// Fallback: if a jpg/jpeg/png is requested but only a .webp exists, serve the .webp
app.get('/images/:file', (req, res, next) => {
  try {
    const requestedFile = req.params.file;
    const requestedPath = path.join(imageLibraryDir, requestedFile);
    
    // If the exact file exists, let static middleware handle it
    if (fs.existsSync(requestedPath)) return next();

    // If a legacy extension is requested, try the .webp version
    if (/\.(jpg|jpeg|png)$/i.test(requestedFile)) {
      const webpCandidate = requestedFile.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webpPath = path.join(imageLibraryDir, webpCandidate);
      if (fs.existsSync(webpPath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // Use sendFile with error callback so that any filesystem issues do not
        // bubble up as uncaught errors (which Express would treat as 500).
        return res.sendFile(webpPath, (err) => {
          if (err) {
            console.warn('[Images] Failed to send fallback webp for', requestedFile, '-', err.message);
            // If sending the file fails, fall through so Express static can
            // try to serve whatever is available (will normally return 404)
            return next();
          }
        });
      }
    }

    // If no fallback was found, explicitly send a 404 to avoid hitting the static middleware with a non-existent file
    return res.status(404).send('Image not found');
  } catch (e) {
    console.error('[Images] Error handling image request:', e);
    return res.status(500).send('Image processing error');
  }
});

app.use('/images', express.static(imageLibraryDir, {
  fallthrough: false,
  maxAge: '365d',
  etag: true,
  setHeaders: (res, filePath) => {
    // Aggressive caching for images
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    
    // Add Vary header for better cache efficiency
    res.setHeader('Vary', 'Accept-Encoding');
    
    // Add preload hints for critical images
    if (filePath.includes('lesson-') || filePath.includes('module-')) {
      res.setHeader('Link', '</images/critical.css>; rel=preload; as=style');
    }
  }
}));



// Trust proxy setting already configured above

// --- IMAGE CACHE HELPERS ---
const imageCacheDir = path.resolve(__dirname, 'data', 'image_cache');
if (!fs.existsSync(imageCacheDir)) {
  fs.mkdirSync(imageCacheDir, { recursive: true });
}

function buildImageCacheKey(subject, content) {
  const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
  let contentSnippet = '';
  if (content && typeof content === 'object') {
    contentSnippet = `${content.introduction || ''} ${content.main_content || ''} ${content.conclusion || ''}`.slice(0, 500);
  } else if (typeof content === 'string') {
    contentSnippet = content.slice(0, 500);
  }
  const raw = `${norm(subject)}|${norm(contentSnippet)}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function findCachedImageByKey(cacheKey) {
  const rec = (db.data.imageCache || []).find(r => r.key === cacheKey);
  return rec || null;
}

async function downloadAndCacheImage(cacheKey, imageData) {
  try {
    if (!imageData || !imageData.sourceUrlForCaching) return null;
    const url = imageData.sourceUrlForCaching;
    // Do not cache explicitly disallowed URLs
    if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some(s => (url || '').includes(s))) {
      console.warn('[ImageCache] Skipping cache for disallowed URL:', url);
      return null;
    }
    // If already cached
    const existing = findCachedImageByKey(cacheKey);
    if (existing) return existing;
    
    // Download original image
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[ImageCache] Download failed:', res.status, url);
      return null;
    }
    
    const originalBuffer = Buffer.from(await res.arrayBuffer());
    const originalSize = originalBuffer.length;
    
    // Determine optimal format and extension
    const originalExt = url.split('?')[0].match(/\.([a-zA-Z0-9]{3,4})$/)?.[1]?.toLowerCase() || 'jpg';
    const optimalFormat = getOptimalFormat(originalExt, true); // Prefer WebP for better compression
    const newExt = getFileExtension(optimalFormat);
    
    // Compress the image
    console.log(`[ImageCache] Compressing image: ${formatFileSize(originalSize)} -> ${optimalFormat.toUpperCase()}`);
    const compressedBuffer = await compressImage(originalBuffer, {
      format: optimalFormat,
      quality: 65, // Reduced from 80 to 65 for better compression
      maxWidth: 800, // Reduced from 1200 to 800 for smaller files
      maxHeight: 600, // Reduced from 800 to 600 for smaller files
    });
    
    const compressedSize = compressedBuffer.length;
    const compressionRatio = compressedSize / originalSize;
    const sizeReduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`[ImageCache] Compression complete: ${formatFileSize(originalSize)} -> ${formatFileSize(compressedSize)} (${sizeReduction}% reduction)`);
    
    // Save compressed image
    const filename = `${cacheKey}.${newExt}`;
    const filepath = path.join(imageCacheDir, filename);
    const localUrl = `/cached-images/${filename}`;
    
    fs.writeFileSync(filepath, compressedBuffer);

    const record = {
      key: cacheKey,
      title: imageData.imageTitle || imageData.title || '',
      sourceUrl: url,
      localUrl,
      pageURL: imageData.pageURL || '',
      attribution: imageData.attribution || '',
      createdAt: new Date().toISOString(),
      originalSize,
      compressedSize,
      compressionRatio,
      format: optimalFormat
    };
    db.data.imageCache.push(record);
    await db.write();
    console.log(`[ImageCache] Cached compressed image at ${localUrl} (${sizeReduction}% smaller)`);
    return record;
  } catch (e) {
    console.warn('[ImageCache] Error caching image:', e.message);
    return null;
  }
}

// Simple helper to delete a local cached image file if it exists
function deleteLocalCachedFileIfExists(localUrl) {
  try {
    if (!localUrl) return false;
    const basename = path.basename(localUrl);
    const filePath = path.join(imageCacheDir, basename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[ImageCache] Deleted local cached file:', filePath);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[ImageCache] Could not delete local cached file:', e.message);
    return false;
  }
}

// Admin: purge cached images matching substring(s)
// Body: { substring?: string, substrings?: string[], useDisallowed?: boolean, all?: boolean }
app.post('/api/image-cache/purge', authenticateToken, requireAdminIfConfigured, async (req, res) => {
  try {
    const { substring, substrings, useDisallowed, all } = req.body || {};
    const targets = new Set();

    const patterns = Array.isArray(substrings) && substrings.length > 0
      ? substrings
      : (substring ? [substring] : []);

    if (useDisallowed) {
      DISALLOWED_IMAGE_URL_SUBSTRINGS.forEach((s) => patterns.push(s));
    }

    if (!all && patterns.length === 0) {
      return res.status(400).json({ error: 'Provide substring(s) or set useDisallowed=true, or set all=true' });
    }

    db.data.imageCache = db.data.imageCache || [];
    const beforeCount = db.data.imageCache.length;

    if (all) {
      for (const rec of db.data.imageCache) {
        targets.add(rec);
      }
    } else {
      // Identify matches
      for (const rec of db.data.imageCache) {
        const haystack = `${rec.localUrl || ''} ${rec.sourceUrl || ''}`;
        if (patterns.some((p) => haystack.includes(p))) {
          targets.add(rec);
        }
      }
    }

    let deletedFiles = 0;
    // Remove matched records and files
    if (targets.size > 0) {
      const remaining = [];
      for (const rec of db.data.imageCache) {
        if (targets.has(rec)) {
          if (deleteLocalCachedFileIfExists(rec.localUrl)) {
            deletedFiles++;
          }
          continue;
        }
        remaining.push(rec);
      }
      db.data.imageCache = remaining;
      await db.write();
    }

    const removed = beforeCount - db.data.imageCache.length;
    return res.json({ removed, deletedFiles, patterns, all: !!all });
  } catch (e) {
    console.error('[ImageCache] Purge failed:', e.message);
    return res.status(500).json({ error: 'Purge failed', details: e.message });
  }
});

// Admin: recompress cached images to improve compression
// Body: { substring?: string, substrings?: string[], all?: boolean, quality?: number, maxWidth?: number, maxHeight?: number }
app.post('/api/image-cache/recompress', authenticateToken, requireAdminIfConfigured, async (req, res) => {
  try {
    const { substring, substrings, all, quality = 65, maxWidth = 800, maxHeight = 600 } = req.body || {};
    const targets = [];

    const patterns = Array.isArray(substrings) && substrings.length > 0
      ? substrings
      : (substring ? [substring] : []);

    if (!all && patterns.length === 0) {
      return res.status(400).json({ error: 'Provide substring(s) or set all=true' });
    }

    db.data.imageCache = db.data.imageCache || [];

    // Identify targets
    if (all) {
      targets.push(...db.data.imageCache);
    } else {
      for (const rec of db.data.imageCache) {
        const haystack = `${rec.localUrl || ''} ${rec.sourceUrl || ''}`;
        if (patterns.some((p) => haystack.includes(p))) {
          targets.push(rec);
        }
      }
    }

    if (targets.length === 0) {
      return res.json({ recompressed: 0, totalSizeReduction: 0, message: 'No images found to recompress' });
    }

    console.log(`[ImageCache] Starting recompression of ${targets.length} images...`);
    
    let recompressed = 0;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let errors = 0;

    for (const rec of targets) {
      try {
        const filepath = path.join(imageCacheDir, path.basename(rec.localUrl));
        
        if (!fs.existsSync(filepath)) {
          console.warn(`[ImageCache] File not found for recompression: ${filepath}`);
          continue;
        }

        // Read original file
        const originalBuffer = fs.readFileSync(filepath);
        const originalSize = originalBuffer.length;
        totalOriginalSize += originalSize;

        // Determine optimal format
        const currentExt = path.extname(rec.localUrl).slice(1).toLowerCase();
        const optimalFormat = getOptimalFormat(currentExt, true);
        const newExt = getFileExtension(optimalFormat);

        // Recompress with new settings
        const compressedBuffer = await compressImage(originalBuffer, {
          format: optimalFormat,
          quality,
          maxWidth,
          maxHeight,
        });

        const compressedSize = compressedBuffer.length;
        totalCompressedSize += compressedSize;

        // Update file if format changed or size improved
        const newFilename = `${rec.key}.${newExt}`;
        const newFilepath = path.join(imageCacheDir, newFilename);

        let updated = false;
        if (newExt !== currentExt) {
          // Write to new file with new extension and remove old file
          fs.writeFileSync(newFilepath, compressedBuffer);
          try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch {}
          rec.localUrl = `/cached-images/${newFilename}`;
          rec.format = optimalFormat;
          updated = true;
        } else if (compressedSize < originalSize) {
          // Overwrite existing file only if size improved
          fs.writeFileSync(filepath, compressedBuffer);
          updated = true;
        }

        if (updated) {
          rec.compressedSize = compressedSize;
          rec.compressionRatio = compressedSize / originalSize;
          recompressed++;
        }

      } catch (e) {
        errors++;
        console.warn('[ImageCache] Recompression failed for record:', rec?.key, e.message);
      }
    }

    await db.write();

    const totalSizeReduction = Math.max(0, totalOriginalSize - totalCompressedSize);
    console.log(`[ImageCache] Recompression complete. Updated ${recompressed}/${targets.length}. Size: ${formatFileSize(totalOriginalSize)} -> ${formatFileSize(totalCompressedSize)} (-${formatFileSize(totalSizeReduction)}) Errors: ${errors}`);

    return res.json({
      recompressed,
      totalOriginalSize,
      totalCompressedSize,
      totalSizeReduction,
      errors,
      targets: targets.length
    });

  } catch (e) {
    console.error('[ImageCache] Recompress route failed:', e.message);
    return res.status(500).json({ error: 'Recompress failed', details: e.message });
  }
});

// Lightweight HEAD handler to quickly validate existence of cached images without body transfer
app.head('/cached-images/:file', (req, res) => {
  try {
    const filePath = path.join(imageCacheDir, req.params.file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).end();
  } catch (e) {
    return res.status(500).end();
  }
});

// --- IMAGE LIBRARY (PERSISTENT STORAGE) ---
// imageLibraryDir is defined earlier near static middleware
// Ensure DB collection exists
if (!Array.isArray((db.data || {}).images)) {
  db.data.images = [];
}

function generateImageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getFileExtensionFromLocalUrl(localUrl) {
  try {
    const ext = path.extname(String(localUrl || '')).replace('.', '').toLowerCase();
    return ext || 'jpg';
  } catch {
    return 'jpg';
  }
}

async function saveCachedImageToLibrary({ cachedRecord, courseId, lessonId }) {
  try {
    if (!cachedRecord || !cachedRecord.localUrl) return null;
    const sourceBasename = path.basename(cachedRecord.localUrl);
    const sourcePath = path.join(imageCacheDir, sourceBasename);
    if (!fs.existsSync(sourcePath)) return null;

    const id = generateImageId();
    const ext = getFileExtensionFromLocalUrl(cachedRecord.localUrl);
    const destFilename = `${id}.${ext}`;
    const destPath = path.join(imageLibraryDir, destFilename);

    // Copy compressed file into library
    fs.copyFileSync(sourcePath, destPath);

    const record = {
      id,
      courseId: courseId || null,
      lessonId: lessonId || null,
      title: cachedRecord.title || '',
      attribution: cachedRecord.attribution || '',
      pageURL: cachedRecord.pageURL || '',
      sourceUrl: cachedRecord.sourceUrl || '',
      localUrl: `/images/${destFilename}`,
      createdAt: new Date().toISOString(),
      originalSize: cachedRecord.originalSize,
      compressedSize: cachedRecord.compressedSize,
      compressionRatio: cachedRecord.compressionRatio,
      format: cachedRecord.format || ext,
      cacheKey: cachedRecord.key,
    };

    // Defensive: ensure images collection exists before pushing
    db.data = db.data || {};
    if (!Array.isArray(db.data.images)) {
      db.data.images = [];
    }
    db.data.images.push(record);
    await db.write();

    console.log('[ImageLibrary] Saved image to library:', record.id, '->', record.localUrl);
    return record;
  } catch (e) {
    console.warn('[ImageLibrary] Failed to save cached image to library:', e.message);
    return null;
  }
}

// API: Get single image metadata by id
app.get('/api/images/:id', async (req, res) => {
  try {
    const rec = (db.data.images || []).find(r => r.id === req.params.id);
    if (!rec) return res.status(404).json({ error: 'Image not found' });
    return res.json(rec);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch image', details: e.message });
  }
});

// API: List images for a course
app.get('/api/courses/:courseId/images', async (req, res) => {
  try {
    const list = (db.data.images || []).filter(r => r.courseId === req.params.courseId);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list images', details: e.message });
  }
});

// API: List images for a lesson
app.get('/api/lessons/:lessonId/images', async (req, res) => {
  try {
    const list = (db.data.images || []).filter(r => r.lessonId === req.params.lessonId);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list images', details: e.message });
  }
});

// API: Delete an image from library (requires auth)
app.delete('/api/images/:id', authenticateToken, requireAdminIfConfigured, async (req, res) => {
  try {
    const images = db.data.images || [];
    const idx = images.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Image not found' });
    const rec = images[idx];
    // Delete file
    try {
      const basename = path.basename(rec.localUrl || '');
      const filePath = path.join(imageLibraryDir, basename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    images.splice(idx, 1);
    await db.write();
    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete image', details: e.message });
  }
});

// TTS pause position tracking endpoints (no auth required)
app.post('/api/tts/record-pause', async (req, res) => {
  try {
    const { lessonId, serviceType, pauseTime, pauseReason, chunkIndex, totalSpokenTime, pausePosition, fullTextLength } = req.body;
    
    console.log('[TTS] Recording pause position:', {
      lessonId,
      serviceType,
      pauseReason,
      chunkIndex,
      totalSpokenTime,
      pausePosition,
      fullTextLength
    });
    
    // Store the pause data (you can extend this to use a database)
    const pauseData = {
      lessonId,
      serviceType,
      pauseTime,
      pauseReason,
      chunkIndex,
      totalSpokenTime,
      pausePosition,
      fullTextLength,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    // For now, just log the data. You can extend this to store in a database
    console.log('[TTS] Pause data recorded:', pauseData);
    
    res.json({ 
      success: true, 
      message: 'TTS pause position recorded',
      data: pauseData
    });
  } catch (error) {
    console.error('[TTS] Error recording pause position:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record TTS pause position',
      details: error.message 
    });
  }
});

app.get('/api/tts/pause-position', async (req, res) => {
  try {
    const { lessonId } = req.query;
    
    console.log('[TTS] Requesting pause position for lesson:', lessonId);
    
    // For now, return a mock pause position
    // You can extend this to query a database for the actual pause position
    const mockPauseData = {
      lessonId,
      pausePosition: 1000, // Mock position - replace with actual database query
      chunkIndex: 0,
      totalSpokenTime: 5000,
      fullTextLength: 5000,
      timestamp: new Date().toISOString()
    };
    
    // You could implement logic here to:
    // 1. Query database for the last pause position for this lesson
    // 2. Return the exact position where TTS was paused
    // 3. Include additional context like chunk index, spoken time, etc.
    
    res.json({
      success: true,
      ...mockPauseData,
      message: 'Using mock pause position (replace with database query)'
    });
  } catch (error) {
    console.error('[TTS] Error getting pause position:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get pause position',
      details: error.message 
    });
  }
});

app.post('/api/tts/clear-pause-position', async (req, res) => {
  try {
    const { lessonId, serviceType } = req.body;
    
    console.log('[TTS] Clearing pause position for lesson:', lessonId, 'service:', serviceType);
    
    // For now, just log the clear request
    // You can extend this to clear pause position from database
    console.log('[TTS] Pause position cleared for lesson:', lessonId);
    
    // You could implement logic here to:
    // 1. Clear pause position from database for this lesson
    // 2. Reset any stored TTS state for this lesson
    // 3. Log the clear operation for debugging
    
    res.json({
      success: true,
      lessonId,
      serviceType,
      message: 'Pause position cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[TTS] Error clearing pause position:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear pause position',
      details: error.message 
    });
  }
});

// Debug endpoint to check authentication status
app.get('/api/debug/auth', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('[DEBUG] Auth debug request:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
    headers: req.headers
  });
  
  res.json({
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
    timestamp: new Date().toISOString()
  });
});

// Start the server
async function startServer() {
  try {
    // Server configuration
    const port = process.env.PORT || 4003;
    const host = process.env.HOST || '0.0.0.0';
    const availablePort = port;
    
    // Initialize database
    await initializeDatabase();
    
    // Create HTTP server
    const httpServer = createHttpServer(app);
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws, req) => {
      console.log('[WebSocket] New connection established');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('[WebSocket] Received message:', data);
        } catch (e) {
          console.warn('[WebSocket] Invalid JSON message:', e.message);
        }
      });
      
      ws.on('close', () => {
        console.log('[WebSocket] Connection closed');
      });
    });
    
    // Start listening
    httpServer.listen(availablePort, host, () => {
      console.log(`[SERVER] HTTP running on http://${host}:${availablePort}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('[SERVER] Press Ctrl+C to stop');
    });

    // Handle server errors
    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[SERVER_ERROR] Port ${availablePort} is already in use.`);
        process.exit(1);
      } else {
        console.error('[SERVER_ERROR]', error);
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n[SERVER] Shutting down gracefully...');
      httpServer.close(() => {
        console.log('[SERVER] HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\n[SERVER] Received SIGTERM, shutting down gracefully...');
      httpServer.close(() => {
        console.log('[SERVER] HTTP server closed');
        process.exit(0);
      });
    });

    return httpServer;
  } catch (error) {
    console.error('[SERVER_ERROR] Failed to start server:', error);
    process.exit(1);
  }
}

// --- AI SERVICE INIT ---
const MISTRAL_KEY = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || '';
try {
  global.aiService = new AIService(MISTRAL_KEY);
  console.log(`[SERVER] AI service ${MISTRAL_KEY ? 'initialized with API key' : 'initialized without API key (image search only)'}`);
} catch (e) {
  console.error('[SERVER] Failed to initialize AI service:', e.message);
  global.aiService = new AIService('');
}

// Start the server only when not running under tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// SPA fallback: always serve index.html with no-cache so clients fetch the latest bundle
app.get('*', (req, res, next) => {
  // Let API endpoints and static files pass through
  if (req.path.startsWith('/api/') || req.path.startsWith('/images/') || req.path.startsWith('/cached-images/')) {
    return next();
  }
  
  // Check if the public_html directory and index.html exist
  const indexPath = path.join(buildPath, 'index.html');
  if (!fs.existsSync(buildPath) || !fs.existsSync(indexPath)) {
    console.warn(`[SERVER] Frontend not found - ${buildPath}/index.html not found`);
    return res.status(503).json({
      error: 'Frontend not available',
      message: `The application frontend has not been found at ${buildPath}. Please ensure the frontend is built and deployed to the correct location.`,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  } catch (e) {
    console.error('[SERVER] Failed to serve SPA index.html:', e.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to serve frontend application',
      timestamp: new Date().toISOString()
    });
  }
});

