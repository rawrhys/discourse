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

  // Speak text in chunks to prevent long task errors
  async speakInChunks(text, chunkSize = 1000) {
    console.log(`[${this.serviceType} TTS] Starting chunked speech (${text.length} chars in chunks of ${chunkSize})`);
    
    const chunks = this.splitTextIntoChunks(text, chunkSize);
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
      
      const chunk = chunks[i];
      this.currentChunkIndex = i;
      console.log(`[${this.serviceType} TTS] Speaking chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      try {
        // Check for optimal timing from backend
        let optimalTimeout = 5000; // Default 5 second timeout
        if (this.currentLessonId) {
          const timing = await this.getOptimalChunkTiming(this.currentLessonId, i);
          if (timing && timing.optimalTimeout) {
            optimalTimeout = timing.optimalTimeout;
            console.log(`[${this.serviceType} TTS] Using optimal timeout for chunk ${i + 1}: ${optimalTimeout}ms`);
          }
        }
        
        // Use speak-tts library only (no native fallback)
        const chunkPromise = new Promise((resolve) => {
          const speakConfig = {
            text: chunk,
            splitSentences: false
          };
          
          // Use speak-tts library only (no native fallback)
          this.speech.speak(speakConfig).then(() => {
            console.log(`[${this.serviceType} TTS] Chunk ${i + 1} completed successfully`);
            resolve();
          }).catch((error) => {
            console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts failed:`, error);
            resolve(); // Continue with next chunk
          });
        });
        
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} timeout - continuing to next chunk`);
            resolve(); // Just continue to next chunk on timeout
          }, 5000); // 5 second timeout
        });
        
        await Promise.race([chunkPromise, timeoutPromise]);
        
        // Check if we're paused after chunk completion
        if (this.isPaused) {
          console.log(`[${this.serviceType} TTS] Paused after chunk ${i + 1}, stopping chunked speech`);
          return;
        }
        
        // Small delay between chunks to prevent overwhelming the system
        if (i < chunks.length - 1) {
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
    if (!this.isChunkedSpeech || !this.currentChunks || this.currentChunkIndex < 0) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - invalid state:`, {
        isChunkedSpeech: this.isChunkedSpeech,
        hasCurrentChunks: !!this.currentChunks,
        currentChunkIndex: this.currentChunkIndex
      });
      return;
    }
    
    // Additional null check for currentChunks
    if (!this.currentChunks || !Array.isArray(this.currentChunks) || this.currentChunks.length === 0) {
      console.warn(`[${this.serviceType} TTS] Cannot resume chunked speech - currentChunks is invalid:`, this.currentChunks);
      return;
    }
    
    console.log(`[${this.serviceType} TTS] Resuming chunked speech from chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
    
    // Set playing state
    this.isPlaying = true;
    this.isPaused = false;
    this.wasManuallyPaused = false;
    this.speakingStartTime = Date.now();
    
    // Continue from the current chunk
    for (let i = this.currentChunkIndex; i < this.currentChunks.length; i++) {
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
      
      const chunk = this.currentChunks[i];
      this.currentChunkIndex = i;
      console.log(`[${this.serviceType} TTS] Speaking chunk ${i + 1}/${this.currentChunks.length} (${chunk.length} chars)`);
      
      try {
        // Check for optimal timing from backend
        let optimalTimeout = 5000; // Default 5 second timeout
        if (this.currentLessonId) {
          const timing = await this.getOptimalChunkTiming(this.currentLessonId, i);
          if (timing && timing.optimalTimeout) {
            optimalTimeout = timing.optimalTimeout;
            console.log(`[${this.serviceType} TTS] Using optimal timeout for chunk ${i + 1}: ${optimalTimeout}ms`);
          }
        }
        
        // Use speak-tts library only (no native fallback)
        const chunkPromise = new Promise((resolve) => {
          const speakConfig = {
            text: chunk,
            splitSentences: false
          };
          
          // Use speak-tts library only (no native fallback)
          this.speech.speak(speakConfig).then(() => {
            console.log(`[${this.serviceType} TTS] Chunk ${i + 1} completed successfully`);
            resolve();
          }).catch((error) => {
            console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} speak-tts failed:`, error);
            resolve(); // Continue with next chunk
          });
        });
        
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn(`[${this.serviceType} TTS] Chunk ${i + 1} timeout - continuing to next chunk`);
            resolve(); // Just continue to next chunk on timeout
          }, optimalTimeout); // Use optimal timeout from backend
        });
        
        await Promise.race([chunkPromise, timeoutPromise]);
        
        // Small delay between chunks to prevent overwhelming the system
        if (i < this.currentChunks.length - 1) {
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

  // Split text into chunks at sentence boundaries
  splitTextIntoChunks(text, maxChunkSize) {
    const chunks = [];
    let currentChunk = '';
    
    // Split by sentences first
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      // If adding this sentence would exceed the chunk size
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // If we still have chunks that are too long, split them further
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        finalChunks.push(chunk);
      } else {
        // Split long chunks by words
        const words = chunk.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxChunkSize && wordChunk.length > 0) {
            finalChunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
        }
        
        if (wordChunk.trim()) {
          finalChunks.push(wordChunk.trim());
        }
      }
    }
    
    return finalChunks;
  }

  // Fallback to native SpeechSynthesis API
  async fallbackToNativeSpeechSynthesis(text) {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('SpeechSynthesis not supported'));
        return;
      }

      console.log(`[${this.serviceType} TTS] Using native SpeechSynthesis fallback`);
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set properties
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Set up event handlers
      utterance.onstart = () => {
        console.log(`[${this.serviceType} TTS] Native SpeechSynthesis started`);
        this.isPlaying = true;
        this.isPaused = false;
        this.speakingStartTime = Date.now();
      };
      
      utterance.onend = () => {
        console.log(`[${this.serviceType} TTS] Native SpeechSynthesis ended`);
        this.isPlaying = false;
        this.isPaused = false;
        this.finishedNormally = true;
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.warn(`[${this.serviceType} TTS] Native SpeechSynthesis error:`, event);
        this.isPlaying = false;
        this.isPaused = false;
        reject(event);
      };
      
      utterance.onpause = () => {
        console.log(`[${this.serviceType} TTS] Native SpeechSynthesis paused`);
        this.isPaused = true;
        this.isPlaying = false;
      };
      
      utterance.onresume = () => {
        console.log(`[${this.serviceType} TTS] Native SpeechSynthesis resumed`);
        this.isPaused = false;
        this.isPlaying = true;
      };
      
      // Speak
      window.speechSynthesis.speak(utterance);
    });
  }

  // Pause reading
  pause() {
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
        
        // Use speak-tts library only (no native fallback)
        let pauseSuccessful = false;
        
        try {
          if (this.speech && typeof this.speech.pause === 'function') {
            this.speech.pause();
            console.log(`[${this.serviceType} TTS] Successfully called speech.pause()`);
            pauseSuccessful = true;
          }
        } catch (pauseError) {
          console.warn(`[${this.serviceType} TTS] speak-tts pause failed:`, pauseError);
        }
        
        // Fallback: Cancel and restart from position later
        if (!pauseSuccessful) {
          console.log(`[${this.serviceType} TTS] Pause failed, using cancel strategy`);
          try {
            if (this.speech && typeof this.speech.cancel === 'function') {
              this.speech.cancel();
            }
            pauseSuccessful = true; // Consider this successful for our purposes
          } catch (cancelError) {
            console.warn(`[${this.serviceType} TTS] Cancel also failed:`, cancelError);
          }
        }
        
        // Ensure state is properly set regardless of pause method success
        this.isPlaying = false;
        this.isPaused = true;
        this.wasManuallyPaused = true; // Mark that user manually paused
        
        console.log(`[${this.serviceType} TTS] Pause operation completed - state:`, {
          isPlaying: this.isPlaying,
          isPaused: this.isPaused,
          pauseSuccessful: pauseSuccessful,
          position: `${this.pausePosition}/${this.fullText.length} (${Math.round((this.pausePosition / this.fullText.length) * 100)}%)`
        });
        
        // If this is chunked speech, log the chunk position
        if (this.isChunkedSpeech && this.currentChunks) {
          console.log(`[${this.serviceType} TTS] Chunked speech paused at chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
        }
        
        // Record pause time to backend for optimization
        if (this.currentLessonId) {
          this.recordTTSStopTime(
            this.currentLessonId, 
            this.isChunkedSpeech ? this.currentChunkIndex : null, 
            'pause'
          );
        }
        
        return pauseSuccessful;
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

  // Resume reading
  resume() {
    console.log(`[${this.serviceType} TTS] Resume called - current state:`, {
      isPaused: this.isPaused,
      isPlaying: this.isPlaying,
      isInitialized: this.isInitialized,
      isChunkedSpeech: this.isChunkedSpeech
    });
    
    // Check if we're actually paused
    const actuallyPaused = this.isActuallyPaused();
    
    if ((this.isPaused || actuallyPaused) && !this.isPlaying && this.isInitialized) {
      try {
        // Debug: Check speak-tts library state before resuming
        this.getSpeakTTSState();
        
        // Reset error count to allow resume to work
        this.errorCount = 0;
        
        // Check if this is chunked speech that was paused
        if (this.isChunkedSpeech && this.currentChunks && this.currentChunkIndex >= 0) {
          console.log(`[${this.serviceType} TTS] Resuming chunked speech from chunk ${this.currentChunkIndex + 1}/${this.currentChunks.length}`);
          
          // Resume chunked speech from current position
          this.resumeChunkedSpeech();
          return true;
        }
        
        // Use speak-tts library only (no native fallback)
        let resumeSuccessful = false;
        
        try {
          if (this.speech && typeof this.speech.resume === 'function') {
            this.speech.resume();
            console.log(`[${this.serviceType} TTS] Successfully called speech.resume()`);
            this.speakingStartTime = Date.now(); // Reset speaking start time
            this.wasManuallyPaused = false; // Clear manual pause flag
            this.isPlaying = true;
            this.isPaused = false;
            resumeSuccessful = true;
          }
        } catch (resumeError) {
          console.warn(`[${this.serviceType} TTS] speak-tts resume failed:`, resumeError);
        }
        
        // Fallback: Restart from pause position
        if (!resumeSuccessful) {
          console.log(`[${this.serviceType} TTS] Resume failed, restarting from pause position`);
          setTimeout(() => {
            this.restartFromPausePosition();
          }, 100); // Small delay to ensure state is stable
          return true; // Consider this successful for our purposes
        }
        
        console.log(`[${this.serviceType} TTS] Resume operation completed - state:`, {
          isPlaying: this.isPlaying,
          isPaused: this.isPaused,
          resumeSuccessful: resumeSuccessful,
          position: `${this.pausePosition}/${this.fullText.length} (${Math.round((this.pausePosition / this.fullText.length) * 100)}%)`
        });
        
        return resumeSuccessful;
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
        
        // Record stop time before clearing state
        if (this.currentLessonId) {
          this.recordTTSStopTime(
            this.currentLessonId, 
            this.isChunkedSpeech ? this.currentChunkIndex : null, 
            'stop'
          );
        }
        
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
        this.pause();
        
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
      // this.isStoppingIntentionally = false; // Removed as per edit hint
      this.wasManuallyPaused = false;
      
      // Wait a moment for state to stabilize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Extract text from pause position
      const remainingText = this.fullText.substring(this.pausePosition);
      if (!remainingText || remainingText.trim().length === 0) {
        console.log(`[${this.serviceType} TTS] No remaining text to speak from pause position`);
        return true;
      }
      
      console.log(`[${this.serviceType} TTS] Speaking remaining text (${remainingText.length} characters) from position ${this.pausePosition}`);
      
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

  // Record TTS stop time to backend for chunk timing optimization
  async recordTTSStopTime(lessonId, chunkIndex = null, stopReason = 'manual') {
    try {
      const stopData = {
        lessonId: lessonId,
        serviceType: this.serviceType,
        stopTime: Date.now(),
        stopReason: stopReason,
        chunkIndex: chunkIndex,
        totalSpokenTime: this.totalSpokenTime,
        pausePosition: this.pausePosition,
        fullTextLength: this.fullText ? this.fullText.length : 0
      };

      console.log(`[${this.serviceType} TTS] Recording TTS stop time:`, stopData);

      const response = await fetch('/api/tts/record-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(stopData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[${this.serviceType} TTS] TTS stop time recorded successfully:`, result);
        return result;
      } else {
        console.warn(`[${this.serviceType} TTS] Failed to record TTS stop time:`, response.status);
        return null;
      }
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error recording TTS stop time:`, error);
      return null;
    }
  }

  // Get optimal chunk timing from backend
  async getOptimalChunkTiming(lessonId, chunkIndex) {
    try {
      const response = await fetch(`/api/tts/chunk-timing?lessonId=${lessonId}&chunkIndex=${chunkIndex}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const timing = await response.json();
        console.log(`[${this.serviceType} TTS] Retrieved optimal chunk timing:`, timing);
        return timing;
      } else {
        console.log(`[${this.serviceType} TTS] No optimal timing found for chunk ${chunkIndex}`);
        return null;
      }
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Error getting chunk timing:`, error);
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