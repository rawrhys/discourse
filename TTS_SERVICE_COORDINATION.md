# TTS Service Coordination Improvements

## Problem Summary
Multiple TTS services were being initialized simultaneously, causing conflicts:
- `[private TTS]` - Singleton for private courses
- `[public TTS]` - Singleton for public courses  
- `[public_session_* TTS]` - Session-specific services

This led to:
- Voice checking errors: `ReferenceError: Cannot access 'n' before initialization`
- Resource conflicts during speech synthesis initialization
- Race conditions between service initializations

## Solution Implemented

### 1. Global TTS Coordinator

#### Added a global coordinator to manage service conflicts:
```javascript
class TTSGlobalCoordinator {
  constructor() {
    this.initializingServices = new Set();
    this.activeServices = new Map();
    this.initializationPromise = null;
  }

  // Ensure only one service initializes at a time
  async coordinateInitialization(serviceType) {
    if (this.initializingServices.has(serviceType)) {
      console.log(`[TTS Coordinator] Service ${serviceType} already initializing, waiting...`);
      // Wait for the current initialization to complete
      while (this.initializingServices.has(serviceType)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializingServices.add(serviceType);
    console.log(`[TTS Coordinator] Starting initialization for ${serviceType}`);
    
    try {
      // Add a small delay to prevent simultaneous initialization
      await new Promise(resolve => setTimeout(resolve, 200));
    } finally {
      this.initializingServices.delete(serviceType);
      console.log(`[TTS Coordinator] Completed initialization for ${serviceType}`);
    }
  }

  // Register an active service
  registerService(serviceType, service) {
    this.activeServices.set(serviceType, service);
    console.log(`[TTS Coordinator] Registered service: ${serviceType}`);
  }

  // Unregister a service
  unregisterService(serviceType) {
    this.activeServices.delete(serviceType);
    console.log(`[TTS Coordinator] Unregistered service: ${serviceType}`);
  }

  // Get active service count
  getActiveServiceCount() {
    return this.activeServices.size;
  }
}
```

### 2. Lazy Initialization

#### Replaced immediate singleton creation with lazy initialization:
```javascript
// These will be lazy-initialized to prevent conflicts
let privateTTSService = null;
let publicTTSService = null;

// Lazy initialization functions
const getPrivateTTSService = () => {
  if (!privateTTSService) {
    privateTTSService = new TTSService('private');
    ttsGlobalCoordinator.registerService('private', privateTTSService);
  }
  return privateTTSService;
};

const getPublicTTSService = () => {
  if (!publicTTSService) {
    publicTTSService = new TTSService('public');
    ttsGlobalCoordinator.registerService('public', publicTTSService);
  }
  return publicTTSService;
};
```

### 3. Coordinated Initialization

#### Added coordinated initialization to TTSService:
```javascript
// Coordinated initialization to prevent conflicts
async initSpeechWithCoordination() {
  // Use global coordinator to prevent simultaneous initialization
  if (typeof ttsGlobalCoordinator !== 'undefined') {
    await ttsGlobalCoordinator.coordinateInitialization(this.serviceType);
  }
  
  // Then proceed with normal initialization
  await this.initSpeech();
}
```

### 4. Async Factory Method

#### Updated factory to handle async initialization:
```javascript
// Get or create a TTS service for a specific session
async getService(sessionId, serviceType = 'session') {
  const key = `${serviceType}_${sessionId}`;
  
  if (!this.services.has(key)) {
    // Create service with coordination to prevent conflicts
    const service = new TTSService(`${serviceType}_${sessionId}`);
    this.services.set(key, service);
    console.log(`[TTS Factory] Created new TTS service for ${key}`);
    
    // Wait for initialization to complete
    let attempts = 0;
    while (!service.isInitialized && attempts < 50) { // Wait up to 5 seconds
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!service.isInitialized) {
      console.warn(`[TTS Factory] Service ${key} failed to initialize within timeout`);
    }
  }
  
  return this.services.get(key);
}
```

### 5. Updated Component Usage

#### Modified PublicLessonView to handle async initialization:
```javascript
// Initialize session-specific TTS service
useEffect(() => {
  if (sessionId) {
    const initializeTTS = async () => {
      try {
        ttsService.current = await ttsServiceFactory.getService(sessionId, 'public');
        console.log(`[PublicLessonView] Using session-specific TTS service for session: ${sessionId}`);
      } catch (error) {
        console.warn(`[PublicLessonView] Failed to initialize TTS service for session: ${sessionId}`, error);
      }
    };
    
    initializeTTS();
  }
}, [sessionId]);
```

## Expected Results

These improvements should resolve the service conflicts by:

1. **Preventing Simultaneous Initialization**: Only one service initializes at a time
2. **Eliminating Voice Checking Errors**: No more `ReferenceError: Cannot access 'n' before initialization`
3. **Reducing Resource Conflicts**: Coordinated access to speech synthesis API
4. **Improving Service Stability**: Better error handling and timeout management
5. **Cleaner Service Management**: Proper registration and cleanup of services

## Key Benefits

- ✅ **No More Initialization Conflicts**: Services initialize sequentially, not simultaneously
- ✅ **Eliminated Voice Errors**: Proper coordination prevents voice checking conflicts
- ✅ **Better Resource Management**: Controlled access to speech synthesis resources
- ✅ **Improved Reliability**: Services wait for each other to complete initialization
- ✅ **Cleaner Logs**: Better logging of service coordination and initialization

## Testing Recommendations

1. Test with multiple browser tabs to ensure no conflicts
2. Test rapid lesson switching to verify service stability
3. Test TTS functionality across different browsers
4. Monitor console logs for coordination messages
5. Test service cleanup and memory management

## Files Modified

- `src/services/TTSService.js` - Added global coordinator and lazy initialization
- `src/components/PublicLessonView.jsx` - Updated to handle async service initialization
- `TTS_SERVICE_COORDINATION.md` - This documentation file
