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

  // Clean text for TTS (remove markdown, extra spaces, etc.)
  cleanTextForTTS(text) {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/### (.*?)\n/g, '$1. ') // Convert headers to sentences
      .replace(/## (.*?)\n/g, '$1. ')
      .replace(/# (.*?)\n/g, '$1. ')
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
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
      
      // Set up event handlers
      this.currentUtterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
        console.log('TTS started reading lesson:', lesson.title);
      };
      
      this.currentUtterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.pausedAtChar = 0;
        console.log('TTS finished reading lesson:', lesson.title);
      };
      
      this.currentUtterance.onerror = (event) => {
        console.error('TTS error:', event.error);
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.pausedAtChar = 0;
        
        // Handle specific error types
        if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log('TTS was interrupted or canceled, resetting state');
        } else if (event.error === 'not-allowed') {
          console.log('TTS not allowed, user may need to interact with page first');
        }
      };
      
      this.speechSynthesis.speak(this.currentUtterance);
      return true;
      
    } catch (error) {
      console.error('Error starting TTS:', error);
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
          console.log('TTS was interrupted or canceled, resetting state');
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
      isSupported: this.isSupported()
    };
  }
}

// Create singleton instance
const ttsService = new TTSService();

export default ttsService; 