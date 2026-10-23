#!/usr/bin/env node
// sync-catalog — sincronizează catalogul din index.html cu aplicațiile reale (fără dependențe externe).
//
//   node tools/sync-catalog.mjs [--root DIR] [--check] [--no-sw]
//
//   --root DIR   directorul care conține depozitele <Nume>/ (implicit: părintele hub-ului, adică ..)
//   --check      nu scrie nimic; cod de ieșire 1 dacă catalogul e desincronizat sau are probleme
//   --no-sw      nu regenerează sw.js
//
// Ce face (pentru fiecare card `data-c="apps|<Nume>|title"`):
//   1. versiunea și data de pe card = cele REALE din index.html-ul aplicației (<meta application-version> / <meta last-updated>);
//      dacă app.json sau fff-info diferă de meta, avertizează (rulează `fff-kit/build.mjs info`).
//   2. linkurile Live/ReadMe: forma canonică (hub: /apps/<Nume>/ și blob/main/apps/<Nume>/README.md; depozit:
//      https://chiuta.github.io/<Nume>/ și https://github.com/chiuta/<Nume>); verifică că există index.html / README.md.
//   3. „offline” în descrieri (cele 8 limbi): doar dacă aplicația chiar funcționează offline: sw.js există,
//      fff-info declară serviceWorker:true și egress-ul e gol. Excepții calificate în text: OFFLINE_QUALIFIED.
//   4. data din subsol (8 limbi) = cea mai recentă dată de actualizare; contorul de aplicații = numărul de carduri.
//   4b. atributele pentru căutarea/filtrarea din catalog, pe fiecare card: data-cat (secțiunea), data-langs (limbile interfeței din
//      app.json → features.i18n) și data-off (full = service worker + nicio cerere externă · part = service worker, dar unele funcții
//      cer internet · no = fără service worker). Gazda declarată în fff.config.json → cspSelfTest.host (autotest CSP intenționat,
//      ex. ACORDAJ → example.com) nu se numără ca dependență externă.
//   5. recalculează hash-urile CSP ale scripturilor inline și regenerează sw.js al hub-ului (precache index + manifest + icoane;
//      NU interceptează nimic altceva, deci linkurile către aplicații și către depozite rămân neatinse).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {recomputeCspHashes} from '../fff-kit/lib/csp.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = {check: argv.includes('--check'), noSw: argv.includes('--no-sw')};
const ri = argv.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(HUB, '..'));

// Aplicații cu „offline” calificat în text („nu e complet offline”, „snapshot învechit offline”): nu sunt oprite de regulă.
const LANG_ORDER = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const OFFLINE_QUALIFIED = new Set(['TerRa', 'VietAR', 'Pendulul']);   // Pendulul: fișierul salvat se citește offline; aplicația nu înregistrează service worker
const OFFLINE_RE = /offline|fără conexiune|hors ligne|hors-ligne|senza connessione|sin conexión|sem ligação|sem conexão|ohne verbindung|internet nélkül/i;

// Proiecte fără aplicație găzduită cu <meta application-version> (ex. motorul Rust ARMATURA: pagina lui este doar o prezentare, iar studioul rulează local).
// Valorile de mai jos sunt introduse manual: actualizează-le la fiecare lansare (versiunea din Cargo.toml, data ultimului commit relevant).
const EXTERNAL = {
  armatura: {version: '0.1.0', updated: '2026-10-24', langs: LANG_ORDER.slice(), off: 'no', live: 'https://armatura.chiuta.ro/'},
};

const read = (p) => fs.readFileSync(p, 'utf8');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const problems = [], changes = [];
const warn = (m) => problems.push(m);

const indexPath = path.join(HUB, 'index.html');
let html = read(indexPath);
const orig = html;

/* ---- CONTENT (descrieri în 8 limbi) ---- */
const cm = html.match(/const CONTENT=(\{[\s\S]*?\});\nfunction applyContent/);
if (!cm) throw new Error('nu găsesc `const CONTENT=` în index.html');
const CONTENT = vm.runInNewContext('(' + cm[1] + ')');

