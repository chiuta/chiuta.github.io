// Teste Decibel — Playwright (Chromium headless, rețea blocată, microfon simulat). Rulare: node tests/test.mjs [filtru]
// Cerințe: /opt/node-tools (playwright), /opt/pw-browsers/chromium; opțional axe-core (variabila AXE_PATH).
import {createRequire} from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = 'file://' + path.join(HERE, '..', 'index.html');
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'decibel-test-'));
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false, e]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} așteptat ${b} ± ${tol}, obținut ${a}`);
const FAKE = f => ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + f, '--autoplay-policy=no-user-gesture-required'];
const launch = args => chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: args || ['--autoplay-policy=no-user-gesture-required']});

/* ---------- fixture-uri generate în test ---------- */
function writeWav(file, x, fs_ = 48000) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(fs_, 24); b.writeUInt32LE(fs_ * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32768))), 44 + 2 * i);
  fs.writeFileSync(file, b); return file;
}
const readWav = f => { const b = fs.readFileSync(f), n = (b.length - 44) / 2, x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + 2 * i) / 32768; return x; };
const sine = (f, a, sec, fs_ = 48000) => { const x = new Float64Array(Math.round(sec * fs_)); for (let i = 0; i < x.length; i++) x[i] = a * Math.sin(2 * Math.PI * f * i / fs_); return x; };
function fftN(re, im) { // FFT radix-2 independentă (copie proprie a testului)
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2; const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
}
function pinkNode(N, seed, rms) {
  const M = 1 << Math.ceil(Math.log2(N)); let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const re = new Float64Array(M), im = new Float64Array(M);
  for (let k = 1; k < M / 2; k++) { const g = 1 / Math.sqrt(k), ph = 2 * Math.PI * rnd(); re[k] = g * Math.cos(ph); im[k] = g * Math.sin(ph); re[M - k] = re[k]; im[M - k] = -im[k]; }
  fftN(re, im); const x = new Float64Array(N); let e = 0; for (let i = 0; i < N; i++) { x[i] = re[i]; e += x[i] * x[i]; } const sc = rms / Math.sqrt(e / N); for (let i = 0; i < N; i++) x[i] *= sc; return x;
}
const RA = f => { const f2 = f * f; return 12194 ** 2 * f2 * f2 / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); };
const RC = f => { const f2 = f * f; return 12194 ** 2 * f2 / ((f2 + 20.6 ** 2) * (f2 + 12194 ** 2)); };
function refLevels(x, fs_) { // niveluri dBFS Z/A/C de referință, în domeniul frecvență (independent de filtrele aplicației)
  const N = x.length, M = 1 << Math.ceil(Math.log2(N * 2)), out = {};
  for (const [name, R] of [['Z', null], ['A', RA], ['C', RC]]) {
    const re = new Float64Array(M), im = new Float64Array(M); re.set(x); fftN(re, im);
    let e = 0; const r1 = R ? R(1000) : 1;
    for (let k = 0; k < M; k++) { const f = (k <= M / 2 ? k : M - k) * fs_ / M; const w = R ? (f > 0 ? R(f) / r1 : 0) : f / Math.sqrt(f * f + 9); e += (re[k] ** 2 + im[k] ** 2) * w * w; }
    out[name] = 10 * Math.log10(e / (N * M));
  }
  return out;
}
const dbfsRms = x => { let e = 0; for (const v of x) e += v * v; return 10 * Math.log10(e / x.length); };

/* ---------- pagini ---------- */
async function open(browser, o = {}) {
  const ctx = await browser.newContext({viewport: o.viewport || {width: 1280, height: 800}, locale: 'ro-RO', colorScheme: o.scheme || 'light', bypassCSP: !!o.bypassCSP, acceptDownloads: true, reducedMotion: o.reduced ? 'reduce' : 'no-preference'});
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); page.errs = []; page.net = []; page.ctx = ctx;
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/ScriptProcessorNode is deprecated/.test(m.text())) page.errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) page.net.push(u); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); if (window.__init) window.__init(); });
  if (o.init) await page.addInitScript(o.init);
  if (o.goto !== false) await page.goto(URL_APP);
  return page;
}
async function clean(p, label = '') { assert.deepEqual(await p.evaluate(() => window.__csp), [], 'CSP ' + label); assert.deepEqual(p.errs, [], 'erori ' + label); assert.deepEqual(p.net, [], 'rețea ' + label); }
async function loadFile(p, wavPath) {
  await p.evaluate(() => { Decibel.state().sess = null; });
  await p.setInputFiles('#fileIn', wavPath);
  await p.waitForFunction(() => { const s = Decibel.state(); return s.sess && s.sess.n > 0 && !s.running; }, null, {timeout: 60000});
}
const sess = (p, js) => p.evaluate(js);
const ctxs = [];

const browser = await launch();

/* =================== 1. pornire, meta, CSP, limbi =================== */
await T('pornire curată: 0 erori, 0 CSP, 0 rețea, meta și versiune', async () => {
  const p = await open(browser); await p.waitForTimeout(800); await clean(p, 'start');
  assert.equal(await p.getAttribute('meta[name=application-version]', 'content'), '1.0.5');
  assert.equal(await p.getAttribute('meta[name=last-updated]', 'content'), '2026-10-23');
  assert.equal((await p.textContent('#app-version')).trim(), 'v 1.0.5 · 2026-10-23');
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'ro');
  const csp = await p.getAttribute('meta[http-equiv=Content-Security-Policy]', 'content');
  assert.ok(/default-src 'none'/.test(csp) && /connect-src 'none'/.test(csp) && /script-src 'sha256-/.test(csp) && !/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp));
  assert.equal(await p.locator('[onclick],[onchange],[oninput]').count(), 0);
  assert.equal(await p.evaluate(() => navigator.mediaDevices ? 'ok' : 'none') !== undefined, true);
  // microfonul nu se cere la pornire
  assert.equal(await p.evaluate(() => Decibel.state().stream), null);
  await p.ctx.close();
});
await T('8 limbi: selector, html[lang], persistență, fără chei brute', async () => {
  const p = await open(browser);
  const seen = {};
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {
    await p.selectOption('#lang', l);
    assert.equal(await p.evaluate(() => document.documentElement.lang), l);
    seen[l] = await p.textContent('#t-meas');
    const raw = await p.evaluate(() => [...document.querySelectorAll('[data-i18n]')].filter(e => e.textContent.trim() === e.dataset.i18n || !e.textContent.trim()).map(e => e.dataset.i18n));
    assert.deepEqual(raw, [], 'chei netraduse în ' + l);
    for (const tab of ['t-cal', 't-aud', 't-log', 't-about', 't-spec', 't-meas']) await p.click('#' + tab);
  }
  assert.equal(new Set(Object.values(seen)).size >= 6, true);
  await p.selectOption('#lang', 'hu'); await p.reload(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'hu');
  assert.equal(await p.evaluate(() => localStorage.getItem('fff.decibel.lang')), 'hu');
  await clean(p, 'limbi'); await p.ctx.close();
});

/* =================== 2. DSP: ponderări, FFT =================== */
await T('ponderarea A și C: filtru analogic exact vs tabel IEC; filtru digital vs tabel (toleranțe clasa 2) la 44,1/48/96 kHz', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => { const o = {}; for (const fs of [44100, 48000, 96000]) for (const t of ['A', 'C']) o[t + fs] = Decibel.dsp.filterCheck(t, fs); return o; });
  for (const [k, rows] of Object.entries(r)) {
    for (const x of rows) {
      if (x.f >= 20) assert.ok(Math.abs(x.anaDev) <= 0.2, `${k} analog ${x.f}: ${x.anaDev}`);   // rotunjirea tabelului = 0,05 dB
      if (x.inb && x.f >= 20 && x.f <= 4000) assert.ok(Math.abs(x.dev) <= 0.3, `${k} digital ${x.f}: ${x.dev}`);
      if (x.inb && x.f >= 20) assert.ok(x.ok, `${k} în clasa 2 la ${x.f} Hz: abatere ${x.dev}`);
    }
  }
  console.log('       abatere digitală A la 48 kHz (8k/10k/12,5k/16k):', [8000, 10000, 12500, 16000].map(f => r.A48000.find(x => x.f === f).dev.toFixed(2)).join(' '));
  await p.ctx.close();
});
await T('motorul real: răspuns A/C măsurat cu sinusuri pe 1/3 de octavă față de tabel', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => { const D = Decibel.dsp, fs = 48000, o = {}; for (const f of Object.keys(D.TBL_A).map(Number)) { if (f < 20 || f > 8000) continue; const e = new D.Engine(fs), N = fs * 2, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * f * i / fs); e.process(x); o[f] = [e.session.leq(0, 8), e.session.leq(1, 8), e.session.leq(2, 8)]; } return o; });
  const base = 20 * Math.log10(0.1 / Math.SQRT2);
  const tbl = await p.evaluate(() => [Decibel.dsp.TBL_A, Decibel.dsp.TBL_C]);
  for (const [f, v] of Object.entries(r)) {
    const tol = f <= 5000 ? 0.4 : 1.2;
    near(v[0] - base, tbl[0][f], tol, `A ${f} Hz`); near(v[1] - base, tbl[1][f], tol, `C ${f} Hz`);
    if (f >= 40) near(v[2] - base, 0, 0.35, `Z ${f} Hz`);
  }
  await p.ctx.close();
});
await T('FFT: vârf la frecvența corectă, nivel RMS, Parseval pe benzi, zgomot roz plat pe 1/3 de octavă', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => {
    const D = Decibel.dsp, fs = 48000, N = 16384, out = {};
    for (const f of [100, 997.3, 1000, 3150, 8000, 12345]) { const x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = 0.2 * Math.sin(2 * Math.PI * f * i / fs + 0.3); const sp = D.spectrum(x, N, fs), pk = D.findPeak(sp, 20), b = D.bandsFrom(sp, D.THIRD); out[f] = {pk: pk.f, lv: 20 * Math.log10(pk.A), tot: D.toDb(b.reduce((a, v) => a + (isFinite(v) ? v : 0), 0))}; }
    const pn = D.noiseBuffer('pink', 262144, fs, 5); let e = 0; for (const v of pn) e += v * v; const rms = Math.sqrt(e / pn.length);
    const acc = new Float64Array(D.THIRD.length); const M = 8; for (let k = 0; k < M; k++) { const sp = D.spectrum(pn.subarray(k * 32768, k * 32768 + 32768), 32768, fs), b = D.bandsFrom(sp, D.THIRD); b.forEach((v, i) => acc[i] += v / M); }
    return {out, rms, pink: Array.from(acc, v => D.toDb(v)), nom: D.THIRD.map(b => b.nom)};
  });
  const exp = 20 * Math.log10(0.2 / Math.SQRT2);
  for (const [f, v] of Object.entries(r.out)) { near(v.pk, +f, 0.6, 'vârf ' + f); near(v.lv, exp, 0.35, 'nivel vârf ' + f); near(v.tot, exp, 0.1, 'Parseval ' + f); }
  near(r.rms, 1, 1e-6, 'RMS zgomot roz');
  const sel = r.nom.map((n, i) => [n, r.pink[i]]).filter(([n]) => n >= 125 && n <= 8000);
  const mean = sel.reduce((a, [, v]) => a + v, 0) / sel.length;
  for (const [n, v] of sel) near(v, mean, 1.6, 'banda roz ' + n);
  await p.ctx.close();
});

/* =================== 3. niveluri pe fișier (calea de fișier = același motor) =================== */
await T('fișier: sinus 1 kHz — niveluri, SEL, L10/50/90, Lmax/Lmin, doză cu decalaj, jurnal', async () => {
  const w = writeWav(path.join(TMP, 'sin1k.wav'), sine(1000, 0.1, 12));
  const p = await open(browser); await loadFile(p, w);
  const exp = 20 * Math.log10(0.1 / Math.SQRT2);
  const r = await p.evaluate(() => { const s = Decibel.state().sess; return {leq: [0, 1, 2].map(w => s.leq(w, 0)), n: s.n, l10: s.pct(0, 0, 10), l50: s.pct(0, 0, 50), l90: s.pct(0, 0, 90), lmax: s.lmax[0], lmin: s.lmin[0], pk: s.pk[1], clip: s.clipTotal, slow: s.pct(0, 1, 50), lmaxS: s.lmax[1]}; });
  assert.equal(r.n, 96);
  for (const v of r.leq) near(v, exp, 0.08, 'Leq');
  for (const v of [r.l10, r.l50, r.l90]) near(v, exp, 0.5, 'L_N');
  near(10 * Math.log10(r.lmax), exp, 0.1, 'Lmax'); near(10 * Math.log10(r.lmin), exp, 0.1, 'Lmin');
  near(20 * Math.log10(r.pk), 20 * Math.log10(0.1), 0.5, 'LCpeak'); assert.equal(r.clip, 0);
  near(r.slow, exp, 0.5, 'L50 Slow');
  // decalaj manual: LAeq = 88 dB(A)
  const off = 88 - exp; await p.click('#t-cal'); await p.fill('#offIn', String(off)); await p.click('#btnOffApply'); await p.click('#t-meas');
  assert.equal(await p.evaluate(() => Decibel.cal().on), true);
  const txt = id => p.textContent('#' + id);
  const num = s => parseFloat(s.replace(/[^\d,.-]/g, '').replace(',', '.'));
  near(num(await txt('v-leq')), 88, 0.1, 'LAeq afișat'); assert.match(await txt('bigUnit'), /dB\(A\)/);
  near(num(await txt('v-sel')), 88 + 10 * Math.log10(12), 0.15, 'SEL');
  // doză: D = 100 * T/8h * 2^((88-85)/3)
  const D = 100 * 12 / 28800 * 2; near(num(await txt('v-dose')), D, 0.006, 'doză 85/8h/3');
  await p.selectOption('#dosePre', 'eu80'); near(num(await txt('v-dose')), 100 * 12 / 28800 * 2 ** (8 / 3), 0.01, 'doză 80/8h/3');
  await p.fill('#doseQ', '5'); await p.fill('#doseLc', '90'); near(num(await txt('v-dose')), 100 * 12 / 28800 * 2 ** (-2 / 5), 0.006, 'doză 90/8h/5');
  assert.equal(await p.inputValue('#dosePre'), 'custom');
  const allowed = await txt('v-doseAllowed'); assert.match(allowed, /\d+:\d\d:\d\d/);
  // jurnal: salvat automat
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.decibel.sessions')));
  assert.equal(log.length, 1); near(log[0].laeq, exp, 0.1); near(log[0].dur, 12, 0.01); assert.equal(log[0].source, 'file'); assert.ok(log[0].series.length > 0);
  await clean(p, 'fișier'); await p.ctx.close();
});
await T('fișier: zgomot roz — LAeq/LCeq/LZeq față de referința în domeniul frecvență', async () => {
  const x = pinkNode(240000, 77, 0.05), w = writeWav(path.join(TMP, 'pink.wav'), x), q = readWav(w), ref = refLevels(q, 48000);
  const p = await open(browser); await loadFile(p, w);
  const r = await p.evaluate(() => { const s = Decibel.state().sess; return [0, 1, 2].map(k => s.leq(k, 0)); });
  near(r[2], ref.Z, 0.1, 'Z'); near(r[0], ref.A, 0.25, 'A'); near(r[1], ref.C, 0.25, 'C');
  console.log('       roz: Z/A/C măsurat', r.map(v => v.toFixed(2)).join('/'), ' referință', ref.Z.toFixed(2), ref.A.toFixed(2), ref.C.toFixed(2));
  await p.ctx.close();
});
await T('motor: impulsuri și constante de timp Fast/Slow, Leq pe buclă, LCpeak (forme închise)', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => {
    const D = Decibel.dsp, fs = 48000, e = new D.Engine(fs), loop = new Float32Array(4 * fs);
    for (let i = 0; i < 1.5 * fs; i++) loop[Math.round(0.5 * fs) + i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / fs);
    for (let i = 0; i < 0.02 * fs; i++) loop[Math.round(3 * fs) + i] = 0.9 * Math.sin(2 * Math.PI * 1000 * i / fs);
    for (let k = 0; k < 4; k++) e.process(loop);
    const s = e.session; const o = {loopLeq: s.leq(2, 32), lmaxF: D.toDb(s.lmax[4]), lmaxS: D.toDb(s.lmax[5]), pkC: 20 * Math.log10(s.pk[1]), lmaxFA: D.toDb(s.lmax[0])};
    const e2 = new D.Engine(fs), x = new Float32Array(6 * fs); for (let i = 0; i < 0.02 * fs; i++) x[3.5 * fs + i] = 0.9 * Math.sin(2 * Math.PI * 1000 * i / fs); e2.process(x); o.click = D.toDb(e2.session.lmax[4]); o.clickS = D.toDb(e2.session.lmax[5]);
    return o;
  });
  const burstL = 10 * Math.log10(0.125 * 1.5 / 4 + 0.405 * 0.02 / 4);                // energie pe buclă: burst 1,5 s + click 20 ms
  near(r.loopLeq, burstL, 0.1, 'Leq buclă'); near(r.lmaxF, 10 * Math.log10(0.125), 0.12, 'LZFmax'); near(r.lmaxFA, 10 * Math.log10(0.125), 0.15, 'LAFmax');
  near(r.lmaxS, 10 * Math.log10(0.125 * (1 - Math.exp(-1.5))), 0.12, 'LZSmax');
  near(r.pkC, 20 * Math.log10(0.9), 0.7, 'LCpeak');
  near(r.click, 10 * Math.log10(0.405 * (1 - Math.exp(-0.02 / 0.125))), 0.5, 'click Fast');
  near(r.clickS, 10 * Math.log10(0.405 * (1 - Math.exp(-0.02 / 1))), 0.5, 'click Slow');
  await p.ctx.close();
});
await T('saturație: eșantioane la limită detectate, avertisment, fără false pozitive', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => { const D = Decibel.dsp, fs = 48000; const mk = a => { const e = new D.Engine(fs), x = new Float32Array(fs * 2); for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, a * Math.sin(2 * Math.PI * 440 * i / fs))); e.process(x); return e.session.clipTotal; }; return [mk(0.9), mk(1.5)]; });
  assert.equal(r[0], 0); assert.ok(r[1] > 1000);
  const w = writeWav(path.join(TMP, 'clip.wav'), sine(440, 1.6, 8).map(v => Math.max(-1, Math.min(1, v))));
  await loadFile(p, w); await p.waitForTimeout(300);
  assert.equal(await p.isVisible('#clipWarn'), true); assert.match(await p.textContent('#clipWarn'), /Saturați|saturări/i);
  assert.ok(+(await p.textContent('#v-clip')) > 1000);
  await p.ctx.close();
});
await T('marcaje de eveniment, cursor, ferestre grafic, setări ponderare/timp', async () => {
  const p = await open(browser); await loadFile(p, writeWav(path.join(TMP, 'sin1k_b.wav'), sine(1000, 0.1, 10)));
  await p.click('#btnLoad').catch(() => {});
  await p.click('#btnDemo'); await p.waitForFunction(() => !Decibel.state().running && Decibel.state().sess.source === 'demo', null, {timeout: 60000});
  await p.fill('#cursor', '500'); await p.dispatchEvent('#cursor', 'input');
  assert.match(await p.textContent('#cursorOut'), /t = \d+:\d\d/);
  await p.click('#btnLive'); assert.match(await p.textContent('#cursorOut'), /Cursor/);
  for (const v of ['480', '4800', '0']) { await p.selectOption('#viewSel', v); }
  await p.check('input[name=wt][value="1"]'); await p.check('input[name=tw][value="1"]'); await p.check('input[name=wt][value="2"]');
  assert.match(await p.textContent('#k-lmax'), /LZSmax/);
  const px = await p.evaluate(() => { const c = document.getElementById('chart'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; const b = [d[0], d[1], d[2]]; for (let i = 0; i < d.length; i += 4) if (d[i] !== b[0] || d[i + 1] !== b[1] || d[i + 2] !== b[2]) n++; return n; });
  assert.ok(px > 500, 'grafic desenat');
  await p.ctx.close();
});

/* =================== 4. microfon simulat (Chromium fake device) =================== */
const wSine = writeWav(path.join(TMP, 'mic_sine.wav'), sine(1000, 0.1, 2));
await T('microfon simulat: sinus 1 kHz — nivel RMS, AGC/echo/zgomot verificate, spectru, vârf, jurnal, calibrare + profil persistent', async () => {
  const b = await launch(FAKE(wSine)); const p = await open(b);
  assert.equal(await p.evaluate(() => Decibel.state().stream), null);
  await p.click('#btnMic');
  await p.waitForFunction(() => Decibel.state().running, null, {timeout: 15000});
  assert.match(await p.textContent('#micStatus'), /Microfon activ/);
  assert.equal((await p.textContent('#micStatus')).includes('nedorit'), false);
  const mc = await p.evaluate(() => Decibel.state().micChecks); assert.deepEqual([mc.echo, mc.ns, mc.agc], [false, false, false]);
  assert.match(await p.textContent('#chips'), /Procesări browser: dezactivate/);
  await p.waitForFunction(() => Decibel.state().sess.n > 90, null, {timeout: 30000});
  const exp = 20 * Math.log10(0.1 / Math.SQRT2);
  const lv = await p.evaluate(() => { const s = Decibel.state().sess, e = Decibel.state().eng; return {z: s.leq(2, 64), a: s.leq(0, 64), fs: e.fs, clip: s.clipTotal}; });
  near(lv.z, exp, 0.12, 'Z microfon'); near(lv.a, exp, 0.2, 'A microfon'); assert.equal(lv.clip, 0);
  // spectru
  await p.click('#t-spec'); await p.waitForTimeout(700);
  const pk = await p.evaluate(() => Decibel.specPeak().f); near(pk, 1000, 1.5, 'vârf FFT 1 kHz');
  const vals = await p.evaluate(() => Array.from(Decibel.specVals())); const idx = vals.indexOf(Math.max(...vals)); assert.equal(await p.evaluate(i => Decibel.dsp.THIRD[i].nom, idx), 1000);
  await p.check('input[name=sm][value="oct"]'); await p.waitForTimeout(400);
  const vo = await p.evaluate(() => Array.from(Decibel.specVals())); assert.equal(await p.evaluate(i => Decibel.dsp.OCT[i].nom, vo.indexOf(Math.max(...vo))), 1000);
  await p.check('input[name=sm][value="fft"]'); await p.waitForTimeout(400);
  near(await p.evaluate(() => Decibel.specPeak().f), 1000, 1.5);
  await p.selectOption('#spX', 'lin'); await p.selectOption('#spAvg', 'hold'); await p.waitForTimeout(300); await p.selectOption('#spAvg', 'exp'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => Decibel.SG().cols.length) > 10, 'spectrogramă');
  await p.check('input[name=sm][value="third"]'); await p.selectOption('#spAvg', 'inst');
  // calibrare cu asistent: referință 94 dB
  await p.click('#t-cal'); await p.fill('#refLvl', '94'); await p.selectOption('#refW', '0'); await p.fill('#profName', 'Mic de test');
  await p.click('#btnCalMeas'); await p.waitForFunction(() => !document.getElementById('btnCalApply').disabled, null, {timeout: 30000});
  assert.match(await p.textContent('#calRes'), /decalaj calculat/);
  await p.click('#btnCalApply');
  const cal = await p.evaluate(() => Decibel.cal()); near(cal.offset, 94 - exp, 0.3, 'offset calibrare'); assert.equal(cal.on, true); assert.equal(cal.method, 'calibrator');
  await p.click('#t-meas'); await p.waitForTimeout(1500);
  const big = parseFloat((await p.textContent('#bigVal')).replace(',', '.')); near(big, 94, 0.5, 'nivel calibrat afișat'); assert.match(await p.textContent('#uncText'), /±8/)  /* 94 dB > 90: ±3 + 5 */;
  // oprire → jurnal
  await p.click('#btnStop'); await p.waitForFunction(() => !Decibel.state().running);
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.decibel.sessions'))); assert.equal(log.length, 1); assert.equal(log[0].source, 'mic'); assert.equal(log[0].cal, true);
  assert.equal(await p.evaluate(() => Decibel.state().stream), null);
  // profil persistent la reîncărcare
  await p.reload(); await p.waitForTimeout(300);
  const cal2 = await p.evaluate(() => Decibel.cal()); assert.equal(cal2.on, true); near(cal2.offset, cal.offset, 1e-9);
  const profs = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.decibel.profiles'))); assert.equal(profs.length, 1); assert.equal(profs[0].name, 'Mic de test'); assert.match(profs[0].mic, /Fake/);
  // la repornire, profilul se regăsește după eticheta microfonului
  await p.evaluate(() => { localStorage.setItem('fff.decibel.cal', JSON.stringify({on: false, offset: 0})); }); await p.reload();
  await p.click('#btnMic'); await p.waitForFunction(() => Decibel.state().running); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => Decibel.cal().on), true, 'profil regăsit automat'); assert.match(await p.textContent('#micStatus'), /Profil de calibrare regăsit/);
  await p.click('#btnStop');
  await clean(p, 'microfon'); await p.ctx.close(); await b.close();
});
await T('microfon simulat: impulsuri/burst — LAFmax, LASmax, LCpeak, LAeq pe buclă', async () => {
  const x = new Float64Array(4 * 48000); for (let i = 0; i < 1.5 * 48000; i++) x[24000 + i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / 48000);
  for (let i = 0; i < 0.02 * 48000; i++) x[144000 + i] = 0.9 * Math.sin(2 * Math.PI * 1000 * i / 48000);
  const w = writeWav(path.join(TMP, 'burst.wav'), x); const b = await launch(FAKE(w)); const p = await open(b);
  await p.click('#btnMic'); await p.waitForFunction(() => Decibel.state().running && Decibel.state().sess.n > 150, null, {timeout: 40000});
  const r = await p.evaluate(() => { const s = Decibel.state().sess, D = Decibel.dsp; return {leq: s.leq(2, 64), f: D.toDb(s.lmax[4]), sl: D.toDb(s.lmax[5]), pk: 20 * Math.log10(s.pk[1]), laf: D.toDb(s.lmax[0])}; });
  near(r.f, 10 * Math.log10(0.125), 0.3, 'LZFmax'); near(r.sl, 10 * Math.log10(0.125 * (1 - Math.exp(-1.5))), 0.35, 'LZSmax');
  near(r.pk, 20 * Math.log10(0.9), 0.8, 'LCpeak'); near(r.leq, 10 * Math.log10(0.125 * 1.5 / 4 + 0.405 * 0.02 / 4), 0.3, 'Leq buclă');
  await p.click('#btnMark'); await p.keyboard.press('Escape'); await p.focus('#placeIn'); await p.keyboard.press('m');   // „m” în câmp text nu marchează
  assert.equal(await p.evaluate(() => Decibel.state().sess.events.length), 1);
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('m');
  assert.equal(await p.evaluate(() => Decibel.state().sess.events.length), 2);
  assert.equal(await p.locator('#evList li').count(), 2);
  await p.click('#btnStop'); await p.ctx.close(); await b.close();
});
await T('microfon simulat: zgomot roz — LAeq/LCeq față de referința în domeniul frecvență', async () => {
  const x = pinkNode(192000, 4242, 0.04), w = writeWav(path.join(TMP, 'mic_pink.wav'), x), q = readWav(w), ref = refLevels(q, 48000);
  const b = await launch(FAKE(w)); const p = await open(b);
  await p.click('#btnMic'); await p.waitForFunction(() => Decibel.state().running && Decibel.state().sess.n > 110, null, {timeout: 40000});
  const r = await p.evaluate(() => { const s = Decibel.state().sess; return [0, 1, 2].map(k => s.leq(k, 64)); });
  near(r[2], ref.Z, 0.5, 'Z roz'); near(r[0], ref.A, 0.5, 'A roz'); near(r[1], ref.C, 0.5, 'C roz');
  console.log('       roz (mic, fs 44,1/48k): ', r.map(v => v.toFixed(2)).join('/'), ' ref ', ref.Z.toFixed(2), ref.A.toFixed(2), ref.C.toFixed(2));
  await p.click('#btnStop'); await p.ctx.close(); await b.close();
});
await T('microfon simulat: saturație detectată în timp real', async () => {
  const w = writeWav(path.join(TMP, 'mic_clip.wav'), sine(500, 3, 2).map(v => Math.max(-1, Math.min(1, v)))); const b = await launch(FAKE(w)); const p = await open(b);
  await p.click('#btnMic'); await p.waitForFunction(() => Decibel.state().running && Decibel.state().sess.n > 30, null, {timeout: 30000});
  assert.equal(await p.isVisible('#clipWarn'), true); assert.ok(+(await p.textContent('#v-clip')) > 500);
  await p.click('#btnStop'); await p.ctx.close(); await b.close();
});
await T('microfon: lipsă (fără dispozitiv), refuzat, ocupat, procesări neconfirmate — refuz grațios', async () => {
  const b = await launch(); let p = await open(b);
  await p.click('#btnMic'); await p.waitForFunction(() => /găsit|nu oferă|refuzat/i.test(document.getElementById('micStatus').textContent), null, {timeout: 15000});
  assert.match(await p.textContent('#micStatus'), /Nu s-a găsit niciun microfon|refuzat|nu oferă/);
  assert.equal(await p.evaluate(() => Decibel.state().running), false); assert.equal(await p.isVisible('#btnMic'), true);
  await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});   // aplicația rămâne utilizabilă
  await p.ctx.close();
  for (const [name, re] of [['NotAllowedError', /refuzat/], ['NotReadableError', /nu poate fi folosit/], ['NotFoundError', /Nu s-a găsit/], ['SecurityError', /refuzat/]]) {
    p = await open(b, {init: `navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', '${name}'));`});
    await p.click('#btnMic'); await p.waitForFunction(() => /\S/.test(document.getElementById('micStatus').textContent) && !/Se așteaptă/.test(document.getElementById('micStatus').textContent));
    assert.match(await p.textContent('#micStatus'), re, name); assert.match(await p.textContent('#micStatus'), /fișier audio/); await clean(p, name); await p.ctx.close();
  }
  // browser care nu poate dezactiva AGC: avertisment
  await b.close(); const b2 = await launch(FAKE(wSine));
  p = await open(b2, {init: `(() => { const o = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async c => { const s = await o(c); const t = s.getAudioTracks()[0], g = t.getSettings.bind(t); t.getSettings = () => Object.assign(g(), {autoGainControl: true, noiseSuppression: undefined}); return s; }; })();`});
  await p.click('#btnMic'); await p.waitForFunction(() => Decibel.state().running);
  const st = await p.textContent('#micStatus'); assert.match(st, /ACTIV \(nedorit\)/); assert.match(st, /nu se poate verifica/); assert.match(st, /nu a confirmat/);
  assert.match(await p.textContent('#chips'), /neconfirmate/); await p.click('#btnStop'); await p.ctx.close(); await b2.close();
});

