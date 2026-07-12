/* Daily Pulse service worker
   Strategy: NETWORK-FIRST for the app's own files (so you ALWAYS get the latest
   when online), with cache fallback so it still works fully offline. */
const CACHE = 'daily-pulse-v33';
const ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './workout-anims.js', './workout-plan.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Tapping a scheduled reminder notification focuses (or opens) the app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./index.html');
  }));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;                         // never cache POST (sync calls)
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;                     // skip fonts API / Sheet sync
  e.respondWith(
    fetch(e.request)
      .then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); } return res; })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
