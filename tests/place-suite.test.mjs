// Suita cer–timp (Etapa 6), e2e: „o singură locație introdusă actualizează toate cele 7 aplicații”, cu rețeaua oprită.
// Rulare: node tests/place-suite.test.mjs [filtru] [--root DIR]   (DIR = folderul cu depozitele aplicațiilor, deja injectate cu fff-place)
// Servește aplicațiile pe localhost (același origin pentru testul de propagare live; un port/origin pe aplicație pentru testul de propagare între origini) și blochează orice cerere în afara lui.
import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), ri = args.indexOf('--root'), rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const APPS = ['Eclipsa-2027', 'Bolta', 'Horizons.BeyondLimits', 'Universul-Observabil-3D', 'orarium', 'CLEPSIDRA', 'Orar'];
const SLUG = {'Eclipsa-2027': 'eclipsa-2027', Bolta: 'bolta', 'Horizons.BeyondLimits': 'horizons-beyondlimits', 'Universul-Observabil-3D': 'universul-observabil-3d', orarium: 'orarium', CLEPSIDRA: 'clepsidra', Orar: 'orar'};
const cands = [rootArg, process.env.FFF_ROOT, path.join(HUB, '..'), '/home/claude/demo/apps'].filter(Boolean);
const ROOT = cands.find((d) => fs.existsSync(path.join(d, 'Eclipsa-2027', 'index.html')) && fs.readFileSync(path.join(d, 'Eclipsa-2027', 'index.html'), 'utf8').includes('id="fff-mod-place"'));
if (!ROOT) { console.log('SKIP: aplicațiile injectate cu fff-place nu sunt disponibile (--root / FFF_ROOT)'); process.exit(0); }
const AXE = (() => { for (const c of [process.env.FFF_AXE, process.env.AXE_PATH, '/tmp/claude-0/axe/node_modules/axe-core/axe.min.js', '/home/claude/pw/node_modules/axe-core/axe.min.js', '/opt/node-tools/node_modules/axe-core/axe.min.js']) if (c && fs.existsSync(c)) return c; return null; })();
const only = args[0], results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return; const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css'};
function serve(dir, port, prefix) {   // prefix: '/' (un singur origin per aplicație) sau '' (rădăcina cu toate aplicațiile)
  return new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); let f = path.join(dir, u); if (!f.startsWith(dir)) { r.writeHead(403); r.end(); return; } if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r); }); s.listen(port, '127.0.0.1', () => res(s)); });
}
const BASE = 47100, servers = [await serve(ROOT, BASE), ...(await Promise.all(APPS.map((a, i) => serve(path.join(ROOT, a), BASE + 1 + i))))];
const sameUrl = (a) => `http://127.0.0.1:${BASE}/${a}/index.html`, ownUrl = (a) => `http://127.0.0.1:${BASE + 1 + APPS.indexOf(a)}/`;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const ext = [], errs = [];
async function ctxNew(o = {}) {
  const ctx = await browser.newContext({locale: o.locale || 'ro-RO', viewport: o.viewport || {width: 1280, height: 800}, serviceWorkers: 'block', acceptDownloads: true, colorScheme: o.scheme || 'light', ...(o.geo ? {geolocation: o.geo, permissions: ['geolocation']} : {})});
  await ctx.route(/^https?:/, (r) => { const u = r.request().url(); if (u.startsWith('http://127.0.0.1:')) return r.continue(); ext.push(u); return r.abort(); });
  if (o.now) await ctx.addInitScript(({t}) => { const R = Date, off = t - R.now(); class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } } window.Date = D; }, {t: o.now});
  if (o.spy) await ctx.addInitScript(() => { window.__geo = 0; const g = navigator.geolocation; if (g) { const o = g.getCurrentPosition.bind(g); g.getCurrentPosition = function () { window.__geo++; return o.apply(g, arguments); }; const w = g.watchPosition.bind(g); g.watchPosition = function () { window.__geo++; return w.apply(g, arguments); }; } });
  return ctx;
}
async function open(ctx, url) {
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(page.url() + ' ' + e.message)); page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) errs.push('CSP ' + m.text()); });
  await page.goto(url, {waitUntil: 'domcontentloaded'}); await page.waitForFunction(() => window.FFF && FFF.place && document.getElementById('fffPlaceChip'), null, {timeout: 30000}); return page;
}
async function fillPlace(page, p) {
  await page.bringToFront(); await page.click('#fffPlaceChip'); await page.waitForSelector('#fffPlaceDlg');
  await page.fill('#fffPlName', p.name); await page.fill('#fffPlLat', String(p.lat)); await page.fill('#fffPlLon', String(p.lon)); await page.fill('#fffPlTz', p.tz); await page.click('#fffPlSave');
  await page.waitForFunction((n) => (document.getElementById('fffPlMsg') || {}).textContent && document.getElementById('fffPlMsg').textContent.includes(n), p.name);
}
const chipHas = (page, txt, t = 4000) => page.waitForFunction((x) => (document.getElementById('fffPlaceChip') || {}).textContent && document.getElementById('fffPlaceChip').textContent.includes(x), txt, {timeout: t});
const CADIZ = {name: 'Cádiz', lat: 36.5271, lon: -6.2886, tz: 'Europe/Madrid'}, ALBA = {name: 'Alba Iulia', lat: 46.0733, lon: 23.5805, tz: 'Europe/Bucharest'};

