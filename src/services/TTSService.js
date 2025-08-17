// src/services/TTSService.js

class TTSService {
  constructor() {
    this.speechSynthesis = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentText = '';
    this.currentLessonId = null;
    this.pausedAtChar = 0; // Track where we paused
    this.fullText = ''; // Store the full text for resume
    this.errorCount = 0; // Track consecutive errors
    this.maxRetries = 3; // Maximum retry attempts
  }

  // Get available voices
  getVoices() {
    return new Promise((resolve) => {
      let voices = this.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
      } else {
        this.speechSynthesis.onvoiceschanged = () => {
          voices = this.speechSynthesis.getVoices();
          resolve(voices);
        };
      }
    });
  }

  // Get preferred voice (English, female if available)
  async getPreferredVoice() {
    const voices = await this.getVoices();
    const englishVoices = voices.filter(voice => 
      voice.lang.startsWith('en') && voice.localService
    );
    
    // Prefer female voices for better clarity
    const femaleVoice = englishVoices.find(voice => 
      voice.name.toLowerCase().includes('female') || 
      voice.name.toLowerCase().includes('samantha') ||
      voice.name.toLowerCase().includes('victoria')
    );
    
    return femaleVoice || englishVoices[0] || voices[0];
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
    // Stop any current reading
    this.stop();
    
    if (!lesson || !lesson.content) {
      console.warn('No lesson content to read');
      return false;
    }

    const text = this.extractLessonText(lesson.content);
    if (!text.trim()) {
      console.warn('No text content extracted from lesson');
      return false;
    }

    try {
      const voice = await this.getPreferredVoice();
      
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.voice = voice;
      this.currentUtterance.rate = 0.9; // Slightly slower for better comprehension
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.volume = 1.0;
      this.currentText = text;
      this.currentLessonId = lessonId;
      this.fullText = text;
      this.pausedAtChar = 0;
      this.errorCount = 0; // Reset error count for new reading
      
      // Set up event handlers
      this.currentUtterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
        this.errorCount = 0; // Reset error count on successful start
        console.log('TTS started reading lesson:', lesson.title);
      };
      
      this.currentUtterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.pausedAtChar = 0;
        this.errorCount = 0; // Reset error count on successful completion
        console.log('TTS finished reading lesson:', lesson.title);
      };
      
      this.currentUtterance.onerror = (event) => {
        console.error('TTS error:', event.error);
        this.errorCount++;
        
        // Handle specific error types
        if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log('TTS was interrupted or canceled, checking if this is a false positive');
          
          // Check if this is a false positive by examining the actual speech synthesis state
          const actualSpeaking = this.isActuallySpeaking();
          const ttsActive = this.isTTSActive();
          
          // If TTS is still active, this might be a false positive
          if (ttsActive) {
            console.log('TTS interrupted error appears to be false positive - TTS is still active');
            // Don't change state, let the stable status method handle it
            return;
          }
          
          // Only treat as real interruption if TTS is actually stopped
          console.log('TTS was genuinely interrupted, going to pause state');
          this.currentUtterance = null;
          this.pausedAtChar = 0;
          // Don't reset error count for interruptions as they're expected
        } else if (event.error === 'not-allowed') {
          console.log('TTS not allowed, user may need to interact with page first');
          this.isPlaying = false;
          this.isPaused = false;
          this.currentUtterance = null;
          this.pausedAtChar = 0;
        } else {
          // For other errors, try to recover if we haven't exceeded max retries
          if (this.errorCount < this.maxRetries) {
            console.log(`TTS error, attempting retry ${this.errorCount}/${this.maxRetries}`);
            setTimeout(() => {
              this.restartFromBeginning();
            }, 1000);
          } else {
            console.log('TTS max retries exceeded, stopping');
            this.isPlaying = false;
            this.isPaused = false;
            this.currentUtterance = null;
            this.pausedAtChar = 0;
          }
        }
      };
      
      this.speechSynthesis.speak(this.currentUtterance);
      return true;
      
    } catch (error) {
      console.error('Error starting TTS:', error);
      this.isPlaying = false;
      this.isPaused = false;
      return false;
    }
  }

  // Pause reading
  pause() {
    if (this.isPlaying && !this.isPaused) {
      try {
        // Try to pause using the API
        this.speechSynthesis.pause();
        this.isPaused = true;
        this.isPlaying = false; // Ensure we're not in playing state when paused
        console.log('TTS paused');
      } catch (error) {
        console.warn('Pause failed, stopping instead:', error);
        // Fallback: stop and remember position
        this.stop();
        this.isPaused = true;
      }
    }
  }

  // Resume reading
  resume() {
    if (this.isPaused && this.fullText) {
      try {
        // Try to resume using the API first
        this.speechSynthesis.resume();
        this.isPaused = false;
        this.isPlaying = true;
        console.log('TTS resumed');
      } catch (error) {
        console.warn('Resume failed, restarting from beginning:', error);
        // Fallback: restart from beginning
        this.restartFromBeginning();
      }
    } else if (this.isPaused && !this.fullText) {
      // If we're paused but don't have full text, try to restart
      console.log('TTS resume: no full text, trying to restart');
      this.restartFromBeginning();
    }
  }

  // Restart from beginning (fallback for resume)
  async restartFromBeginning() {
    if (!this.fullText || !this.currentLessonId) {
      console.warn('TTS restart: missing fullText or currentLessonId');
      this.isPlaying = false;
      this.isPaused = false;
      return;
    }
    
    try {
      // Cancel any current utterance first
      if (this.currentUtterance) {
        this.speechSynthesis.cancel();
      }
      
      const voice = await this.getPreferredVoice();
      
      this.currentUtterance = new SpeechSynthesisUtterance(this.fullText);
      this.currentUtterance.voice = voice;
      this.currentUtterance.rate = 0.9;
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.volume = 1.0;
      this.pausedAtChar = 0;
      
      // Set up event handlers
      this.currentUtterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
        console.log('TTS restarted reading');
      };
      
      this.currentUtterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.pausedAtChar = 0;
        console.log('TTS finished reading');
      };
      
      this.currentUtterance.onerror = (event) => {
        console.error('TTS error:', event.error);
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.pausedAtChar = 0;
        
        // Handle specific error types
        if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log('TTS was interrupted or canceled, going to pause state');
          this.isPaused = true; // Set to pause state instead of stopping
        } else if (event.error === 'not-allowed') {
          console.log('TTS not allowed, user may need to interact with page first');
        }
      };
      
      this.speechSynthesis.speak(this.currentUtterance);
    } catch (error) {
      console.error('Error restarting TTS:', error);
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  // Check if resume is possible
  canResume() {
    return this.isPaused && this.fullText && this.currentLessonId;
  }

  // Stop reading completely
  stop() {
    if (this.currentUtterance) {
      this.speechSynthesis.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.currentText = '';
      this.currentLessonId = null;
      this.pausedAtChar = 0;
      this.fullText = '';
      this.errorCount = 0; // Reset error count on stop
      console.log('TTS stopped');
    }
  }

  // Check if TTS is supported
  isSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  // Get current status
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentLessonId: this.currentLessonId,
      isSupported: this.isSupported(),
      errorCount: this.errorCount
    };
  }

  // Check if TTS is actually speaking (more reliable than just checking state)
  isActuallySpeaking() {
    return this.speechSynthesis.speaking;
  }

  // More robust check for TTS activity
  isTTSActive() {
    const speaking = this.speechSynthesis.speaking;
    const paused = this.speechSynthesis.paused;
    const pending = this.speechSynthesis.pending;
    
    // TTS is active if it's speaking, paused, or has pending utterances
    return speaking || paused || pending || this.currentUtterance !== null;
  }

  // Get a more stable status that considers the actual speech synthesis state
  getStableStatus() {
    const actualSpeaking = this.isActuallySpeaking();
    const ttsActive = this.isTTSActive();
    const status = this.getStatus();
    
    // If the speech synthesis is actually speaking, we should be in playing state
    if (actualSpeaking && !status.isPlaying && !status.isPaused) {
      this.isPlaying = true;
      this.isPaused = false;
      return {
        ...status,
        isPlaying: true,
        isPaused: false
      };
    }
    
    // If TTS is active but not speaking, we might be paused
    if (ttsActive && !actualSpeaking && status.isPlaying) {
      // If we have full text and current lesson, we're probably paused
      if (this.fullText && this.currentLessonId) {
        // Double-check that we're not in a false positive state
        // Wait a bit longer before assuming we're paused
        setTimeout(() => {
          const stillNotSpeaking = !this.isActuallySpeaking();
          if (stillNotSpeaking && this.isPlaying) {
            this.isPlaying = false;
            this.isPaused = true;
          }
        }, 500);
        
        return {
          ...status,
          isPlaying: false,
          isPaused: true
        };
      }
    }
    
    // If TTS is not active at all, we're stopped
    if (!ttsActive && (status.isPlaying || status.isPaused)) {
      this.isPlaying = false;
      this.isPaused = false;
      return {
        ...status,
        isPlaying: false,
        isPaused: false
      };
    }
    
    return status;
  }
}

// Create singleton instance
const ttsService = new TTSService();

export default ttsService; 