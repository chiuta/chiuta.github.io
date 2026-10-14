// Teste fff-kit · FFF.qr — generator + decodor propriu, comparat cu un decodor de referință independent (jsQR, doar în test).
// Rulare: node fff-kit/test/qr.test.mjs   (cere `npm i jsqr` într-un director temporar și JSQR=<cale>/node_modules/jsqr/dist/jsQR.js; jsQR e Apache-2.0, folosit doar în test)
import {createRequire} from 'module';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), K = path.resolve(here, '..') + '/';
const S = process.env.S || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/';
const JSQR = process.env.JSQR || S + 'tmp_k2/node_modules/jsqr/dist/jsQR.js';
if (!fs.existsSync(JSQR)) { console.error('Lipsește decodorul de referință jsQR (doar pentru test). Rulează `npm i jsqr` într-un director temporar și setează JSQR=<cale>/node_modules/jsqr/dist/jsQR.js'); process.exit(2); }
const OUT = process.env.QR_OUT || S + 'tmp_k2/qr.results.json';

let pass = 0, fail = 0; const results = {};
const ok = (cond, name, info) => { if (cond) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream']});
const ctx = await browser.newContext({viewport: {width: 800, height: 600}});
await ctx.route(/^https?:/, r => r.abort());
const reqs = []; ctx.on('request', r => { if (/^https?:/.test(r.url())) reqs.push(r.url()); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.setContent('<!doctype html><html lang="ro"><body><canvas id="cv"></canvas></body></html>');
await page.addScriptTag({path: K + 'test/core-shim.js'});
const i18n = {qr: JSON.parse(fs.readFileSync(K + 'i18n/qr.json', 'utf8'))};
await page.evaluate(x => { for (const k in x) FFF.registerI18n(k, x[k]); }, i18n);
await page.addScriptTag({path: K + 'src/qr.js'});
await page.addScriptTag({path: JSQR});

/* utilitare în pagină */
await page.evaluate(() => {
  const Q = FFF.qr, enc = s => new TextEncoder().encode(s).length;
  let seed = 123456789;
  window.rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  window.both = (img) => {
    const t0 = performance.now(); const r = Q.decode(img); const t1 = performance.now();
    let j = null; try { j = jsQR(img.data, img.width, img.height, {inversionAttempts: 'attemptBoth'}); } catch (e) { /* ignorat */ }
    return {own: r && r.text, ownMeta: r && {corrected: r.corrected, version: r.version, ecc: r.ecc}, js: j && j.data, ownMs: t1 - t0};
  };
  window.rot = (img, deg, opt) => {                      // transformă imaginea printr-un canvas (rotire, scalare, zgomot, estompare)
    opt = opt || {};
    const sc = opt.scale || 1, w = Math.ceil(img.width * sc), h = Math.ceil(img.height * sc);
    const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
    src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    const R = Math.ceil(Math.hypot(w, h)), cv = document.createElement('canvas'); cv.width = R; cv.height = R;
    const c = cv.getContext('2d', {willReadFrequently: true});
    c.fillStyle = opt.bg || '#fff'; c.fillRect(0, 0, R, R);
    c.imageSmoothingEnabled = true; c.translate(R / 2, R / 2);
    if (opt.shear) c.transform(1, 0, opt.shear, 1, 0, 0);
    c.rotate(deg * Math.PI / 180); c.scale(sc, sc);
    if (opt.blur) c.filter = 'blur(' + opt.blur + 'px)';
    c.drawImage(src, -img.width / 2, -img.height / 2);
    c.filter = 'none';
    const id = c.getImageData(0, 0, R, R), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let v = d[i];
      if (opt.contrast) v = 128 + (v - 128) * opt.contrast;
      if (opt.noise) v += (rnd() - 0.5) * 2 * opt.noise;
      if (opt.invert) v = 255 - v;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v)); d[i + 3] = 255;
    }
    return {width: R, height: R, data: Array.from(d)};
  };
  window.toImg = o => ({width: o.width, height: o.height, data: new Uint8ClampedArray(o.data)});
  window.enc = enc;
});

