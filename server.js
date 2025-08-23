import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';

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
import nodemailer from 'nodemailer';
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

// Initialize global SSE connections for real-time updates
global.sseConnections = new Map();
global.generationSessions = new Map();

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
// File upload middleware - must come BEFORE express.json() for FormData
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: '/tmp/',
  debug: process.env.NODE_ENV === 'development'
}));

// JSON and URL-encoded middleware - must come AFTER fileUpload
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    // Check if this is historical/educational content
    const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subj) || 
                               /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(text) ||
                               /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(courseTitle) ||
                               /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(courseSubject);

    // Check if this is art-related content (art, artist, painting, etc.)
    const isArtContent = /\b(art|artist|painting|sculpture|drawing|artwork|gallery|museum|canvas|oil|watercolor|acrylic|fresco|mosaic|relief|statue|bust|portrait|landscape|still life|abstract|realistic|impressionist|modern|classical|renaissance|baroque|romantic|neoclassical|medieval|ancient|prehistoric|cave|temple|architecture|design|composition|color|form|line|texture|perspective|lighting|shadow|brush|palette|easel|studio|exhibition|masterpiece|masterwork|iconic|famous|renowned|celebrated|influential|pioneering|revolutionary|innovative|traditional|contemporary|classical|antique|vintage|heritage|cultural|historical|archaeological|anthropological|ethnographic|decorative|ornamental|ceremonial|ritual|religious|sacred|secular|profane|domestic|public|private|monumental|intimate|grand|delicate|bold|subtle|dramatic|peaceful|dynamic|static|flowing|rigid|organic|geometric|naturalistic|stylized|symbolic|narrative|allegorical|mythological|biblical|historical|portrait|landscape|genre|still life|abstract|non-objective|figurative|non-figurative)\b/i.test(subj) || 
                        /\b(art|artist|painting|sculpture|drawing|artwork|gallery|museum|canvas|oil|watercolor|acrylic|fresco|mosaic|relief|statue|bust|portrait|landscape|still life|abstract|realistic|impressionist|modern|classical|renaissance|baroque|romantic|neoclassical|medieval|ancient|prehistoric|cave|temple|architecture|design|composition|color|form|line|texture|perspective|lighting|shadow|brush|palette|easel|studio|exhibition|masterpiece|masterwork|iconic|famous|renowned|celebrated|influential|pioneering|revolutionary|innovative|traditional|contemporary|classical|antique|vintage|heritage|cultural|historical|archaeological|anthropological|ethnographic|decorative|ornamental|ceremonial|ritual|religious|sacred|secular|profane|domestic|public|private|monumental|intimate|grand|delicate|bold|subtle|dramatic|peaceful|dynamic|static|flowing|rigid|organic|geometric|naturalistic|stylized|symbolic|narrative|allegorical|mythological|biblical|historical|portrait|landscape|genre|still life|abstract|non-objective|figurative|non-figurative)\b/i.test(text) ||
                        /\b(art|artist|painting|sculpture|drawing|artwork|gallery|museum|canvas|oil|watercolor|acrylic|fresco|mosaic|relief|statue|bust|portrait|landscape|still life|abstract|realistic|impressionist|modern|classical|renaissance|baroque|romantic|neoclassical|medieval|ancient|prehistoric|cave|temple|architecture|design|composition|color|form|line|texture|perspective|lighting|shadow|brush|palette|easel|studio|exhibition|masterpiece|masterwork|iconic|famous|renowned|celebrated|influential|pioneering|revolutionary|innovative|traditional|contemporary|classical|antique|vintage|heritage|cultural|historical|archaeological|anthropological|ethnographic|decorative|ornamental|ceremonial|ritual|religious|sacred|secular|profane|domestic|public|private|monumental|intimate|grand|delicate|bold|subtle|dramatic|peaceful|dynamic|static|flowing|rigid|organic|geometric|naturalistic|stylized|symbolic|narrative|allegorical|mythological|biblical|historical|portrait|landscape|genre|still life|abstract|non-objective|figurative|non-figurative)\b/i.test(courseTitle) ||
                        /\b(art|artist|painting|sculpture|drawing|artwork|gallery|museum|canvas|oil|watercolor|acrylic|fresco|mosaic|relief|statue|bust|portrait|landscape|still life|abstract|realistic|impressionist|modern|classical|renaissance|baroque|romantic|neoclassical|medieval|ancient|prehistoric|cave|temple|architecture|design|composition|color|form|line|texture|perspective|lighting|shadow|brush|palette|easel|studio|exhibition|masterpiece|masterwork|iconic|famous|renowned|celebrated|influential|pioneering|revolutionary|innovative|traditional|contemporary|classical|antique|vintage|heritage|cultural|historical|archaeological|anthropological|ethnographic|decorative|ornamental|ceremonial|ritual|religious|sacred|secular|profane|domestic|public|private|monumental|intimate|grand|delicate|bold|subtle|dramatic|peaceful|dynamic|static|flowing|rigid|organic|geometric|naturalistic|stylized|symbolic|narrative|allegorical|mythological|biblical|historical|portrait|landscape|genre|still life|abstract|non-objective|figurative|non-figurative)\b/i.test(courseSubject);

    // Heavy penalty for completely irrelevant objects in historical content
    if (isHistoricalContent) {
      const irrelevantObjects = [
        'dinosaur', 'toy', 'bellflower', 'crocus', 'flower', 'bud', 'sprout', 'bloom', 'petal',
        'bench', 'chair', 'table', 'furniture', 'office', 'kitchen', 
        'bathroom', 'bedroom', 'living room', 'garden', 'tree', 'plant', 'pet', 
        'car', 'vehicle', 'building', 'house', 'apartment', 'dawn', 'ocean', 'nature', 'sky', 
        'sunrise', 'sunset', 'landscape', 'early morning', 'boating', 'intercoastal', 'marsh'
      ];
      
      // For art history courses, be more lenient with certain terms
      const isArtHistoryCourse = courseTitle.toLowerCase().includes('art history') || 
                                courseTitle.toLowerCase().includes('art') ||
                                courseSubject.toLowerCase().includes('art history') || 
                                courseSubject.toLowerCase().includes('art');
      
      // Cultural mismatch penalties - heavy penalties for wrong civilizations
      const culturalMismatches = {
        'egypt': ['mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'norse', 'viking', 'germanic', 'north germanic', 'scandinavian', 'roman', 'greek', 'hellenistic', 'persian', 'achaemenid', 'sassanid', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader', 'thor', 'hammer', 'mjolnir', 'nordic', 'scandinavian', 'germanic', 'north germanic', 'old norse', 'norse religion', 'norse mythology', 'norse gods', 'norse pantheon', 'norse tradition', 'norse culture', 'early dynastic period mesopotamia', 'mesopotamian', 'mesopotamian civilization', 'mesopotamian culture'],
        'rome': ['egyptian', 'pharaoh', 'pyramid', 'nile', 'mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'norse', 'viking', 'germanic', 'north germanic', 'scandinavian', 'greek', 'hellenistic', 'persian', 'achaemenid', 'sassanid', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader', 'thor', 'hammer', 'mjolnir', 'nordic'],
        'greek': ['egyptian', 'pharaoh', 'pyramid', 'nile', 'mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'norse', 'viking', 'germanic', 'north germanic', 'scandinavian', 'roman', 'persian', 'achaemenid', 'sassanid', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader', 'thor', 'hammer', 'mjolnir', 'nordic']
      };
      
      // Check for cultural mismatches based on course context
      const courseTopic = courseTitle + ' ' + courseSubject;
      for (const [culture, mismatches] of Object.entries(culturalMismatches)) {
        if (courseTopic.toLowerCase().includes(culture)) {
          for (const mismatch of mismatches) {
            if (haystack.includes(mismatch)) {
              score -= 1000; // Even heavier penalty for cultural mismatches
              console.log(`[ImageScoring] Very heavy cultural mismatch penalty for "${mismatch}" in ${culture} course`);
            }
          }
        }
      }
      
      for (const obj of irrelevantObjects) {
        if (haystack.includes(obj)) {
                // For art history courses, be much more lenient with all terms
      if (isArtHistoryCourse || isArtContent) {
        // For art content, only apply very light penalties for completely irrelevant terms
        const completelyIrrelevantForArt = ['dinosaur', 'toy', 'bellflower', 'crocus', 'flower', 'bud', 'sprout', 'bloom', 'petal', 'bathroom', 'bedroom', 'kitchen', 'car', 'vehicle', 'apartment', 'dawn', 'ocean', 'nature', 'sky', 'sunrise', 'sunset', 'landscape', 'early morning', 'boating', 'intercoastal', 'marsh'];
        
        if (completelyIrrelevantForArt.includes(obj)) {
          score -= 20; // Very light penalty for completely irrelevant terms in art context
          console.log(`[ImageScoring] Very light penalty for "${obj}" in art context: ${haystack.substring(0, 100)}`);
        } else {
          // No penalty for potentially art-related terms
          console.log(`[ImageScoring] No penalty for "${obj}" in art context: ${haystack.substring(0, 100)}`);
        }
      } else {
        score -= 500; // Much heavier penalty for irrelevant objects in historical content
        console.log(`[ImageScoring] Heavy penalty for irrelevant object "${obj}" in historical content`);
      }
        }
      }
    }

    // Heavy penalty for colonization-related content (often irrelevant to historical lessons)
    const colonizationTerms = ['colonization', 'colonial', 'colony', 'colonist', 'settler', 'colonialism'];
    for (const term of colonizationTerms) {
      if (haystack.includes(term)) {
        if (isArtContent) {
          score -= 10; // Light penalty for colonization terms in art content
          console.log(`[ImageScoring] Light penalty for colonization term "${term}" in art content`);
        } else {
          score -= 100; // Heavy penalty for colonization-related content
          console.log(`[ImageScoring] Heavy penalty for colonization term "${term}"`);
        }
      }
    }

    // Immediate rejection for Norse/Thor content in non-Norse courses
    const norseTerms = ['thor', 'hammer', 'mjolnir', 'norse', 'viking', 'germanic', 'scandinavian', 'nordic'];
    const isNorseContent = norseTerms.some(term => haystack.includes(term));
    if (isNorseContent && !courseTitle.toLowerCase().includes('norse') && !courseTitle.toLowerCase().includes('viking')) {
      score -= 10000; // Immediate rejection for Norse content in non-Norse courses
      console.log(`[ImageScoring] Immediate rejection for Norse content: "${haystack.substring(0, 100)}"`);
    }

    // Immediate rejection for Mesopotamia content in Egypt courses
    const mesopotamiaTerms = ['mesopotamia', 'mesopotamian', 'sumerian', 'babylonian', 'assyrian', 'akkadian'];
    const isMesopotamiaContent = mesopotamiaTerms.some(term => haystack.includes(term));
    if (isMesopotamiaContent && courseTitle.toLowerCase().includes('egypt')) {
      score -= 10000; // Immediate rejection for Mesopotamia content in Egypt courses
      console.log(`[ImageScoring] Immediate rejection for Mesopotamia content in Egypt course: "${haystack.substring(0, 100)}"`);
    }

    // Additional immediate rejection for any Norse content in Egypt courses
    if (isNorseContent && courseTitle.toLowerCase().includes('egypt')) {
      score -= 10000; // Immediate rejection for Norse content in Egypt courses
      console.log(`[ImageScoring] Immediate rejection for Norse content in Egypt course: "${haystack.substring(0, 100)}"`);
    }
    // Strong bonus for exact subject phrase appearing
    if (subj && haystack.includes(subj)) score += 50;

    // Enhanced token-based matching using full course context
    const subjectTokens = extractSearchKeywords(subj, null, 6);
    const contentTokens = extractSearchKeywords(text, null, 6);
    const courseTokens = extractSearchKeywords(courseTitle + ' ' + courseSubject, null, 6);
    const allTokens = [...new Set([...subjectTokens, ...contentTokens, ...courseTokens])];
    
    for (const tok of allTokens) {
      if (tok.length < 3) continue;
      if (haystack.includes(tok)) score += 8;
    }

    // Course context relevance scoring - strict cultural matching

    // Course context relevance scoring - strict cultural matching
    if (courseTitle || courseSubject) {
      const courseTopic = courseTitle + ' ' + courseSubject;
      const courseContextTerms = extractSearchKeywords(courseTopic, null, 10);
      
      // Check for cultural relevance based on course topic
      let hasCulturalMatch = false;
      let culturalBonus = 0;
      let isSpecificCulturalCourse = false;
      
      if (courseTopic.toLowerCase().includes('egypt')) {
        isSpecificCulturalCourse = true;
        const egyptianTerms = ['egypt', 'egyptian', 'pharaoh', 'pyramid', 'nile', 'dynasty', 'kingdom', 'ancient egypt', 'egyptian civilization', 'egyptian empire', 'egyptian kingdom', 'egyptian dynasty', 'egyptian pharaoh', 'egyptian pyramid', 'egyptian temple', 'egyptian tomb', 'egyptian artifact', 'egyptian hieroglyph', 'egyptian mummy', 'egyptian sphinx', 'egyptian obelisk', 'egyptian papyrus', 'egyptian scroll', 'egyptian statue', 'egyptian relief', 'egyptian painting', 'egyptian architecture', 'egyptian burial', 'egyptian religion', 'egyptian god', 'egyptian goddess', 'egyptian mythology'];
        hasCulturalMatch = egyptianTerms.some(term => haystack.includes(term));
        if (hasCulturalMatch) {
          culturalBonus = 100; // Heavy bonus for Egyptian content in Egyptian course
        }
      } else if (courseTopic.toLowerCase().includes('rome')) {
        isSpecificCulturalCourse = true;
        const romanTerms = ['rome', 'roman', 'roman empire', 'roman republic', 'roman civilization', 'roman architecture', 'roman temple', 'roman forum', 'roman colosseum', 'roman aqueduct', 'roman road', 'roman legion', 'roman emperor', 'roman senate', 'roman law', 'roman art', 'roman sculpture', 'roman mosaic', 'roman fresco', 'roman bath', 'roman villa', 'roman city', 'roman province', 'roman conquest', 'roman military', 'roman government'];
        hasCulturalMatch = romanTerms.some(term => haystack.includes(term));
        if (hasCulturalMatch) {
          culturalBonus = 100; // Heavy bonus for Roman content in Roman course
        }
      } else if (courseTopic.toLowerCase().includes('greek')) {
        isSpecificCulturalCourse = true;
        const greekTerms = ['greek', 'greece', 'greek civilization', 'greek empire', 'greek city-state', 'greek temple', 'greek architecture', 'greek art', 'greek sculpture', 'greek pottery', 'greek mythology', 'greek god', 'greek goddess', 'greek philosophy', 'greek democracy', 'greek theater', 'greek olympics', 'greek warfare', 'greek colony', 'greek trade', 'greek culture', 'greek history', 'greek classical', 'greek hellenistic'];
        hasCulturalMatch = greekTerms.some(term => haystack.includes(term));
        if (hasCulturalMatch) {
          culturalBonus = 100; // Heavy bonus for Greek content in Greek course
        }
      } else if (courseTopic.toLowerCase().includes('art history') || courseTopic.toLowerCase().includes('art')) {
        // For art history courses, accept any art-related content
        const artTerms = ['art', 'painting', 'sculpture', 'drawing', 'artwork', 'artist', 'artistic', 'gallery', 'museum', 'canvas', 'oil', 'watercolor', 'acrylic', 'fresco', 'mosaic', 'relief', 'statue', 'bust', 'portrait', 'landscape', 'still life', 'abstract', 'realistic', 'impressionist', 'modern', 'classical', 'renaissance', 'baroque', 'romantic', 'neoclassical', 'medieval', 'ancient', 'prehistoric', 'cave', 'temple', 'architecture', 'design', 'composition', 'color', 'form', 'line', 'texture', 'perspective', 'lighting', 'shadow', 'brush', 'palette', 'easel', 'studio', 'exhibition', 'masterpiece', 'masterwork', 'iconic', 'famous', 'renowned', 'celebrated', 'influential', 'pioneering', 'revolutionary', 'innovative', 'traditional', 'contemporary', 'classical', 'antique', 'vintage', 'heritage', 'cultural', 'historical', 'archaeological', 'anthropological', 'ethnographic', 'decorative', 'ornamental', 'ceremonial', 'ritual', 'religious', 'sacred', 'secular', 'profane', 'domestic', 'public', 'private', 'monumental', 'intimate', 'grand', 'delicate', 'bold', 'subtle', 'dramatic', 'peaceful', 'dynamic', 'static', 'flowing', 'rigid', 'organic', 'geometric', 'naturalistic', 'stylized', 'symbolic', 'narrative', 'allegorical', 'mythological', 'biblical', 'historical', 'portrait', 'landscape', 'genre', 'still life', 'abstract', 'non-objective', 'figurative', 'non-figurative'];
        hasCulturalMatch = artTerms.some(term => haystack.includes(term));
        if (hasCulturalMatch) {
          culturalBonus = 50; // Bonus for art-related content in art history course
        }
      }
      
      // Apply cultural bonus or penalty only for specific cultural courses
      if (hasCulturalMatch) {
        score += culturalBonus;
        console.log(`[ImageScoring] Cultural match bonus: +${culturalBonus} for ${courseTopic}`);
      } else if (isSpecificCulturalCourse && !isArtContent) {
        // Only apply penalty for specific cultural courses that don't match (but not for art content)
        score -= 200;
        console.log(`[ImageScoring] Cultural mismatch penalty: -200 for ${courseTopic}`);
      } else if (isArtContent) {
        // For art content, no cultural mismatch penalty
        console.log(`[ImageScoring] No cultural penalty for art content: ${courseTopic}`);
      } else {
        // For general courses (like art history), no penalty for cultural mismatch
        console.log(`[ImageScoring] No cultural penalty for general course: ${courseTopic}`);
      }
    }

    // Additional bonus for historical content relevance
    if (isHistoricalContent) {
      // Bonus for historical terms in the image metadata
      const historicalTerms = ['ancient', 'historical', 'archaeological', 'classical', 'antiquity', 'rome', 'roman', 'greek', 'egypt', 'medieval', 'renaissance', 'dynasty', 'empire', 'kingdom', 'civilization'];
      for (const term of historicalTerms) {
        if (haystack.includes(term)) {
          score += 15; // Increased bonus for historical relevance
        }
      }
      
      // Bonus for specific historical subjects
      if (subj.includes('rome') && haystack.includes('roman')) score += 25;
      if (subj.includes('greek') && haystack.includes('greek')) score += 25;
      if (subj.includes('egypt') && haystack.includes('egypt')) score += 25;
      if (subj.includes('medieval') && haystack.includes('medieval')) score += 25;
      if (subj.includes('dynasty') && haystack.includes('dynasty')) score += 25;
      if (subj.includes('empire') && haystack.includes('empire')) score += 25;
    }

    // Additional bonus for art-related content
    if (isArtContent) {
      // Bonus for art terms in the image metadata
      const artTerms = ['art', 'artist', 'painting', 'sculpture', 'drawing', 'artwork', 'gallery', 'museum', 'canvas', 'oil', 'watercolor', 'acrylic', 'fresco', 'mosaic', 'relief', 'statue', 'bust', 'portrait', 'landscape', 'still life', 'abstract', 'realistic', 'impressionist', 'modern', 'classical', 'renaissance', 'baroque', 'romantic', 'neoclassical', 'medieval', 'ancient', 'prehistoric', 'cave', 'temple', 'architecture', 'design', 'composition', 'color', 'form', 'line', 'texture', 'perspective', 'lighting', 'shadow', 'brush', 'palette', 'easel', 'studio', 'exhibition', 'masterpiece', 'masterwork', 'iconic', 'famous', 'renowned', 'celebrated', 'influential', 'pioneering', 'revolutionary', 'innovative', 'traditional', 'contemporary', 'classical', 'antique', 'vintage', 'heritage', 'cultural', 'historical', 'archaeological', 'anthropological', 'ethnographic', 'decorative', 'ornamental', 'ceremonial', 'ritual', 'religious', 'sacred', 'secular', 'profane', 'domestic', 'public', 'private', 'monumental', 'intimate', 'grand', 'delicate', 'bold', 'subtle', 'dramatic', 'peaceful', 'dynamic', 'static', 'flowing', 'rigid', 'organic', 'geometric', 'naturalistic', 'stylized', 'symbolic', 'narrative', 'allegorical', 'mythological', 'biblical', 'historical', 'portrait', 'landscape', 'genre', 'still life', 'abstract', 'non-objective', 'figurative', 'non-figurative'];
      for (const term of artTerms) {
        if (haystack.includes(term)) {
          score += 20; // Bonus for art relevance
        }
      }
      
      // Bonus for specific art subjects
      if (subj.includes('art') && haystack.includes('art')) score += 30;
      if (subj.includes('artist') && haystack.includes('artist')) score += 30;
      if (subj.includes('painting') && haystack.includes('painting')) score += 30;
      if (subj.includes('sculpture') && haystack.includes('sculpture')) score += 30;
      if (subj.includes('drawing') && haystack.includes('drawing')) score += 30;
      if (subj.includes('gallery') && haystack.includes('gallery')) score += 30;
      if (subj.includes('museum') && haystack.includes('museum')) score += 30;
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

    // Bonus for Wikipedia images in historical contexts
    if (isHistoricalContent && page.includes('wikimedia.org')) {
      score += 25; // Bonus for Wikipedia images in historical content
      console.log(`[ImageScoring] Bonus for Wikipedia image in historical content`);
    }

    // Bonus for Wikipedia images in art contexts
    if (isArtContent && page.includes('wikimedia.org')) {
      score += 20; // Bonus for Wikipedia images in art content
      console.log(`[ImageScoring] Bonus for Wikipedia image in art content`);
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
        
        // Check if this is art-related content that should be very permissive
        const isArtContent = subject.toLowerCase().includes('art') || 
                           subject.toLowerCase().includes('artist') || 
                           subject.toLowerCase().includes('painting') || 
                           subject.toLowerCase().includes('sculpture') || 
                           subject.toLowerCase().includes('drawing') ||
                           subject.toLowerCase().includes('gallery') ||
                           subject.toLowerCase().includes('museum');
        
        // For art content, only ban extremely inappropriate terms
        if (isArtContent) {
          const extremeNegatives = [
            'nazi', 'hitler', 'swastika', 'holocaust', 'genocide',
            'terrorism', 'extremist', 'radical', 'nsfw', 'porn',
            'explicit', 'adult content', 'violence', 'gore'
          ];
          
          if (containsAny(haystack, extremeNegatives)) {
            return true;
          }
          
          // Allow most content for art topics
          return false;
        }
        
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
  const courseTitlePhrase = String(courseTitle || '').trim();
  
  // --- NEW: Music Context Detection ---
  const MUSIC_KEYWORDS = ['music', 'song', 'album', 'band', 'artist', 'concert', 'musician', 'songwriter', 'opera', 'symphony', 'beatles', 'mozart', 'beethoven'];
  const isMusicTopic = MUSIC_KEYWORDS.some(kw => 
    normalize(courseTitlePhrase).includes(kw) || normalize(subjectPhrase).includes(kw)
  );
  // --- END NEW ---

  // Combine course title and subject for primary context
  const primaryContext = courseTitlePhrase ? `${courseTitlePhrase} ${subjectPhrase}` : subjectPhrase;

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

  // Extract key terms from content for better search relevance
  const extractKeyTermsFromContent = (text) => {
    const terms = new Set();
    const raw = String(text || '');
    
    // Extract terms wrapped in ** (bold markdown)
    const boldTerms = [...raw.matchAll(/\*\*([^*]+)\*\*/g)].map(match => match[1]);
    boldTerms.forEach(term => terms.add(term));
    
    // Extract capitalized terms that might be important
    const capitalizedTerms = [...raw.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)].map(match => match[0]);
    capitalizedTerms.forEach(term => terms.add(term));
    
    // Filter out common words and short terms
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'];
    const filteredTerms = Array.from(terms).filter(term => 
      term.length > 3 && 
      !commonWords.includes(term.toLowerCase()) &&
      !term.match(/^\d+$/) // Not just numbers
    );
    
    return filteredTerms.slice(0, 10); // Take top 10 terms
  };

  const contentKeyTerms = extractKeyTermsFromContent(contentText);
  const contentProperPhrases = extractProperNounPhrases(contentText);
  const subjectProperPhrases = extractProperNounPhrases(subjectPhrase);

  // Start building queries with the most specific content first
  const queries = [];

  // Highest priority: Course title + Subject
  if (courseTitlePhrase) {
    dedupePush(queries, normalize(primaryContext));
  }
  
      // --- NEW: Inject Music Keywords ---
    if (isMusicTopic) {
      if (courseTitlePhrase) {
        dedupePush(queries, `${normalize(courseTitlePhrase)} album art`);
        dedupePush(queries, `${normalize(primaryContext)} live performance`);
        dedupePush(queries, `${normalize(courseTitlePhrase)} band photo`);
        dedupePush(queries, `${normalize(courseTitlePhrase)} musician`);
      }
      dedupePush(queries, `${normalize(subjectPhrase)} concert`);
      dedupePush(queries, `${normalize(subjectPhrase)} band`);
      dedupePush(queries, `${normalize(subjectPhrase)} musician`);
      
      // Extract key music terms from subject for better search
      const musicTerms = extractMusicTerms(subjectPhrase);
      for (const term of musicTerms) {
        dedupePush(queries, `${term} music`);
        dedupePush(queries, `${term} band`);
        dedupePush(queries, `${term} album`);
        if (queries.length >= maxQueries) break;
      }
      
      // Add specific Beatles-related search terms if detected
      if (subjectPhrase.toLowerCase().includes('beatles') || courseTitlePhrase.toLowerCase().includes('beatles')) {
        dedupePush(queries, 'beatles band photo');
        dedupePush(queries, 'beatles concert');
        dedupePush(queries, 'beatles album cover');
        dedupePush(queries, 'beatles live performance');
        dedupePush(queries, 'beatles studio recording');
        dedupePush(queries, 'beatles 1960s');
        dedupePush(queries, 'beatles fab four');
        dedupePush(queries, 'beatles liverpool');
      }
      
      // Add more generic music search terms for better coverage
      dedupePush(queries, 'rock band');
      dedupePush(queries, 'music group');
      dedupePush(queries, 'musical artist');
      dedupePush(queries, 'recording artist');
    }
    // --- END NEW ---
  
  // Next priority: Course title + proper nouns from content
  if (courseTitlePhrase) {
    for (const phrase of contentProperPhrases.slice(0, 3)) {
      const combined = `${normalize(courseTitlePhrase)} ${normalize(phrase)}`.trim();
      dedupePush(queries, combined);
      if (queries.length >= maxQueries) break;
    }
  }

  // Always include the full subject phrase as-is and normalized
  if (subjectPhrase) {
    dedupePush(queries, subjectPhrase);
    const normalizedSubject = normalize(subjectPhrase);
    if (normalizedSubject && normalizedSubject !== subjectPhrase.toLowerCase()) {
      dedupePush(queries, normalizedSubject);
    }
  }

  // For Egypt courses, add specific Egyptian search terms to improve relevance
  if (courseTitle && courseTitle.toLowerCase().includes('egypt')) {
    dedupePush(queries, 'ancient egypt');
    dedupePush(queries, 'egyptian civilization');
    dedupePush(queries, 'egyptian pharaoh');
    dedupePush(queries, 'egyptian pyramid');
    dedupePush(queries, 'egyptian temple');
    dedupePush(queries, 'egyptian tomb');
    dedupePush(queries, 'egyptian artifact');
    dedupePush(queries, 'egyptian archaeology');
    dedupePush(queries, 'egyptian religion');
    dedupePush(queries, 'egyptian society');
    dedupePush(queries, 'egyptian culture');
    dedupePush(queries, 'egyptian kingdom');
    dedupePush(queries, 'egyptian dynasty');
  }
  
  // For Alexander the Great courses, add specific search terms
  if (courseTitle && courseTitle.toLowerCase().includes('alexander')) {
    dedupePush(queries, 'alexander the great');
    dedupePush(queries, 'macedonian empire');
    dedupePush(queries, 'ancient macedonia');
    dedupePush(queries, 'hellenistic period');
    dedupePush(queries, 'ancient greece');
    dedupePush(queries, 'greek empire');
    dedupePush(queries, 'ancient warfare');
    dedupePush(queries, 'ancient military');
    dedupePush(queries, 'ancient conquest');
    dedupePush(queries, 'ancient battle');
    dedupePush(queries, 'ancient army');
    dedupePush(queries, 'ancient soldier');
    dedupePush(queries, 'ancient general');
    dedupePush(queries, 'ancient king');
    dedupePush(queries, 'ancient ruler');
    dedupePush(queries, 'ancient leader');
    dedupePush(queries, 'ancient civilization');
    dedupePush(queries, 'ancient history');
    dedupePush(queries, 'ancient art');
    dedupePush(queries, 'ancient architecture');
    dedupePush(queries, 'ancient city');
    dedupePush(queries, 'ancient temple');
    dedupePush(queries, 'ancient monument');
    dedupePush(queries, 'ancient statue');
    dedupePush(queries, 'ancient sculpture');
    dedupePush(queries, 'ancient painting');
    dedupePush(queries, 'ancient artifact');
    dedupePush(queries, 'ancient archaeology');
  }

  // Add content-specific search terms for better relevance
  for (const term of contentKeyTerms) {
    // For Egypt courses, combine content terms with Egyptian context
    if (courseTitle && courseTitle.toLowerCase().includes('egypt')) {
      dedupePush(queries, `${term} ancient egypt`);
      dedupePush(queries, `${term} egyptian`);
      dedupePush(queries, `egyptian ${term}`);
    } else {
      dedupePush(queries, term);
    }
    if (queries.length >= maxQueries) break;
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

  // Add content-specific combinations for better search relevance
  for (const contentTerm of contentKeyTerms.slice(0, 5)) {
    for (const phrase of properPhrases.slice(0, 3)) {
      const combined = `${contentTerm} ${normalize(phrase)}`.trim();
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
    
    // Filter out generic terms that don't add value to image search
    const genericTerms = ['early', 'period', 'dynasty', 'kingdom', 'empire', 'civilization', 'history', 'ancient', 'old', 'new', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'religion', 'society'];
    const isGenericTerm = genericTerms.includes(kw.toLowerCase());
    if (isGenericTerm) continue;
    
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
    // Add culturally specific queries based on course context
    const courseContext = courseTitle || '';
    
    if (courseContext.toLowerCase().includes('egypt')) {
      // Egyptian-specific queries with stronger cultural focus
      for (const phrase of properPhrases.slice(0, 4)) {
        dedupePush(queries, `${phrase} ancient egypt`);
        dedupePush(queries, `${phrase} egyptian civilization`);
        dedupePush(queries, `${phrase} egyptian artifact`);
        dedupePush(queries, `${phrase} egyptian archaeology`);
        dedupePush(queries, `${phrase} egyptian history`);
        dedupePush(queries, `${phrase} egyptian pharaoh`);
        dedupePush(queries, `${phrase} egyptian temple`);
        dedupePush(queries, `${phrase} egyptian tomb`);
        if (queries.length >= maxQueries) break;
      }
      // Add general Egyptian terms with cultural specificity
      dedupePush(queries, 'ancient egypt civilization');
      dedupePush(queries, 'egyptian pharaoh dynasty');
      dedupePush(queries, 'egyptian pyramid temple');
      dedupePush(queries, 'egyptian hieroglyphics');
      dedupePush(queries, 'egyptian mummy');
      dedupePush(queries, 'egyptian sphinx');
      dedupePush(queries, 'egyptian obelisk');
      dedupePush(queries, 'egyptian papyrus');
      dedupePush(queries, 'egyptian pyramid');
      dedupePush(queries, 'egyptian tomb');
      dedupePush(queries, 'egyptian statue');
      dedupePush(queries, 'egyptian relief');
      dedupePush(queries, 'egyptian painting');
      dedupePush(queries, 'egyptian architecture');
      dedupePush(queries, 'egyptian burial');
      dedupePush(queries, 'egyptian religion');
      dedupePush(queries, 'egyptian god');
      dedupePush(queries, 'egyptian goddess');
      dedupePush(queries, 'egyptian mythology');
    } else if (courseContext.toLowerCase().includes('rome')) {
      // Roman-specific queries
      for (const phrase of properPhrases.slice(0, 4)) {
        dedupePush(queries, `${phrase} roman empire`);
        dedupePush(queries, `${phrase} roman civilization`);
        dedupePush(queries, `${phrase} roman artifact`);
        dedupePush(queries, `${phrase} roman archaeology`);
        dedupePush(queries, `${phrase} roman history`);
        if (queries.length >= maxQueries) break;
      }
      // Add general Roman terms
      dedupePush(queries, 'roman empire civilization');
      dedupePush(queries, 'roman architecture temple');
      dedupePush(queries, 'roman military conquest');
    } else if (courseContext.toLowerCase().includes('greek')) {
      // Greek-specific queries
      for (const phrase of properPhrases.slice(0, 4)) {
        dedupePush(queries, `${phrase} ancient greece`);
        dedupePush(queries, `${phrase} greek civilization`);
        dedupePush(queries, `${phrase} greek artifact`);
        dedupePush(queries, `${phrase} greek archaeology`);
        dedupePush(queries, `${phrase} greek history`);
        if (queries.length >= maxQueries) break;
      }
      // Add general Greek terms
      dedupePush(queries, 'ancient greece civilization');
      dedupePush(queries, 'greek temple architecture');
      dedupePush(queries, 'greek mythology culture');
    } else {
      // Generic historical queries
      for (const phrase of properPhrases.slice(0, 4)) {
        dedupePush(queries, `${phrase} ancient history`);
        dedupePush(queries, `${phrase} historical artifact`);
        dedupePush(queries, `${phrase} archaeological site`);
        dedupePush(queries, `${phrase} ancient civilization`);
        if (queries.length >= maxQueries) break;
      }
    }
    
    // Add lesson-specific context to ensure uniqueness
    const lessonSpecificTerms = [];
    if (subjectPhrase.includes('early') || subjectPhrase.includes('dynastic')) {
      lessonSpecificTerms.push('early period', 'dynastic era', 'ancient kingdom');
    }
    if (subjectPhrase.includes('unification')) {
      lessonSpecificTerms.push('unified kingdom', 'united empire', 'consolidation');
    }
    if (subjectPhrase.includes('period')) {
      lessonSpecificTerms.push('historical period', 'ancient era', 'civilization');
    }
    if (subjectPhrase.includes('empire')) {
      lessonSpecificTerms.push('imperial power', 'ancient empire', 'ruling dynasty');
    }
    if (subjectPhrase.includes('dynasty')) {
      lessonSpecificTerms.push('royal dynasty', 'ruling family', 'ancient rulers');
    }
    
    // Add lesson-specific queries to ensure unique images
    for (const term of lessonSpecificTerms) {
      for (const phrase of properPhrases.slice(0, 2)) {
        dedupePush(queries, `${phrase} ${term}`);
        if (queries.length >= maxQueries) break;
      }
    }
  }
  // Ensure we have enough queries for variety
  if (queries.length < 3) {
    // Add more specific historical terms for better image variety
    const historicalTerms = ['ancient', 'historical', 'archaeological', 'classical', 'antiquity'];
    for (const term of historicalTerms) {
      for (const phrase of properPhrases.slice(0, 2)) {
        dedupePush(queries, `${phrase} ${term}`);
        if (queries.length >= maxQueries) break;
      }
    }
  }

  // Add discipline-specific search phrases for non-history courses
  const allText = `${subjectPhrase} ${contentText} ${courseTitle || ''}`.toLowerCase();
  
  // Art and Design disciplines
  if (/\b(art|painting|sculpture|drawing|design|architecture|photography|cinema|film|music|dance|theater|drama|fashion|graphic|visual|creative|artist|artwork|gallery|museum|exhibition|masterpiece|canvas|oil|watercolor|acrylic|fresco|mosaic|relief|statue|bust|portrait|landscape|still life|abstract|realistic|impressionist|modern|classical|renaissance|baroque|romantic|neoclassical|medieval|ancient|prehistoric|cave|temple|composition|color|form|line|texture|perspective|lighting|shadow|brush|palette|easel|studio)\b/i.test(allText)) {
    const artTerms = ['art', 'painting', 'sculpture', 'drawing', 'artwork', 'artist', 'gallery', 'museum', 'masterpiece', 'canvas', 'composition', 'color', 'form', 'line', 'texture', 'perspective'];
    for (const term of artTerms) {
      if (allText.includes(term) && queries.length < maxQueries) {
        dedupePush(queries, `${term} ${subjectPhrase}`);
      }
    }
  }
  
  // Science disciplines
  if (/\b(science|physics|chemistry|biology|mathematics|math|engineering|technology|computer|programming|coding|algorithm|data|research|experiment|laboratory|lab|scientific|discovery|innovation|theory|hypothesis|analysis|calculation|formula|equation|molecule|atom|cell|organism|ecosystem|climate|environment|geology|astronomy|space|universe|galaxy|planet|star|evolution|genetics|dna|microscope|telescope|microscope|beaker|test tube|petri dish|microscope|telescope)\b/i.test(allText)) {
    const scienceTerms = ['science', 'research', 'experiment', 'laboratory', 'discovery', 'theory', 'analysis', 'data', 'technology'];
    for (const term of scienceTerms) {
      if (allText.includes(term) && queries.length < maxQueries) {
        dedupePush(queries, `${term} ${subjectPhrase}`);
      }
    }
  }
  
  // Literature and Language disciplines
  if (/\b(literature|language|linguistics|philosophy|poetry|novel|story|writing|author|poet|writer|text|book|manuscript|script|dialogue|narrative|metaphor|symbolism|allegory|theme|character|plot|setting|genre|fiction|non-fiction|drama|tragedy|comedy|epic|sonnet|haiku|essay|criticism|analysis|interpretation|translation|grammar|syntax|semantics|rhetoric|logic|ethics|aesthetics|epistemology|ontology|metaphysics)\b/i.test(allText)) {
    const literatureTerms = ['literature', 'writing', 'author', 'book', 'text', 'story', 'poetry', 'philosophy'];
    for (const term of literatureTerms) {
      if (allText.includes(term) && queries.length < maxQueries) {
        dedupePush(queries, `${term} ${subjectPhrase}`);
      }
    }
  }
  
  // Social Sciences disciplines
  if (/\b(sociology|psychology|anthropology|economics|political|politics|government|society|culture|social|behavior|human|mind|consciousness|perception|cognition|learning|memory|emotion|personality|development|childhood|adolescence|adulthood|aging|family|marriage|divorce|education|school|university|college|classroom|student|teacher|professor|curriculum|pedagogy|assessment|evaluation|research|survey|interview|observation|statistics|data|analysis|demographics|population|migration|urban|rural|community|organization|institution|bureaucracy|democracy|dictatorship|monarchy|republic|constitution|law|legal|justice|court|crime|criminal|punishment|rehabilitation|welfare|health|medicine|medical|doctor|nurse|hospital|clinic|therapy|treatment|diagnosis|symptom|disease|illness|prevention|cure|vaccine|drug|medication|pharmacy)\b/i.test(allText)) {
    const socialScienceTerms = ['society', 'culture', 'behavior', 'research', 'analysis', 'community', 'education', 'health'];
    for (const term of socialScienceTerms) {
      if (allText.includes(term) && queries.length < maxQueries) {
        dedupePush(queries, `${term} ${subjectPhrase}`);
      }
    }
  }
  
  // Business and Economics disciplines
  if (/\b(business|economics|finance|accounting|management|marketing|advertising|sales|commerce|trade|industry|manufacturing|production|service|retail|wholesale|import|export|market|stock|bond|investment|banking|insurance|real estate|property|entrepreneurship|startup|corporation|company|firm|enterprise|organization|strategy|planning|leadership|administration|human resources|operations|logistics|supply chain|inventory|quality|efficiency|productivity|profit|revenue|cost|expense|budget|financial|monetary|fiscal|tax|tariff|subsidy|regulation|deregulation|privatization|nationalization|globalization|international|multinational|transnational)\b/i.test(allText)) {
    const businessTerms = ['business', 'economics', 'finance', 'management', 'market', 'industry', 'commerce'];
    for (const term of businessTerms) {
      if (allText.includes(term) && queries.length < maxQueries) {
        dedupePush(queries, `${term} ${subjectPhrase}`);
      }
    }
  }

  // Filter out culturally inappropriate queries for history courses
  if (isHistoryCourse) {
    const courseContext = courseTitle || '';
    const filteredQueries = [];
    
    // Define culturally inappropriate terms for each civilization
    const inappropriateTerms = {
      'egypt': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'roman', 'greek', 'hellenistic', 'persian', 'mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader'],
      'rome': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'egyptian', 'pharaoh', 'pyramid', 'nile', 'greek', 'hellenistic', 'persian', 'mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader'],
      'greek': ['norse', 'viking', 'germanic', 'scandinavian', 'thor', 'hammer', 'mjolnir', 'nordic', 'egyptian', 'pharaoh', 'pyramid', 'nile', 'roman', 'persian', 'mesopotamia', 'sumerian', 'babylonian', 'assyrian', 'akkadian', 'hittite', 'hittites', 'byzantine', 'ottoman', 'arabic', 'islamic', 'medieval europe', 'renaissance', 'feudal', 'crusader']
    };
    
    // Determine which civilization this course is about
    let civilization = '';
    if (courseContext.toLowerCase().includes('egypt')) civilization = 'egypt';
    else if (courseContext.toLowerCase().includes('rome')) civilization = 'rome';
    else if (courseContext.toLowerCase().includes('greek')) civilization = 'greek';
    
    // Filter queries based on civilization
    for (const query of queries) {
      const queryLower = query.toLowerCase();
      let isAppropriate = true;
      
      if (civilization && inappropriateTerms[civilization]) {
        for (const term of inappropriateTerms[civilization]) {
          if (queryLower.includes(term)) {
            console.log(`[ImageScoring] Filtering out culturally inappropriate query: "${query}" (contains "${term}")`);
            isAppropriate = false;
            break;
          }
        }
      }
      
      if (isAppropriate) {
        filteredQueries.push(query);
      }
    }
    
    console.log(`[ImageScoring] Filtered queries for ${civilization} course: ${filteredQueries.length}/${queries.length} queries retained`);
    return filteredQueries.slice(0, maxQueries);
  }

  return queries.slice(0, maxQueries);
}

