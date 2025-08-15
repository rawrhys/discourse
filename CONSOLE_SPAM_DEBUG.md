# Console Spam Debug Guide

## Problem
The console is being flooded with service worker logs for API calls to `/api/user/current`, causing excessive console spam.

## Immediate Fixes Applied

### 1. Service Worker Log Throttling
- Added throttled logging to prevent repeated console messages
- Cache-related logs now only appear once per 5-30 seconds (depending on type)
- Added `CLEAR_LOG_THROTTLE` message handler to reset throttling

### 2. Enhanced API Debugging
- Created `APIDebugger` utility to monitor API call frequency
- Added performance monitoring for API calls
- Implemented stack trace analysis for frequent calls

## How to Debug

### Step 1: Check Current Status
```javascript
// In browser console
window.debugPerformance.analyzeAPIFrequency()
```

### Step 2: Monitor Specific API Endpoint
```javascript
// Monitor /api/user/current for 30 seconds
window.debugPerformance.monitorAPIEndpoint('/api/user/current', 30000)
```

### Step 3: Use API Debugger
```javascript
// Start monitoring all API calls
window.apiDebugger.startMonitoring()

// Wait for some time, then analyze
window.apiDebugger.analyzeCalls()

// Get summary
window.apiDebugger.getSummary()
```

### Step 4: Clear Service Worker Logs
```javascript
// Clear service worker log throttling
window.debugPerformance.clearServiceWorkerLogs()
```

## Common Causes

### 1. React StrictMode (Development)
- Components mount twice in development
- Check `src/main.jsx` for `<React.StrictMode>`
- This is normal in development but can cause double API calls

### 2. Browser Extensions
- Some extensions make frequent API calls
- Check browser developer tools for extension activity
- Disable extensions temporarily to test

### 3. Component Re-renders
- Components making API calls on every render
- Use `useEffect` with proper dependencies
- Implement proper memoization

### 4. Service Worker Issues
- Service worker logging every cached response
- Check `public/sw.js` for excessive logging
- Use throttled logging for cache operations

## Performance Commands

```javascript
// Comprehensive performance analysis
window.debugPerformance.profile()

// Analyze component renders
window.debugPerformance.analyzeRenders()

// Analyze API performance
window.debugPerformance.analyzeAPI()

// Monitor specific component
window.debugPerformance.monitorComponent('Dashboard', 10000)

// Get performance recommendations
window.debugPerformance.getRecommendations()
```

## Service Worker Messages

```javascript
// Send message to service worker
navigator.serviceWorker.ready.then(registration => {
  registration.active.postMessage({ type: 'CLEAR_LOG_THROTTLE' });
});
```

## Expected Results

After applying fixes:
- Console logs should be significantly reduced
- Cache-related logs should appear only once per 5-30 seconds
- API call frequency should be normal (not rapid polling)
- Service worker should still function but with minimal logging

## If Problem Persists

1. Check browser console for other sources of logs
2. Use `window.apiDebugger.analyzeCalls()` to identify frequent calls
3. Look for components with improper `useEffect` dependencies
4. Check for browser extensions or third-party scripts
5. Verify service worker is properly throttling logs

## Files Modified

- `public/sw.js` - Added log throttling
- `src/utils/performanceDebug.js` - Enhanced API monitoring
- `src/utils/apiDebugger.js` - New API debugging utility
- `src/main.jsx` - Imported debugging utilities 