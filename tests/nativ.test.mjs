// Teste „înregistrări native” (demo/nativ/): demonstrațiile în terminal ale celor 4 programe Rust (TEZAUR, VERIGA, LegatorOCR, OSATURA),
// cu subtitrări în 8 limbi, voce sintetică opțională, pagină offline dintr-un singur fișier, CSP connect-src 'none', axe 0 violări.
// Rulare: node tests/nativ.test.mjs [filtru-nume]. Browser: CHROMIUM_PATH sau Chromium din /opt/pw-browsers; axe: FFF_AXE.
// Reconstruire: tools/native-demos/record.py (ieșiri reale) apoi tools/native-demos/build.py (cast, vtt, audio, mp4, pagini).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = path.join(HUB, 'demo', 'nativ');
const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const SLUGS = ['tezaur', 'veriga', 'legatorocr', 'osatura'];
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.vtt': 'text/vtt', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.cast': 'application/x-asciicast'};
const AXE = process.env.FFF_AXE || ['/tmp/claude-0/axe/node_modules/axe-core/axe.min.js', '/opt/node-tools/node_modules/axe-core/axe.min.js'].find((f) => fs.existsSync(f));
const CHROME = process.env.CHROMIUM_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((f) => fs.existsSync(f));
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const read = (f) => fs.readFileSync(path.join(N, f), 'utf8');

// ---- 1. date (fără browser): cast, vtt, audio, video, fidelitate față de ieșirile reale
const caps = Object.fromEntries(SLUGS.map((s) => [s, JSON.parse(fs.readFileSync(path.join(HUB, 'tools', 'native-demos', 'captures', s + '.json'), 'utf8'))]));
for (const s of SLUGS) {
  await T(`date ${s}: .cast valid (asciicast v2), cronologie crescătoare, ieșirile reale apar întregi`, async () => {
    const lines = read(s + '.cast').trim().split('\n'); const h = JSON.parse(lines[0]);
    ok(h.version === 2 && h.width === 100 && h.height > 0, 'antet cast: ' + lines[0]);
    let prev = 0, text = '';
    for (const l of lines.slice(1)) { const e = JSON.parse(l); ok(e.length === 3 && e[1] === 'o' && typeof e[0] === 'number' && e[0] >= prev, 'eveniment invalid: ' + l); prev = e[0]; text += e[2]; }
    const plain = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
    for (const sc of caps[s].scenes) for (const c of sc) {
      ok(plain.includes(c.cmd), 'comanda lipsește din cast: ' + c.cmd);
      ok(plain.includes(c.out.replace(/\n$/, '')), 'ieșirea reală a comenzii lipsește (neschimbată) din cast: ' + c.cmd);
    }
    ok(!/\/tmp\/|\/root\/|scratchpad/.test(plain), 'căi locale scurse în cast');
  });
  await T(`date ${s}: 8 fișiere .vtt cu câte o replică pe scenă, în limita duratei; 8 piste audio Opus; video MP4`, async () => {
    const nScenes = caps[s].scenes.length;
    const dataJs = read('nativ-data.js'); const D = JSON.parse(dataJs.replace(/^window\.NATIV=/, '').replace(/;$/, '')); const dur = D.progs[s].dur;
    for (const l of LANGS) {
      const v = read(`${s}.${l}.vtt`); ok(v.startsWith('WEBVTT'), 'vtt fără antet: ' + l);
      const cues = [...v.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})\n([^\n]+)/g)];
      ok(cues.length === nScenes, `${s}.${l}.vtt: ${cues.length} replici, așteptat ${nScenes}`);
      let prev = 0;
      for (const c of cues) { const a = +c[1] * 3600 + +c[2] * 60 + +c[3] + +c[4] / 1000, b = +c[5] * 3600 + +c[6] * 60 + +c[7] + +c[8] / 1000; ok(a >= prev && b > a && b <= dur, `${s}.${l}: replică în afara duratei/ordinii: ${c[0]}`); prev = b; }
      ok(cues.every((c) => c[9].length > 20), `${s}.${l}: replică prea scurtă`);
      const a = path.join(N, 'audio', `${s}.${l}.ogg`); ok(fs.existsSync(a) && fs.statSync(a).size > 3000, 'audio lipsă: ' + a);
      ok(fs.readFileSync(a).subarray(0, 4).toString() === 'OggS', 'audio nu e Ogg: ' + a);
    }
    const mp4 = fs.readFileSync(path.join(N, s + '.mp4')); ok(mp4.subarray(4, 8).toString() === 'ftyp' && mp4.length > 20000, 'mp4 invalid');
    ok(fs.statSync(path.join(N, s + '.jpg')).size > 1000, 'poster lipsă');
  });
}
await T('date: subtitrările în 8 limbi diferă între ele (nu rămân copii ale limbii de bază), iar traducerile automate sunt marcate în pagină', async () => {
  for (const s of SLUGS) {
    const texts = LANGS.map((l) => read(`${s}.${l}.vtt`)); ok(new Set(texts).size === 8, s + ': două limbi au subtitrări identice');
  }
  const idx = read('index.html');
  for (const l of LANGS) ok(read('nativ-data.js').includes('"auto"'), 'lipsește textul de avertizare');
  ok(/automate|automatic|automatiques|automatiche|automáticas|automáticas|automatisch|automatikusak/.test(read('nativ-data.js')), 'traducerile automate nu sunt marcate');
  ok(idx.includes('data-ui="auto"') && idx.includes('data-ui="tts"'), 'pagina nu declară traducerile automate / vocea sintetică');
});

