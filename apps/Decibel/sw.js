/* Decibel — service worker de ieșire. Aplicația s-a mutat pe https://decibel.chiuta.ro/ ; acest worker șterge cache-urile vechi și se dezînregistrează. */
'use strict';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return k.indexOf('fff-decibel-') === 0; }).map(function (k) { return caches.delete(k); })); } catch (x) { /* ignorat */ }
    try { await self.registration.unregister(); } catch (x) { /* ignorat */ }
  })());
});
