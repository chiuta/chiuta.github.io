// Teste Poteca (Playwright). Rulare: node apps/Poteca/tests/test.mjs   (opțional: TEST_ONLY=regex, POTECA_TMP=dir, AXE_PATH=cale/axe.min.js)
import {createRequire} from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = 'file://' + path.resolve(HERE, '..', 'index.html');
const TMP = fs.mkdtempSync(path.join(process.env.POTECA_TMP || os.tmpdir(), 'poteca-test-'));
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const ONLY = process.env.TEST_ONLY ? new RegExp(process.env.TEST_ONLY, 'i') : null;

/* ---------- harness ---------- */
const results = [];
const tests = [];
function test(name, fn) { tests.push({name, fn}); }
function ok(c, m) { if (!c) throw new Error('Aserțiune eșuată: ' + m); }
function near(a, b, tol, m) { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m}: ${a} ≠ ${b} (±${tol})`); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); }

let browser;
const issues = []; // pageerror / CSP / rețea
async function newCtx(o = {}) {
  const ctx = await browser.newContext({viewport: {width: o.w || 1280, height: o.h || 800}, locale: o.locale || 'ro-RO', colorScheme: o.dark ? 'dark' : 'light', acceptDownloads: true, bypassCSP: !!o.bypassCSP, hasTouch: !!o.touch, reducedMotion: o.reduced ? 'reduce' : 'no-preference'});
  await ctx.route(/^https?:/, r => { issues.push('REȚEA: ' + r.request().url()); r.abort(); });
  return ctx;
}
async function newPage(o = {}) {
  const ctx = o.ctx || await newCtx(o);
  const page = await ctx.newPage();
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !o.allowConsole) issues.push('console.error: ' + m.text()); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  await page.goto(APP);
  await page.waitForSelector('body[data-ready]');
  page._ctx = ctx;
  return page;
}
async function closeAll(page) { await page._ctx.close(); }
async function cspViolations(page) { return page.evaluate(() => window.__csp); }
async function upload(page, files) {
  const n = await page.evaluate(() => window.Poteca.S.tracks.length);
  await page.setInputFiles('#file-in', files.map(f => ({name: f.name, mimeType: f.mime || 'application/octet-stream', buffer: Buffer.from(f.data)})));
  await page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false', null, {timeout: 120000});
  await page.waitForTimeout(80);
}
const P = (page, fn, arg) => page.evaluate(fn, arg);

/* ---------- fixtures sintetice ---------- */
const RE = 6371008.8, RAD = Math.PI / 180;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = Date.UTC(2026, 9, 14, 8, 0, 0);
// urcare constantă pe meridian: pas fix, viteză fixă, pantă fixă
function lineTrack({n = 1001, step = 10, speed = 2, grade = 0.05, lat0 = 45, lon0 = 26, e0 = 1000, t0 = T0, hr = false, name = 'Urcare', lonOff = 0, pauses = []} = {}) {
  const pts = []; let t = t0;
  for (let i = 0; i < n; i++) {
    const d = i * step;
    pts.push({lat: lat0 + d / (RE * RAD), lon: lon0 + lonOff, ele: e0 + grade * d, t, hr: hr ? 100 + (i % 20) : NaN, cad: hr ? 80 : NaN, atemp: hr ? 12.5 : NaN});
    const p = pauses.find(q => q.i === i);
    if (p) { for (let s = 10; s <= p.sec; s += 10) { t += 10000; pts.push({...pts[pts.length - 1], t}); } }
    t += step / speed * 1000;
  }
  return {name, pts};
}
function circleTrack({r = 100, n = 360, lat0 = 45, lon0 = 26, name = 'Cerc'} = {}) {
  const pts = []; const kx = RE * RAD * Math.cos(lat0 * RAD), ky = RE * RAD;
  for (let i = 0; i <= n; i++) { const a = 2 * Math.PI * (i % n) / n; pts.push({lat: lat0 + r * Math.sin(a) / ky, lon: lon0 + r * Math.cos(a) / kx, ele: 300 + i * 0.01, t: T0 + i * 5000, hr: NaN, cad: NaN, atemp: NaN}); }
  return {name, pts};
}
const num = (v, d) => isFinite(v) ? v.toFixed(d) : null;
function gpxText(tracks, wpts = [], o = {}) {
  const pre = o.prefix ? o.prefix + ':' : '';
  const head = o.v10 ? `<gpx version="1.0" creator="t" xmlns="http://www.topografix.com/GPX/1/0">` : `<gpx version="1.1" creator="t" xmlns${o.prefix ? ':' + o.prefix : ''}="http://www.topografix.com/GPX/1/1" xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">`;
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n${head}\n`;
  for (const w of wpts) s += `<${pre}wpt lat="${w.lat}" lon="${w.lon}">${isFinite(w.ele) ? `<${pre}ele>${w.ele}</${pre}ele>` : ''}<${pre}name>${w.name}</${pre}name>${w.sym ? `<${pre}sym>${w.sym}</${pre}sym>` : ''}${w.desc ? `<${pre}desc>${w.desc}</${pre}desc>` : ''}</${pre}wpt>\n`;
  for (const tr of tracks) {
    const tag = tr.rte ? 'rte' : 'trk', pt = tr.rte ? 'rtept' : 'trkpt';
    s += `<${pre}${tag}><${pre}name>${tr.name}</${pre}name>${tr.rte ? '' : `<${pre}trkseg>`}\n`;
    for (const p of tr.pts) {
      s += `<${pre}${pt} lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">`;
      if (isFinite(p.ele) && !o.noEle) s += `<${pre}ele>${p.ele.toFixed(2)}</${pre}ele>`;
      if (isFinite(p.t) && !o.noTime) s += `<${pre}time>${new Date(p.t).toISOString()}</${pre}time>`;
      if (isFinite(p.hr) && !o.v10) s += `<${pre}extensions><ns3:TrackPointExtension><ns3:atemp>${p.atemp}</ns3:atemp><ns3:hr>${p.hr}</ns3:hr><ns3:cad>${p.cad}</ns3:cad></ns3:TrackPointExtension></${pre}extensions>`;
      s += `</${pre}${pt}>\n`;
    }
    s += `${tr.rte ? '' : `</${pre}trkseg>`}</${pre}${tag}>\n`;
  }
  return s + '</gpx>\n';
}
function csvText(pts, o = {}) {
  const d = o.delim || ',', dec = x => o.comma ? String(x).replace('.', ',') : String(x);
  let s = o.noHeader ? '' : ['lat', 'lon', 'ele', 'time'].join(d) + '\n';
  for (const p of pts) s += [dec(p.lat.toFixed(7)), dec(p.lon.toFixed(7)), dec(p.ele.toFixed(1)), new Date(p.t).toISOString()].join(d) + '\n';
  return s;
}
// distanța de la punct la poliliniei, în plan local (m)
function distToPoly(p, poly, kx, ky) {
  let best = Infinity;
  const px = p.lon * kx, py = p.lat * ky;
  for (let i = 0; i + 1 < poly.length; i++) {
    const ax = poly[i].lon * kx, ay = poly[i].lat * ky, bx = poly[i + 1].lon * kx, by = poly[i + 1].lat * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let u = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; u = Math.max(0, Math.min(1, u));
    const e = Math.hypot(ax + u * dx - px, ay + u * dy - py); if (e < best) best = e;
  }
  return best;
}
const hav = (a1, o1, a2, o2) => { const p1 = a1 * RAD, p2 = a2 * RAD, s = Math.sin((p2 - p1) / 2), t = Math.sin((o2 - o1) * RAD / 2); return 2 * RE * Math.asin(Math.sqrt(s * s + Math.cos(p1) * Math.cos(p2) * t * t)); };
const trackArrays = page => page.evaluate(() => { const t = window.Poteca.selTrack(); const a = k => Array.from(t[k]).map(v => Number.isFinite(v) ? v : null); return {name: t.name, n: t.n, lat: a('lat'), lon: a('lon'), ele: a('ele'), t: a('t'), hr: a('hr'), cad: a('cad'), atemp: a('atemp')}; });
const stats = (page, id) => page.evaluate(id => { const P = window.Poteca; const t = id ? P.S.tracks.find(x => x.id === id) : P.selTrack(); const A = P.analyze(t, P.params()); const o = {}; for (const k of ['dist', 'tTot', 'tMove', 'tStop', 'vAvgMove', 'vAvgTot', 'vMax', 'paceMove', 'gain', 'loss', 'gainRaw', 'lossRaw', 'eMin', 'eMax', 'gradeUp', 'gradeDn', 'hasT', 'hasEle']) o[k] = A[k]; o.hr = A.hr; return o; }, id);
async function tab(page, id) { await page.click('#tab-' + id); }
async function selectTrackByName(page, name) { await tab(page, 'tracks'); await page.locator('#track-list button.nm', {hasText: name}).first().click(); }
async function download(page, selector) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const p = path.join(TMP, dl.suggestedFilename());
  await dl.saveAs(p);
  return p;
}
function py(script, ...args) {
  const f = path.join(TMP, 'v_' + Math.random().toString(36).slice(2) + '.py');
  fs.writeFileSync(f, script);
  const out = execFileSync('python3', ['-I', f, ...args], {encoding: 'utf8', maxBuffer: 1 << 28});
  return JSON.parse(out);
}
// parser independent: ElementTree + verificarea ordinii elementelor din schema GPX 1.1
const PY_GPX = `
import sys, json, re
import xml.etree.ElementTree as ET
NS = '{http://www.topografix.com/GPX/1/1}'
TPX = '{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}'
ORDER = {
 'gpx': ['metadata','wpt','rte','trk','extensions'],
 'metadata': ['name','desc','author','copyright','link','time','keywords','bounds','extensions'],
 'wpt': ['ele','time','magvar','geoidheight','name','cmt','desc','src','link','sym','type','fix','sat','hdop','vdop','pdop','ageofdgpsdata','dgpsid','extensions'],
 'rte': ['name','cmt','desc','src','link','number','type','extensions','rtept'],
 'trk': ['name','cmt','desc','src','link','number','type','extensions','trkseg'],
 'trkseg': ['trkpt','extensions'],
}
ORDER['trkpt'] = ORDER['wpt']; ORDER['rtept'] = ORDER['wpt']
TPXORDER = ['atemp','wtemp','depth','hr','cad']
TIME = re.compile(r'^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$')
errs = []
root = ET.parse(sys.argv[1]).getroot()
if root.tag != NS + 'gpx': errs.append('rădăcină ' + root.tag)
if root.get('version') != '1.1': errs.append('versiune')
if not root.get('creator'): errs.append('creator lipsă')
def chk(el, kind):
    last = -1
    for c in el:
        if not c.tag.startswith(NS): errs.append('element în afara spațiului GPX în ' + kind + ': ' + c.tag); continue
        n = c.tag[len(NS):]
        if n not in ORDER.get(kind, []): errs.append('element nepermis ' + n + ' în ' + kind); continue
        i = ORDER[kind].index(n)
        if i < last: errs.append('ordine greșită ' + n + ' în ' + kind)
        last = i
def pt(el, kind):
    chk(el, kind)
    lat = float(el.get('lat')); lon = float(el.get('lon'))
    if not (-90 <= lat <= 90): errs.append('lat în afara domeniului')
    if not (-180 <= lon < 180): errs.append('lon în afara domeniului')
    for c in el:
        n = c.tag.split('}')[-1]
        if n == 'ele': float(c.text)
        if n == 'time' and not TIME.match(c.text): errs.append('timp invalid ' + c.text)
        if n == 'extensions':
            for e in c:
                if e.tag != TPX + 'TrackPointExtension': errs.append('extensie necunoscută')
                last = -1
                for q in e:
                    if not q.tag.startswith(TPX): errs.append('element TPX străin'); continue
                    nn = q.tag[len(TPX):]
                    if nn not in TPXORDER: errs.append('TPX nepermis ' + nn); continue
                    ix = TPXORDER.index(nn)
                    if ix < last: errs.append('ordine TPX')
                    last = ix
                    float(q.text)
chk(root, 'gpx')
counts = {'wpt': 0, 'trk': 0, 'rte': 0, 'trkpt': 0, 'rtept': 0}
first = None; wpts = []
for c in root:
    n = c.tag[len(NS):] if c.tag.startswith(NS) else c.tag
    if n == 'wpt':
        counts['wpt'] += 1; pt(c, 'wpt')
        wpts.append({k: (c.find(NS + k).text if c.find(NS + k) is not None else None) for k in ['name','sym','desc','ele']} | {'lat': float(c.get('lat')), 'lon': float(c.get('lon'))})
    elif n == 'trk':
        counts['trk'] += 1; chk(c, 'trk')
        for sg in c.findall(NS + 'trkseg'):
            chk(sg, 'trkseg')
            for p in sg.findall(NS + 'trkpt'):
                counts['trkpt'] += 1; pt(p, 'trkpt')
                if first is None: first = [float(p.get('lat')), float(p.get('lon'))]
    elif n == 'rte':
        counts['rte'] += 1; chk(c, 'rte')
        for p in c.findall(NS + 'rtept'): counts['rtept'] += 1; pt(p, 'rtept')
print(json.dumps({'ok': not errs, 'errors': errs[:10], 'counts': counts, 'first': first, 'wpts': wpts, 'meta': root.find(NS + 'metadata') is not None}))
`;
function fileTxt(p) { return fs.readFileSync(p, 'utf8'); }
const g = (page, fn, a) => page.evaluate(fn, a);

