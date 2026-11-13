const CACHE_NAME = 'open-worship-cache-v7';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './chords.js',
    './dashboard.js',
    './projection.js',
    './manifest.json',
    './icon-70.png',
    './icon-144.png',
    './icon-150.png',
    './icon-192.png',
    './icon-310.png',
    './icon-512.png'
];

self.addEventListener('install', event => {
    // La nuova versione si attiva subito, senza aspettare la chiusura di tutte le schede
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    // Solo le richieste GET dell'app passano dalla cache; login e dati restano diretti
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// Tocco su una notifica: riporta in primo piano l'app (o la apre) e mostra l'avviso
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const avvisoId = event.notification.data && event.notification.data.avvisoId;
    const appUrl = new URL('./', self.registration.scope).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const client = windows.find(c => c.url.startsWith(appUrl));
        if (client) {
            await client.focus();
            client.postMessage({ type: 'open-avviso', id: avvisoId || null });
            return;
        }
        const target = avvisoId ? `${appUrl}?avviso=${encodeURIComponent(avvisoId)}` : appUrl;
        await self.clients.openWindow(target);
    })());
});
