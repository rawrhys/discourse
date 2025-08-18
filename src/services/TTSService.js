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

// Enhanced TTS Coordinator with better conflict resolution
class TTSCoordinator {
  constructor() {
    this.activeService = null;
    this.queue = [];
    this.isProcessing = false;
    this.lastActivity = Date.now();
  }

  // Request to use TTS - returns a promise that resolves when TTS is available
  async requestTTS(serviceId) {
    return new Promise((resolve) => {
      if (!this.activeService || this.activeService === serviceId) {
        // No conflict, can use TTS immediately
        this.activeService = serviceId;
        this.lastActivity = Date.now();
        resolve();
      } else {
        // Conflict - add to queue
        this.queue.push({ serviceId, resolve, timestamp: Date.now() });
        console.log(`[TTS Coordinator] Service ${serviceId} queued, waiting for ${this.activeService} to finish`);
      }
    });
  }

  // Release TTS control
  releaseTTS(serviceId) {
    if (this.activeService === serviceId) {
      this.activeService = null;
      this.lastActivity = Date.now();
      console.log(`[TTS Coordinator] Service ${serviceId} released TTS control`);
      
      // Process next in queue
      this.processQueue();
    }
  }

  // Process the queue with timeout handling
  processQueue() {
    if (this.queue.length > 0 && !this.activeService) {
      const now = Date.now();
      // Remove stale queue entries (older than 30 seconds)
      this.queue = this.queue.filter(item => now - item.timestamp < 30000);
      
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        this.activeService = next.serviceId;
        this.lastActivity = now;
        console.log(`[TTS Coordinator] Service ${next.serviceId} now has TTS control`);
        next.resolve();
      }
    }
  }

  // Force stop all TTS and clear queue
  forceStop() {
    this.activeService = null;
    this.queue = [];
    this.lastActivity = Date.now();
    console.log(`[TTS Coordinator] Force stopped all TTS`);
  }

  // Get current status
  getStatus() {
    return {
      activeService: this.activeService,
      queueLength: this.queue.length,
      lastActivity: this.lastActivity,
      isStale: Date.now() - this.lastActivity > 60000 // 1 minute
    };
  }

  // Clean up stale services
  cleanupStaleServices() {
    if (this.isStale()) {
      console.log(`[TTS Coordinator] Cleaning up stale service: ${this.activeService}`);
      this.forceStop();
    }
  }

  isStale() {
    return Date.now() - this.lastActivity > 60000; // 1 minute
  }
}

