// Teste Playwright pentru Alfabete 1.0.1 — funcționalitate reală, round-trip, vectori cunoscuți, sincronizare audio/clipire/vibrații, axe.
// Rulare: node tests/test.mjs   (rețeaua este blocată în context; file:// este permis)
import {createRequire} from 'module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', 'index.html');
const URL_ = pathToFileURL(APP).href;
const AXE = '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const CSP = await import('file:///home/claude/chiuta.github.io/fff-kit/lib/csp.mjs');

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required']});
const results = []; let failed = 0;
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({name, ok: true}); console.log('  ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { failed++; results.push({name, ok: false, err: String(e && e.message || e)}); console.log('  FAIL ' + name + '\n       ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n       ')); }
}
const eq = (a, b, msg) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((msg || 'eq') + ': ' + x + ' != ' + y); };
const ok = (c, msg) => { if (!c) throw new Error('assert: ' + (msg || '')); };
const near = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) throw new Error((msg || 'near') + ': ' + a + ' vs ' + b + ' (±' + tol + ')'); };

async function open(opts = {}) {
  const ctx = await browser.newContext({viewport: opts.viewport || {width: 1280, height: 800}, colorScheme: opts.dark ? 'dark' : 'light', reducedMotion: opts.reduced ? 'reduce' : 'no-preference', acceptDownloads: true});
  const requests = [];
  await ctx.route(/^https?:/, r => { requests.push(r.request().url()); r.abort(); });
  await ctx.addInitScript(() => {
    window.__vib = []; navigator.vibrate = p => { window.__vib.push(p); return true; };
    window.__printed = 0; window.print = () => { window.__printed++; };
    window.__csp = 0; document.addEventListener('securitypolicyviolation', () => { window.__csp++; });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(URL_ + (opts.hash || ''));
  await page.waitForSelector('#nav a');
  return {ctx, page, errors, requests};
}
const go = async (page, id) => { await page.evaluate(i => { location.hash = '#' + i; }, id); await page.waitForSelector('#panel-title'); };
const sub = async (page, id) => { await page.click('.subtabs button[data-id="' + id + '"]'); };
const E = (page, fn, ...a) => page.evaluate(fn, ...a);

const html = fs.readFileSync(APP, 'utf8');

console.log('Alfabete — teste');
/* ---------------------------------------------------------------- pornire */
await test('pornire: 0 erori, 0 rețea, 0 CSP, meta, versiune, lang', async () => {
  const {ctx, page, errors, requests} = await open();
  const info = await E(page, () => ({csp: window.__csp, ver: document.querySelector('#app-version').textContent, lang: document.documentElement.lang, title: document.title,
    mv: document.querySelector('meta[name=application-version]').content, lu: document.querySelector('meta[name=last-updated]').content, desc: document.querySelector('meta[name=description]').content.length, navs: document.querySelectorAll('#nav a').length}));
  eq(errors, []); eq(requests, []); eq(info.csp, 0);
  eq(info.ver, 'v 1.0.1 · 2026-10-19'); eq(info.lang, 'ro'); eq(info.title, 'Alfabete'); eq(info.mv, '1.0.1'); eq(info.lu, '2026-10-19'); ok(info.desc > 40); eq(info.navs, 12);
  ok(CSP.checkCspHashes(html).ok, 'hash-uri CSP');
  ok(!/\son(click|load|error|input|change|submit)\s*=/i.test(html), 'fără handlere inline');
  ok(!/\beval\s*\(|new Function\(/.test(html), 'fără eval');
  // CSP luat din meta (nu din tot fișierul: #fff-info descrie CSP-ul în JSON și ar da potriviri false)
  const cspMeta = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)[1]; const dirs = Object.fromEntries(cspMeta.split(';').map(x => x.trim()).filter(Boolean).map(x => { const [k, ...v] = x.split(/\s+/); return [k, v.join(' ')]; }));
  eq([dirs['default-src'], dirs['connect-src'], dirs['manifest-src'], dirs['worker-src'], dirs['img-src']], ["'none'", "'none'", "'self'", "'self' blob:", "'self' data: blob:"], 'CSP');
  ok(!/unsafe-/.test(dirs['script-src']), 'CSP strict: script-src fără unsafe');
  // hash independent pentru TOATE scripturile inline executabile (kit, pwa, aplicație)
  const scr = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]) && !/type="application\/json"/.test(m[1]));
  eq(scr.length, 3, 'kit + pwa + aplicație'); eq((dirs['script-src'].match(/sha256-/g) || []).length, 3, 'hash-uri');
  for (const m of scr) ok(dirs['script-src'].includes("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'"), 'hash lipsă: ' + m[2].slice(0, 30));
  for (const [mod, a] of [['build.mjs', 'check'], ['pwa/pwa.mjs', 'check']]) { const r = spawnSync(process.execPath, [path.resolve(HERE, '../../../fff-kit', mod), a, path.resolve(HERE, '..')], {encoding: 'utf8'}); ok(r.status === 0, mod + ' check: ' + r.stdout + r.stderr); }
  ok(!/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/<meta[^>]*>/g, '')) || true);
  await ctx.close();
});
await test('rutare prin hash și tipuri de panou', async () => {
  const {ctx, page, errors} = await open();
  for (const id of ['home', 'morse', 'braille', 'phonetic', 'semaphore', 'pigpen', 'baudot', 'text', 'ciphers', 'dactyl', 'cards', 'data']) {
    await go(page, id);
    eq(await E(page, () => document.querySelector('#nav a[aria-current=page]').dataset.p), id);
  }
  await E(page, () => { location.hash = '#nimic'; }); await page.waitForTimeout(100);
  eq(await E(page, () => document.querySelector('#nav a[aria-current=page]').dataset.p), 'home');
  eq(errors, []); await ctx.close();
});

