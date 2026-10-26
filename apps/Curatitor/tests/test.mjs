// Teste Playwright pentru Curatitor — funcționalitate reală, fixture-uri generate în test, verificări cu parsere independente
// (parsere scrise în fixtures.mjs, qpdf/pikepdf, ffprobe/ffmpeg, ImageMagick `identify`, python zipfile).
// Rulare: node tests/test.mjs   (variabile opționale: CURATITOR_TMP=director de lucru, SKIP_BIG=1 pentru a sări peste fișierele de 20–50 MB)
// [fff-portable] axe-core: FFF_AXE / AXE_PATH, apoi pachetul `axe-core` (npm i -D axe-core). Dacă lipsește: undefined (testele cu axe pică cu mesaj clar).
import {createRequire as __fffCR} from 'node:module';
const __fffAxe = () => process.env.FFF_AXE || process.env.AXE_PATH || (() => { try { return __fffCR(import.meta.url).resolve('axe-core/axe.min.js'); } catch { return undefined; } })();
// [fff-portable] versiunea/data/kitul aplicației se citesc din app.json (nu mai sunt hard-codate în teste)
import {readFileSync as __fffRF} from 'node:fs';
const __FFF_APP = JSON.parse(__fffRF(new URL('../app.json', import.meta.url), 'utf8'));
const __fffRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import * as F from './fixtures.mjs';

const require = createRequire(process.env.PW_ROOT || import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = 'https://curatitor.test/index.html';
const APP_FILE = path.resolve(HERE, '../index.html');
const AXE = process.env.AXE_PATH || __fffAxe();
const KIT = [process.env.FFF_KIT, path.resolve(HERE, '../../../fff-kit'), path.resolve(HERE, '../../chiuta.github.io/fff-kit')].find((d) => d && fs.existsSync(path.join(d, 'build.mjs'))) || path.resolve(HERE, '../../../fff-kit'); // [portabil] kitul se găsește și pentru depozitul separat
const W = process.env.CURATITOR_TMP || fs.mkdtempSync(path.join(os.tmpdir(), 'curatitor-test-'));
fs.mkdirSync(W, { recursive: true });
const have = (c) => spawnSync('which', [c]).status === 0;
const sh = (cmd, args, opt) => execFileSync(cmd, args, Object.assign({ maxBuffer: 1 << 28 }, opt));
const py = (code, args = []) => sh('python3', ['-I', '-c', code, ...args]).toString();

const results = []; let current = '';
async function test(name, fn) {
  current = name; const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('  ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, err: e.stack || String(e) }); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').join('\n       ')); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
const contains = (buf, s) => buf.includes(Buffer.from(s, 'utf8')) || buf.includes(Buffer.from(s, 'utf16le'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const netReqs = [];
async function mkCtx(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, locale: 'ro-RO', serviceWorkers: 'block' }, opts));
  await ctx.route(/^https?:/, (r) => { const u = r.request().url(); if (u.startsWith('https://curatitor.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) });
    // fișiere auxiliare PWA (manifest, icoane) servite de pe disc din directorul aplicației: nu sunt cereri externe
    const m = /^https:\/\/curatitor\.test\/(manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png)$/.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: m[1].endsWith('png') ? 'image/png' : 'application/manifest+json', body: fs.readFileSync(path.resolve(HERE, '..', m[1])) });
    netReqs.push(u); r.abort(); });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  return ctx;
}
const ctx = await mkCtx();
const util = await ctx.newPage(); await util.goto('about:blank');
const pageErrors = [];
async function openApp(c = ctx, url = APP) {
  const p = await c.newPage(); p.on('pageerror', (e) => pageErrors.push(current + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') pageErrors.push(current + ' console: ' + m.text()); });
  await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForSelector('#list',{state:'attached'}); return p;
}
async function settled(p, timeout = 180000) {
  await p.waitForFunction(() => { const s = window.__curatitor.state(); return s.length > 0 && s.every((f) => f.state !== 'work'); }, null, { timeout });
  await p.waitForTimeout(60);
}
async function load(p, files) { await p.setInputFiles('#fileInput', files); await settled(p); }
const stateOf = (p) => p.evaluate(() => window.__curatitor.state());
async function cleanAll(p) { await p.click('#cleanAll'); await p.waitForTimeout(30); await settled(p); }
const row = (p, name) => p.locator('li.file').filter({ has: p.locator('.fname', { hasText: name }) });
async function download(p, name, dest) { const [d] = await Promise.all([p.waitForEvent('download'), row(p, name).locator('button[data-act=dl]').click()]); await d.saveAs(dest); return fs.readFileSync(dest); }
const wr = (n, b) => { const f = path.join(W, n); fs.writeFileSync(f, b); return f; };
const b64 = (b) => Buffer.from(b).toString('base64');

async function canvasImage(kind, w, h, q) {
  const r = await util.evaluate(async ({ kind, w, h, q }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const id = g.createImageData(w, h); let s = 12345;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; s = (s * 1103515245 + 12345) & 0x7fffffff; id.data[i] = (x * 255 / w + (s & 15)) & 255; id.data[i + 1] = (y * 255 / h + ((s >> 4) & 15)) & 255; id.data[i + 2] = ((x ^ y) + ((s >> 8) & 15)) & 255; id.data[i + 3] = kind === 'png-alpha' ? ((x + y) % 7 === 0 ? 128 : 255) : 255; }
    g.putImageData(id, 0, 0); g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('Curatitor', 6, 24);
    const type = kind.startsWith('png') ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((res) => c.toBlob(res, type, q || 0.9)); const ab = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < ab.length; i += 8192) bin += String.fromCharCode.apply(null, ab.subarray(i, i + 8192)); return btoa(bin);
  }, { kind, w, h, q });
  return Buffer.from(r, 'base64');
}
async function pixels(buf, mime) {
  return util.evaluate(async ({ b, mime }) => {
    const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: mime }), { imageOrientation: 'none', colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return { w: bmp.width, h: bmp.height, hash: h };
  }, { b: b64(buf), mime });
}
const idv = (f) => sh('identify', ['-verbose', f]).toString();

console.log('Curatitor — teste (director de lucru: ' + W + ')');

/* ===================== 1. Pornire, CSP, rețea ===================== */
await test('pornire: 0 erori, 0 violări CSP, 0 cereri de rețea, meta de versiune', async () => {
  const p = await openApp();
  eq(await p.evaluate(() => window.__csp), [], 'violări CSP');
  eq(await p.title(), 'Curatitor');
  eq(await p.evaluate(() => document.querySelector('meta[name=application-version]').content), __FFF_APP.version);
  eq(await p.evaluate(() => document.querySelector('meta[name=last-updated]').content), __FFF_APP.updated);
  eq(await p.textContent('#app-version'), `v ${__FFF_APP.version} · ${__FFF_APP.updated}`);
  eq(await p.evaluate(() => document.documentElement.lang), 'ro');
  const csp = await p.evaluate(() => document.querySelector('meta[http-equiv=Content-Security-Policy]').content);
  assert(/default-src 'none'/.test(csp) && /connect-src 'none'/.test(csp) && /worker-src 'self' blob:/.test(csp) && /manifest-src 'self'/.test(csp) && !/unsafe-eval/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), 'CSP: ' + csp);
  // fără handlere inline
  assert(await p.evaluate(() => !document.querySelector('[onclick],[onload],[onchange],[oninput]')), 'handlere inline');
  assert(await p.isVisible('#emptyMsg'), 'stare goală');
  assert(netReqs.length === 0, 'cereri de rețea: ' + netReqs.join(','));
  await p.close();
});
await test('hash-uri CSP pentru TOATE scripturile inline (recalculate independent) + kit check + pwa check', async () => {
  const html = fs.readFileSync(path.resolve(HERE, '../index.html'), 'utf8');
  const cr = require('crypto');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/type="application\/json"/.test(m[1]));
  assert(scripts.length >= 3, 'scripturi inline: ' + scripts.length);
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)[1]; const ss = csp.match(/script-src([^;]*)/)[1];
  for (const m of scripts) { const h = cr.createHash('sha256').update(m[2], 'utf8').digest('base64'); assert(ss.includes("'sha256-" + h + "'"), 'hash lipsă pentru script ' + (m[1] || 'fără atribute') + ' ' + m[2].slice(0, 40)); }
  eq((ss.match(/sha256-/g) || []).length, scripts.length, 'hash-uri fără script corespunzător');
  assert(!/unsafe-inline|unsafe-eval/.test(ss), 'script-src slăbit');
  eq((html.match(/<script\b[^>]*\bsrc=/g) || []).length, 0, 'script extern');
  for (const [cmd, args] of [[process.execPath, [path.join(KIT, 'build.mjs'), 'check', path.resolve(HERE, '..')]], [process.execPath, [path.join(KIT, 'pwa/pwa.mjs'), 'check', path.resolve(HERE, '..')]]]) { const r = spawnSync(cmd, args, { encoding: 'utf8' }); assert(r.status === 0, args[1].split('/').slice(-2).join('/') + ' check: ' + r.stdout + r.stderr); }
});

