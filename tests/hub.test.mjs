// Teste hub — catalog (căutare/filtre), transparenta.html, offline, docuri. Rulare: node tests/hub.test.mjs
// Cerințe: /opt/node-tools (playwright) + Chromium (CHROMIUM_PATH sau /opt/pw-browsers/chromium). Fără rețea externă.
// Fără așteptări pe timp real: doar condiții (waitForFunction / expect.poll).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css'};

const results = [];
const only = process.argv[2];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 5).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };

// server static minimal (localhost = context sigur → service worker)
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(HUB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(HUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nu există'); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store'});
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'});

async function open(lang, urlPath = '', opts = {}) {
  const ctx = await browser.newContext({viewport: opts.viewport || {width: 1280, height: 900}, locale: 'ro-RO', serviceWorkers: opts.sw ? 'allow' : 'block', hasTouch: !!opts.touch, isMobile: !!opts.touch});
  const external = [], errors = [];
  await ctx.route(/^https?:/, (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    external.push(u); return route.abort();
  });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', l); } catch { /* fără localStorage */ } }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + urlPath);
  return {ctx, page, external, errors};
}
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden && c.offsetParent !== null).length);
const total = (page) => page.evaluate(() => document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])').length);
const countIs = (page, n) => page.waitForFunction((n) => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).length === n, n);

await T('sync-catalog --check: carduri, versiuni, linkuri, hash-uri CSP, sw.js', async () => {
  execFileSync('node', [path.join(HUB, 'tools', 'sync-catalog.mjs'), '--check'], {stdio: 'pipe'});
});

await T('catalog: filtrele există, nu scapă chei de traducere, în toate cele 8 limbi', async () => {
  for (const l of LANGS) {
    const {ctx, page, errors, external} = await open(l);
    await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
    await page.waitForFunction((l) => document.documentElement.lang === l, l);
    const info = await page.evaluate(() => ({
      labels: [...document.querySelectorAll('#apps-filter label')].map((x) => x.textContent.trim()),
      ph: document.getElementById('q').placeholder, role: document.getElementById('apps-filter').getAttribute('role'),
      status: document.getElementById('apps-count').getAttribute('role'), count: document.getElementById('apps-count').textContent,
      opts: [...document.querySelectorAll('#apps-filter option')].map((o) => o.textContent.trim()), reset: document.getElementById('f-reset').textContent.trim(),
    }));
    const all = [...info.labels, info.ph, info.reset, info.count, ...info.opts];
    ok(all.every((s) => s && !/^(f[A-Z]\w+|searchPh|noRes|nShown)$/.test(s) && !/\{\w+\}|undefined/.test(s)), `${l}: text lipsă/neinterpolat: ${JSON.stringify(all.filter((s) => !s || /^(f[A-Z]|searchPh|noRes|nShown)|\{|undefined/.test(s)))}`);
    ok(info.role === 'search' && info.status === 'status', `${l}: role search/status`);
    ok(info.labels.length === 5, `${l}: 5 etichete, sunt ${info.labels.length}`);
    ok(/\d/.test(info.count), `${l}: contorul nu arată numere: ${info.count}`);
    ok(!errors.length, `${l}: erori: ${errors.join(' | ')}`);
    ok(!external.length, `${l}: cereri externe: ${external.join(', ')}`);
    await ctx.close();
  }
});

await T('catalog: căutare text (inclusiv în altă limbă, fără diacritice), categorie, offline, resetare, „fără rezultate”', async () => {
  const {ctx, page} = await open('ro');
  await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
  const N = await total(page);
  ok(N >= 100, 'prea puține carduri: ' + N);
  ok((await shown(page)) === N, 'la început trebuie toate cardurile');
  await page.fill('#q', 'calendar');
  await page.waitForFunction((N) => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).length < N, N);
  const s1 = await shown(page); ok(s1 >= 1 && s1 < N, 'căutarea „calendar” a dat ' + s1);
  await page.fill('#q', 'Çalendár');   // diacritice ignorate
  const s1b = await shown(page); ok(s1b >= 1, 'căutarea nu ignoră diacriticele');
  await page.fill('#q', 'zzzzqqqq');
  await countIs(page, 0);
  ok(await page.evaluate(() => !document.getElementById('no-res').hidden && document.getElementById('no-res').textContent.trim().length > 3), 'lipsește mesajul „fără rezultate”');
  await page.press('#q', 'Escape');
  await countIs(page, N);
  const cats = await page.evaluate(() => [...document.getElementById('f-cat').options].map((o) => o.value).filter(Boolean));
  ok(cats.length >= 3, 'categorii: ' + cats.length);
  await page.selectOption('#f-cat', cats[1]);
  const sc = await page.evaluate(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).length);
  ok(sc >= 1 && sc < N, 'filtrul de categorie nu restrânge: ' + sc);
  ok(await page.evaluate((c) => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((x) => !x.hidden).every((x) => x.dataset.cat === c), cats[1]), 'carduri din altă categorie');
  await page.click('#f-reset');
  await countIs(page, N);
  const offOpts = await page.evaluate(() => [...document.getElementById('f-off').options].map((o) => o.value).filter(Boolean));
  ok(offOpts.length === 3, 'filtrul offline are ' + offOpts.length + ' valori');
  await page.selectOption('#f-off', 'full');
  const nFull = await page.evaluate(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).every((c) => c.dataset.off === 'full') && [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).length);
  ok(nFull > 20, 'offline complet: ' + nFull);
  await page.click('#f-reset');
  await ctx.close();
});

