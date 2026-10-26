// Teste Gospodar 2.0.0: reguli învățate din istoric + prognoza soldului pe luni.
// Rulare: node tests/forecast.test.mjs [filtru]
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
const AXE = process.env.AXE_PATH || process.env.FFF_AXE;
const NOW = '2026-10-14T10:00:00+03:00';
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 7).join('\n       ')); }
}
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'});
async function newPage(o = {}) {
  const ctx = await browser.newContext({viewport: o.viewport || {width: 1280, height: 900}, locale: 'ro-RO', timezoneId: 'Europe/Bucharest', acceptDownloads: true});
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  page.errs = []; page.net = [];
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.errs.push(m.type() + ': ' + m.text()); });
  page.on('dialog', d => { page.errs.push('dialog nativ'); d.dismiss(); });
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) page.net.push(u); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  await page.clock.install({time: new Date(NOW)});
  page.ctx = ctx;
  await page.goto(URL_APP); await page.waitForSelector('#view h2');
  return page;
}
const E = (p, fn, arg) => p.evaluate(fn, arg);
const nav = async (p, v) => { await p.click(`#nav [data-v="${v}"]`); await p.waitForTimeout(100); };
async function clean(p) { assert.deepEqual(await p.evaluate(() => window.__csp), [], 'CSP'); assert.deepEqual(p.errs, [], 'erori'); assert.deepEqual(p.net, [], 'rețea'); }

/* date de test pentru reguli învățate */
async function seedLearn(p) {
  return E(p, () => {
    const S = GOSPODAR.S; S.wipeAll();
    const a = S.addAccount({name: 'Principal', cur: 'RON', open: 500000});
    const exp = S.data().cats.filter(c => c.kind === 'exp' && c.parent).slice(0, 3).map(c => c.id);
    const inc = S.data().cats.find(c => c.kind === 'inc' && c.parent) || S.data().cats.find(c => c.kind === 'inc');
    const [X, Y, Z] = exp;
    const add = (n, desc, cat, amt) => { for (let i = 0; i < n; i++) S.addTx({date: '2026-09-' + String(2 + i).padStart(2, '0'), amt, acc: a.id, cat, desc: desc + ' ' + (100 + i)}, true); };
    add(5, 'PLATA POS KAFFEE HAUS', X, -1500); add(1, 'PLATA POS KAFFEE HAUS', '', -1700);
    add(4, 'ABONAMENT FITNESS CLUB', Y, -9000); add(1, 'ABONAMENT FITNESS CLUB', Z, -9000);
    add(2, 'FARMACIA SANA', X, -3000); add(1, 'FARMACIA SANA', Y, -3000);
    add(2, 'LIBRARIE NOUA', Z, -2500);
    add(3, 'SALARIU FIRMA', inc.id, 300000);
    add(4, 'MEGA IMAGE', X, -4000);
    const d = S.data(); d.rules.push({id: S.nid('u'), name: 'Mega', mode: 'contains', pat: 'MEGA IMAGE', sign: '', min: null, max: null, acc: '', cat: X, tags: [], on: true});
    S.commit('all'); GOSPODAR.U.go('rules', false);
    return {a: a.id, X, Y, Z, inc: inc.id};
  });
}

await T('reguli învățate: sugestii corecte (prag, conflict, acoperite deja)', async () => {
  const p = await newPage(); const ids = await seedLearn(p);
  const res = await E(p, () => GOSPODAR.S.learnSuggest(5000));
  const keys = res.list.map(x => x.key).sort();
  assert.deepEqual(keys, ['abonament fitness', 'kaffee haus', 'salariu firma'], JSON.stringify(res.list));
  const k = res.list.find(x => x.key === 'kaffee haus'); assert.deepEqual([k.A, k.B, k.U, k.sign, k.cat], [5, 0, 1, 'exp', ids.X]);
  const f = res.list.find(x => x.key === 'abonament fitness'); assert.deepEqual([f.A, f.B], [4, 1]);
  assert.equal(res.list.find(x => x.key === 'salariu firma').sign, 'inc');
  assert.ok(!keys.includes('farmacia sana'), '66% < 80% nu trece'); assert.ok(!keys.includes('librarie noua'), 'sub 3 apariții'); assert.ok(!keys.includes('mega image'), 'deja acoperit de o regulă');
  assert.equal(res.aborted, false);
  await clean(p); await p.ctx.close();
});

