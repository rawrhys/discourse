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
import { compressImage, getOptimalFormat, getFileExtension, formatFileSize } from './src/utils/imageCompression.js';
import sharp from 'sharp';
import imageProxyHandler from './src/utils/proxy.js';
// import { isValidFlashcardTerm } from './src/utils/flashcardUtils.js';



// Load environment variables from .env file
dotenv.config();

const app = express();

// --- CORE MIDDLEWARE ---
// Apply compression to all responses
// app.use(compression());

// Set reverse proxy trust for correct protocol/IP detection
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

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
const FETCH_TIMEOUT_MS = Number(process.env.IMAGE_SEARCH_TIMEOUT_MS || 5000);
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

// Simple heuristic to score image candidates for relevance
function computeImageRelevanceScore(subject, mainText, meta) {
  try {
    const subj = String(subject || '').toLowerCase();
    const text = String(mainText || '').toLowerCase();
    const title = String(meta?.title || '').toLowerCase();
    const desc = String(meta?.description || '').toLowerCase();
    const page = String(meta?.pageURL || '').toLowerCase();
    const uploader = String(meta?.uploader || '').toLowerCase();

    let score = 0;

    const haystack = `${title} ${desc} ${page} ${uploader}`;

    // Strong bonus for exact subject phrase appearing
    if (subj && haystack.includes(subj)) score += 30;

    // Token-based matching from subject and lesson content
    const subjectTokens = extractSearchKeywords(subj, null, 6);
    const contentTokens = extractSearchKeywords(text, null, 6);
    const tokens = [...new Set([...subjectTokens, ...contentTokens])];
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      if (haystack.includes(tok)) score += 4;
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
function buildRefinedSearchPhrases(subject, content, maxQueries = 10) {
  const normalize = (str) => (String(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  const STOPWORDS = new Set(['the','a','an','and','or','of','in','on','to','for','by','with','at','from','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','about','over','under','between','through','during','before','after','above','below','up','down','out','off','than','introduction','overview','lesson','chapter','period','era','history','modern']);
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

  return queries.slice(0, maxQueries);
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
2. MAIN CONTENT: The core lesson material with detailed explanations. Use newline characters for paragraphs. You MUST naturally incorporate and explain these key terms: ${keyTermsString}. Wrap all instances of these key terms with double asterisks (**key term**).
3. CONCLUSION: A summary of the key takeaways and a brief look ahead (2-3 sentences)

FORMAT EXAMPLE:
Introduction text here.|||---|||Main content with **key concepts** like **${keyTerms[0]?.term || 'Etruscans'}** and detailed explanations.|||---|||Conclusion text here.

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
  async fetchWikipediaImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }) {
    if (!subject) return null;
    console.log(`[AIService] Fetching Wikipedia image (simplified) for "${subject}", excluding ${usedImageTitles.length} titles and ${usedImageUrls.length} urls.`);

    try {
        const base = 'https://en.wikipedia.org/w/api.php';
        const keywords = buildRefinedSearchPhrases(subject, content, options.relaxed ? 12 : 6);
        const dynamicNegs = getDynamicExtraNegatives(subject);
        const mainText = extractMainLessonText(content);

        const candidates = [];

        for (const kw of keywords) {
          // Use generator=search with pageimages to directly get page thumbnails
          const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            generator: 'search',
            gsrsearch: kw,
            gsrlimit: options.relaxed ? '5' : '3',
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
            });
            candidates.push({ ...candidate, score });
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          console.log(`[AIService] Selected Wikipedia image for "${subject}" (score ${best.score}): ${best.imageUrl}`);
          const originalUrl = best.imageUrl;
          // Return proxied URL to avoid client-side 400s/CORS, but preserve original for caching
          return { ...best, imageUrl: `/api/image/proxy?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
        }

        console.warn(`[AIService] No Wikipedia image found for "${subject}" after simplified search.`);
        return null;
        
    } catch (err) {
        console.warn(`[AIService] Wikipedia image fetch failed for "${subject}":`, err.message);
        return null;
    }
  }
  
  async fetchPixabayImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }) {
    const apiKey = getPixabayApiKey();
    if (!apiKey) {
      return null;
    }
    try {
      const queries = buildRefinedSearchPhrases(subject, content, options.relaxed ? 12 : 6);
      // Ensure the full subject phrase is first
      if (String(subject || '').trim()) {
        const s = String(subject).trim();
        if (!queries.includes(s)) queries.unshift(s);
      }

      const perPage = options.relaxed ? 80 : 40;
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
          });
          candidates.push({ ...candidate, score });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const originalUrl = best.imageUrl;
        // Return proxied URL so clients fetch via our server (avoids 400s/CORS), but preserve original for caching
        return { ...best, imageUrl: `/api/image/proxy?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
      }
      return null;
    } catch (e) {
      console.warn('[AIService] Pixabay fetch failed:', e.message);
      return null;
    }
  }

  // Met Museum image service removed
   
  // Try Wikipedia first; then Pixabay
  async fetchRelevantImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }) {
    const wiki = await this.fetchWikipediaImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed });
    const pixa = await this.fetchPixabayImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed });
    if (wiki && pixa) {
      return (Number(pixa.score || 0) > Number(wiki.score || 0)) ? pixa : wiki;
    }
    return wiki || pixa;
  }
  
  async generateCourse(topic, difficulty, numModules, numLessonsPerModule = 3) {
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
            
            // Generate quiz with minimal delay
            try {
              const quizQuestions = await this.generateQuiz(lesson.content, lesson.title);
              lesson.quiz = quizQuestions || [];
            } catch (quizError) {
              lesson.quiz = []; // Continue without quiz
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

            // Reduced delay for faster processing
            await new Promise(resolve => setTimeout(resolve, 500));
            
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
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
    
    const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
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

    // Set up streaming response
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no'
    });

    // Define the progress callback for the AI service
    global.progressCallback = (progressData) => {
      // ... existing code ...
    };

    try {
        const { topic, difficulty, numModules, numLessonsPerModule } = req.body;
        
        console.log(`[COURSE_GENERATION] Starting generation for user ${user.id}:`, {
            topic,
            difficulty,
            numModules,
            numLessonsPerModule
        });

        // Send initial status - DO NOT deduct credits yet
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting course generation...' })}\n\n`);
        
        // Send AI service starting signal
        res.write(`data: ${JSON.stringify({ type: 'ai_service_starting', message: 'Initializing AI service...' })}\n\n`);

        // Send generation starting signal
        res.write(`data: ${JSON.stringify({ type: 'generating', message: 'Generating course content...', currentModule: 0, totalModules: numModules })}\n\n`);

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
          // Refund credit and stop
          user.courseCredits = (user.courseCredits || 0) + 1;
          await db.write();
          console.warn('[COURSE_GENERATION] Blocked by content policy. Topic:', topic);
          const payload = {
            type: 'error',
            code: 'CONTENT_POLICY_BLOCKED',
            message: 'The requested topic violates our content policy and cannot be generated.'
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          return res.end();
        }

        // Create a generation session for this user
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        global.generationSessions = global.generationSessions || new Map();
        global.generationSessions.set(generationId, {
          userId: user.id,
          status: 'generating',
          progress: {
            stage: 'generating',
            message: 'Generating course content...',
            currentModule: 0,
            totalModules: numModules,
            currentLesson: 0,
            totalLessons: numModules * numLessonsPerModule,
            details: []
          },
          startTime: new Date().toISOString(),
          topic,
          difficulty,
          numModules,
          numLessonsPerModule
        });

        // Send generation session ID to frontend
        res.write(`data: ${JSON.stringify({ 
          type: 'generation_session', 
          generationId,
          message: 'Generation session started' 
        })}\n\n`);

        // Start generation in background
        global.aiService.generateCourse(topic, difficulty, numModules, numLessonsPerModule, (progressData) => {
          // Update session progress
          const session = global.generationSessions.get(generationId);
          if (session) {
            session.progress = { ...session.progress, ...progressData };
            session.progress.details = [...(session.progress.details || []), {
              timestamp: new Date().toISOString(),
              message: progressData.message || 'Progress update'
            }];
          }
        }).then(async (course) => {
          // Generation completed - save course and update session
          try {
            if (!course || !course.title) {
              throw new Error('Failed to generate course structure');
            }

            // Update session for validation stage
            let session = global.generationSessions.get(generationId);
              if (session) {
                session.progress = {
                  ...session.progress,
                  stage: 'validating',
                  message: 'Validating course structure...',
                  details: [...(session.progress.details || []), {
                    timestamp: new Date().toISOString(),
                    message: '🔍 Validating course structure...'
                  }]
                };
              }

              // Final validation: ensure all modules have proper isLocked properties
              if (course.modules && Array.isArray(course.modules)) {
                course.modules.forEach((module, mIdx) => {
                  if (module.isLocked === undefined) {
                    module.isLocked = mIdx > 0;
                  }
                });
              }

            // Assign user ID to the course
            course.userId = user.id;
            course.id = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            course.createdAt = new Date().toISOString();
            course.published = false;

            // Update session for saving stage
            if (session) {
              session.progress = {
                ...session.progress,
                stage: 'saving',
                message: 'Saving course to database...',
                details: [...(session.progress.details || []), {
                  timestamp: new Date().toISOString(),
                  message: '💾 Saving course to database...'
                }]
              };
            }

              // Save the course to database
              db.data.courses.push(course);
              await db.write();

              console.log(`[COURSE_GENERATION] Course saved with ID: ${course.id}`);

            // Deduct credits after successful completion
            user.courseCredits = Math.max(0, user.courseCredits - 1);
            await db.write();
            
            console.log(`[COURSE_GENERATION] Deducted 1 credit from user ${user.id}. Remaining: ${user.courseCredits}`);

            // Update session with completed course
            if (session) {
              session.status = 'completed';
              session.course = course;
              session.creditsRemaining = user.courseCredits;
            }

            console.log(`[COURSE_GENERATION] Course generation completed successfully for user ${user.id}`);
            console.log(`[COURSE_GENERATION] Course ID: ${course.id}, Title: ${course.title}`);
            console.log(`[COURSE_GENERATION] Credits remaining: ${user.courseCredits}`);

          } catch (saveError) {
            console.error(`[COURSE_GENERATION] Error saving course:`, saveError);
            if (session) {
              session.status = 'error';
              session.error = saveError.message;
            }
          }
        }).catch(async (error) => {
          // Generation failed
          console.error(`[COURSE_GENERATION] Error generating course:`, error);
          let session = global.generationSessions.get(generationId);
          if (session) {
            session.status = 'error';
            session.error = error.message;
          }
        });

        // Send initial progress
        res.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          stage: 'generating',
          message: 'Generating course content...',
          currentModule: 0,
          totalModules: numModules,
          currentLesson: 0,
          totalLessons: numModules * numLessonsPerModule
        })}\n\n`);

        // Keep connection alive for a short time to send initial updates
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({ 
            type: 'stream_ended', 
            generationId,
            message: 'Stream ended, use polling for updates' 
          })}\n\n`);
          res.end();
        }, 2000);

        // Return early - don't await the generation
        return;

    } catch (error) {
        console.error(`[COURSE_GENERATION] Error generating course for user ${user.id}:`, error);
        
        // No credit refund needed since credits weren't deducted yet
        const errorData = {
            type: 'error',
            message: error.message || 'Course generation failed',
            creditsRefunded: false,
            creditsRemaining: user.courseCredits
        };
        
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    } finally {
        res.end();
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
      
      console.log('[ImageSearch] Calling fetchRelevantImage...');
      let imageData = await global.aiService.fetchRelevantImage(lessonTitle, content, safeUsedTitles, safeUsedUrls, { relaxed: false });
      
      if (!imageData) {
          console.log('[ImageSearch] No image found with strict search, trying relaxed...');
          imageData = await global.aiService.fetchRelevantImage(lessonTitle, content, safeUsedTitles, safeUsedUrls, { relaxed: true });
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

// --- IMAGE PROXY ---
app.get('/api/image/proxy', imageProxyHandler);

// Primary route
app.post('/api/image-search/search', imageSearchHandler);
// Aliases for compatibility (some proxies may not forward hyphenated path)
app.post('/api/image-search/search', imageSearchHandler);
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
    
    // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
    const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
    
    console.log(`[API] Publish request:`, {
      originalCourseId: courseId,
      normalizedCourseId: normalizedCourseId,
      userId: userId,
      availableCourseIds: db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published }))
    });
    
    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
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

    // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
    const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');
    
    console.log(`[API] Unpublish request:`, {
      originalCourseId: courseId,
      normalizedCourseId: normalizedCourseId,
      userId: userId,
      availableCourseIds: db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published }))
    });

    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);
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

