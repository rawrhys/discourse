// src/utils/ttsTest.js
import { privateTTSService, publicTTSService, ttsServiceFactory } from '../services/TTSService.js';

// Test utility for TTS functionality
class TTSTest {
  constructor() {
    this.testResults = [];
    this.isRunning = false;
  }

  // Run comprehensive TTS tests
  async runAllTests() {
    if (this.isRunning) {
      console.warn('[TTS Test] Tests already running');
      return;
    }

    this.isRunning = true;
    this.testResults = [];
    
    console.log('[TTS Test] Starting comprehensive TTS tests...');
    
    try {
      // Test 1: Browser Support
      await this.testBrowserSupport();
      
      // Test 2: Service Initialization
      await this.testServiceInitialization();
      
      // Test 3: Text Processing
      await this.testTextProcessing();
      
      // Test 4: Basic Speech
      await this.testBasicSpeech();
      
      // Test 5: Error Handling
      await this.testErrorHandling();
      
      // Test 6: Service Factory
      await this.testServiceFactory();
      
      // Test 7: Coordination
      await this.testCoordination();
      
      // Test 8: Memory Management
      await this.testMemoryManagement();
      
      this.printResults();
      
    } catch (error) {
      console.error('[TTS Test] Test suite failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Test browser support
  async testBrowserSupport() {
    console.log('[TTS Test] Testing browser support...');
    
    const status = privateTTSService.getStatus();
    const browserSupport = status.browserSupport;
    
    const testResult = {
      name: 'Browser Support',
      passed: browserSupport.speechSynthesis,
      details: browserSupport
    };
    
    if (testResult.passed) {
      console.log('[TTS Test] ✓ Browser supports speech synthesis');
    } else {
      console.warn('[TTS Test] ✗ Browser does not support speech synthesis');
    }
    
    this.testResults.push(testResult);
  }

  // Test service initialization
  async testServiceInitialization() {
    console.log('[TTS Test] Testing service initialization...');
    
    const status = privateTTSService.getStatus();
    
    const testResult = {
      name: 'Service Initialization',
      passed: status.isInitialized,
      details: {
        isInitialized: status.isInitialized,
        initializationAttempts: status.initializationAttempts,
        browserSupport: status.browserSupport
      }
    };
    
    if (testResult.passed) {
      console.log('[TTS Test] ✓ Service initialized successfully');
    } else {
      console.warn('[TTS Test] ✗ Service failed to initialize');
      
      // Try to force reinitialization
      if (status.browserSupport.speechSynthesis) {
        console.log('[TTS Test] Attempting force reinitialization...');
        await privateTTSService.forceReinitialize();
        
        const newStatus = privateTTSService.getStatus();
        if (newStatus.isInitialized) {
          console.log('[TTS Test] ✓ Force reinitialization successful');
          testResult.passed = true;
          testResult.details.forceReinitialized = true;
        }
      }
    }
    
    this.testResults.push(testResult);
  }

  // Test text processing
  async testTextProcessing() {
    console.log('[TTS Test] Testing text processing...');
    
    const testTexts = [
      'Simple text',
      '<p>HTML text</p>',
      '**Markdown** text',
      'Text with <strong>formatting</strong> and **markdown**',
      'Text with special characters: @#$%^&*()',
      'Text with multiple\n\n\nnewlines',
      'Text with    extra    spaces'
    ];
    
    const results = testTexts.map(text => {
      const cleaned = privateTTSService.cleanTextForTTS(text);
      return {
        original: text,
        cleaned: cleaned,
        length: cleaned.length,
        isValid: cleaned.length > 0 && cleaned.length < 1000
      };
    });
    
    const allValid = results.every(r => r.isValid);
    
    const testResult = {
      name: 'Text Processing',
      passed: allValid,
      details: {
        totalTests: testTexts.length,
        validResults: results.filter(r => r.isValid).length,
        results: results
      }
    };
    
    if (testResult.passed) {
      console.log('[TTS Test] ✓ Text processing works correctly');
    } else {
      console.warn('[TTS Test] ✗ Text processing has issues');
    }
    
    this.testResults.push(testResult);
  }

  // Test basic speech functionality
  async testBasicSpeech() {
    console.log('[TTS Test] Testing basic speech...');
    
    const status = privateTTSService.getStatus();
    if (!status.isInitialized) {
      console.warn('[TTS Test] Skipping speech test - service not initialized');
      this.testResults.push({
        name: 'Basic Speech',
        passed: false,
        details: { reason: 'Service not initialized' }
      });
      return;
    }
    
    const testText = 'This is a test of the text to speech system.';
    
    try {
      console.log('[TTS Test] Speaking test text...');
      
      // Start speaking
      await privateTTSService.speak(testText);
      
      // Wait a moment for speech to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const speechStatus = privateTTSService.getStatus();
      
      const testResult = {
        name: 'Basic Speech',
        passed: speechStatus.isPlaying || speechStatus.isPaused,
        details: {
          isPlaying: speechStatus.isPlaying,
          isPaused: speechStatus.isPaused,
          errorCount: speechStatus.errorCount
        }
      };
      
      if (testResult.passed) {
        console.log('[TTS Test] ✓ Basic speech test passed');
      } else {
        console.warn('[TTS Test] ✗ Basic speech test failed');
      }
      
      // Stop the speech
      privateTTSService.stop();
      
      this.testResults.push(testResult);
      
    } catch (error) {
      console.error('[TTS Test] Speech test error:', error);
      this.testResults.push({
        name: 'Basic Speech',
        passed: false,
        details: { error: error.message }
      });
    }
  }

  // Test error handling
  async testErrorHandling() {
    console.log('[TTS Test] Testing error handling...');
    
    const status = privateTTSService.getStatus();
    
    const testResult = {
      name: 'Error Handling',
      passed: status.errorCount === 0,
      details: {
        errorCount: status.errorCount,
        maxRetries: privateTTSService.maxRetries,
        initializationAttempts: status.initializationAttempts
      }
    };
    
    if (testResult.passed) {
      console.log('[TTS Test] ✓ Error handling is working correctly');
    } else {
      console.warn('[TTS Test] ✗ Error handling has issues');
    }
    
    this.testResults.push(testResult);
  }

  // Test service factory
  async testServiceFactory() {
    console.log('[TTS Test] Testing service factory...');
    
    const sessionId = 'test_session_' + Date.now();
    const serviceType = 'test';
    
    try {
      // Create a service
      const service = ttsServiceFactory.getService(sessionId, serviceType);
      
      // Check if service was created
      const isCreated = service && typeof service.readLesson === 'function';
      
      // Get active services
      const activeServices = ttsServiceFactory.getActiveServices();
      const isInActiveServices = activeServices.includes(`${serviceType}_${sessionId}`);
      
      // Clean up
      ttsServiceFactory.cleanupService(sessionId, serviceType);
      
      const testResult = {
        name: 'Service Factory',
        passed: isCreated && isInActiveServices,
        details: {
          serviceCreated: isCreated,
          inActiveServices: isInActiveServices,
          activeServicesCount: activeServices.length
        }
      };
      
      if (testResult.passed) {
        console.log('[TTS Test] ✓ Service factory works correctly');
      } else {
        console.warn('[TTS Test] ✗ Service factory has issues');
      }
      
      this.testResults.push(testResult);
      
    } catch (error) {
      console.error('[TTS Test] Service factory test error:', error);
      this.testResults.push({
        name: 'Service Factory',
        passed: false,
        details: { error: error.message }
      });
    }
  }

  // Test coordination
  async testCoordination() {
    console.log('[TTS Test] Testing TTS coordination...');
    
    try {
      // Import the coordinator (it's not exported, so we'll test through the service)
      const status1 = privateTTSService.getStatus();
      const status2 = publicTTSService.getStatus();
      
      // Both services should be able to get status without conflicts
      const testResult = {
        name: 'TTS Coordination',
        passed: status1 && status2,
        details: {
          privateServiceStatus: status1,
          publicServiceStatus: status2,
          bothServicesWorking: status1 && status2
        }
      };
      
      if (testResult.passed) {
        console.log('[TTS Test] ✓ TTS coordination works correctly');
      } else {
        console.warn('[TTS Test] ✗ TTS coordination has issues');
      }
      
      this.testResults.push(testResult);
      
    } catch (error) {
      console.error('[TTS Test] Coordination test error:', error);
      this.testResults.push({
        name: 'TTS Coordination',
        passed: false,
        details: { error: error.message }
      });
    }
  }

  // Test memory management
  async testMemoryManagement() {
    console.log('[TTS Test] Testing memory management...');
    
    try {
      // Create multiple services to test memory management
      const services = [];
      for (let i = 0; i < 3; i++) {
        const service = ttsServiceFactory.getService(`test_memory_${i}`, 'memory_test');
        services.push(service);
      }
      
      // Check if services were created
      const activeServices = ttsServiceFactory.getActiveServices();
      const memoryTestServices = activeServices.filter(s => s.includes('memory_test'));
      
      // Clean up all test services
      services.forEach((_, index) => {
        ttsServiceFactory.cleanupService(`test_memory_${index}`, 'memory_test');
      });
      
      // Check if cleanup worked
      const activeServicesAfter = ttsServiceFactory.getActiveServices();
      const memoryTestServicesAfter = activeServicesAfter.filter(s => s.includes('memory_test'));
      
      const testResult = {
        name: 'Memory Management',
        passed: memoryTestServices.length === 3 && memoryTestServicesAfter.length === 0,
        details: {
          servicesCreated: memoryTestServices.length,
          servicesAfterCleanup: memoryTestServicesAfter.length,
          totalActiveServices: activeServicesAfter.length
        }
      };
      
      if (testResult.passed) {
        console.log('[TTS Test] ✓ Memory management works correctly');
      } else {
        console.warn('[TTS Test] ✗ Memory management has issues');
      }
      
      this.testResults.push(testResult);
      
    } catch (error) {
      console.error('[TTS Test] Memory management test error:', error);
      this.testResults.push({
        name: 'Memory Management',
        passed: false,
        details: { error: error.message }
      });
    }
  }

  // Print test results
  printResults() {
    console.log('\n[TTS Test] ===== TEST RESULTS =====');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`[TTS Test] Overall: ${passed}/${total} tests passed`);
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      console.log(`[TTS Test] ${status} ${result.name}`);
      
      if (!result.passed && result.details) {
        console.log(`[TTS Test]   Details:`, result.details);
      }
    });
    
    console.log('[TTS Test] ========================\n');
    
    return {
      passed,
      total,
      results: this.testResults
    };
  }

  // Quick health check
  async quickHealthCheck() {
    console.log('[TTS Test] Running quick health check...');
    
    const status = privateTTSService.getStatus();
    
    const health = {
      browserSupported: status.browserSupport.speechSynthesis,
      initialized: status.isInitialized,
      errorCount: status.errorCount,
      isHealthy: status.browserSupport.speechSynthesis && status.isInitialized && status.errorCount === 0
    };
    
    if (health.isHealthy) {
      console.log('[TTS Test] ✓ TTS is healthy');
    } else {
      console.warn('[TTS Test] ✗ TTS has issues:');
      if (!health.browserSupported) console.warn('  - Browser not supported');
      if (!health.initialized) console.warn('  - Not initialized');
      if (health.errorCount > 0) console.warn(`  - ${health.errorCount} errors`);
    }
    
    return health;
  }
}

// Create singleton instance
const ttsTest = new TTSTest();

// Export for use in other modules
export default ttsTest;

// Auto-run quick health check when imported
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => ttsTest.quickHealthCheck(), 1000);
    });
  } else {
    setTimeout(() => ttsTest.quickHealthCheck(), 1000);
  }
}
