const CACHE_NAME   = 'sir-v35';
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
  'css/theme-light.css',
  'css/theme-neon.css',
  'js/theme-mode.js',
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
  'js/ticket-tags.js',
  'js/push-config.js',
  'js/notify.js',
  'js/shared-notes.js',
  'js/inbox.js',
  'js/settings.js',
  'js/torpedos.js',
  'js/mascaras.js',
  'js/scripts.js',
  'js/historico.js',
  'js/timer.js',
  'js/data-loader.js',
  'js/layout-v2.js',
  'js/charts-v2.js',
  'js/siglas.js',
  'js/nodes.js',
  'js/personalizacao.js',
  'js/pinned.js',
  'js/qualidade.js',
  'js/backup.js',
  'js/app.js',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
];

/* Fica na raiz da pasta para controlar index.html e pages/ */

/* Install — pré-carrega ignorando o cache HTTP (sempre a versão nova) */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(SHELL_ASSETS.map(u =>
        cache.add(new Request(u, { cache: 'reload' })).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

/* Activate — apaga caches antigos e assume as páginas abertas */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Estratégia:
   - CSVs do GitHub raw → só rede (o app tem o snapshot offline no IndexedDB)
   - Arquivos do próprio app → REDE PRIMEIRO (sempre a versão mais nova);
     sem internet, usa a cópia guardada
   - Bibliotecas externas (ícones, zip, fontes) → cache primeiro */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (!url.startsWith('http')) return;
  if (url.includes('raw.githubusercontent.com')) return;

  const sameOrigin = new URL(url).origin === self.location.origin;

  if (sameOrigin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(r => r || caches.match('index.html'))
          .then(r => r || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
      }
      return resp;
    }))
  );
});

/* Clique numa notificação de ticket novo: traz o SIR para frente e abre o ticket */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    let client = all.find(c => c.url.includes('index.html') || c.url.endsWith('/')) || all[0];
    if (client) { try { await client.focus(); } catch (err) {} }
    else { client = await self.clients.openWindow('index.html'); }
    if (client) client.postMessage({ type: 'sir-notification-click', ...data });
  })());
});

/* Push do servidor (chega mesmo com o SIR fechado) */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'SIR', body: e.data ? e.data.text() : '' }; }
  const data = d.data || {};
  e.waitUntil(self.registration.showNotification(d.title || 'SIR · ticket novo', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: data.ticket ? 'sir-' + data.tk + '-' + data.ticket : 'sir-novos',
    renotify: true,
    requireInteraction: true,      /* PC: fica na tela até você fechar */
    silent: false,
    vibrate: [200, 100, 200],      /* Android */
    timestamp: Date.now(),
    data,
  }));
});