// Extract music-related terms from text for better image search
function extractMusicTerms(text) {
  const musicKeywords = [
    'beatles', 'lennon', 'mccartney', 'harrison', 'starr', 'ringo', 'paul', 'john', 'george',
    'album', 'song', 'single', 'record', 'vinyl', 'cd', 'music', 'band', 'group', 'artist',
    'concert', 'performance', 'live', 'studio', 'recording', 'producer', 'engineer',
    'guitar', 'bass', 'drums', 'piano', 'keyboard', 'vocals', 'harmony', 'melody',
    'rock', 'pop', 'folk', 'jazz', 'blues', 'country', 'classical', 'electronic',
    'singer', 'songwriter', 'composer', 'musician', 'performer', 'entertainer'
  ];
  
  const textLower = String(text || '').toLowerCase();
  const foundTerms = [];
  
  for (const keyword of musicKeywords) {
    if (textLower.includes(keyword)) {
      foundTerms.push(keyword);
    }
  }
  
  // Also extract any capitalized terms that might be band names or song titles
  const capitalizedTerms = [...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)].map(match => match[0]);
  for (const term of capitalizedTerms) {
    if (term.length > 3 && !foundTerms.includes(term.toLowerCase())) {
      foundTerms.push(term);
    }
  }
  
  return foundTerms.slice(0, 5); // Return top 5 terms
}

