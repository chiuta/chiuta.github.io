#!/usr/bin/env node
// fff-kit / PWA — mod instalabil OPȚIONAL pentru aplicațiile „fără frontiere”.
// Utilizare:
//   node pwa.mjs apply  <dir> --slug S [--name N] [--short N] [--theme #hex] [--bg #hex] [--scope ./]
//                              [--mono XX] [--categories a,b] [--force] [--force-quine] [--no-icons]
//   node pwa.mjs check  <dir>
//   node pwa.mjs remove <dir>
// `index.html` rămâne funcțional singur (inclusiv din file://); fișierele alăturate îl fac instalabil prin https/localhost.
// Fără dependențe externe la rulare (Playwright doar pentru generarea icoanelor, la build).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {recomputeCspHashes, checkCspHashes, cspMeta, setCspDirective} from '../lib/csp.mjs';

const START_RE = /<!--fff:pwa:start([^>]*)-->/;
const BLOCK_RE = /[ \t]*<!--fff:pwa:start[^>]*-->[\s\S]*?<!--fff:pwa:end-->[ \t]*\r?\n?/;
const SW_HEADER = '/* fff-pwa v1';
const FILES = {manifest: 'manifest.webmanifest', sw: 'sw.js', i192: 'icon-192.png', i512: 'icon-512.png', imask: 'icon-maskable-512.png'};
const CSP_DIRS = ['manifest-src', 'worker-src', 'img-src'];
const NEUTRAL = '#1f2933';
const CATEGORIES = new Set('books business education entertainment finance fitness food games government health kids lifestyle magazines medical music navigation news personalization photo politics productivity security shopping social sports travel utilities weather'.split(' '));

/* ───────────── utilitare HTML ───────────── */

/** Înlocuiește cu spații conținutul <script>/<style>/comentariilor (păstrează lungimea → indici valizi). */
export function scrub(html) {
  return html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, m => m.replace(/[^\n]/g, ' '));
}

/** Indexul real al lui </head> (ignoră „</head>” din șiruri JS). */
export function headClose(html) {
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/head\s*>|<body\b/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/^<\/head/i.test(m[0]) || /^<body/i.test(m[0])) return m.index;
  }
  return -1;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const hexOk = h => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h || '');
const norm6 = h => { h = h.toLowerCase(); return h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h; };
const lum = h => { h = norm6(h); const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

function metaContent(headS, name) {
  const re = new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i');
  const m = headS.match(re); if (!m) return null;
  const c = m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i);
  return c ? unesc(c[2] ?? c[3]) : null;
}

/* ───────────── CSP ───────────── */

function cspParts(html) {
  const meta = cspMeta(html); if (!meta) return null;
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  return cm[2] ?? cm[3];
}
function dirMap(content) {
  const out = {};
  for (const part of content.split(';')) {
    const t = part.trim().split(/\s+/).filter(Boolean);
    if (t.length) out[t[0].toLowerCase()] = t.slice(1);
  }
  return out;
}
export function getDirective(html, name) {
  const c = cspParts(html); if (c == null) return undefined;
  const d = dirMap(c); return d[name] ? d[name].join(' ') : null;
}
function removeDirective(html, name) {
  const meta = cspMeta(html); if (!meta) return html;
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  const q = cm[1][0], content = cm[2] ?? cm[3];
  const nc = content.replace(new RegExp(`(^|;\\s*)${name}\\b[^;]*;?\\s*`), (m, p) => (p ? p : '')).replace(/;\s*$/, '');
  return html.replace(meta.tag, () => meta.tag.replace(cm[0], `content=${q}${nc}${q}`));
}
const keepSimple = t => t.filter(s => s === "'self'" || /^[a-z][a-z0-9+.-]*:$/i.test(s) || /^(\*|[a-z][a-z0-9+.-]*:\/\/|\*\.)/i.test(s));
/** Calculează noile surse: păstrează tot ce era permis, scoate 'none', adaugă 'self'. */
function computeSources(d, name) {
  let toks;
  if (d[name]) toks = d[name].filter(s => s !== "'none'");
  else {
    const fb = name === 'worker-src' ? (d['child-src'] ?? d['script-src'] ?? d['default-src']) : d['default-src'];
    toks = fb ? keepSimple(fb) : [];
  }
  if (!toks.includes("'self'") && !toks.includes('*')) toks.unshift("'self'");
  return toks.join(' ');
}

