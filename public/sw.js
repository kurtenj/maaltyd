const CACHE_NAME = 'maaltyd-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Add paths to your main CSS files if they are not inlined or handled by JS bundling for index.html
  // e.g., '/src/index.css', '/src/App.css' - The build process might rename these,
  // so it's often better to cache them after seeing the build output or cache assets dynamically.
  // For now, let's assume Vite handles CSS bundling into JS or inline.
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  // Add paths to your main JS bundles. Vite usually produces these in an 'assets' folder.
  // We might need to adjust these paths after seeing the build output.
  // For a first pass, we can try to cache the entry point if its name is predictable
  // or rely on caching '/' and '/index.html' and letting the browser load other scripts.
  // A more robust approach uses tools like Workbox (via vite-plugin-pwa) to generate this list.
  // For now, let's keep it simple.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Optional: Add an activate event listener to clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
