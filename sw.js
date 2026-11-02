const CACHE_NAME   = 'sir-v6';
const SHELL_ASSETS = [
  './',
  'index.html',
  'pages/lock.html',
  'assets/manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'css/layout-v2.css',
  'css/mobile.css',
  'assets/icon.svg',
  'css/styles.css',
  'js/config.js',
  'js/utils.js',
  'js/db.js',
  'js/state.js',
  'js/csv-worker.js',
  'js/ui.js',
  'js/persistence.js',
  'js/dashboard.js',
  'js/modal.js',
  'js/whatsapp-copy.js',
  'js/inbox.js',
  'js/settings.js',
  'js/torpedos.js',
  'js/mascaras.js',
  'js/scripts.js',
  'js/historico.js',
  'js/timer.js',
  'js/data-loader.js',
  'js/layout-v2.js',
  'js/siglas.js',
  'js/personalizacao.js',
  'js/pinned.js',
  'js/qualidade.js',
  'js/backup.js',
  'js/app.js',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
];

/* Fica na raiz da pasta para controlar index.html e pages/ */

/* Install — pre-cache all shell assets */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

/* Activate — purge old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - GitHub raw CSVs → network-only (IDB snapshot handles offline)
   - Everything else → cache-first, update cache in background */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.startsWith('chrome-extension') || url.startsWith('data:')) return;

  /* CSV sources: let the network handle it; IDB fallback is in the app */
  if (url.includes('raw.githubusercontent.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => null);

      return cached || networkFetch.then(r => r || Response.error());
    })
  );
});