await T('reguli învățate: dialog, bifare, creare, aplicare, anulare', async () => {
  const p = await newPage(); const ids = await seedLearn(p);
  const before = await E(p, () => GOSPODAR.S.data().rules.length);
  await p.click('[data-act=learnrules]'); await p.waitForSelector('dialog[open] #learn-tbl');
  assert.equal(await p.locator('dialog[open] #learn-tbl tbody tr').count(), 3);
  assert.match(await p.textContent('dialog[open]'), /nu inventează categorii/);
  await p.uncheck('dialog[open] input[name=pick] >> nth=2'); // debifează a treia
  const kept = await E(p, () => [...document.querySelectorAll('dialog[open] input[name=pick]')].map(e => e.checked));
  assert.deepEqual(kept.filter(Boolean).length, 2);
  await p.click('dialog[open] [data-dk=ok]'); await p.waitForTimeout(200);
  const rules = await E(p, () => GOSPODAR.S.data().rules);
  assert.equal(rules.length, before + 2);
  const nr = rules.slice(before); assert.ok(nr.every(r => r.learned && r.mode === 'contains' && r.on && r.pat && r.cat && /^Învățat: /.test(r.name)), JSON.stringify(nr));
  // aplicare pe necategorizate: KAFFEE necategorizat primește categoria
  const kaffeeRule = nr.find(r => r.pat === 'kaffee haus');
  if (kaffeeRule) {
    await p.click('[data-act=applyrules][data-scope=uncat]'); await p.waitForSelector('dialog[open] [data-dk=ok]'); await p.click('dialog[open] [data-dk=ok]'); await p.waitForTimeout(200);
    const cats = await E(p, () => GOSPODAR.S.data().txs.filter(t => /KAFFEE/.test(t.desc)).map(t => t.cat));
    assert.ok(cats.every(c => c === ids.X), JSON.stringify(cats));
  }
  // redeschidere: ce s-a creat nu mai e propus
  const again = await E(p, () => GOSPODAR.S.learnSuggest(5000).list.map(x => x.key));
  assert.ok(nr.every(r => !again.includes(r.pat)), JSON.stringify(again));
  // anulare
  const n = await E(p, ([i]) => GOSPODAR.S.undoLearn(i), [nr.map(r => r.id)]);
  assert.equal(n, 2); assert.equal(await E(p, () => GOSPODAR.S.data().rules.length), before);
  await clean(p); await p.ctx.close();
});

await T('reguli învățate: fără bifă → mesaj, nimic creat; fără tipare → mesaj', async () => {
  const p = await newPage(); await seedLearn(p);
  const before = await E(p, () => GOSPODAR.S.data().rules.length);
  await p.click('[data-act=learnrules]'); await p.waitForSelector('dialog[open] #learn-tbl');
  for (let i = 0; i < 3; i++) await p.uncheck(`dialog[open] input[name=pick] >> nth=${i}`);
  await p.click('dialog[open] [data-dk=ok]'); await p.waitForTimeout(150);
  assert.match(await p.textContent('dialog[open] .derr'), /Bifează cel puțin o regulă/);
  assert.equal(await E(p, () => GOSPODAR.S.data().rules.length), before);
  await p.click('dialog[open] [data-dk=x]'); await p.waitForTimeout(100);
  await E(p, () => { const S = GOSPODAR.S; S.wipeAll(); GOSPODAR.U.go('rules', false); });
  await p.click('[data-act=learnrules]'); await p.waitForSelector('dialog[open] #learn-none');
  assert.match(await p.textContent('dialog[open]'), /Nu s-au găsit tipare noi/);
  await clean(p); await p.ctx.close();
});

