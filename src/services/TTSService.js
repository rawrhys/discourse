// src/services/TTSService.js
import Speech from 'speak-tts';

// Global TTS Coordinator to prevent conflicts between multiple TTS services
class TTSCoordinator {
  constructor() {
    this.activeService = null;
    this.queue = [];
    this.isProcessing = false;
  }

  // Request to use TTS - returns a promise that resolves when TTS is available
  async requestTTS(serviceId) {
    return new Promise((resolve) => {
      if (!this.activeService || this.activeService === serviceId) {
        // No conflict, can use TTS immediately
        this.activeService = serviceId;
        resolve();
      } else {
        // Conflict - add to queue
        this.queue.push({ serviceId, resolve });
        console.log(`[TTS Coordinator] Service ${serviceId} queued, waiting for ${this.activeService} to finish`);
      }
    });
  }

  // Release TTS control
  releaseTTS(serviceId) {
    if (this.activeService === serviceId) {
      this.activeService = null;
      console.log(`[TTS Coordinator] Service ${serviceId} released TTS control`);
      
      // Process next in queue
      this.processQueue();
    }
  }

  // Process the queue
  processQueue() {
    if (this.queue.length > 0 && !this.activeService) {
      const next = this.queue.shift();
      this.activeService = next.serviceId;
      console.log(`[TTS Coordinator] Service ${next.serviceId} now has TTS control`);
      next.resolve();
    }
  }

  // Force stop all TTS and clear queue
  forceStop() {
    this.activeService = null;
    this.queue = [];
    console.log(`[TTS Coordinator] Force stopped all TTS`);
  }

  // Get current status
  getStatus() {
    return {
      activeService: this.activeService,
      queueLength: this.queue.length
    };
  }
}

