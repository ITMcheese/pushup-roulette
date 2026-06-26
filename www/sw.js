// Calisthenics Roulette Service Worker
// Cache-first strategy for full offline support

const CACHE_NAME = 'calisthenics-roulette-v15';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/css/styles.css',
  '/js/app.js',
  '/js/roulette.js',
  '/js/workout.js',
  '/js/database.js',
  '/js/randomizer.js',
  '/js/storage.js',
  '/js/achievements.js',
  '/js/audio.js',
  '/js/stats.js',
  '/js/theme.js',
  '/js/group.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Space+Grotesk:wght@700&display=swap'
];

// Install: Pre-cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        // Don't fail install if CDN resources can't be fetched
        console.warn('Some assets failed to cache:', err);
        // Cache local assets only as fallback
        const localAssets = ASSETS_TO_CACHE.filter(url => !url.startsWith('http'));
        return cache.addAll(localAssets);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-first, network fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip WebRTC signaling requests (PeerJS server)
  const url = new URL(event.request.url);
  if (url.hostname === '0.peerjs.com' || url.pathname.includes('/peerjs/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version, but also update cache in background
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => { /* Network unavailable, that's fine */ })
        );
        return cachedResponse;
      }

      // Not in cache, try network
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && networkResponse.type !== 'opaque') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed and not in cache — return offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
