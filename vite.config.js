import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pwaServiceWorker = () => ({
  name: 'pwa-service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const buildAssets = Object.keys(bundle)
      .filter((fileName) => /\.(?:html|css|js)$/.test(fileName) && fileName !== 'sw.js')
      .map((fileName) => `/${fileName}`)
    const precacheUrls = [
      '/',
      '/index.html',
      '/manifest.webmanifest',
      '/pwa-192.png',
      '/pwa-512.png',
      '/rj-crest.png',
      ...buildAssets,
    ]
    const cacheName = `expiryapp-shell-${Date.now()}`
    const workerSource = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify([...new Set(precacheUrls)])};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('expiryapp-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
            );
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const isStaticAsset = ['script', 'style', 'image', 'font'].includes(request.destination);
  if (PRECACHE_URLS.includes(url.pathname) || isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true }))
        .then((cachedResponse) => cachedResponse || fetch(request))
    );
  }
});
`

    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: workerSource,
    })
  },
})

export default defineConfig({
  plugins: [react(), pwaServiceWorker()],
  base: '/',
})