/* ───────────── marcaj ───────────── */
function parseMarker(html) {
  const m = html.match(START_RE); if (!m) return null;
  const d = m[1].match(/\bd=([A-Za-z0-9_-]+)/);
  if (!d) return {csp: {}, made: []};
  try { return JSON.parse(Buffer.from(d[1], 'base64url').toString('utf8')); } catch { return {csp: {}, made: []}; }
}
const encMarker = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

const canon = c => c.replace(/'sha256-[^']+'/g, '').split(';').map(x => x.trim().split(/\s+/).filter(Boolean).sort().join(' ')).filter(Boolean).sort().join(';');
function replaceCspContent(html, content) {
  const meta = cspMeta(html); if (!meta) return html;
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  const q = cm[1][0];
  return html.replace(meta.tag, () => meta.tag.replace(cm[0], () => `content=${q}${content}${q}`));
}
/** Scoate blocul și restaurează CSP-ul original. Returnează {html, meta}. */
function stripBlock(html) {
  const meta = parseMarker(html);
  if (!meta) return {html, meta: null};
  let h = html.replace(BLOCK_RE, '');
  if (cspMeta(h)) {
    for (const n of CSP_DIRS) {
      const prev = meta.csp?.[n];
      if (prev === undefined) continue;
      h = prev === null ? removeDirective(h, n) : setCspDirective(h, n, prev);
    }
    // restaurare exactă (spații/rânduri) dacă CSP-ul curent diferă de cel original doar prin formatare/ordinea hash-urilor
    const cur = cspParts(h);
    if (meta.orig != null && cur != null && canon(cur) === canon(meta.orig)) h = replaceCspContent(h, meta.orig);
    h = recomputeCspHashes(h).html;
  }
  return {html: h, meta};
}

/* ───────────── detectare ───────────── */
export function detect(html, dir) {
  const hs = scrub(html);
  const reasons = [];
  if (/<link\b[^>]*\brel=["']?manifest/i.test(hs) || /rel=["']manifest["']|application\/manifest\+json|\.webmanifest/i.test(html)) reasons.push('manifest propriu');
  if (/serviceWorker/.test(html)) reasons.push('service worker propriu');
  const quine = /quine/i.test(html) && /outerHTML/.test(html);
  for (const f of [FILES.manifest, FILES.sw]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && !(f === FILES.sw && fs.readFileSync(p, 'utf8').startsWith(SW_HEADER)) && !(f === FILES.manifest && fs.readFileSync(p, 'utf8').includes('"x_fff_pwa"')))
      reasons.push(`fișier propriu ${f}`);
  }
  return {own: reasons, quine};
}