/* ---------- 1. capacități (valori publicate ISO/IEC 18004) ---------- */
{
  const caps = [[1, 'L', 19], [1, 'M', 16], [1, 'Q', 13], [1, 'H', 9], [5, 'Q', 62], [10, 'M', 216], [20, 'M', 669], [40, 'L', 2956], [40, 'M', 2334], [40, 'Q', 1666], [40, 'H', 1276]];
  const got = await page.evaluate(cs => cs.map(([v, e]) => FFF.qr.matrix('A', {minVersion: v, ecc: e}).dataCodewords), caps);
  caps.forEach((c, i) => ok(got[i] === c[2], 'capacitate v' + c[0] + c[1], {got: got[i], want: c[2]}));
  const m = await page.evaluate(() => { const x = FFF.qr.matrix('x'.repeat(2953), {ecc: 'L'}); return [x.version, FFF.qr.maxBytes]; });
  ok(m[0] === 40 && m[1] === 2953, 'v40-L încape 2953 octeți', m);
  const e = await page.evaluate(() => { try { FFF.qr.matrix('x'.repeat(2954), {ecc: 'L'}); return null; } catch (e) { return {code: e.code, msg: e.message}; } });
  ok(e && e.code === 'qr-too-long' && e.msg !== 'tooLong', 'text prea lung → eroare tradusă', e);
}

/* ---------- 2. toate cele 160 combinații versiune × ECC (la limita capacității) ---------- */
{
  const r = await page.evaluate(() => {
    const out = {n: 0, ownFail: [], jsFail: [], maxOwnMs: 0};
    const base = 'Țară Ștefan ăîâ 0123456789 abcdefghij ';
    for (let v = 1; v <= 40; v++) for (const e of 'LMQH') {
      const cap = FFF.qr.capacity(v, e);
      let t = base.repeat(200).slice(0, cap); while (enc(t) > cap) t = t.slice(0, -1);
      const m = FFF.qr.matrix(t, {ecc: e, minVersion: v, maxVersion: v});
      const img = FFF.qr.render(m, {scale: v > 25 ? 2 : 3, margin: 4}), x = both(img);
      out.n++; out.maxOwnMs = Math.max(out.maxOwnMs, x.ownMs);
      if (x.own !== t) out.ownFail.push([v, e]);
      if (x.js !== t) out.jsFail.push([v, e]);
    }
    return out;
  });
  ok(r.n === 160 && r.ownFail.length === 0, 'round-trip 160 combinații, decodor propriu', r.ownFail);
  results.allVersions = {combinations: r.n, ownFailures: r.ownFail.length, referenceFailures: r.jsFail, maxOwnDecodeMs: Math.round(r.maxOwnMs)};
  // generatorul e corect dacă decodorul independent citește aproape tot
  ok(r.jsFail.length <= 2, 'decodor de referință (jsQR) citește ≥ 158/160', r.jsFail);
}