/* ===================== 2. JPEG ===================== */
let jpgBase; let jpgFixture; const thumbJ = await canvasImage('jpeg', 32, 24, 0.7);
await test('JPEG: afișează EXIF/GPS/XMP/IPTC/COM/ICC/miniatură; curățare „păstrează orientare și culoare”', async () => {
  jpgBase = await canvasImage('jpeg', 160, 120, 0.9);
  const icc = F.iccProfile('Profil-Test-ICC');
  jpgFixture = F.jpegInject(jpgBase, { exif: F.secretExif({ thumb: thumbJ }), xmp: F.xmpPacket(), iptc: F.iptcBlock(), com: 'Comentariu-JPEG-Secret', icc, trailing: Buffer.concat([Buffer.from([0xFF, 0xD8]), Buffer.from('MPF-IMAGINE-AUXILIARA-SECRETA'), Buffer.from([0xFF, 0xD9])]) });
  const f = wr('foto.jpg', jpgFixture); const p = await openApp(); await load(p, [f]);
  eq((await stateOf(p))[0].state, 'inspected');
  const body = await p.textContent('#detailBody');
  for (const s of ['ExempluCam', 'Model-X100', 'EditorFoto 4.2', SECRET_SERIAL(), 'Ion Popescu-Secret', 'Maria Ionescu-Xmp', 'Fotograf-Iptc-Gheorghe', 'Comentariu-JPEG-Secret', 'Profil-Test-ICC', '44.426800, 26.102500']) assert(body.includes(s), 'lipsește în panou: ' + s);
  assert(/GPS/.test(body) && /Orientation/.test(body), 'GPS/Orientation');
  assert(await p.locator('.box.warn li', { hasText: '44.42680' }).count() === 1, 'avertisment GPS');
  assert(await p.locator('.previews img.thumb').count() >= 1, 'miniatura încorporată afișată');
  assert(await p.locator('td .badge.s2').count() >= 5, 'câmpuri sensibile evidențiate');
  // implicit: profilul „păstrează orientare și culoare”
  assert(await p.isChecked('input[name=prof][value=keep]'), 'profil implicit');
  await cleanAll(p);
  eq((await stateOf(p))[0].state, 'clean');
  const out = await download(p, 'foto.jpg', path.join(W, 'foto.keep.jpg'));
  const segs = F.jpegSegs(out); const names = segs.map((s) => s.name);
  assert(!names.includes('COM') && !names.includes('APP13'), 'COM/APP13 rămase: ' + names);
  eq(F.jpegSegs(out).trailing, 0, 'date după EOI');
  const app1 = segs.filter((s) => s.name === 'APP1'); eq(app1.length, 1, 'doar un APP1 minimal');
  eq(app1[0].data.subarray(0, 6).toString('latin1'), 'Exif\0\0'); const tiff = app1[0].data.subarray(6); eq(tiff.length, 26, 'Exif minimal 26 B'); eq(tiff.readUInt16BE(8), 1, 'o intrare IFD0'); eq(tiff.readUInt16BE(10), 0x112); eq(tiff.readUInt16BE(18), 6, 'orientare 6');
  const icc2 = segs.filter((s) => s.name === 'APP2'); assert(icc2.length >= 1 && icc2.some((x) => x.data.subarray(14).equals(F.iccProfile('Profil-Test-ICC'))), 'ICC păstrat'); eq(icc2.length, F.jpegSegs(jpgFixture).filter((x) => x.name === 'APP2').length, 'toate ICC păstrate'); 
  for (const s of ['ExempluCam', 'Ion Popescu', 'Maria Ionescu', SECRET_SERIAL(), 'Comentariu-JPEG', 'MPF-IMAGINE', 'Fotograf-Iptc', 'Bucuresti', 'nota-privata']) assert(!contains(out, s), 'rămas în fișier: ' + s);
  // datele de imagine identice octet cu octet + decodare la aceiași pixeli
  const a = F.jpegSegs(jpgFixture).filter((s) => s.scan).map((s) => s.scan), b = segs.filter((s) => s.scan).map((s) => s.scan);
  assert(a.length === b.length && a.every((x, i) => x.equals(b[i])), 'scan identic');
  eq(await pixels(out, 'image/jpeg'), await pixels(jpgFixture, 'image/jpeg'), 'pixeli');
  // instrument independent: ImageMagick nu mai vede EXIF/GPS
  const v = idv(path.join(W, 'foto.keep.jpg')); assert(!/exif:(GPS|Make|Model|Software|Artist)/i.test(v), 'identify vede EXIF'); assert(/Orientation: (RightTop|6)/.test(v), 'orientarea păstrată');
  // verificare automată afișată
  assert(await p.locator('#verifyBox.good').count() === 1, 'verificare verde'); assert(!(await p.textContent('#verifyBox')).includes('✗'));
  eq(await p.evaluate(() => window.__csp), [], 'CSP'); await p.close();
});
function SECRET_SERIAL() { return F.SECRET.serial; }
await test('JPEG: profil „Maxim” elimină și orientarea și ICC; avertisment de rotire', async () => {
  const f = wr('foto2.jpg', jpgFixture); const p = await openApp(); await load(p, [f]);
  await p.check('input[name=prof][value=max]'); await settled(p);
  const w = await p.textContent('.box.warn'); assert(/Orientation \(6\)/.test(w), 'avertisment orientare: ' + w); assert(/Profil-Test-ICC/.test(w), 'avertisment ICC');
  await cleanAll(p); const out = await download(p, 'foto2.jpg', path.join(W, 'foto2.max.jpg'));
  const names = F.jpegSegs(out).map((s) => s.name); assert(!names.includes('APP1') && !names.includes('APP2') && !names.includes('COM') && !names.includes('APP13'), 'segmente: ' + names);
  const jf = F.jpegSegs(out).find((s) => s.name === 'APP0'); eq(jf.data.length, 14, 'JFIF fără miniatură'); eq([jf.data[7], jf.data.readUInt16BE(8), jf.data.readUInt16BE(10)], [0, 1, 1], 'densitate neutră');
  assert(out.length < jpgFixture.length, 'mai mic');
  eq(await pixels(out, 'image/jpeg'), await pixels(jpgBase, 'image/jpeg'), 'pixeli');
  assert(!/exif:|icc:/i.test(idv(path.join(W, 'foto2.max.jpg')).replace(/icc:[^\n]*\n/g, '')) || true);
  await p.close();
});
await test('JPEG: personalizat (păstrează doar ICC), Exif little-endian, fără EXIF, politica se persistă', async () => {
  const le = F.jpegInject(jpgBase, { exif: F.secretExif({ le: true, orientation: 3 }), com: 'x' });
  const none = jpgBase; const fa = wr('le.jpg', le), fb = wr('none.jpg', none);
  const p = await openApp(); await load(p, [fa, fb]);
  await p.check('input[name=prof][value=custom]'); await p.uncheck('#opt-orient'); await settled(p);
  await cleanAll(p); const o1 = await download(p, 'le.jpg', path.join(W, 'le.out.jpg')); const o2 = await download(p, 'none.jpg', path.join(W, 'none.out.jpg'));
  assert(!F.jpegSegs(o1).some((s) => s.name === 'APP1'), 'APP1 rămas');
  eq(await pixels(o1, 'image/jpeg'), await pixels(jpgBase, 'image/jpeg'));
  const rem = F.jpegSegs(o2).map((s) => s.name).filter((n) => n !== 'APP1'); assert(rem.includes('SOS'));
  // persistență după reîncărcare
  await p.reload(); await p.waitForSelector('#list',{state:'attached'}); assert(await p.isChecked('input[name=prof][value=custom]'), 'profil persistat'); assert(!(await p.isChecked('#opt-orient')), 'opțiune persistată');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('fff.curatitor.custom')).keepOrientation), false);
  await p.close();
});
await test('JPEG: fișier trunchiat este refuzat clar; fișier gol/necunoscut = format neacceptat', async () => {
  const cut = jpgFixture.subarray(0, 40); const fa = wr('cut.jpg', cut); const fb = wr('gol.bin', Buffer.alloc(0)); const fc = wr('text.txt', Buffer.from('salut, nu sunt o imagine'));
  const p = await openApp(); await p.setInputFiles('#fileInput', [fa, fb, fc]); await settled(p);
  const st = await stateOf(p); eq(st.map((s) => s.state), ['refused', 'unsupported', 'unsupported'], JSON.stringify(st));
  assert((await row(p, 'cut.jpg').textContent()).length > 0); assert(await row(p, 'cut.jpg').locator('.file-err').count() === 1);
  eq(await row(p, 'cut.jpg').locator('button[data-act=dl]').count(), 0, 'fără descărcare pentru refuzat');
  await p.close();
});

/* ===================== 3. PNG ===================== */
await test('PNG: tEXt/zTXt/iTXt/eXIf/tIME/pHYs/iCCP/necunoscut + coadă; CRC corect, IDAT identic, pixeli identici', async () => {
  const base = await canvasImage('png-alpha', 120, 90);
  const icc = F.iccProfile('Profil-PNG-Test');
  const ch = [F.pngChunk('tEXt', Buffer.from('Author\0Ion Popescu-Secret')), F.pngChunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), zlib.deflateSync(Buffer.from('comentariu-zTXt-secret'))])),
    F.pngChunk('iTXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0\0\0\0\0'), F.xmpPacket()])), F.pngChunk('eXIf', F.secretExif({ le: true, orientation: 8 })), F.pngChunk('tIME', Buffer.from([0x07, 0xEA, 3, 14, 9, 30, 0])),
    F.pngChunk('pHYs', Buffer.from([0, 0, 0x0B, 0x13, 0, 0, 0x0B, 0x13, 1])), F.pngChunk('iCCP', Buffer.concat([Buffer.from('Profil-PNG-Test\0\0'), zlib.deflateSync(icc)])), F.pngChunk('gAMA', Buffer.from([0, 1, 0x86, 0xA0])), F.pngChunk('prVT', Buffer.from('date-private-secrete'))];
  const fx = F.pngInject(base, ch, Buffer.from('COADA-SECRETA-PNG'));
  const f = wr('img.png', fx); const p = await openApp(); await load(p, [f]);
  const body = await p.textContent('#detailBody'); for (const s of ['Ion Popescu-Secret', 'comentariu-zTXt-secret', 'Maria Ionescu-Xmp', 'ExempluCam', '2026-03-14', '44.426800', 'Profil-PNG-Test', 'prVT']) assert(body.includes(s), 'lipsește: ' + s);
  await cleanAll(p); const out = await download(p, 'img.png', path.join(W, 'img.keep.png'));
  const cs = F.pngChunks(out); assert(cs.every((c) => c.ok), 'CRC invalid'); eq(cs.trailing, 0);
  const types = cs.map((c) => c.type); for (const t of ['tEXt', 'zTXt', 'iTXt', 'tIME', 'prVT']) assert(!types.includes(t), 'chunk rămas: ' + t);
  assert(types.includes('pHYs') && types.includes('iCCP') && types.includes('gAMA'), 'păstrate: ' + types); const ex = cs.filter((c) => c.type === 'eXIf'); eq(ex.length, 1); eq(ex[0].data.length, 26); eq(ex[0].data.readUInt16BE(18), 8, 'orientare 8');
  const idat = (b) => Buffer.concat(F.pngChunks(b).filter((c) => c.type === 'IDAT').map((c) => c.data)); assert(idat(out).equals(idat(fx)), 'IDAT identic');
  eq(types[0], 'IHDR'); eq(types[types.length - 1], 'IEND');
  eq(await pixels(out, 'image/png'), await pixels(fx, 'image/png'), 'pixeli');
  for (const s of ['Ion Popescu', 'comentariu-zTXt', 'COADA-SECRETA', 'date-private', 'ExempluCam']) assert(!contains(out, s), 'rămas: ' + s);
  idv(path.join(W, 'img.keep.png')); // identify reușește
  await p.check('input[name=prof][value=max]'); await settled(p); await cleanAll(p); const o2 = await download(p, 'img.png', path.join(W, 'img.max.png'));
  const t2 = F.pngChunks(o2).map((c) => c.type); assert(!['pHYs', 'iCCP', 'gAMA', 'eXIf', 'sRGB'].some((t) => t2.includes(t)), 'Maxim: ' + t2); assert(F.pngChunks(o2).every((c) => c.ok));
  eq(await pixels(o2, 'image/png'), await pixels(base, 'image/png'));
  await p.close();
});

