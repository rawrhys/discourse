// Optimized Service Worker for React App
const CACHE_NAME = 'react-app-v1';
const IMAGE_CACHE_NAME = 'image-cache-v1';
const STATIC_CACHE_NAME = 'static-cache-v1';

// Throttled logging to prevent console spam
const LOG_THROTTLE = {
  cache: new Map(),
  throttle: (key, message, delay = 5000) => {
    const now = Date.now();
    const lastLog = LOG_THROTTLE.cache.get(key);
    
    if (!lastLog || (now - lastLog) > delay) {
      console.log(message);
      LOG_THROTTLE.cache.set(key, now);
    }
  },
  clear: () => LOG_THROTTLE.cache.clear()
};

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  STATIC: 'static',
  // Network first for API calls
  API: 'api',
  // Cache first for images
  IMAGE: 'image',
  // Stale while revalidate for dynamic content
  DYNAMIC: 'dynamic'
};

// File extensions to cache
const STATIC_EXTENSIONS = [
  '.js', '.css', '.html', '.json', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/courses',
  '/api/lessons',
  '/api/modules'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets...');
      return cache.addAll([
        '/',
        '/index.html',
        '/static/js/bundle.js',
        '/static/css/main.css'
      ]);
    }).catch((error) => {
      console.warn('[SW] Failed to cache static assets:', error);
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - handle different types of requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticRequest(request)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) ||
         url.pathname.includes('/images/') ||
         url.pathname.includes('/img/');
}

// Check if request is for an API endpoint
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         url.pathname.includes('/api-proxy.php/api/');
}

// Check if request is for a static asset
function isStaticRequest(request) {
  const url = new URL(request.url);
  return STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname.startsWith('/static/') ||
         url.pathname.startsWith('/assets/');
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
      // Throttled logging for image caching
      LOG_THROTTLE.throttle('image-cache', '[SW] Image cached: ' + request.url, 10000);
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Image request failed:', request.url, error);
    throw error;
  }
}

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const responseToCache = response.clone();
        cache.put(request, responseToCache);
        // Throttled logging for API caching
        LOG_THROTTLE.throttle('api-cache', '[SW] API response cached: ' + request.url, 15000);
      }
      return response;
    } catch (fetchError) {
      // If network fails, try cache
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        LOG_THROTTLE.throttle('api-cache-fallback', '[SW] API served from cache (network failed): ' + request.url, 10000);
        return cachedResponse;
      }
      throw fetchError;
    }
  } catch (error) {
    console.warn('[SW] API request failed:', request.url, error);
    throw error;
  }
}

// Handle static asset requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
      // Throttled logging for static asset caching
      LOG_THROTTLE.throttle('static-cache', '[SW] Static asset cached: ' + request.url, 20000);
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Static request failed:', request.url, error);
    throw error;
  }
}

// Handle dynamic content with stale-while-revalidate strategy
async function handleDynamicRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Start fetching in background
    const fetchPromise = fetch(request).then(async (response) => {
      if (response.ok) {
        const responseToCache = response.clone();
        cache.put(request, responseToCache);
        // Throttled logging for dynamic content caching
        LOG_THROTTLE.throttle('dynamic-cache', '[SW] Dynamic content cached: ' + request.url, 30000);
      }
    }).catch((error) => {
      console.warn('[SW] Background fetch failed:', request.url, error);
    });
    
    // Return cached response if available, otherwise wait for fetch
    if (cachedResponse) {
      // Throttled logging for dynamic content serving
      LOG_THROTTLE.throttle('dynamic-serve', '[SW] Dynamic content served from cache: ' + request.url, 30000);
      return cachedResponse;
    }
    
    // Wait for fetch to complete
    await fetchPromise;
    const freshResponse = await cache.match(request);
    if (freshResponse) {
      return freshResponse;
    }
    
    // If all else fails, try network
    return fetch(request);
  } catch (error) {
    console.warn('[SW] Dynamic request failed:', request.url, error);
    throw error;
  }
}

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    console.log('[SW] Performing background sync...');
    
    // Sync any pending requests
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
          LOG_THROTTLE.throttle('background-sync', '[SW] Background sync updated: ' + request.url, 10000);
        }
      } catch (error) {
        console.warn('[SW] Background sync failed for:', request.url, error);
      }
    }
    
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_INFO':
      event.ports[0].postMessage({
        type: 'CACHE_INFO',
        data: {
          cacheNames: ['STATIC_CACHE', 'IMAGE_CACHE', 'API_CACHE'],
          version: '1.0.0'
        }
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'CLEAR_LOG_THROTTLE':
      LOG_THROTTLE.clear();
      event.ports[0].postMessage({ type: 'LOG_THROTTLE_CLEARED' });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('[SW] All caches cleared');
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service worker loaded and ready'); 