/* ---------- 3. șiruri variate, toate nivelurile ECC ---------- */
const sampleStrings = await page.evaluate(() => {
  const L = [];
  const lorem = 'Într-o zi însorită, ștefan și țuțea au mers la Brașov, în Piața Sfatului, să bea o cafea; ăsta e un test pentru diacritice: ăâîșțĂÂÎȘȚ. ';
  const b64 = n => { let s = ''; const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; for (let i = 0; i < n; i++) s += a[Math.floor(rnd() * 64)]; return s; };
  L.push('', 'a', 'Salut!', 'HTTPS://EXEMPLU.RO/PAGINA?X=1', 'https://chiuta.github.io/fff-kit/', '0123456789', '12345678901234567890123456789012345678901234567890', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:', 'abc', '€ 12,50 — „citat” «fr» ñ ü ß ő ű', '😀 emoji 🚀 test', '日本語のテキスト', '{"t":"move","seq":12,"i":4}', 'FFF1.o.z.' + b64(120));
  for (const n of [10, 25, 60, 100, 150, 220, 300, 400, 550, 700, 900, 1100, 1300, 1500]) L.push(lorem.repeat(40).slice(0, n));
  for (const n of [50, 200, 450, 600, 900, 1200, 1500]) L.push('FFF1.o.z.' + b64(n));
  for (const n of [30, 300, 1200]) { let s = ''; while (s.length < n) s += Math.floor(rnd() * 10); L.push(s); }
  for (const n of [40, 400, 1000]) { let s = ''; const a = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'; while (s.length < n) s += a[Math.floor(rnd() * 45)]; L.push(s); }
  // șiruri cu octeți mari (UTF-8 multi-octet) până la ~1500 octeți
  L.push(lorem.repeat(12).slice(0, 700) + '😀'.repeat(20));
  return L;
});
{
  let tried = 0, ownBad = 0, jsBad = 0; const bad = [];
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    const r = await page.evaluate(({S, ecc}) => {
      const out = [];
      for (const t of S) {
        if (enc(t) > FFF.qr.capacity(40, ecc)) continue;
        const m = FFF.qr.matrix(t, {ecc});
        const img = FFF.qr.render(m, {scale: 3, margin: 4}), x = both(img);
        out.push({len: enc(t), v: m.version, mode: m.mode, own: x.own === t, js: x.js === t, ms: x.ownMs});
      }
      return out;
    }, {S: sampleStrings, ecc});
    r.forEach(x => { tried++; if (!x.own) { ownBad++; bad.push([ecc, x.len]); } if (!x.js) jsBad++; });
  }
  ok(ownBad === 0, 'șiruri variate × 4 ECC: decodor propriu', bad);
  ok(jsBad <= Math.ceil(tried * 0.02), 'șiruri variate: referință citește ≥ 98%', {jsBad, tried});
  results.strings = {tried, ownFailures: ownBad, referenceFailures: jsBad};
}

/* ---------- 4. moduri și mărimi ---------- */
{
  const r = await page.evaluate(() => {
    const a = FFF.qr.matrix('1234567890123456789012345678901234567890'.repeat(3), {ecc: 'M'}), b = FFF.qr.matrix('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCD'.repeat(3), {ecc: 'M'}), c = FFF.qr.matrix('abcdefghijklmnopqrstuvwxyz0123456789abcd'.repeat(3), {ecc: 'M'});
    const d = FFF.qr.matrix('Țară', {ecc: 'L'}), f = FFF.qr.matrix('123', {mode: 'byte'}), g = FFF.qr.matrix('Țară', {ecc: 'L', eci: true});
    const r2 = FFF.qr.decode(FFF.qr.render(g, {scale: 4}));
    return {a: [a.mode, a.version], b: [b.mode, b.version], c: [c.mode, c.version], d: d.mode, f: f.mode, eci: r2 && r2.text, mask: [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const m = FFF.qr.matrix('Mască ' + k, {mask: k}); const x = FFF.qr.decode(FFF.qr.render(m, {scale: 3})); return x && x.mask === k && x.text === 'Mască ' + k; })};
  });
  ok(r.a[0] === 'numeric' && r.b[0] === 'alnum' && r.c[0] === 'byte', 'alegerea modului', r);
  ok(r.a[1] < r.b[1] && r.b[1] < r.c[1], 'numeric < alfanumeric < octet ca versiune', r);
  ok(r.d === 'byte' && r.f === 'byte', 'UTF-8 și mod forțat octet', r);
  ok(r.eci === 'Țară', 'ECI UTF-8 decodat', r);
  ok(r.mask.every(Boolean), 'toate cele 8 măști forțate se decodează', r.mask);
  const pen = await page.evaluate(() => { const ms = []; for (const s of ['Hello World', 'Țară de Foc 12345', 'FFF1.o.z.eJxFkc1u2zAQhO98Cj']) ms.push(FFF.qr.matrix(s).mask); return ms; });
  results.autoMasks = pen;
}