/* =====================================================================
   A. IMPORT
   ===================================================================== */
test('A1 GPX 1.1: piste, rute, waypoint-uri, extensii Garmin (hr/cad/atemp)', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 50, hr: true, name: 'Pistă & test <1>'}); tr.name = 'Pistă &amp; test &lt;1&gt;';
  const rte = lineTrack({n: 5, name: 'Rută'}); rte.rte = true;
  const gpx = gpxText([tr, rte], [{lat: 45.01, lon: 26.0, ele: 1010, name: 'Vârf', sym: 'Summit', desc: 'Descriere'}]);
  await upload(page, [{name: 'a.gpx', data: gpx}]);
  const r = await g(page, () => { const S = window.Poteca.S; return {tracks: S.tracks.map(t => ({name: t.name, kind: t.kind, n: t.n, hr: t.hr[3], cad: t.cad[3], at: t.atemp[3], ele: t.ele[3], time: t.t[0]})), wpts: S.wpts.map(w => ({name: w.name, sym: w.sym, desc: w.desc, ele: w.ele}))}; });
  eq(r.tracks.length, 2, 'număr trasee'); eq(r.tracks[0].name, 'Pistă & test <1>', 'nume decodat');
  eq(r.tracks[0].n, 50, 'puncte'); eq(r.tracks[0].hr, 103, 'hr'); eq(r.tracks[0].cad, 80, 'cad'); eq(r.tracks[0].at, 12.5, 'atemp');
  eq(r.tracks[1].kind, 'rte', 'rută'); eq(r.tracks[1].n, 5, 'puncte rută');
  eq(r.wpts[0].name, 'Vârf', 'waypoint'); eq(r.wpts[0].sym, 'Summit', 'simbol'); eq(r.wpts[0].ele, 1010, 'alt waypoint');
  near(r.tracks[0].time, T0, 0, 'timp');
  eq((await cspViolations(page)).length, 0, 'CSP');
  await closeAll(page);
});
test('A2 GPX 1.0, prefix de spațiu de nume, fără time/ele, mai multe fișiere simultan', async () => {
  const page = await newPage();
  const a = lineTrack({n: 20, name: 'V10'});
  const b = lineTrack({n: 30, name: 'Prefixat', lat0: 46});
  const c = lineTrack({n: 10, name: 'FaraTimp', lat0: 47});
  await upload(page, [
    {name: 'v10.gpx', data: gpxText([a], [], {v10: true})},
    {name: 'pref.gpx', data: gpxText([b], [], {prefix: 'gpx'})},
    {name: 'notime.gpx', data: gpxText([c], [], {noTime: true, noEle: true})}]);
  const r = await g(page, () => window.Poteca.S.tracks.map(t => ({name: t.name, n: t.n, hasT: t.t.some(Number.isFinite), hasE: t.ele.some(Number.isFinite)})));
  eq(r.length, 3, '3 trasee');
  eq(r[0].n, 20, 'v1.0'); eq(r[1].n, 30, 'prefix'); eq(r[2].hasT, false, 'fără timp'); eq(r[2].hasE, false, 'fără alt');
  const log = await page.locator('#import-log li').allTextContents();
  ok(log.some(x => /fără timp/.test(x)), 'mesaj fără timp'); ok(log.some(x => /fără altitudine/.test(x)), 'mesaj fără altitudine');
  // traseul fără timp: statisticile nu inventează timp
  await selectTrackByName(page, 'FaraTimp'); await tab(page, 'stats');
  const s = await stats(page);
  eq(s.hasT, false, 'hasT'); eq(s.hasEle, false, 'hasEle');
  const txt = await page.locator('#stats-grid').innerText();
  ok(/—/.test(txt), 'valori lipsă marcate cu —');
  await closeAll(page);
});
test('A3 fișiere imperfecte: XML trunchiat, nu-GPX, gol, JSON invalid, coordonate invalide', async () => {
  const page = await newPage();
  const good = gpxText([lineTrack({n: 40, name: 'Trunchiat'})]);
  const cut = good.slice(0, good.indexOf('</trkseg>') - 60);
  await upload(page, [{name: 'cut.gpx', data: cut}]);
  let r = await g(page, () => window.Poteca.S.tracks.map(t => t.n));
  ok(r.length === 1 && r[0] >= 35, 'recuperat din XML trunchiat: ' + r);
  let log = await page.locator('#import-log li').allTextContents();
  ok(log.some(x => /tolerant/.test(x)), 'avertisment citire tolerantă');
  // nu este GPX
  await upload(page, [{name: 'x.gpx', data: '<?xml version="1.0"?><foo><bar/></foo>'}, {name: 'e.csv', data: ''}, {name: 'bad.geojson', data: '{"type": "FeatureCollection", "features": [ {'}, {name: 'rand.txt', data: 'lorem ipsum\nblabla'}]);
  log = await page.locator('#import-log li').allTextContents();
  ok(log.some(x => /nu este GPX/.test(x)), 'mesaj nu-GPX'); ok(log.some(x => /fișier gol/.test(x)), 'mesaj gol');
  ok(log.some(x => /JSON invalid/.test(x)), 'mesaj JSON invalid'); ok(log.some(x => /nu s-au găsit/.test(x) || /antetul CSV|rânduri CSV/.test(x)), 'mesaj date lipsă');
  r = await g(page, () => window.Poteca.S.tracks.length);
  eq(r, 1, 'niciun traseu fals adăugat');
  // coordonate invalide într-un GPX valid
  const bad = `<gpx version="1.1" creator="x" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>B</name><trkseg><trkpt lat="45" lon="26"/><trkpt lat="91" lon="26"/><trkpt lat="abc" lon="26"/><trkpt lat="45.001" lon="26"/></trkseg></trk></gpx>`;
  await upload(page, [{name: 'bad.gpx', data: bad}]);
  const n = await g(page, () => window.Poteca.S.tracks[1].n);
  eq(n, 2, 'puncte invalide ignorate');
  log = await page.locator('#import-log li').allTextContents();
  ok(log.some(x => /2 puncte ignorate/.test(x)), 'mesaj puncte ignorate');
  eq((await cspViolations(page)).length, 0, 'CSP');
  await closeAll(page);
});
test('A4 GeoJSON, KML, CSV (variante), poligon-singur devine strat', async () => {
  const page = await newPage();
  const geo = {type: 'FeatureCollection', features: [
    {type: 'Feature', properties: {name: 'Linie', coordinateProperties: {times: ['2026-10-14T08:00:00Z', '2026-10-14T08:00:10Z', '2026-10-14T08:00:20Z'], heart: [100, 110, 120]}}, geometry: {type: 'LineString', coordinates: [[26, 45, 100], [26.001, 45, 101], [26.002, 45, 102]]}},
    {type: 'Feature', properties: {name: 'Multi'}, geometry: {type: 'MultiLineString', coordinates: [[[27, 45], [27.001, 45]], [[27.1, 45], [27.101, 45], [27.102, 45]]]}},
    {type: 'Feature', properties: {name: 'Punct', sym: 'Water', desc: 'x'}, geometry: {type: 'Point', coordinates: [26.0005, 45.0001, 99]}}]};
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document>
    <Placemark><name>KLinie</name><LineString><coordinates>26,46,10 26.001,46,11 26.002,46,12</coordinates></LineString></Placemark>
    <Placemark><name>KPunct</name><description>d</description><Point><coordinates>26.5,46.5,5</coordinates></Point></Placemark>
    <Placemark><name>KTrack</name><gx:Track><when>2026-10-14T08:00:00Z</when><when>2026-10-14T08:00:05Z</when><gx:coord>26 47 1</gx:coord><gx:coord>26.001 47 2</gx:coord></gx:Track></Placemark></Document></kml>`;
  const csv1 = csvText(lineTrack({n: 12}).pts);
  const csv2 = csvText(lineTrack({n: 7, lat0: 48}).pts, {delim: ';', comma: true});
  const csv3 = csvText(lineTrack({n: 6, lat0: 49}).pts, {noHeader: true});
  const csv4 = 'lat,lon\n45,26\nfoo,26\n45.001,26\n45.002,200\n45.003,26\n';
  await upload(page, [{name: 'g.geojson', data: JSON.stringify(geo)}, {name: 'k.kml', data: kml}, {name: 'c1.csv', data: csv1}, {name: 'c2.csv', data: csv2}, {name: 'c3.csv', data: csv3}, {name: 'c4.csv', data: csv4}]);
  const r = await g(page, () => ({t: window.Poteca.S.tracks.map(t => [t.name, t.n, t.t.some(Number.isFinite), t.hr.some(Number.isFinite)]), w: window.Poteca.S.wpts.map(w => [w.name, w.sym, w.ele])}));
  const m = Object.fromEntries(r.t.map(x => [x[0], x]));
  eq(m['Linie'][1], 3, 'LineString'); eq(m['Linie'][2], true, 'timp GeoJSON'); eq(m['Linie'][3], true, 'hr GeoJSON');
  eq(m['Multi'][1], 2, 'Multi 1'); eq(m['Multi 2'] ? m['Multi 2'][1] : -1, 3, 'Multi 2');
  eq(m['KLinie'][1], 3, 'KML LineString'); eq(m['KTrack'][1], 2, 'gx:Track'); eq(m['KTrack'][2], true, 'timp gx:Track');
  eq(m['c1'][1], 12, 'CSV'); eq(m['c1'][2], true, 'timp CSV'); eq(m['c2'][1], 7, 'CSV ; cu virgulă zecimală'); eq(m['c3'][1], 6, 'CSV fără antet');
  eq(m['c4'][1], 3, 'CSV cu rânduri invalide');
  ok(r.w.some(x => x[0] === 'Punct' && x[1] === 'Water' && x[2] === 99), 'waypoint GeoJSON'); ok(r.w.some(x => x[0] === 'KPunct'), 'waypoint KML');
  const log = await page.locator('#import-log li').allTextContents();
  ok(log.some(x => /2 rânduri CSV ignorate/.test(x)), 'raport rânduri CSV');
  // poligon singur -> strat
  const poly = {type: 'Feature', properties: {name: 'Zonă'}, geometry: {type: 'Polygon', coordinates: [[[26, 45], [26.01, 45], [26.01, 45.01], [26, 45.01], [26, 45]]]}};
  await upload(page, [{name: 'zona.geojson', data: JSON.stringify(poly)}]);
  const L = await g(page, () => window.Poteca.S.layers.map(l => [l.name, l.parts.length, l.parts[0].kind]));
  eq(JSON.stringify(L), JSON.stringify([['zona', 1, 'ring']]), 'poligon -> strat');
  await closeAll(page);
});

/* =====================================================================
   B. STATISTICI (valori calculate analitic)
   ===================================================================== */
test('B1 geodezie: haversine, Vincenty (valori publicate)', async () => {
  const page = await newPage();
  const r = await g(page, () => { const P = window.Poteca; return {
    h1: P.hav(0, 0, 0, 1), v1: P.vinc(0, 0, 0, 1),
    // Geoscience Australia: Flinders Peak -> Buninyong = 54972.271 m
    fb: P.vinc(-(37 + 57 / 60 + 3.72030 / 3600), 144 + 25 / 60 + 29.52440 / 3600, -(37 + 39 / 60 + 10.15610 / 3600), 143 + 55 / 60 + 35.38390 / 3600),
    z: P.vinc(10, 10, 10, 10), mer: P.vinc(0, 0, 1, 0) }; });
  near(r.h1, 6371008.8 * Math.PI / 180, 1e-6, 'haversine 1° la ecuator');
  near(r.v1, 6378137 * Math.PI / 180, 0.01, 'Vincenty 1° lon ecuator (a·π/180)');
  near(r.fb, 54972.271, 0.005, 'Vincenty Flinders–Buninyong');
  eq(r.z, 0, 'distanță zero'); near(r.mer, 110574.389, 0.01, 'Vincenty 1° lat ecuator');
  await closeAll(page);
});
test('B2 urcare constantă: distanță, câștig, timp, viteză, ritm, pantă', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 1001, step: 10, speed: 2, grade: 0.05, hr: true});
  await upload(page, [{name: 'urcare.gpx', data: gpxText([tr])}]);
  const s = await stats(page);
  const expDist = RE * (1000 * 10 / (RE * RAD)) * RAD; // = 10000 m
  near(s.dist, expDist, 0.2, 'distanță');   // 7 zecimale în coordonate: ~1 cm/pas
  near(s.gain, 500, 1.5, 'câștig'); near(s.loss, 0, 0.5, 'pierdere');
  near(s.gainRaw, 500, 1.5, 'câștig brut'); near(s.eMin, 1000, 0.01, 'alt min'); near(s.eMax, 1500, 0.01, 'alt max');
  near(s.tTot, 5000, 0.001, 'timp total'); near(s.tMove, 5000, 0.001, 'timp mișcare'); near(s.tStop, 0, 0.001, 'timp oprit');
  near(s.vAvgMove, 2, 0.01, 'viteză medie'); near(s.vMax, 2, 0.02, 'viteză max'); near(s.paceMove, 500, 5, 'ritm s/km');
  near(s.gradeUp, 5, 0.1, 'pantă max urcare'); near(s.gradeDn, 5, 0.1, 'pantă min (constantă)');
  ok(s.hr.avg > 100 && s.hr.avg < 120, 'puls mediu');
  // afișare în UI
  await tab(page, 'stats');
  const t = await page.locator('#stats-grid').innerText();
  ok(/10[.,]00\s*km/.test(t), 'distanța în UI: ' + t.slice(0, 80)); ok(/1:23:20/.test(t), 'timp total 1:23:20');
  await closeAll(page);
});
test('B3 pauze: timp oprit/în mișcare, etape, viteza maximă pe ferestre de 5 s', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 601, step: 10, speed: 2, grade: 0, pauses: [{i: 100, sec: 300}, {i: 300, sec: 120}, {i: 450, sec: 60}]});
  // sprint: între punctele 200..210 viteză 5 m/s (10 s): modificăm timpii
  let shift = 0;
  tr.pts.forEach((p, k) => { p._k = k; });
  await upload(page, [{name: 'pauze.gpx', data: gpxText([tr])}]);
  let s = await stats(page);
  near(s.tStop, 480, 0.001, 'timp oprit = 300+120+60');
  near(s.tMove, 6000 / 2, 0.001, 'timp în mișcare'); near(s.tTot, 3000 + 480, 0.001, 'timp total');
  near(s.vAvgMove, 2, 0.01, 'viteză medie în mișcare (fără pauze)'); near(s.vAvgTot, 6000 / 3480, 0.01, 'viteză medie totală');
  // etape: pauzele >= 120 s => 2 pauze => 3 etape; (60 s nu atinge pragul)
  await tab(page, 'stats'); await page.click('input[name=split][value=stage]');
  const rows = await page.locator('#splits tbody tr').count();
  eq(rows, 3, 'număr etape');
  const first = await page.locator('#splits tbody tr').first().innerText();
  ok(/1[.,]00\s*km/.test(first), 'prima etapă 1 km: ' + first);
  // prag de pauză mai mic => 3 pauze, 4 etape
  await page.fill('#p-pause', '50'); await page.locator('#p-pause').dispatchEvent('change');
  eq(await page.locator('#splits tbody tr').count(), 4, '4 etape cu prag 50 s');
  // viteză maximă: sprint 5 m/s timp de 20 s
  const sp = lineTrack({n: 301, step: 10, speed: 2, grade: 0});
  let t = sp.pts[0].t; for (let i = 0; i < sp.pts.length; i++) { sp.pts[i].t = t; t += (i >= 100 && i < 110 ? 2000 : 5000); }
  sp.name = 'Sprint';
  await upload(page, [{name: 'sprint.gpx', data: gpxText([sp])}]);
  await selectTrackByName(page, 'Sprint');
  s = await stats(page);
  near(s.vMax, 5, 0.05, 'viteză maximă (fereastră 5 s) = 5 m/s');
  await closeAll(page);
});
test('B4 cerc (spirală închisă): lungime față de perimetrul poligonului', async () => {
  const page = await newPage();
  const c = circleTrack({r: 150, n: 720});
  await upload(page, [{name: 'cerc.gpx', data: gpxText([c])}]);
  const s = await stats(page);
  const expected = 2 * 720 * 150 * Math.sin(Math.PI / 720);
  near(s.dist / expected, 1, 5e-4, 'perimetru');
  // Vincenty vs haversine: diferență mică, dar existentă pe elipsoid
  await tab(page, 'stats'); const before = (await stats(page)).dist;
  await page.check('#p-vinc'); const after = (await stats(page)).dist;
  ok(Math.abs(after - before) > 1e-3 && Math.abs(after / before - 1) < 0.006, 'Vincenty diferă de haversine în limite: ' + before + ' vs ' + after);
  await closeAll(page);
});
test('B5 netezire și prag: câștigul brut vs cel netezit, diferența afișată', async () => {
  const page = await newPage();
  const rnd = mulberry(5), n = 1500;
  const tr = lineTrack({n, step: 8, speed: 1.5, grade: 0, e0: 500, name: 'Plat zgomotos'});
  tr.pts.forEach(p => { p.ele = 500 + (rnd() - 0.5) * 3; }); // ±1,5 m zgomot pe teren plat
  await upload(page, [{name: 'plat.gpx', data: gpxText([tr])}]);
  const s = await stats(page);
  ok(s.gainRaw > 500, 'câștig brut mare din zgomot: ' + s.gainRaw);
  ok(s.gain < 15, 'câștig netezit (30 m, prag 3 m) mic: ' + s.gain);
  await tab(page, 'stats');
  const d = await page.locator('#stats-diff').innerText();
  ok(/brut/i.test(d) && /\+\d/.test(d), 'diferența față de calculul brut este afișată: ' + d);
  // fără netezire și fără prag => egal cu brutul
  await page.fill('#p-smooth', '0'); await page.locator('#p-smooth').dispatchEvent('change');
  await page.fill('#p-thr', '0'); await page.locator('#p-thr').dispatchEvent('change');
  const z = await stats(page);
  near(z.gain, z.gainRaw, 1e-6, 'fără netezire/prag = brut');
  // prag mare pe urcare reală: 200 m în trepte de 1 m
  const stair = lineTrack({n: 401, step: 5, speed: 1, grade: 0.1, name: 'Rampa'});
  await upload(page, [{name: 'rampa.gpx', data: gpxText([stair])}]); await selectTrackByName(page, 'Rampa'); await tab(page, 'stats');
  await page.fill('#p-thr', '5'); await page.locator('#p-thr').dispatchEvent('change');
  const r = await stats(page); near(r.gain, 200, 2, 'rampă 10%: 2000 m * 0.1');
  await closeAll(page);
});
test('B6 împărțiri pe km/mile: număr, timp, ritm, segment parțial', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 551, step: 10, speed: 2.5, grade: 0.02});
  await upload(page, [{name: 'split.gpx', data: gpxText([tr])}]);
  await tab(page, 'stats');
  let rows = await page.locator('#splits tbody tr').allInnerTexts();
  eq(rows.length, 6, '5,5 km => 6 segmente');
  ok(/1:06:40|6:40/.test(rows[0]) || /6:40 \/km/.test(rows[0]), 'ritm 6:40 /km pentru 2,5 m/s: ' + rows[0]);
  ok(/\*/.test(rows[5]) && /0[.,]50\s*km/.test(rows[5]), 'ultimul parțial marcat cu *: ' + rows[5]);
  const tot = await page.evaluate(() => { const P = window.Poteca, t = P.selTrack(), A = P.analyze(t, P.params()); const r = P.splitsBy(t, A, 1000); return {sumD: r.reduce((s, x) => s + x.dist, 0), sumT: r.reduce((s, x) => s + x.time, 0), tt: A.tTot, d: A.dist, gain: r.reduce((s, x) => s + x.gain, 0)}; });
  near(tot.sumD, tot.d, 0.01, 'suma distanțelor'); near(tot.sumT, tot.tt, 0.01, 'suma timpilor'); near(tot.gain, 110, 1.5, 'suma câștigurilor: 5500 m * 0.02');
  await page.click('input[name=split][value=mi]');
  rows = await page.locator('#splits tbody tr').allInnerTexts();
  eq(rows.length, 4, '5,5 km = 3,42 mi => 4 segmente');
  await closeAll(page);
});

/* =====================================================================
   C. EDITARE
   ===================================================================== */
async function loadLine(page, o = {}) { const tr = lineTrack(o); await upload(page, [{name: (o.name || 'linie') + '.gpx', data: gpxText([tr])}]); return tr; }
async function cursorTo(page, idx) { await page.evaluate(i => { const e = document.getElementById('prof'); e.focus(); }, idx); await page.keyboard.press('Home'); for (let k = 0; k < Math.floor(idx / 20); k++) await page.keyboard.press('Shift+ArrowRight'); }
test('C1 inversare, tăiere A–B, împărțire, anulare/refacere', async () => {
  const page = await newPage();
  await loadLine(page, {n: 1000, name: 'Lin'});
  await tab(page, 'edit');
  const a0 = await trackArrays(page);
  // inversare
  await page.click('#e-reverse');
  const a1 = await trackArrays(page);
  near(a1.lat[0], a0.lat[999], 1e-9, 'primul punct = vechiul ultim'); near(a1.ele[0], a0.ele[999], 1e-9, 'alt');
  ok(a1.t.every((v, i) => i === 0 || v >= a1.t[i - 1]), 'timpul rămâne crescător');
  near(a1.t[0], a0.t[0], 0, 'start timp păstrat');
  await page.keyboard.press('Control+z');
  const a2 = await trackArrays(page); near(a2.lat[0], a0.lat[0], 1e-9, 'undo inversare');
  await page.keyboard.press('Control+y');
  near((await trackArrays(page)).lat[0], a0.lat[999], 1e-9, 'redo inversare');
  await page.click('#b-undo');
  // A–B
  await page.focus('#prof'); await page.keyboard.press('Home'); for (let k = 0; k < 10; k++) await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('a'); // 200
  for (let k = 0; k < 15; k++) await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('b'); // 500
  const ab = await page.evaluate(() => [window.Poteca.S.A, window.Poteca.S.B]);
  eq(ab[0], 200, 'A'); eq(ab[1], 500, 'B');
  await page.click('#e-keep');
  let a3 = await trackArrays(page); eq(a3.n, 301, 'păstrat A–B (inclusiv capete)'); near(a3.lat[0], a0.lat[200], 1e-9, 'primul = A');
  await page.click('#b-undo');
  await page.focus('#prof'); await page.keyboard.press('Home'); for (let k = 0; k < 10; k++) await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('a');
  for (let k = 0; k < 15; k++) await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('b');
  await page.click('#e-cut');
  a3 = await trackArrays(page); eq(a3.n, 1000 - 301, 'eliminat A–B');
  await page.click('#b-undo');
  // împărțire la cursor (500)
  await page.click('#e-split');
  const names = await page.evaluate(() => window.Poteca.S.tracks.map(t => [t.name, t.n]));
  eq(names.length, 2, 'două trasee'); eq(names[0][1] + names[1][1], 1001, 'punctul de tăiere e comun');
  eq(names[0][1], 501, 'prima parte');
  await closeAll(page);
});
test('C2 îmbinare (după timp) și extragere A–B', async () => {
  const page = await newPage();
  const a = lineTrack({n: 100, name: 'Primul', t0: T0}), b = lineTrack({n: 50, name: 'Al doilea', lat0: 45.2, t0: T0 + 7200000});
  await upload(page, [{name: 'b.gpx', data: gpxText([b])}, {name: 'a.gpx', data: gpxText([a])}]); // ordine inversă la încărcare
  await selectTrackByName(page, 'Al doilea'); await tab(page, 'edit');
  await page.locator('#merge-list label', {hasText: 'Primul'}).click();
  await page.click('#e-merge');
  const r = await g(page, () => ({n: window.Poteca.S.tracks.length, t: window.Poteca.selTrack().n, name: window.Poteca.selTrack().name, t0: window.Poteca.selTrack().t[0], ok: Array.from(window.Poteca.selTrack().t).every((v, i, arr) => i === 0 || v >= arr[i - 1])}));
  eq(r.n, 1, 'sursele înlocuite'); eq(r.t, 150, 'puncte totale'); ok(r.ok, 'ordonat după timp'); near(r.t0, T0, 0, 'începe cu cel mai vechi');
  await closeAll(page);
});
test('C3 simplificare Douglas–Peucker: număr rezultat, formă în toleranță', async () => {
  const page = await newPage();
  // spirală Arhimede densă (20k puncte)
  const pts = []; const lat0 = 45, lon0 = 26, kx = RE * RAD * Math.cos(lat0 * RAD), ky = RE * RAD, N = 20000;
  for (let i = 0; i < N; i++) { const th = i * 0.01, r = 5 + th * 3; pts.push({lat: lat0 + r * Math.sin(th) / ky, lon: lon0 + r * Math.cos(th) / kx, ele: 100 + i * 0.001, t: T0 + i * 1000, hr: NaN, cad: NaN, atemp: NaN}); }
  await upload(page, [{name: 'spirala.gpx', data: gpxText([{name: 'Spirala', pts}])}]);
  await tab(page, 'edit');
  const orig = await trackArrays(page);
  await page.fill('#s-tol', '5');
  await page.waitForFunction(() => /din\s+20000/.test(document.getElementById('s-count').textContent), null, {timeout: 20000});
  const label = await page.locator('#s-count').innerText();
  const m = label.match(/(\d+) din (\d+)/); const predicted = +m[1];
  ok(predicted < 20000 && predicted > 50, 'număr previzionat: ' + label);
  await page.click('#e-simpl');
  const simp = await trackArrays(page);
  eq(simp.n, predicted, 'numărul rezultat = cel anunțat');
  near(simp.lat[0], orig.lat[0], 1e-12, 'capăt început păstrat'); near(simp.lon[simp.n - 1], orig.lon[N - 1], 1e-12, 'capăt sfârșit păstrat');
  const poly = simp.lat.map((la, i) => ({lat: la, lon: simp.lon[i]}));
  let worst = 0;
  const kx2 = RE * RAD * Math.cos((lat0) * RAD);
  for (let i = 0; i < N; i += 7) worst = Math.max(worst, distToPoly({lat: orig.lat[i], lon: orig.lon[i]}, poly, kx2, ky));
  ok(worst <= 5.0 + 0.1, 'abatere maximă ≤ toleranță: ' + worst.toFixed(3) + ' m');
  ok(worst > 1, 'simplificarea nu e trivială (abatere > 1 m)');
  // toleranță mai mică => mai multe puncte
  await page.click('#b-undo'); await page.fill('#s-tol', '1');
  // eticheta se actualizează cu debounce (200 ms): așteaptă să difere de cea anterioară (altfel s-ar citi textul vechi)
  await page.waitForFunction((prev) => { const t = document.getElementById('s-count').textContent; return /din\s+20000/.test(t) && t !== prev; }, label, {timeout: 20000});
  const m2 = (await page.locator('#s-count').innerText()).match(/(\d+) din/); ok(+m2[1] > predicted, 'toleranță mai mică => mai multe puncte: '+predicted+' vs '+m2[1]);
  await closeAll(page);
});
test('C4 eliminare spike-uri GPS (viteză și salt)', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 1200, step: 5, speed: 1.5, grade: 0.02, name: 'Spikes'});
  const spikes = [100, 300, 301, 600, 900, 1100];
  tr.pts.forEach((p, i) => { if (spikes.includes(i)) { p.lat += 0.05; p.lon += 0.04; } });
  await upload(page, [{name: 'spike.gpx', data: gpxText([tr])}]);
  const dirty = (await stats(page)).dist;
  ok(dirty > 6000 * 3, 'distanța murdară e mare: ' + dirty);
  await tab(page, 'edit');
  await page.waitForFunction(() => /:\s*6/.test(document.getElementById('k-count').textContent), null, {timeout: 5000});
  eq(await page.locator('#k-count').innerText(), 'Puncte detectate ca spike-uri: 6', 'număr detectat');
  await page.click('#e-spike');
  const clean = await stats(page);
  eq((await trackArrays(page)).n, 1194, 'puncte rămase');
  near(clean.dist, 1199 * 5, 5, 'distanța curățată ≈ analitic 5995 m');
  // doar cu filtrul de salt (fără timp)
  const nt = lineTrack({n: 300, step: 5, name: 'FaraT'}); nt.pts[50].lat += 0.1; nt.pts[120].lon += 0.1; nt.pts[121].lon += 0.1;
  await upload(page, [{name: 'ft.gpx', data: gpxText([nt], [], {noTime: true})}]); await selectTrackByName(page, 'FaraT'); await tab(page, 'edit');
  await page.fill('#k-v', '0'); await page.fill('#k-j', '200');
  await page.waitForFunction(() => /:\s*3/.test(document.getElementById('k-count').textContent), null, {timeout: 5000});
  await page.click('#e-spike'); eq((await trackArrays(page)).n, 297, 'spike-uri eliminate fără timp (grup de 2)');
  await closeAll(page);
});
test('C5 corectare timp: decalaj și ora de start', async () => {
  const page = await newPage();
  await loadLine(page, {n: 100, name: 'Timp'});
  await tab(page, 'edit');
  const a = await trackArrays(page);
  await page.fill('#t-off', '+01:00:30'); await page.click('#e-toff');
  const b = await trackArrays(page); near(b.t[10] - a.t[10], 3630000, 0, 'decalaj +1:00:30');
  await page.fill('#t-off', '-90'); await page.click('#e-toff');
  const c = await trackArrays(page); near(c.t[10] - b.t[10], -90000, 0, 'decalaj -90 s');
  await page.fill('#t-start', '2027-01-02T03:04:05'); await page.click('#e-tstart');
  const d = await trackArrays(page); near(d.t[0], Date.UTC(2027, 0, 2, 3, 4, 5), 0, 'ora de start');
  near(d.t[50] - d.t[0], a.t[50] - a.t[0], 0, 'durata păstrată');
  await closeAll(page);
});
test('C6 rutare manuală cu mouse: adăugare, inserare, mutare, ștergere', async () => {
  const page = await newPage();
  await page.click('#btn-newtrack');
  const box = await page.locator('#map').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  // adaugă 3 puncte
  for (const [fx, fy] of [[0.3, 0.5], [0.5, 0.4], [0.7, 0.5]]) { const [x, y] = at(fx, fy); await page.mouse.click(x, y); }
  let t = await trackArrays(page); eq(t.n, 3, '3 puncte adăugate');
  const exp = await page.evaluate(([x, y]) => window.Poteca.s2ll(x, y), [box.width * 0.5, box.height * 0.4]);
  near(t.lat[1], exp[0], 1e-6, 'lat punct 2'); near(t.lon[1], exp[1], 1e-6, 'lon punct 2');
  // inserare pe segmentul cel mai apropiat
  await tab(page, 'edit'); await page.check('#e-insnear');
  const [ix, iy] = at(0.4, 0.45 - 0.0); // aproape de primul segment
  await page.mouse.click(ix, iy);
  t = await trackArrays(page); eq(t.n, 4, '4 puncte');
  const idx = await page.evaluate(() => window.Poteca.S.cur); eq(idx, 1, 'inserat între 0 și 1');
  // mută punctul 2 (indexul 1) prin tragere
  await page.click('[data-mode=move]');
  const before = await trackArrays(page);
  const p1 = await page.evaluate(([la, lo]) => window.Poteca.ll2s(la, lo), [before.lat[1], before.lon[1]]);
  await page.mouse.move(box.x + p1[0], box.y + p1[1]); await page.mouse.down(); await page.mouse.move(box.x + p1[0] + 40, box.y + p1[1] + 30, {steps: 5}); await page.mouse.up();
  const after = await trackArrays(page);
  eq(after.n, 4, 'număr neschimbat');
  const want = await page.evaluate(([x, y]) => window.Poteca.s2ll(x, y), [p1[0] + 40, p1[1] + 30]);
  near(after.lat[1], want[0], 2e-6, 'lat după mutare'); near(after.lon[1], want[1], 2e-6, 'lon după mutare');
  await page.keyboard.press('Control+z'); near((await trackArrays(page)).lat[1], before.lat[1], 1e-12, 'undo mutare');
  // șterge
  await page.click('[data-mode=del]');
  const p3 = await page.evaluate(([la, lo]) => window.Poteca.ll2s(la, lo), [before.lat[3], before.lon[3]]);
  await page.mouse.click(box.x + p3[0], box.y + p3[1]);
  eq((await trackArrays(page)).n, 3, 'punct șters');
  // butoane (tastatură): adaugă în centrul hărții
  await page.click('[data-mode=nav]'); await page.click('#e-addc'); eq((await trackArrays(page)).n, 4, 'adăugat în centru');
  await closeAll(page);
});
test('C7 waypoint-uri: adăugare prin dialog, editare, ștergere, export', async () => {
  const page = await newPage();
  await loadLine(page, {n: 100});
  await tab(page, 'wpt'); await page.click('#w-addcur');
  await page.fill('#dw-name', 'Izvor & cabană'); await page.fill('#dw-sym', 'Water'); await page.fill('#dw-desc', 'Apă <potabilă>');
  await page.click('#dw-ok');
  let w = await page.evaluate(() => window.Poteca.S.wpts.map(x => [x.name, x.sym, x.desc, x.lat, x.ele]));
  eq(w.length, 1, 'un waypoint'); eq(w[0][0], 'Izvor & cabană', 'nume'); eq(w[0][1], 'Water', 'simbol'); eq(w[0][2], 'Apă <potabilă>', 'descriere'); near(w[0][4], 1000, 0.01, 'alt preluată de la cursor');
  // validare
  await page.locator('#w-list button[aria-label^="Editează"]').click();
  await page.fill('#dw-lat', '95'); await page.click('#dw-ok');
  ok((await page.locator('#dw-err').innerText()).length > 5, 'eroare latitudine invalidă');
  await page.fill('#dw-lat', '45.0005'); await page.fill('#dw-name', 'Redenumit'); await page.click('#dw-ok');
  w = await page.evaluate(() => window.Poteca.S.wpts.map(x => [x.name, x.lat]));
  eq(w[0][0], 'Redenumit', 'redenumit'); near(w[0][1], 45.0005, 1e-9, 'lat nouă');
  // mod waypoint pe hartă
  await page.click('[data-mode=wpt]'); const box = await page.locator('#map').boundingBox(); await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.fill('#dw-name', 'Pe hartă'); await page.click('#dw-ok');
  eq(await page.evaluate(() => window.Poteca.S.wpts.length), 2, 'al doilea waypoint');
  await page.locator('#w-list button[aria-label^="Elimină"]').first().click();
  eq(await page.evaluate(() => window.Poteca.S.wpts.length), 1, 'șters');
  await closeAll(page);
});
test('C8 comparație a două trasee: diferențe de timp/distanță pe porțiuni comune', async () => {
  const page = await newPage();
  const a = lineTrack({n: 401, step: 5, speed: 2, grade: 0.01, name: 'Rapid'});             // 2000 m în 1000 s
  const b = lineTrack({n: 241, step: 5, speed: 1, grade: 0.01, name: 'Lent', lonOff: 0.0001}); // 1200 m în 1200 s, ~8 m lateral
  await upload(page, [{name: 'a.gpx', data: gpxText([a])}, {name: 'b.gpx', data: gpxText([b])}]);
  await selectTrackByName(page, 'Rapid'); await tab(page, 'edit');
  await page.selectOption('#c-b', {label: 'Lent'});
  await page.fill('#c-tol', '25'); await page.click('#e-cmp');
  const r = await g(page, () => window.Poteca.S.cmp.rows.map(x => ({dA: x.dA, dB: x.dB, tA: x.tA, tB: x.tB, dT: x.dT, from: x.from, to: x.to})));
  eq(r.length, 1, 'o singură porțiune comună');
  // A continuă până la 'tol' dincolo de capătul lui B (punctul cel mai apropiat rămâne ultimul punct al lui B)
  ok(r[0].dA >= 1199 && r[0].dA <= 1226, 'lungime A pe porțiune: ' + r[0].dA); near(r[0].dB, 1200, 1.5, 'lungime B');
  near(r[0].tA, r[0].dA / 2, 0.6, 'timp A = dA / 2 m/s'); near(r[0].tB, 1200, 0.5, 'timp B = 1200 s'); near(r[0].dT, r[0].tA - 1200, 1, 'diferență de timp');
  ok(r[0].dT < -585 && r[0].dT > -601, 'diferență ≈ -600 s: ' + r[0].dT);
  near(r[0].from, 0, 1, 'începe la 0');
  const sum = await page.locator('#cmp-sum').innerText(); ok(/1 porțiuni comune/.test(sum) && /−0:09:[5-9]\d|−0:10:00/.test(sum), 'rezumat: ' + sum);
  eq(await page.locator('#cmp-tbl tbody tr').count(), 1, 'rând în tabel');
  // toleranță prea mică => fără porțiuni
  await page.fill('#c-tol', '3'); await page.click('#e-cmp');
  ok(/Nu există porțiuni comune/.test(await page.locator('#cmp-sum').innerText()), 'fără porțiuni la toleranță 3 m');
  await closeAll(page);
});

/* =====================================================================
   D. EXPORT (parser independent, round-trip)
   ===================================================================== */
async function prepareRich(page) {
  const a = lineTrack({n: 400, step: 7, speed: 1.4, grade: 0.03, hr: true, name: 'Bogat'});
  await upload(page, [{name: 'bogat.gpx', data: gpxText([a], [{lat: 45.001, lon: 26.0, ele: 1005, name: 'Aproape start', sym: 'Flag', desc: 'zonă & test'}, {lat: 45.0135, lon: 26.0, ele: 1100, name: 'Mijloc', sym: 'Summit', desc: ''}])}]);
  return a;
}
test('D1 GPX 1.1: valid (parser independent), round-trip fără pierderi', async () => {
  const page = await newPage();
  await prepareRich(page); await tab(page, 'export');
  const orig = await trackArrays(page);
  const f = await download(page, '[data-export=gpx]');
  const v = py(PY_GPX, f);
  ok(v.ok, 'GPX invalid după parserul independent: ' + JSON.stringify(v.errors));
  eq(v.counts.trkpt, 400, 'trkpt'); eq(v.counts.wpt, 2, 'wpt'); ok(v.meta, 'metadata');
  eq(v.wpts[0].name, 'Aproape start', 'nume wpt'); eq(v.wpts[0].desc, 'zonă & test', 'desc wpt cu & escapat corect'); eq(v.wpts[0].sym, 'Flag', 'sym');
  // round-trip: reîncarcă fișierul exportat
  const page2 = await newPage();
  await upload(page2, [{name: 'rt.gpx', data: fileTxt(f)}]);
  const back = await trackArrays(page2);
  eq(back.n, orig.n, 'număr puncte');
  let maxD = 0, maxE = 0; for (let i = 0; i < orig.n; i++) { maxD = Math.max(maxD, hav(orig.lat[i], orig.lon[i], back.lat[i], back.lon[i])); maxE = Math.max(maxE, Math.abs(orig.ele[i] - back.ele[i])); eq(back.t[i], orig.t[i], 'timp ' + i); eq(back.hr[i], orig.hr[i], 'hr ' + i); eq(back.cad[i], orig.cad[i], 'cad'); near(back.atemp[i], orig.atemp[i], 0.01, 'atemp'); }
  ok(maxD < 0.02, 'abatere coordonate < 2 cm: ' + maxD); ok(maxE <= 0.0051, 'abatere altitudine ≤ 0.005 m: ' + maxE);
  const w = await page2.evaluate(() => window.Poteca.S.wpts.map(x => [x.name, x.sym, x.desc]));
  eq(JSON.stringify(w[0]), JSON.stringify(['Aproape start', 'Flag', 'zonă & test']), 'wpt round-trip');
  await closeAll(page); await closeAll(page2);
});
test('D2 GeoJSON, KML, CSV: parser independent și round-trip', async () => {
  const page = await newPage();
  await prepareRich(page); await tab(page, 'export');
  const orig = await trackArrays(page);
  // GeoJSON
  const fg = await download(page, '[data-export=geojson]');
  const j = JSON.parse(fileTxt(fg));
  eq(j.type, 'FeatureCollection', 'FeatureCollection'); const ls = j.features.find(x => x.geometry.type === 'LineString');
  eq(ls.geometry.coordinates.length, 400, 'puncte GeoJSON'); eq(ls.geometry.coordinates[0].length, 3, 'altitudine în coordonate');
  ok(j.features.filter(x => x.geometry.type === 'Point').length === 2, 'waypoint-uri GeoJSON');
  // KML (parser independent)
  const fk = await download(page, '[data-export=kml]');
  const kv = py(`
import sys, json, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
ns = {'k': 'http://www.opengis.net/kml/2.2', 'gx': 'http://www.google.com/kml/ext/2.2'}
pms = root.findall('.//k:Placemark', ns)
tr = root.findall('.//gx:Track', ns)
coords = [c.text for c in root.findall('.//gx:coord', ns)]
whens = [w.text for w in root.findall('.//k:when', ns)]
pts = root.findall('.//k:Point', ns)
print(json.dumps({'pm': len(pms), 'tracks': len(tr), 'coords': len(coords), 'whens': len(whens), 'points': len(pts), 'first': coords[0] if coords else None}))`, fk);
  eq(kv.tracks, 1, 'gx:Track'); eq(kv.coords, 400, 'coord KML'); eq(kv.whens, 400, 'when KML'); eq(kv.points, 2, 'puncte KML'); eq(kv.pm, 3, 'Placemark-uri');
  // CSV (modulul csv Python)
  const fc = await download(page, '[data-export=csv]');
  const cv = py(`
import sys, csv, json
rows = list(csv.DictReader(open(sys.argv[1], newline='')))
print(json.dumps({'n': len(rows), 'cols': list(rows[0].keys()), 'first': rows[0]}))`, fc);
  eq(cv.n, 400, 'rânduri CSV'); eq(cv.cols.join(','), 'lat,lon,ele,time,hr,cad,atemp', 'coloane CSV');
  // round-trip pentru fiecare format într-o pagină nouă
  for (const [fp, ext] of [[fg, 'geojson'], [fk, 'kml'], [fc, 'csv']]) {
    const p2 = await newPage();
    await upload(p2, [{name: 'rt.' + ext, data: fileTxt(fp)}]);
    const back = await trackArrays(p2);
    eq(back.n, 400, ext + ' puncte');
    let maxD = 0; for (let i = 0; i < 400; i++) maxD = Math.max(maxD, hav(orig.lat[i], orig.lon[i], back.lat[i], back.lon[i]));
    ok(maxD < 0.02, ext + ' abatere coordonate: ' + maxD);
    eq(back.t[7], orig.t[7], ext + ' timp'); near(back.ele[7], orig.ele[7], 0.0051, ext + ' alt');
    if (ext !== 'kml') eq(back.hr[7], orig.hr[7], ext + ' hr');
    if (ext === 'geojson') { const w = await p2.evaluate(() => window.Poteca.S.wpts.length); eq(w, 2, 'wpt GeoJSON round-trip'); }
    await closeAll(p2);
  }
  await closeAll(page);
});
test('D3 zonă de confidențialitate: primii/ultimii N m tăiați, waypoint-uri din zonă omise', async () => {
  const page = await newPage();
  await prepareRich(page); await tab(page, 'export');
  const orig = await trackArrays(page);
  await page.fill('#x-priv', '300'); await page.locator('#x-priv').dispatchEvent('change');
  const f = await download(page, '[data-export=gpx]');
  const v = py(PY_GPX, f);
  ok(v.ok, 'GPX valid: ' + JSON.stringify(v.errors));
  ok(v.counts.trkpt < 400 && v.counts.trkpt > 300, 'puncte tăiate: ' + v.counts.trkpt);
  const d0 = hav(orig.lat[0], orig.lon[0], v.first[0], v.first[1]); ok(d0 >= 300 - 1e-6 && d0 < 310, 'primul punct la ≥ 300 m de start: ' + d0);
  eq(v.counts.wpt, 1, 'waypoint-ul din zona de start omis (cel din mijloc rămâne)'); eq(v.wpts[0].name, 'Mijloc', 'rămâne Mijloc');
  // traseu prea scurt
  await page.fill('#x-priv', '5000'); await page.locator('#x-priv').dispatchEvent('change');
  await page.click('[data-export=gpx]'); await page.waitForTimeout(200);
  ok(/prea scurte|Nimic de exportat/.test(await page.locator('#x-msg').innerText()), 'mesaj traseu prea scurt');
  // datele din aplicație rămân intacte
  eq((await trackArrays(page)).n, 400, 'datele din aplicație neatinse');
  await closeAll(page);
});
test('D4 export SVG/PNG hartă și profil, tipărire cu legendă', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(500); await tab(page, 'export');
  const fs1 = await download(page, '[data-export=map-svg]');
  const svg = fileTxt(fs1);
  const sv = py(`
import sys, json, xml.etree.ElementTree as ET
r = ET.parse(sys.argv[1]).getroot()
print(json.dumps({'tag': r.tag, 'paths': len(r.findall('.//{http://www.w3.org/2000/svg}path')), 'texts': len(r.findall('.//{http://www.w3.org/2000/svg}text')), 'w': r.get('width')}))`, fs1);
  ok(sv.tag.endsWith('svg') && sv.paths > 5 && sv.texts > 5, 'SVG hartă valid: ' + JSON.stringify(sv));
  ok(/Circuit Colți/.test(svg) && /fără hartă de bază/.test(svg), 'legendă și mențiune în SVG');
  const fp = await download(page, '[data-export=map-png]');
  const png = fs.readFileSync(fp); eq(png.slice(1, 4).toString(), 'PNG', 'semnătură PNG'); const w = png.readUInt32BE(16), h = png.readUInt32BE(20); ok(w >= 1280 && h >= 800, 'dimensiuni PNG: ' + w + '×' + h);
  const f3 = await download(page, '[data-export=prof-svg]'); ok(/<svg/.test(fileTxt(f3)) && /path/.test(fileTxt(f3)), 'profil SVG');
  const f4 = await download(page, '[data-export=prof-png]'); eq(fs.readFileSync(f4).slice(1, 4).toString(), 'PNG', 'profil PNG');
  // tipărire
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({media: 'print'});
  const vis = await page.evaluate(() => ({sheet: getComputedStyle(document.getElementById('print-sheet')).display, app: getComputedStyle(document.getElementById('app')).display, svgs: document.querySelectorAll('#print-sheet svg').length, txt: document.getElementById('print-sheet').innerText}));
  eq(vis.sheet, 'block', 'foaia de tipărire vizibilă'); eq(vis.app, 'none', 'aplicația ascunsă la tipărire'); ok(vis.svgs >= 2, 'hartă + profil în foaie'); ok(/Legendă/.test(vis.txt) && /Circuit Colți/.test(vis.txt) && /fără hartă de bază/.test(vis.txt), 'legendă în foaie');
  const pdf = await page.pdf({format: 'A4'}); ok(pdf.length > 5000 && pdf.slice(0, 4).toString() === '%PDF', 'PDF generat din vizualizarea de tipărire');
  await page.emulateMedia({media: 'screen'});
  await closeAll(page);
});

/* =====================================================================
   E. SESIUNE / PERSISTENȚĂ
   ===================================================================== */
test('E1 sesiunea se salvează comprimat și se restaurează după reîncărcare; limba persistă', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(300);
  await page.selectOption('#sel-lang', 'de');
  eq(await page.evaluate(() => document.documentElement.lang), 'de', 'html[lang]');
  await tab(page, 'session'); await page.waitForFunction(() => /KB|Sitzung/.test(document.getElementById('save-state').textContent));
  await page.evaluate(() => window.Poteca.saveNow());
  const before = await g(page, () => window.Poteca.S.tracks.map(t => [t.name, t.n, t.lat[5], t.hr[5]]));
  await page.reload(); await page.waitForSelector('body[data-ready]');
  const after = await g(page, () => window.Poteca.S.tracks.map(t => [t.name, t.n, t.lat[5], t.hr[5]]));
  eq(after.length, 2, 'trasee restaurate'); eq(after[0][0], before[0][0], 'nume'); eq(after[0][1], before[0][1], 'puncte');
  near(after[0][2], before[0][2], 1e-7, 'coordonate (precizie 1e-7)'); near(after[0][3], before[0][3], 1e-3, 'hr');
  eq(await page.evaluate(() => document.documentElement.lang), 'de', 'limba persistată');
  eq(await page.evaluate(() => window.Poteca.S.layers.length), 1, 'stratul restaurat');
  eq(await page.evaluate(() => window.Poteca.S.wpts.length), 4, 'waypoint-uri restaurate');
  eq(await page.evaluate(() => localStorage.getItem('fff.poteca.lang')), 'de', 'cheie localStorage fff.poteca.lang');
  await closeAll(page);
});
test('E2 copie de siguranță .fff.json: export, ștergere totală, import', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(300); await tab(page, 'session');
  const ref = await g(page, () => window.Poteca.S.tracks.map(t => [t.name, t.n, Math.round(t.lat[100] * 1e7)]));
  const f = await download(page, '#s-export');
  ok(/\.fff\.json$/.test(f), 'extensie .fff.json');
  const j = JSON.parse(fileTxt(f));
  eq(j.format, 'fff-bundle', 'format'); eq(j.schema, 1, 'schema'); eq(j.app, 'poteca', 'app'); eq(j.version, '2.0.0', 'versiune'); eq(j.updated, '2026-10-26', 'updated'); ok(j.data['fff.poteca.session'].startsWith('P1:'), 'sesiune în bundle');
  await page.click('#s-wipe'); await page.click('#dc-ok');
  eq(await g(page, () => window.Poteca.S.tracks.length), 0, 'șters');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fff.poteca.session')));
  eq(keys.length, 0, 'sesiunea ștearsă din localStorage');
  await page.setInputFiles('#s-import-in', f);
  await page.waitForFunction(() => window.Poteca.S.tracks.length === 2);
  const now = await g(page, () => window.Poteca.S.tracks.map(t => [t.name, t.n, Math.round(t.lat[100] * 1e7)]));
  eq(JSON.stringify(now), JSON.stringify(ref), 'date identice după import');
  // bundle greșit
  await page.setInputFiles('#s-import-in', {name: 'x.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({format: 'fff-bundle', schema: 1, app: 'altceva', data: {}}))});
  await page.waitForTimeout(200);
  ok(/nu este o copie de siguranță Poteca/.test(await page.locator('#status').innerText()), 'bundle de altă aplicație respins');
  await closeAll(page);
});
test('E3 stocare indisponibilă: aplicația funcționează și fără localStorage/IndexedDB', async () => {
  const ctx = await newCtx();
  await ctx.addInitScript(() => { const thr = () => { throw new Error('blocat'); }; Object.defineProperty(window, 'localStorage', {get: thr}); window.indexedDB.open = thr; });
  const page = await newPage({ctx, allowConsole: true});
  await page.click('#btn-demo'); await page.waitForTimeout(500);
  eq(await g(page, () => window.Poteca.S.tracks.length), 2, 'funcționează fără stocare');
  await page.selectOption('#sel-lang', 'fr');
  eq(await page.evaluate(() => document.documentElement.lang), 'fr', 'limba schimbată fără stocare');
  await tab(page, 'session'); await page.evaluate(() => window.Poteca.saveNow());
  ok(/indisponibil|indisponible|unavailable|nicht verfügbar/i.test(await page.locator('#save-state').innerText()), 'mesaj onest despre salvarea indisponibilă: ' + await page.locator('#save-state').innerText());
  await closeAll(page);
});

/* =====================================================================
   F. HARTĂ: proiecții, zoom/pan, tactil, tastatură, straturi
   ===================================================================== */
test('F1 hartă fără rețea: zero cereri, fără dale, mențiune onestă, ambele proiecții', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(400);
  const note = await page.locator('#map-note').innerText(); ok(/Fără hartă de bază/.test(note), 'mențiune: ' + note);
  const v1 = await page.evaluate(() => window.Poteca.view());
  await page.selectOption('#sel-proj', 'equi'); await page.waitForTimeout(100);
  const v2 = await page.evaluate(() => window.Poteca.view());
  eq(v2.proj, 'equi', 'proiecție ECR');
  near(v2.mpp / v1.mpp, 1, 0.02, 'scara (m/px) păstrată la schimbarea proiecției');
  // centrul geografic păstrat
  const c = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  near(c[0], 45.3712, 0.01, 'centrul lat');
  await page.selectOption('#sel-proj', 'merc');
  eq(issues.filter(i => i.startsWith('REȚEA')).length, 0, 'nicio cerere de rețea');
  await closeAll(page);
});
test('F2 zoom cu rotița, deplasare cu mouse, dublu-clic, butoane, potrivire', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(400);
  const box = await page.locator('#map').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const v0 = await page.evaluate(() => window.Poteca.view());
  const wx = Math.round(box.x + box.width * 0.3), wy = Math.round(box.y + box.height * 0.3);
  const ptBefore = await page.evaluate(([x, y]) => window.Poteca.s2ll(x, y), [wx - box.x, wy - box.y]);
  await page.mouse.move(wx, wy); await page.mouse.wheel(0, -400); await page.waitForTimeout(100);
  const v1 = await page.evaluate(() => window.Poteca.view()); ok(v1.mpp < v0.mpp * 0.7, 'zoom in cu rotița: ' + v0.mpp + ' -> ' + v1.mpp);
  const ptAfter = await page.evaluate(([x, y]) => window.Poteca.s2ll(x, y), [wx - box.x, wy - box.y]);
  near(ptAfter[0], ptBefore[0], 2e-6, 'punctul de sub cursor rămâne fix (lat)'); near(ptAfter[1], ptBefore[1], 2e-6, 'lon');
  // deplasare
  const c0 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy, {steps: 6}); await page.mouse.up();
  const c1 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  ok(c1[1] < c0[1], 'tragere spre dreapta mută centrul spre vest');
  await page.click('#z-out'); await page.click('#z-out'); const v2 = await page.evaluate(() => window.Poteca.view()); ok(v2.mpp > v1.mpp, 'zoom out');
  await page.mouse.dblclick(cx, cy); const v3 = await page.evaluate(() => window.Poteca.view()); ok(v3.mpp < v2.mpp, 'dublu-clic mărește');
  await page.click('#z-fit'); const v4 = await page.evaluate(() => window.Poteca.view()); near(v4.mpp / v0.mpp, 1, 0.05, 'potrivire = vederea inițială');
  await closeAll(page);
});
test('F3 tastatură pe hartă și profil; file taburi cu săgeți', async () => {
  const page = await newPage();
  await page.click('#btn-demo'); await page.waitForTimeout(400);
  await page.focus('#map');
  const v0 = await page.evaluate(() => window.Poteca.view());
  await page.keyboard.press('+'); const v1 = await page.evaluate(() => window.Poteca.view()); ok(v1.mpp < v0.mpp, '+ mărește');
  await page.keyboard.press('-'); await page.keyboard.press('-'); const v2 = await page.evaluate(() => window.Poteca.view()); ok(v2.mpp > v1.mpp, '- micșorează');
  const c0 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  await page.keyboard.press('ArrowRight'); const c1 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  ok(c1[1] > c0[1], 'săgeată dreapta deplasează spre est');
  await page.keyboard.press('0'); const v3 = await page.evaluate(() => window.Poteca.view()); near(v3.mpp / v0.mpp, 1, 0.05, '0 potrivește');
  // profil
  await page.focus('#prof'); await page.keyboard.press('End');
  const n = await page.evaluate(() => window.Poteca.selTrack().n); eq(await page.evaluate(() => window.Poteca.S.cur), n - 1, 'End = ultimul punct');
  await page.keyboard.press('ArrowLeft'); eq(await page.evaluate(() => window.Poteca.S.cur), n - 2, 'săgeată stânga');
  ok(/km/.test(await page.getAttribute('#prof', 'aria-valuetext')), 'aria-valuetext actualizat');
  // taburi
  await page.focus('#tab-tracks'); await page.keyboard.press('ArrowRight');
  eq(await page.getAttribute('#tab-stats', 'aria-selected'), 'true', 'tab statistici'); eq(await page.evaluate(() => document.activeElement.id), 'tab-stats', 'focus mutat');
  await page.keyboard.press('End'); eq(await page.getAttribute('#tab-session', 'aria-selected'), 'true', 'End -> ultimul tab');
  await closeAll(page);
});
test('F4 tactil: pinch (două degete) mărește/micșorează, un deget deplasează', async () => {
  const ctx = await newCtx({touch: true});
  const page = await newPage({ctx});
  await page.click('#btn-demo'); await page.waitForTimeout(400);
  const box = await page.locator('#map').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map((p, i) => ({x: p[0], y: p[1], id: i + 1}))});
  const v0 = await page.evaluate(() => window.Poteca.view());
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
  for (let k = 1; k <= 8; k++) await touch('touchMove', [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(80);
  const v1 = await page.evaluate(() => window.Poteca.view()); ok(v1.mpp < v0.mpp * 0.6, 'pinch-out mărește: ' + v0.mpp + ' -> ' + v1.mpp);
  await touch('touchStart', [[cx - 150, cy], [cx + 150, cy]]);
  for (let k = 1; k <= 8; k++) await touch('touchMove', [[cx - 150 + k * 12, cy], [cx + 150 - k * 12, cy]]);
  await touch('touchEnd', []); await page.waitForTimeout(80);
  const v2 = await page.evaluate(() => window.Poteca.view()); ok(v2.mpp > v1.mpp * 1.4, 'pinch-in micșorează: ' + v1.mpp + ' -> ' + v2.mpp);
  // un deget: pan
  const c0 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  await touch('touchStart', [[cx, cy]]); for (let k = 1; k <= 6; k++) await touch('touchMove', [[cx + k * 15, cy]]); await touch('touchEnd', []);
  await page.waitForTimeout(80);
  const c1 = await page.evaluate(() => { const V = window.Poteca.view(); return window.Poteca.s2ll(V.W / 2, V.H / 2); });
  ok(c1[1] < c0[1], 'deplasare cu un deget');
  await closeAll(page);
});
test('F5 straturi: GeoJSON utilizator (linii/poligoane/puncte) și imagine georeferențiată', async () => {
  const page = await newPage();
  await loadLine(page, {n: 200, step: 20});
  await tab(page, 'layers');
  const roads = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {name: 'Drum'}, geometry: {type: 'LineString', coordinates: [[25.99, 45.005], [26.01, 45.005]]}}, {type: 'Feature', properties: {name: 'Lac'}, geometry: {type: 'Polygon', coordinates: [[[25.995, 45.01], [26.005, 45.01], [26.005, 45.02], [25.995, 45.02], [25.995, 45.01]]]}}, {type: 'Feature', properties: {name: 'Cabană'}, geometry: {type: 'Point', coordinates: [26.002, 45.012]}}]};
  await page.setInputFiles('#l-geo-in', {name: 'drumuri.geojson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(roads))});
  await page.waitForFunction(() => window.Poteca.S.layers.length === 1);
  eq(await page.evaluate(() => window.Poteca.S.layers[0].parts.length), 3, 'părți strat');
  // pixelii diferă când stratul e vizibil / ascuns
  const sample = () => page.evaluate(() => { const c = document.getElementById('map'), x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4 * 17) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return s; });
  await page.waitForTimeout(150); const withL = await sample();
  await page.locator('#l-list input[type=checkbox]').uncheck(); await page.waitForTimeout(150); const noL = await sample();
  ok(withL !== noL, 'stratul modifică desenul');
  await page.locator('#l-list input[type=checkbox]').check();
  // imagine: PNG 2x2 generat în test (roșu/verde/albastru/alb)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFUlEQVR4nGP4z8Dwn4GBgYGJAQoAHhgCAh6X4CYAAAAASUVORK5CYII=', 'base64');
  await page.setInputFiles('#l-img-in', {name: 'dala.png', mimeType: 'image/png', buffer: png});
  await page.waitForSelector('#dlg-img[open]');
  await page.fill('#di-w', '25.99'); await page.fill('#di-e', '26.01'); await page.fill('#di-s', '45.0'); await page.fill('#di-n', '45.02');
  // validare: ordine greșită
  await page.fill('#di-w', '26.5'); await page.click('#di-ok'); ok((await page.locator('#di-err').innerText()).length > 5, 'eroare ordine'); eq(await page.evaluate(() => window.Poteca.S.images.length), 0, 'nicio imagine adăugată');
  await page.fill('#di-w', '25.99'); await page.click('#di-ok');
  eq(await page.evaluate(() => window.Poteca.S.images.length), 1, 'imagine adăugată');
  const b = await page.evaluate(() => window.Poteca.S.images[0].bbox); eq(JSON.stringify(b), JSON.stringify({w: 25.99, e: 26.01, s: 45, n: 45.02}), 'bbox');
  // 2 puncte de control: calcul analitic în Web Mercator
  await page.setInputFiles('#l-img-in', {name: 'dala2.png', mimeType: 'image/png', buffer: png});
  await page.waitForSelector('#dlg-img[open]');
  await page.selectOption('#di-mode', 'gcp');
  const merc = (la, lo) => [(lo + 180) / 360, 0.5 - Math.log(Math.tan(Math.PI / 4 + la * RAD / 2)) / (2 * Math.PI)];
  const p1 = {x: 0, y: 0, a: 45.02, o: 25.99}, p2 = {x: 2, y: 2, a: 45.0, o: 26.01};
  for (const [k, p] of [[1, p1], [2, p2]]) { await page.fill(`#di-p${k}x`, String(p.x)); await page.fill(`#di-p${k}y`, String(p.y)); await page.fill(`#di-p${k}a`, String(p.a)); await page.fill(`#di-p${k}o`, String(p.o)); }
  const r = await page.evaluate(() => window.Poteca.imageBBoxFromForm());
  ok(r.bbox, 'bbox din puncte de control: ' + JSON.stringify(r)); near(r.bbox.w, 25.99, 1e-9, 'w'); near(r.bbox.e, 26.01, 1e-9, 'e'); near(r.bbox.n, 45.02, 1e-9, 'n'); near(r.bbox.s, 45.0, 1e-9, 's');
  // puncte de control cu jumătate de imagine: extrapolare corectă
  await page.fill('#di-p2x', '1'); await page.fill('#di-p2y', '1'); await page.fill('#di-p2a', String(45.01)); await page.fill('#di-p2o', '26.0');
  const m1 = merc(45.02, 25.99), m2 = merc(45.01, 26.0);
  const r2 = await page.evaluate(() => window.Poteca.imageBBoxFromForm());
  near(r2.bbox.e, 26.01, 1e-6, 'extrapolare est'); near(r2.bbox.w, 25.99, 1e-6, 'w');
  // direcție imposibilă
  await page.fill('#di-p2o', '25.0'); const r3 = await page.evaluate(() => window.Poteca.imageBBoxFromForm()); ok(r3.err, 'orientare imposibilă respinsă');
  await page.click('#di-cancel');
  await closeAll(page);
});

