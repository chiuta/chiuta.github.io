// Teste PWA (fără browser și fără kit): manifestul, service worker-ul, pictogramele, înregistrarea și CSP-ul sunt coerente cu pagina.
// Același fișier în toate aplicațiile alpha (sursa: tools/alpha/pwa.test.template.mjs din hub); citește doar fișierele din depozit.
// Rulează cu: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cfg = JSON.parse(rd('src/app.json'));
const html = rd('index.html');
const meta = (name) => { const m = html.match(new RegExp('<meta name="' + name + '" content="([^"]*)"')); return m ? m[1] : null; };
const pageLang = () => (html.match(/<html lang="([^"]+)"/) || [])[1];
const csp = () => (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
const cspTok = (c, name) => { const m = c.match(new RegExp('(?:^|;)\\s*' + name + '\\s+([^;]*)')); return m ? m[1].trim().split(/\s+/) : null; };
const pngSize = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', f + ' nu este PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('src/app.json cere PWA, iar fișierele alăturate există', () => {
  assert.ok(cfg.pwa && Array.isArray(cfg.pwa.categories), 'src/app.json: lipsește «pwa»');
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' lipsește (rulează node scripts/build.mjs)');
});

test('manifestul: câmpurile obligatorii, fără entități HTML, pictograme de dimensiunea declarată', () => {
  const m = JSON.parse(rd('manifest.webmanifest'));
  assert.ok(m.name && m.short_name && m.short_name.length <= 12, 'name / short_name (≤ 12 caractere)');
  assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.equal(m.display, 'standalone');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i); assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(Array.isArray(m.categories) && m.categories.length >= 1);
  assert.ok(!/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(JSON.stringify(m)), 'entitate HTML rămasă în manifest: ' + JSON.stringify(m).match(/&(?:#x?[0-9a-f]+|[a-z]+);/i));
  assert.equal(m.lang, pageLang());
  const want = {'icon-192.png': [192, 192], 'icon-512.png': [512, 512], 'icon-maskable-512.png': [512, 512]};
  assert.deepEqual(m.icons.map((i) => i.src).sort(), Object.keys(want).sort());
  for (const i of m.icons) { assert.deepEqual(pngSize(i.src), want[i.src], i.src); assert.equal(i.sizes, want[i.src].join('x')); }
  assert.ok(m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.purpose === 'any'));
});
test('sw.js: versiunea și slug-ul sunt cele ale paginii; doar aceeași origine; fără importScripts și fără adrese externe', () => {
  const sw = rd('sw.js');
  assert.match(sw, new RegExp('var SLUG = "' + cfg.slug + '", VERSION = "' + cfg.version.replace(/\./g, '\\.') + '";'));
  assert.equal(meta('application-version'), cfg.version);
  assert.ok(!/importScripts|https?:\/\//.test(sw.replace(/\/\*[\s\S]*?\*\//, '')), 'service worker-ul nu trebuie să facă cereri externe');
  assert.match(sw, /u\.origin !== self\.location\.origin/, 'trebuie să ignore alte origini');
});

test('index.html: link către manifest, înregistrare doar în context sigur (nu din file://), CSP cu manifest-src și worker-src \'self\'', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icon-192\.png">/);
  const reg = html.match(/<!--fff:pwa:start[^>]*-->[\s\S]*?<!--fff:pwa:end-->/);
  assert.ok(reg, 'blocul fff:pwa lipsește');
  assert.match(reg[0], /window\.isSecureContext/); assert.match(reg[0], /\^https\?:\$/);
  assert.match(reg[0], /register\('\.\/sw\.js'/);
  const c = csp();
  assert.match(c, /manifest-src 'self'/); assert.match(c, /worker-src 'self'/); assert.match(c, /img-src 'self' data:/);
  assert.match(c, /default-src 'none'/); assert.ok(!/unsafe-inline|unsafe-eval/.test(c));
  // fără «connect» în src/app.json: nicio cerere de rețea; cu «connect»: connect-src conține exact originile declarate (și nimic altceva)
  const conn = cspTok(c, 'connect-src');
  if (cfg.connect && cfg.connect.length) assert.deepEqual((conn || []).slice().sort(), cfg.connect.slice().sort(), 'connect-src trebuie să fie exact lista «connect» din src/app.json');
  else assert.ok(!conn, 'aplicația nu face cereri de rețea: fără connect-src');
  for (const [dir, vals] of Object.entries(cfg.csp || {})) for (const v of vals) assert.ok((cspTok(c, dir) || []).includes(v), dir + ' trebuie să conțină ' + v + ' (src/app.json «csp»)');
  assert.ok(!/\*|unsafe-hashes|\bhttp:/.test(c), 'CSP fără wildcard, http: sau unsafe-hashes');
});

test('blocul PWA este ultimul element din <head> (după stilul aplicației), iar pagina rămâne un singur index.html', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.lastIndexOf('<!--fff:pwa:end-->') > head.lastIndexOf('<style id="app-style">'), 'blocul PWA trebuie să urmeze stilul aplicației');
  assert.ok(head.trimEnd().endsWith('<!--fff:pwa:end-->'), 'nimic după blocul PWA în <head>');
  assert.ok(!/<link[^>]+rel="stylesheet"|<script[^>]+\bsrc=/i.test(html), 'pagina nu încarcă fișiere externe de stil sau script');
});