/* ---- surse de adevăr per aplicație ---- */
function metaOf(h, name) {
  const m = h.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i'));
  if (!m) return '';
  const c = m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i);
  return c ? (c[2] ?? c[3]) : '';
}
function locate(key) {
  const repo = path.join(ROOT, key), hub = path.join(HUB, 'apps', key);
  if (fs.existsSync(path.join(repo, 'index.html'))) return {dir: repo, pub: repo, hub: false};
  if (fs.existsSync(path.join(repo, 'docs', 'index.html'))) return {dir: repo, pub: path.join(repo, 'docs'), hub: false};   // GitHub Pages din /docs (ex. Pendulul)
  if (fs.existsSync(path.join(hub, 'index.html'))) return {dir: hub, pub: hub, hub: true};
  return null;
}
function truth(key) {
  const ext = EXTERNAL[key];
  if (ext) return {key, dir: path.join(ROOT, key), pub: path.join(ROOT, key), hub: false, version: ext.version, updated: ext.updated, egress: [], langs: ext.langs, off: ext.off, live: ext.live, swFile: false, swDecl: false, readme: true, hasApp: false};
  const loc = locate(key);
  if (!loc) return {key, missing: true};
  const h = read(path.join(loc.pub, 'index.html'));
  let app = null;
  for (const d of [loc.pub, loc.dir]) { try { app = JSON.parse(read(path.join(d, 'app.json'))); break; } catch { /* fără app.json aici */ } }
  const info = app || {};
  const version = metaOf(h, 'application-version') || info.version || '';
  const updated = metaOf(h, 'last-updated') || info.updated || '';
  if (app && app.version && version && app.version !== version) warn(`${key}: app.json spune v${app.version}, index.html v${version} (rulează fff-kit/build.mjs info)`);
  let cfg = {};
  try { cfg = JSON.parse(read(path.join(loc.dir, 'fff.config.json'))); } catch { /* fără fff.config.json */ }
  const selfTest = new Set([cfg.cspSelfTest, info.cspSelfTest].filter((x) => x && x.intentional && x.host).map((x) => x.host));
  const eg = (info.egress || []).map((e) => (typeof e === 'string' ? e : e.host)).filter((h) => !selfTest.has(h));
  const langs = (info.features && Array.isArray(info.features.i18n) ? info.features.i18n : []).filter((l) => LANG_ORDER.includes(l));
  const swFile = fs.existsSync(path.join(loc.pub, 'sw.js'));
  const swDecl = !!(info.features && info.features.pwa && info.features.pwa.serviceWorker);
  const off = swFile && swDecl ? (eg.length ? 'part' : 'full') : 'no';
  return {key, ...loc, version, updated, egress: eg, langs, off, swFile, swDecl, readme: fs.existsSync(path.join(loc.dir, 'README.md')), hasApp: !!app};
}