/* =================== 5. calibrare manuală, generator, verificare filtru =================== */
await T('calibrare manuală, eliminare, profiluri (salvare/încărcare/ștergere), incertitudine', async () => {
  const p = await open(browser); await loadFile(p, writeWav(path.join(TMP, 'sin1k_c.wav'), sine(1000, 0.1, 6)));
  const exp = 20 * Math.log10(0.1 / Math.SQRT2);
  const v0 = parseFloat((await p.textContent('#bigVal')).replace(',', '.')); near(v0, exp, 0.2); assert.match(await p.textContent('#bigUnit'), /dBFS\(A\)/);
  await p.click('#t-cal'); assert.match(await p.textContent('#calState'), /Necalibrat/);
  await p.fill('#offIn', '100'); await p.click('#btnOffApply'); await p.click('#t-meas');
  near(parseFloat((await p.textContent('#bigVal')).replace(',', '.')), exp + 100, 0.2, 'cu decalaj 100'); assert.match(await p.textContent('#bigUnit'), /^dB\(A\)/);
  assert.match(await p.textContent('#uncText'), /±5/);       // decalaj introdus manual → incertitudine mai mare
  await p.click('#t-cal'); await p.fill('#profName', 'P1'); await p.click('#btnProfSave');
  await p.fill('#offIn', '50'); await p.click('#btnOffApply'); await p.fill('#profName', 'P2'); await p.click('#btnProfSave');
  assert.equal(await p.locator('#profSel option').count(), 3);
  await p.selectOption('#profSel', {index: 1}); near(await p.evaluate(() => Decibel.cal().offset), 100, 1e-9);
  await p.click('#btnProfDel'); await p.click('#dlgYes'); assert.equal(await p.locator('#profSel option').count(), 2);
  await p.click('#btnOffClear'); assert.equal(await p.evaluate(() => Decibel.cal().on), false);
  await clean(p, 'calibrare'); await p.ctx.close();
});
await T('generator: zgomot roz/alb/sinus la nivel dat; verificarea filtrului în interfață', async () => {
  const p = await open(browser); await p.click('#t-cal');
  const g = await p.evaluate(() => { const D = Decibel.dsp, o = {}; for (const k of ['pink', 'white']) { const x = D.noiseBuffer(k, 262144, 48000, 3); let e = 0; for (const v of x) e += v * v; o[k] = Math.sqrt(e / x.length); } return o; }); near(g.pink, 1, 1e-6); near(g.white, 1, 1e-6);
  for (const [type, amp] of [['pink', 10 ** (-30 / 20)], ['sine', Math.SQRT2 * 10 ** (-30 / 20)]]) {
    await p.selectOption('#genType', type); await p.click('#btnGen'); await p.waitForFunction(() => Decibel.genState().on);
    near(await p.evaluate(() => Decibel.genState().amp), amp, 1e-9); assert.match(await p.textContent('#genState'), /Se redă/);
    await p.click('#btnGen'); assert.equal(await p.evaluate(() => Decibel.genState().on), false);
  }
  await p.click('#btnChkRun'); assert.ok(await p.locator('#chkTbl tbody tr').count() >= 34); assert.match(await p.textContent('#chkSum'), /benzi în toleranța clasei 2/);
  await p.selectOption('#chkW', 'C'); await p.selectOption('#chkFs', '44100'); assert.match(await p.textContent('#chkSum'), /44100/);
  await clean(p, 'generator'); await p.ctx.close();
});