// Create global coordinator instance
const ttsCoordinator = new TTSCoordinator();

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
    
    // Initialize the speech engine
    this.initSpeech();
  }

  // Initialize the speech engine
  async initSpeech() {
    try {
      await this.speech.init({
        'volume': 1,
        'lang': 'en-GB',
        'rate': 0.9,
        'pitch': 1,
        'voice': 'Google UK English Female', // British female voice
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
            console.error(`[${this.serviceType} TTS] Error:`, event);
            this.isPlaying = false;
            this.isPaused = false;
            this.errorCount++;
            
            // Handle errors gracefully
            if (this.errorCount < this.maxRetries) {
              console.log(`[${this.serviceType} TTS] Retrying... (${this.errorCount}/${this.maxRetries})`);
              setTimeout(() => {
                this.speak(this.currentText);
              }, 1000);
            } else {
              console.log(`[${this.serviceType} TTS] Max retries exceeded`);
              ttsCoordinator.releaseTTS(this.serviceId);
            }
          }
        }
      });
      
      this.isInitialized = true;
      console.log(`[${this.serviceType} TTS] Speech engine initialized successfully`);
    } catch (error) {
      console.error(`[${this.serviceType} TTS] Failed to initialize speech engine:`, error);
      this.isInitialized = false;
    }
  }

  // Enhanced text cleaning for TTS (remove markdown, extra spaces, etc.)
  cleanTextForTTS(text) {
    if (!text) return '';
    
    return text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Remove images, keep alt text
      
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
      
      // Remove any remaining special characters that might cause TTS issues
      .replace(/[^\w\s.,!?;:()'-]/g, '')
      
      .trim();
  }

  // Extract text content from lesson content
  extractLessonText(content) {
    if (!content) return '';
    
    let text = '';
    
    if (typeof content === 'string') {
      text = content;
    } else if (typeof content === 'object') {
      // Handle structured content
      const parts = [];
      if (content.introduction) parts.push(content.introduction);
      if (content.main_content) parts.push(content.main_content);
      if (content.conclusion) parts.push(content.conclusion);
      text = parts.join('\n\n');
    }
    
    return this.cleanTextForTTS(text);
  }

  // Start reading the lesson
  async readLesson(lesson, lessonId) {
    if (!this.isInitialized) {
      console.warn(`[${this.serviceType} TTS] Speech engine not initialized`);
      return false;
    }

    // Request TTS control from coordinator
    await ttsCoordinator.requestTTS(this.serviceId);
    console.log(`[${this.serviceType} TTS] Got TTS control for reading lesson`);
    
    // Stop any current reading
    this.stop();
    
    if (!lesson || !lesson.content) {
      console.warn(`[${this.serviceType} TTS] No lesson content to read`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }

    const text = this.extractLessonText(lesson.content);
    if (!text.trim()) {
      console.warn(`[${this.serviceType} TTS] No text content extracted from lesson`);
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }

    try {
      this.currentText = text;
      this.currentLessonId = lessonId;
      this.fullText = text;
      this.errorCount = 0;
      
      console.log(`[${this.serviceType} TTS] Starting to read lesson:`, lesson.title);
      await this.speak(text);
      return true;
      
    } catch (error) {
      console.error(`[${this.serviceType} TTS] Error starting TTS:`, error);
      this.isPlaying = false;
      this.isPaused = false;
      ttsCoordinator.releaseTTS(this.serviceId);
      return false;
    }
  }

  // Speak text using speak-tts
  async speak(text) {
    try {
      await this.speech.speak({
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
            console.error(`[${this.serviceType} TTS] Error:`, event);
            this.isPlaying = false;
            this.isPaused = false;
            this.errorCount++;
            
            if (this.errorCount < this.maxRetries) {
              console.log(`[${this.serviceType} TTS] Retrying... (${this.errorCount}/${this.maxRetries})`);
              setTimeout(() => {
                this.speak(this.currentText);
              }, 1000);
            } else {
              console.log(`[${this.serviceType} TTS] Max retries exceeded`);
              ttsCoordinator.releaseTTS(this.serviceId);
            }
          }
        }
      });
    } catch (error) {
      console.error(`[${this.serviceType} TTS] Error speaking:`, error);
      this.isPlaying = false;
      this.isPaused = false;
      ttsCoordinator.releaseTTS(this.serviceId);
    }
  }

  // Pause reading
  pause() {
    if (this.isPlaying && !this.isPaused && this.isInitialized) {
      try {
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
        this.speech.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.currentText = '';
        this.currentLessonId = null;
        this.fullText = '';
        this.errorCount = 0;
        console.log(`[${this.serviceType} TTS] Stopped`);
      } catch (error) {
        console.warn(`[${this.serviceType} TTS] Stop failed:`, error);
      }
    }
    
    // Release TTS control
    ttsCoordinator.releaseTTS(this.serviceId);
  }

  // Check if TTS is supported
  isSupported() {
    return this.isInitialized;
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
      isInitialized: this.isInitialized
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
}

// Create separate singleton instances for private and public courses
const privateTTSService = new TTSService('private');
const publicTTSService = new TTSService('public');

// TTS Service Factory for session-specific instances
class TTSServiceFactory {
  constructor() {
    this.services = new Map(); // Store session-specific services
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
      service.stop();
      this.services.delete(key);
      console.log(`[TTS Factory] Cleaned up TTS service for ${key}`);
    }
  }

  // Clean up all session services
  cleanupAllSessions() {
    for (const [key, service] of this.services.entries()) {
      if (key.startsWith('session_')) {
        service.stop();
        this.services.delete(key);
      }
    }
    console.log(`[TTS Factory] Cleaned up all session TTS services`);
  }

  // Get all active services (for debugging)
  getActiveServices() {
    return Array.from(this.services.keys());
  }
}

// Create singleton factory instance
const ttsServiceFactory = new TTSServiceFactory();

// Export both services
export { privateTTSService, publicTTSService, ttsServiceFactory };

// Default export for backward compatibility (uses private service)
export default privateTTSService; 