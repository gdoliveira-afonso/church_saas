const CACHE_NAME = 'gc-pwa-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/api/public/settings/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    // Strategy: Network First, fallback to cache
    if (event.request.method === 'GET' && !event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
    }
});
