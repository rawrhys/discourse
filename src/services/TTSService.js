// src/services/TTSService.js - v2.1 (cache bust)
import Speech from 'speak-tts';

// Enhanced error handling with better categorization
const TTS_ERROR_TYPES = {
  INITIALIZATION: 'initialization',
  BROWSER_UNSUPPORTED: 'browser_unsupported',
  VOICE_UNAVAILABLE: 'voice_unavailable',
  NETWORK: 'network',
  INTERRUPTED: 'interrupted',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

// Global error handler for TTS-related promise rejections
const handleTTSError = (event) => {
  if (event && event.reason && (
    event.reason.utterances || 
    event.reason.lastUtterance || 
    event.reason.error ||
    event.reason.message?.includes('speech') ||
    event.reason.message?.includes('TTS') ||
    event.reason.message?.includes('utterance')
  )) {
    console.warn('[TTS Global Handler] Caught TTS-related promise rejection:', event.reason);
    event.preventDefault(); // Prevent the error from being logged as unhandled
    return true;
  }
  return false;
};

// Add global handlers for TTS errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', handleTTSError);
  window.addEventListener('error', (event) => {
    if (event.error && (
      event.error.utterances || 
      event.error.lastUtterance || 
      event.error.error ||
      event.error.message?.includes('speech') ||
      event.error.message?.includes('TTS')
    )) {
      console.warn('[TTS Global Handler] Caught TTS-related error:', event.error);
      event.preventDefault();
      return true;
    }
    return false;
  });
}

// Enhanced TTS Service with better error handling and browser compatibility
class TTSService {
  constructor(serviceType = 'default') {
    this.serviceType = serviceType;
    this.serviceId = `${serviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize speak-tts
    this.speech = new Speech();
    this.isInitialized = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentText = '';
    this.currentLessonId = null;
    this.fullText = '';
    this.errorCount = 0;
    this.maxRetries = 3;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 3;
    
         // Add flags for better error handling
     this.isRetrying = false; // Track if we're in a retry cycle
     this.lastStartTime = 0; // Track when TTS last started
     this.speakTimeout = null; // Track speak debounce timeout
     this.finishedNormally = false; // Track if TTS finished normally (not interrupted)
     this.wasManuallyPaused = false; // Track if user manually paused TTS
    
    // Position tracking for pause/resume functionality
    this.pausePosition = 0; // Track where we paused in the text
    this.pauseTime = 0; // Track when we paused
    this.totalSpokenTime = 0; // Track total time spent speaking
    this.speakingStartTime = 0; // Track when current speaking session started
    
    // Browser compatibility check
    this.browserSupport = this.checkBrowserSupport();
    
    // Initialize the speech engine
    this.initSpeech();
  }

  // Check browser support for speech synthesis
  checkBrowserSupport() {
    const support = {
      speechSynthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
      speechSynthesisUtterance: typeof window !== 'undefined' && 'SpeechSynthesisUtterance' in window,
      voices: false
    };

    if (support.speechSynthesis) {
      try {
        const voices = window.speechSynthesis.getVoices();
        support.voices = voices && voices.length > 0;
      } catch (e) {
        console.warn(`[${this.serviceType} TTS] Error checking voices:`, e);
      }
    }

    console.log(`[${this.serviceType} TTS] Browser support:`, support);
    return support;
  }

  // Enhanced initialization with multiple fallback strategies
  async initSpeech() {
    if (this.initializationAttempts >= this.maxInitAttempts) {
      console.warn(`[${this.serviceType} TTS] Max initialization attempts reached`);
      return;
    }

    this.initializationAttempts++;
    
    try {
      console.log(`[${this.serviceType} TTS] Starting speech engine initialization (attempt ${this.initializationAttempts}/${this.maxInitAttempts})...`);
      
      // Check if speech synthesis is supported
      if (!this.browserSupport.speechSynthesis) {
        console.warn(`[${this.serviceType} TTS] Speech synthesis not supported in this browser`);
        this.isInitialized = false;
        return;
      }

      // Wait for voices to be available
      const voices = await this.waitForVoices();
      
      // Check if we have voices available
      if (!voices || voices.length === 0) {
        console.log(`[${this.serviceType} TTS] No voices available, but proceeding with initialization`);
      }

      const initConfig = this.getInitConfig();
      
      await this.speech.init(initConfig);
      
      this.isInitialized = true;
      this.initializationAttempts = 0; // Reset on success
      console.log(`[${this.serviceType} TTS] Speech engine initialized successfully`);
      
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Failed to initialize speech engine (attempt ${this.initializationAttempts}):`, error);
      this.isInitialized = false;
      