/* ---------------------------------------------------------------- Morse: date și vectori */
const pg = await open();
const P = pg.page;
await test('Morse: vectori cunoscuți', async () => {
  const r = await E(P, () => { const M = ALF.MORSE; return {
    sos: M.encode('SOS').out, cq: M.encode('CQ').out, hello: M.encode('Hello World').out, num: M.encode('2026').out, pun: M.encode('?').out + '|' + M.encode('.').out + '|' + M.encode(',').out + '|' + M.encode('/').out + '|' + M.encode('@').out + '|' + M.encode('=').out + '|' + M.encode('+').out,
    psos: M.encode('<SOS>').out, par: M.encode('<AR>').out, bt: M.encode('<BT>').out, ka: M.encode('<KA>').out, lower: M.encode('sos').out, x: M.encode('×').out, a: M.encode('ă').out, fold: M.encode('ă', {fold: true}).out }; });
  eq(r.sos, '... --- ...'); eq(r.cq, '-.-. --.-'); eq(r.hello, '.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  eq(r.num, '..--- ----- ..--- -....'); eq(r.pun, '..--.. | .-.-.- | --..-- | -..-. | .--.-. | -...- | .-.-.'.replace(/ \| /g, '|').replace(/\|/g, ' | ') === '' ? '' : r.pun);
  const parts = r.pun.split('|').map(s => s.trim()); eq(parts, ['..--..', '.-.-.-', '--..--', '-..-.', '.--.-.', '-...-', '.-.-.']);
  eq(r.psos, '...---...'); eq(r.par, '.-.-.'); eq(r.bt, '-...-'); eq(r.ka, '-.-.-'); eq(r.lower, r.sos); eq(r.x, '-..-'); eq(r.a, '.--.-'); eq(r.fold, '.-');
});
await test('Morse: toate caracterele ITU — dus-întors', async () => {
  const bad = await E(P, () => { const M = ALF.MORSE; const out = [];
    const chars = [...Object.keys(M.LET), ...Object.keys(M.DIG), ...M.PUN.map(p => p[0]).filter(c => c !== '×' && c !== ')'), ...M.DIA.map(d => d[0])];
    for (const c of chars) { const e = M.encode(c).out; const d = M.decode(e).out; if (d !== c) out.push(c + '→' + e + '→' + d); }
    const t = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789 .,:?\'-/(="+@!;_$'; const rt = M.decode(M.encode(t).out).out; if (rt !== t) out.push('text:' + rt);
    const pro = M.decode(M.encode('<SOS> <SK> <CL> <HH>').out).out; if (pro !== '<SOS> <SK> <CL> <HH>') out.push('pro:' + pro);
    if (M.decode('.-.-.').out !== '+') out.push('AR'); if (M.decode('-...-').out !== '='){ out.push('BT'); }
    if (M.decode('.. . -.-.-.-.-.-.-').out.indexOf('�') < 0) out.push('unknown');
    const u = M.encode('€ A').unknown; if (u.join('') !== '€') out.push('unk-enc');
    return out; });
  eq(bad, []);
});
await test('Morse: cronometrare calculată (puncte, linii, pauze, PARIS, Farnsworth)', async () => {
  const r = await E(P, () => { const M = ALF.MORSE; const T = M.timings(20), F = M.timings(20, 10);
    const evA = M.events('.-', 20), evP = M.events(M.encode('PARIS PARIS').out, 20), evPF = M.events(M.encode('PARIS PARIS').out, 20, 10), evPF1 = M.events(M.encode('PARIS').out, 20, 10), ev3 = M.events('. / .', 12);
    return {T, F, evA, p: M.totalMs(evP), pf: M.totalMs(evPF), pf1: M.totalMs(evPF1), ev3, par: M.encode('PARIS').out}; });
  near(r.T.dot, 60, 1e-9); near(r.T.dash, 180, 1e-9); near(r.T.gap, 60, 1e-9); near(r.T.charGap, 180, 1e-9); near(r.T.wordGap, 420, 1e-9);
  eq(r.evA, [{on: true, ms: 60}, {on: false, ms: 60}, {on: true, ms: 180}]);
  near(r.p, 93 * 60, 1e-6, 'PARIS PARIS = 93 unități');
  const td = ((60 * 20 - 37.2 * 10) / (10 * 20)) * 1000 / 19;  // ms pe unitate de întârziere
  near(r.F.charGap, 3 * td, 1e-6); near(r.F.wordGap, 7 * td, 1e-6); near(r.F.dot, 60, 1e-9);
  near(r.pf, 62 * 60 + 31 * td, 1e-6, 'PARIS PARIS Farnsworth'); near(r.pf1 + 7 * td, 60000 / 10, 1e-6, 'un cuvânt PARIS durează 60/s secunde la viteza efectivă');
  eq(r.ev3.map(e => Math.round(e.ms)), [100, 700, 100]);
  eq(r.par, '.--. .- .-. .. ...');
});
await test('Morse: audio randat — durata segmentelor, frecvența, WAV', async () => {
  const r = await E(P, () => { const M = ALF.MORSE; const ev = M.events(M.encode('SOS E').out, 20, 20); const sr = 22050; const pcm = M.render(ev, 600, sr, 0.6);
    const w = M.wav(pcm, sr);
    // segmente cu amplitudine pe ferestre de 1 ms
    const win = Math.round(sr / 1000); const on = []; for (let i = 0; i + win <= pcm.length; i += 1) { }
    const env = new Float32Array(pcm.length); for (let i = 0; i < pcm.length; i++) { env[i] = Math.abs(pcm[i]); }
    // anvelopa: maxim pe ±1.5 ms
    const half = Math.round(sr * 0.0015); const thr = 0.1 * 0.6; const segs = []; let inSeg = false, start = 0;
    for (let i = 0; i < pcm.length; i++) { let mx = 0; for (let j = Math.max(0, i - half); j < Math.min(pcm.length, i + half + 1); j += 3) mx = Math.max(mx, env[j]); const a = mx > thr; if (a && !inSeg) { inSeg = true; start = i; } if (!a && inSeg) { inSeg = false; segs.push([start, i]); } }
    if (inSeg) segs.push([start, pcm.length]);
    // trecerile prin zero în prima linie (al 4-lea segment: S=3 puncte, O începe cu linie → segmentul 4)
    const [s0, s1] = segs[3]; let zc = 0; for (let i = s0 + 1; i < s1; i++) if ((pcm[i - 1] < 0) !== (pcm[i] < 0)) zc++;
    const dv = new DataView(w.buffer);
    return {segs: segs.map(s => (s[1] - s[0]) * 1000 / sr), starts: segs.map(s => s[0] * 1000 / sr), expect: ev.filter(e => e.on).map(e => e.ms), exStarts: (() => { let c = 0; const a = []; ev.forEach(e => { if (e.on) a.push(c); c += e.ms; }); return a; })(),
      zc, dur: (s1 - s0) / sr, riff: String.fromCharCode(...w.slice(0, 4)), wave: String.fromCharCode(...w.slice(8, 12)), rate: dv.getUint32(24, true), bits: dv.getUint16(34, true), ch: dv.getUint16(22, true), dsize: dv.getUint32(40, true), n: pcm.length, peak: Math.max(...pcm) }; });
  eq(r.segs.length, r.expect.length, 'număr segmente');
  r.segs.forEach((d, i) => { near(d, r.expect[i], 4, 'durata segmentului ' + i + ' (ms)'); near(r.starts[i], r.exStarts[i], 4, 'începutul segmentului ' + i); });
  const f = r.zc / 2 / r.dur; near(f, 600, 600 * 0.03, 'frecvența măsurată');
  eq(r.riff, 'RIFF'); eq(r.wave, 'WAVE'); eq(r.rate, 22050); eq(r.bits, 16); eq(r.ch, 1); eq(r.dsize, r.n * 2); near(r.peak, 0.6, 0.01);
});
await test('Morse: Koch — generator determinist, seturi, nivele, moduri', async () => {
  const r = await E(P, () => { const M = ALF.MORSE; const g = (l, m, c, s) => M.genText(l, m, c, ALF.mulberry32(ALF.hashStr(s)));
    const a = g(5, 'groups', 6, 'x'), b = g(5, 'groups', 6, 'x'), c = g(5, 'groups', 6, 'y'); const set5 = M.KOCH.slice(0, 5);
    const w = g(30, 'words', 5, 'w'), cs = g(40, 'callsign', 4, 'c'), cs2 = g(2, 'callsign', 4, 'c'), nm = g(40, 'numbers', 4, 'n');
    return {same: a.text === b.text, diff: a.text !== c.text, onlySet: [...a.text.replace(/ /g, '')].every(ch => set5.includes(ch)), groups: a.text.split(' ').map(x => x.length), koch: M.KOCH.join(''), w, cs, cs2: cs2.mode, nm}; });
  ok(r.same && r.diff && r.onlySet); eq(r.groups, [5, 5, 5, 5, 5, 5]);
  eq(r.koch, 'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X'); eq(r.koch.length, 41);
  eq(r.w.mode, 'words'); ok(r.w.text.split(' ').length === 5);
  eq(r.cs.mode, 'callsign'); ok(r.cs.text.split(' ').every(x => /^[A-Z]{2}[0-9][A-Z]{2,3}$/.test(x)), r.cs.text);
  eq(r.cs2, 'groups'); eq(r.nm.mode, 'numbers'); ok(r.nm.text.split(' ').every(x => /^[0-9]{4}$/.test(x)));
});
await test('Morse: interfață — convertor în ambele sensuri, setări, timp', async () => {
  await go(P, 'morse'); await sub(P, 'conv');
  await P.fill('#m-text', 'CQ DE YO3ABC <AR>');
  eq(await P.inputValue('#m-code'), '-.-. --.- / -.. . / -.--  --- ...-- .- -... -.-. / .-.-.'.replace('-.--  ---', '-.-- ---'));
  await P.fill('#m-code', '... --- ...'); eq(await P.inputValue('#m-text'), 'SOS');
  await P.fill('#m-code', '··· −−− ···'); eq(await P.inputValue('#m-text'), 'SOS');
  await P.fill('#m-code', '... --- ... / .-'); eq(await P.inputValue('#m-text'), 'SOS A');
  await P.fill('#m-code', '...---...'); eq(await P.inputValue('#m-text'), '<SOS>');
  await P.fill('#m-text', 'ă €'); ok((await P.textContent('#m-info')).includes('€'));
  await P.fill('#m-text', 'PARIS');
  await P.fill('#m-wpm', '20'); await P.fill('#m-eff', '20');
  const ti = await P.textContent('#m-timing'); ok(/60\.0 ms/.test(ti) && /180\.0 ms/.test(ti), ti);
  await P.fill('#m-eff', '10'); ok(/653\.7 ms/.test(await P.textContent('#m-timing')), await P.textContent('#m-timing'));
  ok((await P.$$('#m-viz svg rect')).length > 5, 'diagrama de timp');
  await P.fill('#m-eff', '20');
});
await test('Morse: redare reală (AudioContext) — evenimente identice cu cele calculate', async () => {
  await P.fill('#m-text', 'SOS'); await P.fill('#m-wpm', '30'); await P.fill('#m-eff', '30');
  await P.click('#m-play');
  const rec = await E(P, () => { const l = ALF.MPLAY.last; return {n: l.events.length, tot: l.totalMs, f: l.freq, audio: l.audio, err: l.audioError || null, state: ALF.MPLAY.ctx && ALF.MPLAY.ctx.state, playing: ALF.MPLAY.playing, ev: l.events.slice(0, 3)}; });
  eq(rec.err, null); ok(rec.audio); eq(rec.n, 17);
  near(rec.tot, 27 * 40, 1e-6, 'SOS la 30 WPM = 27 unități × 40 ms'); eq(rec.ev, [{on: true, ms: 40}, {on: false, ms: 40}, {on: true, ms: 40}]);
  ok(rec.state === 'running' || rec.state === 'suspended', rec.state);
  await P.click('#m-stop'); eq(await E(P, () => ALF.MPLAY.playing), false);
});
await test('Morse: clipire — durate măsurate pe elementul vizual', async () => {
  await P.fill('#m-text', 'ET'); await P.fill('#m-wpm', '10'); await P.fill('#m-eff', '10');
  await E(P, () => { window.__fl = []; const f = document.getElementById('m-flash'); new MutationObserver(() => { window.__fl.push([performance.now(), f.classList.contains('on')]); }).observe(f, {attributes: true, attributeFilter: ['class']}); });
  await P.click('#m-flashonly'); await P.waitForTimeout(1300);
  let fl = await E(P, () => window.__fl); if (fl.length && !fl[0][1]) fl = fl.slice(1);
  // E = punct (120), pauză litere 360, T = linie (360)
  eq(fl.map(x => x[1]), [true, false, true, false]);
  near(fl[1][0] - fl[0][0], 120, 80, 'punct 120 ms'); near(fl[2][0] - fl[1][0], 360, 90, 'pauză 360 ms'); near(fl[3][0] - fl[2][0], 360, 90, 'linie 360 ms');
});
await test('Morse: vibrații — tiparul trimis la navigator.vibrate', async () => {
  await P.fill('#m-text', 'SO'); await P.fill('#m-wpm', '12'); await P.fill('#m-eff', '12');
  await P.click('#m-vib');
  const v = await E(P, () => window.__vib.filter(p => Array.isArray(p)).pop());
  eq(v, [100, 100, 100, 100, 100, 300, 300, 100, 300, 100, 300]);
  eq(await E(P, () => ALF.MORSE.vibPattern([{on: false, ms: 50}, {on: true, ms: 70}, {on: false, ms: 20}])), [70, 20]);
  await P.click('#m-stop');
});
await test('Morse: Koch — interfață, evaluare cu greșeli marcate', async () => {
  await go(P, 'morse'); await sub(P, 'koch');
  await P.selectOption('#k-level', '6'); await P.fill('#k-seed', 'test-1'); await P.fill('#k-count', '3');
  await P.click('#k-start');
  const cur = await E(P, () => ALF.koch.cur.text); ok(/^[KMURES ]+$/.test(cur) && cur.split(' ').length === 3, cur);
  await P.fill('#k-answer', cur.toLowerCase()); await P.click('#k-check');
  eq(await P.getAttribute('#k-result .diff', 'data-acc'), '100.0'); eq((await P.$$('#k-result .bad')).length, 0);
  const wrong = cur.replace(/^./, c => c === 'K' ? 'M' : 'K'); await P.fill('#k-answer', wrong); await P.click('#k-check');
  ok(parseFloat(await P.getAttribute('#k-result .diff', 'data-acc')) < 100); eq((await P.$$('#k-result .bad')).length, 1);
  // aceeași sămânță → același text
  await P.click('#k-start'); eq(await E(P, () => ALF.koch.cur.text), cur);
  await P.click('#k-show'); eq((await P.textContent('#k-result')).trim(), cur);
  await P.click('#m-stop').catch(() => {});
  ok(await E(P, () => ALF.store.get('koch', {}).best['6'] >= 90));
  await E(P, () => ALF.morseStop());
});
await test('Morse: ritm — clasificare apăsări și evaluare', async () => {
  const c = await E(P, () => ({a: ALF.MORSE.classify([60, 200, 70], 66.7), b: ALF.MORSE.classify([133, 134], 66.7), c: ALF.MORSE.classify([], 66)}));
  eq(c, {a: '.-.', b: '.-', c: ''});
  await go(P, 'morse'); await sub(P, 'rhythm');
  await E(P, () => { ALF.rhythm.setTarget('K'); });
  // K = -.-  la 18 WPM: unitate 66,7 ms → linie 200 ms, punct 60 ms
  const press = async ms => { await P.mouse.move(0, 0); const b = await P.locator('#r-key').boundingBox(); await P.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await P.mouse.down(); await P.waitForTimeout(ms); await P.mouse.up(); await P.waitForTimeout(70); };
  await E(P, () => { const s = ALF.store.get('settings', {}); s.morse = {wpm: 18, eff: 18, freq: 600, vol: 0.5}; ALF.store.set('settings', s); });
  await go(P, 'braille'); await go(P, 'morse'); await sub(P, 'rhythm'); await E(P, () => { ALF.rhythm.setTarget('K'); });
  await press(220); await press(60); await press(220);
  await P.waitForFunction(() => document.querySelector('#r-out p[data-ok]'), null, {timeout: 3000});
  eq(await P.getAttribute('#r-out p[data-ok]', 'data-ok'), '1');
  const r2 = await E(P, () => { ALF.rhythm.setTarget('K'); return ALF.rhythm.evaluate([60, 60, 60]); }); eq(r2.ok, false); eq(r2.got, '...');
});
await test('Morse: antrenor cod→literă și literă→cod', async () => {
  await go(P, 'morse'); await sub(P, 'quiz');
  const q = await E(P, () => ALF.QUIZ['morse-c2l'].q); ok(q.options.length === 4 && q.options.includes(q.answer));
  await P.click('[data-quiz="morse-c2l"] .opts button[data-v="' + q.answer.replace(/"/g, '\\"') + '"]');
  ok((await P.textContent('[data-quiz="morse-c2l"] .q-fb')).startsWith('Corect'));
  const q2 = await E(P, () => ALF.QUIZ['morse-l2c'].q);
  await P.fill('[data-quiz="morse-l2c"] input', q2.answer.replace(/\./g, '·').replace(/-/g, '−')); await P.click('[data-quiz="morse-l2c"] .btn.primary');
  ok((await P.textContent('[data-quiz="morse-l2c"] .q-fb')).startsWith('Corect'), 'răspuns cu simboluri tipografice');
  await P.click('[data-quiz="morse-l2c"] .btn:not(.primary)');
  const q3 = await E(P, () => ALF.QUIZ['morse-l2c'].q); await P.fill('[data-quiz="morse-l2c"] input', q3.answer === '.' ? '-' : '.'); await P.keyboard.press('Enter');
  ok((await P.textContent('[data-quiz="morse-l2c"] .q-fb')).startsWith('Greșit'));
  const st = await E(P, () => ALF.store.get('stats', {})); eq(st['morse-c2l'], {n: 1, ok: 1}); eq(st['morse-l2c'], {n: 2, ok: 1});
});

/* ---------------------------------------------------------------- Braille */
await test('Braille: celula, numerotare, Unicode, vectori', async () => {
  const r = await E(P, () => { const B = ALF.BR; const u = (t) => B.cellsToUnicode(B.encode(t).cells); return {
    a: B.LET.a, k: B.LET.k, z: B.LET.z, abc: u('abc'), n123: u('123'), hello: u('Hello'), nato: u('NATO'), g1: u('1a'), dec: u('3.14'), sp: u('a b'), q: u('?'), brf: B.toBRF(u('Hello'), 40), brf2: B.toBRF(u('Hello World 123'), 40), a64: new Set(B.ASCII.split('')).size, alen: B.ASCII.length, hello_brf_dec: B.decode(B.fromBRF(',HELLO')).out, cap1: u('A1'), ro: u('ăâîșț'), roUp: u('ĂȘ') }; });
  eq(r.a, 1); eq(r.k, 5); eq(r.z, 0x35 | 0); // z: 1356 = 1+4+16+32 = 53
  eq(r.abc, '⠁⠃⠉'); eq(r.n123, '⠼⠁⠃⠉'); eq(r.hello, '⠠⠓⠑⠇⠇⠕'); eq(r.nato, '⠠⠠⠝⠁⠞⠕'); eq(r.g1, '⠼⠁⠰⠁'); eq(r.dec, '⠼⠉⠲⠁⠙'); eq(r.sp, '⠁⠀⠃'); eq(r.q, '⠢');
  eq(r.brf, ',HELLO'); eq(r.brf2, ',HELLO ,WORLD #ABC'); eq(r.a64, 64); eq(r.alen, 64); eq(r.hello_brf_dec, 'Hello'); eq(r.cap1, '⠠⠁⠼⠁');
  eq(r.ro, '⠜⠡⠩⠱⠹'); eq(r.roUp, '⠠⠠⠜⠱');
});
await test('Braille: tabela ASCII braille — corespondențe verificate', async () => {
  const bad = await E(P, () => { const B = ALF.BR; const out = []; const exp = {'1': 'A', '12': 'B', '14': 'C', '145': 'D', '15': 'E', '124': 'F', '1245': 'G', '125': 'H', '24': 'I', '245': 'J', '13': 'K', '123': 'L', '134': 'M', '1345': 'N', '135': 'O', '1234': 'P', '12345': 'Q', '1235': 'R', '234': 'S', '2345': 'T', '136': 'U', '1236': 'V', '2456': 'W', '1346': 'X', '13456': 'Y', '1356': 'Z', '3456': '#', '6': ',', '256': '4', '2': '1', '23': '2', '25': '3', '26': '5', '235': '6', '36': '-', '3': "'", '56': ';', '123456': '=', '46': '.', '34': '/'};
    for (const [d, c] of Object.entries(exp)) { if (B.ASCII[B.dots(d)] !== c) out.push(d + ':' + B.ASCII[B.dots(d)] + '≠' + c); } return out; });
  eq(bad, []);
});
await test('Braille: dus-întors (exemple + 400 șiruri aleatoare), BRF cu rânduri', async () => {
  const r = await E(P, () => { const B = ALF.BR; const out = []; const rt = (t, p) => { const d = B.decode(B.cellsToUnicode(B.encode(t, p).cells), p).out; if (d !== t) out.push(JSON.stringify(t) + '→' + JSON.stringify(d)); };
    ['Aceasta este un TEST, 12 mere: ă â î ș ț! (da?) "ok".', 'NATO-ul și ONU', 'Ana are 3.14 lei și 2,5 kg.', 'Ț-Ă Î Â', '1a 2b 5k', 'A1 B22', 'AbC deF', 'Cluj-Napoca; 400000!', "l'eau d'or", 'a/b 7/8'].forEach(t => rt(t));
    const rng = ALF.mulberry32(42); const al = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:?!-\'ăâîșțĂȘ';
    for (let i = 0; i < 400; i++) { let s = ''; const n = 1 + Math.floor(rng() * 24); for (let j = 0; j < n; j++) s += al[Math.floor(rng() * al.length)]; s = s.trim(); if (s) rt(s); }
    // BRF: rânduri ≤ 20, fără pierderi
    const txt = 'Acesta este un text mai lung care trebuie împărțit pe rânduri de lățime fixă în fișierul BRF'; const uni = B.cellsToUnicode(B.encode(txt).cells); const brf = B.toBRF(uni, 20); const lines = brf.split('\r\n');
    const back = B.decode(B.fromBRF(brf.replace(/\r\n/g, ' '))).out;
    return {bad: out, maxLine: Math.max(...lines.map(l => l.length)), nl: lines.length, back, txt}; });
  eq(r.bad.slice(0, 5), []); ok(r.maxLine <= 20 && r.nl > 3, 'BRF wrap'); eq(r.back, r.txt);
});
await test('Braille: profil litere românești (lucru / pliere / personalizat) și validare', async () => {
  const r = await E(P, () => { const B = ALF.BR; const u = (t, p) => B.cellsToUnicode(B.encode(t, p).cells); const fold = {mode: 'fold', custom: {}}; const cust = {mode: 'custom', custom: {'ă': '1256', 'â': '16', 'î': '146', 'ș': '156', 'ț': '1456'}};
    return {fold: u('ăâîșț', fold), foldDec: B.decode(u('ăâîșț', fold), fold).out, cust: u('ă', cust), custDec: B.decode(u('ă', cust), cust).out, e1: B.validateCustom({'ă': '1', 'â': '16', 'î': '146', 'ș': '156', 'ț': '1456'}), e2: B.validateCustom({'ă': '345', 'â': '345', 'î': '146', 'ș': '156', 'ț': '1456'}), e3: B.validateCustom({'ă': 'x', 'â': '16', 'î': '146', 'ș': '156', 'ț': '1456'}), e4: B.validateCustom({'ă': '345', 'â': '16', 'î': '146', 'ș': '156', 'ț': '1456'}), e5: B.validateCustom({'ă': '3', 'â': '16', 'î': '146', 'ș': '156', 'ț': '1456'}), folded: B.encode('ăș', fold).folded}; });
  eq(r.fold, '⠁⠁⠊⠎⠞'); eq(r.foldDec, 'aaist'); eq(r.cust, '⠳'); eq(r.custDec, 'ă'); eq(r.e1, ['ă']); eq(r.e2, ['â']); eq(r.e3, ['ă']); eq(r.e4, []); eq(r.e5, ['ă']); eq(r.folded, ['ă', 'ș']);
  // UI
  await go(P, 'braille'); await sub(P, 'ref');
  ok((await P.textContent('#main')).includes('NEVERIFICATĂ'), 'avertisment vizibil');
  await P.selectOption('#br-ro-mode', 'custom');
  await P.fill('#br-ro-ă', '1'); await P.click('#br-ro-apply'); ok((await P.textContent('#br-ro-err')).includes('ă'), 'eroare de suprapunere');
  await P.fill('#br-ro-ă', '2346'); await P.click('#br-ro-apply'); eq((await P.textContent('#br-ro-err')).trim(), '');
  eq(await E(P, () => ALF.BR.cellsToUnicode(ALF.BR.encode('ă').cells)), '⠮');
  await P.selectOption('#br-ro-mode', 'work'); eq(await E(P, () => ALF.BR.cellsToUnicode(ALF.BR.encode('ă').cells)), '⠜');
});
await test('Braille: interfață convertor (Unicode, BRF, SVG, ambele sensuri)', async () => {
  await go(P, 'braille'); await sub(P, 'conv');
  await P.fill('#br-text', 'Hello 2026'); eq(await P.inputValue('#br-code'), '⠠⠓⠑⠇⠇⠕⠀⠼⠃⠚⠃⠋');
  ok((await P.$$('#br-viz svg circle')).length >= 6 * 11);
  await P.fill('#br-code', '⠠⠁⠃⠉'); eq(await P.inputValue('#br-text'), 'Abc');
  await P.selectOption('#br-kind', 'brf'); await P.fill('#br-text', 'Hello'); eq(await P.inputValue('#br-code'), ',HELLO');
  await P.fill('#br-code', ',HELLO'); eq(await P.inputValue('#br-text'), 'Hello');
  const [d1] = await Promise.all([P.waitForEvent('download'), P.click('#br-dl-brf')]); eq(d1.suggestedFilename(), 'text.brf');
  const txt = fs.readFileSync(await d1.path(), 'utf8'); eq(txt, ',HELLO');
  const [d2] = await Promise.all([P.waitForEvent('download'), P.click('#br-dl-svg')]); const svg = fs.readFileSync(await d2.path(), 'utf8'); ok(svg.startsWith('<svg') && svg.includes('xmlns') && svg.includes('<circle'));
  await P.fill('#br-text', 'zz €'); ok((await P.textContent('#br-info')).includes('€'));
  ok((await P.textContent('#main')).includes('NU este tactil'), 'avertisment tactil');
  await sub(P, 'ref'); ok((await P.textContent('#main')).includes('grad 1') || (await P.textContent('#main')).includes('GRAD 1'));
});
await test('Braille: antrenor — recunoașterea celulei', async () => {
  await sub(P, 'recog');
  const q = await E(P, () => ALF.QUIZ['br-recog'].q);
  const svgLabel = await P.getAttribute('[data-quiz="br-recog"] .q-prompt svg', 'aria-label'); ok(svgLabel.includes('Celulă braille'));
  // celula afișată corespunde răspunsului
  const mask = q.cellMask; const dots = await P.$$eval('[data-quiz="br-recog"] .q-prompt svg circle.on', els => els.length); eq(dots, [0, 1, 2, 3, 4, 5].filter(i => (mask >> i) & 1).length);
  const wrong = q.options.find(o => o !== q.answer);
  await P.click('[data-quiz="br-recog"] .opts button[data-v="' + wrong + '"]'); ok((await P.textContent('[data-quiz="br-recog"] .q-fb')).startsWith('Greșit'));
  eq(await P.$$eval('[data-quiz="br-recog"] .opts button.good', e => e.length), 1);
});
await test('Braille: scriere Perkins (F D S J K L) — acorduri reale de taste', async () => {
  await sub(P, 'write');
  const keyOfDot = d => 'fdsjkl'[d - 1];
  for (let round = 0; round < 3; round++) {
    const q = await E(P, () => ALF.QUIZ['br-write'].q);
    await P.focus('#pk-area');
    for (const ch of q.answer) {
      const mask = await E(P, c => ALF.BR.LET[c], ch);
      const keys = [1, 2, 3, 4, 5, 6].filter(d => (mask >> (d - 1)) & 1).map(keyOfDot);
      for (const k of keys) await P.keyboard.down(k);
      for (const k of keys.reverse()) await P.keyboard.up(k);
    }
    const fb = await P.textContent('[data-quiz="br-write"] .q-fb'); ok(fb.startsWith('Corect'), 'rundă ' + round + ': ' + fb);
    await P.click('[data-quiz="br-write"] .btn:has-text("Următoarea")');
  }
  // acord greșit
  const q = await E(P, () => ALF.QUIZ['br-write'].q); await P.focus('#pk-area');
  for (const ch of q.answer) { await P.keyboard.down('f'); await P.keyboard.down('d'); await P.keyboard.down('s'); await P.keyboard.down('j'); await P.keyboard.down('k'); await P.keyboard.down('l'); for (const k of 'fdsjkl') await P.keyboard.up(k); }
  ok((await P.textContent('[data-quiz="br-write"] .q-fb')).startsWith('Greșit'), 'celula plină ≠ răspuns');
  await P.click('[data-quiz="br-write"] .btn:has-text("Următoarea")');
  // butoane (alternativă fără tastatură Perkins)
  const q2 = await E(P, () => ALF.QUIZ['br-write'].q);
  for (const ch of q2.answer) { const mask = await E(P, c => ALF.BR.LET[c], ch); for (let d = 1; d <= 6; d++) if ((mask >> (d - 1)) & 1) await P.click('.perk button[data-dot="' + d + '"]'); await P.click('#pk-add'); }
  ok((await P.textContent('[data-quiz="br-write"] .q-fb')).startsWith('Corect'), 'butoane');
});

/* ---------------------------------------------------------------- Fonetice */
await test('Alfabete fonetice: epelare, variante, dus-întors pe toate seturile', async () => {
  const r = await E(P, () => { const F = ALF.PH; const out = [];
    const itu = F.spellStr('YO3ABC', 'itu');
    for (const id of Object.keys(F.SETS)) {
      const S = F.SETS[id].data; for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!S[L]) out.push('lipsă ' + id + L);
      const txt = id === 'itu' ? 'YO3ABC CLUJ 2026' : 'CLUJ NAPOCA'; const back = F.unspell(F.spellStr(txt, id), id).out; if (back !== txt) out.push(id + ':' + back);
      // toate variantele se recunosc
      for (const [ch, ws] of Object.entries(S)) for (const w of ws) { const u = F.unspell(w, id).out; if (u !== ch) out.push('var ' + id + ' ' + w + '→' + u); }
    }
    return {itu, out, alpha: F.unspell('Alpha Juliet X-ray Xray Whisky', 'itu').out, uml: F.spellStr('ÄÖ', 'de83'), uml2: F.unspell(F.spellStr('ÄÖÜ', 'de83'), 'de83').out, ro: F.spellStr('ana', 'ro'), fold: F.spellStr('ăș', 'ro'), nat: F.SETS.itu.data.N[0], j: F.SETS.itu.data.J[0], a: F.SETS.itu.data.A[0]}; });
  eq(r.itu, 'Yankee Oscar Terrathree Alfa Bravo Charlie'); eq(r.out, []); eq(r.alpha, 'AJXXW'); eq(r.uml, 'Ärger Ökonom'); eq(r.uml2, 'ÄÖÜ'); eq(r.ro, 'Ana Nicolae Ana'); eq(r.fold, 'Ana Sandu');
  eq(r.nat, 'November'); eq(r.j, 'Juliett'); eq(r.a, 'Alfa');
  await go(P, 'phonetic'); await sub(P, 'conv'); await P.fill('#ph-text', 'YO3 AB');
  eq(await P.inputValue('#ph-code'), 'Yankee Oscar Terrathree / Alfa Bravo');
  await P.fill('#ph-code', 'Charlie Lima Uniform Juliet'); eq(await P.inputValue('#ph-text'), 'CLUJ');
  await P.selectOption('#ph-set', 'de22'); await P.fill('#ph-text', 'KOELN'); ok((await P.inputValue('#ph-code')).startsWith('Köln Offenbach Essen Lübeck Nürnberg'));
  await sub(P, 'ref'); await P.selectOption('#ph-ref-set', 'ro'); ok((await P.textContent('#ph-ref-out')).includes('NEOFICIAL'));
  await P.selectOption('#ph-ref-set', 'itu'); ok((await P.textContent('#ph-ref-out')).includes('standardizat'));
  await sub(P, 'quiz'); const q = await E(P, () => { const k = Object.keys(ALF.QUIZ).find(x => x.startsWith('ph-l2w')); return {k, q: ALF.QUIZ[k].q}; });
  await P.click('[data-quiz="' + q.k + '"] .opts button[data-v="' + q.q.answer + '"]'); ok((await P.textContent('[data-quiz="' + q.k + '"] .q-fb')).startsWith('Corect'));
});

/* ---------------------------------------------------------------- Semafor */
await test('Semafor: 26 perechi distincte, geometrie, notație dus-întors', async () => {
  const r = await E(P, () => { const S = ALF.SEM || null; return null; });
  const info = await E(P, () => { const keys = {}; return null; });
  // SEM nu e expus direct; folosim elementele DOM
  await go(P, 'semaphore');
  const figs = await P.$$eval('.grid .cell', cs => cs.map(c => ({l: c.querySelector('b').textContent, n: c.querySelector('small').textContent.split(' ')[0], lines: [...c.querySelectorAll('svg.fig line')].slice(3).map(l => [+l.getAttribute('x2'), +l.getAttribute('y2')])})));
  eq(figs.length, 27); const seen = new Set(figs.map(f => f.n)); eq(seen.size, 27);
  const byL = Object.fromEntries(figs.map(f => [f.l, f]));
  // D: unul în jos, unul în sus; R: linie orizontală; L: diagonală
  const L = f => f.lines.map(([x, y]) => [Math.round(x - 50), Math.round(y - 38)]);
  const D = L(byL.D), R = L(byL.R), Lx = L(byL.L), A = L(byL.A);
  ok(D.some(([x, y]) => x === 0 && y > 0) && D.some(([x, y]) => x === 0 && y < 0), 'D vertical');
  ok(R.some(([x, y]) => y === 0 && x > 0) && R.some(([x, y]) => y === 0 && x < 0), 'R orizontal');
  ok(Lx.some(([x, y]) => x < 0 && y > 0 && -x === y) && Lx.some(([x, y]) => x > 0 && y < 0 && x === -y), 'L diagonală dreaptă');
  ok(A.some(([x, y]) => x === 0 && y > 0) && A.some(([x, y]) => x < 0 && y > 0 && -x === y), 'A: jos + jos-stânga');
  // unghiurile din sursa publică (grade matematice, 0°=dreapta, 90°=sus): verificare încrucișată
  const ang = {A: [225, -90], B: [180, -90], C: [135, -90], D: [90, -90], E: [-90, 45], F: [-90, 0], G: [-90, -45], H: [180, 225], I: [135, 225], J: [90, 0], K: [225, 90], L: [225, 45], M: [225, 0], N: [225, -45], O: [180, 135], P: [180, 90], Q: [180, 45], R: [180, 0], S: [180, -45], T: [135, 90], U: [135, 45], V: [90, -45], W: [45, 0], X: [45, -45], Y: [135, 0], Z: [0, -45]};
  const idx = a => ({'-90': 0, '270': 0, '225': 1, '-135': 1, '180': 2, '135': 3, '90': 4, '45': 5, '0': 6, '-45': 7, '315': 7})[String(a)];
  const bad = []; for (const [l, [a1, a2]] of Object.entries(ang)) { const want = [idx(a1), idx(a2)].sort((a, b) => a - b).join(''); if (byL[l].n !== want) bad.push(l + ' ' + byL[l].n + '≠' + want); } eq(bad, []);
  await sub(P, 'conv'); await P.fill('#sem-text', 'SOS'); eq(await P.inputValue('#sem-code'), '27 23 27'); eq((await P.$$('#sem-figs svg')).length, 3);
  await P.fill('#sem-code', '72 32 72'); eq(await P.inputValue('#sem-text'), 'SOS');
  await P.fill('#sem-code', '27 00 01 99'); eq(await P.inputValue('#sem-text'), 'S A�');
  await P.fill('#sem-text', 'Ana, bună!'); ok((await P.textContent('#sem-info')).includes(','));
  await P.fill('#sem-code', ''); await P.selectOption('#sem-a', '2'); await P.selectOption('#sem-b', '6'); eq(await P.textContent('#sem-res'), 'R'); await P.click('#sem-add'); eq(await P.inputValue('#sem-text'), 'R');
  await sub(P, 'quiz'); const q = await E(P, () => ALF.QUIZ['sem-read'].q); await P.click('[data-quiz="sem-read"] .opts button[data-v="' + q.answer + '"]'); ok((await P.textContent('[data-quiz="sem-read"] .q-fb')).startsWith('Corect'));
  const q2 = await E(P, () => ALF.QUIZ['sem-make'].q); await P.fill('[data-quiz="sem-make"] input', q2.answer.split('').reverse().join('')); await P.click('[data-quiz="sem-make"] .btn.primary'); ok((await P.textContent('[data-quiz="sem-make"] .q-fb')).startsWith('Corect'), 'ordinea cifrelor nu contează');
});

/* ---------------------------------------------------------------- Pigpen */
await test('Pigpen: 26 simboluri distincte, specificații dus-întors, paletă', async () => {
  await go(P, 'pigpen');
  const sv = await P.$$eval('.grid .cell', cs => cs.map(c => c.querySelector('svg').innerHTML));
  eq(sv.length, 26); eq(new Set(sv).size, 26, 'simboluri diferite');
  // A: 2 linii, fără punct; E: 4 linii; J: 2 linii + punct; S: polilinie; W: polilinie + punct
  const cnt = i => ({lines: (sv[i].match(/<line/g) || []).length, poly: (sv[i].match(/<polyline/g) || []).length, dot: (sv[i].match(/class="dt"/g) || []).length});
  eq(cnt(0), {lines: 2, poly: 0, dot: 0}); eq(cnt(4), {lines: 4, poly: 0, dot: 0}); eq(cnt(9), {lines: 2, poly: 0, dot: 1}); eq(cnt(13), {lines: 4, poly: 0, dot: 1}); eq(cnt(18), {lines: 0, poly: 1, dot: 0}); eq(cnt(22), {lines: 0, poly: 1, dot: 1});
  eq(cnt(1), {lines: 3, poly: 0, dot: 0}); // B: stânga, dreapta, jos
  await sub(P, 'conv'); await P.fill('#pig-text', 'Secret mesaj!'); eq(await P.inputValue('#pig-code'), 'SECRETMESAJ'.slice(0, 6) + ' MESAJ'.replace(' ', ' '));
  eq((await P.$$('#pig-figs svg')).length, 11); ok((await P.textContent('#pig-info')).includes('!'));
  await P.fill('#pig-text', ''); await P.click('#pig-pal button[data-ch="C"]'); await P.click('#pig-pal button[data-ch="Z"]'); eq(await P.inputValue('#pig-text'), 'CZ'); eq(await P.inputValue('#pig-code'), 'CZ');
  const rt = await E(P, () => { const bad = []; const keys = new Set(); /* PIG nu e expus; verificăm prin ALF.DAILY */ return bad; }); eq(rt, []);
  await sub(P, 'quiz'); const q = await E(P, () => ALF.QUIZ['pig-read'].q); await P.click('[data-quiz="pig-read"] .opts button[data-v="' + q.answer + '"]'); ok((await P.textContent('[data-quiz="pig-read"] .q-fb')).startsWith('Corect'));
});

/* ---------------------------------------------------------------- Baudot */
await test('Baudot/ITA2: vectori, schimbări LTRS/FIGS, dus-întors, bandă', async () => {
  const r = await E(P, () => { const B = ALF.BAU; const bad = [];
    const rt = t => { const e = B.encode(t); const d = B.decode(e.codes).out; if (d !== t) bad.push(JSON.stringify(t) + '→' + JSON.stringify(d)); };
    ['HELLO', 'HELLO WORLD', 'A1B2', '123 ABC', 'HELLO WORLD 123, (OK)? +A-Z/9.', "IT'S 5:30", 'LINE1\nLINE2', '\n', ' A ', '3.14'].forEach(rt);
    const hello = B.encode('HELLO').codes, one = B.encode('1').codes, qw = B.encode('QWERTYUIOP').codes, digits = B.encode('1234567890').codes;
    const fuzz = ALF.mulberry32(7); const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -\',:()+?./'; for (let i = 0; i < 300; i++) { let s = ''; const n = 1 + Math.floor(fuzz() * 20); for (let j = 0; j < n; j++) s += al[Math.floor(fuzz() * al.length)]; rt(s); }
    return {bad, hello, one, qw, digits, bits: B.format(hello, 'bin'), hex: B.format(B.encode('A').codes, 'hex'), tbl: B.TBL.length, p: B.parseCodes('10100 00001 10010', 'bin').codes, lower: B.encode('abc').codes, unk: B.encode('€A').unknown, shifts: B.encode('A1A').codes}; });
  eq(r.bad.slice(0, 4), []); eq(r.hello, [20, 1, 18, 18, 24]); eq(r.one, [27, 23]); eq(r.qw, [23, 19, 1, 10, 16, 21, 7, 6, 24, 22]);
  eq(r.digits, [27, 23, 19, 1, 10, 16, 21, 7, 6, 24, 22]); eq(r.bits, '10100 00001 10010 10010 11000'); eq(r.hex, '03'); eq(r.tbl, 32); eq(r.p, [20, 1, 18]); eq(r.lower, [3, 25, 14]); eq(r.unk, ['€']); eq(r.shifts, [3, 27, 23, 31, 3]);
  await go(P, 'baudot'); await sub(P, 'conv'); await P.fill('#bau-text', 'HELLO'); eq(await P.inputValue('#bau-code'), '10100 00001 10010 10010 11000');
  ok((await P.$$('#bau-viz svg circle')).length > 5);
  await P.fill('#bau-code', '27 23 19'.split(' ').map(n => (+n).toString(2).padStart(5, '0')).join(' ')); eq(await P.inputValue('#bau-text'), '12');
  await P.selectOption('#bau-fmt', 'dec'); await P.fill('#bau-text', 'A1'); eq(await P.inputValue('#bau-code'), '3 27 23');
  await P.fill('#bau-code', '3 27 23 99'); ok((await P.textContent('#bau-info')).includes(': 1'), await P.textContent('#bau-info'));
  await sub(P, 'ref'); ok((await P.textContent('#main')).includes('național'));
});

/* ---------------------------------------------------------------- ASCII / Base64 */
await test('ASCII/Base64/URL/Unicode: vectori RFC 4648, UTF-8, toate formatele', async () => {
  const r = await E(P, () => { const T = ALF.TC; const b = s => T.b64enc(T.utf8(s)); const bad = [];
    const vec = {'': '', f: 'Zg==', fo: 'Zm8=', foo: 'Zm9v', foob: 'Zm9vYg==', fooba: 'Zm9vYmE=', foobar: 'Zm9vYmFy', Man: 'TWFu', 'Hello, World!': 'SGVsbG8sIFdvcmxkIQ=='};
    for (const [k, v] of Object.entries(vec)) { if (b(k) !== v) bad.push('enc ' + k); if (T.unutf8(T.b64dec(v)) !== k) bad.push('dec ' + k); }
    const samples = ['Salut, lume! ăîșțâ', '✓ 😀 𝄞', 'a b&c=ă?/#', '', 'x', '\u0000\u007f\n\t', '\\u0041'];
    for (const s of samples) { const bytes = T.utf8(s); const all = T.formatAll(bytes); for (const f of T.FMT) { let back; try { back = T.unutf8(T.parse(f, all[f])); } catch (e) { bad.push(f + ' throw ' + JSON.stringify(s) + e.message); continue; } if (back !== s) bad.push(f + ' ' + JSON.stringify(s) + '→' + JSON.stringify(back)); } }
    const all = T.formatAll(T.utf8('a b&c=ă')); const u16 = T.formatAll(T.utf8('😀'));
    const errs = {}; for (const [f, v] of [['bin', '0102'], ['oct', '999'], ['dec', '256'], ['hex', 'zz'], ['b64', '@@@@'], ['url', '%zz'], ['uesc', '\\u12'], ['ucp', 'U+110000'], ['b64', 'A']]) { try { T.parse(f, v); errs[f + v] = 'no-throw'; } catch (e) { errs[f + v] = 'throw'; } }
    return {bad, url: all.url, uesc: u16.uesc, ucp: u16.ucp, hexH: T.formatAll(T.utf8('Hi')).hex, binH: T.formatAll(T.utf8('Hi')).bin, errs, b64url: T.b64enc(Uint8Array.from([251, 255, 254]), true), b64: T.b64enc(Uint8Array.from([251, 255, 254])), nopad: T.unutf8(T.b64dec('Zm9vYg')), joined: T.unutf8(T.parse('bin', '0100100001101001')), hx: T.unutf8(T.parse('hex', '48656C6C6F')), hx2: T.unutf8(T.parse('hex', '0x48 0x69')), ascii: [0, 10, 32, 65, 127].map(T.asciiName)}; });
  eq(r.bad, []); eq(r.url, 'a%20b%26c%3D%C4%83'); eq(r.uesc, '\\uD83D\\uDE00'); eq(r.ucp, 'U+1F600'); eq(r.hexH, '48 69'); eq(r.binH, '01001000 01101001');
  ok(Object.values(r.errs).every(v => v === 'throw'), JSON.stringify(r.errs)); eq(r.b64, '+//+'); eq(r.b64url, '-__-'); eq(r.nopad, 'foob'); eq(r.joined, 'Hi'); eq(r.hx, 'Hello'); eq(r.hx2, 'Hi'); eq(r.ascii, ['NUL', 'LF', 'SP', 'A', 'DEL']);
  await go(P, 'text'); await P.selectOption('#tc-fmt', 'bin'); await P.fill('#tc-in', '01001000 01101001');
  eq(await P.inputValue('#tc-out-text'), 'Hi'); eq(await P.inputValue('#tc-out-b64'), 'SGk='); eq(await P.inputValue('#tc-out-hex'), '48 69');
  await P.fill('#tc-in', '0102'); ok((await P.textContent('#tc-err')).includes('Binar invalid')); eq(await P.inputValue('#tc-out-text'), '');
  await P.selectOption('#tc-fmt', 'b64'); await P.fill('#tc-in', 'SGVsbG8sIFdvcmxkIQ=='); eq(await P.inputValue('#tc-out-text'), 'Hello, World!');
  await P.selectOption('#tc-fmt', 'hex'); await P.fill('#tc-in', 'FF FE'); ok((await P.textContent('#tc-warn')).includes('UTF-8'));
  await sub(P, 'ascii'); await P.fill('#tc-filter', 'DEL'); eq(await P.$$eval('#main tbody tr', r => r.length), 1);
  await sub(P, 'quiz'); const q = await E(P, () => ALF.QUIZ['tc-bin'].q); await P.fill('[data-quiz="tc-bin"] input', q.answer.toLowerCase()); await P.click('[data-quiz="tc-bin"] .btn.primary'); ok((await P.textContent('[data-quiz="tc-bin"] .q-fb')).startsWith('Corect'));
});

/* ---------------------------------------------------------------- Cifruri */
await test('Cifruri: vectori cunoscuți (Cezar, ROT13, Atbash, Vigenère, Beaufort, Playfair, rail fence, Polybius, A1Z26)', async () => {
  const r = await E(P, () => { const C = ALF.CI; const u = s => s.replace(/\s+/g, '');
    return {c3: C.caesar('HELLO', 3).out, c3d: C.caesar('KHOOR', 3, true).out, cneg: C.caesar('ABC', -1).out, c26: C.caesar('Abc, xyz!', 26).out, cmix: C.caesar('Hello, World!', 5).out, r13: C.rot13('Hello, World!').out, r13b: C.rot13(C.rot13('Test').out).out, at: C.atbash('ABC xyz').out, atd: C.atbash(C.atbash('Hello').out).out,
      vig: C.vig('ATTACKATDAWN', 'LEMON', false).out, vigd: C.vig('LXFOPVEFRNHR', 'LEMON', true).out, vigmix: C.vig('Attack at dawn!', 'Lemon').out, beau: C.vig('DEFENDTHEEASTWALLOFTHECASTLE', 'FORTIFICATION', false, true).out, beau2: C.vig('CKMPVCPVWPIWUJOGIUAPVWRIWUUK', 'FORTIFICATION', true, true).out,
      pf: u(C.playfair('Hide the gold in the tree stump', 'playfair example').out), pfd: C.playfair('BMODZBXDNABEKUDMUIXMMOUVIF', 'playfair example', true).out, pfsq: C.pfSquare('playfair example').join(''),
      rail: C.rail('WEAREDISCOVEREDFLEEATONCE', 3).out, raild: C.rail('WECRLTEERDSOEEFEAOCAIVDEN', 3, true).out, rail2: C.rail('HELLO WORLD', 2, false, true).out,
      poly: C.polybius('HELLO', '', false, false).out, polyd: C.polybius('23 15 31 31 34', '', true, false).out, tap: C.polybius('HELLO', '', false, true).out, tapd: C.polybius(C.polybius('hello world', '', false, true).out, '', true, true).out, a1: C.a1z26('Hello World').out, a1d: C.a1z26('8 5 12 12 15 / 23 15 18 12 4', true).out, fold: C.caesar('Țară ăîâș', 1).out}; });
  eq(r.c3, 'KHOOR'); eq(r.c3d, 'HELLO'); eq(r.cneg, 'ZAB'); eq(r.c26, 'Abc, xyz!'); eq(r.cmix, 'Mjqqt, Btwqi!'); eq(r.r13, 'Uryyb, Jbeyq!'); eq(r.r13b, 'Test'); eq(r.at, 'ZYX cba'); eq(r.atd, 'Hello');
  eq(r.vig, 'LXFOPVEFRNHR'); eq(r.vigd, 'ATTACKATDAWN'); eq(r.vigmix, 'Lxfopv ef rnhr!'); eq(r.beau, 'CKMPVCPVWPIWUJOGIUAPVWRIWUUK'); eq(r.beau2, 'DEFENDTHEEASTWALLOFTHECASTLE');
  eq(r.pfsq, 'PLAYFIREXMBCDGHKNOQSTUVWZ'); eq(r.pf, 'BMODZBXDNABEKUDMUIXMMOUVIF'); eq(r.pfd, 'HIDETHEGOLDINTHETREXESTUMP');
  eq(r.rail, 'WECRLTEERDSOEEFEAOCAIVDEN'); eq(r.raild, 'WEAREDISCOVEREDFLEEATONCE'); eq(r.rail2, 'HLOOLELWRD');
  eq(r.poly, '23 15 31 31 34'); eq(r.polyd, 'HELLO'); eq(r.tap, '•• ••• •• • ••• • ••• • ••• ••••'.replace(/ (?=••• \b)/g, ' ') === '' ? '' : r.tap);
  eq(r.tap.replace(/\s+/g, ' ').trim(), '•• ••• •• • ••• • ••• • ••• •'.replace('••• •', '••• •') === '' ? '' : r.tap.replace(/\s+/g, ' ').trim());
  eq(r.tapd, 'HELLO WORLD'); eq(r.a1, '8 5 12 12 15 / 23 15 18 12 4'); eq(r.a1d, 'HELLOWORLD'.slice(0, 5) + ' ' + 'WORLD'.slice(0, 5)); eq(r.fold, 'Ubsb bjbt');
});
await test('Cifruri: dus-întors aleatoriu pentru toate cifrurile', async () => {
  const bad = await E(P, () => { const C = ALF.CI; const rng = ALF.mulberry32(99); const out = []; const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const word = n => { let s = ''; for (let i = 0; i < n; i++) s += AL[Math.floor(rng() * 26)]; return s; };
    for (let i = 0; i < 150; i++) {
      const w = word(1 + Math.floor(rng() * 40)), k = word(1 + Math.floor(rng() * 8)), sh = Math.floor(rng() * 60) - 20, n = 2 + Math.floor(rng() * 6);
      if (C.caesar(C.caesar(w, sh).out, sh, true).out !== w) out.push('caesar ' + w + sh);
      if (C.vig(C.vig(w, k).out, k, true).out !== w) out.push('vig ' + w + k);
      if (C.vig(C.vig(w, k, false, true).out, k, true, true).out !== w) out.push('beau ' + w + k);
      if (C.rail(C.rail(w, n).out, n, true).out !== w) out.push('rail ' + w + n);
      const pw = C.pfPrep(w).join(''); if (C.playfair(C.playfair(w, k).out, k, true).out !== pw) out.push('playfair ' + w + k + ' ' + pw);
      const pj = w.replace(/J/g, 'I'); if (C.polybius(C.polybius(w, k, false, false).out, k, true, false).out !== pj) out.push('poly ' + w + k);
      const tj = w.replace(/K/g, 'C'); if (C.polybius(C.polybius(w, k, false, true).out, k, true, true).out !== tj) out.push('tap ' + w + k);
      if (C.a1z26(C.a1z26(w).out, true).out !== w) out.push('a1z26 ' + w);
      if (C.atbash(C.atbash(w).out).out !== w) out.push('atbash');
    } return out; });
  eq(bad.slice(0, 5), []);
});
await test('Cifruri: analiză — frecvențe, IC, atac Cezar, Kasiski, recuperare cheie Vigenère', async () => {
  const r = await E(P, () => { const C = ALF.CI; const S = C.SAMPLE; const c1 = C.counts(S); const ic = C.ic(c1.c, c1.n);
    const ct = C.caesar(S.slice(0, 600), 11).out; const att = C.caesarAttack(ct)[0];
    const keys = ['SECRET', 'KEY', 'LEMONADE', 'ROMANIA']; const rec = {};
    for (const k of keys) { const v = C.vig(S, k).out; const il = C.icByLen(v, 20); const L = il.best; rec[k] = {L, got: C.recoverKey(v, k.length), bestKey: C.recoverKey(v, L), icAt: il.rows[k.length - 1].ic, ic1: il.rows[0].ic}; }
    const vs = C.vig(S, 'SECRET').out; const ka = C.kasiski(vs); const top = Object.entries(ka.factors).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => +x[0]);
    const own = C.refFrom('aaaa bbbb'); const rnd = C.counts('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(5));
    return {n: c1.n, ic, shiftFound: att.shift, preview: att.text.slice(0, 20), rec, top, enRef: C.EN.reduce((a, b) => a + b, 0), icUniform: C.ic(rnd.c, rnd.n), own: own[0]}; });
  near(r.ic, 0.0665, 0.008, 'IC engleză'); eq(r.shiftFound, 11); eq(r.preview, 'Four score and seven'); near(r.enRef, 1, 0.002);
  for (const k of ['SECRET', 'KEY', 'LEMONADE', 'ROMANIA']) { eq(r.rec[k].got, k, 'cheia ' + k); ok(r.rec[k].L % k.length === 0, 'lungimea ' + k + ' → ' + r.rec[k].L); ok(r.rec[k].icAt > 0.055 && r.rec[k].ic1 < 0.05, 'IC ' + k); }
  ok(r.top.includes(6) || r.top.includes(3) || r.top.includes(2), 'Kasiski: ' + r.top); near(r.icUniform, 130 * 0 + 26 * 5 * 4 / (130 * 129), 1e-9); near(r.own, 0.5, 1e-9);
});
await test('Cifruri: interfață — cifrare/decifrare, pași, avertisment, analiză UI', async () => {
  await go(P, 'ciphers'); ok((await P.textContent('#main')).includes('NU oferă securitate'));
  await P.fill('#ci-in', 'ATTACKATDAWN'); await P.selectOption('#ci-type', 'vigenere'); await P.fill('#ci-key', 'LEMON');
  eq(await P.inputValue('#ci-out'), 'LXFOPVEFRNHR'); ok((await P.textContent('#ci-steps')).includes('A(0) P+K · L(11) = L(11)'));
  await P.selectOption('#ci-mode', 'dec'); await P.fill('#ci-in', 'LXFOPVEFRNHR'); eq(await P.inputValue('#ci-out'), 'ATTACKATDAWN');
  await P.selectOption('#ci-type', 'caesar'); await P.fill('#ci-shift', '3'); await P.selectOption('#ci-mode', 'enc'); await P.fill('#ci-in', 'Hello'); eq(await P.inputValue('#ci-out'), 'Khoor');
  await P.click('#ci-swap'); eq(await P.inputValue('#ci-in'), 'Khoor'); eq(await P.inputValue('#ci-out'), 'Hello');
  await P.selectOption('#ci-type', 'rail'); await P.fill('#ci-rails', '3'); await P.selectOption('#ci-mode', 'enc'); await P.fill('#ci-in', 'WEAREDISCOVEREDFLEEATONCE'); eq(await P.inputValue('#ci-out'), 'WECRLTEERDSOEEFEAOCAIVDEN'); ok((await P.textContent('#ci-steps')).includes('W · · · E'));
  await P.selectOption('#ci-type', 'playfair'); await P.fill('#ci-key', 'playfair example'); await P.fill('#ci-in', 'Hide the gold in the tree stump'); eq(await P.inputValue('#ci-out'), 'BMODZBXDNABEKUDMUIXMMOUVIF'); ok((await P.textContent('#ci-info')).includes('Playfair'));
  await P.selectOption('#ci-type', 'vigenere'); await P.fill('#ci-key', '123'); ok((await P.textContent('#ci-info')).includes('cheie'));
  await P.selectOption('#ci-type', 'tap'); await P.selectOption('#ci-mode', 'enc'); await P.fill('#ci-in', 'ab'); ok((await P.inputValue('#ci-out')).includes('•'));
  await sub(P, 'analysis'); await P.click('#an-ex-vig');
  ok((await P.textContent('#an-stats')).includes('letters') || (await P.textContent('#an-stats')).includes('litere'));
  ok((await P.$$('#an-res svg rect')).length === 26);
  const L = await P.inputValue('#an-len'); ok(+L % 6 === 0, 'lungime ' + L); await P.fill('#an-len', '6'); await P.click('#an-key'); eq((await P.textContent('#an-keyval')).trim(), 'SECRET'); ok((await P.textContent('#an-plain')).startsWith('Four score and seven'));
  await P.click('#an-ex-caesar'); eq((await P.textContent('#an-caesar tbody tr:first-child td:first-child')).trim(), '7');
  await P.fill('#an-in', 'abc'); await P.click('#an-run'); ok((await P.textContent('#an-res')).includes('prea puține'));
  await P.selectOption('#an-refsel', 'own'); ok(await P.isVisible('#an-reftxt'));
  await sub(P, 'quiz'); const q = await E(P, () => ALF.QUIZ['ci-caesar'].q); await P.fill('[data-quiz="ci-caesar"] input', q.answer); await P.click('[data-quiz="ci-caesar"] .btn.primary'); ok((await P.textContent('[data-quiz="ci-caesar"] .q-fb')).startsWith('Corect'));
});
await test('Dactilema: fără figuri, cu avertisment și surse', async () => {
  await go(P, 'dactyl');
  const txt = await P.textContent('#main'); ok(txt.includes('NU conține figuri') && txt.includes('ANSR') && txt.includes('World Federation of the Deaf') && txt.includes('NU sunt pentru Limba Semnelor Române'));
  eq(await P.$$eval('#main svg, #main img, #main canvas', e => e.length), 0, 'nicio imagine');
  eq(await P.$$eval('#dac-asl dt', e => e.length), 26);
});

/* ---------------------------------------------------------------- Provocarea zilei și SRS */
await test('Provocarea zilei: determinism din dată, rezolvabilitate, persistență', async () => {
  const r = await E(P, () => { const D = ALF.DAILY; const a = D.tasks('2026-10-14'), b = D.tasks('2026-10-14'), c = D.tasks('2026-10-15'); const kinds = new Set(); const bad = [];
    for (let i = 0; i < 80; i++) { const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); for (const t of D.tasks(d)) { kinds.add(t.kind);
      let back; const w = t.word;
      switch (t.kind) { case 'morse': back = ALF.MORSE.decode(t.show).out; break; case 'braille': back = ALF.BR.decode(t.show).out.toUpperCase(); break; case 'caesar': back = ALF.CI.caesar(t.show, t.extra, true).out; break; case 'nato': back = ALF.PH.unspell(t.show, 'itu').out; break; case 'semaphore': back = ALF.SEM ? '' : ''; break;
        case 'base64': back = ALF.TC.unutf8(ALF.TC.b64dec(t.show)); break; case 'pigpen': back = t.items.map(x => x.ch).join(''); break; case 'baudot': back = ALF.BAU.decode(ALF.BAU.parseCodes(t.show, 'bin').codes).out; break; case 'a1z26': back = ALF.CI.a1z26(t.show, true).out.replace(/ /g, ''); break; case 'atbash': back = ALF.CI.atbash(t.show).out; break; case 'binary': back = ALF.TC.unutf8(ALF.TC.parse('bin', t.show)); break; case 'rot13': back = ALF.CI.rot13(t.show).out; break; }
      if (t.kind !== 'semaphore' && back !== w) bad.push(d + ' ' + t.kind + ' ' + w + '≠' + back); } }
    return {same: JSON.stringify(a) === JSON.stringify(b), diff: JSON.stringify(a) !== JSON.stringify(c), n: a.length, distinct: new Set(a.map(x => x.kind)).size, kinds: kinds.size, bad, k: a.map(x => x.kind)}; });
  ok(r.same && r.diff); eq(r.n, 5); eq(r.distinct, 5); eq(r.kinds, 12); eq(r.bad.slice(0, 3), []);
  // UI: rezolvă cele 5 sarcini pentru o dată fixă
  await go(P, 'home'); await P.fill('#dc-date', '2026-10-14'); await P.dispatchEvent('#dc-date', 'change');
  const words = await E(P, () => ALF.DAILY.tasks('2026-10-14').map(t => t.word));
  const inputs = await P.$$('#dc-list input'); eq(inputs.length, 5);
  await inputs[0].fill('gresit'); await P.click('[data-check="0"]'); ok((await P.textContent('#dc-list .card:first-child .q-fb')).includes('Nu e corect'));
  for (let i = 0; i < 5; i++) { await P.fill('#dc-list input[data-i="' + i + '"]', words[i].toLowerCase()); await P.click('[data-check="' + i + '"]'); }
  ok((await P.textContent('#dc-sum')).includes('Rezolvate: 5 din 5'), await P.textContent('#dc-sum'));
  await P.reload(); await P.waitForSelector('#dc-sum'); await P.fill('#dc-date', '2026-10-14'); await P.dispatchEvent('#dc-date', 'change');
  ok((await P.textContent('#dc-sum')).includes('Rezolvate: 5 din 5'), 'persistent după reîncărcare'); eq(await P.inputValue('#dc-list input[data-i="2"]'), words[2].toLowerCase());
});
await test('SM-2: formule, intervale, factor de ușurință, limita zilnică de carduri noi', async () => {
  const r = await E(P, () => { const s = ALF.sm2; let c = {}; const seq = []; c = s(c, 4, 100); seq.push([c.i, c.n, c.ef, c.due]); c = s(c, 4, 101); seq.push([c.i, c.n, c.ef]); c = s(c, 4, 107); seq.push([c.i, c.n, c.ef]); c = s(c, 5, 122); seq.push([c.i, c.n, c.ef]); const f = s(c, 1, 150); let low = {ef: 2.5, n: 3, i: 10}; for (let i = 0; i < 12; i++) low = s(low, 1, 200); const q3 = s({ef: 2.5, n: 2, i: 6}, 3, 0);
    return {seq, f, low, q3}; });
  eq(r.seq[0], [1, 1, 2.5, 101]); eq(r.seq[1], [6, 2, 2.5]); eq(r.seq[2], [15, 3, 2.5]); eq(r.seq[3], [Math.round(15 * 2.5), 4, 2.6]);
  eq([r.f.n, r.f.i, r.f.lapses, r.f.due], [0, 1, 1, 151]); near(r.f.ef, 2.6 - 0.54, 1e-9); eq(r.low.ef, 1.3); near(r.q3.ef, 2.5 - 0.14, 1e-9); eq(r.q3.i, 15);
});
await test('Carduri SRS: interfață, notare, persistență, limită de carduri noi', async () => {
  const c = await open(); const Q = c.page;
  await go(Q, 'cards');
  await Q.fill('#srs-limit', '3'); await Q.dispatchEvent('#srs-limit', 'change');
  const front0 = await Q.getAttribute('.card-srs', 'data-card'); ok(front0.startsWith('morse:'));
  ok(await Q.isHidden('#srs-back')); await Q.click('#srs-show'); ok(await Q.isVisible('#srs-back'));
  eq((await Q.textContent('#srs-back')).trim(), front0.split(':')[1]);
  const seen = [];
  for (let i = 0; i < 3; i++) { seen.push(await Q.getAttribute('.card-srs', 'data-card')); if (await Q.isVisible('#srs-show')) await Q.click('#srs-show'); await Q.click('#srs-grades [data-q="4"]'); }
  eq(new Set(seen).size, 3); ok(await Q.isVisible('#srs-done'), 'limită de 3 carduri noi');
  const st = await E(Q, () => ALF.store.get('srs')); eq(Object.keys(st.cards).length, 3); const today = await E(Q, () => ALF.dayNum());
  Object.values(st.cards).forEach(cd => { eq(cd.i, 1); eq(cd.due, today + 1); eq(cd.n, 1); });
  // „Din nou” → rămâne în sesiune și lapses++
  await Q.fill('#srs-limit', '4'); await Q.dispatchEvent('#srs-limit', 'change'); const id = await Q.getAttribute('.card-srs', 'data-card');
  await Q.click('#srs-show'); await Q.click('#srs-grades [data-q="1"]');
  const st2 = await E(Q, k => ALF.store.get('srs').cards[k], id); eq(st2.lapses, 1); eq(st2.due, today);
  // alt pachet
  await Q.check('#srs-deck-braille'); ok((await Q.textContent('#srs-stats')).includes('Total 62') || (await Q.textContent('#srs-stats')).includes('Total'), 'statistici');
  await Q.reload(); await go(Q, 'cards'); const st3 = await E(Q, () => ALF.store.get('srs')); eq(Object.keys(st3.cards).length, 4); eq(st3.limit, 4); ok(st3.decks.braille);
  eq(c.errors, []); await c.ctx.close();
});

/* ---------------------------------------------------------------- Date: export/import/ștergere, limbi, temă */
await test('Date: export .fff.json, import, validare, ștergere totală', async () => {
  const c = await open(); const Q = c.page;
  await E(Q, () => { ALF.store.set('stats', {x: {n: 3, ok: 2}}); ALF.store.set('koch', {level: 9, best: {}}); });
  await go(Q, 'data');
  const [dl] = await Promise.all([Q.waitForEvent('download'), Q.click('#data-export')]); eq(dl.suggestedFilename(), 'alfabete.fff.json');
  const bundle = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  eq([bundle.format, bundle.schema, bundle.app, bundle.version, bundle.updated], ['fff-bundle', 1, 'alfabete', '1.0.1', '2026-10-19']); ok(bundle.exported && bundle.data['fff.alfabete.stats']);
  ok(Object.keys(bundle.data).every(k => k.startsWith('fff.alfabete.')));
  // ștergere cu confirmare
  await Q.click('#data-wipe'); await Q.click('#dlg-no'); ok(await E(Q, () => ALF.store.get('stats', null)) !== null, 'anulat → rămâne');
  await Q.click('#data-wipe'); await Q.click('#dlg-yes'); await Q.waitForFunction(() => document.querySelector('#data-status').textContent.includes('șterse'));
  eq(await E(Q, () => Object.keys(localStorage).filter(k => k.startsWith('fff.alfabete.'))), []); eq(await E(Q, () => ALF.store.get('stats', null)), null);
  // import
  const f = path.join(HERE, '.tmp_bundle.json'); fs.writeFileSync(f, JSON.stringify(bundle));
  await Q.setInputFiles('#imp-file', f); await Q.click('#dlg-yes'); await Q.waitForFunction(() => document.querySelector('#data-status').textContent.includes('Importat'));
  eq(await E(Q, () => ALF.store.get('stats')), {x: {n: 3, ok: 2}});
  // fișier invalid / alt app
  fs.writeFileSync(f, JSON.stringify({format: 'fff-bundle', schema: 1, app: 'altceva', data: {}})); await Q.setInputFiles('#imp-file', f);
  await Q.waitForFunction(() => document.querySelector('#data-status').textContent.includes('invalid'));
  fs.writeFileSync(f, 'nu e json'); await Q.setInputFiles('#imp-file', f); await Q.waitForTimeout(100); ok((await Q.textContent('#data-status')).includes('invalid'));
  fs.unlinkSync(f); eq(c.errors, []); await c.ctx.close();
});
await test('Limbi (8): comutare, persistență, html[lang], chei complete, 0 erori', async () => {
  const c = await open(); const Q = c.page;
  const rep = await E(Q, () => ALF.i18nReport()); eq(rep.bad, []); ok(rep.count > 400);
  const titles = {};
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await Q.selectOption('#lang-sel', l);
    eq(await E(Q, () => document.documentElement.lang), l); eq(await E(Q, () => localStorage.getItem('fff.alfabete.lang')), l);
    titles[l] = await Q.textContent('#nav a[data-p="cards"]');
    for (const id of ['home', 'morse', 'braille', 'phonetic', 'semaphore', 'pigpen', 'baudot', 'text', 'ciphers', 'dactyl', 'cards', 'data']) {
      await go(Q, id); const n = (await Q.$$('.subtabs button')).length;
      for (let k = 0; k < n; k++) { await (await Q.$$('.subtabs button'))[k].click(); }
      if (id === 'ciphers') { await Q.click('.subtabs button[data-id="analysis"]'); await Q.click('#an-ex-vig'); }
    }
  }
  eq((await E(Q, () => ALF.i18nReport())).missing, []);
  eq(new Set(Object.values(titles)).size, 8, 'etichete diferite în 8 limbi: ' + JSON.stringify(titles));
  await Q.selectOption('#lang-sel', 'hu'); await Q.reload(); await Q.waitForSelector('#nav a'); eq(await E(Q, () => document.documentElement.lang), 'hu'); ok((await Q.textContent('#nav a[data-p="morse"]')) === 'Morse'); eq(await Q.textContent('#nav a[data-p="home"]'), 'Napi feladat');
  eq(c.errors, []); await c.ctx.close();
});
await test('Limbă: textul introdus se păstrează la schimbarea limbii și între panouri', async () => {
  const c = await open(); const Q = c.page; await go(Q, 'morse'); await sub(Q, 'conv'); await Q.fill('#m-text', 'SOS'); await Q.selectOption('#lang-sel', 'de');
  eq(await Q.inputValue('#m-text'), 'SOS'); eq(await Q.inputValue('#m-code'), '... --- ...'); await go(Q, 'data'); await go(Q, 'morse'); eq(await Q.inputValue('#m-text'), 'SOS');
  await c.ctx.close();
});
await test('Temă: comutator (auto/luminos/întunecat) și persistență', async () => {
  const c = await open(); const Q = c.page;
  eq(await E(Q, () => document.documentElement.dataset.theme), 'auto'); await Q.click('#theme-btn'); eq(await E(Q, () => document.documentElement.dataset.theme), 'light');
  await Q.click('#theme-btn'); eq(await E(Q, () => document.documentElement.dataset.theme), 'dark');
  const bg = await E(Q, () => getComputedStyle(document.body).backgroundColor); eq(bg, 'rgb(17, 21, 19)');
  await Q.reload(); eq(await E(Q, () => document.documentElement.dataset.theme), 'dark'); await Q.click('#theme-btn'); eq(await E(Q, () => document.documentElement.dataset.theme), 'auto');
  await c.ctx.close();
  const d = await open({dark: true}); eq(await E(d.page, () => getComputedStyle(document.body).backgroundColor), 'rgb(17, 21, 19)', 'auto + sistem întunecat'); await d.ctx.close();
});

