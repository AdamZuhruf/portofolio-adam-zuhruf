const CACHE_NAME = 'adam-portfolio-3d-v11';
const ASSETS = [
  './',
  './index.html',
  './cv.html',
  './styles/tokens.css?v=4.1',
  './styles/main.css?v=4.1',
  './scripts/main.js?v=4.1',
  './scripts/cv.js?v=4.1',
  './scripts/hero-3d.js?v=4.0',
  './data/portfolio-data.js?v=4.0',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-First so code deploys & live CMS/GitHub sync always show newest content immediately
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