await T('catalog: contoare derivate, stare, offline, fișă, variante Universul Observabil, înrudite, secțiunea Rust separată (OSATURA, VERIGA, TEZAUR, LegatorOCR)', async () => {
  const LIVE = '#apps-grid .app-card:not([data-variant-of])';
  const {ctx, page, errors, external} = await open('ro');
  await page.waitForSelector(LIVE);
  const info = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#apps-grid .app-card')];
    const meta = JSON.parse(document.getElementById('catalog-meta').textContent);
    const key = (c) => c.querySelector('[data-c^="apps|"]').dataset.c.split('|')[1];
    const live = all.filter((c) => !c.hasAttribute('data-variant-of'));
    const os = all.find((c) => key(c) === 'OSATURA');
    let prev = os.previousElementSibling; while (prev && !prev.classList.contains('sec-head')) prev = prev.previousElementSibling;
    const uo = all.find((c) => key(c) === 'Universul-Observabil');
    return {
      nAll: all.length, nLive: live.length, nEngines: Object.values(meta.kinds).filter((k) => k === 'engine').length,
      statApps: +document.getElementById('stat-repos').textContent, statSec: +document.getElementById('stat-sections').textContent,
      nSec: document.querySelectorAll('#apps-grid .sec-head').length,
      variantsVisible: all.filter((c) => c.hasAttribute('data-variant-of') && c.offsetParent !== null).length,
      noBadges: live.filter((c) => !c.querySelector('.card-badges .bd-stable, .card-badges .bd-experimental, .card-badges .bd-alpha') || !c.querySelector('.card-badges [class*="bd-off-"]') || !c.querySelector('details.fisa')).map(key),
      osCat: os.dataset.cat, osSection: prev && prev.id, osStatus: os.dataset.status,
      rustCards: all.filter((c) => c.dataset.cat === 'rust').map(key).join(),
      uoVariantLinks: [...uo.querySelectorAll('.var-list a')].map((a) => a.getAttribute('href')),
      shots: document.querySelectorAll('.fisa-shot').length,
      statuses: Object.fromEntries(['stable', 'experimental', 'alpha'].map((s) => [s, live.filter((c) => c.dataset.status === s).map(key)])),
      verText: live.map((c) => c.querySelector('.card-ver').textContent).filter((x) => /2026-10-26/.test(x)).length,
    };
  });
  ok(info.nAll - info.nEngines === info.statApps, `contor aplicații ${info.statApps} ≠ carduri single-file ${info.nAll - info.nEngines}`);
  ok(info.statSec === info.nSec, `contor secțiuni ${info.statSec} ≠ ${info.nSec}`);
  ok(info.variantsVisible === 0 && info.nAll - info.nLive === 3, 'variantele Universului Observabil trebuie ascunse (3)');
  ok(info.noBadges.length === 0, 'fără insigne/fișă: ' + info.noBadges.join(', '));
  ok(info.osCat === 'rust' && info.osSection === 'rust' && info.osStatus === 'alpha', 'OSATURA nu e în secțiunea Rust: ' + JSON.stringify([info.osCat, info.osSection, info.osStatus]));
  ok(info.rustCards === 'OSATURA,VERIGA,TEZAUR,LegatorOCR', 'secțiunea Rust: ' + info.rustCards);
  ok(info.uoVariantLinks.length === 3 && info.uoVariantLinks.every((u) => /Universul-Observabil-[123]D\/?$/.test(u)), 'fișa hub-ului nu listează cele 3 variante: ' + info.uoVariantLinks.join(','));
  ok(info.shots === 0, 'nu trebuie să existe capturi dacă nu sunt declarate');
  ok(info.statuses.alpha.join() === 'OSATURA,TEZAUR,LegatorOCR' && info.statuses.experimental.join() === 'Provenienta' && info.statuses.stable.length > 100, 'stări: ' + JSON.stringify(info.statuses).slice(0, 200));
  ok(info.verText === 0, 'data de sincronizare în masă nu mai apare pe carduri');
  // filtru de stare
  await page.selectOption('#f-status', 'alpha');
  await countIs(page, 3);
  await page.selectOption('#f-status', 'experimental');
  await countIs(page, 1);
  await page.click('#f-reset');
  // căutare: hub-ul se găsește după variante; textul fișei se găsește
  await page.fill('#q', 'universul observabil 3D');
  ok(await page.evaluate(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].some((c) => !c.hidden && c.id === 'app-Universul-Observabil')), 'hub-ul nu e găsit după „3D”');
  await page.fill('#q', 'ANMAP');
  ok(await page.evaluate(() => { const v = [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).map((c) => c.id); return v.includes('app-ExploratoriiEco'); }), 'textul din fișă nu e căutabil');
  await page.click('#f-reset');
  // fișă (RO) + înrudite
  const lim = await page.evaluate(() => { const d = document.querySelector('#app-AGORA details.fisa'); d.open = true; return d.textContent; });
  ok(/Limite/.test(lim) && /Neoficial/.test(lim) && /Ultima schimbare de fond/.test(lim), 'fișa AGORA nu are „Limite”/„Neoficial”');
  await page.evaluate(() => { document.querySelector('#app-ASMR details.fisa').open = true; });
  await page.click('#app-ASMR .rel-chip[data-goto="CalmWaves"]');
  ok(await page.evaluate(() => { const c = document.getElementById('app-CalmWaves'); return !c.hidden && c.querySelector('details.fisa').open; }), 'chip-ul „înrudite” nu duce la card');
  ok(!errors.length && !external.length, `erori/cereri externe: ${errors.concat(external).join(' | ')}`);
  await ctx.close();
  // alte limbi: fără chei de traducere scăpate, fișa cade pe engleză cu notă
  for (const l of ['en', 'fr', 'hu']) {
    const o = await open(l);
    await o.page.waitForSelector(LIVE);
    const r = await o.page.evaluate(() => { const c = document.getElementById('app-AGORA'); c.querySelector('details.fisa').open = true; return {txt: c.textContent, bad: [...document.querySelectorAll('.card-badges .bd, details.fisa summary')].map((x) => x.textContent).filter((x) => /^(st|bd|f)[A-Z]\w+$/.test(x.trim()))}; });
    ok(r.bad.length === 0, `${l}: chei de traducere scăpate: ${r.bad.join(',')}`);
    ok(l === 'en' ? !/ro și engleză|Romanian and English/.test(r.txt) : true, `${l}: nota „doar RO/EN” apare și în engleză`);
    if (l !== 'en') ok(/Unofficial/.test(r.txt), `${l}: fișa nu cade pe engleză`);
    ok(!o.errors.length, `${l}: erori ${o.errors.join('|')}`);
    await o.ctx.close();
  }
});

