// Teste Bolta 2.0 — Cer în timp: previziune locală (conjuncții, ocultații), traiectorie, noaptea derulată.
// Rulare: node tests/forecast.test.mjs   (Playwright, Chromium headless, rețea blocată; opțional AXE_PATH/FFF_AXE)
import {createRequire as __cr} from 'module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
const require = __cr(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const APP = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;
const AXE = process.env.AXE_PATH || process.env.FFF_AXE;
const results = [];
async function T(name, fn) {
  try { await fn(); results.push([name, true]); console.log('ok   ' + name); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''} așteptat ${b} ± ${tol}, obținut ${a}`);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
async function open(o = {}) {
  const ctx = await browser.newContext({viewport: {width: o.w || 1280, height: o.h || 800}, locale: 'ro-RO', colorScheme: o.scheme || 'dark', bypassCSP: !!o.bypassCSP, acceptDownloads: true});
  const bad = [];
  await ctx.route(/^https?:/, r => { bad.push('REȚEA ' + r.request().url()); r.abort(); });
  const p = await ctx.newPage(); p.ctx = ctx; p.bad = bad;
  p.on('pageerror', e => bad.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  await p.goto(APP + (o.hash || '')); await p.waitForFunction(h => window.__bolta && (h || window.__bolta.FR.ok), !!o.hash);
  return p;
}
const done = async p => { assert.deepEqual(p.bad, []); assert.deepEqual(await p.evaluate(() => window.__csp), []); await p.ctx.close(); };

await T('motor: ocultații și conjuncții locale coerente (Reykjavik, Pleiadele 28.10.2026)', async () => {
  const p = await open();
  const r = await p.evaluate(async () => {
    const B = window.__bolta, E = B.E;
    B.applyPlace({name: 'Reykjavik', lat: 64.15, lon: -21.94, elev: 0, tz: 'Atlantic/Reykjavik'});
    const jd0 = E.jdFromCalendar(2026, 10, 27, 0), jd1 = E.jdFromCalendar(2026, 10, 30, 0);
    const evs = await B.scanLocal(jd0, jd1, {moonp: true, moons: true, pp: false, thr: 3, mag: 4, vis: 'all'}, () => {});
    const occ = evs.filter(e => e.key === 'locc');
    const chk = occ.map(e => {
      const m1 = E.observe('moon', e.ing, 64.15, -21.94, 0), m2 = E.observe('moon', e.egr, 64.15, -21.94, 0);
      return {title: B.evTitle(e), dur: (e.egr - e.ing) * 1440, ok: e.ing < e.jd && e.jd < e.egr && e.sep < e.lim, limb: e.limb};
    });
    const mo = E.moon(E.jdFromCalendar(2026, 10, 28, 0, 50)), alc = B.ST.list.find(s => s.en === 'Alcyone');
    const q = E.starPosition(alc.ra, alc.dec, alc.pmRa, alc.pmDec, E.jdFromCalendar(2026, 10, 28, 0, 50));
    const dra = (mo.ra - q.ra) * Math.cos(q.dec * Math.PI / 180), ddec = mo.dec - q.dec;
    return {n: evs.length, chk, sorted: evs.every((e, i) => !i || evs[i - 1].jd <= e.jd), moonToAlcyone: Math.hypot(dra, ddec), keys: [...new Set(evs.map(e => e.key))]};
  });
  assert.ok(r.sorted); assert.ok(r.chk.length >= 2, 'ocultații găsite: ' + r.chk.length);
  r.chk.forEach(c => { assert.ok(c.ok, c.title); assert.ok(c.dur > 5 && c.dur < 90, c.title + ' ' + c.dur); assert.ok(c.limb === 'dark' || c.limb === 'bright'); });
  assert.ok(r.chk.some(c => /Tau/.test(c.title) || /Alcyone/.test(c.title)), 'Pleiade/Taur: ' + JSON.stringify(r.chk.map(c => c.title)));
  assert.ok(r.moonToAlcyone < 2, 'Luna lângă Alcyone în acea noapte: ' + r.moonToAlcyone);
  await done(p);
});

await T('filtre: vizibilitate (orizont/întuneric), prag de conjuncție, paralaxa depinde de loc', async () => {
  const p = await open();
  const r = await p.evaluate(async () => {
    const B = window.__bolta, E = B.E, jd0 = E.jdFromCalendar(2026, 11, 1, 0), jd1 = jd0 + 60;
    B.applyPlace({name: 'București', lat: 44.4268, lon: 26.1025, elev: 0, tz: 'Europe/Bucharest'});
    const all = await B.scanLocal(jd0, jd1, {moonp: true, moons: false, pp: true, thr: 5, mag: 3, vis: 'all'}, () => {});
    const hor = await B.scanLocal(jd0, jd1, {moonp: true, moons: false, pp: true, thr: 5, mag: 3, vis: 'horizon'}, () => {});
    const dark = await B.scanLocal(jd0, jd1, {moonp: true, moons: false, pp: true, thr: 5, mag: 3, vis: 'dark'}, () => {});
    const thr1 = await B.scanLocal(jd0, jd1, {moonp: true, moons: false, pp: false, thr: 1, mag: 3, vis: 'all'}, () => {});
    const conj = all.filter(e => e.key === 'lconj');
    // aceeași conjuncție, alt loc: momentul minimului topocentric diferă (paralaxă)
    B.applyPlace({name: 'Sydney', lat: -33.87, lon: 151.2, elev: 0, tz: 'Australia/Sydney'});
    const syd = await B.scanLocal(jd0, jd1, {moonp: true, moons: false, pp: false, thr: 5, mag: 3, vis: 'all'}, () => {});
    const a = conj.find(e => e.t.id === 'venus' || e.t.id === 'jupiter' || e.t.id === 'saturn' || e.t.id === 'mars'), b = a && syd.find(e => e.key === 'lconj' && e.t.id === a.t.id && Math.abs(e.jd - a.jd) < 1);
    return {all: all.length, hor: hor.length, dark: dark.length, thr1: thr1.length, thr1max: Math.max(0, ...thr1.filter(e => e.key === 'lconj').map(e => e.sep)), horOk: hor.every(e => e.alt > 0), darkOk: dark.every(e => e.alt > 0 && e.sunAlt < -6), confSep: conj.every(e => e.sep <= 5), dJd: a && b ? Math.abs(a.jd - b.jd) * 24 : null, dSep: a && b ? Math.abs(a.sep - b.sep) : null};
  });
  assert.ok(r.all > r.hor && r.hor >= r.dark && r.dark >= 0, JSON.stringify(r)); assert.ok(r.horOk && r.darkOk && r.confSep);
  assert.ok(r.thr1max <= 1.0001); assert.ok(r.thr1 < r.all);
  assert.ok(r.dJd != null && (r.dJd > 0.05 || r.dSep > 0.05), 'paralaxa schimbă momentul/separația: ' + JSON.stringify(r));
  await done(p);
});

await T('interfață: fila Previziune → calculează → rânduri → „Pe cer” (urmărire + traiectorie)', async () => {
  const p = await open({hash: '#fore'});
  assert.equal(await p.isVisible('#tab-fore'), true);
  await p.fill('#foFrom', '2026-10-26'); await p.selectOption('#foSpan', '90'); await p.selectOption('#foVis', 'all'); await p.selectOption('#foMag', '4'); await p.selectOption('#foThr', '3');
  await p.click('#foRun'); await p.waitForFunction(() => !document.getElementById('foRun').disabled, null, {timeout: 120000});
  const n = await p.locator('#foBody tr').count(); assert.ok(n > 10, 'rânduri: ' + n);
  assert.match(await p.textContent('#foStatus'), /evenimente.*ocultații/);
  assert.equal(await p.isDisabled('#foIcs'), false);
  const txt = await p.textContent('#foBody'); assert.match(txt, /Conjuncție Lună–/); assert.match(txt, /Ocultație: Luna acoperă/); assert.match(txt, /dispare la \d\d:\d\d:\d\d/);
  const row = p.locator('#foBody tr', {hasText: 'Ocultație'}).first(); await row.locator('button').click();
  assert.equal(await p.isVisible('#tab-sky'), true);
  const st = await p.evaluate(() => ({follow: __bolta.S.follow, sel: __bolta.S.sel, trail: __bolta.S.opts.trail, full: __bolta.S.opts.full, live: __bolta.S.live, fov: __bolta.Vc.fov}));
  assert.equal(st.follow, true); assert.deepEqual(st.sel, {t: 'body', id: 'moon'}); assert.equal(st.trail, '6h'); assert.equal(st.full, false); assert.equal(st.live, false); assert.ok(st.fov <= 10);
  const ev = await p.evaluate(() => { const e = __bolta.lastLocal.find(x => x.key === 'locc'); return {ing: __bolta.msOfJd(e.ing), egr: __bolta.msOfJd(e.egr), now: __bolta.S.ms}; });
  assert.ok(ev.now < ev.egr + 3600e3 && ev.now > ev.ing - 3600e3, 'ora salt apropiată de ocultație');
  await done(p);
});

await T('schimbarea locului invalidează rezultatele; export .ics al previziunii', async () => {
  const p = await open({hash: '#fore'});
  await p.fill('#foFrom', '2026-11-01'); await p.selectOption('#foSpan', '30'); await p.selectOption('#foVis', 'all');
  await p.click('#foRun'); await p.waitForFunction(() => !document.getElementById('foRun').disabled, null, {timeout: 120000});
  const n = await p.locator('#foBody tr').count(); assert.ok(n > 3);
  const dl = p.waitForEvent('download'); await p.click('#foIcs'); const f = await (await dl).path(); const ics = fs.readFileSync(f, 'utf8').replace(/\r\n /g, '');
  assert.match(ics, /^BEGIN:VCALENDAR/); assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, n); assert.equal((ics.match(/END:VEVENT/g) || []).length, n);
  assert.match(ics, /CATEGORIES:Previziune locală/); assert.match(ics, /SUMMARY:(Conjuncție Lună|Ocultație|Conjuncție)/);
  const uids = ics.match(/UID:.*/g); assert.equal(new Set(uids).size, uids.length, 'UID unice');
  await p.evaluate(() => __bolta.applyPlace({name: 'Cluj', lat: 46.77, lon: 23.6, elev: 0, tz: 'Europe/Bucharest'}));
  assert.equal(await p.locator('#foBody tr').count(), 0); assert.match(await p.textContent('#foStatus'), /Locul s-a schimbat/); assert.match(await p.textContent('#foPlace'), /Cluj/);
  await done(p);
});

await T('traiectorie: apare în desen, e salvată, se validează, nu apare fără obiect', async () => {
  const p = await open();
  const shot = () => p.evaluate(() => { __bolta.render(); return document.getElementById('sky').toDataURL(); });
  await p.evaluate(() => { __bolta.setTime(Date.UTC(2026, 9, 28, 20, 0), false); __bolta.setOpt('full', false); __bolta.selectObj({t: 'body', id: 'moon'}, true); __bolta.goView(180, 35, 60, false); });
  const off = await shot();
  assert.equal(await p.textContent('#trailHint'), '');
  await p.selectOption('#trailSel', '1d'); const on = await shot(); assert.notEqual(on, off, 'traiectoria schimbă desenul');
  assert.match(await p.textContent('#trailHint'), /Traiectoria obiectului selectat/);
  // puncte pe traiectorie proiectate: numărul de noduri din cache
  assert.ok(await p.evaluate(() => __bolta.S.opts.trail === '1d'));
  await p.evaluate(() => __bolta.selectObj(null)); assert.match(await p.textContent('#trailHint'), /Selectează Soarele/);
  const none = await shot(); assert.equal(await p.evaluate(() => { __bolta.selectObj({t: 'body', id: 'moon'}, false); return __bolta.S.opts.trail; }), '1d');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.bolta.settings')).opts.trail); assert.equal(saved, '1d');
  await p.reload(); await p.waitForFunction(() => window.__bolta && window.__bolta.FR.ok); assert.equal(await p.inputValue('#trailSel'), '1d');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('fff.bolta.settings')); o.opts.trail = 'zzz'; localStorage.setItem('fff.bolta.settings', JSON.stringify(o)); });
  await p.reload(); await p.waitForFunction(() => window.__bolta && window.__bolta.FR.ok); assert.equal(await p.inputValue('#trailSel'), 'off');
  // traiectoria Lunii pe 6 h: ~3° pe arc (0,55°/h × 12 h ≈ 6,6°) — noduri consecutive din cache
  const arc = await p.evaluate(() => { const B = __bolta, step = 2 * 0.25 / 96, jd = B.E.jdFromCalendar(2026, 10, 28, 20), i0 = Math.floor((jd - 0.25) / step), a = B.trailVec('moon', i0, step), b = B.trailVec('moon', i0 + 96, step); const D = Math.PI / 180; const c = Math.sin(a[1] * D) * Math.sin(b[1] * D) + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.cos((a[0] - b[0]) * D); return Math.acos(Math.min(1, c)) / D; });
  near(arc, 6.6, 0.8, 'arcul Lunii pe 12 h'); await done(p);
});

await T('noaptea derulată: apus → răsărit, oprire automată', async () => {
  const p = await open();
  const r = await p.evaluate(async () => {
    const B = __bolta; B.setTime(Date.UTC(2026, 9, 26, 10, 0), false); B.nightRun();
    const S = B.S, o = {playing: S.playing, speed: S.speed, startUtc: new Date(S.ms).toISOString(), stop: S.stopAt, sun0: B.E.observe('sun', S.ms / 86400000 + 2440587.5, S.place.lat, S.place.lon, 0).altGeom};
    S.ms = S.stopAt - 20000;   // aproape de răsărit
    await new Promise(res => { const t0 = performance.now(); const iv = setInterval(() => { if (!S.playing || performance.now() - t0 > 8000) { clearInterval(iv); res(); } }, 50); });
    o.after = {playing: S.playing, ms: S.ms, stop: S.stopAt, sun1: B.E.observe('sun', S.ms / 86400000 + 2440587.5, S.place.lat, S.place.lon, 0).altGeom};
    o.stopMs = o.stop; return o;
  });
  assert.equal(r.playing, true); assert.equal(r.speed, 1000); near(r.sun0, -0.83, 0.4, 'Soarele la orizont la start (apus)');
  assert.equal(r.after.playing, false); assert.equal(r.after.stop, null); near(r.after.sun1, -0.83, 0.4, 'Soarele la orizont la sfârșit (răsărit)');
  assert.ok(Date.parse(r.startUtc) < r.stopMs); await done(p);
});

await T('limbi: fila, controalele și mesajele sunt traduse în toate cele 8 limbi, fără chei lipsă', async () => {
  const p = await open({hash: '#fore'});
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {
    await p.selectOption('#langSel', l);
    const g = await p.evaluate(() => ({h: document.querySelector('#tab-fore h2').textContent, tab: document.getElementById('tabb-fore').textContent, run: document.getElementById('foRun').textContent, tr: document.getElementById('trailSel').options[2].textContent, night: document.getElementById('btnNight').textContent, vis: document.getElementById('foVis').options[1].textContent}));
    assert.ok(g.h.length > 10 && !/^fore\./.test(g.h) && !/^tab\./.test(g.tab), l + JSON.stringify(g));
  }
  await p.selectOption('#langSel', 'en'); await p.fill('#foFrom', '2026-11-01'); await p.selectOption('#foSpan', '30'); await p.selectOption('#foVis', 'all'); await p.click('#foRun');
  await p.waitForFunction(() => !document.getElementById('foRun').disabled, null, {timeout: 120000});
  const en = await p.textContent('#foBody'); assert.match(en, /Moon–/); assert.match(en, /altitude/);
  for (const l of ['ro', 'fr', 'it', 'es', 'pt', 'hu', 'de']) { await p.selectOption('#langSel', l); assert.ok((await p.locator('#foBody tr').count()) > 0); }
  const miss = await p.evaluate(() => [...(window.__bm || [])]); assert.deepEqual(miss, [], 'chei lipsă: ' + miss);
  await done(p);
});

await T('mobil 360 px fără derulare orizontală; accesibilitate (axe) pe fila Previziune, temă luminoasă și întunecată', async () => {
  let p = await open({hash: '#fore', w: 360, h: 740});
  await p.click('#foRun'); await p.waitForFunction(() => !document.getElementById('foRun').disabled, null, {timeout: 120000});
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'fără derulare orizontală (fila)');
  await p.evaluate(() => __bolta.showTab('sky')); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'fără derulare orizontală (cer)');
  await done(p);
  if (!AXE) throw new Error('lipsește AXE_PATH');
  for (const scheme of ['dark', 'light']) {
    p = await open({hash: '#fore', scheme, bypassCSP: true});
    await p.fill('#foFrom', '2026-11-01'); await p.selectOption('#foSpan', '30'); await p.selectOption('#foVis', 'all'); await p.click('#foRun'); await p.waitForFunction(() => !document.getElementById('foRun').disabled, null, {timeout: 120000});
    await p.addScriptTag({path: AXE});
    const v = await p.evaluate(async () => (await axe.run(document.getElementById('tab-fore'), {runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa']})).violations.map(x => x.id + ': ' + x.nodes.map(n => n.target.join(' ')).join(' | ')));
    assert.deepEqual(v, [], scheme);
    const v2 = await p.evaluate(async () => { __bolta.showTab('sky'); return (await axe.run(document.querySelector('.timebar'), {runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa']})).violations.map(x => x.id + ': ' + x.nodes.map(n => n.target.join(' ')).join(' | ')); });
    assert.deepEqual(v2, [], scheme + ' bara de timp'); await p.ctx.close();
  }
});

await browser.close();
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} teste reușite`);
process.exit(failed.length ? 1 : 0);
