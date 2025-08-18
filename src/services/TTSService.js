// src/services/TTSService.js
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
     this.isStoppingIntentionally = false; // Track if we're stopping intentionally
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
      }, 10000);
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
          this.isPlaying = true;
          this.isPaused = false;
          this.lastStartTime = Date.now(); // Track when TTS started
          console.log(`[${this.serviceType} TTS] Started speaking`);
        },
        'onend': () => {
          this.isPlaying = false;
          this.isPaused = false;
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
      // Handle structured content - only get the current lesson content
      const parts = [];
      
      // Log the content structure for debugging
      console.log(`[${this.serviceType} TTS] Content is object, keys:`, Object.keys(content));
      
      // Only include the main content, not introduction/conclusion from other lessons
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
      } else {
        // Try to find any text-like properties
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
      // Stop any current reading BEFORE setting the new text
      this.stop();
      
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

  // Enhanced speak method with better error handling
  async speak(text, startPosition = 0) {
    // Prevent multiple simultaneous speak calls
    if (this.isPlaying) {
      console.warn(`[${this.serviceType} TTS] Already playing, ignoring new speak request`);
      return;
    }
    
    // Debounce rapid speak calls
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      console.log(`[${this.serviceType} TTS] Debouncing rapid speak call`);
    }
    
    // Set a debounce timeout to prevent rapid calls
    this.speakTimeout = setTimeout(() => {
      this.speakTimeout = null;
    }, 500);
    
    // Prevent starting if we're stopping intentionally, but allow override after a reasonable delay
    if (this.isStoppingIntentionally) {
      console.warn(`[${this.serviceType} TTS] Service is stopping intentionally, ignoring speak request`);
      // Force reset the flag immediately for lesson changes (safety mechanism)
      console.log(`[${this.serviceType} TTS] Force resetting stopping flag for immediate recovery`);
      this.isStoppingIntentionally = false;
      // Continue with the speak request
    }
    
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
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        console.log(`[${this.serviceType} TTS] Canceling ongoing speech synthesis`);
        window.speechSynthesis.cancel();
        // Small delay to ensure cancel completes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Create a promise that wraps the speak-tts library call
      const speakPromise = new Promise((resolve) => {
        try {
                     // Create the speak configuration
           const speakConfig = {
             text: textToSpeak,
             queue: false, // Don't queue, replace current speech
             splitSentences: false, // Ensure no sentence splitting to preserve pause state
            listeners: {
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
                 this.speakingStartTime = Date.now();
                 this.finishedNormally = false; // Reset flag when starting new speech
                 console.log(`[${this.serviceType} TTS] Started speaking (manually paused: ${this.wasManuallyPaused})`);
               },
                      'onend': () => {
          this.isPlaying = false;
          this.isPaused = false;
          console.log(`[${this.serviceType} TTS] Finished speaking`);
          // Mark that we finished normally to prevent automatic restarts
          this.finishedNormally = true;
          resolve();
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
                console.warn(`[${this.serviceType} TTS] Speech error occurred:`, event.error);
                this.isPlaying = false;
                this.isPaused = false;
                
                const errorType = this.categorizeError(event);
                
                // Handle interrupted errors more gracefully
                if (errorType === TTS_ERROR_TYPES.INTERRUPTED) {
                  console.log(`[${this.serviceType} TTS] Speech was interrupted/canceled, not counting as error`);
                  resolve(); // Resolve gracefully for interruptions
                  return;
                }
                
                this.errorCount++;
                
                if (this.errorCount < this.maxRetries && !this.finishedNormally) {
                  console.log(`[${this.serviceType} TTS] Retrying after speech error... (${this.errorCount}/${this.maxRetries})`);
                  setTimeout(() => {
                    // Only retry if we have valid text to speak and didn't finish normally
                    if (this.fullText && this.fullText.trim().length > 5 && !this.finishedNormally) {
                      this.speak(this.fullText).then(resolve);
                    } else {
                      console.warn(`[${this.serviceType} TTS] No valid text for retry or finished normally, resolving gracefully`);
                      resolve();
                    }
                  }, 1000);
                } else {
                  console.log(`[${this.serviceType} TTS] Max retries exceeded or finished normally after speech error`);
                  resolve(); // Always resolve, never reject
                }
              }
            }
          };

          // Call the speak method and handle any promise rejections
          const speakResult = this.speech.speak(speakConfig);
          
          // If speak returns a promise, handle it properly
          if (speakResult && typeof speakResult.then === 'function') {
            speakResult
              .then(() => {
                console.log(`[${this.serviceType} TTS] Speak promise resolved successfully`);
              })
              .catch((error) => {
                console.warn(`[${this.serviceType} TTS] Speak promise rejected:`, error);
                this.isPlaying = false;
                this.isPaused = false;
                
                // Check if we're stopping intentionally
                if (this.isStoppingIntentionally) {
                  console.log(`[${this.serviceType} TTS] Promise rejected due to intentional stop, not counting as error`);
                  resolve(); // Resolve gracefully for intentional stops
                  return;
                }
                
                const errorType = this.categorizeError(error);
                
                // Handle interrupted errors more gracefully
                if (errorType === TTS_ERROR_TYPES.INTERRUPTED) {
                  console.log(`[${this.serviceType} TTS] Promise was interrupted/canceled, not counting as error`);
                  resolve(); // Resolve gracefully for interruptions
                  return;
                }
                
                this.errorCount++;
                
                                 if (this.errorCount < this.maxRetries && !this.finishedNormally) {
                   console.log(`[${this.serviceType} TTS] Retrying after promise rejection... (${this.errorCount}/${this.maxRetries})`);
                   this.isRetrying = true;
                   setTimeout(() => {
                     // Only retry if we have valid text to speak and we're not stopping intentionally
                     if (this.fullText && this.fullText.trim().length > 5 && !this.isStoppingIntentionally && !this.finishedNormally) {
                       console.log(`[${this.serviceType} TTS] Retrying with text length: ${this.fullText.trim().length}`);
                       this.speak(this.fullText).then(resolve);
                     } else {
                       console.warn(`[${this.serviceType} TTS] No valid text for retry, stopping intentionally, or finished normally (fullText: ${this.fullText ? this.fullText.length : 'undefined'}, isStopping: ${this.isStoppingIntentionally}, finishedNormally: ${this.finishedNormally}), resolving gracefully`);
                       resolve();
                     }
                     this.isRetrying = false;
                   }, 1000);
                 } else {
                   console.log(`[${this.serviceType} TTS] Max retries exceeded or finished normally after promise rejection`);
                   resolve(); // Always resolve, never reject
                 }
              });
          }
          
        } catch (speakError) {
          console.warn(`[${this.serviceType} TTS] Speak method error:`, speakError);
          this.isPlaying = false;
          this.isPaused = false;
          
          // Check if we're stopping intentionally
          if (this.isStoppingIntentionally) {
            console.log(`[${this.serviceType} TTS] Speak error due to intentional stop, not counting as error`);
            resolve(); // Resolve gracefully for intentional stops
            return;
          }
          
          this.errorCount++;
          
          if (this.errorCount < this.maxRetries) {
            console.log(`[${this.serviceType} TTS] Retrying after speak error... (${this.errorCount}/${this.maxRetries})`);
            this.isRetrying = true;
            setTimeout(() => {
              // Only retry if we have valid text to speak and we're not stopping intentionally
              if (this.fullText && this.fullText.trim().length > 5 && !this.isStoppingIntentionally) {
                console.log(`[${this.serviceType} TTS] Retrying with text length: ${this.fullText.trim().length}`);
                this.speak(this.fullText).then(resolve);
              } else {
                console.warn(`[${this.serviceType} TTS] No valid text for retry or stopping intentionally (fullText: ${this.fullText ? this.fullText.length : 'undefined'}, isStopping: ${this.isStoppingIntentionally}), resolving gracefully`);
                resolve();
              }
              this.isRetrying = false;
            }, 1000);
          } else {
            console.log(`[${this.serviceType} TTS] Max retries exceeded after speak error`);
            resolve(); // Always resolve, never reject
          }
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

      // Race between speak and timeout
      await Promise.race([speakPromise, timeoutPromise]);
      console.log(`[${this.serviceType} TTS] Speak command completed successfully`);
      
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error in speak method:`, error);
      this.isPlaying = false;
      this.isPaused = false;
      
      // Check if we're stopping intentionally
      if (this.isStoppingIntentionally) {
        console.log(`[${this.serviceType} TTS] Speak method error due to intentional stop, not counting as error`);
        return;
      }
      
      this.errorCount++;
      
             // Handle the error gracefully without throwing
       if (this.errorCount < this.maxRetries && !this.finishedNormally) {
         console.log(`[${this.serviceType} TTS] Retrying after catch error... (${this.errorCount}/${this.maxRetries})`);
         this.isRetrying = true;
         setTimeout(() => {
           // Only retry if we have valid text to speak and we're not stopping intentionally
           if (this.fullText && this.fullText.trim().length > 5 && !this.isStoppingIntentionally && !this.finishedNormally) {
             console.log(`[${this.serviceType} TTS] Retrying with text length: ${this.fullText.trim().length}`);
             this.speak(this.fullText);
           } else {
             console.warn(`[${this.serviceType} TTS] No valid text for retry, stopping intentionally, or finished normally (fullText: ${this.fullText ? this.fullText.length : 'undefined'}, isStopping: ${this.isStoppingIntentionally}, finishedNormally: ${this.finishedNormally})`);
           }
           this.isRetrying = false;
         }, 1000);
       } else {
         console.log(`[${this.serviceType} TTS] Max retries exceeded or finished normally in catch block`);
       }
    }
  }

  // Pause reading
  pause() {
    if (this.isPlaying && !this.isPaused && this.isInitialized) {
      try {
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
        this.speech.pause();
        
                 // Ensure state is properly set
         this.isPlaying = false;
         this.isPaused = true;
         this.wasManuallyPaused = true; // Mark that user manually paused
        
        console.log(`[${this.serviceType} TTS] Paused at position ${this.pausePosition}/${this.fullText.length} (${Math.round((this.pausePosition / this.fullText.length) * 100)}%)`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Pause failed:`, error);
      }
    }
  }

  // Resume reading
  resume() {
    // Check if we're actually paused
    const actuallyPaused = this.isActuallyPaused();
    
    if ((this.isPaused || actuallyPaused) && !this.isPlaying && this.isInitialized) {
      try {
        // Reset error count to allow resume to work
        this.errorCount = 0;
                 this.speech.resume();
         this.speakingStartTime = Date.now(); // Reset speaking start time
         this.wasManuallyPaused = false; // Clear manual pause flag
        console.log(`[${this.serviceType} TTS] Resumed from position ${this.pausePosition}/${this.fullText.length} (${Math.round((this.pausePosition / this.fullText.length) * 100)}%)`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Resume failed:`, error);
        // If resume fails, try to restart from pause position
        console.log(`[${this.serviceType} TTS] Attempting to restart from pause position...`);
        setTimeout(() => {
          this.restartFromPausePosition();
        }, 100); // Small delay to ensure state is stable
      }
    } else {
      console.log(`[${this.serviceType} TTS] Cannot resume - not paused or not initialized. State:`, {
        isPaused: this.isPaused,
        isPlaying: this.isPlaying,
        isInitialized: this.isInitialized
      });
    }
  }

  // Stop reading completely
  stop() {
    if (this.isInitialized) {
      // Add a grace period to prevent stopping immediately after starting
      const timeSinceStart = Date.now() - (this.lastStartTime || 0);
      if (timeSinceStart < 1000) { // 1 second grace period
        console.log(`[${this.serviceType} TTS] Ignoring stop request - TTS just started ${timeSinceStart}ms ago`);
        return;
      }
      
      try {
        console.log(`[${this.serviceType} TTS] Setting stopping flag for stop`);
        this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.errorCount = 0; // Reset error count when stopping
        
        // Clear current text but preserve fullText for potential retries
        this.currentText = '';
        this.currentLessonId = null;
        // Don't clear fullText here - it's needed for retries
        
                 // Reset position tracking
         this.pausePosition = 0;
         this.pauseTime = 0;
         this.totalSpokenTime = 0;
         this.speakingStartTime = 0;
         this.finishedNormally = false;
         this.wasManuallyPaused = false;
         
         console.log(`[${this.serviceType} TTS] Stopped`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop failed:`, error);
      } finally {
        // Clear any pending timeouts
        if (this.speakTimeout) {
          clearTimeout(this.speakTimeout);
          this.speakTimeout = null;
        }
        
        // Reset the flag immediately after a short delay
        setTimeout(() => {
          this.isStoppingIntentionally = false;
          console.log(`[${this.serviceType} TTS] Stop flag reset, ready for new requests`);
        }, 200); // Reduced to 200ms for faster recovery
      }
    }
  }

  // Stop and clear all text (for lesson changes)
  stopAndClear() {
    if (this.isInitialized) {
      // Add a grace period to prevent stopping immediately after starting
      const timeSinceStart = Date.now() - (this.lastStartTime || 0);
      if (timeSinceStart < 1000) { // 1 second grace period
        console.log(`[${this.serviceType} TTS] Ignoring stopAndClear request - TTS just started ${timeSinceStart}ms ago`);
        return;
      }
      
      try {
        console.log(`[${this.serviceType} TTS] Setting stopping flag for lesson change`);
        this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
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
         
         console.log(`[${this.serviceType} TTS] Stopped and cleared`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop and clear failed:`, error);
      } finally {
        // Clear any pending timeouts
        if (this.speakTimeout) {
          clearTimeout(this.speakTimeout);
          this.speakTimeout = null;
        }
        
        // Reset the flag immediately for lesson changes
        console.log(`[${this.serviceType} TTS] Resetting stopping flag immediately for lesson change`);
        this.isStoppingIntentionally = false;
        console.log(`[${this.serviceType} TTS] StopAndClear flag reset, ready for new requests`);
      }
    }
  }

  // Reset TTS state - useful for recovery from inconsistent states
  reset() {
    console.log(`[${this.serviceType} TTS] Resetting TTS state`);
    
    // Force reset the stopping flag immediately
    this.isStoppingIntentionally = false;
    
    // Cancel any ongoing speech synthesis
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel();
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

  // Check if resume is possible
  canResume() {
    return this.isPaused && this.fullText && this.currentLessonId;
  }

  // Check if TTS is actually paused by checking browser state
  isActuallyPaused() {
    if (!window.speechSynthesis) return false;
    
    try {
      // Check if speech synthesis is paused
      const isPaused = window.speechSynthesis.paused;
      const isSpeaking = window.speechSynthesis.speaking;
      
      console.log(`[${this.serviceType} TTS] Browser TTS state:`, {
        paused: isPaused,
        speaking: isSpeaking,
        ourPaused: this.isPaused,
        ourPlaying: this.isPlaying
      });
      
      return isPaused && !isSpeaking;
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error checking browser TTS state:`, error);
      return this.isPaused; // Fallback to our state
    }
  }

  // Restart from pause position
  async restartFromPausePosition() {
    if (!this.fullText || this.pausePosition <= 0) {
      console.warn(`[${this.serviceType} TTS] Cannot restart from pause position - no text or invalid position`);
      return false;
    }
    
    try {
      console.log(`[${this.serviceType} TTS] Restarting from pause position ${this.pausePosition}/${this.fullText.length}`);
      
      // Stop current speech if any
      if (this.isPlaying || this.isPaused) {
        try {
          this.speech.cancel();
        } catch (cancelError) {
          console.warn(`[${this.serviceType} TTS] Error canceling speech:`, cancelError);
        }
      }
      
      // Reset state
      this.isPlaying = false;
      this.isPaused = false;
      this.errorCount = 0;
      this.isStoppingIntentionally = false;
      
      // Wait a moment for state to stabilize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Speak from the pause position
      await this.speak(this.fullText, this.pausePosition);
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
    console.log(`[${this.serviceType} TTS] Force resetting stopping flag`);
    this.isStoppingIntentionally = false;
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
     
     console.log(`[${this.serviceType} TTS] Force reset complete, service should be ready`);
  }

  // Check if service is ready for new requests
  isReadyForRequests() {
    const ready = this.isInitialized && !this.isStoppingIntentionally && !this.isPlaying;
    console.log(`[${this.serviceType} TTS] Service ready check:`, {
      isInitialized: this.isInitialized,
      isStoppingIntentionally: this.isStoppingIntentionally,
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
      isStoppingIntentionally: this.isStoppingIntentionally,
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

// Export the isolated service instances
export { privateTTSService, publicTTSService };

// Default export for backward compatibility (uses private service)
export default privateTTSService; 