/* ───────────── derivări ───────────── */
const STOP = new Set(['de', 'din', 'si', 'și', 'the', 'of', 'a', 'la', 'cu', 'in', 'în', 'and', '&', 'pe', 'un', 'o']);
function deriveName(title, slug) {
  let n = (title || '').replace(/\s+/g, ' ').trim();
  const segs = n.split(/\s[—–|·•:]\s|\s-\s/).map(s => s.replace(/\s+v\d+(\.\d+)*\b/gi, '').trim()).filter(Boolean);
  n = segs[0] || slug;
  const flat = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  // sigla de la început (ex. „ASFAN · Field Observer”) care nu are legătură cu slug-ul: se folosește segmentul următor
  if (segs[1] && /^[A-Z0-9]{2,6}$/.test(n) && !flat(slug).startsWith(flat(n))) n = segs[1];
  return n.length > 45 ? n.slice(0, 45).trim() : n;
}
function deriveShort(name) {
  let s = name.replace(/\s+v\d+(\.\d+)*$/i, '').replace(/\s+(f[ăa]r[ăa]\s+(frontiere|cont))$/i, '').trim() || name;
  if (s.length <= 12) return s.replace(/[\s.&,:;-]+$/, '') || s;
  let words = s.split(' ');
  while (words.length > 1 && STOP.has(words[0].toLowerCase())) words.shift();
  let out = '';
  for (const w of words) { const t = out ? out + ' ' + w : w; if (t.length <= 12) out = t; else break; }
  out = out || words[0].slice(0, 12);
  while (true) { const ws = out.split(' '); if (ws.length > 1 && STOP.has(ws[ws.length - 1].toLowerCase())) { ws.pop(); out = ws.join(' '); } else break; }
  return out.replace(/[\s.&,:;-]+$/, '') || out;
}
function deriveMono(name) {
  let s = name.replace(/\s+(f[ăa]r[ăa]\s+(frontiere|cont))$/i, '');
  const stop = STOP;
  const words = s.split(/[\s._-]+/).filter(w => w && !stop.has(w.toLowerCase()) && /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return (name[0] || 'A').toUpperCase();
  const first = [...words[0]][0].toUpperCase();
  if (words.length === 1) return first;
  const second = [...words[1]][0].toUpperCase();
  return first + second;
}
function deriveColors(html, headS, o) {
  let theme = o.theme, src = 'argument';
  if (!theme) {
    for (const m of headS.matchAll(/<meta\b[^>]*\bname=["']theme-color["'][^>]*>/gi)) {
      const c = m[0].match(/\bcontent=["']([^"']*)["']/i);
      if (c && hexOk(c[1].trim())) { theme = c[1].trim(); src = 'theme-color'; break; }
    }
  }
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  let cssBg = null;
  const v = styles.match(/--(?:bg|background|bg0|bg-0|color-bg|surface|paper|ink)\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
  if (v && hexOk(v[1])) cssBg = v[1];
  else {
    const b = styles.match(/(?:^|[}\s,])(?:html|body)\s*(?:,\s*(?:html|body)\s*)?\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
    if (b && hexOk(b[1])) cssBg = b[1];
  }
  if (!theme) { if (cssBg) { theme = cssBg; src = 'css'; } else { theme = NEUTRAL; src = 'neutră'; } }
  const bg = o.bg && hexOk(o.bg) ? o.bg : (cssBg || theme);
  return {theme: norm6(theme), bg: norm6(bg), src, hadMeta: src === 'theme-color'};
}
function deriveCategories(slug, name) {
  const s = (slug + ' ' + name).toLowerCase();
  const rules = [
    [/(joc|game|sah|șah|belot|domino|mahjong|scopone|solitaire|zaruri|dame|remi|go-|arena|carti-de)/, ['games', 'entertainment']],
    [/(melod|muzic|music|frecv|frequen|calm|asmr|voice|ecoul|spectral|clopot)/, ['music', 'entertainment']],
    [/(univers|cosmos|eclips|astro|terra|horizon|aurora|constelar|orbit)/, ['education', 'lifestyle']],
    [/(horoscop|tarot|reiki|numerolog|radiest|bioenerg|afrodis|inforenerg|acordaj|akasha|vatra|oaza|profund|nemurir)/, ['lifestyle', 'education']],
    [/(regex|api|data|markdown|prompt|vault|crypt|translate|seo|host|outpost|surveyor|table|link|mind|detect)/, ['utilities', 'productivity']],
    [/(eter|indicativ|punte|echilibru|origami|urme|academi|ai-liber|vietar)/, ['education', 'utilities']],
    [/(arhiva|threads|x-fara|nota|valea|zicala|printre|vntv|cupa|sport)/, ['entertainment', 'lifestyle']],
  ];
  for (const [re, c] of rules) if (re.test(s)) return c;
  return ['utilities'];
}

/* ───────────── PNG / icoane ───────────── */
function pngSize(file) {
  try { const b = fs.readFileSync(file); if (b.length > 24 && b.toString('latin1', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch {}
  return null;
}
export function iconSvg({mono, bg, fg, maskable}) {
  const n = [...mono].length;
  const size = maskable ? [0, 210, 165, 120][n] ?? 110 : [0, 300, 232, 170][n] ?? 150;
  const ring = maskable ? '' : `<circle cx="256" cy="256" r="214" fill="none" stroke="${fg}" stroke-opacity=".22" stroke-width="8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${bg}"/>${ring}` +
    `<text x="256" y="256" text-anchor="middle" dominant-baseline="central" font-family="'DejaVu Sans','Liberation Sans',Arial,system-ui,sans-serif" font-weight="700" font-size="${size}" fill="${fg}">${esc(mono)}</text></svg>`;
}
let _browser = null;
export async function getBrowser() {
  if (_browser) return _browser;
  const require = createRequire('/opt/node-tools/package.json');
  const {chromium} = require('playwright');
  _browser = await chromium.launch({executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
  return _browser;
}
export async function closeBrowser() { if (_browser) { await _browser.close(); _browser = null; } }
async function renderPng(svg, size, out) {
  const b = await getBrowser();
  const page = await b.newPage({viewport: {width: size, height: size}, deviceScaleFactor: 1});
  await page.setContent(`<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({path: out, clip: {x: 0, y: 0, width: size, height: size}});
  await page.close();
}

/* ───────────── generare ───────────── */
function buildManifest(o) {
  return {
    name: o.name, short_name: o.short, description: o.description || undefined,
    id: './', start_url: './', scope: o.scope, display: 'standalone', lang: o.lang,
    background_color: o.bg, theme_color: o.theme, categories: o.categories,
    icons: [
      {src: FILES.i192, sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: FILES.i512, sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: FILES.imask, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
    x_fff_pwa: 1,
  };
}
export function buildSw({slug, version, scopeNote}) {
  const ver = String(version).replace(/[^0-9A-Za-z.+_]/g, '_');
  return `${SW_HEADER} · generat de fff-kit/pwa/pwa.mjs · fără cereri externe, fără importScripts */
'use strict';
var SLUG = ${JSON.stringify(slug)}, VERSION = ${JSON.stringify(ver)};
var PREFIX = 'fff-' + SLUG + '-', CACHE = PREFIX + VERSION;   // versiunea nu conține '-', deci sufixul de după ultimul '-' e versiunea
var SHELL = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);
    var r = await fetch('./index.html', {cache: 'reload'});
    if (!r.ok) throw new Error('index.html ' + r.status);
    await c.put('./index.html', r.clone());
    await c.put('./', r);
    await Promise.all(SHELL.map(function (u) { return c.add(new Request(u, {cache: 'reload'})).catch(function () {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) {
      var i = k.lastIndexOf('-');
      return i >= 0 && k.slice(0, i + 1) === PREFIX && k !== CACHE;   // doar cache-urile acestei aplicații
    }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// Cache-first cu revalidare în fundal (stale-while-revalidate) pentru resursele de aceeași origine.
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin || /\\/sw\\.js$/.test(u.pathname)) return;
  var nav = r.mode === 'navigate';
  var key = nav ? new Request(u.origin + u.pathname) : r;
  function update() {
    return fetch(nav ? u.href : r, {cache: 'no-cache'}).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
        var cp = res.clone();
        return caches.open(CACHE).then(function (c) { return c.put(key, cp); }).then(function () { return res; });
      }
      return res;
    });
  }
  e.respondWith(caches.open(CACHE).then(function (c) { return c.match(key); }).then(function (hit) {
    if (hit) { e.waitUntil(update().catch(function () {})); return hit; }
    return update().catch(function () {
      if (nav && /(\\/|index\\.html)$/.test(u.pathname)) return caches.open(CACHE).then(function (c) { return c.match('./index.html'); });
      return Response.error();
    });
  }));
});
`;
}

function buildBlock(o, markerData) {
  const L = [`<!--fff:pwa:start v=1 d=${encMarker(markerData)}-->`, '<link rel="manifest" href="manifest.webmanifest">'];
  if (!o.hadTheme) L.push(`<meta name="theme-color" content="${o.theme}">`);
  if (!o.hadIcon) L.push('<link rel="icon" type="image/png" href="icon-192.png">');
  if (!o.hadApple) L.push('<link rel="apple-touch-icon" href="icon-192.png">');
  L.push("<script>if('serviceWorker' in navigator&&window.isSecureContext&&/^https?:$/.test(location.protocol))addEventListener('load',function(){var s=navigator.serviceWorker;s.register('./sw.js',{updateViaCache:'none'}).catch(function(){});s.ready.then(function(r){if(s.controller)return r.update()}).catch(function(){})})</script>");
  L.push('<!--fff:pwa:end-->');
  return L.join('\n');
}

/* ───────────── operații ───────────── */
export async function apply(dir, opts = {}) {
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) return {status: 'skipped', reason: 'fără index.html'};
  const orig = fs.readFileSync(file, 'utf8');
  const {html: base0, meta: oldMeta} = stripBlock(orig);
  let html = base0;
  const slug = opts.slug; if (!slug) throw new Error('--slug este obligatoriu');
  const det = detect(html, dir);
  if (!opts.force && det.own.length) return {status: 'skipped', reason: 'PWA propriu: ' + [...new Set(det.own)].join(', ')};
  if (det.quine && !opts.forceQuine && !opts.force) return {status: 'skipped', reason: 'aplicație quine (își salvează propriul index.html)'};
  const hc = headClose(html);
  if (hc < 0) return {status: 'error', reason: 'nu găsesc </head>'};
  const headS = scrub(html.slice(0, hc));
  const title = (headS.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const name = opts.name || deriveName(unesc(title || ''), slug);
  const short = (opts.short || deriveShort(name)).slice(0, 12);
  const colors = deriveColors(html, headS, opts);
  const version = metaContent(headS, 'application-version') || ('h' + (await import('node:crypto')).createHash('sha256').update(html).digest('hex').slice(0, 8));
  const lang = (html.match(/<html\b[^>]*\blang=["']?([A-Za-z-]+)/i) || [])[1] || 'ro';
  const description = metaContent(headS, 'description');
  const mono = opts.mono || deriveMono(name);
  let categories = opts.categories ? String(opts.categories).split(',').map(s => s.trim()).filter(s => CATEGORIES.has(s)) : deriveCategories(slug, name);
  const hadTheme = /<meta\b[^>]*\bname=["']theme-color["']/i.test(headS);
  const hadIcon = /<link\b[^>]*\brel=["'](?:shortcut\s+)?icon["']/i.test(headS);
  const hadApple = /<link\b[^>]*\brel=["']apple-touch-icon/i.test(headS);

  // fișiere
  const made = new Set(oldMeta?.made || []);
  const track = f => { if (!fs.existsSync(path.join(dir, f))) made.add(f); };
  const warnings = [];
  const mf = buildManifest({name, short, description: description?.slice(0, 300), scope: opts.scope || './', lang, bg: colors.bg, theme: colors.theme, categories});
  track(FILES.manifest);
  fs.writeFileSync(path.join(dir, FILES.manifest), JSON.stringify(mf, null, 2) + '\n');
  track(FILES.sw);
  fs.writeFileSync(path.join(dir, FILES.sw), buildSw({slug, version}));
  if (!opts.noIcons) {
    const fg = contrast(colors.theme, '#f5f5f0') >= contrast(colors.theme, '#14110d') ? '#f5f5f0' : '#14110d';
    for (const [key, size, mask] of [['i192', 192, false], ['i512', 512, false], ['imask', 512, true]]) {
      const f = FILES[key], p = path.join(dir, f), sz = pngSize(p);
      if (sz && sz[0] === size && sz[1] === size && !made.has(f) && fs.existsSync(p)) { warnings.push(`icoană existentă păstrată: ${f}`); continue; }
      track(f);
      await renderPng(iconSvg({mono, bg: colors.theme, fg, maskable: mask}), size, p);
    }
  }
  // CSP
  const prevCsp = {}, cspChanges = {};
  const content = cspParts(html);
  if (content != null) {
    const d = dirMap(content);
    for (const n of CSP_DIRS) {
      prevCsp[n] = oldMeta?.csp?.[n] !== undefined ? oldMeta.csp[n] : (d[n] ? d[n].join(' ') : null);
      const next = computeSources(d, n);
      cspChanges[n] = {before: d[n] ? d[n].join(' ') : null, after: next};
      if (!d[n] || [...next.split(' ')].sort().join(' ') !== [...d[n]].sort().join(' ')) html = setCspDirective(html, n, next);
    }
  }
  // bloc
  const block = buildBlock({theme: colors.theme, hadTheme, hadIcon, hadApple}, {csp: prevCsp, orig: oldMeta?.orig ?? content ?? null, made: [...made]});
  const hc2 = headClose(html);
  const before = html.slice(0, hc2), after = html.slice(hc2);
  const lead = /\n[ \t]*$/.test(before) ? '' : '\n';
  html = before + lead + block + '\n' + after;
  html = recomputeCspHashes(html).html;
  const chk = checkCspHashes(html);
  if (!chk.ok) return {status: 'error', reason: 'hash-uri CSP lipsă: ' + chk.missing.join(',')};
  if (html !== orig) fs.writeFileSync(file, html);
  return {status: 'ok', changed: html !== orig, name, short, mono, theme: colors.theme, themeSource: colors.src, bg: colors.bg, version, lang, categories, csp: cspChanges, warnings, madeFiles: [...made]};
}

export function check(dir) {
  const problems = [], info = {};
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) return {ok: false, problems: ['fără index.html']};
  const html = fs.readFileSync(file, 'utf8');
  if (!BLOCK_RE.test(html)) return {ok: false, problems: ['lipsește blocul <!--fff:pwa:start-->'], info: {applied: false}};
  info.applied = true;
  const hc = headClose(html), headS = scrub(html.slice(0, hc));
  if (!/<link\b[^>]*rel=["']manifest["'][^>]*href=["']manifest\.webmanifest["']/.test(html.slice(0, hc))) problems.push('lipsește <link rel=manifest>');
  if (!/<meta\b[^>]*name=["']theme-color["']/i.test(html.slice(0, hc))) problems.push('lipsește theme-color');
  let mf;
  try { mf = JSON.parse(fs.readFileSync(path.join(dir, FILES.manifest), 'utf8')); } catch (e) { problems.push('manifest invalid/lipsă: ' + e.message); }
  if (mf) {
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'lang', 'background_color', 'theme_color', 'icons']) if (!mf[k]) problems.push('manifest: lipsește ' + k);
    if ((mf.short_name || '').length > 12) problems.push('short_name > 12 caractere');
    if (mf.display !== 'standalone') problems.push('display != standalone');
    for (const i of mf.icons || []) {
      const sz = pngSize(path.join(dir, i.src)); const want = parseInt(i.sizes, 10);
      if (!sz) problems.push(`icoană lipsă/invalidă: ${i.src}`); else if (sz[0] !== want || sz[1] !== want) problems.push(`icoană ${i.src} are ${sz.join('x')}, nu ${i.sizes}`);
    }
    if (!(mf.icons || []).some(i => i.purpose === 'maskable')) problems.push('lipsește icoana maskable');
    info.name = mf.name; info.short = mf.short_name;
  }
  let sw = ''; try { sw = fs.readFileSync(path.join(dir, FILES.sw), 'utf8'); } catch { problems.push('lipsește sw.js'); }
  if (sw) {
    if (!sw.startsWith(SW_HEADER)) problems.push('sw.js nu este generat de fff-pwa');
    if (/importScripts\s*\(/.test(sw.replace(/importScripts[^\n]*fără importScripts/, ''))) problems.push('sw.js folosește importScripts');
    if (/https?:\/\//.test(sw.replace(/\/\*[\s\S]*?\*\//, ''))) problems.push('sw.js conține URL extern');
    const v = metaContent(headS, 'application-version');
    const sv = (sw.match(/VERSION = "([^"]*)"/) || [])[1];
    if (v && sv !== v.replace(/[^0-9A-Za-z.+_]/g, '_')) problems.push(`versiune sw.js (${sv}) ≠ meta (${v}) — rulează din nou apply`);
    info.version = sv;
  }
  if (cspMeta(html)) {
    const d = dirMap(cspParts(html));
    for (const n of ['manifest-src', 'worker-src', 'img-src']) if (!(d[n] || []).includes("'self'")) problems.push(`CSP: ${n} fără 'self'`);
    if ((d['worker-src'] || []).includes("'none'") || (d['manifest-src'] || []).includes("'none'")) problems.push("CSP: 'none' rămas");
    if (/unsafe-eval/.test((d['script-src'] || []).join(' '))) (info.warnings = info.warnings || []).push('CSP preexistent: script-src conține unsafe-eval (neatins)');
    const ch = checkCspHashes(html); if (!ch.ok) problems.push('CSP: hash-uri script lipsă ' + ch.missing.join(','));
    info.csp = {manifest: (d['manifest-src'] || []).join(' '), worker: (d['worker-src'] || []).join(' '), img: (d['img-src'] || []).join(' ')};
  } else info.csp = 'fără CSP';
  return {ok: problems.length === 0, problems, info};
}

export function remove(dir) {
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) return {status: 'skipped', reason: 'fără index.html'};
  const orig = fs.readFileSync(file, 'utf8');
  const {html, meta} = stripBlock(orig);
  if (!meta) return {status: 'skipped', reason: 'nu există bloc fff:pwa'};
  fs.writeFileSync(file, html);
  const removed = [];
  for (const f of meta.made || []) { const p = path.join(dir, f); if (fs.existsSync(p)) { fs.unlinkSync(p); removed.push(f); } }
  return {status: 'ok', removed};
}

/* ───────────── CLI ───────────── */
function parseArgs(argv) {
  const o = {_: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const nx = argv[i + 1];
      if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; }
    } else o._.push(a);
  }
  return o;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const a = parseArgs(process.argv.slice(2));
  const [cmd, dir] = a._;
  if (!cmd || !dir) { console.error('Utilizare: pwa.mjs apply|check|remove <dir> [--slug S ...]'); process.exit(2); }
  let code = 0;
  try {
    let r;
    if (cmd === 'apply') r = await apply(dir, {slug: a.slug, name: a.name, short: a.short, theme: a.theme, bg: a.bg, scope: a.scope, mono: a.mono, categories: a.categories, force: !!a.force, forceQuine: !!a.forceQuine, noIcons: !!a.noIcons});
    else if (cmd === 'check') { r = check(dir); if (!r.ok) code = 1; }
    else if (cmd === 'remove') r = remove(dir);
    else { console.error('Comandă necunoscută: ' + cmd); process.exit(2); }
    console.log(JSON.stringify(r, null, 2));
    if (r.status === 'error') code = 1;
  } catch (e) { console.error(e.message); code = 1; }
  await closeBrowser();
  process.exit(code);
}