await T('catalog: tastatură (Tab ajunge la câmpuri), ținte tactile ≥44px pe mobil, fără depășire la 360px', async () => {
  const {ctx, page} = await open('en', '', {viewport: {width: 360, height: 740}, touch: true});
  await page.waitForSelector('#apps-filter');
  const m = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth > innerWidth + 1,
    small: [...document.querySelectorAll('#apps-filter input,#apps-filter select,#apps-filter button')].map((e) => [e.id, e.getBoundingClientRect().height]).filter((x) => x[1] < 43),
  }));
  ok(!m.over, 'depășire orizontală la 360px');
  ok(!m.small.length, 'câmpuri sub 44px (ținte tactile): ' + JSON.stringify(m.small));
  await page.focus('#q'); await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.id === 'f-cat'), 'Tab nu ajunge la categorie');
  await ctx.close();
});

await T('transparenta.html: 8 limbi, fără chei/substituenți neinterpolați, fără rețea externă, fără depășire la 360px', async () => {
  for (const l of LANGS) {
    const {ctx, page, errors, external} = await open(l, 'transparenta.html', {viewport: {width: 360, height: 740}});
    await page.waitForFunction((l) => document.documentElement.lang === l, l);
    const r = await page.evaluate(() => ({
      text: document.body.innerText, h1: document.querySelectorAll('h1').length, rows: document.querySelectorAll('table.apps tbody tr').length,
      over: document.documentElement.scrollWidth > innerWidth + 1, sel: document.getElementById('lang').value,
    }));
    ok(r.h1 === 1, `${l}: ${r.h1} H1`);
    ok(r.rows >= 100, `${l}: ${r.rows} rânduri în tabel`);
    ok(!/\{\w+\}|undefined|NaN|\[object/.test(r.text), `${l}: text neinterpolat: ${(r.text.match(/.{20}(\{\w+\}|undefined|NaN|\[object).{10}/) || [''])[0]}`);
    ok(!r.over, `${l}: depășire orizontală la 360px`);
    ok(r.sel === l, `${l}: selectorul de limbă arată ${r.sel}`);
    ok(!errors.length, `${l}: erori/încălcări CSP: ${errors.join(' | ')}`);
    ok(!external.length, `${l}: cereri externe: ${external.join(', ')}`);
    await ctx.close();
  }
});

await T('transparenta.html: schimbarea limbii se păstrează; fără date personale; corespunde datelor (--check)', async () => {
  const {ctx, page} = await open('en', 'transparenta.html');
  await page.selectOption('#lang', 'de');
  await page.waitForFunction(() => document.documentElement.lang === 'de' && /Transparenz/.test(document.getElementById('ttl').textContent));
  ok(await page.evaluate(() => localStorage.getItem('lang') === 'de'), 'limba nu se păstrează');
  await ctx.close();
  const html = fs.readFileSync(path.join(HUB, 'transparenta.html'), 'utf8') + fs.readFileSync(path.join(HUB, 'data', 'transparenta.json'), 'utf8');
  ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(html), 'adresă de e-mail în pagină sau în date');
  execFileSync('node', [path.join(HUB, 'tools', 'transparenta.mjs'), '--check'], {stdio: 'pipe'});
});

