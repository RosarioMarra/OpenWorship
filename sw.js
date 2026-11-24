const CACHE_NAME = 'open-worship-cache-v16';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './scalette.js',
    './chords.js',
    './dashboard.js',
    './projection.js',
    './manifest.json',
    './immagini/icon-70.png',
    './immagini/icon-144.png',
    './immagini/icon-150.png',
    './immagini/icon-192.png',
    './immagini/icon-310.png',
    './immagini/icon-512.png',
    './immagini/icon-maskable-192.png',
    './immagini/icon-maskable-512.png',
    './immagini/icon-badge.png'
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
        // no-cache: chiede sempre al server se il file è cambiato, così gli aggiornamenti arrivano subito
        fetch(event.request, { cache: 'no-cache' }).catch(() => caches.match(event.request))
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

// Notifica push inviata dal server (arriva anche con l'app chiusa)
self.addEventListener('push', event => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
    const title = d.title || 'Open Worship';
    event.waitUntil(self.registration.showNotification(title, {
        body: d.body || '',
        // su Android il logo c'è già a sinistra: niente immagine grande ripetuta a destra
        ...(/Android/i.test(self.navigator.userAgent) ? {} : { icon: 'immagini/icon-192.png' }),
        badge: 'immagini/icon-badge.png',
        lang: 'it',
        tag: d.avvisoId ? 'avviso-' + d.avvisoId : 'ow-push',
        data: { avvisoId: d.avvisoId || null }
    }));
});