/* =================== 6. audiogramă =================== */
await T('audiogramă: staircase Hughson–Westlake simplificat găsește pragul simulat (±5 dB), plafon de siguranță', async () => {
  const p = await open(browser);
  const r = await p.evaluate(() => { const o = []; for (let T = -88; T <= -20; T += 3) { const st = Decibel.makeStair({start: -40, min: -90, max: -15}); let n = 0; while (!st.done && n++ < 100) st.answer(st.level >= T); o.push([T, st.thr, st.n, st.level]); } const st = Decibel.makeStair({start: -40, min: -90, max: -15}); let n = 0; while (!st.done && n++ < 100) st.answer(false); return {o, none: [st.thr, st.note, st.level]}; });
  for (const [T_, thr, n] of r.o) { assert.ok(thr >= T_ - 0.001 && thr < T_ + 5.001, `prag ${T_} → ${thr}`); assert.ok(n < 40); }
  assert.deepEqual(r.none, [null, 'none', -15]);   // niciun răspuns: nu depășește −15 dBFS
  await p.ctx.close();
});
await T('audiogramă: mod relativ vs absolut (calibrare căști), rulare reală cu răspunsuri, salvare/export', async () => {
  const p = await open(browser); await p.click('#t-aud');
  assert.match(await p.textContent('#audMode'), /RELATIV/); assert.match(await p.textContent('#p-aud .alert'), /nu este un test medical/i);
  // pornire reală (tonuri redate prin WebAudio) + răspuns + oprire
  await p.click('#btnAudStart'); await p.waitForFunction(() => /Urechea/.test(document.getElementById('audStatus').textContent));
  await p.waitForTimeout(1800); await p.click('#btnHeard'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => Decibel.audState().run), true);
  await p.click('#btnAudStop'); await p.waitForFunction(() => !Decibel.audState().run); assert.match(await p.textContent('#audStatus'), /oprit/);
  // calibrare căști: 1 kHz = 85 dB SPL la −30 dBFS → toate frecvențele (răspuns plat presupus)
  await p.click('#hpDet summary'); await p.fill('#hpName', 'Căști test'); await p.fill('#hp1k', '85'); await p.click('#btnHpFill');
  assert.match(await p.textContent('#audMode'), /dB HL/); assert.match(await p.textContent('#audMode'), /plat/);
  await p.evaluate(() => { const r = Decibel.audState().res; for (const e of ['R', 'L']) for (const f of [250, 500, 1000, 2000, 3000, 4000, 6000, 8000]) r[e][f] = {thr: -70 + (e === 'L' ? 5 : 0) + (f > 3000 ? 10 : 0), note: ''}; Decibel.audState().done = true; });
  await p.selectOption('#lang', 'ro');                                   // re-randare
  const cells = await p.locator('#audTbl tbody tr:nth-child(3) td').allTextContents();    // 1000 Hz
  // HL = (dBFS + (85 + 30)) − RETSPL(1k = 7.0) = −70 + 115 − 7 = 38
  assert.match(cells[1], /38 dB HL/); assert.match(cells[2], /43 dB HL/);
  assert.equal(await p.locator('#audChart circle').count() >= 8, true); assert.equal(await p.locator('#audChart path').count() >= 8, true);
  await p.evaluate(() => { document.getElementById('btnAudSave').disabled = false; document.getElementById('btnAudCsv').disabled = false; });
  await p.click('#btnAudSave'); assert.equal(await p.locator('#audSaved li').count(), 1);
  const dl = p.waitForEvent('download'); await p.click('#btnAudCsv'); const f = await (await dl).path(); const csv = fs.readFileSync(f, 'utf8'); assert.match(csv, /ear,freq_hz,threshold_dbfs,spl_est_db,hl_est_db/); assert.match(csv, /R,1000,-70,45,38/);
  await p.click('[data-aud-del]'); assert.match(await p.textContent('#audSaved'), /Niciun/);
  await p.click('#btnHpClear'); assert.match(await p.textContent('#audMode'), /RELATIV/);
  await clean(p, 'audiogramă'); await p.ctx.close();
});