// ---- 2. browser
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(HUB, u === '/' ? 'index.html' : u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(HUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nu există'); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store'});
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({executablePath: CHROME});
const DESK = {width: 1280, height: 900}, MOB = {width: 390, height: 800};
async function open(urlPath, lang, viewport = DESK, o = {}) {
  const mobile = viewport.width < 600;
  const ctx = await browser.newContext({viewport, locale: 'ro-RO', serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile, bypassCSP: !!o.bypassCSP, colorScheme: o.scheme || 'dark'});
  const external = [], errors = [], csp = [];
  await ctx.route(/^https?:/, (route) => { const u = route.request().url(); if (u.startsWith(BASE)) return route.continue(); external.push(u); return route.abort(); });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('lang', l); } catch { /* fără localStorage */ }
    document.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); });
  }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + urlPath);
  await page.waitForFunction(() => window.__nativ && window.__nativ.players.length > 0);
  return {ctx, page, external, errors, csp: () => page.evaluate(() => window.__csp || [])};
}
const DATA = JSON.parse(read('nativ-data.js').replace(/^window\.NATIV=/, '').replace(/;$/, ''));

await T('pagina: 8 limbi, 4 playere, interfața tradusă, fără erori, fără cereri externe, fără încălcări CSP', async () => {
  const titles = new Set();
  for (const l of LANGS) {
    const {ctx, page, external, errors, csp} = await open('demo/nativ/', l);
    ok(await page.evaluate(() => document.querySelectorAll('.player[data-slug]').length) === 4, l + ': nu sunt 4 playere');
    ok((await page.evaluate(() => document.documentElement.lang)) === l, l + ': lang');
    const h1 = await page.textContent('h1'); ok(h1 === DATA.ui[l].title, `${l}: h1 „${h1}”`); titles.add(h1);
    ok((await page.textContent('[data-ui=auto]')) === DATA.ui[l].auto, l + ': avertismentul traducerilor automate nu e în limba paginii');
    ok(external.length === 0, l + ': cereri externe ' + external.join(' '));
    ok(errors.length === 0, l + ': erori ' + errors.join(' | '));
    ok((await csp()).length === 0, l + ': încălcări CSP ' + (await csp()).join(' | '));
    await ctx.close();
  }
  ok(titles.size === 8, 'titlurile nu sunt toate diferite');
});