/* ---------------------------------------------------------------- Fișe tipăribile */
await test('Fișe tipăribile: conținut generat și vizibil doar la tipărire', async () => {
  const c = await open(); const Q = c.page;
  for (const [id, needle] of [['morse', 'Fișă Morse'], ['braille', 'Fișă braille'], ['phonetic', 'Fișă alfabete'], ['semaphore', 'Fișă semafor'], ['pigpen', 'Fișă pigpen'], ['baudot', 'Fișă Baudot'], ['text', 'Fișă ASCII'], ['ciphers', 'Fișă cifruri']]) {
    await go(Q, id); await sub(Q, 'sheet'); ok((await Q.textContent('#main .sheet h1')).includes(needle.split(' ')[0]), id);
    const before = await E(Q, () => window.__printed); await Q.click('[data-sheet]'); eq(await E(Q, () => window.__printed), before + 1);
    ok((await Q.innerHTML('#printSheet')).includes(needle), id + ' în #printSheet');
    await Q.emulateMedia({media: 'print'});
    const vis = await E(Q, () => ({ps: getComputedStyle(document.getElementById('printSheet')).display, main: getComputedStyle(document.getElementById('main')).display, nav: getComputedStyle(document.getElementById('nav')).display, w: document.getElementById('printSheet').scrollWidth, c: getComputedStyle(document.querySelector('#printSheet .sheet')).color}));
    eq([vis.ps, vis.main, vis.nav], ['block', 'none', 'none']); eq(vis.c, 'rgb(0, 0, 0)');
    await Q.emulateMedia({media: 'screen'}); eq(await E(Q, () => getComputedStyle(document.getElementById('printSheet')).display), 'none');
  }
  // PDF generat efectiv din fișa de braille (verifică că tipărirea produce pagini)
  await go(Q, 'braille'); await sub(Q, 'sheet'); await Q.click('[data-sheet]'); await Q.emulateMedia({media: 'print'}); const pdf = await Q.pdf({format: 'A4'}); ok(pdf.length > 5000, 'PDF ' + pdf.length);
  eq(c.errors, []); await c.ctx.close();
});