function getPixabayApiKey() {
  return process.env.PIXABAY_API_KEY || '';
}

function getPexelsApiKey() {
  return process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || '';
}

function getUnsplashAccessKey() {
  return process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_KEY || '';
}

async function triggerUnsplashDownload(downloadLocation) {
  try {
    const key = getUnsplashAccessKey();
    if (!key || !downloadLocation) return;
    await fetchWithTimeout(downloadLocation, {
      headers: { Authorization: `Client-ID ${key}` }
    });
  } catch (e) {
    console.warn('[AIService] Unsplash download trigger failed:', e.message);
  }
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
   * Clear cache for a specific key or all cache
   */
  clearCache(cacheKey = null) {
    try {
      if (cacheKey) {
        // Clear specific cache key
        if (this.imageCache && this.imageCache.has(cacheKey)) {
          this.imageCache.delete(cacheKey);
          console.log(`[AIService] Cleared cache key: ${cacheKey}`);
        }
      } else {
        // Clear all cache
        if (this.imageCache) {
          this.imageCache.clear();
          console.log(`[AIService] Cleared all image cache`);
        }
      }
    } catch (error) {
      console.warn(`[AIService] Cache clearing failed:`, error.message);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAllCache() {
    this.clearCache();
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
   
  // Try Wikipedia first; then Pixabay - optimized with parallel execution and caching
  async fetchRelevantImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    // Create cache key for this search - include used images to prevent duplicates
    // Use a more unique cache key that includes lesson-specific information
    const lessonId = courseContext?.lessonId || 'unknown';
    const usedTitlesHash = usedImageTitles.length > 0 ? '_usedTitles_' + usedImageTitles.slice(0, 3).join('_').replace(/[^a-zA-Z0-9]/g, '').substring(0, 50) : '';
    const usedUrlsHash = usedImageUrls.length > 0 ? '_usedUrls_' + usedImageUrls.slice(0, 2).map(url => url.split('/').pop()?.split('?')[0] || '').join('_').replace(/[^a-zA-Z0-9]/g, '').substring(0, 30) : '';
    const cacheKey = `image_search_${subject}_${lessonId}_${options.relaxed ? 'relaxed' : 'strict'}${usedTitlesHash}${usedUrlsHash}`;
    
    // Check if we have a cached result
    if (global.imageSearchCache && global.imageSearchCache.has(cacheKey)) {
      const cached = global.imageSearchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        console.log(`[AIService] Using cached image search result for "${subject}" (cache key: ${cacheKey})`);
        return cached.result;
      } else {
        global.imageSearchCache.delete(cacheKey);
      }
    }
    
    console.log(`[AIService] Performing fresh image search for "${subject}" (cache key: ${cacheKey})`);
    
    // Initialize cache if it doesn't exist
    if (!global.imageSearchCache) {
      global.imageSearchCache = new Map();
    }
    
    // Clear ALL old cache entries to force fresh searches and fix the cache collision issue
    if (global.imageSearchCache.size > 0) {
      console.log(`[AIService] Clearing all ${global.imageSearchCache.size} cache entries to fix cache collision issue`);
      global.imageSearchCache.clear();
    }
    
    // Execute searches in parallel with timeout (Wikipedia, Pixabay, Pexels)
    const searchPromises = [
      this.fetchWikipediaImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext),
      this.fetchPixabayImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext),
      this.fetchPexelsImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext),
      this.fetchUnsplashImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: !!options.relaxed }, courseContext)
    ];
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Image search timeout')), 15000); // 15 second timeout
    });
    
    try {
      const [wiki, pixa, pex, uns] = await Promise.race([
        Promise.all(searchPromises),
        timeoutPromise
      ]);
      
      // Choose best by score among available results
      let selectedImage = null;
      const pool = [wiki, pixa, pex, uns].filter(Boolean);
      if (pool.length > 0) {
        pool.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        selectedImage = pool[0];
      }
      
      // Duplicate avoidance logic remains the same
      if (selectedImage && usedImageUrls.length > 0) {
        const normalizedSelectedUrl = normalizeUrlForCompare(selectedImage.imageUrl);
        const isAlreadyUsed = usedImageUrls.some(url => normalizeUrlForCompare(url) === normalizedSelectedUrl);
        if (isAlreadyUsed) {
          console.log(`[AIService] Selected image is already used, trying alternative for "${subject}" (used URLs: ${usedImageUrls.length})`);
          // try next best alternative in pool
          const alt = pool.find(img => normalizeUrlForCompare(img.imageUrl) !== normalizedSelectedUrl);
          if (alt) {
            selectedImage = alt;
            console.log(`[AIService] Switched to alternate image source.`);
          } else if (!options.relaxed) {
            console.log(`[AIService] Trying relaxed search for alternative image for "${subject}"`);
            const relaxedResult = await this.fetchRelevantImage(subject, content, usedImageTitles, usedImageUrls, { relaxed: true }, courseContext);
            if (relaxedResult) selectedImage = relaxedResult;
          }
        }
      }
      
      // Log if we had to reject an image due to duplicates
      if (selectedImage && usedImageUrls.length > 0) {
        const normalizedSelectedUrl = normalizeUrlForCompare(selectedImage.imageUrl);
        const isAlreadyUsed = usedImageUrls.some(url => normalizeUrlForCompare(url) === normalizedSelectedUrl);
        if (isAlreadyUsed) {
          console.log(`[AIService] WARNING: Could not find alternative image for "${subject}", returning null to prevent duplicate`);
          selectedImage = null;
        }
      }
    
    // Check if this is historical/educational content
    const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subject) || 
                               /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(content);
    
    // Use the selected image (which may have been adjusted for duplicates)
    let result = selectedImage;
    
    if (result) {
      let src = 'Unknown';
      const url = (result.pageURL || '') + ' ' + (result.imageUrl || '');
      if (url.includes('wikipedia.org') || url.includes('wikimedia')) src = 'Wikipedia';
      else if (url.includes('pixabay.com')) src = 'Pixabay';
      else if (url.includes('pexels.com') || url.includes('images.pexels.com')) src = 'Pexels';
      else if (url.includes('unsplash.com') || url.includes('images.unsplash.com')) src = 'Unsplash';
      console.log(`[AIService] Final selected image for "${subject}":`, { title: result.imageTitle, score: result.score, source: src });
    } else {
      console.log(`[AIService] No images found from any service`);
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
          
          // Apply minimum score threshold for historical content to ensure relevance
          const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subject) || 
                                     /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(courseContext?.title || '');
          
          const minScoreThreshold = isHistoricalContent ? 10 : 0; // Much lower threshold to allow more relevant images
          
          if (best.score >= minScoreThreshold) {
            console.log(`[AIService] Selected Wikipedia image for "${subject}" (score ${best.score}): ${best.imageUrl}`);
            console.log(`[AIService] Wikipedia candidates found: ${candidates.length}, best score: ${best.score}`);
            const originalUrl = best.imageUrl;
            // Return fast proxied URL for maximum speed
            return { ...best, imageUrl: `/api/image/fast?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
          } else {
            console.log(`[AIService] Best Wikipedia candidate score ${best.score} below threshold ${minScoreThreshold} for "${subject}", rejecting`);
            return null;
          }
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
      const queries = buildRefinedSearchPhrases(subject, content, options.relaxed ? 4 : 2, courseContext?.title || '');
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
        
        // Apply minimum score threshold for historical content to ensure relevance
        const isHistoricalContent = /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(subject) || 
                                   /\b(ancient|rome|greek|egypt|medieval|renaissance|history|empire|republic|kingdom|dynasty|civilization)\b/i.test(courseContext?.title || '');
        
        const minScoreThreshold = isHistoricalContent ? 10 : 0; // Much lower threshold to allow more relevant images
        
        if (best.score >= minScoreThreshold) {
          console.log(`[AIService] Selected Pixabay image for "${subject}" (score ${best.score}): ${best.imageUrl}`);
          console.log(`[AIService] Pixabay candidates found: ${candidates.length}, best score: ${best.score}`);
          const originalUrl = best.imageUrl;
          // Return fast proxied URL for maximum speed
          return { ...best, imageUrl: `/api/image/fast?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
        } else {
          console.log(`[AIService] Best Pixabay candidate score ${best.score} below threshold ${minScoreThreshold} for "${subject}", rejecting`);
          return null;
        }
      }
      return null;
    } catch (e) {
      console.warn('[AIService] Pixabay fetch failed:', e.message);
      return null;
    }
  }

  async fetchPexelsImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    const apiKey = getPexelsApiKey();
    if (!apiKey) return null;
    try {
      const queries = buildRefinedSearchPhrases(subject, content, options.relaxed ? 4 : 2, courseContext?.title || '');
      if (String(subject || '').trim()) {
        const s = String(subject).trim();
        if (!queries.includes(s)) queries.unshift(s);
      }

      const candidates = [];
      const perPage = options.relaxed ? 30 : 15;
      const dynamicNegs = getDynamicExtraNegatives(subject);
      const mainText = extractMainLessonText(content);

      for (const q of queries) {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: apiKey }
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const photos = Array.isArray(data?.photos) ? data.photos : [];
        for (const p of photos) {
          const candidateUrl = p?.src?.large || p?.src?.medium || p?.src?.original;
          if (!candidateUrl) continue;
          if (usedImageUrls.includes(candidateUrl)) continue;
          if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => (candidateUrl || '').includes(s))) continue;

          const imageTitle = (p.alt || subject || '').substring(0, 80) || `${subject}`;
          if (Array.isArray(usedImageTitles) && usedImageTitles.includes(imageTitle)) continue;
          const pageURL = p?.url || 'https://www.pexels.com';
          const description = p.alt || imageTitle;
          const haystack = `${imageTitle} ${description} ${pageURL} ${p.photographer || ''}`.toLowerCase();
          if (containsAny(haystack, dynamicNegs)) continue;

          const attribution = `Photo by ${p.photographer || 'Unknown'} on Pexels`;

          const candidate = {
            imageTitle,
            imageUrl: candidateUrl,
            pageURL,
            attribution,
            description,
            uploader: p.photographer || undefined,
            imageWidth: p.width,
            imageHeight: p.height,
          };
          const score = computeImageRelevanceScore(subject, mainText, {
            title: imageTitle,
            description,
            pageURL,
            uploader: p.photographer,
            imageWidth: p.width,
            imageHeight: p.height,
          }, courseContext);
          candidates.push({ ...candidate, score });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const originalUrl = best.imageUrl;
        return { ...best, imageUrl: `/api/image/fast?url=${encodeURIComponent(originalUrl)}`, sourceUrlForCaching: originalUrl };
      }
      return null;
    } catch (e) {
      console.warn('[AIService] Pexels fetch failed:', e.message);
      return null;
    }
  }

  async fetchUnsplashImage(subject, content = '', usedImageTitles = [], usedImageUrls = [], options = { relaxed: false }, courseContext = {}) {
    const accessKey = getUnsplashAccessKey();
    if (!accessKey) return null;
    try {
      const queries = buildRefinedSearchPhrases(subject, content, options.relaxed ? 4 : 2, courseContext?.title || '');
      if (String(subject || '').trim()) {
        const s = String(subject).trim();
        if (!queries.includes(s)) queries.unshift(s);
      }

      const candidates = [];
      const perPage = options.relaxed ? 30 : 15;
      const dynamicNegs = getDynamicExtraNegatives(subject);
      const mainText = extractMainLessonText(content);

      for (const q of queries) {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Client-ID ${accessKey}` }
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const photos = Array.isArray(data?.results) ? data.results : [];
        for (const p of photos) {
          const candidateUrl = p?.urls?.regular || p?.urls?.full || p?.urls?.small;
          if (!candidateUrl) continue;
          if (usedImageUrls.includes(candidateUrl)) continue;
          if (DISALLOWED_IMAGE_URL_SUBSTRINGS.some((s) => (candidateUrl || '').includes(s))) continue;

          const name = (p?.user?.name || 'Unknown').trim();
          const imageTitle = (p?.alt_description || p?.description || subject || '').toString().trim() || `${subject}`;
          if (Array.isArray(usedImageTitles) && usedImageTitles.includes(imageTitle)) continue;
          const pageURLBase = p?.links?.html || 'https://unsplash.com';
          // Append required attribution params
          const appName = encodeURIComponent('LMS intergration');
          const pageURL = `${pageURLBase}?utm_source=${appName}&utm_medium=referral`;
          const description = imageTitle;
          const haystack = `${imageTitle} ${description} ${pageURL} ${name}`.toLowerCase();
          if (containsAny(haystack, dynamicNegs)) continue;

          const attribution = `Photo by ${name} on Unsplash`;

          const candidate = {
            imageTitle,
            imageUrl: candidateUrl, // Hotlink directly to Unsplash image per policy
            pageURL,
            attribution,
            description,
            uploader: name,
            unsplashDownloadLocation: p?.links?.download_location
          };
          const score = computeImageRelevanceScore(subject, mainText, {
            title: imageTitle,
            description,
            pageURL,
            uploader: name,
            imageWidth: undefined,
            imageHeight: undefined,
          }, courseContext);
          candidates.push({ ...candidate, score });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        // Trigger required download ping
        if (best.unsplashDownloadLocation) {
          triggerUnsplashDownload(best.unsplashDownloadLocation).catch(() => {});
        }
        // Return as-is without proxy to comply with hotlinking
        return { ...best };
      }
      return null;
    } catch (e) {
      console.warn('[AIService] Unsplash fetch failed:', e.message);
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
            let parts = lessonContentString.split(/\s*\|\|\|\s*/);
            
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

    
            
            // Enhanced image fetching with discipline-aware scoring
            try {
              const cacheKey = buildImageCacheKey(lesson.title, lesson.content);
              const cached = findCachedImageByKey(cacheKey);
              if (cached) {
                lesson.image = { imageTitle: cached.title, imageUrl: cached.localUrl, pageURL: cached.pageURL, attribution: cached.attribution };
              } else {
                // Fetch image with enhanced discipline-aware scoring
                const courseContext = {
                  title: courseWithIds.title,
                  subject: courseWithIds.subject || topic.toLowerCase(),
                  lessonTitles: courseWithIds.modules.flatMap(m => m.lessons.map(l => l.title))
                };
                
                const imageData = await this.fetchRelevantImage(
                  lesson.title, 
                  lesson.content ? `${lesson.content.introduction} ${lesson.content.main_content} ${lesson.content.conclusion}` : '',
                  Array.from(usedImageTitles),
                  Array.from(usedImageUrls),
                  { relaxed: false },
                  courseContext
                );
                
                if (imageData) {
                  lesson.image = {
                    imageTitle: imageData.imageTitle,
                    imageUrl: imageData.imageUrl,
                    pageURL: imageData.pageURL,
                    attribution: imageData.attribution
                  };
                  
                  // Track used images to prevent duplicates
                  if (imageData.imageTitle) usedImageTitles.add(imageData.imageTitle);
                  if (imageData.imageUrl) usedImageUrls.add(imageData.imageUrl);
                  
                  console.log(`[COURSE_GENERATION] Added image for lesson "${lesson.title}": ${imageData.imageTitle}`);
                } else {
                  lesson.image = null;
                }
              }
            } catch (imageErr) {
              console.warn(`[COURSE_GENERATION] Image fetching failed for lesson "${lesson.title}":`, imageErr.message);
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

            // Generate authentic bibliography for the lesson based on content
            try {
              const lessonContentText = `${lesson.content.introduction} ${lesson.content.main_content} ${lesson.content.conclusion}`;
              const bibliography = await this.generateAuthenticBibliography(
                lesson.title, 
                courseWithIds.subject || 'history', 
                5, 
                lessonContentText
              );
              
              // Clean up any malformed References sections that might exist in the content
              lesson.content.conclusion = this.cleanupMalformedReferences(lesson.content.conclusion);
              
              // Store bibliography data separately (not in content)
              lesson.bibliography = bibliography;
              
              console.log(`[AIService] Authentic bibliography generated for "${lesson.title}": ${bibliography.length} references`);
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
   * Generate authentic academic references based on lesson content
   * @param {string} topic - Lesson topic
   * @param {string} subject - Subject area
   * @param {number} numReferences - Number of references to generate
   * @param {string} lessonContent - The actual lesson content to base references on
   * @returns {Array} Array of authentic reference objects
   */
  async generateAuthenticBibliography(topic, subject, numReferences = 5, lessonContent = '') {
    try {
      console.log(`[AIService] Generating authentic bibliography for "${topic}" in ${subject}`);
      
      // Create a prompt for AI to generate authentic academic references
      const referencePrompt = `Based on the following lesson content about "${topic}" in the subject area of ${subject}, generate ${numReferences} authentic academic references that would be appropriate for this content. 

IMPORTANT REQUIREMENTS:
1. All references must be REAL, authentic academic sources (books, journal articles, etc.)
2. References should be directly relevant to the specific content and topics mentioned
3. Include a mix of books, journal articles, and authoritative sources
4. Use real authors, real titles, real publishers, and real publication years
5. Focus on well-known academic publishers and respected authors in the field
6. Ensure references are appropriate for the academic level and subject matter

Lesson Content:
${lessonContent.substring(0, 2000)}

Subject: ${subject}
Topic: ${topic}

Return the response as a JSON array with objects containing:
- "author": Real author name
- "year": Publication year (between 1990-2024)
- "title": Real book/article title (in quotes for articles, italics for books)
- "publisher": Real publisher name
- "type": "book", "journal", "encyclopedia", or "website"
- "relevance": Brief explanation of why this source is relevant to the lesson content

Example format:
[
  {
    "author": "John Smith",
    "year": "2020",
    "title": "Ancient Civilizations: A Comprehensive Study",
    "publisher": "Oxford University Press",
    "type": "book",
    "relevance": "Comprehensive coverage of ancient civilizations including the topics discussed in this lesson"
  }
]
Return only the JSON array, no other text.`;

app.get('/api/courses/:courseId', authenticateToken, async (req, res) => {
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
      // In development mode, if course not found locally, try to fetch from VPS
      if (process.env.NODE_ENV === 'development' && process.env.VPS_API_URL) {
        console.log(`[API] Course not found locally, attempting to fetch from VPS: ${courseId}`);
        try {
          const vpsResponse = await fetch(`${process.env.VPS_API_URL}/api/courses/${courseId}`, {
            headers: {
              'Authorization': req.headers.authorization,
              'Content-Type': 'application/json'
            }
          });
          
          if (vpsResponse.ok) {
            const vpsCourse = await vpsResponse.json();
            console.log(`[API] Successfully fetched course from VPS: ${courseId}`);
            return res.json(vpsCourse);
          } else {
            console.log(`[API] VPS also returned error for course: ${courseId}`);
          }
        } catch (vpsError) {
          console.log(`[API] Failed to fetch from VPS:`, vpsError.message);
        }
      }
      
      return res.status(404).json({ 
        error: 'Course not found',
        message: process.env.NODE_ENV === 'development' 
          ? 'Course not found in local database. This course may exist on the VPS server. Deploy to VPS to test with production data.' 
          : 'Course not found'
      });
    }
    
    console.log(`[API] Course ownership check:`, {
      courseUserId: course.userId,
      courseUserIdType: typeof course.userId,
      requestUserId: req.user.id,
      requestUserIdType: typeof req.user.id,
      isEqual: course.userId === req.user.id,
      isStrictEqual: course.userId === req.user.id,
      courseUserEmail: course.userEmail || 'N/A',
      requestUserEmail: req.user.email
    });
    
    // Check if this is the specific course that was just generated
    if (courseId === 'course_1755726976568_4p9cnxfoy') {
      console.log(`[API] DEBUG: This is the recently generated course. Checking user details:`, {
        courseUserId: course.userId,
        requestUserId: req.user.id,
        courseUserEmail: course.userEmail || 'N/A',
        requestUserEmail: req.user.email,
        allUsersInDB: db.data.users.map(u => ({ id: u.id, email: u.email }))
      });
    }
    
    if (course.userId !== req.user.id) {
      console.log(`[API] Access denied - course belongs to user ${course.userId}, but request is from user ${req.user.id}`);
      
      // For debugging, let's also check if there are any users with the same email
      const courseUser = db.data.users.find(u => u.id === course.userId);
      const requestUser = db.data.users.find(u => u.id === req.user.id);
      
      console.log(`[API] DEBUG: User comparison:`, {
        courseUser: courseUser ? { id: courseUser.id, email: courseUser.email } : 'NOT_FOUND',
        requestUser: requestUser ? { id: requestUser.id, email: requestUser.email } : 'NOT_FOUND',
        sameEmail: courseUser && requestUser ? courseUser.email === requestUser.email : false
      });
      
      // If they have the same email, allow access (this handles user ID migration issues)
      if (courseUser && requestUser && courseUser.email === requestUser.email) {
        console.log(`[API] Allowing access based on email match for course ${courseId}`);
        return res.json(course);
      }
      
      return res.status(403).json({ error: 'Unauthorized to access this course' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('[API] Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
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
  const lessonId = body.lessonId ?? null;
  const moduleId = body.moduleId ?? null;
  // Augment used lists with already-used images from the course (server-side guarantee)
  if (courseId && Array.isArray(db?.data?.courses)) {
    try {
      const course = db.data.courses.find((c) => c.id === courseId);
      if (course) {
        const titles = new Set(usedImageTitles.map(normalizeForCompare));
        const urls = new Set(usedImageUrls.map(normalizeUrlForCompare));
        
        // Add all existing images from the course to prevent duplicates
        console.log(`[ImageSearch] Scanning course for existing images: ${course.modules?.length || 0} modules`);
        for (const mod of course.modules || []) {
          console.log(`[ImageSearch] Scanning module: ${mod.title} (${mod.lessons?.length || 0} lessons)`);
          for (const lsn of mod.lessons || []) {
            const t = normalizeForCompare(lsn?.image?.imageTitle || lsn?.image?.title);
            const u = normalizeUrlForCompare(lsn?.image?.imageUrl || lsn?.image?.url);
            if (t) {
              titles.add(t);
              console.log(`[ImageSearch] Found used title: ${t}`);
            }
            if (u) {
              urls.add(u);
              console.log(`[ImageSearch] Found used URL: ${u.substring(0, 100)}...`);
            }
            
            // Also add the source URL for better deduplication
            const sourceUrl = lsn?.image?.sourceUrlForCaching;
            if (sourceUrl) {
              const normalizedSourceUrl = normalizeUrlForCompare(sourceUrl);
              if (normalizedSourceUrl) {
                urls.add(normalizedSourceUrl);
                console.log(`[ImageSearch] Found used source URL: ${normalizedSourceUrl.substring(0, 100)}...`);
              }
            }
          }
        }
        
        // Re-materialize arrays
        req.body.usedImageTitles = Array.from(titles);
        req.body.usedImageUrls = Array.from(urls);
        
        console.log(`[ImageSearch] Deduplication: Found ${titles.size} used titles and ${urls.size} used URLs from course`);
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
          
          // Ensure sourceUrlForCaching is set for all image formats
          if (!imageData.sourceUrlForCaching && imageData.imageUrl) {
            // Extract the original URL from the proxied URL
            const imageUrl = imageData.imageUrl;
            if (imageUrl.includes('/api/image/fast?url=')) {
              const encodedUrl = imageUrl.split('/api/image/fast?url=')[1];
              if (encodedUrl) {
                try {
                  imageData.sourceUrlForCaching = decodeURIComponent(encodedUrl);
                } catch (error) {
                  console.warn('[ImageSearch] Failed to decode source URL:', error.message);
                }
              }
            }
          }
          
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

          // Immediately save the selected image to the lesson to prevent duplicates
          if (courseId && lessonId) {
            try {
              const course = db.data.courses.find(c => c.id === courseId);
              if (course) {
                const module = course.modules.find(m => m.id === moduleId);
                if (module) {
                  const lesson = module.lessons.find(l => l.id === lessonId);
                  if (lesson) {
                    lesson.image = {
                      imageTitle: imageData.imageTitle || imageData.title,
                      imageUrl: imageData.imageUrl,
                      pageURL: imageData.pageURL,
                      attribution: imageData.attribution,
                      uploader,
                      sourceUrlForCaching: imageData.sourceUrlForCaching || null
                    };
                    await db.write();
                    console.log(`[ImageSearch] Saved image to lesson ${lessonId} to prevent duplicates`);
                  }
                }
              }
            } catch (saveError) {
              console.warn('[ImageSearch] Failed to save image to lesson:', saveError.message);
            }
          }
          
          // Pre-cache the image if sourceUrlForCaching is available
          if (imageData.sourceUrlForCaching) {
            try {
              // Validate the URL before attempting to pre-cache
              const sourceUrl = imageData.sourceUrlForCaching;
              if (sourceUrl && typeof sourceUrl === 'string' && sourceUrl.startsWith('http')) {
                // Validate URL format before pre-caching
                try {
                  new URL(sourceUrl); // This will throw if URL is invalid
                  
                  // Pre-cache in background without blocking the response
                  setImmediate(async () => {
                    try {
                      const response = await fetch(sourceUrl, {
                        method: 'HEAD',
                        signal: AbortSignal.timeout(5000)
                      });
                      if (response.ok) {
                        console.log('[ImageSearch] Successfully pre-cached image:', sourceUrl.substring(0, 50) + '...');
                      } else {
                        console.warn('[ImageSearch] Failed to pre-cache image, status:', response.status);
                      }
                    } catch (error) {
                      console.warn('[ImageSearch] Failed to pre-cache image:', error.message);
                    }
                  });
                } catch (urlValidationError) {
                  console.warn('[ImageSearch] Invalid URL format for pre-caching:', sourceUrl);
                }
              } else {
                console.warn('[ImageSearch] Invalid sourceUrlForCaching:', sourceUrl);
              }
            } catch (error) {
              console.warn('[ImageSearch] Error during pre-caching:', error.message);
            }
          }
          
          return res.json({
            url: imageData.imageUrl,
            title: imageData.imageTitle || imageData.title,
            pageURL: imageData.pageURL,
            attribution: imageData.attribution,
            uploader,
            sourceUrlForCaching: imageData.sourceUrlForCaching || null
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

    // Validate URL format - handle both encoded and decoded URLs
    let parsedUrl;
    let decodedUrl = url;
    
    // Try to decode the URL if it's encoded (handle multiple levels of encoding)
    try {
      decodedUrl = decodeURIComponent(url);
      // Try to decode again in case of double encoding
      try {
        decodedUrl = decodeURIComponent(decodedUrl);
      } catch (doubleDecodeError) {
        // If double decode fails, keep the single decoded version
      }
    } catch (decodeError) {
      // If decoding fails, use the original URL
      decodedUrl = url;
    }
    
    try {
      parsedUrl = new URL(decodedUrl);
    } catch (urlError) {
      // Try with the original URL as a fallback
      try {
        parsedUrl = new URL(url);
      } catch (fallbackError) {
        console.warn(`[FastImageProxy] Invalid URL format: ${url} (decoded: ${decodedUrl})`);
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Security validation
    const hostname = parsedUrl.hostname;
    const allowedDomains = ['upload.wikimedia.org', 'pixabay.com', 'images.unsplash.com', 'cdn.pixabay.com'];
    if (!allowedDomains.some(domain => hostname.endsWith(domain))) {
      console.warn(`[FastImageProxy] Forbidden domain: ${hostname}`);
      return res.status(403).json({ error: 'Forbidden domain' });
    }

    // Validate image format - allow all common image formats including SVG
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
    
    // Check for file extension in pathname (case insensitive)
    const hasValidExtension = validImageExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().includes(ext.toLowerCase())
    );
    
    // Check for file extension in the full URL (case insensitive)
    const hasValidExtensionInUrl = validImageExtensions.some(ext => 
      url.toLowerCase().includes(ext.toLowerCase())
    );
    
    // Special handling for SVG files - they might have additional parameters
    const isSvgFile = parsedUrl.pathname.toLowerCase().includes('.svg') || url.toLowerCase().includes('.svg');
    const hasValidSvgExtension = isSvgFile || hasValidExtension || hasValidExtensionInUrl;
    
    // Additional validation for Pixabay URLs that might not have extensions in pathname
    const isPixabayUrl = hostname.includes('pixabay.com');
    const isPixabayImageUrl = isPixabayUrl && (
      url.includes('_640.jpg') || url.includes('_1280.jpg') || url.includes('_1920.jpg') || 
      url.includes('_1280.png') || url.includes('_1920.png') || url.includes('_640.png') ||
      url.includes('_960.jpg') || url.includes('_960.png')
    );
    
    // Additional validation for Wikimedia URLs
    const isWikimediaUrl = hostname.includes('wikimedia.org');
    const isWikimediaImageUrl = isWikimediaUrl && (
      hasValidExtension || hasValidExtensionInUrl || isSvgFile
    );
    if (!hasValidSvgExtension && !isPixabayImageUrl && !isWikimediaImageUrl) {
      console.warn(`[FastImageProxy] Invalid image format: ${parsedUrl.pathname} (URL: ${url.substring(0, 100)}...)`);
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // For SVG files, ensure we handle them properly
    if (isSvgFile) {
      console.log(`[FastImageProxy] Processing SVG file: ${parsedUrl.pathname}`);
    }

    // Check server-side cache first
    const cacheKey = `image_${Buffer.from(url).toString('base64')}`;
    const cachedImage = global.imageCache.get(cacheKey);
    
    if (cachedImage && Date.now() - cachedImage.timestamp < global.imageCacheTimeout) {
      console.log(`[FastImageProxy] Cache HIT for: ${url.substring(0, 50)}...`);
      res.set('Content-Type', cachedImage.contentType);
      res.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable'); // Cache for 1 year
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
    res.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable'); // Cache for 1 year
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
  
  // Also clear the image search cache
  if (global.imageSearchCache) {
    const cacheSize = global.imageSearchCache.size;
    global.imageSearchCache.clear();
    console.log(`[ADMIN] Cleared ${cacheSize} image search cache entries`);
  }
  
  res.json({ message: 'Image cache and image search cache cleared successfully' });
});

// Force clear image search cache (for debugging duplicate issues)
app.post('/api/image/clear-search-cache', (req, res) => {
  if (global.imageSearchCache) {
    const cacheSize = global.imageSearchCache.size;
    global.imageSearchCache.clear();
    console.log(`[ADMIN] Force cleared ${cacheSize} image search cache entries`);
    res.json({ message: `Force cleared ${cacheSize} image search cache entries` });
  } else {
    res.json({ message: 'No image search cache to clear' });
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
    const { challenge, response, challengeKey, sessionId } = req.query;
    
    // Validate courseId parameter
    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '') {
      console.error('[API] Invalid courseId parameter:', courseId);
      return res.status(400).json({
        success: false,
        message: 'Invalid course identifier.',
        requiresCaptcha: true
      });
    }
    
    // Check if user already has a valid session for this course
    if (sessionId && publicCourseSessionService.isSessionAvailable(sessionId)) {
      const session = publicCourseSessionService.getSession(sessionId);
      if (session && session.courseId === courseId) {
        console.log(`[API] User already has valid session ${sessionId} for course ${courseId}, skipping CAPTCHA`);
        return res.json({
          success: true,
          sessionId: sessionId,
          redirectUrl: `/public/course/${courseId}?sessionId=${sessionId}`,
          requiresCaptcha: false
        });
      }
    }
    
    // Ensure global.captchaChallenges map exists
    if (!global.captchaChallenges || !(global.captchaChallenges instanceof Map)) {
      console.error('[API] Global captchaChallenges map not initialized');
      global.captchaChallenges = new Map();
    }
    
          console.log(`[API] CAPTCHA verification for course ${courseId}:`, { challenge, response, challengeKey });
      console.log(`[API] Global captchaChallenges map size:`, global.captchaChallenges.size);
      console.log(`[API] Available challenge keys:`, Array.from(global.captchaChallenges.keys()));
    
    // Verify CAPTCHA response
    if (challenge && response && challengeKey) {
      const storedChallenge = global.captchaChallenges.get(challengeKey);
      
      console.log(`[API] CAPTCHA map size:`, global.captchaChallenges.size);
      console.log(`[API] Available challenge keys:`, Array.from(global.captchaChallenges.keys()));
      console.log(`[API] Looking for challenge key:`, challengeKey);
      console.log(`[API] Stored challenge found:`, !!storedChallenge);
      console.log(`[API] Challenge key exists in map:`, global.captchaChallenges.has(challengeKey));
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

    // If course is not found in database, it might have been already deleted
    // or there's a caching issue. Return success to clear client cache.
    if (!course) {
      console.log(`[API] Course not found in database (may be already deleted):`, {
        requestedId: courseId,
        availableIds: db.data.courses.map(c => c.id)
      });
      
      // Clear any cached data for this course
      if (global.aiService && global.aiService.clearCache) {
        try {
          // Clear image search cache for this course
          const cacheKeysToClear = [
            `image_search_${courseId}_strict`,
            `image_search_${courseId}_relaxed`,
            `course_context_${courseId}`
          ];
          
          for (const cacheKey of cacheKeysToClear) {
            global.aiService.clearCache(cacheKey);
          }
          
          console.log(`[API] Cleared cache for course: ${courseId}`);
        } catch (cacheError) {
          console.warn(`[API] Failed to clear cache for course ${courseId}:`, cacheError.message);
        }
      }
      
      // Return success to force client to refresh
      return res.json({ 
        success: true, 
        message: 'Course not found in database (may be already deleted). Cache cleared.',
        cacheCleared: true
      });
    }

    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this course' });
    }

    // Remove course from database
    db.data.courses = db.data.courses.filter(c => c !== course);
    await db.write();
    // Clear any cached data for this course
    if (global.aiService && global.aiService.clearCache) {
      try {
        // Clear image search cache for this course
        const cacheKeysToClear = [
          `image_search_${course.id}_strict`,
          `image_search_${course.id}_relaxed`,
          `course_context_${course.id}`
        ];
        
        for (const cacheKey of cacheKeysToClear) {
          global.aiService.clearCache(cacheKey);
        }
        
        console.log(`[API] Cleared cache for course: ${course.id}`);
      } catch (cacheError) {
        console.warn(`[API] Failed to clear cache for course ${course.id}:`, cacheError.message);
      }
    }

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
    res.json({ 
      success: true, 
      message: 'Course deleted successfully',
      courseId: course.id,
      cacheCleared: true
    });
  } catch (error) {
    console.error('[API] Failed to delete course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Course verification endpoint to check if a course exists
app.get('/api/courses/verify/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    console.log(`[API] Verifying course ${courseId} for user ${userId}`);
    
    // Check if course exists in database
    const course = db.data.courses.find(c => c.id === courseId);
    
    if (!course) {
      console.log(`[API] Course ${courseId} not found in database`);
      return res.json({ 
        exists: false, 
        message: 'Course not found in database',
        courseId: courseId
      });
    }
    
    if (course.userId !== userId) {
      console.log(`[API] Course ${courseId} belongs to different user`);
      return res.json({ 
        exists: false, 
        message: 'Course belongs to different user',
        courseId: courseId
      });
    }
    
    console.log(`[API] Course ${courseId} verified as existing`);
    return res.json({ 
      exists: true, 
      course: {
        id: course.id,
        title: course.title,
        userId: course.userId,
        published: course.published
      }
    });
  } catch (error) {
    console.error('[API] Error verifying course:', error);
    res.status(500).json({ error: 'Failed to verify course' });
  }
});

// Debug endpoint to show all courses for a user
app.get('/api/debug/user-courses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    console.log(`[DEBUG] Fetching all courses for user ${userId} (${userEmail})`);
    
    const userCourses = db.data.courses.filter(c => c.userId === userId);
    
    console.log(`[DEBUG] Found ${userCourses.length} courses for user ${userId}:`, 
      userCourses.map(c => ({ id: c.id, title: c.title, published: c.published }))
    );
    
    res.json({
      userId: userId,
      userEmail: userEmail,
      totalCourses: userCourses.length,
      courses: userCourses.map(c => ({
        id: c.id,
        title: c.title,
        published: c.published,
        createdAt: c.createdAt,
        modulesCount: c.modules?.length || 0,
        totalLessons: c.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0
      }))
    });
    
  } catch (error) {
    console.error('[DEBUG] Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch user courses' });
  }
});
// Cache clearing endpoint for admin use
app.post('/api/admin/clear-cache', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is admin
    if (user.email !== 'rhys.higgs@outlook.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { courseId, cacheType } = req.body;
    
    if (global.aiService && global.aiService.clearCache) {
      let clearedCount = 0;
      
      if (courseId) {
        // Clear cache for specific course
        const cacheKeysToClear = [
          `image_search_${courseId}_strict`,
          `image_search_${courseId}_relaxed`,
          `course_context_${courseId}`
        ];
        
        for (const cacheKey of cacheKeysToClear) {
          global.aiService.clearCache(cacheKey);
          clearedCount++;
        }
        
        console.log(`[ADMIN] Cleared ${clearedCount} cache entries for course: ${courseId}`);
      } else if (cacheType === 'all') {
        // Clear all cache
        if (global.aiService.clearAllCache) {
          global.aiService.clearAllCache();
          console.log(`[ADMIN] Cleared all cache`);
        }
      }
      
      res.json({ 
        success: true, 
        message: `Cache cleared successfully. Cleared ${clearedCount} entries.`,
        clearedCount
      });
    } else {
      res.status(500).json({ error: 'Cache service not available' });
    }
  } catch (error) {
    console.error('[ADMIN] Failed to clear cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
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

// Image service health check
app.get('/api/image/health', (req, res) => {
  const health = enhancedImageProxy.getHealth();
  res.json(health);
});

// Clear image cache endpoint
app.post('/api/image/clear-cache', authenticateToken, async (req, res) => {
  try {
    // Clear both caches
    if (global.imageCache) {
      global.imageCache.clear();
      console.log('[ImageCache] Cleared global image cache');
    }
    
    if (enhancedImageProxy && enhancedImageProxy.clearCache) {
      enhancedImageProxy.clearCache();
      console.log('[ImageCache] Cleared enhanced image proxy cache');
    }
    
    res.json({ 
      success: true, 
      message: 'Image cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ImageCache] Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear image cache' });
  }
});