// Get a published course (public access, no authentication required)
app.get('/api/public/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
    const normalizedId = String(courseId || '').replace(/_[0-9]{10,}$/,'');
    
    console.log(`[API] Fetching public course ${courseId} (normalized: ${normalizedId})`);
    
    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedId);
    
    if (!course) {
      console.log(`[API] Public course not found: ${normalizedId}`);
      console.log(`[API] Available course IDs:`, db.data.courses.map(c => ({ id: c.id, title: c.title, published: c.published })));
      return res.status(404).json({ 
        error: 'Course not found',
        message: 'The requested course does not exist or may have been deleted.',
        normalizedId: normalizedId
      });
    }
    
    if (!course.published) {
      console.log(`[API] Course ${normalizedId} is not published`);
      return res.status(404).json({ 
        error: 'Course not found',
        message: 'This course is not publicly available.'
      });
    }
    
    console.log(`[API] Returning public course data:`, {
      id: course.id,
      title: course.title,
      modulesCount: course.modules?.length,
      totalLessons: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0)
    });
    
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to fetch public course:', error);
    res.status(500).json({ error: 'Failed to fetch public course' });
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

    // Normalize: strip optional trailing _<timestamp> (e.g., _1754750525562)
    const normalizedCourseId = String(courseId || '').replace(/_[0-9]{10,}$/, '');

    console.log(`[API] Deleting course ${courseId} (normalized: ${normalizedCourseId}) for user ${userId} (${userEmail})`);

    // First, find the course by ID regardless of owner
    const course = db.data.courses.find(c => String(c.id || '').replace(/_[0-9]{10,}$/, '') === normalizedCourseId);

    if (!course) {
      console.log(`[API] Delete failed, course not found:`, {
        requestedId: courseId,
        normalizedId: normalizedCourseId,
        availableIds: db.data.courses.map(c => c.id)
      });
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this course' });
    }

    db.data.courses = db.data.courses.filter(c => c !== course);
    await db.write();

    res.json({ success: true });
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