/* date de test pentru prognoză: azi = 2026-10-14 */
async function seedForecast(p, o = {}) {
  return E(p, (o) => {
    const S = GOSPODAR.S; S.wipeAll();
    const a = S.addAccount({name: 'Principal', cur: 'RON', open: o.open == null ? 1000000 : o.open});
    const t = (date, amt, extra) => S.addTx(Object.assign({date, amt, acc: a.id, desc: 'MIȘCARE ' + date}, extra || {}), true);
    t('2026-06-10', -10000); t('2026-07-12', -40000); t('2026-08-12', -60000); t('2026-09-12', -50000); t('2026-10-01', -20000);
    const d = S.data();
    const salary = {id: S.nid('r'), name: 'Salariu', amt: 300000, acc: a.id, cat: '', freq: 'monthly', interval: 1, start: '2026-07-25', end: '', tags: [], note: '', paused: false};
    const rent = {id: S.nid('r'), name: 'Chirie', amt: o.rent == null ? -150000 : o.rent, acc: a.id, cat: '', freq: 'monthly', interval: 1, start: '2026-07-05', end: '', tags: [], note: '', paused: false};
    d.recs.push(salary, rent);
    t('2026-11-10', -5000);
    t('2026-11-05', rent.amt, {rec: rent.id + '@2026-11-05', desc: 'Chirie'});
    S.commit('all'); GOSPODAR.U.go('fc', false);
    return {a: a.id};
  }, o);
}

await T('prognoză: calcul exact (sold, recurențe, restante, deja înregistrate, medie)', async () => {
  const p = await newPage(); await seedForecast(p);
  const f = await E(p, () => GOSPODAR.S.forecast({months: 3, avgMonths: 3}));
  assert.equal(f.start, 820000);
  assert.deepEqual([f.overdue, f.old, f.avgN, f.avgNet, f.missing], [1, 6, 3, -50000, 0]);
  assert.deepEqual(f.rows.map(r => r.mk), ['2026-10', '2026-11', '2026-12', '2027-01']);
  assert.deepEqual(f.rows.map(r => [r.inc, r.exp, r.avg]), [[300000, 150000, -27419], [300000, 155000, -50000], [300000, 150000, -50000], [300000, 150000, -50000]]);
  assert.deepEqual(f.rows.map(r => r.close), [942581, 1037581, 1137581, 1237581]);
  assert.equal(f.rows[1].open, 942581); assert.equal(f.negMk, ''); assert.equal(f.minClose, 820000);
  const f0 = await E(p, () => GOSPODAR.S.forecast({months: 3, avgMonths: 0}));
  assert.deepEqual(f0.rows.map(r => r.avg), [0, 0, 0, 0]); assert.equal(f0.rows[0].close, 970000);
  await clean(p); await p.ctx.close();
});

await T('prognoză: negativ, cont arhivat, curs lipsă', async () => {
  const p = await newPage(); await seedForecast(p, {open: 100000, rent: -400000});
  const f = await E(p, () => GOSPODAR.S.forecast({months: 6, avgMonths: 0}));
  assert.ok(f.negMk && f.minClose < 0, JSON.stringify([f.negMk, f.minClose]));
  const g = await E(p, () => {
    const S = GOSPODAR.S, d = S.data();
    d.accounts[0].archived = true; const e = S.addAccount({name: 'EUR', cur: 'EUR', open: 5000}); S.addTx({date: '2026-11-20', amt: 1000, acc: e.id, desc: 'x'}, true); S.commit('all');
    return S.forecast({months: 3, avgMonths: 0});
  });
  assert.ok(g.missing >= 2, 'conturi/operațiuni fără curs excluse: ' + g.missing);
  assert.equal(g.start, 0);
  await clean(p); await p.ctx.close();
});