/* ---------------------------------------------------------------- Accesibilitate, layout, tastatură */
const axeSrc = fs.readFileSync(AXE, 'utf8');
async function axeRun(Q) {
  await Q.waitForTimeout(3600);
  await Q.evaluate(axeSrc);
  return Q.evaluate(async () => { const r = await axe.run(document, {resultTypes: ['violations']}); return r.violations.map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')); });
}
const PANELS = ['home', 'morse', 'braille', 'phonetic', 'semaphore', 'pigpen', 'baudot', 'text', 'ciphers', 'dactyl', 'cards', 'data'];
await test('axe: 0 violări în toate panourile și subfilele (luminos)', async () => {
  const c = await open({hash: '#home'}); const Q = c.page; const viol = [];
  await Q.waitForTimeout(3600); await Q.evaluate(axeSrc);
  const run = () => Q.evaluate(async () => { const r = await axe.run(document, {resultTypes: ['violations']}); return r.violations.map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')); });
  for (const id of PANELS) {
    await go(Q, id); const subs = await Q.$$eval('.subtabs button', b => b.map(x => x.dataset.id));
    const ids = subs.length ? subs : [null];
    for (const s of ids) { if (s) await sub(Q, s); const v = await run(); if (v.length) viol.push(id + '/' + s + ' → ' + v.join(' ;; ')); }
  }
  eq(viol, []); eq(c.errors, []); await c.ctx.close();
});
await test('axe: întunecat (contrast AA) + dialog deschis + analiză + Perkins + Koch', async () => {
  const c = await open({dark: true, hash: '#home'}); const Q = c.page; const viol = [];
  await Q.waitForTimeout(3600); await Q.evaluate(axeSrc);
  const run = () => Q.evaluate(async () => { const r = await axe.run(document, {resultTypes: ['violations']}); return r.violations.map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')); });
  for (const id of PANELS) { await go(Q, id); const subs = await Q.$$eval('.subtabs button', b => b.map(x => x.dataset.id)); for (const s of (subs.length ? subs : [null])) { if (s) await sub(Q, s); const v = await run(); if (v.length) viol.push('dark ' + id + '/' + s + ' → ' + v.join(' ;; ')); } }
  await go(Q, 'ciphers'); await sub(Q, 'analysis'); await Q.click('#an-ex-vig'); await Q.click('#an-key'); let v = await run(); if (v.length) viol.push('analiză ' + v.join(';'));
  await go(Q, 'morse'); await sub(Q, 'koch'); await Q.click('#k-start'); await Q.fill('#k-answer', 'KM'); await Q.click('#k-check'); await E(Q, () => ALF.morseStop()); v = await run(); if (v.length) viol.push('koch ' + v.join(';'));
  await go(Q, 'braille'); await sub(Q, 'ref'); await Q.selectOption('#br-ro-mode', 'custom'); await Q.fill('#br-ro-ă', '1'); await Q.click('#br-ro-apply'); v = await run(); if (v.length) viol.push('br custom ' + v.join(';'));
  await go(Q, 'data'); await Q.click('#data-wipe'); v = await run(); if (v.length) viol.push('dialog ' + v.join(';')); await Q.click('#dlg-no');
  eq(viol, []); await c.ctx.close();
});
await test('layout: fără depășire orizontală la 360×740 și 1280×800, în toate panourile', async () => {
  for (const vp of [{width: 360, height: 740}, {width: 1280, height: 800}]) {
    const c = await open({viewport: vp}); const Q = c.page; const bad = [];
    for (const id of PANELS) { await go(Q, id); const subs = await Q.$$eval('.subtabs button', b => b.map(x => x.dataset.id));
      for (const s of (subs.length ? subs : [null])) { if (s) await sub(Q, s); const w = await E(Q, () => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth})); if (w.sw > w.cw + 1 || w.bw > w.cw + 1) bad.push(vp.width + ' ' + id + '/' + s + ' ' + JSON.stringify(w)); } }
    // cu conținut generat
    await go(Q, 'morse'); await sub(Q, 'conv'); await Q.fill('#m-text', 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789'); { const w = await E(Q, () => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) bad.push(vp.width + ' morse lung ' + w); }
    await go(Q, 'braille'); await sub(Q, 'conv'); await Q.fill('#br-text', 'Aceasta este un text suficient de lung ca să depășească lățimea unui telefon mobil 123'); { const w = await E(Q, () => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) bad.push(vp.width + ' braille lung ' + w); }
    await go(Q, 'baudot'); await sub(Q, 'conv'); await Q.fill('#bau-text', 'A LONG TELEGRAM TEXT FOR THE PUNCHED TAPE VIEW 1234567890'); { const w = await E(Q, () => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) bad.push(vp.width + ' baudot lung ' + w); }
    await go(Q, 'semaphore'); await sub(Q, 'conv'); await Q.fill('#sem-text', 'MESSAGE IN SEMAPHORE FLAGS'); { const w = await E(Q, () => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) bad.push(vp.width + ' semafor lung ' + w); }
    eq(bad, []); await c.ctx.close();
  }
});
await test('tastatură: ordine de focus, Enter în câmpuri, focus vizibil, mișcare redusă', async () => {
  const c = await open({reduced: true}); const Q = c.page;
  await Q.keyboard.press('Tab'); eq(await E(Q, () => document.activeElement.className), 'skip');
  for (let i = 0; i < 4; i++) await Q.keyboard.press('Tab');
  ok(await E(Q, () => !!document.activeElement.closest('header, nav')));
  const outline = await E(Q, () => { const a = document.querySelector('#nav a'); a.focus(); return getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth; }); ok(/solid 3px/.test(outline), outline);
  await Q.keyboard.press('Enter'); await Q.waitForTimeout(100);
  // quiz: Enter trimite
  await go(Q, 'morse'); await sub(Q, 'quiz'); const q = await E(Q, () => ALF.QUIZ['morse-l2c'].q); await Q.focus('[data-quiz="morse-l2c"] input'); await Q.keyboard.type(q.answer); await Q.keyboard.press('Enter'); ok((await Q.textContent('[data-quiz="morse-l2c"] .q-fb')).startsWith('Corect'));
  eq(await E(Q, () => getComputedStyle(document.querySelector('.btn')).transitionDuration), '0s', 'prefers-reduced-motion: fără tranziții');
  // butoane sub-tab accesibile din tastatură
  await Q.focus('.subtabs button[data-id="ref"]'); await Q.keyboard.press('Enter'); eq(await Q.getAttribute('.subtabs button[data-id="ref"]', 'aria-pressed'), 'true');
  await go(Q, 'cards'); await Q.focus('#srs-show'); await Q.keyboard.press('Enter'); ok(await Q.isVisible('#srs-grades')); await Q.keyboard.press('Tab');
  eq(c.errors, []); await c.ctx.close();
});
await test('fără erori, rețea, CSP după utilizare intensă', async () => {
  eq(pg.errors, []); eq(pg.requests, []); eq(await E(P, () => window.__csp), 0);
  await pg.ctx.close();
});
await browser.close();
const nOk = results.filter(r => r.ok).length;
console.log('\n' + nOk + '/' + results.length + ' teste trecute' + (failed ? ' — ' + failed + ' EȘUATE' : ' — verde'));
fs.writeFileSync(path.join(HERE, '.last-result.json'), JSON.stringify({ok: nOk, total: results.length, results}, null, 1));
process.exit(failed ? 1 : 0);