/* ---- carduri ---- */
const parts = html.split('<div class="app-card"');
const keys = [];
const lastSec = (txt, prev) => { const m = [...txt.matchAll(/<div class="sec-head[^"]*" id="([^"]+)"/g)]; return m.length ? m[m.length - 1][1] : prev; };
let curSec = lastSec(parts[0], '');
for (let i = 1; i < parts.length; i++) {
  const km = parts[i].match(/data-c="apps\|([^|"]+)\|title"/);
  if (!km) { warn(`card #${i} fără data-c="apps|…|title"`); continue; }
  const key = km[1];
  keys.push(key);
  const sec = curSec;
  curSec = lastSec(parts[i], curSec);   // secțiunea următoare începe după coada acestui card
  const t = truth(key);
  if (t.missing) { warn(`${key}: nu există ${ROOT}/${key}/index.html și nici apps/${key}/index.html`); continue; }
  if (!t.version) { warn(`${key}: fără versiune în index.html`); continue; }
  // 0. atribute de filtrare (idempotent)
  const attrs = ` data-cat="${sec}" data-langs="${t.langs.join(',')}" data-off="${t.off}"`;
  parts[i] = parts[i].replace(/^( data-cat="[^"]*")?( data-langs="[^"]*")?( data-off="[^"]*")?/, (m) => { if (m !== attrs) changes.push(`${key}: filtre${m ? '' : ' (nou)'} → ${sec} · ${t.langs.length} limbi · offline ${t.off}`); return attrs; });
  // 1. versiune + dată
  const want = `<span class="card-ver" data-ver="${t.version}" data-upd="${t.updated}">v${t.version} · ${t.updated}</span>`;
  parts[i] = parts[i].replace(/<span class="card-ver"[^>]*>[^<]*<\/span>/, (m) => { if (m !== want) changes.push(`${key}: ${m.replace(/<[^>]+>/g, '')} → v${t.version} · ${t.updated}`); return want; });
  if (!/<span class="card-ver"/.test(parts[i])) warn(`${key}: cardul nu are <span class="card-ver">`);
  // 2. linkuri
  const live = t.live || (t.hub ? `/apps/${key}/` : `https://chiuta.github.io/${key}/`);
  const rdm = t.hub ? `https://github.com/chiuta/chiuta.github.io/blob/main/apps/${key}/README.md` : `https://github.com/chiuta/${key}`;
  parts[i] = parts[i].replace(/(<a class="card-link live-link" href=")([^"]*)(")/, (m, a, h, c) => { if (h !== live) changes.push(`${key}: Live ${h} → ${live}`); return a + live + c; });
  parts[i] = parts[i].replace(/(<a class="card-link" href=")([^"]*)(")/, (m, a, h, c) => { if (h !== rdm) changes.push(`${key}: ReadMe ${h} → ${rdm}`); return a + rdm + c; });
  if (!t.readme) warn(`${key}: lipsește README.md în ${t.dir}`);
  // 3. „offline” doar unde e adevărat
  const claims = Object.keys(CONTENT).filter((l) => CONTENT[l].apps && CONTENT[l].apps[key] && OFFLINE_RE.test(CONTENT[l].apps[key].line || ''));
  if (claims.length && !OFFLINE_QUALIFIED.has(key)) {
    const why = [];
    if (!t.swFile) why.push('lipsește sw.js');
    if (t.hasApp && !t.swDecl) why.push('fff-info: serviceWorker:false');
    if (t.egress.length) why.push('egress: ' + t.egress.join(', '));
    if (why.length) warn(`${key}: descrierea (${claims.join(',')}) spune „offline”, dar ${why.join('; ')}`);
  }
}
html = parts.join('<div class="app-card"');
const uniq = new Set(keys);
if (uniq.size !== keys.length) warn(`carduri duplicate: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`);

/* ---- contor, dată în subsol ---- */
const dates = [...html.matchAll(/data-upd="(\d{4}-\d\d-\d\d)"/g)].map((m) => m[1]).sort();
const latest = dates[dates.length - 1];
if (latest) {
  const [Y, M, D] = latest.split('-'), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+M - 1];
  const before = html;
  html = html.replace(/(copyright:'[^']*?updated )\d+ \w+ \d{4}/, `$1${+D} ${mon} ${Y}`);
  html = html.replace(/(copyright:'[^']*?)(\d\d\.\d\d\.\d{4})(')/g, `$1${D}.${M}.${Y}$3`);
  html = html.replace(/(copyright:'[^']*?frissítve: )\d{4}\. \d\d\. \d\d\./, `$1${Y}. ${M}. ${D}.`);
  html = html.replace(/(data-i18n="copyright">[^<]*?)(\d\d\.\d\d\.\d{4})/, `$1${D}.${M}.${Y}`);
  if (html !== before) changes.push(`subsol: data → ${latest}`);
}
const nCards = keys.length;
html = html.replace(/(id="stat-repos">)\d+(<)/, (m, a, b) => { if (m !== `${a}${nCards}${b}`) changes.push(`contor aplicații → ${nCards}`); return `${a}${nCards}${b}`; });
for (const m of html.matchAll(/(\d+) free, open, single-file HTML tools/g)) if (+m[1] !== nCards) warn(`meta description spune ${m[1]} unelte, catalogul are ${nCards}`);

/* ---- CSP + sw.js ---- */
html = recomputeCspHashes(html).html;
const sha = (s) => createHash('sha256').update(s).digest('hex');

function swSource(version) {
  return `/* fff-hub sw · generat de tools/sync-catalog.mjs · fără cereri externe, fără importScripts.
   Atinge DOAR pagina principală a hub-ului și pagina de transparență (index, transparenta.html, manifest, icoane). Orice alt URL (/apps/…, depozitele, linkurile externe)
   trece neatins către rețea / către service worker-ul propriu al aplicației. */
'use strict';
var VERSION = ${JSON.stringify(version)};
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
`;
}
const swPath = path.join(HUB, 'sw.js');
const swVersion = 'h' + sha(html).slice(0, 8);
const swNew = swSource(swVersion);
const swOld = fs.existsSync(swPath) ? read(swPath) : '';
if (!opt.noSw && swNew !== swOld) changes.push(`sw.js → ${swVersion}`);
if (!fs.existsSync(path.join(HUB, 'manifest.webmanifest'))) warn('lipsește manifest.webmanifest (rulează fff-kit/pwa/pwa.mjs apply)');
if (!/rel="manifest"/.test(html)) warn('index.html nu leagă manifestul');

/* ---- ieșire ---- */
changes.forEach((c) => console.log('schimbare  ' + c));
problems.forEach((p) => console.log('PROBLEMĂ    ' + p));
console.log(`${nCards} carduri · ${changes.length} schimbări · ${problems.length} probleme · cea mai recentă dată ${latest}`);
if (opt.check) process.exit(changes.length || problems.length ? 1 : 0);
if (html !== orig) fs.writeFileSync(indexPath, html);
if (!opt.noSw) fs.writeFileSync(swPath, swNew);
process.exit(problems.length ? 1 : 0);