await T('prognoză: vizualizare, controale, CSV, limbi', async () => {
  const p = await newPage(); await seedForecast(p);
  await nav(p, 'fc');
  assert.match(await p.textContent('#view h2'), /Prognoză/);
  await p.selectOption('#fc-h', '3'); await p.waitForTimeout(100);
  assert.equal(await p.locator('#fc-tbl tbody tr').count(), 4);
  const exp = await E(p, () => GOSPODAR.S.forecast({months: 3, avgMonths: 3}));
  const closeCell = await p.textContent('#fc-tbl tbody tr:nth-child(2) td:last-child');
  const norm = s => s.replace(/\s| | /g, '');
  const want = await E(p, (m) => GOSPODAR.G.fmt(m, 'RON', {sign: true}), exp.rows[1].close);
  assert.equal(norm(closeCell), norm(want), closeCell + ' vs ' + want);
  assert.match(await p.textContent('#view'), /restul lunii/);
  assert.match(await p.textContent('#view'), /Sold de azi/);
  assert.equal(await p.locator('#view svg.fcsvg[role=img]').count(), 1);
  assert.match(await p.getAttribute('svg.fcsvg', 'aria-label'), /Evoluția estimată/);
  // media oprită
  await p.uncheck('#fc-avg'); await p.waitForTimeout(100);
  assert.equal(await p.isDisabled('#fc-k'), true);
  const c0 = await p.textContent('#fc-tbl tbody tr:first-child td:last-child');
  const w0 = await E(p, () => GOSPODAR.G.fmt(GOSPODAR.S.forecast({months: 3, avgMonths: 0}).rows[0].close, 'RON', {sign: true}));
  assert.equal(norm(c0), norm(w0));
  await p.check('#fc-avg'); await p.selectOption('#fc-k', '6'); await p.waitForTimeout(100);
  // CSV
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=fccsv]')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const lines = csv.replace(/^﻿/, '').trim().split(/\r\n/);
  assert.equal(lines.length, 5); assert.match(lines[0], /^Luna,Sold inițial/); assert.match(lines[1], /^2026-10,8200\.00,3000\.00,-1500\.00,/);
  // limbi
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.selectOption('#langSel', l); await p.waitForTimeout(80);
    const txt = await p.textContent('#view');
    assert.ok(!/\bfc_|\blearn_|\{[a-z]+\}/.test(txt), 'chei/variabile în ' + l + ': ' + txt.slice(0, 120));
    if (l !== 'ro') assert.ok(!/Sold de azi|restul lunii|Prognoză/.test(txt), 'română rămasă în ' + l);
  }
  await clean(p); await p.ctx.close();
});

await T('accesibilitate (axe), 360 px, regulile învățate în 8 limbi', async () => {
  const p = await newPage({viewport: {width: 360, height: 740}}); await seedForecast(p);
  await nav(p, 'fc');
  assert.ok((await E(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, 'depășire orizontală (prognoză)');
  const navOv = await E(p, () => { const n = document.querySelector('#nav'); return n.scrollWidth - n.clientWidth; });
  const src = AXE ? fs.readFileSync(AXE, 'utf8') : null;
  if (src) {
    await p.evaluate(s => { if (!window.axe) (0, eval)(s); }, src);
    const r = await E(p, () => axe.run(document, {resultTypes: ['violations']}));
    assert.deepEqual(r.violations.map(v => v.id + ':' + v.nodes.length), [], 'axe prognoză');
  }
  await seedLearn(p);
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.selectOption('#langSel', l); await p.waitForTimeout(60);
    await p.click('[data-act=learnrules]'); await p.waitForSelector('dialog[open] #learn-tbl');
    const txt = await p.textContent('dialog[open]');
    assert.ok(!/\blearn_|\{[a-z]+\}/.test(txt), 'chei în ' + l);
    if (src && l === 'en') { const r = await E(p, () => axe.run(document.querySelector('dialog[open]'), {resultTypes: ['violations']})); assert.deepEqual(r.violations.map(v => v.id + ':' + v.nodes.length), [], 'axe dialog'); }
    await p.click('dialog[open] [data-dk=x]'); await p.waitForTimeout(80);
  }
  assert.ok((await E(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, 'depășire orizontală (reguli)');
  await clean(p); await p.ctx.close();
});

await browser.close();
const bad = results.filter(r => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste verzi`);
process.exit(bad.length ? 1 : 0);