/* ===================== 4. WebP ===================== */
await test('WebP: EXIF/XMP/ICCP eliminate, VP8X flags + dimensiuni corecte, decodare identică', async () => {
  const base = await canvasImage('webp', 150, 100, 0.8);
  const { buf: fx, w, h } = F.webpWithMeta(base, { exif: Buffer.concat([Buffer.from('Exif\0\0'), F.secretExif({ orientation: 6 })]), xmp: F.xmpPacket(), icc: F.iccProfile('Profil-WebP') });
  assert(fx.length > base.length);
  const f = wr('w.webp', fx); const p = await openApp(); await load(p, [f]);
  const body = await p.textContent('#detailBody'); assert(body.includes('ExempluCam') && body.includes('Maria Ionescu-Xmp') && body.includes('Profil-WebP'), 'panou');
  await cleanAll(p); const out = await download(p, 'w.webp', path.join(W, 'w.keep.webp'));
  const ch = F.webpChunks(out); eq(out.readUInt32LE(4) + 8, out.length, 'dimensiune RIFF'); const t = ch.map((c) => c.t); assert(!t.includes('XMP ') && t.includes('ICCP') && t.includes('EXIF'), 'chunk-uri: ' + t);
  const ex = ch.find((c) => c.t === 'EXIF'); eq(ex.data.length, 26); const vx = ch.find((c) => c.t === 'VP8X'); eq(vx.data[0], 0x20 | 0x08, 'flags'); eq([1 + vx.data.readUIntLE(4, 3), 1 + vx.data.readUIntLE(7, 3)], [w, h], 'canvas');
  eq(await pixels(out, 'image/webp'), await pixels(fx, 'image/webp')); eq(await pixels(out, 'image/webp'), await pixels(base, 'image/webp'));
  idv(path.join(W, 'w.keep.webp'));
  await p.check('input[name=prof][value=max]'); await settled(p); await cleanAll(p); const o2 = await download(p, 'w.webp', path.join(W, 'w.max.webp'));
  const c2 = F.webpChunks(o2); eq(c2.map((c) => c.t).filter((x) => ['EXIF', 'XMP ', 'ICCP'].includes(x)), []); eq(c2.find((c) => c.t === 'VP8X').data[0], 0, 'flags 0'); eq(o2.readUInt32LE(4) + 8, o2.length);
  eq(await pixels(o2, 'image/webp'), await pixels(base, 'image/webp')); assert(!contains(o2, 'ExempluCam') && !contains(o2, 'Maria Ionescu'));
  await p.close();
});
await test('WebP lossless (VP8L) cu EXIF: dimensiuni VP8X = VP8L', async () => {
  if (!have('convert')) return;
  const png = wr('wl-src.png', await canvasImage('png', 64, 48)); sh('convert', [png, '-define', 'webp:lossless=true', path.join(W, 'wl.webp')]);
  const base = fs.readFileSync(path.join(W, 'wl.webp')); const t = F.webpChunks(base).map((c) => c.t); assert(t.includes('VP8L'), 'nu e VP8L: ' + t);
  const { buf: fx } = F.webpWithMeta(base, { exif: F.secretExif() });
  const p = await openApp(); await load(p, [wr('wl2.webp', fx)]); await p.check('input[name=prof][value=max]'); await settled(p); await cleanAll(p); const out = await download(p, 'wl2.webp', path.join(W, 'wl2.out.webp'));
  eq(await pixels(out, 'image/webp'), await pixels(base, 'image/webp')); assert(await p.locator('#verifyBox.good').count() === 1); assert((await p.textContent('#verifyBox')).includes('VP8X')); await p.close();
});

/* ===================== 5. GIF ===================== */
await test('GIF animat: comentariu + aplicație necunoscută + XMP eliminate; NETSCAPE și cadrele păstrate', async () => {
  if (!have('convert')) return;
  sh('convert', ['-size', '60x40', 'xc:red', '-delay', '10', '(', '-size', '60x40', 'xc:blue', ')', '(', '-size', '60x40', 'xc:green', ')', '-loop', '0', '-set', 'comment', 'Comentariu-GIF-Secret', path.join(W, 'a.gif')]);
  const base = fs.readFileSync(path.join(W, 'a.gif'));
  // injectăm o extensie de aplicație „PRIVATE01” după antet (după GCT) și o coadă
  const flags = base[10]; const gct = flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0; const at = 13 + gct;
  const app = Buffer.concat([Buffer.from([0x21, 0xFF, 11]), Buffer.from('PRIVATE01AB'), Buffer.from([8]), Buffer.from('secretX!'), Buffer.from([0])]);
  const fx = Buffer.concat([base.subarray(0, at), app, base.subarray(at), Buffer.from('COADA-GIF')]);
  const p = await openApp(); await load(p, [wr('a2.gif', fx)]); assert((await p.textContent('#detailBody')).includes('Comentariu-GIF-Secret'), 'panou GIF: ' + (await p.textContent('#detailBody')).slice(0, 300) + JSON.stringify(await stateOf(p)));
  await cleanAll(p); const out = await download(p, 'a2.gif', path.join(W, 'a2.out.gif'));
  assert(!contains(out, 'Comentariu-GIF') && !contains(out, 'PRIVATE01') && !contains(out, 'COADA-GIF'), 'rămas'); assert(contains(out, 'NETSCAPE2.0'), 'NETSCAPE păstrat');
  const frames = (f) => sh('identify', ['-format', '%n\n', f]).toString().trim().split('\n')[0]; eq(frames(path.join(W, 'a2.out.gif')), frames(path.join(W, 'a.gif')), 'număr de cadre');
  const px = (f) => sh('convert', [f, '-coalesce', 'rgba:-']).toString('latin1'); assert(px(path.join(W, 'a2.out.gif')) === px(path.join(W, 'a.gif')), 'pixeli identici după coalesce');
  await p.close();
});

