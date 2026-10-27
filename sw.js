/* fff-hub sw · generat de tools/sync-catalog.mjs · fără cereri externe, fără importScripts.
   Atinge DOAR pagina principală a hub-ului și pagina de transparență (index, transparenta.html, manifest, icoane). Orice alt URL (/apps/…, depozitele, linkurile externe)
   trece neatins către rețea / către service worker-ul propriu al aplicației. */
'use strict';
var VERSION = "h0e39493b";
var PREFIX = 'fff-chiuta-hub-', CACHE = PREFIX + VERSION;
var SCOPE = new URL(self.registration.scope);
var SHELL = ['./', './index.html', './transparenta.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
var OWN = SHELL.map(function (u) { return new URL(u, SCOPE).pathname; });
OWN.push(new URL('./index.html', SCOPE).pathname);

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);
    var r = await fetch('./index.html', {cache: 'reload'});
    if (!r.ok) throw new Error('index.html ' + r.status);
    await c.put('./index.html', r.clone());
    await c.put('./', r);
    await Promise.all(SHELL.slice(2).map(function (u) { return c.add(new Request(u, {cache: 'reload'})).catch(function () {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// Doar pagina hub-ului: cache-first cu revalidare în fundal. Restul cererilor: nicio interceptare.
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin || OWN.indexOf(u.pathname) < 0) return;
  var nav = r.mode === 'navigate';
  var pageUrl = new URL(u.pathname === new URL('./transparenta.html', SCOPE).pathname ? './transparenta.html' : './index.html', SCOPE).href;
  var key = nav ? new Request(pageUrl) : r;
  function update() {
    return fetch(nav ? pageUrl : r, {cache: 'no-cache'}).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
        var cp = res.clone();
        return caches.open(CACHE).then(function (c) { return c.put(key, cp); }).then(function () { return res; });
      }
      return res;
    });
  }
  e.respondWith(caches.open(CACHE).then(function (c) { return c.match(key); }).then(function (hit) {
    if (hit) { e.waitUntil(update().catch(function () {})); return hit; }
    return update().catch(function () { return Response.error(); });
  }));
});