// Serve static assets from the 'dist' directory
const buildPath = path.join(__dirname, 'dist');
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



app.set('trust proxy', true);

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
      // ... existing code ...
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
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(path.join(buildPath, 'index.html'));
  } catch (e) {
    console.error('[SERVER] Failed to serve SPA index.html:', e.message);
  }
});

// Endpoint to clear quiz scores for a course
app.post('/api/courses/:courseId/clear-quiz-scores', authenticateToken, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  console.log(`[CLEAR_QUIZ_SCORES] Clearing quiz scores for course: ${courseId}, user: ${userId}`);

  try {
    await db.read();
    const course = db.data.courses.find(c => c.id === courseId && c.userId === userId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    let clearedScores = 0;

    // Clear quiz scores for all lessons in all modules
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (lesson.quizScores) {
          delete lesson.quizScores[userId];
          clearedScores++;
        }
        if (lesson.lastQuizScore) {
          delete lesson.lastQuizScore;
        }
      }
      // Reset module completion status
      if (module.isCompleted) {
        module.isCompleted = false;
      }
      if (module.isLocked === false && module !== course.modules[0]) {
        module.isLocked = true;
      }
    }

    await db.write();

    console.log(`[CLEAR_QUIZ_SCORES] Cleared ${clearedScores} quiz scores for course: ${courseId}`);

    res.json({
      message: 'Quiz scores cleared successfully',
      clearedScores,
      courseId
    });

  } catch (error) {
    console.error('[CLEAR_QUIZ_SCORES] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { app, db, startServer };