/* =================== 7. jurnal, export/import, tipărire =================== */
await T('jurnal: CSV, .fff.json, import (round-trip), ștergere, „Șterge tot”, CSV de sesiune, tipărire', async () => {
  const p = await open(browser); await loadFile(p, writeWav(path.join(TMP, 'sin1k_d.wav'), sine(1000, 0.1, 9)));
  await p.fill('#placeIn', 'Sală, test'); await p.click('#btnSaveNow').catch(() => {});
  await loadFile(p, writeWav(path.join(TMP, 'sin2k.wav'), sine(2000, 0.05, 7)));
  await p.click('#t-log'); assert.equal(await p.locator('#logTbl tbody tr').count(), 2);
  let dl = p.waitForEvent('download'); await p.click('#btnCsv'); let f = await (await dl).path(); const csv = fs.readFileSync(f, 'utf8');
  assert.match(csv, /^\ufeffid,start,durata_s/); assert.equal(csv.trim().split(/\r?\n/).length, 3);
  dl = p.waitForEvent('download'); await p.click('#btnJson'); f = await (await dl).path(); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.deepEqual([j.format, j.schema, j.app, j.version, j.updated], ['fff-bundle', 1, 'decibel', '1.0.5', '2026-10-23']); assert.ok(j.data['fff.decibel.sessions']);
  dl = p.waitForEvent('download'); await p.click('#btnSesCsv'); f = await (await dl).path(); const sc = fs.readFileSync(f, 'utf8'); assert.match(sc, /t_s,LAeq_1s,LCeq_1s,LZeq_1s,LAF,LAS/);
  const row = sc.split(/\r?\n/)[2].split(','); near(+row[1], 20 * Math.log10(0.05 / Math.SQRT2) + 1.2, 0.3, 'CSV sesiune LAeq,1s');
  // import invalid
  const bad = path.join(TMP, 'bad.json'); fs.writeFileSync(bad, '{"format":"altceva"}'); await p.setInputFiles('#impIn', bad); await p.waitForFunction(() => document.getElementById('logMsg').textContent.length > 0); assert.match(await p.textContent('#logMsg'), /nu este o copie/);
  const other = path.join(TMP, 'other.json'); fs.writeFileSync(other, JSON.stringify({...j, app: 'orar'})); await p.setInputFiles('#impIn', other); assert.match(await p.textContent('#logMsg'), /nu este o copie/);
  // șterge tot → import
  await p.click('#btnWipe'); await p.click('#dlgYes'); await p.waitForTimeout(100); assert.equal(await p.locator('#logTbl tbody tr').count(), 0);
  assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fff.decibel.') && !/lang|theme/.test(k)).length), 0);
  const good = path.join(TMP, 'good.fff.json'); fs.writeFileSync(good, JSON.stringify(j)); await p.setInputFiles('#impIn', good); await p.click('#dlgYes'); await p.waitForTimeout(150);
  assert.equal(await p.locator('#logTbl tbody tr').count(), 2); assert.match(await p.textContent('#logTbl'), /Sală, test|—/);
  await p.click('[data-log-del]'); assert.equal(await p.locator('#logTbl tbody tr').count(), 1);
  // tipărire: raport în mod print, restul ascuns
  await loadFile(p, writeWav(path.join(TMP, 'sin1k_e.wav'), sine(1000, 0.1, 6)));
  await p.click('#t-spec'); await p.waitForTimeout(300); await p.click('#t-log');
  await p.evaluate(() => Decibel.buildReport('session')); await p.emulateMedia({media: 'print'});
  assert.equal(await p.isVisible('#report'), true); assert.equal(await p.isVisible('#main'), false); assert.ok(await p.locator('#report img').count() >= 2); assert.match(await p.textContent('#report'), /Orientativ/);
  assert.match(await p.textContent('#report'), /LAeq/); await p.emulateMedia({media: 'screen'});
  await p.evaluate(() => Decibel.buildReport('log')); await p.emulateMedia({media: 'print'}); assert.match(await p.textContent('#report'), /Jurnal de sesiuni/); await p.emulateMedia({media: 'screen'});
  await p.click('#btnPrintRep');
  await clean(p, 'jurnal'); await p.ctx.close();
});
await T('funcționează fără localStorage (acces blocat)', async () => {
  const p = await open(browser, {init: `Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocat', 'SecurityError'); }});`});
  await p.waitForTimeout(500); await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});
  await p.selectOption('#lang', 'de'); assert.equal(await p.evaluate(() => document.documentElement.lang), 'de');
  assert.deepEqual(p.errs.filter(e => !/localStorage|blocat/i.test(e)), []); await p.ctx.close();
});