      // Try fallback initialization with delay
      if (this.initializationAttempts < this.maxInitAttempts) {
        setTimeout(() => {
          this.initSpeech();
        }, 1000 * this.initializationAttempts); // Exponential backoff
      }
    }
  }

  // Wait for voices to be available with better timeout handling
  async waitForVoices() {
    return new Promise((resolve) => {
      let timeoutId = null;
      let checkInterval = null;
      let attempts = 0;
      const maxAttempts = 50; // Limit attempts to prevent infinite loops
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        try {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        } catch (error) {
          // Ignore cleanup errors
        }
      };
      
      const checkVoices = () => {
        attempts++;
        try {
          if (!window.speechSynthesis) {
            console.warn(`[${this.serviceType} TTS] Speech synthesis not available`);
            return false;
          }
          
          // Add a small delay to prevent simultaneous voice checking
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            console.log(`[${this.serviceType} TTS] Voices loaded:`, voices.length);
            cleanup();
            resolve(voices);
            return true;
          }
        } catch (error) {
          // Only log error every 10 attempts to reduce spam
          if (attempts % 10 === 0) {
            console.warn(`[${this.serviceType} TTS] Error checking voices (attempt ${attempts}):`, error.message || error);
          }
          return false;
        }
        return false;
      };
      
      // Start checking immediately
      if (checkVoices()) return;
      
      // Set up interval checking with longer intervals to reduce conflicts
      checkInterval = setInterval(() => {
        if (checkVoices() || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }, 500); // Increased interval to reduce conflicts
      
      // Also listen for voiceschanged event
      const handleVoicesChanged = () => {
        if (checkVoices()) {
          cleanup();
        }
      };
      
      try {
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Failed to add voiceschanged listener:`, error.message || error);
      }
      
      // Timeout after 10 seconds (increased from 5)
      timeoutId = setTimeout(() => {
        console.log(`[${this.serviceType} TTS] Voice loading timeout - proceeding with available voices`);
        cleanup();
        
        // Try to get any available voices, even if empty
        try {
          const voices = window.speechSynthesis.getVoices();
          resolve(voices || []);
        } catch (error) {
          console.log(`[${this.serviceType} TTS] Error getting voices after timeout:`, error.message || error);
          resolve([]);
        }
      }, 10000); // 10 second timeout to see if it's taking too long to start
    });
  }

  // Get initialization configuration based on attempt number
  getInitConfig() {
    const baseConfig = {
      'volume': 1,
      'splitSentences': false, // Disable sentence splitting to preserve pause state
      'listeners': {
        'onvoiceschanged': (voices) => {
          console.log(`[${this.serviceType} TTS] Voices loaded:`, voices.length);
        },
        'onstart': () => {
          // Only set playing state if not manually paused
          if (!this.wasManuallyPaused) {
            this.isPlaying = true;
            this.isPaused = false;
          } else {
            // If manually paused, keep the pause state
            this.isPlaying = false;
            this.isPaused = true;
          }
          this.speakingStartTime = Date.now(); // Track when speaking started
          this.lastStartTime = Date.now(); // Track when TTS started
          console.log(`[${this.serviceType} TTS] Started speaking (manually paused: ${this.wasManuallyPaused})`);
        },
        'onend': () => {
          this.isPlaying = false;
          this.isPaused = false;
          this.finishedNormally = true;
          console.log(`[${this.serviceType} TTS] Finished speaking`);
        },
        'onpause': () => {
          this.isPaused = true;
          this.isPlaying = false;
          console.log(`[${this.serviceType} TTS] Paused`);
        },
        'onresume': () => {
          this.isPaused = false;
          this.isPlaying = true;
          console.log(`[${this.serviceType} TTS] Resumed`);
        },
        'onerror': (event) => {
          console.warn(`[${this.serviceType} TTS] Speech error:`, event);
          this.handleSpeechError(event);
        }
      }
    };

    // Different configurations based on initialization attempt
    switch (this.initializationAttempts) {
      case 1:
        return {
          ...baseConfig,
          'lang': 'en-GB',
          'rate': 0.9,
          'pitch': 1,
          'voice': 'Google UK English Female'
        };
      case 2:
        return {
          ...baseConfig,
          'lang': 'en-US',
          'rate': 1.0,
          'pitch': 1,
          'voice': null // Let it choose default
        };
      default:
        return {
          ...baseConfig,
          'lang': 'en',
          'rate': 1.0,
          'pitch': 1,
          'voice': null,
          'volume': 0.8 // Slightly lower volume for fallback
        };
    }
  }

  // Handle speech errors with better categorization
  handleSpeechError(event) {
    const errorType = this.categorizeError(event);
    
    switch (errorType) {
      case TTS_ERROR_TYPES.INTERRUPTED:
        console.log(`[${this.serviceType} TTS] Speech interrupted, not counting as error`);
        break;
      case TTS_ERROR_TYPES.VOICE_UNAVAILABLE:
        console.warn(`[${this.serviceType} TTS] Voice unavailable, trying reinitialization`);
        this.isInitialized = false;
        this.initSpeech();
        break;
      case TTS_ERROR_TYPES.NETWORK:
        console.warn(`[${this.serviceType} TTS] Network-related error, will retry`);
        this.errorCount++;
        break;
      default:
        console.warn(`[${this.serviceType} TTS] Unknown error:`, event);
        this.errorCount++;
    }
  }

  // Categorize errors for better handling
  categorizeError(event) {
    const error = event.error || event;
    
    if (error === 'interrupted' || error === 'canceled') {
      return TTS_ERROR_TYPES.INTERRUPTED;
    }
    
    if (error === 'not-allowed' || error === 'network') {
      return TTS_ERROR_TYPES.NETWORK;
    }
    
    if (error === 'voice-not-found' || error === 'voice-unavailable') {
      return TTS_ERROR_TYPES.VOICE_UNAVAILABLE;
    }
    
    return TTS_ERROR_TYPES.UNKNOWN;
  }

  // Enhanced text cleaning for TTS
  cleanTextForTTS(text) {
    if (!text) return '';
    
    return text
      // Remove HTML tags and entities
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
      
      // Remove markdown formatting more thoroughly
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Remove images, keep alt text
      
      // Remove HTML-style formatting
      .replace(/<strong>(.*?)<\/strong>/gi, '$1') // Remove strong tags
      .replace(/<b>(.*?)<\/b>/gi, '$1') // Remove bold tags
      .replace(/<em>(.*?)<\/em>/gi, '$1') // Remove emphasis tags
      .replace(/<i>(.*?)<\/i>/gi, '$1') // Remove italic tags
      .replace(/<code>(.*?)<\/code>/gi, '$1') // Remove code tags
      .replace(/<pre>(.*?)<\/pre>/gi, '$1') // Remove pre tags
      
      // Remove paragraph tags and other common HTML elements
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1') // Remove paragraph tags
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1') // Remove div tags
      .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1') // Remove span tags
      
      // Convert headers to sentences
      .replace(/^#{1,6}\s+(.*?)$/gm, '$1. ')
      
      // Handle lists
      .replace(/^[\s]*[-*+]\s+(.*?)$/gm, '$1. ')
      .replace(/^[\s]*\d+\.\s+(.*?)$/gm, '$1. ')
      
      // Handle blockquotes
      .replace(/^>\s+(.*?)$/gm, '$1. ')
      
      // Handle code blocks
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks entirely
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      
      // Clean up whitespace and formatting
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\s*\.\s*/g, '. ') // Normalize periods
      .replace(/\s*,\s*/g, ', ') // Normalize commas
      .replace(/\s*:\s*/g, ': ') // Normalize colons
      .replace(/\s*;\s*/g, '; ') // Normalize semicolons
      .replace(/\s*!\s*/g, '! ') // Normalize exclamation marks
      .replace(/\s*\?\s*/g, '? ') // Normalize question marks
      
      // Remove leading 'p' or other single characters that might be artifacts
      .replace(/^[pP]\s*/, '')
      
      // Remove any remaining special characters that might cause TTS issues (less aggressive)
      .replace(/[^\w\s.,!?;:()'\-]/g, '')
      
      .trim();
  }

  // Extract text content from lesson content with enhanced validation
  extractLessonText(content) {
    if (!content) {
      console.log(`[${this.serviceType} TTS] No content provided to extractLessonText`);
      return '';
    }
    
    let text = '';
    
    if (typeof content === 'string') {
      text = content;
      console.log(`[${this.serviceType} TTS] Content is string, length: ${text.length}`);
    } else if (typeof content === 'object') {
      // Handle structured content - include all lesson parts
      const parts = [];
      
      // Log the content structure for debugging
      console.log(`[${this.serviceType} TTS] Content is object, keys:`, Object.keys(content));
      
      // Include all lesson content parts: introduction, main content, and conclusion
      if (content.introduction) {
        parts.push(content.introduction);
        console.log(`[${this.serviceType} TTS] Found introduction, length: ${content.introduction.length}`);
      }
      
      if (content.main_content) {
        parts.push(content.main_content);
        console.log(`[${this.serviceType} TTS] Found main_content, length: ${content.main_content.length}`);
      } else if (content.content) {
        // Fallback to content if main_content doesn't exist
        parts.push(content.content);
        console.log(`[${this.serviceType} TTS] Found content, length: ${content.content.length}`);
      } else if (content.text) {
        // Fallback to text if content doesn't exist
        parts.push(content.text);
        console.log(`[${this.serviceType} TTS] Found text, length: ${content.text.length}`);
      }
      
      if (content.conclusion) {
        parts.push(content.conclusion);
        console.log(`[${this.serviceType} TTS] Found conclusion, length: ${content.conclusion.length}`);
      }
      
      // If no structured content found, try to find any text-like properties
      if (parts.length === 0) {
        const textKeys = Object.keys(content).filter(key => 
          typeof content[key] === 'string' && 
          content[key].trim().length > 0 &&
          (key.includes('text') || key.includes('content') || key.includes('body') || key.includes('description'))
        );
        
        if (textKeys.length > 0) {
          console.log(`[${this.serviceType} TTS] Found text-like keys:`, textKeys);
          textKeys.forEach(key => parts.push(content[key]));
        } else {
          console.warn(`[${this.serviceType} TTS] No recognizable text content found in object`);
          // Try to stringify the object as a last resort
          try {
            const stringified = JSON.stringify(content);
            if (stringified.length > 50) { // Only use if it's substantial
              parts.push(stringified);
              console.log(`[${this.serviceType} TTS] Using stringified content, length: ${stringified.length}`);
            }
          } catch (e) {
            console.warn(`[${this.serviceType} TTS] Could not stringify content:`, e);
          }
        }
      }
      
      text = parts.join('\n\n');
      console.log(`[${this.serviceType} TTS] Combined text length: ${text.length}`);
    } else {
      console.warn(`[${this.serviceType} TTS] Unknown content type:`, typeof content);
      return '';
    }
    
    // Validate that we have meaningful text
    if (!text || text.trim().length === 0) {
      console.warn(`[${this.serviceType} TTS] No text extracted from content`);
      return '';
    }
    
    // Clean the text but ensure we don't remove everything
    const cleanedText = this.cleanTextForTTS(text);
    
    // If cleaning removed too much, use original text
    if (!cleanedText || cleanedText.trim().length < 10) {
      console.log(`[${this.serviceType} TTS] Text cleaning removed too much content (${cleanedText ? cleanedText.length : 0} chars), using original text (${text.trim().length} chars)`);
      return text.trim();
    }
    
    console.log(`[${this.serviceType} TTS] Final cleaned text length: ${cleanedText.length}`);
    return cleanedText;
  }

  // Start reading the lesson with enhanced error handling
  async readLesson(lesson, lessonId) {
    if (!this.browserSupport.speechSynthesis) {
      console.warn(`[${this.serviceType} TTS] Speech synthesis not supported in this browser`);
      return false;
    }

    if (!this.isInitialized) {
      console.warn(`[${this.serviceType} TTS] Speech engine not initialized, attempting initialization...`);
      await this.initSpeech();
      if (!this.isInitialized) {
        console.warn(`[${this.serviceType} TTS] Failed to initialize speech engine`);
        return false;
      }
    }

    console.log(`[${this.serviceType} TTS] Starting to read lesson`);
    
    // Prevent multiple simultaneous read requests
    if (this.isPlaying) {
      console.warn(`[${this.serviceType} TTS] Already playing, ignoring new read request`);
      return false;
    }
    
    if (!lesson) {
      console.warn(`[${this.serviceType} TTS] No lesson provided to readLesson`);
      return false;
    }
    
    if (!lesson.content) {
      console.warn(`[${this.serviceType} TTS] No lesson.content provided to readLesson`);
      return false;
    }

    console.log(`[${this.serviceType} TTS] Lesson content type:`, typeof lesson.content);
    console.log(`[${this.serviceType} TTS] Lesson content keys:`, typeof lesson.content === 'object' ? Object.keys(lesson.content) : 'N/A');
    
    const text = this.extractLessonText(lesson.content);
    console.log(`[${this.serviceType} TTS] Extracted text length: ${text ? text.length : 0}`);
    console.log(`[${this.serviceType} TTS] Text preview: ${text ? text.substring(0, 100) + '...' : 'NO TEXT'}`);
    
    // Enhanced validation for extracted text
    if (!text) {
      console.warn(`[${this.serviceType} TTS] No text content extracted from lesson - lessonId: ${lessonId}, lesson title: ${lesson.title || 'unknown'}`);
      return false;
    }
    
    if (typeof text !== 'string') {
      console.warn(`[${this.serviceType} TTS] Extracted text is not a string: ${typeof text} - lessonId: ${lessonId}`);
      return false;
    }
    
    if (!text.trim()) {
      console.warn(`[${this.serviceType} TTS] Extracted text is empty or only whitespace - lessonId: ${lessonId}, lesson title: ${lesson.title || 'unknown'}`);
      return false;
    }
    
    if (text.trim().length < 10) {
      console.warn(`[${this.serviceType} TTS] Extracted text too short (${text.trim().length} chars): "${text.trim()}" - lessonId: ${lessonId}`);
      return false;
    }

    try {
      // Set the new text properties
      this.currentText = text;
      this.currentLessonId = lessonId;
      this.fullText = text;
      this.errorCount = 0;
      
      // Reset position tracking for new lesson
      this.pausePosition = 0;
      this.pauseTime = 0;
      this.totalSpokenTime = 0;
      this.speakingStartTime = 0;
      this.finishedNormally = false;
      this.wasManuallyPaused = false;
      
      console.log(`[${this.serviceType} TTS] Starting to read lesson:`, lesson.title);
      console.log(`[${this.serviceType} TTS] Full text length before speak: ${this.fullText.length}`);
      
      // Ensure we have the text before speaking
      if (!this.fullText || this.fullText.length === 0) {
        console.warn(`[${this.serviceType} TTS] Full text was cleared, using original extracted text`);
        this.fullText = text; // Restore the text
      }
      
      await this.speak(this.fullText); // Use fullText to ensure we always have the original text
      return true;
      
    } catch (error) {
      console.error(`[${this.serviceType} TTS] Error starting TTS:`, error);
      this.isPlaying = false;
      this.isPaused = false;
      return false;
    }
  }

  // Speak text with enhanced error handling and retry logic
  async speak(text, startPosition = 0) {
    // Check if service is properly initialized
    if (!this.isInitialized || !this.speech) {
      console.warn(`[${this.serviceType} TTS] Service not properly initialized, attempting to reinitialize`);
      await this.initSpeech();
      if (!this.isInitialized) {
        console.warn(`[${this.serviceType} TTS] Failed to initialize speech engine for speak`);
        return;
      }
    }
    
    // Reset if we have too many errors
    if (this.errorCount >= this.maxRetries) {
      console.warn(`[${this.serviceType} TTS] Too many errors, resetting TTS state`);
      this.reset();
      this.errorCount = 0;
    }
    
    try {
      console.log(`[${this.serviceType} TTS] Attempting to speak text (length: ${text ? text.length : 'undefined'})`);
      console.log(`[${this.serviceType} TTS] Text type:`, typeof text);
      console.log(`[${this.serviceType} TTS] Text preview:`, text ? text.substring(0, 100) + '...' : 'NO TEXT');
      
      // Additional debugging for text validation
      if (text && typeof text === 'string') {
        console.log(`[${this.serviceType} TTS] Text validation: length=${text.length}, trimmed=${text.trim().length}, isEmpty=${text.trim().length === 0}`);
      }
      
      // Check if speech is already initialized and working
      if (!this.speech || !this.isInitialized) {
        console.warn(`[${this.serviceType} TTS] Speech not initialized, attempting to reinitialize...`);
        await this.initSpeech();
        if (!this.isInitialized) {
          console.warn(`[${this.serviceType} TTS] Failed to initialize speech engine`);
          return;
        }
      }

      // Enhanced text validation with early return for empty content
      if (!text) {
        console.warn(`[${this.serviceType} TTS] No text provided to speak`);
        this.isPlaying = false;
        this.isPaused = false;
        return;
      }
      
      // If we have a start position, trim the text to start from that position
      let textToSpeak = text;
      if (startPosition > 0 && startPosition < text.length) {
        textToSpeak = text.substring(startPosition);
        console.log(`[${this.serviceType} TTS] Starting from position ${startPosition}, remaining text length: ${textToSpeak.length}`);
      }
      
      if (typeof text !== 'string') {
        console.warn(`[${this.serviceType} TTS] Text is not a string:`, typeof text, text);
        this.isPlaying = false;
        this.isPaused = false;
        return;
      }
      
      if (text.trim().length === 0) {
        console.warn(`[${this.serviceType} TTS] Text is empty or only whitespace`);
        this.isPlaying = false;
        this.isPaused = false;
        return;
      }
      
      // Additional validation to ensure text is substantial
      if (text.trim().length < 5) {
        console.warn(`[${this.serviceType} TTS] Text too short to speak: "${text.trim()}"`);
        this.isPlaying = false;
        this.isPaused = false;
        return;
      }

      // Cancel any ongoing speech synthesis before starting new one
      if (this.speech && typeof this.speech.cancel === 'function') {
        console.log(`[${this.serviceType} TTS] Canceling ongoing speech synthesis`);
        this.speech.cancel();
        // Small delay to ensure cancel completes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Check if text is too long and needs chunking
      const maxChunkLength = 1000; // Process in chunks of 1000 characters
      if (textToSpeak.length > maxChunkLength) {
        console.log(`[${this.serviceType} TTS] Text is long (${textToSpeak.length} chars), processing in chunks`);
        await this.speakInChunks(textToSpeak, maxChunkLength);
        return;
      }

      // Immediately set playing state for UI responsiveness
      this.isPlaying = true;
      this.isPaused = false;
      this.speakingStartTime = Date.now();

      // Create a promise that wraps the speak-tts library call
      const speakPromise = new Promise((resolve) => {
        try {
          // Create the speak configuration
          const speakConfig = {
            text: textToSpeak,
            splitSentences: false // Ensure no sentence splitting to preserve pause state
          };

          // Call the speak-tts library
          console.log(`[${this.serviceType} TTS] Calling speech.speak with config:`, {
            textLength: textToSpeak.length,
            splitSentences: speakConfig.splitSentences
          });
          
          this.speech.speak(speakConfig).then((speakResult) => {
            console.log(`[${this.serviceType} TTS] Speak command completed successfully:`, speakResult);
            resolve();
          }).catch((error) => {
            console.warn(`[${this.serviceType} TTS] Speak promise rejected:`, error);
            // Handle the error and retry if needed
            this.handleSpeakError(error, textToSpeak, startPosition);
            resolve(); // Resolve to prevent hanging
          });
        } catch (error) {
          console.warn(`[${this.serviceType} TTS] Error in speak promise:`, error);
          resolve(); // Resolve to prevent hanging
        }
      });

      // Use a timeout to prevent hanging, but don't timeout if we're paused
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          // Don't timeout if we're paused
          if (this.isPaused) {
            console.log(`[${this.serviceType} TTS] Speak timeout ignored - TTS is paused`);
            return;
          }
          console.warn(`[${this.serviceType} TTS] Speak timeout, resolving gracefully`);
          this.isPlaying = false;
          this.isPaused = false;
          resolve();
        }, 10000); // 10 second timeout
      });

      // Race between the speak promise and timeout
      await Promise.race([speakPromise, timeoutPromise]);
      
      // Clean up
      this.isPlaying = false;
      this.isPaused = false;
      
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Speak method error:`, error);
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  // Create chunks from text for pause/resume functionality
  createChunks(text, chunkSize = 1000) {
    if (!text || typeof text !== 'string') {
      console.warn(`[${this.serviceType} TTS] Cannot create chunks - invalid text`);
      return [];
    }
    
    console.log(`[${this.serviceType} TTS] Creating chunks from text (${text.length} chars, chunk size: ${chunkSize})`);
    
    const chunks = [];
    let currentChunk = '';
    
    // Split by sentences first to avoid breaking mid-sentence
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      // If adding this sentence would exceed chunk size, save current chunk and start new one
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // If we have no chunks or only one chunk that's too long, split by character count
    if (chunks.length === 0 || (chunks.length === 1 && chunks[0].length > chunkSize)) {
      chunks.length = 0; // Clear chunks
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize).trim());
      }
    }
    
    console.log(`[${this.serviceType} TTS] Created ${chunks.length} chunks`);
    return chunks;
  }

  // Speak text in chunks to prevent long task errors
  async speakInChunks(text, chunkSize = 1000) {
    console.log(`[${this.serviceType} TTS] Starting chunked speech (${text.length} chars in chunks of ${chunkSize})`);
    
    const chunks = this.createChunks(text, chunkSize);
    console.log(`[${this.serviceType} TTS] Split into ${chunks.length} chunks`);
    
    // Store chunk information for pause/resume
    this.currentChunks = chunks;
    this.currentChunkIndex = 0;
    this.isChunkedSpeech = true;
    
    // Immediately set playing state for UI responsiveness
    this.isPlaying = true;
    this.isPaused = false;
    this.speakingStartTime = Date.now();
    
    for (let i = 0; i < chunks.length; i++) {
      // Additional safety check - chunks might become invalid during execution
      if (!chunks || !Array.isArray(chunks)) {
        console.warn(`[${this.serviceType} TTS] chunks became invalid during execution, stopping`);
        break;
      }
      
      // Check if we should stop due to pause or errors
      if (!this.isInitialized || this.errorCount >= this.maxRetries) {
        console.log(`[${this.serviceType} TTS] Stopping chunked speech due to errors or initialization issues`);
        break;
      }
      
      // Check if we're paused
      if (this.isPaused) {
        console.log(`[${this.serviceType} TTS] Chunked speech paused at chunk ${i + 1}/${chunks.length}`);
        this.currentChunkIndex = i; // Store current position
        return; // Exit but don't reset state
      }
      
      // Safety check for chunk access
      if (i >= chunks.length) {
        console.warn(`[${this.serviceType} TTS] Chunk index ${i} is out of bounds, stopping`);
        break;
      }
      
      const chunk = chunks[i];
      if (!chunk) {
        console.warn(`[${this.serviceType} TTS] Chunk ${i} is null or undefined, skipping`);
        continue;
      }
      
      this.currentChunkIndex = i;
      console.log(`[${this.serviceType} TTS] Speaking chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      try {
        // Use speak-tts library with better debugging and error handling
        const chunkPromise = new Promise((resolve) => {
          const speakConfig = {
            text: chunk,
            splitSentences: false
          };
          
          console.log(`[${this.serviceType} TTS] Calling speech.speak for chunk ${i + 1} with config:`, {
            textLength: chunk.length,
            textPreview: chunk.substring(0, 50) + '...',
            splitSentences: speakConfig.splitSentences,
            speechInitialized: this.isInitialized,
            speechObject: !!this.speech
          });
          
          // Check if speech is properly initialized
          if (!this.speech || !this.isInitialized) {
            console.warn(`[${this.serviceType} TTS] Speech not initialized for chunk ${i + 1}, skipping`);
            resolve();
            return;
          }
          
          // Use speak-tts library with better error handling
          try {
            this.speech.speak(speakConfig).then((result) => {
              console.log(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts completed successfully:`, result);
              resolve();
            }).catch((error) => {
              console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts failed:`, error);
              // Try to reinitialize if there's a voice error
              if (error && (error.includes('voice') || error.includes('not-allowed'))) {
                console.log(`[${this.serviceType} TTS] Voice error detected, attempting reinitialization`);
                this.isInitialized = false;
                this.initSpeech();
              }
              resolve(); // Continue with next chunk
            });
          } catch (error) {
            console.warn(`[${this.serviceType} TTS] Error calling speech.speak for chunk ${i + 1}:`, error);
            resolve(); // Continue with next chunk
          }
        });
        
        // Use a shorter timeout and add better detection of actual speech
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            // Check if we actually started speaking
            if (this.isPlaying && this.speakingStartTime > 0) {
              const timeSinceStart = Date.now() - this.speakingStartTime;
              if (timeSinceStart > 5000) { // If we've been "speaking" for more than 5 seconds
                console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} appears to be speaking but taking too long, continuing`);
                resolve();
              } else {
                console.log(`[${this.serviceType} TTS] Chunk ${i + 1} still speaking, extending timeout`);
                // Extend timeout if we're actually speaking
                setTimeout(() => {
                  console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} final timeout - continuing to next chunk`);
                  resolve();
                }, 10000); // Additional 10 seconds
              }
            } else {
              console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} timeout - no speech detected, continuing to next chunk`);
              resolve();
            }
          }, 8000); // Reduced initial timeout to 8 seconds
        });
        
        await Promise.race([chunkPromise, timeoutPromise]);
        
        // Check if we're paused after chunk completion
        if (this.isPaused) {
          console.log(`[${this.serviceType} TTS] Paused after chunk ${i + 1}, stopping chunked speech`);
          return;
        }
        
        // Small delay between chunks to prevent overwhelming the system
        if (chunks && i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Error in chunk ${i + 1}:`, error);
        this.errorCount++;
      }
    }
    
    console.log(`[${this.serviceType} TTS] Chunked speech completed`);
    this.isChunkedSpeech = false;
    // Only clear chunks if we're not paused (preserve for resume)
    if (!this.isPaused) {
      this.currentChunks = null;
      this.currentChunkIndex = 0;
    }
    this.isPlaying = false;
    // Don't clear isPaused here - let the pause method handle it
  }

  // Resume chunked speech from current position
  async resumeChunkedSpeech() {
    // Enhanced null checks to prevent the error
    if (!this.isChunkedSpeech) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - not in chunked speech mode`);
      return;
    }
    
    if (!this.currentChunks) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is null`);
      return;
    }
    
    if (!Array.isArray(this.currentChunks)) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is not an array:`, typeof this.currentChunks);
      return;
    }
    
    if (this.currentChunks.length === 0) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is empty`);
      return;
    }
    
    if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.currentChunks.length) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - invalid chunk index:`, {
        currentChunkIndex: this.currentChunkIndex,
        chunksLength: this.currentChunks.length
      });
      return;
    }
    
    // Safety check for currentChunks before accessing its properties
    if (!this.currentChunks || !Array.isArray(this.currentChunks)) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is null or invalid`);
      return false;
    }
    
    console.log(`[${this.serviceType} TTS] Resuming chunked speech from chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
    
    // Stop any ongoing speech before resuming
    try {
      if (this.speech && typeof this.speech.cancel === 'function') {
        this.speech.cancel();
        console.log(`[${this.serviceType} TTS] Canceled ongoing speech before resuming chunks`);
      }
    } catch (cancelError) {
      console.warn(`[${this.serviceType} TTS] Error canceling speech before resume:`, cancelError);
    }
    
    // Set playing state
    this.isPlaying = true;
    this.isPaused = false;
    this.wasManuallyPaused = false;
    this.speakingStartTime = Date.now();
    
    // Wait a moment for state to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Continue from the current chunk
    for (let i = this.currentChunkIndex; i < this.currentChunks.length; i++) {
      // Additional safety check - currentChunks might become null during execution
      if (!this.currentChunks || !Array.isArray(this.currentChunks)) {
        console.warn(`[${this.serviceType} TTS] currentChunks became invalid during resume, stopping`);
        break;
      }
      
      // Check if we should stop due to pause or errors
      if (!this.isInitialized || this.errorCount >= this.maxRetries) {
        console.log(`[${this.serviceType} TTS] Stopping chunked speech due to errors or initialization issues`);
        break;
      }
      
      // Check if we're paused again
      if (this.isPaused) {
        console.log(`[${this.serviceType} TTS] Chunked speech paused again at chunk ${i + 1}/${this.currentChunks.length}`);
        this.currentChunkIndex = i;
        return;
      }
      
      // Safety check for chunk access
      if (i >= this.currentChunks.length) {
        console.warn(`[${this.serviceType} TTS] Chunk index ${i} is out of bounds, stopping`);
        break;
      }
      
      const chunk = this.currentChunks[i];
      if (!chunk) {
        console.warn(`[${this.serviceType} TTS] Chunk ${i} is null or undefined, skipping`);
        continue;
      }
      
      this.currentChunkIndex = i;
      console.log(`[${this.serviceType} TTS] Speaking chunk ${i + 1}/${this.currentChunks.length} (${chunk.length} chars)`);
      
      try {
        // Use speak-tts library with better debugging and error handling
        const chunkPromise = new Promise((resolve) => {
          const speakConfig = {
            text: chunk,
            splitSentences: false
          };
          
          console.log(`[${this.serviceType} TTS] Calling speech.speak for chunk ${i + 1} with config:`, {
            textLength: chunk.length,
            textPreview: chunk.substring(0, 50) + '...',
            splitSentences: speakConfig.splitSentences,
            speechInitialized: this.isInitialized,
            speechObject: !!this.speech
          });
          
          // Check if speech is properly initialized
          if (!this.speech || !this.isInitialized) {
            console.warn(`[${this.serviceType} TTS] Speech not initialized for chunk ${i + 1}, skipping`);
            resolve();
            return;
          }
          
          // Use speak-tts library with better error handling
          try {
            // Set speaking start time when we actually call speak
            this.speakingStartTime = Date.now();
            console.log(`[${this.serviceType} TTS] Chunk ${i + 1} speech started at:`, this.speakingStartTime);
            
            this.speech.speak(speakConfig).then((result) => {
              console.log(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts completed successfully:`, result);
              resolve();
            }).catch((error) => {
              console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts failed:`, error);
              // Try to reinitialize if there's a voice error
              if (error && (error.includes('voice') || error.includes('not-allowed'))) {
                console.log(`[${this.serviceType} TTS] Voice error detected, attempting reinitialization`);
                this.isInitialized = false;
                this.initSpeech();
              }
              resolve(); // Continue with next chunk
            });
          } catch (error) {
            console.warn(`[${this.serviceType} TTS] Error calling speech.speak for chunk ${i + 1}:`, error);
            resolve(); // Continue with next chunk
          }
        });
        
        // Use a more intelligent timeout that waits for speech to actually start
        const timeoutPromise = new Promise((resolve) => {
          let timeoutId;
          
          const checkSpeechStatus = () => {
            // Check if speech has actually started
            if (this.isPlaying && this.speakingStartTime > 0) {
              const timeSinceStart = Date.now() - this.speakingStartTime;
              // Only timeout if we've been "speaking" for more than 20 seconds
              if (timeSinceStart > 20000) {
                console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} appears to be stuck after ${timeSinceStart}ms, continuing to next chunk`);
                resolve();
              } else {
                // Speech is active, extend the timeout
                timeoutId = setTimeout(checkSpeechStatus, 5000); // Check every 5 seconds
              }
            } else {
              // Speech hasn't started yet, give it more time
              console.log(`[${this.serviceType} TTS] Chunk ${i + 1} waiting for speech to start...`);
              timeoutId = setTimeout(checkSpeechStatus, 2000); // Check every 2 seconds
            }
          };
          
          // Start checking after a reasonable delay
          timeoutId = setTimeout(checkSpeechStatus, 8000); // Initial 8 second delay
          
          // Also set a maximum timeout to prevent infinite waiting
          setTimeout(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} maximum timeout reached, continuing to next chunk`);
              resolve();
            }
          }, 30000); // Maximum 30 seconds total
        });
        
        await Promise.race([chunkPromise, timeoutPromise]);
        
        // Small delay between chunks to prevent overwhelming the system
        if (this.currentChunks && i < this.currentChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Error in chunk ${i + 1}:`, error);
        this.errorCount++;
      }
    }
    
    console.log(`[${this.serviceType} TTS] Chunked speech completed`);
    this.isChunkedSpeech = false;
    // Only clear chunks if we're not paused (preserve for resume)
    if (!this.isPaused) {
      this.currentChunks = null;
      this.currentChunkIndex = 0;
    }
    this.isPlaying = false;
    // Don't clear isPaused here - let the pause method handle it
  }

  // Pause reading
  async pause() {
    console.log(`[${this.serviceType} TTS] Pause called - current state:`, {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isInitialized: this.isInitialized,
      isChunkedSpeech: this.isChunkedSpeech
    });
    
    if (this.isPlaying && !this.isPaused && this.isInitialized) {
      try {
        // Debug: Check speak-tts library state before pausing
        this.getSpeakTTSState();
        
        // Calculate current position based on time spent speaking
        const currentTime = Date.now();
        const timeSpentSpeaking = currentTime - this.speakingStartTime;
        this.totalSpokenTime += timeSpentSpeaking;
        
        // Estimate position based on time (rough approximation)
        // Using a more conservative speaking rate of 120 words per minute
        const wordsPerMinute = 120;
        const wordsPerSecond = wordsPerMinute / 60;
        const estimatedWordsSpoken = (this.totalSpokenTime / 1000) * wordsPerSecond;
        
        // Convert words to approximate character position
        // Use a more realistic average word length of 4.7 characters
        const averageWordLength = 4.7;
        const estimatedPosition = Math.floor(estimatedWordsSpoken * averageWordLength);
        
        // Ensure position is reasonable (not too far ahead)
        this.pausePosition = Math.min(
          Math.max(estimatedPosition, 0),
          this.fullText.length
        );
        
        // If position is too small, use a minimum threshold
        if (this.pausePosition < 50 && this.totalSpokenTime > 2000) {
          this.pausePosition = Math.min(50, this.fullText.length);
        }
        
        this.pauseTime = currentTime;
        
        // Reset error count to allow pause to work
        this.errorCount = 0;
        
        // Stop TTS completely instead of trying to pause in place
        let stopSuccessful = false;
        
        try {
          if (this.speech && typeof this.speech.cancel === 'function') {
            this.speech.cancel();
            console.log(`[${this.serviceType} TTS] Successfully called speech.cancel()`);
            stopSuccessful = true;
          }
        } catch (cancelError) {
          console.warn(`[${this.serviceType} TTS] speak-tts cancel failed:`, cancelError);
        }
        
        // Ensure state is properly set regardless of stop method success
        this.isPlaying = false;
        this.isPaused = true;
        this.wasManuallyPaused = true; // Mark that user manually paused
        
        console.log(`[${this.serviceType} TTS] Pause operation completed - state:`, {
          isPlaying: this.isPlaying,
          isPaused: this.isPaused,
          stopSuccessful: stopSuccessful,
          position: `${this.pausePosition}/${this.fullText.length} (${Math.round((this.pausePosition / this.fullText.length) * 100)}%)`
        });
        
        // If this is chunked speech, log the chunk position
        if (this.isChunkedSpeech && this.currentChunks && Array.isArray(this.currentChunks)) {
          console.log(`[${this.serviceType} TTS] Chunked speech paused at chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
          
          // Ensure chunk index is valid before recording
          if (this.currentChunkIndex >= 0 && this.currentChunkIndex < this.currentChunks.length) {
            console.log(`[${this.serviceType} TTS] Recording valid chunk index: ${this.currentChunkIndex}`);
          } else {
            console.warn(`[${this.serviceType} TTS] Invalid chunk index ${this.currentChunkIndex}, not recording`);
          }
        }
        
        // Record pause position to server for accurate resume (blocking to ensure it's recorded)
        if (this.currentLessonId) {
          try {
            const chunkIndexToRecord = (this.isChunkedSpeech && this.currentChunks && Array.isArray(this.currentChunks) && 
                                       this.currentChunkIndex >= 0 && this.currentChunkIndex < this.currentChunks.length) 
                                       ? this.currentChunkIndex : null;
            
            console.log(`[${this.serviceType} TTS] Recording pause position with chunk index:`, chunkIndexToRecord);
            
            await this.recordTTSPausePosition(
              this.currentLessonId, 
              chunkIndexToRecord, 
              'pause'
            );
          } catch (error) {
            console.log(`[${this.serviceType} TTS] Error recording pause position:`, error.message);
          }
        }
        
        return stopSuccessful;
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Pause failed completely:`, error);
        // If pause fails completely, reset state
        this.isPlaying = false;
        this.isPaused = false;
        this.wasManuallyPaused = false;
        return false;
      }
    } else {
      console.log(`[${this.serviceType} TTS] Cannot pause - conditions not met:`, {
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        isInitialized: this.isInitialized
      });
      return false;
    }
  }

  // Resume reading with server-based pause position
  async resume() {
    console.log(`[${this.serviceType} TTS] Resume called - current state:`, {
      isPaused: this.isPaused,
      isPlaying: this.isPlaying,
      isInitialized: this.isInitialized,
      isChunkedSpeech: this.isChunkedSpeech,
      currentChunks: this.currentChunks ? this.currentChunks.length : 'null',
      currentChunkIndex: this.currentChunkIndex,
      pausePosition: this.pausePosition
    });
    
    // Check if we're actually paused
    const actuallyPaused = this.isActuallyPaused();
    
    if ((this.isPaused || actuallyPaused) && !this.isPlaying && this.isInitialized) {
      try {
        // Debug: Check speak-tts library state before resuming
        this.getSpeakTTSState();
        
        // Reset error count to allow resume to work
        this.errorCount = 0;
        
        // Get pause position from server for accurate resume
        let pauseData = null;
        if (this.currentLessonId) {
          try {
            pauseData = await this.getPausePosition(this.currentLessonId);
            console.log(`[${this.serviceType} TTS] Retrieved pause data from server:`, pauseData);
            
            // Update local pause position with server data
            if (pauseData && pauseData.pausePosition) {
              this.pausePosition = pauseData.pausePosition;
              console.log(`[${this.serviceType} TTS] Updated pause position from server: ${this.pausePosition}`);
            }
          } catch (error) {
            console.warn(`[${this.serviceType} TTS] Failed to get pause position from server:`, error.message);
          }
        }
        
        // Always restart from recorded position instead of trying to resume in place
        console.log(`[${this.serviceType} TTS] Restarting from recorded pause position: ${this.pausePosition}`);
        
        // Check if this is chunked speech that was paused
        if (this.isChunkedSpeech && this.currentChunks && Array.isArray(this.currentChunks)) {
          console.log(`[${this.serviceType} TTS] Resuming chunked speech with ${this.currentChunks.length} chunks`);
          
          // Calculate the correct chunk index from pause position
          if (pauseData && pauseData.chunkIndex !== undefined && pauseData.chunkIndex !== null) {
            this.currentChunkIndex = Math.max(0, Math.min(pauseData.chunkIndex, this.currentChunks.length - 1));
            console.log(`[${this.serviceType} TTS] Setting chunk index from pause data: ${this.currentChunkIndex}`);
          } else if (this.pausePosition > 0 && this.fullText) {
            // Calculate chunk index from pause position
            let accumulatedLength = 0;
            let calculatedIndex = 0;
            for (let i = 0; i < this.currentChunks.length; i++) {
              accumulatedLength += this.currentChunks[i].length + 1; // +1 for space
              if (accumulatedLength >= this.pausePosition) {
                calculatedIndex = i;
                break;
              }
            }
            this.currentChunkIndex = calculatedIndex;
            console.log(`[${this.serviceType} TTS] Calculated chunk index from pause position: ${this.currentChunkIndex}`);
          } else {
            // Fallback: start from the beginning if no pause position available
            this.currentChunkIndex = 0;
            console.log(`[${this.serviceType} TTS] No pause position available, starting from chunk 0`);
          }
          
          // Ensure chunk index is valid
          if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.currentChunks.length) {
            console.warn(`[${this.serviceType} TTS] Invalid chunk index ${this.currentChunkIndex}, resetting to 0`);
            this.currentChunkIndex = 0;
          }
          
          // Safety check for currentChunks before accessing its properties
          if (!this.currentChunks || !Array.isArray(this.currentChunks)) {
            console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is null or invalid`);
            return false;
          }
          
          console.log(`[${this.serviceType} TTS] Resuming chunked speech from chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
          
          // Resume chunked speech from calculated position
          await this.resumeChunkedSpeech();
          return true;
        } else if (this.isChunkedSpeech && (!this.currentChunks || !Array.isArray(this.currentChunks))) {
          console.warn(`[${this.serviceType} TTS] Chunked speech detected but chunks are missing, attempting to recreate chunks`);
          
          // Try to recreate chunks from fullText if available
          if (this.fullText && this.fullText.length > 0) {
            const maxChunkLength = 1000;
            this.currentChunks = this.createChunks(this.fullText, maxChunkLength);
            this.currentChunkIndex = 0;
            console.log(`[${this.serviceType} TTS] Recreated ${this.currentChunks.length} chunks from fullText`);
            
            // Resume chunked speech from beginning
            await this.resumeChunkedSpeech();
            return true;
          } else {
            console.warn(`[${this.serviceType} TTS] Cannot recreate chunks - no fullText available`);
          }
        }
        
        // For non-chunked speech, always restart from pause position
        console.log(`[${this.serviceType} TTS] Restarting non-chunked speech from pause position`);
        setTimeout(() => {
          this.restartFromPausePosition(pauseData);
        }, 100); // Small delay to ensure state is stable
        return true; // Consider this successful for our purposes
        
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Resume failed completely:`, error);
        // If resume fails, try to restart from pause position
        console.log(`[${this.serviceType} TTS] Attempting to restart from pause position...`);
        setTimeout(() => {
          this.restartFromPausePosition();
        }, 100); // Small delay to ensure state is stable
        return false;
      }
    } else {
      console.log(`[${this.serviceType} TTS] Cannot resume - conditions not met:`, {
        isPaused: this.isPaused,
        isPlaying: this.isPlaying,
        isInitialized: this.isInitialized,
        actuallyPaused: actuallyPaused,
        isChunkedSpeech: this.isChunkedSpeech
      });
      return false;
    }
  }

  // Handle speak errors with retry logic
  handleSpeakError(error, text, startPosition) {
    console.warn(`[${this.serviceType} TTS] Handling speak error:`, error);
    
    this.errorCount++;
    
    if (this.errorCount < this.maxRetries) {
      console.log(`[${this.serviceType} TTS] Retrying after error... (${this.errorCount}/${this.maxRetries})`);
      setTimeout(() => {
        if (text && text.trim().length > 5) {
          this.speak(text, startPosition);
        }
      }, 1000);
    } else {
      console.log(`[${this.serviceType} TTS] Max retries exceeded`);
    }
  }

  // Stop reading completely
  stop() {
    if (this.isInitialized) {
      try {
        console.log(`[${this.serviceType} TTS] Stopping TTS`);
        

        
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.errorCount = 0;
        
        // Clear current text but preserve fullText for potential retries
        this.currentText = '';
        this.currentLessonId = null;
        
        // Reset position tracking
        this.pausePosition = 0;
        this.pauseTime = 0;
        this.totalSpokenTime = 0;
        this.speakingStartTime = 0;
        this.finishedNormally = false;
        this.wasManuallyPaused = false;
        
        // Clear chunked speech state
        this.isChunkedSpeech = false;
        this.currentChunks = null;
        this.currentChunkIndex = 0;
        
        console.log(`[${this.serviceType} TTS] Stopped`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop failed:`, error);
      } finally {
        // Clear any pending timeouts
        if (this.speakTimeout) {
          clearTimeout(this.speakTimeout);
          this.speakTimeout = null;
        }
      }
    }
  }

  // Stop and clear all text (for lesson changes)
  stopAndClear() {
    if (this.isInitialized) {
      try {
        console.log(`[${this.serviceType} TTS] Stopping and clearing TTS`);
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.errorCount = 0;
        
        // Clear all text when stopping for lesson changes
        this.currentText = '';
        this.currentLessonId = null;
        this.fullText = '';
        
        // Reset position tracking
        this.pausePosition = 0;
        this.pauseTime = 0;
        this.totalSpokenTime = 0;
        this.speakingStartTime = 0;
        this.finishedNormally = false;
        this.wasManuallyPaused = false;
        
        // Clear chunked speech state
        this.isChunkedSpeech = false;
        this.currentChunks = null;
        this.currentChunkIndex = 0;
        
        console.log(`[${this.serviceType} TTS] Stopped and cleared`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop and clear failed:`, error);
      } finally {
        // Clear any pending timeouts
        if (this.speakTimeout) {
          clearTimeout(this.speakTimeout);
          this.speakTimeout = null;
        }
      }
    }
  }

  // Reset TTS state - useful for recovery from inconsistent states
  reset() {
    console.log(`[${this.serviceType} TTS] Resetting TTS state`);
    
    // Force reset the stopping flag immediately
    // this.isStoppingIntentionally = false; // Removed as per edit hint
    
    // Cancel any ongoing speech synthesis using speak-tts
    if (this.speech && typeof this.speech.cancel === 'function') {
      try {
        this.speech.cancel();
        console.log(`[${this.serviceType} TTS] Canceled ongoing speech synthesis during reset`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Failed to cancel speech synthesis during reset:`, error);
      }
    }
    
    // Reset all state
    this.isPlaying = false;
    this.isPaused = false;
    this.errorCount = 0;
    this.currentText = '';
    this.currentLessonId = null;
    this.fullText = '';
    
    // Reset position tracking
    this.pausePosition = 0;
    this.pauseTime = 0;
    this.totalSpokenTime = 0;
    this.speakingStartTime = 0;
         this.finishedNormally = false;
     this.wasManuallyPaused = false;
     
     // Clear any pending timeouts
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    
    console.log(`[${this.serviceType} TTS] Reset complete, ready for new requests`);
  }

  // Check if TTS is supported
  isSupported() {
    return this.browserSupport.speechSynthesis && this.isInitialized;
  }

  // Get current status
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentLessonId: this.currentLessonId,
      isSupported: this.isSupported(),
      errorCount: this.errorCount,
      serviceType: this.serviceType,
      isInitialized: this.isInitialized,
      browserSupport: this.browserSupport,
      initializationAttempts: this.initializationAttempts
    };
  }

  // Get stable status (same interface as before)
  getStableStatus() {
    return this.getStatus();
  }

  // Check speak-tts library state
  getSpeakTTSState() {
    try {
      // Try to access internal state of speak-tts library
      const state = {
        hasSpeech: !!this.speech,
        speechType: typeof this.speech,
        hasPause: typeof this.speech?.pause === 'function',
        hasResume: typeof this.speech?.resume === 'function',
        hasCancel: typeof this.speech?.cancel === 'function',
        ourPaused: this.isPaused,
        ourPlaying: this.isPlaying,
        wasManuallyPaused: this.wasManuallyPaused
      };
      
      console.log(`[${this.serviceType} TTS] Speak-TTS library state:`, state);
      return state;
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error getting speak-tts state:`, error);
      return { error: error.message };
    }
  }

  // Test if TTS is actually working
  async testTTSWorking() {
    console.log(`[${this.serviceType} TTS] Testing if TTS is actually working...`);
    
    try {
      // Check library state
      this.getSpeakTTSState();
      
      // Test with a very short text
      const testText = "Test.";
      
      console.log(`[${this.serviceType} TTS] Starting TTS test with text: "${testText}"`);
      
      // Create a promise that resolves when speech completes or times out quickly
      const testPromise = new Promise((resolve) => {
        const speakConfig = {
          text: testText,
          splitSentences: false
        };
        
        console.log(`[${this.serviceType} TTS] Test speak config:`, speakConfig);
        
        // Use speak-tts library
        this.speech.speak(speakConfig).then((result) => {
          console.log(`[${this.serviceType} TTS] Test speech completed successfully:`, result);
          resolve({ success: true, result });
        }).catch((error) => {
          console.warn(`[${this.serviceType} TTS] Test speech failed:`, error);
          resolve({ success: false, error });
        });
      });
      
      // Timeout after 3 seconds
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn(`[${this.serviceType} TTS] Test speech timed out`);
          resolve({ success: false, error: 'timeout' });
        }, 3000);
      });
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      console.log(`[${this.serviceType} TTS] TTS test result:`, result);
      return result;
      
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] TTS test failed:`, error);
      return { success: false, error };
    }
  }

  // Test pause/resume functionality
  async testPauseResume() {
    console.log(`[${this.serviceType} TTS] Testing pause/resume functionality...`);
    
    try {
      // Check library state
      this.getSpeakTTSState();
      
      // Test with a short text
      const testText = "This is a test of the pause and resume functionality. It should work correctly.";
      
      console.log(`[${this.serviceType} TTS] Starting test speech...`);
      await this.speak(testText);
      
      // Wait a moment then try to pause
      setTimeout(async () => {
        console.log(`[${this.serviceType} TTS] Attempting to pause test speech...`);
        await this.pause();
        
        // Wait a moment then try to resume
        setTimeout(async () => {
          console.log(`[${this.serviceType} TTS] Attempting to resume test speech...`);
          this.resume();
        }, 1000);
      }, 2000);
      
      return true;
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Test pause/resume failed:`, error);
      return false;
    }
  }

  // Check if resume is possible
  canResume() {
    return this.isPaused && this.fullText && this.currentLessonId;
  }

  // Check if TTS is actually paused by checking our state
  isActuallyPaused() {
    try {
      console.log(`[${this.serviceType} TTS] TTS state:`, {
        ourPaused: this.isPaused,
        ourPlaying: this.isPlaying,
        wasManuallyPaused: this.wasManuallyPaused
      });
      
      // Consider paused if we manually paused it or if our state says it's paused
      return this.isPaused || this.wasManuallyPaused;
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error checking TTS state:`, error);
      return this.isPaused || this.wasManuallyPaused; // Fallback to our state
    }
  }



  // Restart from pause position (handles both server and local data)
  async restartFromPausePosition(pauseData = null) {
    if (!this.fullText) {
      console.warn(`[${this.serviceType} TTS] Cannot restart from pause position - no text`);
      return false;
    }
    
    try {
      // Use server-provided pause position if available, otherwise use local
      let resumePosition = this.pausePosition;
      if (pauseData && pauseData.pausePosition) {
        resumePosition = pauseData.pausePosition;
        this.pausePosition = pauseData.pausePosition; // Update local position
        console.log(`[${this.serviceType} TTS] Using server-provided pause position: ${resumePosition}`);
      } else {
        console.log(`[${this.serviceType} TTS] Using local pause position: ${resumePosition}`);
      }
      
      if (resumePosition <= 0) {
        console.warn(`[${this.serviceType} TTS] Cannot restart from pause position - invalid position: ${resumePosition}`);
        return false;
      }
      
      console.log(`[${this.serviceType} TTS] Restarting from pause position ${resumePosition}/${this.fullText.length}`);
      
      // Stop current speech if any
      if (this.isPlaying || this.isPaused) {
        try {
          if (this.speech && typeof this.speech.cancel === 'function') {
            this.speech.cancel();
            console.log(`[${this.serviceType} TTS] Canceled ongoing speech before restart`);
          }
        } catch (cancelError) {
          console.warn(`[${this.serviceType} TTS] Error canceling speech:`, cancelError);
        }
      }
      
      // Reset state for restart
      this.isPlaying = false;
      this.isPaused = false;
      this.errorCount = 0;
      this.wasManuallyPaused = false;
      this.speakingStartTime = 0;
      
      // Wait a moment for state to stabilize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Extract text from pause position
      const remainingText = this.fullText.substring(resumePosition);
      if (!remainingText || remainingText.trim().length === 0) {
        console.log(`[${this.serviceType} TTS] No remaining text to speak from pause position`);
        return true;
      }
      
      console.log(`[${this.serviceType} TTS] Speaking remaining text (${remainingText.length} characters) from position ${resumePosition}`);
      console.log(`[${this.serviceType} TTS] Remaining text preview: ${remainingText.substring(0, 100)}...`);
      
      // Speak the remaining text
      await this.speak(remainingText);
      return true;
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Failed to restart from pause position:`, error);
      return false;
    }
  }

  // Force reinitialization
  async forceReinitialize() {
    console.log(`[${this.serviceType} TTS] Force reinitializing...`);
    this.isInitialized = false;
    this.initializationAttempts = 0;
    await this.initSpeech();
  }

  // Force reset the stopping flag (for manual recovery)
  forceResetStoppingFlag() {
    console.log(`[${this.serviceType} TTS] Force resetting TTS state`);
    this.isPlaying = false;
    this.isPaused = false;
    this.errorCount = 0;
    
    // Reset position tracking
    this.pausePosition = 0;
    this.pauseTime = 0;
    this.totalSpokenTime = 0;
    this.speakingStartTime = 0;
    this.finishedNormally = false;
    this.wasManuallyPaused = false;
    
    // Clear any pending timeouts
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    
    console.log(`[${this.serviceType} TTS] Force reset complete, service should be ready`);
  }

  // Record TTS pause position to server for accurate resume
  async recordTTSPausePosition(lessonId, chunkIndex = null, pauseReason = 'manual') {
    try {
      // Validate chunk index if provided
      let validatedChunkIndex = null;
      if (chunkIndex !== null && chunkIndex !== undefined) {
        if (typeof chunkIndex === 'number' && chunkIndex >= 0) {
          validatedChunkIndex = chunkIndex;
          console.log(`[${this.serviceType} TTS] Valid chunk index provided: ${validatedChunkIndex}`);
        } else {
          console.warn(`[${this.serviceType} TTS] Invalid chunk index provided: ${chunkIndex}, using null`);
        }
      } else {
        console.log(`[${this.serviceType} TTS] No chunk index provided, using null`);
      }
      
      const pauseData = {
        lessonId: lessonId,
        serviceType: this.serviceType,
        pauseTime: Date.now(),
        pauseReason: pauseReason,
        chunkIndex: validatedChunkIndex,
        totalSpokenTime: this.totalSpokenTime,
        pausePosition: this.pausePosition,
        fullTextLength: this.fullText ? this.fullText.length : 0
      };

      console.log(`[${this.serviceType} TTS] Recording TTS pause position:`, pauseData);

      const response = await fetch('/api/tts/record-pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pauseData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[${this.serviceType} TTS] TTS pause position recorded successfully:`, result);
        return result;
      } else {
        console.log(`[${this.serviceType} TTS] Failed to record TTS pause position:`, response.status);
        return null;
      }
    } catch (error) {
      console.log(`[${this.serviceType} TTS] Error recording TTS pause position (non-critical):`, error.message);
      return null;
    }
  }

  // Get pause position from server for accurate resume
  async getPausePosition(lessonId) {
    try {
      const response = await fetch(`/api/tts/pause-position?lessonId=${lessonId}`, {
        method: 'GET'
      });

      if (response.ok) {
        const pauseData = await response.json();
        console.log(`[${this.serviceType} TTS] Retrieved pause position:`, pauseData);
        return pauseData;
      } else {
        console.log(`[${this.serviceType} TTS] No pause position found for lesson ${lessonId}`);
        return null;
      }
    } catch (error) {
      console.log(`[${this.serviceType} TTS] Error getting pause position (non-critical):`, error.message);
      return null;
    }
  }

  // Check if service is ready for new requests
  isReadyForRequests() {
    const ready = this.isInitialized && !this.isPlaying;
    console.log(`[${this.serviceType} TTS] Service ready check:`, {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      ready: ready
    });
    return ready;
  }

  // Debug method to show current TTS state
  debugState() {
    const browserState = this.isActuallyPaused();
    console.log(`[${this.serviceType} TTS] Debug State:`, {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      // isStoppingIntentionally: this.isStoppingIntentionally, // Removed as per edit hint
      finishedNormally: this.finishedNormally,
      wasManuallyPaused: this.wasManuallyPaused,
      browserPaused: browserState,
      pausePosition: this.pausePosition,
      totalSpokenTime: this.totalSpokenTime,
      fullTextLength: this.fullText ? this.fullText.length : 0,
      currentLessonId: this.currentLessonId,
      errorCount: this.errorCount
    });
  }
}

// Create separate singleton instances for private and public courses
// These are completely isolated from each other
const privateTTSService = new TTSService('private');
const publicTTSService = new TTSService('public');

// Expose to window for debugging (only in development)
if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost')) {
  window.privateTTSService = privateTTSService;
  window.publicTTSService = publicTTSService;
  console.log('🔧 [TTS] TTS services exposed to window for debugging');
}

// Export the isolated service instances
export { privateTTSService, publicTTSService };

// Default export for backward compatibility (uses private service)
export default privateTTSService; 