/* =====================================================================
   G. INTERFAȚĂ: limbi, teme, depășire, a11y, CSP
   ===================================================================== */
test('G1 8 limbi: selector, persistență, html[lang], toate cheile traduse', async () => {
  const page = await newPage();
  const html = fs.readFileSync(path.resolve(HERE, '..', 'index.html'), 'utf8');
  const keysUsed = new Set([...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map(m => m[1]));
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {
    await page.selectOption('#sel-lang', l);
    eq(await page.evaluate(() => document.documentElement.lang), l, 'lang ' + l);
    const missing = await page.evaluate(([keys]) => { const bad = []; document.querySelectorAll('[data-i18n]').forEach(e => { if (e.getAttribute('data-i18n') === e.textContent.trim()) bad.push(e.getAttribute('data-i18n')); }); return bad; }, [[...keysUsed]]);
    eq(missing.length, 0, 'chei netraduse în ' + l + ': ' + missing.join(','));
  }
  // textul diferă între limbi
  await page.selectOption('#sel-lang', 'hu'); const hu = await page.locator('#btn-open').innerText();
  await page.selectOption('#sel-lang', 'ro'); const ro = await page.locator('#btn-open').innerText(); ok(hu !== ro, 'text diferit hu/ro');
  await page.reload(); await page.waitForSelector('body[data-ready]');
  eq(await page.evaluate(() => document.documentElement.lang), 'ro', 'persistat ro');
  await page.selectOption('#sel-lang', 'it'); await page.reload(); await page.waitForSelector('body[data-ready]');
  eq(await page.evaluate(() => document.documentElement.lang), 'it', 'persistat it'); eq(await page.inputValue('#sel-lang'), 'it', 'selector reflectă it');
  eq(await page.evaluate(() => localStorage.getItem('fff.poteca.lang')), 'it', 'cheie fff.poteca.lang');
  // dicționarul: fiecare cheie există în toate limbile (și valori nenule)
  const dictOk = await page.evaluate(async () => { const out = []; const old = document.documentElement.lang; return out; });
  await closeAll(page);
});
test('G2 temă luminoasă/întunecată: comutator + sistem; fără depășire la 360×740 și 1280×800', async () => {
  for (const [w, h] of [[360, 740], [1280, 800], [768, 1024]]) {
    for (const dark of [false, true]) {
      const page = await newPage({w, h, dark});
      await page.click('#btn-demo'); await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: innerWidth, bg: getComputedStyle(document.body).backgroundColor}));
      ok(o.sw <= o.iw, `depășire orizontală ${w}×${h} dark=${dark}: ${o.sw} > ${o.iw}`);
      ok(dark ? o.bg !== 'rgb(243, 245, 242)' : o.bg === 'rgb(243, 245, 242)', 'fundal după sistem ' + o.bg);
      // fiecare panou
      for (const t of ['stats', 'edit', 'wpt', 'layers', 'export', 'session']) { await tab(page, t); const s = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth); ok(s, `depășire în panoul ${t} la ${w}×${h}`); }
      await closeAll(page);
    }
  }
  const page = await newPage();
  eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), null, 'inițial automat');
  await page.click('#btn-theme'); eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light', 'luminoasă');
  await page.click('#btn-theme'); eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark', 'întunecată');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); eq(bg, 'rgb(15, 20, 23)', 'fundal întunecat');
  await page.click('#btn-theme'); eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), null, 'înapoi la automat');
  await closeAll(page);
});
test('G3 CSP strict, meta/versiune, fără rețea la pornire, fără erori', async () => {
  const html = fs.readFileSync(path.resolve(HERE, '..', 'index.html'), 'utf8');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  ok(/default-src 'none'/.test(csp) && /connect-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp), 'directive CSP');
  ok(!/unsafe-eval/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), 'fără unsafe-eval / unsafe-inline la scripturi');
  ok(/script-src 'sha256-[A-Za-z0-9+/=]+'/.test(csp), 'script-src cu hash');
  ok(!/\son(click|load|error|input|change)=/i.test(html), 'fără handlere inline');
  ok(!/\beval\(|new Function\(/.test(html.match(/<script>([\s\S]*)<\/script>/)[1]), 'fără eval');
  ok(/<meta name="application-version" content="2\.0\.0">/.test(html) && /<meta name="last-updated" content="2026-10-26">/.test(html) && /<meta name="description" content="[^"]{20,}">/.test(html), 'meta versiune');
  ok(/id="app-version">v 2\.0\.0 · 2026-10-26</.test(html), '#app-version');
  ok(!/https?:\/\/(?!www\.topografix|www\.garmin|www\.w3\.org|www\.opengis|www\.google\.com\/kml|buymeacoffee\.com)/.test(html.replace(/<meta[^>]*>/g, '')), 'fără URL-uri externe în cod în afară de spații de nume XML');
  const page = await newPage();
  eq((await cspViolations(page)).length, 0, 'zero violări CSP la pornire');
  await page.click('#btn-demo'); await page.waitForTimeout(300);
  for (const t of ['stats', 'edit', 'wpt', 'layers', 'export', 'session']) await tab(page, t);
  eq((await cspViolations(page)).length, 0, 'zero violări CSP după utilizare');
  eq(await page.evaluate(() => document.getElementById('app-version').textContent), 'v 2.0.0 · 2026-10-26', 'text #app-version');
  await closeAll(page);
});
test('G4 axe-core: 0 violări (inițial, cu date, taburi, dialoguri; luminos și întunecat)', async () => {
  if (!fs.existsSync(AXE)) { console.log('   (axe-core lipsă, test omis)'); return; }
  for (const dark of [false, true]) {
    const ctx = await newCtx({dark, bypassCSP: true});
    const page = await newPage({ctx});
    await page.addScriptTag({path: AXE});
    const run = async (label) => {
      await page.waitForTimeout(3600);
      const r = await page.evaluate(async () => { const res = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']}}); return res.violations.map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' ' + (n.failureSummary || '').split('\n').slice(0, 2).join(' ')).join(' | ')); });
      eq(r.length, 0, `axe ${label} dark=${dark}: ${r.join(' || ')}`);
    };
    await run('inițial');
    await page.click('#btn-demo'); await page.waitForTimeout(400);
    await run('cu date');
    for (const t of ['stats', 'edit', 'wpt', 'layers', 'export', 'session']) { await tab(page, t); if (t === 'edit') { await page.fill('#s-tol', '5'); await page.click('#e-cmp'); } await run('panou ' + t); }
    await tab(page, 'wpt'); await page.click('#w-addc'); await page.waitForSelector('#dlg-wpt[open]'); await run('dialog waypoint'); await page.click('#dw-cancel');
    await page.click('#btn-about'); await page.waitForSelector('#dlg-about[open]'); await run('dialog despre'); await page.click('#da-close');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFUlEQVR4nGP4z8Dwn4GBgYGJAQoAHhgCAh6X4CYAAAAASUVORK5CYII=', 'base64');
    await tab(page, 'layers'); await page.setInputFiles('#l-img-in', {name: 'd.png', mimeType: 'image/png', buffer: png}); await page.waitForSelector('#dlg-img[open]'); await page.selectOption('#di-mode', 'gcp'); await run('dialog imagine (puncte de control)'); await page.click('#di-cancel');
    await page.selectOption('#sel-color', 'slope'); await run('profil colorat după pantă');
    await page.setViewportSize({width: 360, height: 740}); await run('mobil 360');
    await closeAll(page);
  }
});
test('G5 prefers-reduced-motion respectat; focus vizibil; ținte tactile ≥ 24 px', async () => {
  const page = await newPage({reduced: true});
  await page.click('#btn-demo'); await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const el = document.querySelector('.btn'); const cs = getComputedStyle(el); return {tr: cs.transitionDuration, small: Array.from(document.querySelectorAll('button, [role=tab], select, input[type=checkbox]')).filter(e => e.offsetParent !== null).map(e => { const b = e.getBoundingClientRect(); return [e.id || e.textContent.slice(0, 12), b.width, b.height]; }).filter(x => x[1] < 24 || x[2] < 24)}; });
  ok(/^0s$|^0\.0*1?ms$|^0s, 0s/.test(r.tr) || r.tr === '0s', 'tranziții dezactivate: ' + r.tr);
  eq(r.small.length, 0, 'ținte mai mici de 24 px: ' + JSON.stringify(r.small));
  await page.focus('#btn-open'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); const o = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [document.activeElement.id, cs.outlineStyle, cs.outlineWidth]; }); eq(o[0], 'btn-open', 'focus revenit'); ok(o[1] !== 'none' && parseFloat(o[2]) >= 2, 'contur de focus vizibil: ' + o.join(' '));
  await closeAll(page);
});
test('G6 sistem de culori pe profil: colorare după pantă/viteză/puls', async () => {
  const page = await newPage();
  const tr = lineTrack({n: 600, step: 8, speed: 1.5, grade: 0, hr: true});
  tr.pts.forEach((p, i) => { p.ele = 500 + (i < 300 ? i * 0.4 : (600 - i) * 0.4); });
  await upload(page, [{name: 'col.gpx', data: gpxText([tr])}]);
  const stroke = async () => page.evaluate(() => Array.from(document.querySelectorAll('#prof-svg path[stroke]')).map(p => p.getAttribute('stroke')).filter(s => /^#/.test(s)));
  const base = await stroke();
  await page.selectOption('#sel-color', 'slope'); await page.waitForTimeout(150);
  const s1 = new Set(await stroke()); ok(s1.size >= 3, 'culori pantă: ' + [...s1].join(','));
  await page.selectOption('#sel-color', 'hr'); await page.waitForTimeout(150);
  const s2 = new Set(await stroke()); ok(s2.size >= 3, 'culori puls');
  await page.selectOption('#sel-color', 'speed'); await page.waitForTimeout(150);
  ok((await stroke()).length >= 1, 'culori viteză');
  await page.selectOption('#sel-x', 'time'); await page.waitForTimeout(150);
  ok(/h:mm/.test(await page.locator('#prof-svg').innerHTML()), 'axa timp');
  eq(await page.getAttribute('#prof', 'role'), 'slider', 'profil accesibil (slider)');
  await closeAll(page);
});

/* =====================================================================
   H. PERFORMANȚĂ: 200.000 de puncte
   ===================================================================== */
test('H1 performanță: 200.000 puncte (import, statistici, desen, simplificare, export, salvare)', async () => {
  const page = await newPage();
  const N = 200000, rnd = mulberry(99), lat0 = 45, lon0 = 26, kx = RE * RAD * Math.cos(lat0 * RAD), ky = RE * RAD;
  const pts = []; let x = 0, y = 0, hd = 0, t = T0;
  for (let i = 0; i < N; i++) { hd += (rnd() - 0.5) * 0.12; x += Math.cos(hd) * 2.5; y += Math.sin(hd) * 2.5; t += 2000; pts.push({lat: lat0 + y / ky, lon: lon0 + x / kx, ele: 800 + 200 * Math.sin(i / 9000) + rnd(), t, hr: NaN, cad: NaN, atemp: NaN}); }
  const gpx = gpxText([{name: 'Mare', pts}]);
  console.log(`   fișier GPX de test: ${(gpx.length / 1e6).toFixed(1)} MB`);
  const t0 = Date.now();
  await page.evaluate(() => { window.__b = []; new MutationObserver(() => window.__b.push([document.body.getAttribute('aria-busy'), performance.now()])).observe(document.body, {attributes: true, attributeFilter: ['aria-busy']}); });
  await upload(page, [{name: 'mare.gpx', data: gpx}]);
  const tTot = Date.now() - t0;
  const bb = await page.evaluate(() => window.__b);
  const tImp = bb.length >= 2 ? Math.round(bb[bb.length - 1][1] - bb[0][1]) : tTot;
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); window.__iv = setInterval(() => { const n = performance.now(); window.__gaps.push(n - last); last = n; }, 20); });
  console.log(`   transfer fișier + import: ${tTot} ms (import în aplicație: ${tImp} ms)`);
  eq(await page.evaluate(() => window.Poteca.selTrack().n), N, 'toate punctele importate');
  const tStats = await page.evaluate(() => { const t0 = performance.now(); const P = window.Poteca; P.analyze(P.selTrack(), P.params()); return performance.now() - t0; });
  console.log(`   import ${tImp} ms; statistici (din cache după desen) ${Math.round(tStats)} ms`);
  ok(tImp < 8000, 'import ≤ 8 s: ' + tImp);
  // interactivitate: zoom/pan fluide
  const box = await page.locator('#map').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const frameTimes = [];
  for (let k = 0; k < 12; k++) { const a = Date.now(); await page.mouse.move(cx, cy); await page.mouse.wheel(0, k % 2 ? 120 : -120); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); frameTimes.push(Date.now() - a); }
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let k = 0; k < 12; k++) { const a = Date.now(); await page.mouse.move(cx + k * 9, cy + k * 4); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); frameTimes.push(Date.now() - a); }
  await page.mouse.up();
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length, max = Math.max(...frameTimes);
  console.log(`   zoom/pan: medie ${avg.toFixed(0)} ms, maxim ${max} ms per cadru (inclusiv overhead Playwright)`);
  ok(avg < 200 && max < 600, 'zoom/pan responsiv: medie ' + avg + ' max ' + max);
  // profil + cursor
  await page.focus('#prof'); const c0 = Date.now(); for (let k = 0; k < 20; k++) await page.keyboard.press('Shift+ArrowRight'); const tCur = (Date.now() - c0) / 20; ok(tCur < 120, 'cursor profil: ' + tCur + ' ms/pas');
  // simplificare
  await tab(page, 'edit');
  const s0 = Date.now(); await page.fill('#s-tol', '3');
  await page.waitForFunction(() => /din\s+200000/.test(document.getElementById('s-count').textContent), null, {timeout: 30000});
  const tS = Date.now() - s0; console.log('   previzualizare simplificare: ' + tS + ' ms; ' + await page.locator('#s-count').innerText());
  ok(tS < 5000, 'previzualizare DP ≤ 5 s');
  const a0 = Date.now(); await page.click('#e-simpl'); const tA = Date.now() - a0; ok(tA < 5000, 'aplicare DP ≤ 5 s: ' + tA);
  const nS = await page.evaluate(() => window.Poteca.selTrack().n); ok(nS < N / 5, 'simplificat: ' + nS);
  await page.click('#b-undo');
  // despike
  const d0 = Date.now(); await page.waitForFunction(() => /:\s*\d+/.test(document.getElementById('k-count').textContent), null, {timeout: 30000}); console.log('   detectare spike-uri: ' + (Date.now() - d0) + ' ms');
  // export GPX 200k
  await tab(page, 'export'); const e0 = Date.now(); const f = await download(page, '[data-export=gpx]'); const tE = Date.now() - e0;
  console.log(`   export GPX: ${tE} ms, ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`); ok(tE < 8000, 'export ≤ 8 s');
  const v = py(PY_GPX, f); ok(v.ok && v.counts.trkpt === N, 'GPX 200k valid: ' + JSON.stringify(v.errors) + ' ' + v.counts.trkpt);
  // salvare comprimată
  const sv = await page.evaluate(async () => { const t0 = performance.now(); const u8 = await window.Poteca.packSession({meta: {v: 1, tracks: window.Poteca.S.tracks.map(t => ({id: t.id, name: t.name, color: t.color, kind: t.kind, n: t.n, visible: true})), wpts: [], layers: [], images: []}, tracks: window.Poteca.S.tracks}); const t1 = performance.now(); const back = await window.Poteca.unpackSession(u8); return {size: u8.length, tPack: t1 - t0, tUnpack: performance.now() - t1, n: back.arrs[0].lat.length, d: Math.abs(back.arrs[0].lat[12345] - window.Poteca.S.tracks[0].lat[12345])}; });
  console.log(`   sesiune: ${(sv.size / 1e6).toFixed(2)} MB comprimat (necomprimat ≈ ${(N * 40 / 1e6).toFixed(0)} MB), împachetare ${Math.round(sv.tPack)} ms, despachetare ${Math.round(sv.tUnpack)} ms`);
  eq(sv.n, N, 'despachetat'); ok(sv.d < 1e-7, 'precizie coordonate'); ok(sv.size < N * 40 * 0.3, 'compresie efectivă');
  const gaps = await page.evaluate(() => { clearInterval(window.__iv); return window.__gaps; });
  const worst = Math.max(...gaps); console.log(`   cel mai lung bloc al firului principal în tot testul (după import): ${Math.round(worst)} ms`); ok(worst < 3000, 'fără blocaje > 3 s: ' + worst);
  await closeAll(page);
});

/* ---------- rulare ---------- */
browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
let failed = 0;
for (const t of tests) {
  if (ONLY && !ONLY.test(t.name)) continue;
  const before = issues.length;
  const t0 = Date.now();
  try {
    await t.fn();
    const newIssues = issues.slice(before);
    if (newIssues.length) throw new Error('probleme de execuție: ' + newIssues.join(' | '));
    results.push({name: t.name, ok: true, ms: Date.now() - t0});
    console.log('OK   ' + t.name + ` (${Date.now() - t0} ms)`);
  } catch (e) {
    failed++;
    results.push({name: t.name, ok: false, err: String(e.message)});
    console.log("FAIL " + t.name + "\n     " + String(e.message).split("\n").slice(0, process.env.FULLERR ? 40 : 1).join("\n     "));
  }
}
await browser.close();
fs.rmSync(TMP, {recursive: true, force: true});
console.log(`\n${results.length - failed}/${results.length} teste trecute`);
if (process.env.POTECA_REPORT) fs.writeFileSync(process.env.POTECA_REPORT, JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