await T('CSP: connect-src \'none\', fără inline în pagina găzduită; pagina offline: hash-uri, fără unsafe-inline', async () => {
  const idx = read('index.html'); const m = idx.match(/Content-Security-Policy" content="([^"]+)"/); ok(m, 'fără CSP');
  ok(/connect-src 'none'/.test(m[1]) && !/unsafe-inline|unsafe-eval|https?:/.test(m[1]), 'CSP găzduit: ' + m[1]);
  ok(!/<script>[^<]/.test(idx) && !/ style="/.test(idx) && !/ on[a-z]+="/.test(idx), 'pagina găzduită conține cod/stil inline');
  for (const s of SLUGS) {
    const o = read(s + '-offline.html'); const c = o.match(/Content-Security-Policy" content="([^"]+)"/)[1];
    ok(/connect-src 'none'/.test(c) && !/unsafe-inline|unsafe-eval|https?:/.test(c) && /script-src 'sha256-/.test(c) && /style-src 'sha256-/.test(c), s + ' offline: ' + c);
    ok(!/<link[^>]+href="(?!data:)|<script[^>]+src=|https?:\/\/(?!github\.com\/chiuta|www\.w3\.org)/.test(o.replace(/<meta[^>]+>/g, '')), s + ' offline: resurse externe');
  }
});

await T('redare: derulare până la sfârșit arată ieșirea reală; subtitrarea = replica din .vtt în limba aleasă; schimbarea limbii o schimbă pe loc', async () => {
  const {ctx, page, errors} = await open('demo/nativ/', 'ro');
  const last = {tezaur: 'vance2020', veriga: 'link check report', legatorocr: 'Chapter 1', osatura: 'demo.gif'};
  for (let i = 0; i < 4; i++) {
    const s = SLUGS[i];
    await page.evaluate((i) => { const p = window.__nativ.players[i]; p.seek(p.d.dur - 0.5); }, i);
    const t = await page.textContent(`#${s} .term`); ok(new RegExp(last[s]).test(t), `${s}: ultima scenă nu apare în terminal`);
    ok(!/ {3}o{20}/.test(t), 'terminal corupt');
  }
  // subtitrare pe scena 3 din tezaur, în fiecare limbă
  for (const l of LANGS) {
    await page.evaluate((l) => window.__nativ.setLang(l), l);
    const sc = DATA.progs.tezaur.scenes[2];
    await page.evaluate((t) => window.__nativ.players[0].seek(t), sc.t0 + 1.5);
    const sub = await page.textContent('#tezaur .subline'); ok(sub === sc.narr[l], `${l}: subtitrare „${sub}” ≠ „${sc.narr[l]}”`);
    const vtt = read(`tezaur.${l}.vtt`); ok(vtt.includes(sub), l + ': subtitrarea din pagină nu e în .vtt');
    ok((await page.getAttribute('#tezaur .subline', 'lang')) === l, l + ': lang pe subtitrare');
    ok((await page.getAttribute('a[data-vtt=tezaur]', 'href')) === `tezaur.${l}.vtt`, l + ': legătura .vtt');
  }
  ok(errors.length === 0, 'erori: ' + errors.join(' | '));
  await ctx.close();
});

await T('redare: Redă/Pauză avansează timpul real; selector de scene; viteză; oprirea altui player; voce activează pista audio a limbii', async () => {
  const {ctx, page} = await open('demo/nativ/', 'fr');
  await page.selectOption('#veriga .speed', '2');
  await page.click('#veriga .b-play');
  await page.waitForFunction(() => window.__nativ.players[1].t > 1.5);
  ok((await page.textContent('#veriga .b-play')) === DATA.ui.fr.pause, 'butonul nu a devenit Pauză');
  await page.click('#tezaur .b-play');
  ok(await page.evaluate(() => !window.__nativ.players[1].playing && window.__nativ.players[0].playing), 'două playere rulează simultan');
  await page.click('#tezaur .b-play');
  await page.click('#legatorocr .chip:nth-child(3)');
  ok(await page.evaluate(() => Math.abs(window.__nativ.players[2].t - window.__nativ.players[2].d.scenes[2].t0) < 0.2), 'saltul la scenă nu a mers');
  await page.check('#legatorocr .l-voice input');
  const src = await page.evaluate(() => window.__nativ.players[2].audio && window.__nativ.players[2].audio.getAttribute('src'));
  ok(src === 'audio/legatorocr.fr.ogg', 'pista audio: ' + src);
  await page.evaluate(() => window.__nativ.setLang('de'));
  ok((await page.getAttribute('#legatorocr .l-voice input', 'aria-label')).startsWith(DATA.ui.de.voice), 'etichetă voce netradusă');
  await ctx.close();
});

await T('pagina offline (un singur fișier): se deschide fără rețea, audio inline, redare + subtitrări în 8 limbi, fără încălcări CSP', async () => {
  for (const s of SLUGS) {
    const {ctx, page, external, errors, csp} = await open(`demo/nativ/${s}-offline.html`, 'it');
    ok(await page.evaluate(() => window.__nativ.players.length) === 1, s + ': un singur player');
    await page.evaluate(() => { const p = window.__nativ.players[0]; p.seek(p.d.dur - 0.5); });
    const t = await page.textContent('.term'); ok(t.includes('$') && t.length > 80, s + ': terminal gol');
    for (const l of LANGS) {
      await page.evaluate((l) => window.__nativ.setLang(l), l);
      const sc = DATA.progs[s].scenes[0];
      await page.evaluate((t) => window.__nativ.players[0].seek(t), sc.t0 + 1);
      ok((await page.textContent('.subline')) === sc.narr[l], `${s} offline ${l}: subtitrare`);
    }
    await page.check('.l-voice input');
    ok((await page.evaluate(() => window.__nativ.players[0].audio.getAttribute('src'))).startsWith('data:audio/ogg;base64,'), s + ': audio nu e inline');
    ok(external.length === 0 && errors.length === 0, `${s}: ${external.join(' ')} ${errors.join(' | ')}`);
    ok((await csp()).length === 0, s + ': încălcări CSP ' + (await csp()).join(' | '));
    await ctx.close();
  }
});

await T('mobil (390 px): fără derulare orizontală a paginii, 8 limbi', async () => {
  for (const l of LANGS) {
    const {ctx, page} = await open('demo/nativ/', l, MOB);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    ok(w[0] <= w[1] + 1, `${l}: scrollWidth ${w[0]} > ${w[1]}`);
    await ctx.close();
  }
});

if (!AXE) { results.push(['axe: omis (axe-core lipsește; setează FFF_AXE)', true]); console.log('omis axe: axe-core lipsește'); }
else {
  async function axeRun(page) {
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({content: fs.readFileSync(AXE, 'utf8')});
    return page.evaluate(async () => { const r = await axe.run(document); return r.violations.map((v) => v.id + ' (' + v.nodes.length + '): ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')); });
  }
  for (const [vn, vp] of [['desktop', DESK], ['mobil', MOB]]) {
    await T(`axe (${vn}): 0 violări pe pagina găzduită, 8 limbi × temă întunecată și deschisă, cu transcrierile deschise`, async () => {
      const bad = [];
      for (const scheme of ['dark', 'light']) {
        const {ctx, page} = await open('demo/nativ/', 'en', vp, {bypassCSP: true, scheme});
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        for (const l of LANGS) {
          await page.evaluate((x) => window.__nativ.setLang(x), l);
          await page.evaluate((i) => { const p = window.__nativ.players[i]; p.seek(p.d.scenes[2].t0 + 2); }, 0);
          const v = await axeRun(page); if (v.length) bad.push(`${scheme} ${l}: ${v.join(' ; ')}`);
        }
        await ctx.close();
      }
      ok(!bad.length, 'violări axe:\n' + bad.join('\n'));
    });
  }
  await T('axe: 0 violări pe cele 4 pagini offline (desktop, ro + hu)', async () => {
    const bad = [];
    for (const s of SLUGS) {
      const {ctx, page} = await open(`demo/nativ/${s}-offline.html`, 'ro', DESK, {bypassCSP: true});
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      for (const l of ['ro', 'hu']) { await page.evaluate((x) => window.__nativ.setLang(x), l); const v = await axeRun(page); if (v.length) bad.push(`${s} ${l}: ${v.join(' ; ')}`); }
      await ctx.close();
    }
    ok(!bad.length, 'violări axe:\n' + bad.join('\n'));
  });
}

// ---- 3. integrare în hub
await T('hub: cardurile celor 4 programe native trimit la demonstrația din terminal; demo/ și sitemap.xml trimit la demo/nativ/', async () => {
  const idx = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
  for (const [s, name] of [['tezaur', 'TEZAUR'], ['veriga', 'VERIGA'], ['legatorocr', 'LegatorOCR'], ['osatura', 'OSATURA']]) {
    const i = idx.indexOf(`data-c="apps|${name}|title"`); ok(i > 0, 'card lipsă ' + name);
    const j = idx.indexOf('class="app-card"', i); const card = idx.slice(idx.lastIndexOf('<div class="app-card"', i), j > 0 ? j : i + 4000);
    ok(card.includes(`href="demo/nativ/#${s}"`), `cardul ${name} nu trimite la demo/nativ/#${s}`);
  }
  ok(fs.readFileSync(path.join(HUB, 'demo', 'index.html'), 'utf8').includes('href="nativ/"'), 'demo/index.html nu trimite la nativ/');
  ok(fs.readFileSync(path.join(HUB, 'sitemap.xml'), 'utf8').includes('/demo/nativ/'), 'sitemap.xml nu conține demo/nativ/');
  const {ctx, page} = await open('demo/nativ/#veriga', 'ro');
  ok(await page.evaluate(() => document.getElementById('veriga').getBoundingClientRect().top < 400), 'ancora #veriga nu derulează la secțiune');
  await ctx.close();
});

await browser.close(); server.close();
const bad = results.filter((r) => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste trecute`);
process.exit(bad.length ? 1 : 0);
