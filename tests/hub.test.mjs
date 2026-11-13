// Teste hub — catalog (căutare/filtre), transparenta.html, offline, docuri. Rulare: node tests/hub.test.mjs [filtru-nume] [--root DIR]
// Cerințe: playwright (FFF_NODE_TOOLS = package.json al unui folder cu playwright; implicit /opt/node-tools) + Chromium (CHROMIUM_PATH sau /opt/pw-browsers/chromium). Fără rețea externă.
// Depozitele aplicațiilor (versiune, dată, CNAME…): --root DIR, sau FFF_ROOT, sau clonele din părintele hub-ului dacă există;
// altfel fixturile din tests/fixtures/apps (generate de tools/make-fixtures.mjs), deci testele trec și în CI, fără clone locale.
// Fără așteptări pe timp real: doar condiții (waitForFunction / expect.poll).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ri = args.indexOf('--root');
const rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const ROOT = path.resolve(rootArg || process.env.FFF_ROOT || (fs.existsSync(path.join(HUB, '..', 'AGORA', 'index.html')) ? path.join(HUB, '..') : path.join(HUB, 'tests', 'fixtures', 'apps')));
console.log('depozite aplicații: ' + path.relative(HUB, ROOT) + (ROOT.includes('fixtures') ? ' (fixturi)' : ''));
const tool = (name, ...extra) => execFileSync('node', [path.join(HUB, 'tools', name), ...extra, '--root', ROOT], {stdio: 'pipe'});
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css'};

