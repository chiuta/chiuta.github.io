// Poteca 2.0 — Analiză de traseu: estimare Naismith (+Langmuir), distribuția pantelor, segmente abrupte, comparare a două trasee.
// Rulare: node tests/analysis.test.mjs   (Playwright din /opt/node-tools, Chromium din /opt/pw-browsers; rețea blocată; opțional AXE_PATH)
import {createRequire} from 'module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const APP = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
const AXE = process.env.AXE_PATH || process.env.FFF_AXE;
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log('  ok  ', n); } else { bad++; console.log('  FAIL', n, x ?? ''); } };
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const issues = [];
async function open(o = {}) {
  const ctx = await b.newContext({viewport: {width: o.w || 1280, height: o.h || 800}, locale: 'ro-RO', acceptDownloads: true, bypassCSP: !!o.bypass});
  await ctx.route(/^https?:/, r => { issues.push('REȚEA ' + r.request().url()); r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => issues.push('pageerror ' + e.message)); p.on('dialog', d => { issues.push('dialog ' + d.message()); d.dismiss(); });
  await p.goto(APP); await p.waitForSelector('body[data-ready]');
  return {ctx, p};
}
// traseu sintetic: segmente [lungime m, pantă %], puncte la fiecare 25 m spre nord
const SYN = (p, segs, name = 'Sintetic', opts = {}) => p.evaluate(({segs, name, opts}) => {
  const P = window.Poteca, lat = [], lon = [], ele = [];
  let d = 0, z = opts.z0 ?? 1000; const lat0 = 45.4, kLat = 111195;
  lat.push(lat0); lon.push(26.4); ele.push(opts.noEle ? NaN : z);
  for (const [len, g] of segs) { const n = Math.round(len / 25); for (let i = 0; i < n; i++) { d += 25; z += 25 * g / 100; lat.push(lat0 + d / kLat); lon.push(26.4 + (opts.dx || 0)); ele.push(opts.noEle ? NaN : z); } }
  const tr = P.mkTrack({name, lat: Float64Array.from(lat), lon: Float64Array.from(lon), ele: Float64Array.from(ele)});
  P.S.tracks.push(tr); P.S.sel = tr.id; return tr.id;
}, {segs, name, opts});
const plan = (p, id, set) => p.evaluate(({id, set}) => { const P = window.Poteca; for (const k in (set || {})) P.S.set[k] = set[k]; const tr = id ? P.S.tracks.find(x => x.id === id) : P.selTrack(); const R = P.planCalc(tr, P.params(), P.planPs()); return {ok: R.ok, total: R.total, tH: R.tH, tA: R.tA, tL: R.tL, bands: R.bands, hard: R.hard.map(h => ({kind: h.kind, km: h.km, len: h.len, grade: h.grade, min: h.min})), dist: R.A.dist, gain: R.A.gain}; }, {id, set});

console.log('--- calcul: regula lui Naismith');
{
  const {ctx, p} = await open();
  const id = await SYN(p, [[10000, 10]], 'Rampă 10 km / 1000 m');
  let r = await plan(p, id);
  t('10 km + 1000 m urcare: ~120 + 100 = 220 min', near(r.total, 220, 5), r.total);
  t('componente: orizontal ~120, urcare ~100', near(r.tH, 120, 1) && near(r.tA, 100, 4), [r.tH, r.tA]);
  r = await plan(p, id, {plSpeed: 4});
  t('viteză 4 km/h: 150 + 100 min', near(r.total, 250, 5), r.total);
  r = await plan(p, id, {plSpeed: 5, plAsc: 0});
  t('0 min la 100 m: doar timpul orizontal', near(r.total, 120, 1), r.total);
  await plan(p, id, {plAsc: 10});
  const flat = await SYN(p, [[5000, 0]], 'Plat 5 km');
  r = await plan(p, flat);
  t('traseu plat de 5 km: 60 min', near(r.total, 60, 1), r.total);
  const down = await SYN(p, [[10000, -10]], 'Coborâre 10 km');
  r = await plan(p, down);
  t('coborâre: fără timp de urcare, fără Langmuir implicit', near(r.tA, 0, 1) && near(r.tL, 0, 0.001) && near(r.total, 120, 1), r);
  r = await plan(p, down, {plLang: true});
  t('Langmuir pe coborâre de 10% (≈5,7°): −10 min la 300 m → ~−33 min', near(r.tL, -33.3, 3) && near(r.total, 120 - 33.3, 4), r);
  const steep = await SYN(p, [[3000, -30]], 'Coborâre abruptă');
  r = await plan(p, steep, {plLang: true});
  t('Langmuir pe coborâre de 30% (>12°): se adaugă timp (+10 min la 300 m)', r.tL > 0 && near(r.tL, 900 * 10 / 300, 3), r.tL);
  await plan(p, id, {plLang: false});
  r = await plan(p, id, {plSpeed: 5});
  t('distribuția pantelor însumează distanța', near(r.bands.reduce((a, c) => a + c, 0), r.dist, 1), [r.bands, r.dist]);
  t('rampa de 10% e în banda „urcare (5…15%)”', near(r.bands[3], r.dist, 60), r.bands);
  const noele = await SYN(p, [[1000, 0]], 'Fără altitudine', {noEle: true});
  r = await plan(p, noele);
  t('fără altitudine: analiza nu calculează', r.ok === false);
  await ctx.close();
}

console.log('--- segmente abrupte');
{
  const {ctx, p} = await open();
  const id = await SYN(p, [[2000, 5], [400, 20], [2000, 5], [300, -25], [1000, 2]], 'Cu doua tronsoane');
  let r = await plan(p, id, {plHgr: 15, plHlen: 100});
  t('două segmente abrupte (urcare + coborâre)', r.hard.length === 2 && r.hard[0].kind === 'up' && r.hard[1].kind === 'dn', r.hard);
  t('urcarea: ~400 m lungime, pantă ~20%', near(r.hard[0].len, 400, 120) && near(r.hard[0].grade, 20, 4), r.hard[0]);
  t('începutul urcării lângă 2,0 km', near(r.hard[0].km, 2000, 100), r.hard[0].km);
  t('coborârea: pantă negativă ~−25%', near(r.hard[1].grade, -25, 5), r.hard[1].grade);
  t('timp estimat pe segment > 0', r.hard.every(h => h.min > 0));
  r = await plan(p, id, {plHgr: 22, plHlen: 100});
  t('prag 22%: rămâne doar coborârea (−25%)', r.hard.length === 1 && r.hard[0].kind === 'dn', r.hard);
  r = await plan(p, id, {plHgr: 15, plHlen: 1000});
  t('lungime minimă 1000 m: niciun segment', r.hard.length === 0);
  const flat = await SYN(p, [[3000, 3]], 'Blând');
  r = await plan(p, flat, {plHgr: 15, plHlen: 100});
  t('traseu blând: niciun segment abrupt', r.hard.length === 0);
  await ctx.close();
}

console.log('--- interfață: fila Analiză');
{
  const {ctx, p} = await open();
  t('fila „Analiză” există', await p.$('#tab-plan') !== null && /Analiz/.test(await p.textContent('#tab-plan')));
  await p.click('#tab-plan');
  t('fără traseu: mesaj „Selectează un traseu”', !(await p.$eval('#plan-empty', e => e.hidden)) && await p.$eval('#plan-body', e => e.hidden));
  await p.click('#btn-demo'); await p.waitForTimeout(400);
  t('demo: durata estimată afișată', /\d+ h \d+ min|\d+ min/.test(await p.textContent('#plan-grid')) && /Durată estimată/.test(await p.textContent('#plan-grid')));
  t('demo: timp real și raport real/estimat', /Real \/ estimat/.test(await p.textContent('#plan-grid')));
  t('histograma are 5 rânduri', (await p.$$('#plan-hist tbody tr')).length === 5);
  // traseu cu segmente abrupte în UI
  await p.evaluate(() => { const P = window.Poteca; P.S.tracks.length = 0; });
  const id = await SYN(p, [[1500, 4], [350, 22], [1500, 4], [350, -22], [800, 3]], 'Abrupt <b>x</b>');
  await p.evaluate(() => { window.Poteca.setSetting('plHgr', 15); });
  await p.waitForTimeout(200);
  t('tabel segmente abrupte: 2 rânduri', (await p.$$('#plan-hard tbody tr')).length === 2, (await p.$$('#plan-hard tbody tr')).length);
  t('numele cu HTML nu devine element', (await p.$$('#plan-name b')).length === 0 && /<b>x<\/b>/.test(await p.textContent('#plan-name')));
  await p.click('#plan-hard tbody tr:first-child button'); await p.waitForTimeout(150);
  const ab = await p.evaluate(() => [window.Poteca.S.A, window.Poteca.S.B]);
  t('„Arată” setează intervalul A–B pe profil', ab[0] != null && ab[1] > ab[0], ab);
  // schimbare parametri
  await p.fill('#pl-speed', '4'); await p.dispatchEvent('#pl-speed', 'change'); await p.waitForTimeout(150);
  const t4 = await p.textContent('#plan-grid');
  await p.fill('#pl-speed', '5'); await p.dispatchEvent('#pl-speed', 'change'); await p.waitForTimeout(150);
  t('viteza se aplică imediat (4 km/h → durată mai mare)', t4 !== await p.textContent('#plan-grid'));
  await p.check('#pl-lang'); await p.waitForTimeout(150);
  t('Langmuir apare în rezultate', /Corecție Langmuir/.test(await p.textContent('#plan-grid')));
  await p.uncheck('#pl-lang');
  // waypoint-uri
  const w0 = await p.evaluate(() => window.Poteca.S.wpts.length);
  await p.click('#pl-wpt'); await p.waitForTimeout(150);
  const w1 = await p.evaluate(() => window.Poteca.S.wpts.map(w => [w.name, w.sym]));
  t('2 waypoint-uri adăugate pentru segmente', w1.length === w0 + 2 && /Segment abrupt 1/.test(w1[w1.length - 2][0]) && w1[w1.length - 1][1] === 'Danger Area', w1);
  // CSV
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pl-csv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  t('CSV: antet + rând de rezumat + 2 segmente', /^﻿?track,distance_m/.test(csv) && (csv.match(/\r\nup,|,up,/g) || []).length >= 1 && csv.split('\r\n').filter(l => /^[12],(up|dn),/.test(l)).length === 2, csv.slice(0, 400));
  t('CSV: numele fișierului', /^poteca-analiza-.*\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  // persistență
  await p.evaluate(() => window.Poteca.setSetting('plSpeed', 4.5));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.poteca.settings') || '{}'));
  t('setările de analiză se salvează (prefix fff.poteca.)', saved.plSpeed === 4.5 && saved.plHgr === 15, saved);
  await ctx.close();
}

console.log('--- compararea a două trasee');
{
  const {ctx, p} = await open();
  await p.click('#tab-plan');
  const a = await SYN(p, [[4000, 5], [3000, -3]], 'Ruta A');
  t('un singur traseu: mesaj de comparare', !(await p.$eval('#plan-cmp-need', e => e.hidden)));
  const c = await SYN(p, [[4000, 8], [3000, -5]], 'Ruta B', {dx: 0.01});
  await p.evaluate(() => window.Poteca.setSetting('plHgr', 15)); await p.waitForTimeout(200);
  await p.selectOption('#pl-cmpa', a); await p.selectOption('#pl-cmpb', c); await p.waitForTimeout(150);
  t('două trasee: tabel de comparare vizibil', await p.$eval('#plan-cmp-need', e => e.hidden) && !(await p.$eval('#plan-cmp-body', e => e.hidden)));
  t('select-uri cu cele două trasee', (await p.$$eval('#pl-cmpa option', o => o.length)) === 2 && (await p.$eval('#pl-cmpa', e => e.value)) !== (await p.$eval('#pl-cmpb', e => e.value)));
  const rows = await p.$$eval('#plan-cmp tbody tr', rs => rs.map(r => [...r.children].map(c => c.textContent)));
  t('tabel: 8 indicatori × (A, B, B−A)', rows.length === 8 && rows.every(r => r.length === 4), rows.length);
  const gainRow = rows.find(r => /Câștig/.test(r[0]));
  t('B urcă mai mult decât A (+120 m, deltă pozitivă)', /^\+/.test(gainRow[3]), gainRow);
  t('profiluri suprapuse: 2 curbe', (await p.$$('#plan-ovl path')).length === 2);
  await p.selectOption('#pl-cmpa', c); await p.waitForTimeout(150);
  t('schimbarea lui A reface comparația (A≠B păstrat)', (await p.$eval('#pl-cmpa', e => e.value)) !== (await p.$eval('#pl-cmpb', e => e.value)));
  t('legenda numește traseele', /Ruta B/.test(await p.textContent('#plan-leg')) && /Ruta A/.test(await p.textContent('#plan-leg')));
  await ctx.close();
}

console.log('--- limbi');
{
  const {ctx, p} = await open();
  await p.click('#btn-demo'); await p.waitForTimeout(300); await p.click('#tab-plan');
  const dict = await p.evaluate(() => null);
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.selectOption('#sel-lang', l); await p.waitForTimeout(150);
    const txt = await p.$eval('#p-plan', e => e.textContent);
    const tab = await p.textContent('#tab-plan');
    const raw = /\bpl_[a-z0-9_]+\b/.test(txt) || /\bpl_[a-z0-9_]+\b/.test(tab) || /\btab_plan\b/.test(tab);
    const roLeft = l !== 'ro' && /Estimare orientativ|Rezultat estimat|Distribuția pantelor|Segmente abrupte|Compară două/.test(txt);
    t('limba ' + l + ': fila Analiză tradusă, fără chei brute', !raw && !roLeft && txt.length > 400, {raw, roLeft});
  }
  await p.selectOption('#sel-lang', 'en'); await p.click('#tab-plan');
  const lim = await p.evaluate(() => [...document.querySelectorAll('#limits-list li')].map(e => e.textContent));
  t('limitările includ avertismentul despre estimări (en)', lim.some(x => /indicative/.test(x)) && lim.length === 8, lim.length);
  await ctx.close();
}

console.log('--- accesibilitate, mobil, rețea');
{
  const {ctx, p} = await open({bypass: true});
  await p.click('#btn-demo'); await p.waitForTimeout(300); await p.click('#tab-plan');
  if (AXE && fs.existsSync(AXE)) {
    await p.evaluate(fs.readFileSync(AXE, 'utf8') + '\n;0');
    const ax = await p.evaluate(async () => (await window.axe.run(document.getElementById('p-plan'), {resultTypes: ['violations']})).violations.map(v => v.id + ':' + v.nodes.length));
    t('axe 0 violări în fila Analiză', ax.length === 0, ax);
  }
  await ctx.close();
  const m = await open({w: 360, h: 740});
  await m.p.click('#btn-demo'); await m.p.waitForTimeout(300); await m.p.click('#tab-plan');
  t('fără depășire orizontală a paginii la 360 px', await m.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
  await m.ctx.close();
  t('0 erori JS / dialoguri / rețea', issues.length === 0, issues.slice(0, 5));
}
await b.close(); console.log(`\n${ok} ok / ${bad} eșuate`); process.exit(bad ? 1 : 0);