/* ---------- 5. deteriorare controlată în limita ECC ---------- */
{
  const r = await page.evaluate(() => {
    const out = [], I = FFF.qr._internal;
    const text = 'Test de coroziune: ăîâșț — 0123456789 abcdefghij '.repeat(8).slice(0, 300);
    for (const ecc of ['L', 'M', 'Q', 'H']) for (let trial = 0; trial < 6; trial++) {
      const m = FFF.qr.matrix(text, {ecc}), fn = I.fnMask(m.version), size = m.size, t = Math.floor(m.eccPerBlock / 2);
      // inversează exact t module din zona de date (fiecare afectează cel mult un cuvânt de cod → ≤ t erori per bloc)
      const hit = new Set(); let guard = 0;
      while (hit.size < t && guard++ < 10000) { const x = Math.floor(rnd() * size), y = Math.floor(rnd() * size); if (!fn[y * size + x]) hit.add(y * size + x); }
      const rows = m.rows.map(r => r.slice()); hit.forEach(p => { rows[Math.floor(p / size)][p % size] ^= 1; });
      const img = FFF.qr.render({size, rows}, {scale: 4, margin: 4}), x = both(img);
      out.push({ecc, t, flipped: hit.size, ok: x.own === text, corrected: x.ownMeta && x.ownMeta.corrected, js: x.js === text});
    }
    // peste limită: nu are voie să returneze text greșit
    let wrong = 0, none = 0, n = 0;
    for (const ecc of ['L', 'M', 'Q', 'H']) for (let trial = 0; trial < 6; trial++) {
      const m = FFF.qr.matrix(text, {ecc}), fn = I.fnMask(m.version), size = m.size;
      const rows = m.rows.map(r => r.slice()); let k = 0;
      while (k < size * size / 6) { const x = Math.floor(rnd() * size), y = Math.floor(rnd() * size); if (!fn[y * size + x]) { rows[y][x] ^= 1; k++; } }
      const r2 = FFF.qr.decode(FFF.qr.render({size, rows}, {scale: 3, margin: 4}));
      n++; if (!r2) none++; else if (r2.text !== text) wrong++;
    }
    return {out, wrong, none, n};
  });
  const failed = r.out.filter(x => !x.ok);
  ok(failed.length === 0, 'decodare cu ≤ ⌊ecc/2⌋ erori de cuvânt per bloc (24 cazuri)', failed);
  ok(r.out.every(x => x.corrected > 0), 'câmpul corrected raportează corecții', r.out.map(x => x.corrected));
  ok(r.wrong === 0, 'deteriorare masivă: niciodată text greșit', r);
  results.damage = {cases: r.out.length, decodedOwn: r.out.filter(x => x.ok).length, decodedReference: r.out.filter(x => x.js).length, heavyDamage: {cases: r.n, none: r.none, wrongText: r.wrong}};
}

/* ---------- 5b. rafale (ștergere de zone) cu număr de cuvinte de cod afectate ≤ limita, calculat din aranjarea reală ---------- */
{
  const r = await page.evaluate(() => {
    const I = FFF.qr._internal; let tested = 0, okn = 0; const bad = [];
    const text = 'Rafală de erori: ăîâșț 0123456789 '.repeat(30).slice(0, 700);
    for (const ecc of ['M', 'Q', 'H']) for (let trial = 0; trial < 12; trial++) {
      const m = FFF.qr.matrix(text, {ecc}), size = m.size, fn = I.fnMask(m.version), L = I.layout(m.version, 'LMQH'.indexOf(ecc));
      // harta modul → cuvânt de cod (aceeași parcurgere ca la plasare)
      const cw = new Int32Array(size * size).fill(-1); let i = 0;
      for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!fn[y * size + x] && (i >> 3) < L.raw) { cw[y * size + x] = i >> 3; i++; } } }
      const bw = 3 + Math.floor(rnd() * 6), bh = 3 + Math.floor(rnd() * 6), x0 = Math.floor(rnd() * (size - bw)), y0 = Math.floor(rnd() * (size - bh));
      const rows = m.rows.map(r => r.slice()), hitCw = new Set();
      for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (!fn[y * size + x]) { rows[y][x] ^= 1; hitCw.add(cw[y * size + x]); }
      // câte cuvinte afectate per bloc?
      const perBlock = new Array(L.nb).fill(0);
      hitCw.forEach(c => { const [b] = L.map[c]; perBlock[b]++; });
      const t = Math.floor(L.el / 2);
      if (Math.max(...perBlock) > t) continue;
      tested++;
      const x = FFF.qr.decode(FFF.qr.render({size, rows}, {scale: 4, margin: 4}));
      if (x && x.text === text) okn++; else bad.push([ecc, bw, bh]);
    }
    return {tested, okn, bad};
  });
  ok(r.tested >= 8 && r.okn === r.tested, 'rafale de erori în limita ECC (calculată din aranjarea reală)', r);
  results.burst = r;
}