await T('offline: hub-ul și transparenta.html se redeschid fără rețea, iar filtrul merge', async () => {
  const {ctx, page} = await open('ro', '', {sw: true});
  await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout: 20000}).catch(async () => { await page.reload(); });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout: 20000});
  await page.goto(BASE + 'transparenta.html'); await page.waitForSelector('table.apps');   // pagina intră în cache la prima vizită
  await page.waitForFunction(async () => { const ks = await caches.keys(); for (const k of ks) { if (await (await caches.open(k)).match('transparenta.html')) return true; } return false; }, null, {timeout: 20000});
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
  await page.fill('#q', 'calendar');
  await page.waitForFunction(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].some((c) => c.hidden));
  ok((await shown(page)) >= 1, 'filtrul nu merge offline');
  await page.goto(BASE + 'transparenta.html'); await page.waitForSelector('table.apps tbody tr');
  await ctx.close();
});

await T('docs: DOMENII.md și DECIZII-AUTOR.md există, la zi cu depozitele; șabloanele NOTICE sunt marcate', async () => {
  const dom = path.join(HUB, 'docs', 'DOMENII.md'), dec = path.join(HUB, 'docs', 'DECIZII-AUTOR.md');
  ok(fs.existsSync(dom) && fs.existsSync(dec), 'lipsesc docs/DOMENII.md sau docs/DECIZII-AUTOR.md');
  execFileSync('node', [path.join(HUB, 'tools', 'cname-inventory.mjs'), '--check'], {stdio: 'pipe'});
  const t = fs.readFileSync(dec, 'utf8');
  for (const w of ['pykakasi', 'NLLB-200', 'NOTICE', 'Valea Plopului', 'maghiar', 'medical', 'Numerologie', 'relaxare', 'VNTV']) ok(t.includes(w), 'DECIZII-AUTOR.md nu menționează „' + w + '”');
  const tpl = fs.readdirSync(path.join(HUB, 'docs', 'notice-sabloane')).filter((f) => f.endsWith('.md'));
  ok(tpl.length >= 1, 'șabloane NOTICE în hub: ' + tpl.length);
  const files = tpl.map((f) => path.join(HUB, 'docs', 'notice-sabloane', f));
  for (const r of ['TranslateHub', 'Universul-Observabil-2D']) { const f = path.join(HUB, '..', r, 'NOTICE.md'); if (fs.existsSync(f)) files.push(f); }
  for (const f of files) { const t = fs.readFileSync(f, 'utf8'); if (/ȘABLON/.test(t)) ok(/de confirmat de autor/i.test(t), f + ' nu e marcat „de confirmat de autor”'); }
});

await browser.close(); server.close();
const bad = results.filter((r) => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste trecute`);
process.exit(bad.length ? 1 : 0);