await T('aceeași origine: o locație introdusă în Eclipsa-2027 apare în celelalte 6 aplicații deschise (BroadcastChannel/storage) și în starea lor proprie', async () => {
  const ctx = await ctxNew(); const pages = {}; for (const a of APPS) pages[a] = await open(ctx, sameUrl(a));
  await fillPlace(pages['Eclipsa-2027'], CADIZ); await pages['Eclipsa-2027'].click('#fffPlClose');
  for (const a of APPS) await chipHas(pages[a], 'Cádiz');
  const g = await pages.Bolta.evaluate(() => ({n: document.getElementById('nameIn').value, lat: document.getElementById('latIn').value, tz: document.getElementById('tzIn').value})); ok(g.n === 'Cádiz' && g.lat === '36.5271' && g.tz === 'Europe/Madrid', 'Bolta ' + JSON.stringify(g));
  await pages.orarium.waitForFunction(() => document.getElementById('ref-z') && document.getElementById('ref-z').value === 'Europe/Madrid', null, {timeout: 4000});
  await pages.Orar.waitForFunction(() => document.getElementById('s-tz') && document.getElementById('s-tz').value === 'Europe/Madrid', null, {timeout: 4000});
  const E = pages['Eclipsa-2027']; await E.evaluate(() => { const b = document.getElementById('localBtn'); b.hidden = false; b.click(); }); await E.waitForFunction(() => window.__fffE27 && window.__fffE27.state().lat != null, null, {timeout: 6000});
  const lat = await E.evaluate(() => __fffE27.state().lat); ok(Math.abs(lat - 36.5271) < 1e-6, 'e27 primește locația comună la creare: ' + lat); await E.evaluate(() => document.getElementById('e27Dialog').close());
  await E.evaluate(() => FFF.place.set({lat: 40.4168, lon: -3.7038, name: 'Madrid', tz: 'Europe/Madrid'})); await E.waitForFunction(() => Math.abs(__fffE27.state().lat - 40.4168) < 1e-6, null, {timeout: 4000});   // schimbare ulterioară → e27.setLocation
  await E.evaluate(() => FFF.place.set({lat: 36.5271, lon: -6.2886, name: 'Cádiz', tz: 'Europe/Madrid'}));
  /* sens invers: din Bolta (formularul ei propriu) → toate */
  await pages.Bolta.evaluate((p) => window.applyPlace({name: p.name, lat: p.lat, lon: p.lon, elev: 300, tz: p.tz}, null), ALBA);
  for (const a of APPS) await chipHas(pages[a], 'Alba Iulia');
  await pages.orarium.waitForFunction(() => document.getElementById('ref-z').value === 'Europe/Bucharest', null, {timeout: 4000});
  /* o aplicație deschisă mai târziu citește locația din stocarea comună */
  const late = await open(ctx, sameUrl('CLEPSIDRA')); await chipHas(late, 'Alba Iulia'); await ctx.close();
});
await T('între origini diferite: fără atingere nu se propagă; cu un link „Deschide …” fiecare dintre celelalte 6 aplicații primește locația (banda de confirmare, o apăsare)', async () => {
  const ctx = await ctxNew(); const A = await open(ctx, ownUrl('Eclipsa-2027'));
  await A.evaluate((l) => FFF.place.setApps(l), APPS.map((a) => ({slug: SLUG[a], name: a, url: ownUrl(a)})));
  await fillPlace(A, CADIZ); const hrefs = await A.$$eval('#fffPlLinks a', (as) => as.map((x) => [x.dataset.app, x.href])); ok(hrefs.length === 6, 'linkuri ' + hrefs.length);
  const fresh = await open(ctx, ownUrl('Bolta')); ok(await fresh.evaluate(() => FFF.place.get()) === null, 'origine separată: fără locație fără atingere'); await fresh.close();
  await A.waitForFunction(() => [...document.querySelectorAll('#fffPlLinks a')].every((a) => a.href.includes('#fffplace=')), null, {timeout: 5000});
  const links = await A.$$eval('#fffPlLinks a', (as) => as.map((x) => [x.dataset.app, x.href]));
  for (const [slug, href] of links) {
    const B = await ctx.newPage(); B.on('pageerror', (e) => errs.push(slug + ' ' + e.message)); await B.goto(href, {waitUntil: 'domcontentloaded'}); await B.waitForFunction(() => window.FFF && FFF.place && document.getElementById('fffPlaceChip'));
    const bar = B.locator('[role=alertdialog] button', {hasText: /^Import/}); await bar.waitFor({timeout: 8000}); ok(await B.evaluate(() => !location.hash.includes('fffplace')), slug + ': fragmentul rămâne în adresă');
    ok(await B.evaluate(() => FFF.place.get()) === null, slug + ': nimic importat înainte de confirmare'); await bar.click(); await chipHas(B, 'Cádiz');
    const p = await B.evaluate(() => FFF.place.get()); ok(Math.abs(p.lat - CADIZ.lat) < 1e-6 && Math.abs(p.lon - CADIZ.lon) < 1e-6 && p.tz === 'Europe/Madrid' && p.src === 'envelope', slug + ' ' + JSON.stringify(p)); await B.close();
  }
  await ctx.close();
});
await T('plic .fff.json: descărcat din Eclipsa-2027, primit în Orar (fișier) cu confirmare; tip place/fff, fără chei străine', async () => {
  const ctx = await ctxNew(); const A = await open(ctx, ownUrl('Eclipsa-2027')); await fillPlace(A, ALBA);
  await A.click('#fffPlSend'); const [dl] = await Promise.all([A.waitForEvent('download'), A.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  const env = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); ok((env.type === 'place/fff' || env.src) && JSON.stringify(env).includes('place/fff'), 'tip: ' + JSON.stringify(env).slice(0, 120)); ok(JSON.stringify(env).includes('"Alba Iulia"') && !/token|password|key/i.test(JSON.stringify(env)), 'conținut');
  const B = await open(ctx, ownUrl('Orar')); await B.click('#fffPlaceChip'); await B.click('#fffPlRecv'); const [fc] = await Promise.all([B.waitForEvent('filechooser'), B.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  await fc.setFiles({name: 'loc.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))}); await B.locator('[role=alertdialog] button', {hasText: /^Import/}).click({timeout: 5000}); await chipHas(B, 'Alba Iulia'); await ctx.close();
});
await T('geolocalizarea doar la cerere: 0 apeluri la încărcare/deschiderea dialogului; acord explicit în aplicație; apoi un singur apel, coordonate rotunjite la 3 zecimale', async () => {
  const ctx = await ctxNew({geo: {latitude: 44.426812, longitude: 26.102534}, spy: true}); const P = await open(ctx, ownUrl('Bolta')); await P.waitForTimeout(500); ok(await P.evaluate(() => window.__geo) === 0, 'apel la încărcare');
  await P.click('#fffPlaceChip'); await P.waitForSelector('#fffPlGeo'); ok(await P.evaluate(() => window.__geo) === 0, 'apel la deschiderea dialogului');
  await P.click('#fffPlGeo'); await P.waitForSelector('#fffPlGeoAsk'); ok(await P.evaluate(() => window.__geo) === 0, 'apel înainte de acord'); await P.click('#fffPlGeoNo'); ok(await P.evaluate(() => window.__geo) === 0 && await P.evaluate(() => FFF.place.get()) === null, 'refuz');
  await P.click('#fffPlGeo'); await P.click('#fffPlGeoYes'); await P.waitForFunction(() => FFF.place.get() !== null, null, {timeout: 8000});
  const p = await P.evaluate(() => FFF.place.get()); ok(await P.evaluate(() => window.__geo) === 1, 'apeluri ' + await P.evaluate(() => window.__geo)); ok(p.lat === 44.427 && p.lon === 26.103 && p.src === 'geo', JSON.stringify(p)); await ctx.close();
});
await T('alertă la eclipsă (11 aug 2026, Burgos): bara role=alert apare în Eclipsa-2027, Orar și CLEPSIDRA; se poate ascunde; „Nu privi Soarele…”', async () => {
  const ctx = await ctxNew({now: Date.UTC(2026, 7, 11, 8)}); const pg = {};
  for (const a of ['Eclipsa-2027', 'Orar', 'CLEPSIDRA']) pg[a] = await open(ctx, sameUrl(a));
  await fillPlace(pg['Eclipsa-2027'], {name: 'Burgos', lat: 42.3439, lon: -3.6969, tz: 'Europe/Madrid'}); await pg['Eclipsa-2027'].click('#fffPlClose');
  for (const a of Object.keys(pg)) { const al = pg[a].locator('#fffPlaceAlert'); await al.waitFor({timeout: 6000}); const tx = await al.textContent(); ok(/totală de Soare/.test(tx) && /mâine/.test(tx) && /ISO 12312-2/.test(tx), a + ': ' + tx); ok(await al.getAttribute('role') === 'alert', 'role'); }
  await pg.Orar.locator('#fffPlaceAlert button', {hasText: 'Ascunde'}).click(); ok(await pg.Orar.locator('#fffPlaceAlert').count() === 0, 'ascunsă'); await pg.Orar.reload(); await pg.Orar.waitForFunction(() => document.getElementById('fffPlaceChip')); await pg.Orar.waitForTimeout(600); ok(await pg.Orar.locator('#fffPlaceAlert').count() === 0, 'rămâne ascunsă');
  await ctx.close();
});
await T('panoul „Astea se întâmplă deasupra ta mâine”: în Orar apare în bara laterală, în celelalte în dialog; conține Soare, Lună, planete, eclipsă; 8 limbi fără substituenți rămași', async () => {
  const ctx = await ctxNew({now: Date.UTC(2026, 10, 3, 9)}); const O = await open(ctx, sameUrl('Orar')); await fillPlace(O, ALBA); await O.click('#fffPlClose');
  const box = O.locator('#fffPlOrarPanel [data-fff-place-panel]'); await box.waitFor(); const tx = await box.textContent(); ok(/Astea se întâmplă deasupra ta mâine/.test(tx) && /Soare: răsare/.test(tx) && /Lună:/.test(tx) && /Planete pe cerul/.test(tx) && /eclips/i.test(tx), tx.slice(0, 400));
  ok(/4 noiembrie|miercuri/.test(tx), 'data de mâine (4 nov 2026 = miercuri): ' + tx.slice(0, 120));
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) { await O.evaluate((x) => { document.documentElement.lang = x; }, l); await O.waitForTimeout(150); const t = await box.textContent(); ok(!/\{\w+\}/.test(t), l + ' substituenți: ' + t.slice(0, 200)); ok(t.includes(await O.evaluate((x) => FFF.place.I18N[x].panelTitle, l)), l + ' titlu'); }
  const E = await open(ctx, sameUrl('Eclipsa-2027')); await E.click('#fffPlaceChip'); ok(/Astea se întâmplă deasupra ta mâine/.test(await E.locator('#fffPlaceDlg').textContent()), 'panou în dialog'); await ctx.close();
});
await T('Orar: eclipsa din panou se adaugă în agendă (dacă aplicația expune importul .ics)', async () => {
  const ctx = await ctxNew({now: Date.UTC(2026, 7, 11, 8)}); const O = await open(ctx, sameUrl('Orar')); if (!await O.evaluate(() => !!(window.__fffOrar && window.__fffOrar.imp))) { console.log('       (omis: Orar fără __fffOrar.imp în această versiune)'); await ctx.close(); return; }
  await fillPlace(O, {name: 'Burgos', lat: 42.3439, lon: -3.6969, tz: 'Europe/Madrid'}); await O.click('#fffPlClose'); await O.locator('#fffPlOrarPanel button', {hasText: 'Adaugă în agendă'}).click(); await O.waitForTimeout(500);
  const ics = await O.evaluate(() => window.__fffOrar.ics()); ok(/SUMMARY:Eclips/.test(ics) && /Burgos/.test(ics), ics.slice(0, 300)); await ctx.close();
});
await T('jurnal de teren → hartă: observațiile din jurnal care coincid cu o eclipsă apar în panou (Eclipsa-2027, Bolta); butonul „Adaugă o observație” deschide jurnalul cu titlul eclipsei', async () => {
  const ctx = await ctxNew({now: Date.UTC(2026, 7, 11, 8)});
  for (const a of ['Eclipsa-2027', 'Bolta']) {
    const p = await open(ctx, ownUrl(a)); ok(await p.evaluate(() => !!(FFF.jurnal && FFF.jurnal.load)), a + ': FFF.jurnal prezent');
    await p.evaluate(() => { FFF.jurnal.save([]); FFF.jurnal.add({title: 'Totalitate de pe terasă', lat: 42.3439, lon: -3.6969, ts: '2026-08-12T17:46:00Z', kind: 'obs', app: 'FieldObserver'}); FFF.jurnal.add({title: 'Cer senin, fără eclipsă', lat: 42.3439, lon: -3.6969, ts: '2026-09-20T20:00:00Z', kind: 'obs', app: 'FieldObserver'}); FFF.place.set({lat: 42.3439, lon: -3.6969, name: 'Burgos', tz: 'Europe/Madrid'}); });
    await p.click('#fffPlaceChip'); const sec = p.locator('#fffPlaceDlg [data-fff-place-journal]'); await sec.waitFor(); const tx = await sec.textContent();
    ok(/Totalitate de pe terasă/.test(tx) && /Eclipsă totală de Soare/.test(tx), a + ': ' + tx.slice(0, 200)); ok(!/Cer senin/.test(tx), a + ': observația fără eclipsă nu apare'); ok(await sec.locator('svg').count() === 1, a + ': atlas SVG local');
    await p.click('#fffPlJAdd'); await p.waitForSelector('#fffj-panel'); const title = await p.inputValue('#fffj-title'); ok(/Eclipsă totală de Soare/.test(title) && /2026/.test(title), a + ': titlu pregătit: ' + title); ok(await p.inputValue('#fffj-lat') === '42.3439', a + ': coordonate din locația comună'); await p.close();
  }
  await ctx.close();
});
if (AXE) for (const [scheme, vp, full] of [['light', {width: 1280, height: 800}, true], ['dark', {width: 1280, height: 800}, false], ['light', {width: 360, height: 740}, false], ['dark', {width: 360, height: 740}, false]]) {
  await T(`axe 0 violări — ${scheme} ${vp.width}×${vp.height}, ${full ? 'pagina întreagă' : 'elementele suitei (buton, alertă, dialog)'}: cu buton+alertă, apoi cu dialogul deschis (7 aplicații)`, async () => {
    const ctx = await ctxNew({now: Date.UTC(2026, 7, 11, 8), scheme, viewport: vp}); const src = fs.readFileSync(AXE, 'utf8'); const bad = [];
    for (const a of APPS) {
      if (process.env.FFF_VERBOSE) console.log('       axe ' + a);
      const p = await open(ctx, ownUrl(a)); await p.evaluate(() => FFF.place.set({lat: 42.3439, lon: -3.6969, name: 'Burgos', tz: 'Europe/Madrid'})); await p.waitForSelector('#fffPlaceAlert', {state: 'attached', timeout: 20000}); await p.waitForTimeout(800); await p.evaluate(src + '\n;0');
      const run = async (label) => { const v = await Promise.race([new Promise((_, rj) => setTimeout(() => rj(new Error(a + ' ' + label + ': axe >120 s')), 120000)), p.evaluate(async (full) => (await window.axe.run(full ? document : {include: [['#fffPlaceChip'], ['#fffPlaceAlert'], ['#fffPlaceDlg']]}, {resultTypes: ['violations']})).violations.map((x) => x.id + ':' + x.impact + ':' + x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')), full)]); for (const x of v) bad.push(`${a} [${label}] ${x}`); };
      await run('pagina'); await p.evaluate(() => FFF.place.openDialog()); await p.waitForSelector('#fffPlaceDlg'); await run('dialog'); await p.close();
    }
    ok(!bad.length, bad.length + ' violări:\n       ' + bad.slice(0, 8).join('\n       ')); await ctx.close();
  });
} else console.log('       (axe indisponibil: omis)');
await T('rețea: nicio cerere în afara localhost; fără erori de pagină/CSP', async () => { ok(!ext.length, 'cereri externe: ' + ext.slice(0, 5).join(', ')); ok(!errs.length, 'erori: ' + errs.slice(0, 5).join(' || ')); });
await browser.close(); servers.forEach((s) => s.close());
const f = results.filter((r) => !r[1]).length; console.log(`\n${results.length - f}/${results.length} ok`); process.exit(f ? 1 : 0);