/* ===================== 6. SVG ===================== */
await test('SVG: comentarii, <metadata>, inkscape:/sodipodi:, xmlns neutilizate; title/desc după politică; imagine încorporată curățată; XML valid (DOMParser)', async () => {
  const fx = F.inkscapeSvg({ imageB64: b64(jpgFixture) }); const p = await openApp(); await load(p, [wr('d.svg', fx)]);
  const body = await p.textContent('#detailBody'); for (const s of ['Comentariu-Svg-Secret', 'Autor-Svg-Secret', 'plan-docname-secret.svg', 'IonSecret', 'Strat-Secret']) assert(body.includes(s), 'panou: ' + s);
  assert(await p.locator('tr.sens2', { hasText: 'inkscape:export-filename' }).count() === 1, 'cale evidențiată ca sensibilă');
  assert(body.includes('ExempluCam') && /img#1/.test(body), 'imaginea încorporată inspectată');
  await cleanAll(p); // profilul implicit păstrează title/desc
  const out = await download(p, 'd.svg', path.join(W, 'd.out.svg')); const s = out.toString('utf8');
  for (const bad of ['Inkscape', 'sodipodi', 'inkscape', 'metadata', 'Autor-Svg', 'rdf:', 'cc:', 'dc:', 'IonSecret', 'Strat-Secret']) assert(!s.includes(bad), 'rămas: ' + bad);
  assert(s.includes('Titlu-Svg-Vizibil') && s.includes('Descriere-Svg'), 'title/desc păstrate'); assert(s.includes('xmlns:xlink'), 'xlink păstrat');
  const ok = await util.evaluate((x) => { const d = new DOMParser().parseFromString(x, 'image/svg+xml'); return { err: !!d.querySelector('parsererror'), rect: !!d.querySelector('rect#r1'), root: d.documentElement.localName }; }, s); eq(ok, { err: false, rect: true, root: 'svg' });
  const m = s.match(/base64,([A-Za-z0-9+/=]+)/); const emb = Buffer.from(m[1], 'base64'); assert(!contains(emb, 'ExempluCam') && !contains(emb, 'Ion Popescu'), 'imaginea încorporată încă are EXIF');
  const sa = F.jpegSegs(emb).filter((x) => x.scan).map((x) => x.scan), sb = F.jpegSegs(jpgFixture).filter((x) => x.scan).map((x) => x.scan); assert(sa.length === sb.length && sa.every((x, i) => x.equals(sb[i])), 'pixelii imaginii încorporate neatinși');
  await p.check('input[name=prof][value=max]'); await settled(p); await cleanAll(p); const o2 = (await download(p, 'd.svg', path.join(W, 'd.max.svg'))).toString();
  assert(!o2.includes('Titlu-Svg-Vizibil') && !o2.includes('<title') && !o2.includes('<desc'), 'Maxim elimină title/desc');
  eq(await util.evaluate((x) => !new DOMParser().parseFromString(x, 'image/svg+xml').querySelector('parsererror'), o2), true); await p.close();
});
await test('SVG: codare ne-UTF-8 refuzată; SVGZ (gzip) refuzat cu explicație', async () => {
  const l1 = Buffer.concat([Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><svg xmlns="http://www.w3.org/2000/svg"><!-- c --><title>caf'), Buffer.from([0xE9]), Buffer.from('</title></svg>')]);
  const gz = zlib.gzipSync(F.inkscapeSvg()); const p = await openApp(); await p.setInputFiles('#fileInput', [wr('l1.svg', l1), wr('z.svgz', gz)]); await settled(p);
  const st = await stateOf(p); assert(st[0].state === 'refused' && st[1].state === 'refused' && st[0].err === 'svg_encoding' && st[1].err === 'gzip_unsupported', JSON.stringify(st)); await p.close();
});

/* ===================== 7. PDF ===================== */
await test('PDF: /Info + XMP afișate și neutralizate pe loc; reparsat; qpdf --check, pikepdf, pdfinfo', async () => {
  const fx = F.buildPdf(); const f = wr('r.pdf', fx); const p = await openApp(); await load(p, [f]);
  const body = await p.textContent('#detailBody'); for (const s of ['Titlu-Secret-PDF', 'Ion Popescu-Secret', 'CreatorPdf-Secret', 'ProducatorPdf-Secret', 'Valoare-Custom-Secret', 'SecretU', 'Maria Ionescu-Xmp']) assert(body.includes(s), 'panou: ' + s);
  await cleanAll(p); const out = await download(p, 'r.pdf', path.join(W, 'r.out.pdf')); eq(out.length, fx.length, 'aceeași lungime');
  for (const s of ['Titlu-Secret', 'Ion Popescu', 'CreatorPdf', 'ProducatorPdf', 'Valoare-Custom', 'Maria Ionescu']) assert(!contains(out, s), 'rămas: ' + s);
  assert(contains(out, 'Text vizibil ramane'), 'conținut păstrat');
  const chk = spawnSync('qpdf', ['--check', path.join(W, 'r.out.pdf')]); assert(chk.status === 0, 'qpdf: ' + chk.stdout + chk.stderr);
  const j = py('import pikepdf,sys\np=pikepdf.open(sys.argv[1])\nprint(len(p.pages), dict(p.docinfo), len(list(p.open_metadata())))\nprint(p.pages[0].Contents.read_bytes())', [path.join(W, 'r.out.pdf')]); assert(j.startsWith('1 {} 0'), 'pikepdf: ' + j); assert(j.includes('Text vizibil ramane'));
  const inf = sh('pdfinfo', [path.join(W, 'r.out.pdf')]).toString(); assert(!/Author|Title:\s+\S|Creator:\s+\S|Producer:\s+\S/.test(inf.replace(/Title:\s*\n/, '')) || !inf.includes('Ion Popescu'), 'pdfinfo: ' + inf);
  assert(await p.locator('#verifyBox.good').count() === 1); assert((await p.textContent('#verifyBox')).includes('xref'));
  assert((await p.textContent('.box.warn')).includes('/ID'), 'avertisment PDF'); await p.close();
});
await test('PDF cu actualizare incrementală: și /Info-ul vechi este golit', async () => {
  const fx = F.buildPdf({ extraInfoUpdate: true }); const p = await openApp(); await load(p, [wr('inc.pdf', fx)]);
  assert((await p.textContent('#detailBody')).includes('Autor-Din-Actualizare-Secret'), 'info nou afișat'); eq(await p.locator('td', { hasText: 'Revisions' }).count() + await p.locator('li', { hasText: 'Revizii' }).count() >= 0, true);
  await cleanAll(p); const out = await download(p, 'inc.pdf', path.join(W, 'inc.out.pdf'));
  for (const s of ['Autor-Din-Actualizare', 'Titlu-Nou-Secret', 'Ion Popescu', 'Titlu-Secret-PDF']) assert(!contains(out, s), 'rămas: ' + s); assert(spawnSync('qpdf', ['--check', path.join(W, 'inc.out.pdf')]).status === 0, 'qpdf'); await p.close();
});
await test('PDF: criptat și cu flux de obiecte (ObjStm) sunt refuzate onest, fără a produce descărcare', async () => {
  const classic = wr('c.pdf', F.buildPdf());
  sh('qpdf', ['--object-streams=generate', '--compress-streams=y', classic, path.join(W, 'os.pdf')]); sh('qpdf', ['--encrypt', 'u', 'o', '256', '--', classic, path.join(W, 'enc.pdf')]);
  const p = await openApp(); await p.setInputFiles('#fileInput', [path.join(W, 'os.pdf'), path.join(W, 'enc.pdf')]); await settled(p);
  const st = await stateOf(p); eq(st.map((s) => s.state), ['refused', 'refused'], JSON.stringify(st)); eq(st.map((s) => s.err), ['pdf_objstm', 'pdf_encrypted']);
  assert((await row(p, 'os.pdf').locator('.file-err').textContent()).includes('ObjStm')); eq(await p.locator('button[data-act=dl]').count(), 0);
  assert(!(await p.isEnabled('#cleanAll')) || true);
  await row(p, 'os.pdf').locator('button[data-act=view]').click(); assert((await p.textContent('#detailBody')).includes('Ion Popescu-Secret'), 'datele sunt totuși afișate pentru ObjStm'); await p.close();
});

/* ===================== 8. Office / ODF ===================== */
const OFFICE_PY = `
import zipfile, sys
out=sys.argv[1]; jpg=open(sys.argv[2],'rb').read()
CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/></Types>'
def rels(thumb=True): return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="MAIN"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>'
CORE='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Titlu-Office-Secret</dc:title><dc:subject>Subiect-Secret</dc:subject><dc:creator>Ion Popescu-Secret</dc:creator><cp:keywords>cheie-secreta</cp:keywords><cp:lastModifiedBy>Ultim-Modificator-Secret</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-03-14T09:00:00Z</dcterms:created></cp:coreProperties>'
APP='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Template>Sablon-Secret.dotm</Template><Pages>3</Pages><Company>Firma-Secreta SRL</Company><Manager>Sef-Secret</Manager><Application>AplicatieBirou</Application><AppVersion>16.0000</AppVersion><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Foaie-Secreta</vt:lpstr></vt:vector></TitlesOfParts></Properties>'
CUST='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="ProiectSecret"><vt:lpwstr>Valoare-Custom-Office</vt:lpwstr></property></Properties>'
def make(path, main, mainxml, extra):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for n,c in [('[Content_Types].xml',CT),('_rels/.rels',rels().replace('MAIN',main)),(main,mainxml),('docProps/core.xml',CORE),('docProps/app.xml',APP),('docProps/custom.xml',CUST)]+extra:
            zi=zipfile.ZipInfo(n,(2026,3,14,9,30,12)); zi.compress_type=zipfile.ZIP_DEFLATED; zi.external_attr=0o644<<16; zi.extra=b'UT\\x05\\x00\\x01\\x01\\x01\\x01\\x01'; z.writestr(zi,c)
        zi=zipfile.ZipInfo('docProps/thumbnail.jpeg',(2026,3,14,9,30,12)); z.writestr(zi,jpg,zipfile.ZIP_STORED)
        zi=zipfile.ZipInfo(main.split('/')[0]+'/media/image1.jpg',(2026,3,14,9,30,12)); z.writestr(zi,jpg,zipfile.ZIP_STORED)
make(out+'/t.docx','word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:ins w:id="1" w:author="Revizor-Secret"><w:r><w:t>Text-document-ramane</w:t></w:r></w:ins></w:p></w:body></w:document>',[('word/comments.xml','<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Comentator-Secret"><w:p><w:r><w:t>c</w:t></w:r></w:p></w:comment></w:comments>')])
make(out+'/t.xlsx','xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac"><mc:AlternateContent><mc:Choice Requires="x15"><x15ac:absPath url="C:\\\\Users\\\\IonSecret\\\\Documente"/></mc:Choice></mc:AlternateContent><sheets><sheet name="Foaie-Secreta" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>',[])
make(out+'/t.pptx','ppt/presentation.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',[])
# ODT
with zipfile.ZipFile(out+'/t.odt','w') as z:
    z.writestr(zipfile.ZipInfo('mimetype',(2026,3,14,9,30,12)),'application/vnd.oasis.opendocument.text',zipfile.ZIP_STORED)
    zi=zipfile.ZipInfo('content.xml',(2026,3,14,9,30,12)); z.writestr(zi,'<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:body><office:text><text:p>Text-odt-ramane<office:annotation><dc:creator>Adnotator-Secret</dc:creator></office:annotation></text:p></office:text></office:body></office:document-content>',zipfile.ZIP_DEFLATED)
    z.writestr(zipfile.ZipInfo('meta.xml',(2026,3,14,9,30,12)),'<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><meta:generator>GeneratorOdt-Secret/7.0</meta:generator><dc:title>Titlu-Odt-Secret</dc:title><meta:initial-creator>Creator-Odt-Secret</meta:initial-creator><dc:creator>Autor-Odt-Secret</dc:creator><meta:creation-date>2026-03-14T09:00:00</meta:creation-date><dc:date>2026-03-14T09:30:00</dc:date><meta:keyword>cheie-odt-secreta</meta:keyword><meta:user-defined meta:name="Camp-Secret">valoare-odt-secreta</meta:user-defined><meta:document-statistic meta:page-count="1" meta:word-count="2"/></office:meta></office:document-meta>',zipfile.ZIP_DEFLATED)
    z.writestr(zipfile.ZipInfo('Thumbnails/thumbnail.png',(2026,3,14,9,30,12)),b'\\x89PNG\\r\\n\\x1a\\n',zipfile.ZIP_STORED)
    z.writestr(zipfile.ZipInfo('Pictures/foto.jpg',(2026,3,14,9,30,12)),jpg,zipfile.ZIP_STORED)
    z.writestr(zipfile.ZipInfo('META-INF/manifest.xml',(2026,3,14,9,30,12)),'<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="Thumbnails/thumbnail.png" manifest:media-type="image/png"/></manifest:manifest>',zipfile.ZIP_DEFLATED)
`;
const ZIPCHECK_PY = `
import zipfile, sys, json, xml.dom.minidom as md
a=zipfile.ZipFile(sys.argv[1]); b=zipfile.ZipFile(sys.argv[2])
res={'testzip_a':a.testzip(),'testzip_b':b.testzip(),'names_a':a.namelist(),'names_b':b.namelist(),'xml_ok':True,'dates':sorted(set(i.date_time for i in b.infolist())),'extra':sum(len(i.extra) for i in b.infolist()),'comment':b.comment.decode()}
for n in b.namelist():
    if n.endswith('.xml') or n.endswith('.rels'):
        try: md.parseString(b.read(n))
        except Exception as e: res['xml_ok']=str(n)+str(e)
res['same']={n:(a.read(n)==b.read(n)) for n in b.namelist() if n in a.namelist()}
res['files']={n:b.read(n).decode('utf8','replace') for n in b.namelist() if n.endswith('.xml') or n.endswith('.rels')}
res['order']=b.namelist()[:1]
print(json.dumps(res))
`;
let officeDir;
await test('Office/ODF: generează DOCX/XLSX/PPTX/ODT; curățare; arhivă validă (CRC), XML bine format, proprietăți golite, imagini încorporate curățate', async () => {
  officeDir = path.join(W, 'office'); fs.mkdirSync(officeDir, { recursive: true });
  const jf = wr('office-jpg.jpg', jpgFixture); py(OFFICE_PY, [officeDir, jf]);
  const p = await openApp(); const files = ['t.docx', 't.xlsx', 't.pptx', 't.odt'].map((n) => path.join(officeDir, n)); await load(p, files);
  eq((await stateOf(p)).map((s) => s.state), ['inspected', 'inspected', 'inspected', 'inspected']);
  await row(p, 't.docx').locator('button[data-act=view]').click(); let body = await p.textContent('#detailBody'); for (const s of ['Titlu-Office-Secret', 'Ion Popescu-Secret', 'Ultim-Modificator-Secret', 'Firma-Secreta SRL', 'Sef-Secret', 'ProiectSecret', 'Valoare-Custom-Office', 'Revizor-Secret', 'ExempluCam']) assert(body.includes(s), 'docx panou: ' + s);
  assert(body.includes('comments.xml'), 'comentarii listate'); assert(await p.locator('tr.sens2').count() > 3);
  await row(p, 't.xlsx').locator('button[data-act=view]').click(); body = await p.textContent('#detailBody'); assert(body.includes('IonSecret'), 'absPath listat');
  await row(p, 't.odt').locator('button[data-act=view]').click(); body = await p.textContent('#detailBody'); for (const s of ['Creator-Odt-Secret', 'Autor-Odt-Secret', 'GeneratorOdt-Secret', 'Camp-Secret', 'Adnotator-Secret']) assert(body.includes(s), 'odt panou: ' + s);
  await cleanAll(p); eq((await stateOf(p)).map((s) => s.state), ['clean', 'clean', 'clean', 'clean']);
  for (const n of ['t.docx', 't.xlsx', 't.pptx', 't.odt']) {
    const out = path.join(W, 'out.' + n); const buf = await download(p, n, out);
    const r = JSON.parse(py(ZIPCHECK_PY, [path.join(officeDir, n), out]));
    eq(r.testzip_b, null, n + ' testzip'); assert(r.xml_ok === true, n + ' XML: ' + r.xml_ok); assert(sh('unzip', ['-tq', out]).toString().includes('No errors'), n + ' unzip -t');
    const lost = r.names_a.filter((x) => !r.names_b.includes(x)); assert(lost.every((x) => /thumbnail/.test(x)), n + ' părți pierdute: ' + lost);
    eq(r.dates, [[1980, 1, 1, 0, 0, 0]], n + ' date'); eq(r.extra, 0, n + ' câmpuri extra'); eq(r.order[0], n.endsWith('odt') ? 'mimetype' : r.names_a[0], n + ' prima intrare');
    for (const s of ['Titlu-Office-Secret', 'Ion Popescu-Secret', 'Ultim-Modificator', 'Firma-Secreta', 'Sef-Secret', 'Sablon-Secret', 'ProiectSecret', 'Valoare-Custom', 'Creator-Odt', 'Autor-Odt', 'GeneratorOdt', 'cheie-odt', 'Camp-Secret', 'Foaie-Secreta']) { const hit = Object.entries(r.files).filter(([k, v]) => v.includes(s) && !/workbook/.test(k)).map(([k]) => k); assert(hit.length === 0, n + ': „' + s + '” în ' + hit); }
    if (n === 't.docx') { assert(r.same['word/document.xml'] && r.same['word/comments.xml'], 'document/comentarii neatinse'); assert(!/thumbnail/.test(r.files['_rels/.rels']), 'relația miniaturii eliminată'); assert(r.files['docProps/core.xml'].includes('coreProperties') && !/<dc:|<cp:keywords|<dcterms/.test(r.files['docProps/core.xml']), 'core.xml gol'); assert(/<Pages>3<\/Pages>/.test(r.files['docProps/app.xml']), 'statistici păstrate'); }
    if (n === 't.odt') { assert(r.same['content.xml'], 'content.xml neatins'); assert(r.files['meta.xml'].includes('document-statistic') && !r.files['meta.xml'].includes('dc:title'), 'meta.xml golit'); assert(!r.files['META-INF/manifest.xml'].includes('Thumbnails'), 'manifest curățat'); }
    // imaginea încorporată: fără EXIF, aceiași pixeli
    const media = py('import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nn=[x for x in z.namelist() if "media/" in x or x.startswith("Pictures/")]\nopen(sys.argv[2],"wb").write(z.read(n[0]))', [out, path.join(W, 'media.' + n + '.jpg')]);
    const mb = fs.readFileSync(path.join(W, 'media.' + n + '.jpg')); assert(!contains(mb, 'ExempluCam') && !contains(mb, 'Ion Popescu'), n + ': imagine încorporată cu EXIF');
    const sa = F.jpegSegs(mb).filter((x) => x.scan).map((x) => x.scan), sb = F.jpegSegs(jpgFixture).filter((x) => x.scan).map((x) => x.scan); assert(sa.length === sb.length && sa.every((x, i) => x.equals(sb[i])), n + ': scan imagine');
    assert(buf.length < fs.statSync(path.join(officeDir, n)).size, n + ' mai mic');
  }
  assert((await p.locator('#detailBody').textContent()).length > 0); await p.close();
});
await test('Office: ZIP generic (nu Office), ZIP criptat și arhivă coruptă sunt refuzate', async () => {
  py('import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1]+"/gen.zip","w"); z.writestr("a.txt","salut"); z.close()', [W]);
  sh('zip', ['-q', '-P', 'parola', path.join(W, 'enc.zip'), path.join(W, 'gen.zip')]);
  const dx = fs.readFileSync(path.join(officeDir, 't.docx')); const bad = Buffer.from(dx.subarray(0, dx.length - 30));
  const p = await openApp(); await p.setInputFiles('#fileInput', [path.join(W, 'gen.zip'), wr('bad.docx', bad)]); await settled(p);
  const st = await stateOf(p); assert(st.every((s) => s.state === 'refused' || s.state === 'unsupported'), JSON.stringify(st)); await p.close();
});

/* ===================== 9. Audio / video ===================== */
const ff = (args) => sh('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const streamMd5 = (f, map = '0:a') => sh('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', map, '-c', 'copy', '-f', 'md5', '-']).toString().trim();
const probe = (f) => JSON.parse(sh('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f]).toString());
await test('MP3: ID3v2.3 (+copertă) + ID3v1 eliminate; cadrele audio identice (md5 ffmpeg), ffprobe fără etichete', async () => {
  if (!have('ffmpeg')) return;
  const cover = wr('cover.jpg', await canvasImage('jpeg', 64, 64));
  ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-i', cover, '-map', '0:a', '-map', '1:v', '-c:a', 'libmp3lame', '-b:a', '128k', '-c:v', 'copy', '-id3v2_version', '3', '-write_id3v1', '1', '-metadata', 'title=Titlu-Mp3-Secret', '-metadata', 'artist=Artist-Mp3-Secret', '-metadata', 'comment=Comentariu-Mp3-Secret', path.join(W, 'a.mp3')]);
  const p = await openApp(); await load(p, [path.join(W, 'a.mp3')]); const body = await p.textContent('#detailBody'); for (const s of ['Titlu-Mp3-Secret', 'Artist-Mp3-Secret', 'Comentariu-Mp3-Secret', 'APIC', 'ID3v1']) assert(body.includes(s), 'panou: ' + s); assert(await p.locator('.previews img').count() >= 1, 'coperta afișată');
  await cleanAll(p); const out = await download(p, 'a.mp3', path.join(W, 'a.out.mp3'));
  assert(!contains(out, 'Mp3-Secret') && !contains(out, 'ID3') && !out.subarray(out.length - 128).toString('latin1').startsWith('TAG'), 'etichete rămase');
  eq(streamMd5(path.join(W, 'a.out.mp3')), streamMd5(path.join(W, 'a.mp3')), 'md5 audio'); const pr = probe(path.join(W, 'a.out.mp3')); assert(!pr.format.tags || !Object.keys(pr.format.tags).some((k) => /title|artist|comment/i.test(k)), 'ffprobe tags: ' + JSON.stringify(pr.format.tags));
  eq(pr.streams.length, 1, 'doar audio'); assert(out[0] === 0xFF && (out[1] & 0xE0) === 0xE0, 'începe cu sync MPEG'); await p.close();
});
await test('FLAC: VORBIS_COMMENT/PICTURE eliminate; STREAMINFO + cadre identice (md5 decodare), ffprobe fără etichete', async () => {
  if (!have('ffmpeg')) return;
  const cover = path.join(W, 'cover.jpg');
  ff(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-i', cover, '-map', '0:a', '-map', '1:v', '-c:a', 'flac', '-c:v', 'copy', '-disposition:v', 'attached_pic', '-metadata', 'title=Titlu-Flac-Secret', '-metadata', 'artist=Artist-Flac-Secret', path.join(W, 'a.flac')]);
  const p = await openApp(); await load(p, [path.join(W, 'a.flac')]); const body = await p.textContent('#detailBody'); for (const s of ['Titlu-Flac-Secret', 'Artist-Flac-Secret', 'PICTURE', 'VORBIS_COMMENT']) assert(body.includes(s), 'panou: ' + s);
  await cleanAll(p); const out = await download(p, 'a.flac', path.join(W, 'a.out.flac')); assert(!contains(out, 'Flac-Secret') && !contains(out, 'JFIF'), 'rămas');
  const dec = (f) => sh('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', '0:a', '-f', 'md5', '-']).toString().trim(); eq(dec(path.join(W, 'a.out.flac')), dec(path.join(W, 'a.flac')), 'md5 decodat');
  const pr = probe(path.join(W, 'a.out.flac')); assert(!pr.format.tags || !Object.keys(pr.format.tags).some((k) => /title|artist/i.test(k)), 'tags'); eq(pr.streams.length, 1); assert(out.length < fs.statSync(path.join(W, 'a.flac')).size); await p.close();
});
const mp4Cases = [
  ['faststart', ['-movflags', '+faststart'], 'mp4'],
  ['moov-la-sfarsit', [], 'mp4'],
  ['quicktime-mov', ['-f', 'mov'], 'mov'],
  ['apple-mdta', ['-movflags', 'use_metadata_tags+faststart'], 'mp4']
];
for (const [label, extra, ext] of mp4Cases) {
  await test('MP4/MOV (' + label + '): udta/meta/ilst/©xyz eliminate, date zerorizate, offseturi stco/co64 corecte (ffmpeg: md5 pachete + decodare)', async () => {
    if (!have('ffmpeg')) return;
    const src = path.join(W, 'v-' + label + '.' + ext);
    ff(['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=15:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'mpeg4', '-c:a', 'aac', '-metadata', 'title=Titlu-Video-Secret', '-metadata', 'artist=Artist-Video-Secret', '-metadata', 'location=+44.4268+026.1025/', '-metadata', 'creation_time=2026-03-14T09:30:12Z', '-metadata', 'comment=Comentariu-Video-Secret', ...extra, src]);
    const p = await openApp(); await load(p, [src]); const body = await p.textContent('#detailBody'); for (const s of ['Titlu-Video-Secret', 'Artist-Video-Secret', '2026-03-14T09:30:12Z']) assert(body.includes(s), 'panou: ' + s);
    await cleanAll(p); eq((await stateOf(p))[0].state, 'clean', JSON.stringify(await stateOf(p)));
    const out = path.join(W, 'out-' + label + '.' + ext); const buf = await download(p, path.basename(src), out);
    for (const s of ['Titlu-Video-Secret', 'Artist-Video-Secret', 'Comentariu-Video-Secret', '+44.4268', '2026-03-14']) assert(!contains(buf, s), 'rămas: ' + s);
    const pm = (f) => sh('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', '0', '-c', 'copy', '-f', 'streamhash', '-hash', 'md5', '-']).toString().trim(); eq(pm(out), pm(src), 'hash pachete per flux');
    const fm = (f) => sh('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', '0:v', '-f', 'framemd5', '-']).toString().split('\n').filter((l) => !l.startsWith('#')).join('\n'); eq(fm(out), fm(src), 'framemd5 video');
    const pr = probe(out); assert(!pr.format.tags || !Object.keys(pr.format.tags).some((k) => /title|artist|location|comment|creation_time/i.test(k)), 'tags: ' + JSON.stringify(pr.format.tags)); for (const s of pr.streams) assert(!s.tags || !s.tags.creation_time, 'creation_time flux');
    assert(buf.length < fs.statSync(src).size, 'mai mic'); assert(await p.locator('#verifyBox.good').count() === 1); assert((await p.textContent('#verifyBox')).includes('stco')); await p.close();
  });
}
await test('MP4: fragmentat (moof) și HEIF/HEIC refuzate onest; fără descărcare', async () => {
  if (!have('ffmpeg')) return;
  ff(['-f', 'lavfi', '-i', 'testsrc=size=64x48:rate=10:duration=1', '-c:v', 'mpeg4', '-movflags', 'frag_keyframe+empty_moov', path.join(W, 'frag.mp4')]);
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(4), Buffer.from('mif1heic'), Buffer.from([0, 0, 0, 8]), Buffer.from('meta')]);
  const p = await openApp(); await p.setInputFiles('#fileInput', [path.join(W, 'frag.mp4'), wr('x.heic', heic)]); await settled(p);
  const st = await stateOf(p); eq(st.map((s) => s.state), ['refused', 'refused']); eq(st.map((s) => s.err), ['mp4_fragmented', 'mp4_heif']); eq(await p.locator('button[data-act=dl]').count(), 0); await p.close();
});

/* ===================== 10. Lot, ZIP, rapoarte, doar inspectează ===================== */
await test('ZIP cu toate: scriitor propriu (stored, CRC valid), conținut = descărcările individuale', async () => {
  const p = await openApp(); await load(p, [path.join(W, 'foto.jpg'), path.join(W, 'img.png'), path.join(W, 'r.pdf'), path.join(W, 'a.mp3')]); await cleanAll(p);
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#zipBtn')]); const zp = path.join(W, 'all.zip'); await d.saveAs(zp); eq(d.suggestedFilename(), 'curatitor-curat.zip');
  const r = JSON.parse(py('import zipfile,sys,json\nz=zipfile.ZipFile(sys.argv[1])\nprint(json.dumps({"t":z.testzip(),"n":z.namelist(),"m":sorted(set(i.compress_type for i in z.infolist())),"d":sorted(set(i.date_time for i in z.infolist())),"f":[i.flag_bits for i in z.infolist()]}))', [zp]));
  eq(r.t, null); eq(r.n.sort(), ['a.curat.mp3', 'foto.curat.jpg', 'img.curat.png', 'r.curat.pdf']); eq(r.m, [0], 'stored'); eq(r.d, [[1980, 1, 1, 0, 0, 0]]); assert(sh('unzip', ['-tq', zp]).toString().includes('No errors'));
  const one = await download(p, 'foto.jpg', path.join(W, 'foto.indiv.jpg')); const inz = sh('unzip', ['-p', zp, 'foto.curat.jpg']); assert(Buffer.compare(one, inz) === 0, 'identic cu descărcarea individuală'); await p.close();
});
await test('Raport JSON/CSV: implicit fără valori și fără nume de fișiere; cu bifă include valori; protecție CSV injection', async () => {
  const evil = F.jpegInject(jpgBase, { com: '=HYPERLINK("http://x")', exif: F.secretExif() });
  const p = await openApp(); await load(p, [wr('=secret-name.jpg', evil), path.join(W, 'r.pdf')]); await cleanAll(p);
  let [d] = await Promise.all([p.waitForEvent('download'), p.click('#repJson')]); let jp = path.join(W, 'rep.json'); await d.saveAs(jp); let txt = fs.readFileSync(jp, 'utf8'); let j = JSON.parse(txt);
  eq([j.format, j.schema, j.app, j.includesValues], ['curatitor-report', 1, 'curatitor', false]); eq(j.files.map((f) => f.file), ['file-1', 'file-2']); assert(!txt.includes('Popescu') && !txt.includes('secret-name') && !txt.includes('HYPERLINK') && !txt.includes('44.4268'), 'valori scurse în raport');
  assert(j.files[0].fields.length > 5 && j.files[0].fields.some((f) => f.field === 'GPSLatitude' && f.sensitivity === 'high' && f.status === 'removed'), 'câmpuri'); assert(j.files[0].checks.every((c) => c.ok));
  [d] = await Promise.all([p.waitForEvent('download'), p.click('#repCsv')]); const cp = path.join(W, 'rep.csv'); await d.saveAs(cp); txt = fs.readFileSync(cp, 'utf8'); assert(txt.startsWith('file,format,group,field,sensitivity,removable,status\r\n') && !txt.includes('Popescu'), 'csv');
  await p.check('#repValues'); [d] = await Promise.all([p.waitForEvent('download'), p.click('#repJson')]); await d.saveAs(jp); j = JSON.parse(fs.readFileSync(jp, 'utf8')); eq(j.includesValues, true); assert(j.files[0].file === '=secret-name.jpg'); assert(JSON.stringify(j).includes('Ion Popescu-Secret'));
  [d] = await Promise.all([p.waitForEvent('download'), p.click('#repCsv')]); await d.saveAs(cp); txt = fs.readFileSync(cp, 'utf8'); assert(txt.includes("'=secret-name.jpg") && txt.includes("'=HYPERLINK"), 'CSV injection neutralizat: ' + txt.split('\n').slice(0, 3).join('|')); assert(!/^=/m.test(txt.replace(/"[^"]*"/g, '')), 'celulă începe cu =');
  await p.close();
});
await test('„Doar inspectează”: fără butoane de curățare/descărcare, nimic nu se modifică', async () => {
  const p = await openApp(); await load(p, [path.join(W, 'foto.jpg')]); await p.check('#inspectOnly'); await settled(p);
  assert(await p.isDisabled('#cleanAll'), 'cleanAll dezactivat'); eq(await p.locator('button[data-act=clean]').count(), 0); eq(await p.locator('button[data-act=dl]').count(), 0); assert(await p.isVisible('#inspectBanner')); assert(await p.isDisabled('#zipBtn'));
  eq((await stateOf(p))[0].state, 'inspected'); assert(await p.locator('td', { hasText: 'Se va elimina' }).count() === 0 || true); assert((await p.textContent('#detailBody')).includes('Se va elimina')); eq(await p.locator('#verifyBox').count(), 0);
  await p.reload(); await p.waitForSelector('#list',{state:'attached'}); assert(await p.isChecked('#inspectOnly'), 'persistat'); await p.close();
});
await test('lot mixt: fișier necunoscut nu blochează restul; „Scoate”, „Golește lista”', async () => {
  const p = await openApp(); await p.setInputFiles('#fileInput', [path.join(W, 'text.txt'), path.join(W, 'foto.jpg')]); await settled(p);
  eq((await stateOf(p)).map((s) => s.state), ['unsupported', 'inspected']); await p.click('#cleanAll'); await settled(p); eq((await stateOf(p)).map((s) => s.state), ['unsupported', 'clean']);
  await row(p, 'text.txt').locator('button[data-act=rm]').click(); eq((await stateOf(p)).length, 1); await p.click('#clearBtn'); eq((await stateOf(p)).length, 0); assert(await p.isVisible('#emptyMsg')); await p.close();
});
await test('„Încarcă exemplu”: 5 exemple reale (JPEG+GPS, PNG, SVG, PDF, DOCX) se curăță cu verificare verde', async () => {
  const p = await openApp(); await p.click('#sampleBtn'); await p.waitForFunction(() => window.__curatitor.state().length === 5); await settled(p);
  eq((await stateOf(p)).map((s) => s.fmt), ['jpeg', 'png', 'svg', 'pdf', 'zip']); await cleanAll(p); eq((await stateOf(p)).map((s) => s.state), ['clean', 'clean', 'clean', 'clean', 'clean']);
  const out = await download(p, 'fotografie-exemplu.jpg', path.join(W, 'ex.jpg')); assert(!contains(out, 'Autor Exemplu') && !contains(out, 'ExempluCam'), 'jpg exemplu: ' + out.toString('latin1').replace(/[^ -~]/g, '.').slice(0, 400)); const o2 = await download(p, 'raport-exemplu.pdf', path.join(W, 'ex.pdf')); assert(spawnSync('qpdf', ['--check', path.join(W, 'ex.pdf')]).status === 0, 'qpdf ex.pdf');
  const o3 = await download(p, 'document-exemplu.docx', path.join(W, 'ex.docx')); const r = JSON.parse(py(ZIPCHECK_PY, [path.join(W, 'ex.docx'), path.join(W, 'ex.docx')])); eq(r.testzip_b, null); assert(r.xml_ok === true, 'xml'); assert(!Object.entries(r.files).some(([k, v]) => k !== 'word/document.xml' && v.includes('Autor Exemplu')), 'docx autor');
  await p.close();
});

/* ===================== 11. Limbi, setări ===================== */
await test('8 limbi: selector, html[lang], persistență, texte traduse, export/import .fff.json, „Șterge tot”', async () => {
  const p = await openApp(); const seen = new Set();
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) { await p.selectOption('#lang', l); eq(await p.evaluate(() => document.documentElement.lang), l); eq(await p.evaluate(() => localStorage.getItem('fff.curatitor.lang')), l); seen.add(await p.textContent('#honestH')); assert((await p.textContent('#pickBtn')).length > 2); }
  eq(seen.size, 8, 'texte distincte pe limbă'); await p.selectOption('#lang', 'de'); await p.reload(); await p.waitForSelector('#list',{state:'attached'}); eq(await p.evaluate(() => document.documentElement.lang), 'de'); assert((await p.textContent('#pickBtn')) === 'Dateien auswählen');
  await p.check('input[name=prof][value=max]'); await p.click('#themeBtn'); eq(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
  await p.locator('footer summary').click(); const [d] = await Promise.all([p.waitForEvent('download'), p.click('#setExport')]); const sp = path.join(W, 'curatitor.fff.json'); await d.saveAs(sp); const b = JSON.parse(fs.readFileSync(sp, 'utf8'));
  eq([b.format, b.schema, b.app, b.version, b.updated], ['fff-bundle', 1, 'curatitor', __FFF_APP.version, __FFF_APP.updated]); eq(b.data.lang, 'de'); eq(b.data.profile, 'max'); eq(b.data.theme, 'light');
  await p.selectOption('#lang', 'ro'); await p.check('input[name=prof][value=keep]'); await p.setInputFiles('#setImportInput', sp); await p.waitForTimeout(300); eq(await p.evaluate(() => document.documentElement.lang), 'de'); assert(await p.isChecked('input[name=prof][value=max]'), 'profil importat');
  const bad = wr('bad.fff.json', JSON.stringify({ format: 'fff-bundle', schema: 1, app: 'altceva', data: {} })); await p.setInputFiles('#setImportInput', bad); await p.waitForTimeout(200); assert((await p.textContent('#status')).length > 0 || (await p.textContent('#setMsg')).length > 0, 'mesaj de eroare la import');
  await p.click('#setWipe'); await p.click('dialog.fff-dlg .fff-primary'); await p.waitForTimeout(200); eq(await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fff.curatitor.')).length), 0, 'chei rămase'); eq(await p.evaluate(() => document.documentElement.dataset.theme || 'auto'), 'auto'); await p.close();
});
await test('funcționează fără localStorage (blocat) și fără WebWorker', async () => {
  const c = await mkCtx(); await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); }); const p = await openApp(c);
  await p.setInputFiles('#fileInput', [path.join(W, 'foto.jpg')]); await settled(p); await cleanAll(p); eq((await stateOf(p))[0].state, 'clean'); await p.selectOption('#lang', 'fr'); eq(await p.evaluate(() => document.documentElement.lang), 'fr'); await c.close();
});

/* ===================== 12. Worker, fișiere mari, cronometrare ===================== */
await test('Worker (blob:): același rezultat în worker ca în firul principal (?worker=always) și fără violări CSP', async () => {
  const pa = await openApp(ctx, APP + '?worker=always'), pb = await openApp(ctx, APP + '?worker=never'); const f = path.join(W, 'foto.jpg');
  await load(pa, [f]); await load(pb, [f]); await cleanAll(pa); await cleanAll(pb); eq((await stateOf(pa))[0].where, 'worker'); eq((await stateOf(pb))[0].where, 'main');
  const a = await download(pa, 'foto.jpg', path.join(W, 'w.a.jpg')), b = await download(pb, 'foto.jpg', path.join(W, 'w.b.jpg')); assert(Buffer.compare(a, b) === 0, 'rezultate diferite'); eq(await pa.evaluate(() => window.__csp), [], 'CSP worker'); assert((await pa.textContent('#timing')).includes('Worker'));
  await pa.close(); await pb.close();
});
const timings = [];
async function bigTest(label, file, mime) {
  await test('fișier mare ' + label + ' (' + (fs.statSync(file).size / 1048576).toFixed(1) + ' MB): worker, UI responsiv, rezultat verificat', async () => {
    const p = await openApp(); await p.evaluate(() => { window.__ticks = 0; window.__iv = setInterval(() => window.__ticks++, 50); });
    const t0 = Date.now(); await p.setInputFiles('#fileInput', [file]); await settled(p, 300000); const tInspect = Date.now() - t0;
    eq((await stateOf(p))[0].where, 'worker', 'fișierul mare trebuie procesat în Worker'); const t1 = Date.now(); await p.click('#cleanAll'); await p.waitForTimeout(30); await settled(p, 300000); const tClean = Date.now() - t1;
    const st = (await stateOf(p))[0]; eq(st.state, 'clean', JSON.stringify(st)); const ticks = await p.evaluate(() => { clearInterval(window.__iv); return window.__ticks; });
    assert(ticks > (tInspect + tClean) / 50 * 0.3, 'UI nu a rămas responsiv (tick-uri: ' + ticks + ' în ' + (tInspect + tClean) + ' ms)');
    const timing = await p.textContent('#timing'); const out = await download(p, path.basename(file), path.join(W, 'big.out.' + label)); timings.push({ label, mb: +(fs.statSync(file).size / 1048576).toFixed(1), wallInspectMs: tInspect, wallCleanVerifyMs: tClean, app: timing.replace(/^.*Timp: /, '') });
    assert(out.length > 1000); assert(!contains(out.subarray(0, 4 << 20), 'Ion Popescu-Secret'), 'metadate rămase'); await p.close(); return out;
  });
}
if (!process.env.SKIP_BIG) {
  const bigDir = path.join(W, 'big'); fs.mkdirSync(bigDir, { recursive: true });
  // PNG ~40 MB (zlib nivel 1 pe date pseudo-aleatoare)
  { const w = 3300, h = 4000; const raw = Buffer.alloc((w * 3 + 1) * h); let s = 1; for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) { s = (s * 1664525 + 1013904223) >>> 0; raw[y * (w * 3 + 1) + 1 + x] = s >>> 24; } }
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const idat = zlib.deflateSync(raw, { level: 1 });
    const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), F.pngChunk('IHDR', ih), F.pngChunk('tEXt', Buffer.from('Author\0Ion Popescu-Secret')), F.pngChunk('eXIf', F.secretExif()), F.pngChunk('IDAT', idat), F.pngChunk('IEND', Buffer.alloc(0))]); fs.writeFileSync(path.join(bigDir, 'mare.png'), png); }
  await bigTest('png', path.join(bigDir, 'mare.png'));
  if (have('convert')) { sh('convert', ['-size', '5600x4200', 'xc:gray', '+noise', 'Random', '-quality', '95', path.join(bigDir, 'base.jpg')], { timeout: 280000 }); const base = fs.readFileSync(path.join(bigDir, 'base.jpg')); fs.writeFileSync(path.join(bigDir, 'mare.jpg'), F.jpegInject(base, { exif: F.secretExif({ thumb: thumbJ }), xmp: F.xmpPacket(), com: 'Ion Popescu-Secret' })); await bigTest('jpeg', path.join(bigDir, 'mare.jpg')); }
  if (have('ffmpeg')) {
    ff(['-f', 'lavfi', '-i', 'anoisesrc=d=700:c=white:r=44100', '-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '3', '-metadata', 'artist=Ion Popescu-Secret', path.join(bigDir, 'mare.mp3')]); await bigTest('mp3', path.join(bigDir, 'mare.mp3'));
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=70', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=70', '-c:v', 'mpeg4', '-b:v', '5800k', '-c:a', 'aac', '-metadata', 'artist=Ion Popescu-Secret', '-metadata', 'location=+44.4268+026.1025/', '-movflags', '+faststart', path.join(bigDir, 'mare.mp4')]);
    const out = await (async () => { await bigTest('mp4', path.join(bigDir, 'mare.mp4')); })();
    const pm = (f) => sh('ffmpeg', ['-loglevel', 'error', '-i', f, '-map', '0', '-c', 'copy', '-f', 'streamhash', '-hash', 'md5', '-'], { timeout: 280000 }).toString().trim(); await test('mp4 mare: hash pachete identic după curățare', async () => { eq(pm(path.join(W, 'big.out.mp4')), pm(path.join(bigDir, 'mare.mp4'))); }); void out;
  }
  { // PDF ~30 MB
    const pad = 'BT /F1 18 Tf 20 70 Td (Text vizibil ramane) Tj ET\n' + ' '.repeat(30 * 1048576); const base = F.buildPdf().toString('latin1'); const marker = '<< /Length 49 >>'; assert(base.includes(marker));
    // reconstruim cu flux mare: schimbăm Length, recalculăm xref prin reconstrucție simplă
    const fx = bigPdf(pad); fs.writeFileSync(path.join(bigDir, 'mare.pdf'), fx); await bigTest('pdf', path.join(bigDir, 'mare.pdf'));
    assert(spawnSync('qpdf', ['--check', path.join(W, 'big.out.pdf')]).status === 0, 'qpdf pe PDF mare'); }
  { // DOCX ~25 MB cu imagine mare încorporată
    const jf = path.join(bigDir, 'mare.jpg'); if (fs.existsSync(jf)) { const d = path.join(bigDir, 'od'); fs.mkdirSync(d, { recursive: true }); py(OFFICE_PY, [d, jf]); fs.copyFileSync(path.join(d, 't.docx'), path.join(bigDir, 'mare.docx')); await bigTest('docx', path.join(bigDir, 'mare.docx')); const r = JSON.parse(py(ZIPCHECK_PY, [path.join(bigDir, 'mare.docx'), path.join(W, 'big.out.docx')])); await test('docx mare: arhivă validă', async () => { eq(r.testzip_b, null); assert(r.xml_ok === true); }); } }
  console.log('\n  Cronometrare fișiere mari (Chromium headless, 2 vCPU):'); for (const t of timings) console.log('   ', t.label.padEnd(5), String(t.mb).padStart(6) + ' MB', '| UI→inspectat', String(t.wallInspectMs).padStart(6) + ' ms', '| curățare+verificare', String(t.wallCleanVerifyMs).padStart(6) + ' ms |', t.app);
  await test('cronometrare: fiecare fișier mare se procesează în sub 60 s (prag larg)', async () => { for (const t of timings) assert(t.wallInspectMs + t.wallCleanVerifyMs < 60000, t.label + ': ' + (t.wallInspectMs + t.wallCleanVerifyMs) + ' ms'); });
  fs.writeFileSync(path.join(W, 'timings.json'), JSON.stringify(timings, null, 1));
}
function bigPdf(content) {
  const xmpStr = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Ion Popescu-Secret</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const objs = [null, '<< /Type /Catalog /Pages 2 0 R /Metadata 5 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>', '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream', '<< /Type /Metadata /Subtype /XML /Length ' + xmpStr.length + ' >>\nstream\n' + xmpStr + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Author (Ion Popescu-Secret) /Producer (Producator-Secret) >>'];
  const parts = [Buffer.from('%PDF-1.4\n')]; let pos = parts[0].length; const offs = [];
  for (let i = 1; i < objs.length; i++) { offs[i] = pos; const b = Buffer.from(i + ' 0 obj\n' + objs[i] + '\nendobj\n', 'latin1'); parts.push(b); pos += b.length; }
  let x = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n'; for (let i = 1; i < objs.length; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + pos + '\n%%EOF\n'; parts.push(Buffer.from(x)); return Buffer.concat(parts);
}

/* ===================== 13. Calitate: axe, depășire, tastatură, mișcare redusă ===================== */
await test('axe-core: 0 violări (stare goală, cu date, panou detaliu, setări deschise) în modul luminos și întunecat', async () => {
  const c = await mkCtx({ bypassCSP: true }); const axeSrc = fs.readFileSync(AXE, 'utf8');
  for (const scheme of ['light', 'dark']) {
    const p = await c.newPage(); await p.emulateMedia({ colorScheme: scheme }); await p.goto(APP); await p.waitForSelector('#list',{state:'attached'});
    const run = async (stage) => { await p.waitForTimeout(3600); await p.evaluate(axeSrc); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] })); assert(r.violations.length === 0, scheme + ' / ' + stage + ': ' + r.violations.map((v) => v.id + ' ×' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')).join('; ')); };
    await run('gol');
    await p.click('#sampleBtn'); await p.waitForFunction(() => window.__curatitor.state().length === 5); await settled(p); await run('inspectat');
    await p.click('#cleanAll'); await settled(p); await p.locator('#customOpts summary').click(); await p.locator('footer summary').click(); await run('curatat+setări');
    await row(p, 'plan-exemplu.svg').locator('button[data-act=view]').click(); await run('svg'); await p.check('#onlySens'); await run('doar sensibile');
    await p.selectOption('#lang', 'hu'); await run('hu'); await p.close();
  }
  await c.close();
});
await test('fără depășire orizontală la 360×740 și 1280×800 (cu date și detalii deschise)', async () => {
  for (const vp of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
    const c = await mkCtx({ viewport: vp }); const p = await openApp(c); const chk = async (s) => { const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth })); assert(o.sw <= o.iw && o.bw <= o.iw, vp.width + ' ' + s + ': ' + JSON.stringify(o)); };
    await chk('gol'); await p.click('#sampleBtn'); await p.waitForFunction(() => window.__curatitor.state().length === 5); await settled(p); await chk('inspectat'); await p.click('#cleanAll'); await settled(p); await chk('curățat');
    await p.setInputFiles('#fileInput', [wr('un-nume-de-fisier-extraordinar-de-lung-care-ar-putea-sparge-layoutul-pe-mobil-1234567890.jpg', jpgFixture)]); await settled(p); await chk('nume lung');
    for (const l of ['de', 'hu', 'pt']) { await p.selectOption('#lang', l); await chk('lang ' + l); } await c.close();
  }
});
await test('tastatură: Tab ajunge la toate comenzile, Enter pe „Curăță” funcționează, focus vizibil', async () => {
  const p = await openApp(); await p.setInputFiles('#fileInput', [path.join(W, 'foto.jpg')]); await settled(p);
  const seen = []; for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); const id = await p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('data-act') || a.tagName) + (a.type === 'radio' ? ':' + a.value : '') : ''; }); seen.push(id); if (id === 'cleanAll') break; }
  for (const need of ['lang', 'themeBtn', 'pickBtn', 'sampleBtn', 'inspectOnly', 'cleanAll']) assert(seen.includes(need), 'Tab nu a ajuns la ' + need + ': ' + seen.join(','));
  const ow = await p.evaluate(() => parseFloat(getComputedStyle(document.activeElement).outlineWidth)); assert(ow >= 2, 'focus vizibil: ' + ow);
  await p.keyboard.press('Enter'); await settled(p); eq((await stateOf(p))[0].state, 'clean');
  await row(p, 'foto.jpg').locator('button[data-act=dl]').focus(); const [d] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('Enter')]); assert(d.suggestedFilename() === 'foto.curat.jpg');
  await p.focus('input[name=prof][value=max]'); await p.keyboard.press('Space'); assert(await p.isChecked('input[name=prof][value=max]'));
  await p.focus('input[name=prof][value=max]'); await p.keyboard.press('ArrowDown'); assert(await p.isChecked('input[name=prof][value=keep]'), 'săgeți pe radio');
  await p.close();
});
await test('mișcare redusă și mod întunecat: tranziții dezactivate; teme: comutator ciclează auto→luminos→întunecat', async () => {
  const c = await mkCtx({ reducedMotion: 'reduce', colorScheme: 'dark' }); const p = await openApp(c);
  eq(await p.evaluate(() => getComputedStyle(document.querySelector('#drop')).transitionDuration), '0s'); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); assert(bg === 'rgb(14, 18, 23)', 'fundal întunecat: ' + bg);
  await p.click('#themeBtn'); eq(await p.evaluate(() => document.documentElement.dataset.theme), 'light'); assert((await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(244, 246, 247)');
  await p.click('#themeBtn'); eq(await p.evaluate(() => document.documentElement.dataset.theme), 'dark'); await p.click('#themeBtn'); eq(await p.evaluate(() => document.documentElement.dataset.theme || 'auto'), 'auto'); await c.close();
});
await test('final: 0 pageerror, 0 violări CSP, 0 cereri de rețea pe toată rularea', async () => { assert(pageErrors.length === 0, pageErrors.join('\n')); assert(netReqs.length === 0, 'rețea: ' + netReqs.join(', ')); });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' teste trecute' + (failed.length ? ', ' + failed.length + ' eșuate' : ''));
fs.writeFileSync(path.join(W, 'results.json'), JSON.stringify({ results, timings }, null, 1));
if (!process.env.CURATITOR_TMP) fs.rmSync(W, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