/* =================== 8. calitate: axe, depășire, tastatură, teme =================== */
await T('accesibilitate (axe 0 violări) pe toate filele, luminos/întunecat, inclusiv dialog', async () => {
  for (const scheme of ['light', 'dark']) {
    const p = await open(browser, {bypassCSP: true, scheme});
    await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});
    await p.addScriptTag({path: AXE}); await p.waitForTimeout(3600);
    for (const tab of ['meas', 'spec', 'cal', 'aud', 'log', 'about']) {
      await p.click('#t-' + tab); await p.waitForTimeout(300);
      if (tab === 'cal' || tab === 'aud') await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
      const v = await p.evaluate(async () => (await axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']})).violations.map(x => x.id + ': ' + x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')));
      assert.deepEqual(v, [], `axe ${scheme}/${tab}`);
    }
    await p.click('#t-log'); await p.click('#btnWipe'); await p.waitForTimeout(300);
    const vd = await p.evaluate(async () => (await axe.run(document)).violations.map(x => x.id)); assert.deepEqual(vd, [], 'axe dialog ' + scheme); await p.click('#dlgNo');
    await p.ctx.close();
  }
});
await T('fără depășire orizontală la 360×740 și 1280×800, pe toate filele', async () => {
  for (const vp of [{width: 360, height: 740}, {width: 1280, height: 800}]) {
    const p = await open(browser, {viewport: vp});
    await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});
    for (const tab of ['meas', 'spec', 'cal', 'aud', 'log', 'about']) {
      await p.click('#t-' + tab); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await p.waitForTimeout(200);
      const o = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})); assert.ok(o.sw <= o.cw, `depășire ${vp.width} ${tab}: ${o.sw}>${o.cw}`);
    }
    await p.ctx.close();
  }
});
await T('tastatură: file cu săgeți, Tab ajunge la comenzi, focus vizibil, Esc închide dialogul, reduced-motion', async () => {
  const p = await open(browser, {reduced: true});
  await p.focus('#t-meas'); await p.keyboard.press('ArrowRight'); assert.equal(await p.evaluate(() => document.activeElement.id), 't-spec'); assert.equal(await p.getAttribute('#t-spec', 'aria-selected'), 'true'); assert.equal(await p.isVisible('#p-spec'), true);
  await p.keyboard.press('End'); assert.equal(await p.evaluate(() => document.activeElement.id), 't-about'); await p.keyboard.press('Home'); assert.equal(await p.evaluate(() => document.activeElement.id), 't-meas');
  const ids = []; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); ids.push(await p.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
  assert.ok(ids.includes('btnMic') && ids.includes('btnReset'));
  const ol = await p.evaluate(() => { const e = document.getElementById('btnMic'); e.focus(); return getComputedStyle(e).outlineStyle; }); assert.notEqual(ol, 'none');
  await p.click('#t-log'); await p.click('#btnWipe'); assert.equal(await p.evaluate(() => document.getElementById('dlg').open), true); await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.getElementById('dlg').open), false);
  await p.ctx.close();
});
await T('tema: comutator, persistență, canvasuri redesenate; mod întunecat după sistem', async () => {
  const p = await open(browser, {scheme: 'dark'}); const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const b0 = await bg(); await p.click('#themeBtn'); const b1 = await bg(); assert.notEqual(b0, b1); assert.equal(await p.evaluate(() => localStorage.getItem('fff.decibel.theme')), 'light');
  await p.reload(); assert.equal(await bg(), b1); assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light'); await p.ctx.close();
});
await T('spectru: NR (calibrat), 1/1 octavă, FFT liniar, hold/medie, rezoluții FFT', async () => {
  const p = await open(browser); await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});
  await p.click('#t-cal'); await p.fill('#offIn', '110'); await p.click('#btnOffApply'); await p.click('#t-spec');
  await p.check('input[name=sm][value="oct"]'); await p.check('#spNR'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#v-nr'), /^NR \d+/);
  // curbele NR: valori din coeficienții ISO R 1996
  const nr = await p.evaluate(() => [20, 30, 50].map(n => [63, 125, 1000, 8000].map(f => Decibel.dsp.nrLevel(f, n))));
  near(nr[0][0], 51.3, 0.1); near(nr[0][1], 39.4, 0.1); near(nr[0][2], 20, 1e-9); near(nr[0][3], 12.6, 0.1);
  for (const n of ['4096', '8192', '32768']) { await p.check('input[name=sm][value="fft"]'); await p.selectOption('#spN', n); await p.waitForTimeout(250); }
  const ok = await p.evaluate(() => { const c = document.getElementById('specCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0]) n++; return n; }); assert.ok(ok > 300);
  await p.click('#btnHoldReset'); await clean(p, 'spectru'); await p.ctx.close();
});
await T('fișier nevalid / WAV float / 24 biți / mono-stereo: mesaje clare și citire corectă', async () => {
  const p = await open(browser);
  const junk = path.join(TMP, 'junk.wav'); fs.writeFileSync(junk, 'nu e audio'); await p.setInputFiles('#fileIn', junk); await p.waitForFunction(() => /nu a putut fi citit/.test(document.getElementById('micStatus').textContent), null, {timeout: 15000});
  // WAV float32 stereo (se folosește primul canal)
  const n = 48000 * 3, b = Buffer.alloc(44 + n * 8); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(48000 * 8, 28); b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { b.writeFloatLE(0.2 * Math.sin(2 * Math.PI * 1000 * i / 48000), 44 + 8 * i); b.writeFloatLE(0, 48 + 8 * i); }
  const f32 = path.join(TMP, 'st32.wav'); fs.writeFileSync(f32, b); await loadFile(p, f32);
  near(await p.evaluate(() => Decibel.state().sess.leq(2, 0)), 20 * Math.log10(0.2 / Math.SQRT2), 0.1); assert.match(await p.textContent('#micStatus'), /primul canal|analizat/);
  // 24 biți
  const m = 48000 * 3, c = Buffer.alloc(44 + m * 3); c.write('RIFF', 0); c.writeUInt32LE(36 + m * 3, 4); c.write('WAVEfmt ', 8); c.writeUInt32LE(16, 16); c.writeUInt16LE(1, 20); c.writeUInt16LE(1, 22); c.writeUInt32LE(48000, 24); c.writeUInt32LE(48000 * 3, 28); c.writeUInt16LE(3, 32); c.writeUInt16LE(24, 34); c.write('data', 36); c.writeUInt32LE(m * 3, 40);
  for (let i = 0; i < m; i++) { const v = Math.round(0.3 * 8388607 * Math.sin(2 * Math.PI * 500 * i / 48000)); c.writeIntLE(v, 44 + 3 * i, 3); }
  const f24 = path.join(TMP, 'm24.wav'); fs.writeFileSync(f24, c); await loadFile(p, f24);
  near(await p.evaluate(() => Decibel.state().sess.leq(2, 0)), 20 * Math.log10(0.3 / Math.SQRT2), 0.1); await p.ctx.close();
});


/* =================== date locale corupte / import ostil / stocare plină / fișiere ostile =================== */
await T('date locale corupte (null, tipuri greșite): aplicația pornește și toate filele se deschid fără erori', async () => {
  const bad = {sessions: ['null', '5', '{}', '[null]', '[{"start":"x","laeq":null,"dur":"q"}]'], profiles: ['null', '{}', '[null]', '[{"id":1}]'], audio: ['null', '"s"', '[null]'],
    hp: ['{"spl":null,"ret":null}', '{"spl":5,"ret":5}', '5'], settings: ['null', '{"dose":null,"spec":5}', '{"w":9,"tw":5,"view":"zz","interval":-5}'], cal: ['null', '{"on":true,"offset":"x"}', '{"on":true,"offset":1e999}']};
  for (const k of Object.keys(bad)) for (const v of bad[k]) {
    const p = await open(browser, {goto: false});
    await p.addInitScript(([kk, vv]) => { try { if (!sessionStorage.__s) { localStorage.setItem('fff.decibel.' + kk, vv); sessionStorage.__s = 1; } } catch (e) {} }, [k, v]);
    await p.goto(URL_APP); await p.waitForTimeout(200);
    for (const t of ['spec', 'cal', 'aud', 'log', 'about', 'meas']) await p.click('#t-' + t);
    assert.deepEqual(p.errs, [], k + '=' + v);
    const cs = await p.evaluate(() => Decibel.cal()); assert.ok(Number.isFinite(cs.offset), 'offset finit ' + k + '=' + v);
    await p.ctx.close();
  }
});
await T('import .fff.json ostil: chei străine/forme greșite ignorate; tema nevalidă nu ajunge în atribut', async () => {
  const p = await open(browser);
  const f = path.join(TMP, 'rau.fff.json');
  fs.writeFileSync(f, JSON.stringify({format: 'fff-bundle', schema: 1, app: 'decibel', data: {'fff.decibel.sessions': '5', 'fff.decibel.profiles': '[{"id":"p1","name":"<img src=x onerror=window.__pwn=1>","offset":3,"mic":"m","browser":"Chrome"}]', 'fff.decibel.theme': 'x" onload="y', 'fff.decibel.lang': 'xx', 'altceva.cheie': '1', 'fff.decibel.cal': 'nu e json'}}));
  await p.click('#t-log');
  await p.setInputFiles('#impIn', f);
  await p.waitForSelector('#dlgYes', {state: 'visible', timeout: 3000}); await p.click('#dlgYes');
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({keys: Object.keys(localStorage).filter(k => k.startsWith('fff.decibel.')).sort(), lang: localStorage.getItem('fff.decibel.lang'), pwn: window.__pwn, th: document.documentElement.getAttribute('data-theme')}));
  assert.ok(!st.keys.includes('fff.decibel.sessions') && !st.keys.includes('fff.decibel.theme') && !st.keys.includes('fff.decibel.cal') && st.lang !== 'xx' && st.keys.includes('fff.decibel.profiles'), JSON.stringify(st));
  assert.equal(st.th, null);
  assert.equal(st.pwn, undefined);
  assert.deepEqual(p.errs, []);
  await p.ctx.close();
});
await T('localStorage plin: sesiunea salvată rămâne vizibilă în jurnal, utilizatorul e anunțat', async () => {
  const p = await open(browser, {init: () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('fff.decibel.sessions') && window.__full) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; }});
  await p.evaluate(() => { window.__full = true; });
  const w = path.join(TMP, 'plin.wav'); writeWav(w, sine(1000, 0.1, 8));
  await loadFile(p, w); await p.waitForTimeout(300); await p.click('#t-log');
  assert.equal(await p.locator('#logTbl tbody tr').count(), 1, 'sesiunea apare în jurnal chiar dacă localStorage e plin');
  assert.ok(await p.locator('.fff-toast, #logMsg.bad').count() >= 1, 'anunț vizibil');
  await p.ctx.close();
});
await T('WAV ostil: NaN/Inf în float, frecvență de eșantionare 0 / 1 Hz — fără blocaj, niveluri finite', async () => {
  const p = await open(browser);
  const n = 48000 * 3, b = Buffer.alloc(44 + n * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24); b.writeUInt32LE(48000 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) b.writeFloatLE(i === 20000 ? NaN : i === 30000 ? Infinity : 0.2 * Math.sin(2 * Math.PI * 1000 * i / 48000), 44 + 4 * i);
  const f = path.join(TMP, 'nan.wav'); fs.writeFileSync(f, b); await loadFile(p, f);
  const lz = await p.evaluate(() => Decibel.state().sess.leq(2, 0)); assert.ok(Number.isFinite(lz), 'Leq finit: ' + lz); near(lz, 20 * Math.log10(0.2 / Math.SQRT2), 0.3);
  for (const fsx of [0, 1, 100]) {
    const c = Buffer.from(b.subarray(0, 44 + 4800 * 4)); c.writeUInt32LE(fsx, 24);
    const g = path.join(TMP, 'fs' + fsx + '.wav'); fs.writeFileSync(g, c);
    await p.evaluate(() => { Decibel.state().sess = null; document.getElementById('micStatus').textContent = ''; });
    await p.setInputFiles('#fileIn', g); await p.waitForTimeout(400);
    assert.match(await p.textContent('#micStatus'), /nu a putut fi citit/, 'fs=' + fsx);
  }
  assert.deepEqual(p.errs, []); await p.ctx.close();
});
await T('microfon: eșec după acordarea permisiunii (ScriptProcessor indisponibil) → pistele se opresc, mesaj elegant, fără excepție', async () => {
  const w = writeWav(path.join(TMP, 'mic-fail.wav'), sine(1000, 0.1, 3)); const b = await launch(FAKE(w));
  const p = await open(b, {init: () => { window.__ended = 0; const o = MediaStreamTrack.prototype.stop; MediaStreamTrack.prototype.stop = function () { window.__ended++; return o.call(this); }; AudioContext.prototype.createScriptProcessor = function () { throw new DOMException('no sp', 'NotSupportedError'); }; }});
  await p.click('#btnMic'); await p.waitForTimeout(800);
  assert.ok(await p.evaluate(() => window.__ended) >= 1, 'pista microfonului a fost oprită');
  assert.equal(await p.evaluate(() => Decibel.state().running), false);
  assert.match(await p.textContent('#micStatus'), /nu a putut fi pornit/);
  assert.deepEqual(p.errs, []); await p.ctx.close(); await b.close();
});
await T('doză: parametri personalizați absurzi (q ≤ 0, Tc = 0, câmp gol) sunt limitați, fără Infinity/NaN în doză', async () => {
  const p = await open(browser);
  const w = path.join(TMP, 'doza.wav'); writeWav(w, pinkNode(48000 * 6, 5, 0.05)); await loadFile(p, w);
  await p.evaluate(() => { const set = Decibel.set(); set.dose = {pre: 'custom', Lc: '', Tc: 0, q: -3, thr: 'x'}; });
  const d = await p.evaluate(() => { const s = Decibel.state().sess; return Decibel.dsp.doseOf(s, 100, {Lc: 85, Tc: 8, q: 3, thr: -Infinity}); });
  assert.ok(Number.isFinite(d) && d > 0);
  await p.click('#t-cal'); await p.fill('#offIn', '94'); await p.click('#btnOffApply');
  await p.click('#t-meas'); await p.fill('#doseQ', '0'); await p.fill('#doseTc', '0'); await p.waitForTimeout(150);
  assert.ok(await p.evaluate(() => Decibel.cal().on), 'calibrat');
  const txt = await p.evaluate(() => ['v-dose', 'v-doseExt', 'v-doseAllowed'].map(i => document.getElementById(i).textContent));
  assert.ok(txt.every(x => !/Infinity|NaN|∞/.test(x)) && /\d/.test(txt[0]), txt.join('|'));
  assert.deepEqual(p.errs, []); await p.ctx.close();
});

await browser.close();
fs.rmSync(TMP, {recursive: true, force: true});
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} teste reușite`);
process.exit(failed.length ? 1 : 0);