// Create global coordinator instance
const ttsCoordinator = new TTSCoordinator();

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
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
      
      const checkVoices = () => {
        try {
          if (!window.speechSynthesis) {
            console.warn(`[${this.serviceType} TTS] Speech synthesis not available`);
            return false;
          }
          
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            console.log(`[${this.serviceType} TTS] Voices loaded:`, voices.length);
            cleanup();
            resolve(voices);
            return true;
          }
        } catch (error) {
          console.warn(`[${this.serviceType} TTS] Error checking voices:`, error);
          // Don't throw, just return false to continue checking
        }
        return false;
      };
      
      // Start checking immediately
      if (checkVoices()) return;
      
      // Set up interval checking
      checkInterval = setInterval(() => {
        if (checkVoices()) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }, 200);
      
      // Also listen for voiceschanged event
      const handleVoicesChanged = () => {
        if (checkVoices()) {
          cleanup();
        }
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Timeout after 10 seconds (increased from 5)
      timeoutId = setTimeout(() => {
        console.log(`[${this.serviceType} TTS] Voice loading timeout - proceeding with available voices`);
        cleanup();
        
        // Try to get any available voices, even if empty
        try {
          const voices = window.speechSynthesis.getVoices();
          resolve(voices || []);
        } catch (error) {
          console.log(`[${this.serviceType} TTS] Error getting voices after timeout:`, error);
          resolve([]);
        }
      }, 10000);
    });
  }

  // Get initialization configuration based on attempt number
  getInitConfig() {
    const baseConfig = {
      'volume': 1,
      'splitSentences': true,
      'listeners': {
        'onvoiceschanged': (voices) => {
          console.log(`[${this.serviceType} TTS] Voices loaded:`, voices.length);
        },
        'onstart': () => {
          this.isPlaying = true;
          this.isPaused = false;
          console.log(`[${this.serviceType} TTS] Started speaking`);
        },
        'onend': () => {
          this.isPlaying = false;
          this.isPaused = false;
          console.log(`[${this.serviceType} TTS] Finished speaking`);
          ttsCoordinator.releaseTTS(this.serviceId);
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
          'splitSentences': false,
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

    // Request TTS control from coordinator
    await ttsCoordinator.requestTTS(this.serviceId);
    console.log(`[${this.serviceType} TTS] Got TTS control for reading lesson`);
    
    // Prevent multiple simultaneous read requests
    if (this.isPlaying) {
      console.warn(`[${this.serviceType} TTS] Already playing, ignoring new read request`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
    
    if (!lesson) {
      console.warn(`[${this.serviceType} TTS] No lesson provided to readLesson`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
    
    if (!lesson.content) {
      console.warn(`[${this.serviceType} TTS] No lesson.content provided to readLesson`);
      ttsCoordinator.releaseTTS(this.serviceId);
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
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
    
    if (typeof text !== 'string') {
      console.warn(`[${this.serviceType} TTS] Extracted text is not a string: ${typeof text} - lessonId: ${lessonId}`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
    
    if (!text.trim()) {
      console.warn(`[${this.serviceType} TTS] Extracted text is empty or only whitespace - lessonId: ${lessonId}, lesson title: ${lesson.title || 'unknown'}`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
    
    if (text.trim().length < 10) {
      console.warn(`[${this.serviceType} TTS] Extracted text too short (${text.trim().length} chars): "${text.trim()}" - lessonId: ${lessonId}`);
      ttsCoordinator.releaseTTS(this.serviceId);
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
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
  }

  // Enhanced speak method with better error handling
  async speak(text) {
    // Prevent multiple simultaneous speak calls
    if (this.isPlaying) {
      console.warn(`[${this.serviceType} TTS] Already playing, ignoring new speak request`);
      return;
    }
    
    // Prevent starting if we're stopping intentionally
    if (this.isStoppingIntentionally) {
      console.warn(`[${this.serviceType} TTS] Service is stopping intentionally, ignoring speak request`);
      return;
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
        ttsCoordinator.releaseTTS(this.serviceId);
        return;
      }
      
      if (typeof text !== 'string') {
        console.warn(`[${this.serviceType} TTS] Text is not a string:`, typeof text, text);
        this.isPlaying = false;
        this.isPaused = false;
        ttsCoordinator.releaseTTS(this.serviceId);
        return;
      }
      
      if (text.trim().length === 0) {
        console.warn(`[${this.serviceType} TTS] Text is empty or only whitespace`);
        this.isPlaying = false;
        this.isPaused = false;
        ttsCoordinator.releaseTTS(this.serviceId);
        return;
      }
      
      // Additional validation to ensure text is substantial
      if (text.trim().length < 5) {
        console.warn(`[${this.serviceType} TTS] Text too short to speak: "${text.trim()}"`);
        this.isPlaying = false;
        this.isPaused = false;
        ttsCoordinator.releaseTTS(this.serviceId);
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
            text: text,
            queue: false, // Don't queue, replace current speech
            listeners: {
              'onstart': () => {
                this.isPlaying = true;
                this.isPaused = false;
                console.log(`[${this.serviceType} TTS] Started speaking`);
              },
              'onend': () => {
                this.isPlaying = false;
                this.isPaused = false;
                console.log(`[${this.serviceType} TTS] Finished speaking`);
                ttsCoordinator.releaseTTS(this.serviceId);
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
                  ttsCoordinator.releaseTTS(this.serviceId);
                  resolve(); // Resolve gracefully for interruptions
                  return;
                }
                
                this.errorCount++;
                
                if (this.errorCount < this.maxRetries) {
                  console.log(`[${this.serviceType} TTS] Retrying after speech error... (${this.errorCount}/${this.maxRetries})`);
                  setTimeout(() => {
                    // Only retry if we have valid text to speak
                    if (this.fullText && this.fullText.trim().length > 5) {
                      this.speak(this.fullText).then(resolve);
                    } else {
                      console.warn(`[${this.serviceType} TTS] No valid text for retry, resolving gracefully`);
                      ttsCoordinator.releaseTTS(this.serviceId);
                      resolve();
                    }
                  }, 1000);
                } else {
                  console.log(`[${this.serviceType} TTS] Max retries exceeded after speech error`);
                  ttsCoordinator.releaseTTS(this.serviceId);
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
                  ttsCoordinator.releaseTTS(this.serviceId);
                  resolve(); // Resolve gracefully for intentional stops
                  return;
                }
                
                const errorType = this.categorizeError(error);
                
                // Handle interrupted errors more gracefully
                if (errorType === TTS_ERROR_TYPES.INTERRUPTED) {
                  console.log(`[${this.serviceType} TTS] Promise was interrupted/canceled, not counting as error`);
                  ttsCoordinator.releaseTTS(this.serviceId);
                  resolve(); // Resolve gracefully for interruptions
                  return;
                }
                
                this.errorCount++;
                
                if (this.errorCount < this.maxRetries) {
                  console.log(`[${this.serviceType} TTS] Retrying after promise rejection... (${this.errorCount}/${this.maxRetries})`);
                  this.isRetrying = true;
                  setTimeout(() => {
                    // Only retry if we have valid text to speak and we're not stopping intentionally
                    if (this.fullText && this.fullText.trim().length > 5 && !this.isStoppingIntentionally) {
                      console.log(`[${this.serviceType} TTS] Retrying with text length: ${this.fullText.trim().length}`);
                      this.speak(this.fullText).then(resolve);
                    } else {
                      console.warn(`[${this.serviceType} TTS] No valid text for retry or stopping intentionally (fullText: ${this.fullText ? this.fullText.length : 'undefined'}, isStopping: ${this.isStoppingIntentionally}), resolving gracefully`);
                      ttsCoordinator.releaseTTS(this.serviceId);
                      resolve();
                    }
                    this.isRetrying = false;
                  }, 1000);
                } else {
                  console.log(`[${this.serviceType} TTS] Max retries exceeded after promise rejection`);
                  ttsCoordinator.releaseTTS(this.serviceId);
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
            ttsCoordinator.releaseTTS(this.serviceId);
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
                ttsCoordinator.releaseTTS(this.serviceId);
                resolve();
              }
              this.isRetrying = false;
            }, 1000);
          } else {
            console.log(`[${this.serviceType} TTS] Max retries exceeded after speak error`);
            ttsCoordinator.releaseTTS(this.serviceId);
            resolve(); // Always resolve, never reject
          }
        }
      });

      // Use a timeout to prevent hanging
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn(`[${this.serviceType} TTS] Speak timeout, resolving gracefully`);
          this.isPlaying = false;
          this.isPaused = false;
          ttsCoordinator.releaseTTS(this.serviceId);
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
        ttsCoordinator.releaseTTS(this.serviceId);
        return;
      }
      
      this.errorCount++;
      
      // Handle the error gracefully without throwing
      if (this.errorCount < this.maxRetries) {
        console.log(`[${this.serviceType} TTS] Retrying after catch error... (${this.errorCount}/${this.maxRetries})`);
        this.isRetrying = true;
        setTimeout(() => {
          // Only retry if we have valid text to speak and we're not stopping intentionally
          if (this.fullText && this.fullText.trim().length > 5 && !this.isStoppingIntentionally) {
            console.log(`[${this.serviceType} TTS] Retrying with text length: ${this.fullText.trim().length}`);
            this.speak(this.fullText);
          } else {
            console.warn(`[${this.serviceType} TTS] No valid text for retry or stopping intentionally (fullText: ${this.fullText ? this.fullText.length : 'undefined'}, isStopping: ${this.isStoppingIntentionally}), releasing TTS`);
            ttsCoordinator.releaseTTS(this.serviceId);
          }
          this.isRetrying = false;
        }, 1000);
      } else {
        console.log(`[${this.serviceType} TTS] Max retries exceeded in catch block`);
        ttsCoordinator.releaseTTS(this.serviceId);
      }
    }
  }

  // Pause reading
  pause() {
    if (this.isPlaying && !this.isPaused && this.isInitialized) {
      try {
        // Reset error count to allow pause to work
        this.errorCount = 0;
        this.speech.pause();
        console.log(`[${this.serviceType} TTS] Paused`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Pause failed:`, error);
      }
    }
  }

  // Resume reading
  resume() {
    if (this.isPaused && !this.isPlaying && this.isInitialized) {
      try {
        // Reset error count to allow resume to work
        this.errorCount = 0;
        this.speech.resume();
        console.log(`[${this.serviceType} TTS] Resumed`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Resume failed:`, error);
      }
    }
  }

  // Stop reading completely
  stop() {
    if (this.isInitialized) {
      try {
        this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.errorCount = 0; // Reset error count when stopping
        
        // Clear current text but preserve fullText for potential retries
        this.currentText = '';
        this.currentLessonId = null;
        // Don't clear fullText here - it's needed for retries
        
        console.log(`[${this.serviceType} TTS] Stopped`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop failed:`, error);
      } finally {
        // Reset the flag after a short delay to allow error handling to complete
        setTimeout(() => {
          this.isStoppingIntentionally = false;
        }, 100);
      }
    }
  }

  // Stop and clear all text (for lesson changes)
  stopAndClear() {
    if (this.isInitialized) {
      try {
        this.isStoppingIntentionally = true; // Mark that we're stopping intentionally
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.errorCount = 0;
        
        // Clear all text when stopping for lesson changes
        this.currentText = '';
        this.currentLessonId = null;
        this.fullText = '';
        
        console.log(`[${this.serviceType} TTS] Stopped and cleared`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop and clear failed:`, error);
      } finally {
        // Reset the flag after a short delay to allow error handling to complete
        setTimeout(() => {
          this.isStoppingIntentionally = false;
        }, 100);
      }
    }
  }

  // Reset TTS state - useful for recovery from inconsistent states
  reset() {
    console.log(`[${this.serviceType} TTS] Resetting TTS state`);
    this.stop();
    
    // Cancel any ongoing speech synthesis
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel();
        console.log(`[${this.serviceType} TTS] Canceled ongoing speech synthesis during reset`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Failed to cancel speech synthesis during reset:`, error);
      }
    }
    
    // Release TTS control
    try {
      ttsCoordinator.releaseTTS(this.serviceId);
    } catch (error) {
      console.warn(`[${this.serviceType} TTS] Failed to release TTS during reset:`, error);
    }
  }

  // Stop and release TTS control (for external use)
  stopAndRelease() {
    this.stop();
    ttsCoordinator.releaseTTS(this.serviceId);
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

  // Force reinitialization
  async forceReinitialize() {
    console.log(`[${this.serviceType} TTS] Force reinitializing...`);
    this.isInitialized = false;
    this.initializationAttempts = 0;
    await this.initSpeech();
  }
}

// Create separate singleton instances for private and public courses
const privateTTSService = new TTSService('private');
const publicTTSService = new TTSService('public');

// Enhanced TTS Service Factory for session-specific instances
class TTSServiceFactory {
  constructor() {
    this.services = new Map(); // Store session-specific services
    this.cleanupInterval = null;
    this.startCleanupInterval();
  }

  // Get or create a TTS service for a specific session
  getService(sessionId, serviceType = 'session') {
    const key = `${serviceType}_${sessionId}`;
    
    if (!this.services.has(key)) {
      const service = new TTSService(`${serviceType}_${sessionId}`);
      this.services.set(key, service);
      console.log(`[TTS Factory] Created new TTS service for ${key}`);
    }
    
    return this.services.get(key);
  }

  // Clean up a specific session's TTS service
  cleanupService(sessionId, serviceType = 'session') {
    const key = `${serviceType}_${sessionId}`;
    const service = this.services.get(key);
    
    if (service) {
      service.stopAndRelease();
      this.services.delete(key);
      console.log(`[TTS Factory] Cleaned up TTS service for ${key}`);
    }
  }

  // Clean up all session services
  cleanupAllSessions() {
    for (const [key, service] of this.services.entries()) {
      if (key.startsWith('session_')) {
        service.stopAndRelease();
        this.services.delete(key);
      }
    }
    console.log(`[TTS Factory] Cleaned up all session TTS services`);
  }

  // Get all active services (for debugging)
  getActiveServices() {
    return Array.from(this.services.keys());
  }

  // Start cleanup interval to prevent memory leaks
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleServices();
    }, 300000); // Clean up every 5 minutes
  }

  // Clean up stale services
  cleanupStaleServices() {
    const now = Date.now();
    for (const [key, service] of this.services.entries()) {
      const status = service.getStatus();
      // Clean up services that haven't been used for 10 minutes
      if (now - service.lastActivity > 600000) {
        this.cleanupService(key.split('_')[1], key.split('_')[0]);
      }
    }
  }

  // Stop cleanup interval
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton factory instance
const ttsServiceFactory = new TTSServiceFactory();

// Export both services
export { privateTTSService, publicTTSService, ttsServiceFactory };

// Default export for backward compatibility (uses private service)
export default privateTTSService; 