/* Legacy PWA kill switch.
 * The current Vercel build does not register a service worker. This file replaces
 * any older /sw.js still installed on delivery devices, clears stale CacheStorage,
 * and unregisters itself so users always receive the current application.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));

    await self.registration.unregister();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