/* ---------- 6. transformări geometrice / fotometrice ---------- */
{
  const r = await page.evaluate(() => {
    const out = {}, text = 'Transformări: ăîâșț ' + 'x1y2z3 '.repeat(20);
    const m = FFF.qr.matrix(text, {ecc: 'M'}), base = FFF.qr.render(m, {scale: 6, margin: 4});
    const cases = {
      'scară 2': () => FFF.qr.render(m, {scale: 2, margin: 4}), 'scară 8': () => FFF.qr.render(m, {scale: 8, margin: 2}),
      'rot 90': () => rot(base, 90), 'rot 180': () => rot(base, 180), 'rot 270': () => rot(base, 270),
      'rot 15': () => rot(base, 15), 'rot 37 scară 0,6': () => rot(base, 37, {scale: 0.6}), 'rot -22 scară 0,45': () => rot(base, -22, {scale: 0.45}),
      'scară 0,37 (sub 2 px/modul)': () => rot(base, 0, {scale: 0.37}),
      'inversat (alb pe negru)': () => rot(base, 0, {invert: true}),
      'contrast scăzut': () => rot(base, 5, {contrast: 0.25}), 'zgomot ±40': () => rot(base, 0, {noise: 40}),
      'estompare 1,5 px': () => rot(base, 8, {blur: 1.5, scale: 0.7}), 'estompare + zgomot + rot': () => rot(base, 12, {blur: 1.2, noise: 30, scale: 0.6}),
      'forfecare 0,3': () => rot(base, 0, {shear: 0.3, scale: 0.8}), 'forfecare + rot 20': () => rot(base, 20, {shear: -0.25, scale: 0.7})
    };
    for (const k in cases) { const img = cases[k](), x = both(img.data instanceof Uint8ClampedArray ? img : toImg(img)); out[k] = {own: x.own === text, js: x.js === text, ms: Math.round(x.ownMs)}; }
    return out;
  });
  const must = ['scară 2', 'scară 8', 'rot 90', 'rot 180', 'rot 270', 'rot 15', 'rot 37 scară 0,6', 'inversat (alb pe negru)', 'contrast scăzut', 'zgomot ±40', 'forfecare 0,3'];
  must.forEach(k => ok(r[k].own, 'transformare: ' + k, r[k]));
  results.transforms = r;
  ok(Object.values(r).filter(x => x.own).length >= 14, 'transformări: decodor propriu reușește ≥ 14/16', r);
}

/* ---------- 7. SVG și canvas → imagine → decodare ---------- */
{
  const r = await page.evaluate(async () => {
    const t = 'SVG ăîâșț ' + 'abc'.repeat(30);
    const svg = FFF.qr.svg(t, {ecc: 'Q', scale: 3, margin: 3});
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const wellFormed = doc.documentElement.nodeName === 'svg' && !doc.querySelector('parsererror');
    const external = /href|<script|<image|url\(/i.test(svg);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const c = cv.getContext('2d', {willReadFrequently: true}); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0);
    const x = FFF.qr.decode(c.getImageData(0, 0, cv.width, cv.height));
    const cvq = FFF.qr.canvas(t, {ecc: 'H', scale: 4}); const y = FFF.qr.decode(cvq.getContext('2d').getImageData(0, 0, cvq.width, cvq.height));
    const cvs = FFF.qr.canvas(t, {}); const lab = cvs.getAttribute('aria-label');
    return {wellFormed, external, viaSvg: x && x.text === t, viaCanvas: y && y.text === t, label: lab, size: svg.length, aria: /aria-label="[^"]+"/.test(svg)};
  });
  ok(r.wellFormed && !r.external && r.aria, 'SVG valid, fără referințe externe, cu aria-label', r);
  ok(r.viaSvg && r.viaCanvas, 'SVG rasterizat și canvas se decodează', r);
  ok(r.label && r.label !== 'label', 'etichetă tradusă', r.label);
}

