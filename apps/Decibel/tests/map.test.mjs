// Teste Decibel 2.0 — Hartă personală de zgomot (Playwright, rețea blocată). Rulare: node tests/map.test.mjs
import {createRequire} from 'module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = 'file://' + path.join(HERE, '..', 'index.html');
const results = [];
async function T(name, fn) {
  try { await fn(); results.push([name, true]); console.log('ok   ' + name); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''} așteptat ${b} ± ${tol}, obținut ${a}`);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const S = (id, place, laeq, dur, o = {}) => Object.assign({id, start: '2026-10-2' + (id.length % 9) + 'T10:00:00.000Z', dur, source: 'mic', place, name: '', laeq, lcpk: laeq + 10, lmax: laeq + 8, lmin: laeq - 10, l10: laeq + 3, l50: laeq, l90: laeq - 5, lceq: laeq, lzeq: laeq, dose: 1, doseCrit: '85', clip: 0, cal: true, offset: 3, profile: 'p', mic: '', events: [], series: []}, o);
const SEED = [
  S('a1', 'Bucătărie', 60, 100), S('a2', ' bucătărie ', 70, 100, {l90: 50, lmax: 80}), S('b1', 'Birou', 45, 600, {l90: 40}),
  S('c1', 'Stradă', 78, 300, {lmax: 95}), S('d1', 'Birou', -30, 120, {cal: false, offset: 0, lmax: -20, l90: -40}), S('e1', '', 55, 50)
];
async function open(seed, o = {}) {
  const ctx = await browser.newContext({bypassCSP: !!o.bypassCSP, viewport: o.viewport || {width: 1280, height: 800}, locale: 'ro-RO', acceptDownloads: true});
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.net = []; p.ctx = ctx;
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) p.net.push(r.url()); });
  if (seed) await p.addInitScript(s => { if (!localStorage.getItem('fff.decibel.sessions')) localStorage.setItem('fff.decibel.sessions', JSON.stringify(s)); }, seed);
  await p.goto(URL_APP); return p;
}
const rowsOf = p => p.evaluate(() => Array.from(document.querySelectorAll('#mapTbl tbody tr')).map(tr => Array.from(tr.cells).map(c => c.textContent)));

await T('agregare: locații unite fără diferențe de majuscule, medie energetică, vârf și fundal', async () => {
  const p = await open(SEED);
  const d = await p.evaluate(() => Decibel.mapData(JSON.parse(localStorage.getItem('fff.decibel.sessions'))));
  const k = d.find(e => e.place === 'Bucătărie');
  assert.equal(k.n, 2); assert.equal(k.dur, 200); near(k.leq, 10 * Math.log10((1e6 + 1e7) / 2) - 0, 0.1, 'LAeq energetic'); assert.equal(k.max, 80); assert.equal(k.bg, 50); assert.equal(k.cal, true);
  assert.equal(d.filter(e => e.place === 'Birou').length, 2, 'Birou calibrat și necalibrat separate');
  const bc = d.find(e => e.place === 'Birou' && e.cal); assert.equal(bc.leq, 45);
  assert.equal(d.length, 5);
  assert.deepEqual(p.errs, []); assert.deepEqual(p.net, []); await p.ctx.close();
});

await T('fila Hartă: tabel, sortare, rezumat, bară, detalii', async () => {
  const p = await open(SEED);
  await p.click('#t-map'); assert.equal(await p.isVisible('#p-map'), true);
  let r = await rowsOf(p); assert.equal(r.length, 5);
  assert.match(r[0][0], /Stradă/); assert.match(r[0][3], /78[.,]0 dB\(A\)/);   // calibratele întâi, descrescător
  assert.match(r[r.length - 1][3], /dBFS\(A\)/);
  assert.match(await p.textContent('#mapSummary'), /5 locuri din 6 sesiuni.*Stradă.*Birou/);
  await p.selectOption('#mapSort', 'name'); r = await rowsOf(p); assert.match(r[0][0], /Birou/);
  await p.selectOption('#mapSort', 'n'); r = await rowsOf(p); assert.match(r[0][0], /Bucătărie/); assert.equal(r[0][1], '2');
  assert.equal(await p.locator('.mapbar').count(), 5);
  await p.click('[data-map-sel] >> nth=0'); assert.equal(await p.isVisible('#mapDetail'), true); assert.equal(await p.locator('#mapDetailL li').count(), 2);
  assert.equal(await p.getAttribute('[data-map-sel] >> nth=0', 'aria-expanded'), 'true');
  await p.click('[data-map-sel] >> nth=0'); assert.equal(await p.isVisible('#mapDetail'), false);
  // sortarea persistă
  await p.reload(); await p.click('#t-map'); assert.equal(await p.inputValue('#mapSort'), 'n');
  assert.deepEqual(p.errs, []); assert.deepEqual(p.net, []); await p.ctx.close();
});

await T('export CSV al hărții și raport tipărit', async () => {
  const p = await open(SEED); await p.click('#t-map');
  const dl = p.waitForEvent('download'); await p.click('#btnMapCsv'); const f = await (await dl).path(); const csv = fs.readFileSync(f, 'utf8');
  assert.match(csv, /^﻿# /); assert.match(csv, /locatie,sesiuni,durata_totala_s,LAeq_dB,LAFmax_dB,LAF90_min_dB,calibrat/);
  const lines = csv.trim().split(/\r?\n/); assert.equal(lines.length, 7); assert.ok(lines.some(l => /^Bucătărie,2,200,67\.4,80,50,1,/.test(l)), csv);
  await p.evaluate(() => Decibel.buildReport('map')); await p.emulateMedia({media: 'print'});
  assert.equal(await p.isVisible('#report'), true); assert.equal(await p.isVisible('#main'), false);
  const txt = await p.textContent('#report'); assert.match(txt, /Orientativ/); assert.match(txt, /Bucătărie/); assert.match(txt, /necertificat/);
  assert.equal(await p.locator('#report tbody tr').count(), 5); await p.ctx.close();
});

await T('gol, ștergere sesiune actualizează harta, listă de locuri în câmpul Locația', async () => {
  const p = await open(null); await p.click('#t-map');
  assert.equal(await p.isVisible('#mapEmpty'), true); assert.equal(await p.isDisabled('#btnMapCsv'), true);
  await p.evaluate(s => { localStorage.setItem('fff.decibel.sessions', JSON.stringify(s)); }, SEED); await p.reload(); await p.click('#t-map');
  assert.equal(await p.isVisible('#mapEmpty'), false);
  assert.deepEqual(await p.evaluate(() => Array.from(document.querySelectorAll('#placeList option')).map(o => o.value).sort()), ['Birou', 'Bucătărie', 'Stradă', 'bucătărie']);
  await p.click('#t-log'); await p.click('[data-log-del] >> nth=0'); await p.click('#t-map'); assert.ok((await rowsOf(p)).length <= 5);
  await p.ctx.close();
});

await T('sesiune reală: fișier măsurat și salvat apare pe hartă; limbi; mobil', async () => {
  const p = await open(null, {viewport: {width: 360, height: 700}});
  await p.fill('#placeIn', 'Peron'); await p.click('#btnDemo'); await p.waitForFunction(() => Decibel.state().sess && !Decibel.state().running && Decibel.state().sess.n > 100, null, {timeout: 60000});
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('fff.decibel.sessions') || '[]').length === 1);
  await p.click('#t-map'); const r = await rowsOf(p); assert.equal(r.length, 1); assert.equal(r[0][0], 'Peron'); assert.match(r[0][3], /dBFS\(A\)/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'fără derulare orizontală a paginii');
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) { await p.selectOption('#lang', l); const h = await p.textContent('#p-map h2'); assert.ok(h && !/^map_/.test(h), l + ' ' + h); assert.notEqual(await p.textContent('#t-map'), 'tab_map'); }
  assert.deepEqual(p.errs, []); await p.ctx.close();
});

await T('accesibilitate (axe) pe fila Hartă', async () => {
  const axe = process.env.AXE_PATH || process.env.FFF_AXE; if (!axe) throw new Error('lipsește AXE_PATH');
  for (const scheme of ['light', 'dark']) {
    const p = await open(SEED, {bypassCSP: true}); await p.emulateMedia({colorScheme: scheme}); await p.click('#t-map'); await p.click('[data-map-sel] >> nth=0');
    await p.addScriptTag({path: axe});
    const v = await p.evaluate(async () => (await axe.run(document.getElementById('p-map'), {runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa']})).violations.map(x => x.id + ': ' + x.nodes.map(n => n.target.join(' ')).join(' | ')));
    assert.deepEqual(v, [], scheme); await p.ctx.close();
  }
});

await browser.close();
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} teste reușite`);
process.exit(failed.length ? 1 : 0);