const results = [];
const only = args[0];
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
  // 404 pentru demo/<App>/loc/<limbă>/preview.webp|video.mp4 este fallback intenționat (previzualizarea localizată lipsește → se cere cea implicită);
  // apare doar pentru cardurile ajunse în viewport, deci altfel testul ar depinde de poziția de derulare.
  page.on('console', (m) => { const u = m.location().url || ''; if (m.type() === 'error' && !/\/demo\/[^/]+\/loc\/[a-z]{2}\//.test(u) && !(/\/demo\/([^/]+)\/(preview\.webp|poster\.jpg|video\.mp4)$/.test(u) && !fs.existsSync(path.join(HUB, 'demo', decodeURIComponent(u.match(/\/demo\/([^/]+)\//)[1]))))) errors.push(m.text() + (u ? ' [' + u + ']' : '')); });
  await page.goto(BASE + urlPath);
  return {ctx, page, external, errors};
}
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden && c.offsetParent !== null).length);
const total = (page) => page.evaluate(() => document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])').length);
const countIs = (page, n) => page.waitForFunction((n) => [...document.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')].filter((c) => !c.hidden).length === n, n);

await T('sync-catalog --check: carduri, versiuni, linkuri, hash-uri CSP, sw.js', async () => {
  tool('sync-catalog.mjs', '--check');
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
      noBadges: live.filter((c) => !c.querySelector('.card-badges .bd-stable, .card-badges .bd-experimental, .card-badges .bd-alpha, .card-badges .bd-lab') || !c.querySelector('.card-badges [class*="bd-off-"]') || !c.querySelector('details.fisa')).map(key),
      osCat: os.dataset.cat, osSection: prev && prev.id, osStatus: os.dataset.status,
      rustCards: all.filter((c) => c.dataset.cat === 'rust').map(key).join(),
      uoVariantLinks: [...uo.querySelectorAll('.var-list a')].map((a) => a.getAttribute('href')),
      shots: document.querySelectorAll('.fisa-shot').length,
      recom: live.filter((c) => c.dataset.cat === 'recomandate').map((c) => [key(c), (meta.apps[key(c)].measured || meta.apps[key(c)]).score, c.dataset.status]),
      statuses: Object.fromEntries(['stable', 'experimental', 'alpha', 'lab'].map((s) => [s, live.filter((c) => c.dataset.status === s).map(key)])),
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
  ok([...info.statuses.alpha].sort().join() === 'ANTENA,ARBITRU,ASTROLABIU,ECOGRAMA,LegatorOCR,MARTOR,NEAMURI,OSATURA,TACTIL,TEZAUR,atelier-verificare,balanta,calendarium,ecou-spectral-rs,glosar,graiul,indicativ-international,proiector-fara-frontiere,regula,vietar-packs' && info.statuses.experimental.join() === 'Provenienta' && info.statuses.stable.length > 100, 'stări: ' + JSON.stringify(info.statuses).slice(0, 200));
  ok(info.statuses.lab.join() === 'LocalMind,OmniHost', 'laborator: ' + info.statuses.lab.join());
  ok(info.recom.length >= 5 && info.recom.every((r, i) => r[2] !== 'lab' && r[1] >= 5 && (i === 0 || info.recom[i - 1][1] >= r[1])), 'Recomandate nu e ordonată după scorul măsurat / conține laborator: ' + JSON.stringify(info.recom));
  ok(info.verText === 0, 'data de sincronizare în masă nu mai apare pe carduri');
  // filtru de stare
  await page.selectOption('#f-status', 'alpha');
  await countIs(page, 20);
  await page.selectOption('#f-status', 'experimental');
  await countIs(page, 1);
  await page.selectOption('#f-status', 'lab');
  await countIs(page, 2);
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
  // alte limbi: fără chei de traducere scăpate; fișa e tradusă în limba curentă (fără cădere pe engleză, fără notă „doar RO/EN”)
  for (const l of ['en', 'fr', 'hu']) {
    const o = await open(l);
    await o.page.waitForSelector(LIVE);
    const r = await o.page.evaluate(() => { const c = document.getElementById('app-AGORA'); c.querySelector('details.fisa').open = true; return {txt: c.textContent, bad: [...document.querySelectorAll('.card-badges .bd, details.fisa summary')].map((x) => x.textContent).filter((x) => /^(st|bd|f)[A-Z]\w+$/.test(x.trim()))}; });
    ok(r.bad.length === 0, `${l}: chei de traducere scăpate: ${r.bad.join(',')}`);
    ok(l === 'en' ? !/ro și engleză|Romanian and English/.test(r.txt) : true, `${l}: nota „doar RO/EN” apare și în engleză`);
    if (l !== 'en') ok(!/Unofficial/.test(r.txt) && !/Romanian and English|ro și engleză/i.test(r.txt), `${l}: fișa cade încă pe engleză`);
    ok(!o.errors.length, `${l}: erori ${o.errors.join('|')}`);
    await o.ctx.close();
  }
});

await T('catalog: acoperire pe toate cardurile, contor de dovezi, avertisment de sănătate, marcaj „fragil”, în cele 8 limbi', async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(HUB, 'index.html'), 'utf8').match(/<script type="application\/json" id="catalog-meta">([\s\S]*?)<\/script>/)[1]);
  const EVID7 = ['HoroScop', 'Bioenergoterapie', 'Afrodisiace-fara-frontiere', 'FrequencyLaboratory', 'ASMR', 'Inforenergetica', 'Radiestezie'];
  for (const l of LANGS) {
    const {ctx, page, errors, external} = await open(l);
    await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
    await page.waitForFunction((l) => document.documentElement.lang === l, l);
    const r = await page.evaluate((EVID7) => {
      const all = [...document.querySelectorAll('#apps-grid .app-card')], live = all.filter((c) => !c.hasAttribute('data-variant-of'));
      const key = (c) => c.querySelector('[data-c^="apps|"]').dataset.c.split('|')[1];
      const byKey = Object.fromEntries(live.map((c) => [key(c), c]));
      const txt = (k, sel) => { const e = byKey[k] && byKey[k].querySelector(sel); return e ? e.textContent.trim() : null; };
      return {
        attrs: all.filter((c) => !(c.dataset.langs && c.dataset.plat)).map(key),
        noCov: live.filter((c) => !c.querySelector('.card-badges .bd-cov')).map(key),
        evid: EVID7.map((k) => [k, !!(byKey[k] && byKey[k].querySelector('.card-evid .ev-pip')), byKey[k] && byKey[k].querySelectorAll('.card-evid .ev-pip.on').length, txt(k, '.card-evid')]),
        health: live.filter((c) => c.querySelector('.bd-health')).map(key), fragile: live.filter((c) => c.querySelector('.bd-fragile')).map(key),
        tezaur: txt('TEZAUR', '.bd-cov'), pendulul: txt('Pendulul', '.bd-cov'), veriga: txt('VERIGA', '.bd-cov'), agora: txt('AGORA', '.bd-cov'),
        puls: txt('PULS', '.bd-health'), vitrina: txt('Vitrina', '.bd-fragile'),
        sheet: (() => { const c = byKey.HoroScop; c.querySelector('details.fisa').open = true; return c.querySelector('details.fisa').textContent; })(),
        all: live.map((c) => c.querySelector('.card-badges').textContent + ' ' + (c.querySelector('.card-evid') ? c.querySelector('.card-evid').textContent : '')).join(' | '),
      };
    }, EVID7);
    ok(r.attrs.length === 0, `${l}: carduri fără data-langs/data-plat: ${r.attrs.join(',')}`);
    ok(r.noCov.length === 0, `${l}: carduri fără etichetă de acoperire: ${r.noCov.join(',')}`);
    ok(r.evid.every((e) => e[1] && e[3] && !/undefined|\{|^ev\d/.test(e[3])), `${l}: contor de dovezi lipsă: ${JSON.stringify(r.evid)}`);
    ok(r.evid.every((e) => e[2] === meta.apps[e[0]].evidence.level), `${l}: pătrățelele nu corespund nivelului: ${JSON.stringify(r.evid)}`);
    ok(['Bioenergoterapie', 'Reiki', 'FrequencyLaboratory', 'PULS', 'SEVA', 'ASMR'].every((k) => r.health.includes(k)) && r.puls && r.puls.length > 5, `${l}: avertisment de sănătate: ${r.health.join(',')}`);
    ok(['Vitrina', 'Threads-fara-cont', 'X-fara-cont', 'Cadraj'].every((k) => r.fragile.includes(k)) && r.vitrina && r.vitrina.length > 3, `${l}: „fragil”: ${r.fragile.join(',')}`);
    ok(/\b8\b/.test(r.tezaur) && /\bRO\b/.test(r.pendulul), `${l}: acoperire TEZAUR „${r.tezaur}” (8 limbi, instalabil) / Pendulul „${r.pendulul}”`);
    ok(r.tezaur !== r.agora && r.pendulul !== r.tezaur, `${l}: etichetele de acoperire nu diferă (TEZAUR e acum la fel cu VERIGA: 8 limbi, instalabil)`);
    ok(!/undefined|NaN|\[object|\$\{|\b(cov[A-Z]\w*|plat[A-Z]\w*|bd(Health|Fragile)|ev[0-4]|evMode\w*|fEvid|stLab)\b/.test(r.all + ' ' + r.sheet), `${l}: chei/substituenți neinterpolați în insigne/fișă`);
    if (l === 'ro') {
      ok(/instalabil/.test(r.tezaur) && /instalabil/.test(r.veriga), 'ro: Rust „instalabil”');
      ok(/mod istoric \/ cultural/.test(r.evid.find((e) => e[0] === 'HoroScop')[3]), 'ro: HoroScop „mod istoric / cultural”');
      ok(/nu înlocuiește medicul/.test(r.puls), 'ro: avertismentul de sănătate');
    }
    ok(!errors.length && !external.length, `${l}: erori/cereri externe: ${errors.concat(external).join(' | ')}`);
    await ctx.close();
  }
});

await T('catalog: tastatură (Tab ajunge la câmpuri), ținte tactile ≥44px pe mobil, fără depășire la 360px', async () => {
  const {ctx, page} = await open('en', '', {viewport: {width: 360, height: 740}, touch: true});
  await page.waitForSelector('#apps-filter');
  // pe mobil filtrele sunt pliate în spatele butonului „Filtre” (hub-ux): butonul și uneltele trebuie să fie ținte tactile bune, iar după deschidere câmpurile trebuie să fie reale
  await page.waitForSelector('#ux-filt');
  const tools = await page.evaluate(() => [...document.querySelectorAll('#ux-tools button, #ux-tools .ux-seg button')].filter((e) => e.offsetParent !== null).map((e) => [e.textContent.trim().slice(0, 14), Math.round(e.getBoundingClientRect().height)]).filter((x) => x[1] < 43));
  ok(!tools.length, 'unelte catalog sub 44px (ținte tactile): ' + JSON.stringify(tools));
  ok(await page.evaluate(() => document.getElementById('ux-filt').getAttribute('aria-expanded') === 'false'), 'filtrele ar trebui să fie pliate implicit pe mobil');
  await page.click('#ux-filt');
  ok(await page.evaluate(() => document.getElementById('ux-filt').getAttribute('aria-expanded') === 'true'), 'butonul Filtre nu deschide panoul');
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

await T('catalog: localStorage indisponibil (mod privat / cookie-uri blocate) nu oprește scriptul; cardurile, filtrele și schimbarea limbii merg (audit adversarial, PR #1)', async () => {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, locale: 'ro-RO', serviceWorkers: 'block'});
  const errors = [];
  await ctx.route(/^https?:/, (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {configurable: true, get() { throw new DOMException('blocat', 'SecurityError'); }}); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('#apps-grid .app-card:not([data-variant-of])');
  ok(await total(page) >= 114, 'cardurile nu s-au afișat: ' + await total(page));
  await page.evaluate(() => applyLang('fr'));
  ok(await page.evaluate(() => document.documentElement.lang) === 'fr', 'limba nu s-a schimbat');
  await page.evaluate(() => { document.getElementById('anim-toggle') && document.getElementById('anim-toggle').click(); });
  ok(!errors.length, 'erori JS: ' + errors.join(' | '));
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
  tool('cname-inventory.mjs', '--check');
  const t = fs.readFileSync(dec, 'utf8');
  for (const w of ['pykakasi', 'NLLB-200', 'NOTICE', 'Valea Plopului', 'maghiar', 'medical', 'Numerologie', 'relaxare', 'VNTV']) ok(t.includes(w), 'DECIZII-AUTOR.md nu menționează „' + w + '”');
  const tpl = fs.readdirSync(path.join(HUB, 'docs', 'notice-sabloane')).filter((f) => f.endsWith('.md'));
  ok(tpl.length >= 1, 'șabloane NOTICE în hub: ' + tpl.length);
  const files = tpl.map((f) => path.join(HUB, 'docs', 'notice-sabloane', f));
  for (const r of ['TranslateHub', 'Universul-Observabil-2D']) { const f = path.join(ROOT, r, 'NOTICE.md'); if (fs.existsSync(f)) files.push(f); }
  for (const f of files) { const t = fs.readFileSync(f, 'utf8'); if (/ȘABLON/.test(t)) ok(/de confirmat de autor/i.test(t), f + ' nu e marcat „de confirmat de autor”'); }
});

await browser.close(); server.close();
const bad = results.filter((r) => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste trecute`);
process.exit(bad.length ? 1 : 0);