/* ---------- 8. scan(File), scan(video), stopScan, cameră doar la cerere ---------- */
{
  const r = await page.evaluate(async () => {
    const out = {}, t = 'Fișier QR ăîâșț ' + 'q'.repeat(60);
    const cv = FFF.qr.canvas(t, {scale: 5, margin: 4});
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    out.fileOwn = (await FFF.qr.scan(new File([blob], 'qr.png', {type: 'image/png'}), {noDetector: true})) === t;
    out.fileAuto = (await FFF.qr.scan(blob)) === t;
    out.detector = typeof BarcodeDetector !== 'undefined';
    const blank = document.createElement('canvas'); blank.width = blank.height = 200; blank.getContext('2d').fillStyle = '#fff'; blank.getContext('2d').fillRect(0, 0, 200, 200);
    out.fileNone = await FFF.qr.scan(await new Promise(res => blank.toBlob(res, 'image/png')));
    // cameră: nu pornește singură
    const v0 = document.createElement('video'); document.body.appendChild(v0);
    try { await FFF.qr.scan(v0); out.notRequested = null; } catch (e) { out.notRequested = {code: e.code, msg: e.message}; }
    // cameră cerută explicit: în mediul de test nu există cameră reală / context → eroare tradusă
    const v1 = document.createElement('video'); document.body.appendChild(v1);
    try { const s = await Promise.race([FFF.qr.scan(v1, {camera: true}), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), {code: 'test-timeout'})), 4000))]); out.camera = {ok: s}; } catch (e) { out.camera = {code: e.code, msg: e.message}; FFF.qr.stopScan(); }
    // flux video (captureStream dintr-un canvas care afișează un QR) → bucla de scanare continuă
    const t2 = 'Din flux video: ' + 'v'.repeat(40);
    const src = FFF.qr.canvas(t2, {scale: 6, margin: 4}), live = document.createElement('canvas'); live.width = src.width; live.height = src.height;
    const lc = live.getContext('2d'); lc.drawImage(src, 0, 0);
    const timer = setInterval(() => { lc.drawImage(src, 0, 0); }, 50);
    const vid = document.createElement('video'); vid.muted = true; vid.setAttribute('playsinline', ''); vid.srcObject = live.captureStream(20); document.body.appendChild(vid);
    await vid.play().catch(() => {});
    const seen = [];
    out.video = await Promise.race([FFF.qr.scan(vid, {noDetector: true, interval: 60, onText: x => seen.push(x), until: x => x === t2}), new Promise(res => setTimeout(() => res('timeout'), 8000))]);
    out.videoOk = out.video === t2; clearInterval(timer);
    // stopScan respinge scanarea în curs
    const vid2 = document.createElement('video'); vid2.muted = true; vid2.srcObject = document.createElement('canvas').captureStream(5); document.body.appendChild(vid2);
    const pr = FFF.qr.scan(vid2, {noDetector: true, interval: 50}).then(() => 'resolved', e => e.code);
    setTimeout(() => FFF.qr.stopScan(), 300);
    out.stopped = await pr;
    return out;
  });
  ok(r.fileOwn && r.fileAuto, 'scan(File) decodează PNG', r);
  ok(r.fileNone === null, 'scan(File) fără QR → null', r.fileNone);
  ok(r.notRequested && r.notRequested.code === 'not-requested' && r.notRequested.msg !== 'notRequested', 'camera nu pornește fără cerere explicită (mesaj tradus)', r.notRequested);
  ok(r.camera && (r.camera.ok !== undefined || (r.camera.code && r.camera.msg && r.camera.msg !== r.camera.code)), 'cameră cerută: succes sau eroare tradusă', r.camera);
  ok(r.videoOk, 'scan(video) pe flux captureStream', r.video);
  ok(r.stopped === 'stopped', 'stopScan() respinge scanarea în curs', r.stopped);
  results.scan = {file: r.fileOwn, video: r.videoOk, barcodeDetectorAvailable: r.detector, camera: r.camera};
}

/* ---------- 9. performanță ---------- */
{
  const r = await page.evaluate(() => {
    const t = 'p'.repeat(2900); const t0 = performance.now(); const m = FFF.qr.matrix(t, {ecc: 'L'}); const t1 = performance.now();
    const img = FFF.qr.render(m, {scale: 3, margin: 4}); const t2 = performance.now(); const x = both(img);
    return {gen: t1 - t0, render: t2 - t1, dec: x.ownMs, v: m.version, ok: x.own === t};
  });
  results.performance = {version40GenerateMs: Math.round(r.gen), version40DecodeMs: Math.round(r.dec)};
  ok(r.ok && r.v === 40 && r.gen < 2000 && r.dec < 4000, 'v40: generare/decodare în timp rezonabil', r);
}

ok(errs.length === 0, '0 pageerror', errs);
ok(reqs.length === 0, '0 cereri de rețea externe', reqs);
await browser.close();
results.summary = {pass, fail};
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`qr.test: ${pass} reușite, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
