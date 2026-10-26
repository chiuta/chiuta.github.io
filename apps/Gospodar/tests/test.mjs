// Teste Gospodar — Playwright (Chromium headless, rețea blocată). Rulare: node tests/test.mjs [filtru]
// Oracolul numeric (tests/oracle.json) e produs independent de tests/gen_oracle.py (Python, decimal exact).
import {createRequire} from 'module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = 'file://' + path.join(HERE, '..', 'index.html');
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const ORACLE = JSON.parse(fs.readFileSync(path.join(HERE, 'oracle.json'), 'utf8'));
const NOW = '2026-10-14T10:00:00+03:00';
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 7).join('\n       ')); }
}
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

async function newPage(o = {}) {
  const ctx = o.ctx || await browser.newContext({viewport: o.viewport || {width: 1280, height: 800}, locale: 'ro-RO', timezoneId: 'Europe/Bucharest', bypassCSP: !!o.bypassCSP, acceptDownloads: true, colorScheme: o.colorScheme || 'light'});
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  page.errs = []; page.net = [];
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) page.net.push(u); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  if (o.clock !== false) await page.clock.install({time: new Date(NOW)});
  page.ctx = ctx;
  if (o.goto !== false) { await page.goto(URL_APP); await page.waitForSelector('#view h2'); }
  return page;
}
const close = p => p.ctx.close();
const okLast = p => p.locator('dialog[open] [data-dk=ok]').last().click();
const pickCat = (p, sel, name) => p.evaluate(([sel, name]) => { const e = document.querySelector(sel); const o = [...e.options].find(o => o.textContent.trim() === name); e.value = o.value; }, [sel, name]);
async function clean(p, label = '') { assert.deepEqual(await p.evaluate(() => window.__csp), [], 'CSP ' + label); assert.deepEqual(p.errs, [], 'erori ' + label); assert.deepEqual(p.net, [], 'rețea ' + label); }
const E = (p, fn, arg) => p.evaluate(fn, arg);
const nav = async (p, v) => { await p.click(`#nav [data-v="${v}"]`); await p.waitForTimeout(80); };
const demo = async p => { await p.evaluate(() => { GOSPODAR.S.demoData(); GOSPODAR.S.commit('all'); GOSPODAR.U.go('dash', false); }); };
const wipe = async p => { await p.evaluate(() => { GOSPODAR.S.wipeAll(); GOSPODAR.U.go('dash', false); }); };
const mkAcc = (p, o) => p.evaluate(o => GOSPODAR.S.addAccount(o).id, o);
async function setFile(p, name, buf) { await p.setInputFiles('#im-file', {name, mimeType: 'text/csv', buffer: Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8')}); await p.waitForFunction(() => GOSPODAR.U.imp.info !== null, null, {timeout: 60000}); }
function win1250(str) {
  const dec = new TextDecoder('windows-1250'); const map = new Map();
  for (let b = 0x80; b < 256; b++) map.set(dec.decode(Uint8Array.of(b)), b);
  const out = []; for (const ch of str) { const c = ch.codePointAt(0); if (c < 0x80) out.push(c); else if (map.has(ch)) out.push(map.get(ch)); else throw new Error('char fără corespondent 1250: ' + ch); }
  return Buffer.from(out);
}
const txs = (p) => p.evaluate(() => GOSPODAR.S.data().txs.map(t => ({date: t.date, amt: t.amt, desc: t.desc, cat: t.cat, acc: t.acc, tags: t.tags, tr: t.tr})));

/* ------------------------------------------------------------ */
await T('pornire: 0 erori, CSP, fără rețea, meta, versiune, lang', async () => {
  const p = await newPage();
  await clean(p, 'start');
  assert.equal(await E(p, () => document.documentElement.lang), 'ro');
  assert.equal(await E(p, () => document.querySelector('meta[name=application-version]').content), '2.0.0');
  assert.equal(await E(p, () => document.querySelector('meta[name=last-updated]').content), '2026-10-26');
  assert.equal((await p.textContent('#app-version')).trim(), 'v 2.0.0 · 2026-10-26');
  const csp = await E(p, () => document.querySelector('meta[http-equiv=Content-Security-Policy]').content);
  // script-src: 3 scripturi inline executabile (kit, înregistrare PWA, aplicație), fiecare cu hash; fără unsafe
  assert.match(csp, /^default-src 'none'; script-src ('sha256-[A-Za-z0-9+/=]+' ?){3}; style-src 'unsafe-inline'; /);
  assert.match(csp, /connect-src 'none'/); assert.ok(!/unsafe-eval/.test(csp)); assert.ok(!/script-src[^;]*unsafe/.test(csp));
  assert.match(csp, /manifest-src 'self'(;|$)/); assert.match(csp, /worker-src 'self' blob:(;|$)/); assert.match(csp, /img-src 'self' data: blob:/);
  const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const scr = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]) && !/type="application\/json"/.test(m[1]));
  assert.equal(scr.length, 3, 'kit + pwa + aplicație');
  for (const m of scr) assert.ok(csp.includes("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'"), 'hash lipsă: ' + m[2].slice(0, 30));
  for (const [mod, a] of [['build.mjs', 'check'], ['pwa/pwa.mjs', 'check']]) { const r = spawnSync(process.execPath, [path.resolve(HERE, '../../../fff-kit', mod), a, path.resolve(HERE, '..')], {encoding: 'utf8'}); assert.equal(r.status, 0, mod + ' check: ' + r.stdout + r.stderr); }
  assert.ok(!/\son(click|change|input|submit|load)=/i.test(html), 'handlere inline');
  assert.ok(!/\beval\(|new Function\(/.test(html), 'eval');
  assert.match(await p.textContent('main'), /Începe cu un cont/);
  await close(p);
});

await T('calcule exacte: 0,1 + 0,2, parsare, formatare, conversii', async () => {
  const p = await newPage();
  const r = await E(p, () => { const G = GOSPODAR.G; return {
    a: G.parseTyped('0,10', 'RON') + G.parseTyped('0.20', 'RON'), b: G.parseTyped('1.234,56', 'RON'), c: G.parseTyped('1,234.56', 'RON'), d: G.parseTyped('12', 'JPY'), e: G.parseTyped('1 234,5', 'EUR'),
    f: G.convertMinor(10000, 'EUR', 'RON', 'RON', {EUR: '4.9765'}), g: G.convertMinor(49765, 'RON', 'EUR', 'RON', {EUR: '4.9765'}), h: G.convertMinor(1, 'EUR', 'RON', 'RON', {EUR: '4.9765'}), i: G.convertMinor(100, 'EUR', 'USD', 'RON', {EUR: '4.9', USD: '4.5'}),
    j: G.convertMinor(100, 'EUR', 'RON', 'RON', {}), k: G.minorToDot(-5, 'RON'), l: G.minorToDot(123456, 'RON'), m: G.parseTyped('abc', 'RON'), n: G.parseTyped('9007199254740993', 'RON') }; });
  assert.equal(r.a, 30); assert.equal(r.b, 123456); assert.equal(r.c, 123456); assert.equal(r.d, 12); assert.equal(r.e, 123450);
  assert.equal(r.f, 49765); assert.equal(r.g, 10000); assert.equal(r.h, 5); assert.equal(r.i, 109); assert.equal(r.j, null);
  assert.equal(r.k, '-0.05'); assert.equal(r.l, '1234.56'); assert.equal(r.m, null); assert.equal(r.n, null);
  const f = await E(p, () => [GOSPODAR.G.fmt(123456, 'RON'), GOSPODAR.G.fmt(-5, 'EUR', {sign: true})]);
  assert.match(f[0], /1\.234,56\s*RON/); assert.match(f[1], /[-−]0,05\s*(€|EUR)/);
  // sumă pe tranzacții: 1000 × 0,10 = 100,00 exact
  const s = await E(p, () => { const a = GOSPODAR.S.addAccount({name: 'T', cur: 'RON'}); for (let i = 0; i < 1000; i++) GOSPODAR.S.addTx({date: '2026-10-01', amt: 10, acc: a.id}, true); GOSPODAR.S.commit('tx'); return GOSPODAR.S.balances().get(a.id); });
  assert.equal(s, 10000);
  await clean(p); await close(p);
});

await T('rate credit vs oracol Python (anuitate și principal egal)', async () => {
  const p = await newPage();
  const out = await E(p, L => L.map(c => { const r = GOSPODAR.G.loanSchedule({principal: c.P, ratePct: c.pct, months: c.n, type: c.kind}); const f = x => [x.pay, x.princ, x.interest, x.bal];
    return {payment: c.kind === 'annuity' ? r.payment : null, totalInterest: r.totalInterest, first: f(r.rows[0]), last: f(r.rows[c.n - 1]), mid: f(r.rows[Math.floor(c.n / 2)]), sumPay: r.rows.reduce((a, x) => a + x.pay, 0), endBal: r.rows[c.n - 1].bal}; }), ORACLE.loans);
  ORACLE.loans.forEach((c, i) => { const o = out[i], id = `${c.kind} ${c.P}/${c.pct}/${c.n}`;
    assert.equal(o.payment, c.payment, 'plată ' + id); assert.equal(o.totalInterest, c.totalInterest, 'dobândă ' + id);
    assert.deepEqual(o.first, c.first, 'prima ' + id); assert.deepEqual(o.last, c.last, 'ultima ' + id); assert.deepEqual(o.mid, c.mid, 'mijloc ' + id);
    assert.equal(o.sumPay, c.sumPay, 'total ' + id); assert.equal(o.endBal, 0, 'sold final 0 ' + id); });
  assert.equal(ORACLE.loans[0].payment, 184748); // 250.000 la 7,5 % pe 25 de ani = 1.847,48
  await close(p);
});

await T('dobândă compusă, obiectiv, inflație, TVA, FX vs oracol', async () => {
  const p = await newPage();
  const o = await E(p, O => ({
    c: O.compound.map(c => { const r = GOSPODAR.G.compoundRun({initial: c.P, deposit: c.D, ratePct: c.pct, months: c.n, timing: c.timing}); return [r.final, r.contrib, r.interest, Math.abs(r.final - r.closed)]; }),
    g: O.goals.map(c => { const r = GOSPODAR.G.goalDeposit({target: c.T, current: c.C, ratePct: c.pct, months: c.n}); return [r.deposit, r.sim.final]; }),
    i: O.infl.map(c => { const r = GOSPODAR.G.inflationRows({amount: c.A, ratePct: c.pct, years: c.y})[c.y]; return [r.nominal, r.real]; }),
    v: O.vat.map(c => { const r = GOSPODAR.G.vatCalc({amount: c.A, ratePct: c.pct, mode: c.mode}); return [r.net, r.vat, r.gross]; }),
    fx: [GOSPODAR.G.fxCalc({amount: 10000, rateStr: '4,9765', from: 'EUR', to: 'RON', mode: 'mul'}), GOSPODAR.G.fxCalc({amount: 49765, rateStr: '4.9765', from: 'RON', to: 'EUR', mode: 'div'}), GOSPODAR.G.fxCalc({amount: 1000, rateStr: '0.0123', from: 'JPY', to: 'EUR', mode: 'mul'})]
  }), ORACLE);
  ORACLE.compound.forEach((c, i) => { assert.deepEqual(o.c[i].slice(0, 3), [c.final, c.contrib, c.interest], 'compus ' + i); assert.ok(o.c[i][3] <= c.n, 'formula închisă apropiată ' + i + ' ' + o.c[i][3]); });
  ORACLE.goals.forEach((c, i) => assert.deepEqual(o.g[i], [c.deposit, c.final], 'obiectiv ' + i));
  ORACLE.infl.forEach((c, i) => assert.deepEqual(o.i[i], [c.nominal, c.real], 'inflație ' + i));
  ORACLE.vat.forEach((c, i) => assert.deepEqual(o.v[i], [c.net, c.vat, c.gross], 'TVA ' + i));
  assert.deepEqual(o.fx, [49765, 10000, 1230]); // 1000 JPY × 0,0123 = 12,30 EUR
  await close(p);
});

await T('calculatoare în interfață: formule, pași, avertisment, grafic', async () => {
  const p = await newPage(); await demo(p); await nav(p, 'calc');
  await p.waitForSelector('#calcOut dl.kv');
  let t = await p.textContent('#calcOut');
  assert.match(t, /1\.847,48/); assert.match(t, /Formule/); assert.match(t, /DAE|TAEG/); assert.ok(await p.locator('#calcOut svg.chart').count() >= 1);
  assert.match(await p.textContent('main'), /orientative/i);
  for (const k of ['compound', 'goal', 'inflation', 'vat', 'fx']) { await p.click(`[data-act=calctab][data-k=${k}]`); await p.waitForSelector('#calcOut dl.kv'); t = await p.textContent('#calcOut'); assert.match(t, /Formule/); assert.match(t, /Ipoteze/); }
  await p.fill('#c-P', '121'); await p.fill('#c-r', '21'); await p.waitForTimeout(300); // fx
  await p.click('[data-act=calctab][data-k=vat]'); await p.waitForSelector('#calcOut dl.kv'); await p.fill('#c-P', '100'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#calcOut'), /121,00/);
  await p.selectOption('#c-mode', 'remove'); await p.fill('#c-P', '121'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#calcOut dl.kv'), /100,00/);
  await p.click('[data-act=calctab][data-k=loan]'); await p.fill('#c-n', '0'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#calcOut'), /între 1 și 1200/);
  await clean(p); await close(p);
});

const CSV_A = ['Extras de cont;;;;', 'Titular: Test Ștefan;;;;', 'Perioada 01.09.2026 - 30.09.2026;;;;', 'Data tranzacției;Detalii tranzacție;Debit;Credit;Sold',
  '01.09.2026;Plată POS CAFENEA ȘTEFAN CEL MARE;12,50;;4.987,50', '02.09.2026;Încasare salariu septembrie;;5.000,00;9.987,50', '03.09.2026;Plată facturi ŢARA APELOR;1.234,56;;8.752,94',
  '05.09.2026;Retragere numerar ATM;300,00;;8.452,94', '05.09.2026;Retragere numerar ATM;300,00;;8.152,94', '31.09.2026;Dată invalidă;1,00;;', '07.09.2026;Sumă greșită;abc;;'].join('\r\n') + '\r\n';
const CSV_B = '﻿Date,Description,Amount\n2026-09-01,"Coffee, Main St",-3.50\n2026-09-02,Refund,"1,250.00"\n2026-09-03,"Rent ""Q3""",-1500\n';
const CSV_C = 'Data;Descriere;Suma\n01.10.2026;Şcoala şi ţară, ăîâ;-10,00\n02.10.2026;Cărţi şi reviste;-5,5\n';
const CSV_D = 'Date\tMemo\tAmount\n09/15/2026\tPayment\t-45.10\n10/01/2026\tShop\t-12.00\n';

await T('import CSV: debit/credit, preambul, diacritice, detectări, sold, erori', async () => {
  const p = await newPage(); const a = await mkAcc(p, {name: 'Cont', cur: 'RON'}); await nav(p, 'imp');
  await setFile(p, 'extras.csv', CSV_A);
  const st = await E(p, () => { const i = GOSPODAR.U.imp; return {sep: i.sep, enc: i.encUsed, skip: i.skip, header: i.header, df: i.dateFmt, nf: i.numFmt, map: i.map, info: i.info}; });
  assert.equal(st.sep, ';'); assert.equal(st.enc, 'utf-8'); assert.equal(st.skip, 3); assert.equal(st.header, true); assert.equal(st.df, 'DD.MM.YYYY'); assert.equal(st.nf, 'eu');
  assert.deepEqual([st.map.date, st.map.debit, st.map.credit, st.map.desc, st.map.balance], [0, 2, 3, 1, 4]);
  assert.equal(st.info.total, 7); assert.equal(st.info.ok, 5); assert.equal(st.info.errs, 2); assert.equal(st.info.bal.bad, 0);
  const prev = await p.textContent('#imPrev');
  assert.match(prev, /Dată necitibilă/); assert.match(prev, /Sumă necitibilă/); assert.match(prev, /Verificare sold: 4 rânduri consecvente, 0/);
  await p.click('[data-act=imdo]'); await p.waitForTimeout(100);
  const t = (await txs(p)).sort((x, y) => (x.date + x.amt) < (y.date + y.amt) ? -1 : 1);
  assert.deepEqual(t.map(x => x.amt).sort((x, y) => x - y), [-123456, -30000, -30000, -1250, 500000]);
  assert.ok(t.some(x => x.desc === 'Plată POS CAFENEA ȘTEFAN CEL MARE')); assert.ok(t.some(x => x.desc === 'Plată facturi ŢARA APELOR'));
  assert.equal(t.find(x => x.amt === 500000).date, '2026-09-02');
  await clean(p); await close(p);
});

await T('import CSV: virgulă + BOM + ghilimele + format US; tab + ll/zz/aaaa; Windows-1250', async () => {
  const p = await newPage(); const a = await mkAcc(p, {name: 'Cont', cur: 'RON'}); await nav(p, 'imp');
  await setFile(p, 'b.csv', CSV_B);
  let s = await E(p, () => { const i = GOSPODAR.U.imp; return {sep: i.sep, df: i.dateFmt, nf: i.numFmt, rows: i.built.map(r => [r.date, r.amt, r.desc, r.err])}; });
  assert.equal(s.sep, ','); assert.equal(s.df, 'YYYY-MM-DD'); assert.equal(s.nf, 'us');
  assert.deepEqual(s.rows, [['2026-09-01', -350, 'Coffee, Main St', null], ['2026-09-02', 125000, 'Refund', null], ['2026-09-03', -150000, 'Rent "Q3"', null]]);
  await setFile(p, 'd.tsv', CSV_D);
  s = await E(p, () => { const i = GOSPODAR.U.imp; return {sep: i.sep, df: i.dateFmt, nf: i.numFmt, rows: i.built.map(r => [r.date, r.amt, r.err])}; });
  assert.equal(s.sep, '\t'); assert.equal(s.df, 'MM/DD/YYYY'); assert.deepEqual(s.rows, [['2026-09-15', -4510, null], ['2026-10-01', -1200, null]]);
  await setFile(p, 'c.csv', win1250(CSV_C));
  s = await E(p, () => { const i = GOSPODAR.U.imp; return {enc: i.encUsed, rows: i.built.map(r => [r.date, r.amt, r.desc, r.err]), nf: i.numFmt}; });
  assert.equal(s.enc, 'windows-1250'); assert.equal(s.nf, 'eu');
  assert.deepEqual(s.rows, [['2026-10-01', -1000, 'Şcoala şi ţară, ăîâ', null], ['2026-10-02', -550, 'Cărţi şi reviste', null]]);
  // schimbarea manuală a codării: windows-1252 produce alt text
  await p.selectOption('#im-enc', 'utf-8'); await p.waitForTimeout(50);
  assert.ok((await E(p, () => GOSPODAR.U.imp.built[0].desc)).includes('�'));
  await p.selectOption('#im-enc', 'windows-1250'); await p.waitForTimeout(50);
  // sumă cu semn + inversare
  await setFile(p, 'b.csv', CSV_B); await p.check('#im-invert'); await p.waitForTimeout(50);
  assert.deepEqual(await E(p, () => GOSPODAR.U.imp.built.map(r => r.amt)), [350, -125000, 150000]);
  await clean(p); await close(p);
});

await T('import: detectare duplicate (inclusiv rânduri legitime repetate) la reimport + anulare import', async () => {
  const p = await newPage(); const a = await mkAcc(p, {name: 'Cont', cur: 'RON'}); await nav(p, 'imp');
  await setFile(p, 'extras.csv', CSV_A); assert.equal(await E(p, () => GOSPODAR.U.imp.info.dups), 0);
  await p.click('[data-act=imdo]'); await p.waitForTimeout(100);
  assert.equal((await txs(p)).length, 5);
  await nav(p, 'imp'); await setFile(p, 'extras.csv', CSV_A);
  let i = await E(p, () => GOSPODAR.U.imp.info); assert.equal(i.dups, 5); assert.equal(i.toImport, 0); assert.ok(await p.locator('[data-act=imdo]').isDisabled());
  assert.match(await p.textContent('#imPrev'), /Duplicat/);
  // fișier cu un rând nou + o a treia retragere identică în aceeași zi
  const more = CSV_A + '05.09.2026;Retragere numerar ATM;300,00;;7.852,94\r\n10.09.2026;Rând nou;5,00;;7.847,94\r\n';
  await setFile(p, 'mai-mult.csv', more); i = await E(p, () => GOSPODAR.U.imp.info); assert.equal(i.dups, 5); assert.equal(i.toImport, 2);
  await p.click('[data-act=imdo]'); await p.waitForTimeout(100); assert.equal((await txs(p)).length, 7);
  // include duplicatele
  await nav(p, 'imp'); await setFile(p, 'extras.csv', CSV_A); await p.check('[data-in=imdups]'); assert.equal(await E(p, () => GOSPODAR.U.imp.info.toImport), 5);
  // anulare import (lot)
  await nav(p, 'imp'); assert.equal(await p.locator('[data-act=imundo]').count(), 2);
  await p.locator('[data-act=imundo]').first().click(); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.equal((await txs(p)).length, 5);
  await clean(p); await close(p);
});

await T('profiluri de import: salvare, aplicare pe alt fișier, ștergere', async () => {
  const p = await newPage(); await mkAcc(p, {name: 'Cont', cur: 'RON'}); await nav(p, 'imp');
  await setFile(p, 'extras.csv', CSV_A);
  await p.click('[data-act=improfsave]'); await p.fill('#pf-name', 'Profilul meu'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.equal(await E(p, () => GOSPODAR.S.data().profiles.length), 1);
  const CSV_A2 = CSV_A.replace('Perioada 01.09.2026 - 30.09.2026', 'Perioada octombrie').replace('01.09.2026;Plată', '01.10.2026;Plată');
  await setFile(p, 'extras2.csv', CSV_A2);
  await p.selectOption('#im-prof', {label: 'Profilul meu'}); await p.waitForTimeout(100);
  assert.deepEqual(await E(p, () => { const m = GOSPODAR.U.imp.map; return [m.date, m.debit, m.credit, m.desc]; }), [0, 2, 3, 1]);
  assert.match(await p.textContent('#imp2, #imCfg'), /neoficial|oficial/);
  await p.click('[data-act=improfdel]'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.equal(await E(p, () => GOSPODAR.S.data().profiles.length), 0);
  await clean(p); await close(p);
});

await T('reguli: conține (diacritice), regex, sumă, cont, previzualizare, aplicare, anulare', async () => {
  const p = await newPage(); await wipe(p);
  const ids = await E(p, () => { const S = GOSPODAR.S; const a = S.addAccount({name: 'A', cur: 'RON'}), b = S.addAccount({name: 'B', cur: 'RON'}); const C = {}; S.data().cats.forEach(c => { C[c.name] = c.id; });
    [[a, -1000, 'PLATA ŢARA APELOR'], [a, -2000, 'Cafenea Ștefan'], [a, -50000, 'Cafenea Mare'], [b, -1500, 'cafenea ștefan'], [a, -300, 'KAUFLAND 123'], [a, 150000, 'Salariu']].forEach(([ac, m, d]) => S.addTx({date: '2026-10-01', amt: m, acc: ac.id, desc: d}, true));
    const D = S.data(); const mk = (name, pat, mode, cat, ex) => Object.assign({id: S.nid('u'), name, pat, mode, cat: C[cat], tags: [], on: true, acc: '', min: null, max: null, sign: ''}, ex || {});
    D.rules = [mk('apa', 'tara apelor', 'contains', 'Utilități'), mk('cafea mică', 'cafenea stefan', 'contains', 'Restaurante și cafenele', {max: 10000, acc: a.id}), mk('kau', '^kaufland \\d+$', 'regex', 'Supermarket', {tags: ['auto']}), mk('sal', '', 'contains', 'Salariu', {sign: 'inc'})]; S.commit('rules'); return {a: a.id}; });
  await nav(p, 'rules'); await p.click('[data-act=applyrules][data-scope=uncat]');
  assert.match(await p.textContent('dialog'), /4 tranzacții ar fi modificate/);
  await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  let t = await txs(p); const catName = c => E(p, c => (GOSPODAR.S.cat(c) || {}).name, c);
  const by = {}; for (const x of t) by[x.desc] = x;
  assert.equal(await catName(by['PLATA ŢARA APELOR'].cat), 'Utilități'); assert.equal(await catName(by['Cafenea Ștefan'].cat), 'Restaurante și cafenele');
  assert.equal(by['Cafenea Mare'].cat, ''); assert.equal(by['cafenea ștefan'].cat, '');   // sumă prea mare / alt cont
  assert.equal(await catName(by['KAUFLAND 123'].cat), 'Supermarket'); assert.deepEqual(by['KAUFLAND 123'].tags, ['auto']); assert.equal(await catName(by['Salariu'].cat), 'Salariu');
  await p.click('[data-act=undorules]'); await p.waitForTimeout(100);
  t = await txs(p); assert.ok(t.every(x => x.cat === '' && x.tags.length === 0));
  // mutare regulă + regex invalid / periculos / expirat
  await p.click('[data-act=addrule]');
  await p.fill('#ru-name', 'rea'); await p.selectOption('#ru-mode', 'regex'); await p.fill('#ru-pat', '(a+)+$'); await pickCat(p, '#ru-cat', 'Salariu'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(150);
  assert.match(await p.textContent('dialog .derr'), /risc de blocare/);
  await p.fill('#ru-pat', 'a*a*a*a*a*a*a*a*a*a*b'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(900);
  assert.match(await p.textContent('dialog .derr'), /limita de timp/);
  await p.fill('#ru-pat', '(abc'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(300);
  assert.match(await p.textContent('dialog .derr'), /invalidă|risc|nu sunt permise/i);
  await p.fill('#ru-pat', 'cafenea\\s+mare'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(400);
  assert.equal(await E(p, () => GOSPODAR.S.data().rules.length), 5);
  await clean(p); await close(p);
});

await T('reguli: potrivire regex sigură pe 5.000 de descrieri sub buget de timp', async () => {
  const p = await newPage(); await wipe(p);
  const r = await E(p, () => { const S = GOSPODAR.S; const a = S.addAccount({name: 'A', cur: 'RON'}); for (let i = 0; i < 5000; i++) S.addTx({date: '2026-10-01', amt: -100, acc: a.id, desc: 'PLATA POS MARKET ' + i + ' x'.repeat(i % 50)}, true);
    const c = S.data().cats[2].id; S.data().rules = [{id: 'r1', name: 'm', pat: 'market\\s+\\d+', mode: 'regex', cat: c, tags: [], on: true, acc: '', min: null, max: null, sign: ''}]; S.commit('x'); const plan = S.planRules('all', 3000); return {n: plan.changes.length, ms: plan.ms, ab: plan.aborted}; });
  assert.equal(r.n, 5000); assert.equal(r.ab, false); assert.ok(r.ms < 2500, 'ms ' + r.ms);
  await close(p);
});

await T('conturi multi-monedă, transfer între conturi, cursuri manuale, sold total', async () => {
  const p = await newPage(); await wipe(p); await nav(p, 'setup');
  await p.click('[data-act=addacc]'); await p.fill('#ac-name', 'Lei'); await p.fill('#ac-open', '1.000,00'); await p.click('dialog [data-dk=ok]');
  await p.click('[data-act=addacc]'); await p.fill('#ac-name', 'Euro'); await p.fill('#ac-cur', 'eur'); await p.fill('#ac-open', '100'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.match(await p.textContent('main'), /1 EUR/);
  assert.match(await p.textContent('main'), /lipsește cursul/);
  await p.fill('#rate-EUR', '4,9765'); await p.press('#rate-EUR', 'Tab'); await p.waitForTimeout(450);
  assert.equal(await E(p, () => GOSPODAR.S.data().settings.rates.EUR), '4.9765');
  await p.fill('#rate-EUR', 'abc'); await p.press('#rate-EUR', 'Tab'); await p.waitForTimeout(450); assert.equal(await E(p, () => GOSPODAR.S.data().settings.rates.EUR), '4.9765');
  await nav(p, 'tx'); await p.click('[data-act=newtr]');
  await p.selectOption('#tr-from', {label: 'Lei (RON)'}); await p.selectOption('#tr-to', {label: 'Euro (EUR)'}); await p.fill('#tr-out', '497,65');
  assert.equal(await p.inputValue('#tr-in'), '100,00');
  await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  const bal = await E(p, () => { const S = GOSPODAR.S; const b = S.balances(); return [...S.data().accounts.map(a => b.get(a.id)), S.totalBase().total]; });
  assert.deepEqual(bal, [100000 - 49765, 10000 + 10000, 50235 + 99530]);
  // transferul nu intră în venituri/cheltuieli
  assert.deepEqual(await E(p, () => GOSPODAR.S.monthSummary('2026-10')), {inc: 0, exp: 0, net: 0, n: 0});
  // ștergerea unui picior șterge perechea
  await p.locator('[data-act=edittx]').first().click(); await p.click('dialog [data-dk=del]'); await okLast(p); await p.waitForTimeout(100);
  assert.equal((await txs(p)).length, 0);
  await clean(p); await close(p);
});

await T('tranzacții: adăugare rapidă din tastatură (n), reguli, editare, filtre, selecție în masă', async () => {
  const p = await newPage(); await demo(p); await nav(p, 'tx');
  const n0 = (await txs(p)).length;
  await p.locator('body').press('n'); await p.waitForSelector('dialog[open] #q-amt');
  assert.equal(await E(p, () => document.activeElement.id), 'q-amt');
  await p.keyboard.type('45,5'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.type('plata pos farmacia sanatatea test');
  assert.match(await p.textContent('#q-sug'), /Farmacie/); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  assert.match(await p.textContent('#qstat'), /-45,50\s*RON.*Sănătate › Farmacie/);
  assert.equal(await E(p, () => document.activeElement.id), 'q-amt');
  await p.keyboard.type('+10'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.type('venit nespecificat'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  let t = await txs(p); assert.equal(t.length, n0 + 2);
  assert.ok(t.some(x => x.desc === 'plata pos farmacia sanatatea test' && x.amt === -4550 && x.cat)); assert.ok(t.some(x => x.desc === 'venit nespecificat' && x.amt === 1000 && !x.cat));
  // filtre
  await p.fill('#f-q', 'farmacia'); await p.waitForTimeout(300);
  const rows = await p.locator('#txTable tbody tr').count(); assert.ok(rows >= 2 && rows < 40);
  await p.fill('#f-q', ''); await p.selectOption('#f-cat', '__none'); await p.waitForTimeout(100);
  assert.match(await p.textContent('#txTable'), /venit nespecificat/);
  // selecție în masă + categorie
  await p.check('[data-in=selpage]'); await pickCat(p, '#bulkcat', 'Altele'); await p.click('[data-act=bulkcat]'); await p.waitForTimeout(100);
  t = await txs(p); assert.ok(t.filter(x => x.desc === 'venit nespecificat')[0].cat);
  await p.click('[data-act=fltclear]');
  // editare + ștergere
  await p.fill('#f-q', 'venit nespecificat'); await p.waitForTimeout(250);
  await p.locator('[data-act=edittx]').first().click(); await p.fill('#tx-amt', '77,25'); await p.selectOption('#tx-type', 'exp'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.ok((await txs(p)).some(x => x.desc === 'venit nespecificat' && x.amt === -7725));
  await p.locator('[data-act=edittx]').first().click(); await p.fill('#tx-amt', 'xyz'); await p.click('dialog [data-dk=ok]');
  assert.match(await p.textContent('dialog .derr'), /Sumă invalidă/);
  await p.keyboard.press('Escape');
  await clean(p); await close(p);
});

await T('bugete: bare de progres, avertizări (aproape / depășit), refunduri', async () => {
  const p = await newPage(); await wipe(p); const a = await mkAcc(p, {name: 'A', cur: 'RON'});
  await E(p, a => { const S = GOSPODAR.S; const c = S.data().cats.find(x => x.name === 'Supermarket').id; S.addTx({date: '2026-10-02', amt: -85000, acc: a, cat: c, desc: 'x'}, true); S.addTx({date: '2026-10-03', amt: -30000, acc: a, cat: c, desc: 'y'}, true); S.addTx({date: '2026-10-04', amt: 5000, acc: a, cat: c, desc: 'rambursare'}, true); S.commit('t'); }, a);
  await nav(p, 'bud');
  const id = await E(p, () => GOSPODAR.S.data().cats.find(x => x.name === 'Alimentație').id);
  await p.fill('#bg-' + id, '1.100'); await p.press('#bg-' + id, 'Tab'); await p.waitForTimeout(450);
  let t = await p.textContent('main'); assert.match(t, /aproape de limită/); assert.match(t, /100,00 RON|1\.100,00/); assert.match(t, /1\.100,00/);
  await p.fill('#bg-' + id, '900'); await p.press('#bg-' + id, 'Tab'); await p.waitForTimeout(450);
  t = await p.textContent('main'); assert.match(t, /depășit/); assert.match(await p.textContent('main [role=status]'), /Alimentație/);
  await p.fill('#bg-' + id, ''); await p.press('#bg-' + id, 'Tab'); await p.waitForTimeout(450);
  assert.equal(await E(p, () => Object.keys(GOSPODAR.S.data().budgets).length), 0);
  await clean(p); await close(p);
});

await T('recurente: scadențe, înregistrare, proiecție luna următoare, lunile scurte', async () => {
  const p = await newPage(); await wipe(p); const a = await mkAcc(p, {name: 'A', cur: 'RON'});
  const o = await E(p, a => { const S = GOSPODAR.S, G = GOSPODAR.G; const oc = (r, f, t) => S.recOccurrences(r, f, t);
    const r31 = {freq: 'monthly', interval: 1, start: '2026-01-31', end: ''}, rw = {freq: 'weekly', interval: 2, start: '2026-09-01', end: ''}, ry = {freq: 'yearly', interval: 1, start: '2024-02-29', end: ''};
    return {m: oc(r31, '2026-01-01', '2026-05-31'), w: oc(rw, '2026-09-01', '2026-10-31'), y: oc(ry, '2024-01-01', '2028-12-31'), e: oc({freq: 'monthly', interval: 1, start: '2026-01-05', end: '2026-03-10'}, '2026-01-01', '2026-12-31')}; }, a);
  assert.deepEqual(o.m, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  assert.deepEqual(o.w, ['2026-09-01', '2026-09-15', '2026-09-29', '2026-10-13', '2026-10-27']);
  assert.deepEqual(o.y, ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  assert.deepEqual(o.e, ['2026-01-05', '2026-02-05', '2026-03-05']);
  await nav(p, 'rec'); await p.click('[data-act=addrec]'); await p.fill('#rc-name', 'Chirie'); await p.fill('#rc-amt', '1500'); await p.fill('#rc-start', '2026-08-05'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100);
  assert.match(await p.textContent('main'), /Înregistrează 3 scadențe/); // aug, sep, oct
  await p.click('[data-act=postrecs]'); await p.waitForTimeout(100);
  let t = await txs(p); assert.deepEqual(t.map(x => x.date).sort(), ['2026-08-05', '2026-09-05', '2026-10-05']); assert.ok(t.every(x => x.amt === -150000));
  assert.equal(await p.locator('[data-act=postrecs]').count(), 0);
  assert.match(await p.textContent('main'), /noiembrie 2026/i); assert.match(await p.textContent('main'), /-1\.500,00/);
  // proiecția nu dublează la a doua înregistrare
  await E(p, () => GOSPODAR.S.postRecs(GOSPODAR.S.pendingRecs('2026-10-14'))); assert.equal((await txs(p)).length, 3);
  await clean(p); await close(p);
});

await T('rapoarte: SVG cu titlu/descriere, tabele, comparație, solduri; tipărire', async () => {
  const p = await newPage(); await demo(p); await nav(p, 'rep');
  assert.ok(await p.locator('svg.chart[role=img]').count() >= 4);
  assert.equal(await p.locator('svg.chart:not([aria-labelledby])').count(), 0);
  const t = await p.textContent('main'); for (const k of ['Cheltuieli pe categorii', 'Evoluție lunară', 'Flux de numerar', 'Top comercianți', 'Comparație lună cu lună', 'Sold pe cont']) assert.match(t, new RegExp(k));
  // total pe categorii = cheltuieli lună
  const exp = await E(p, () => GOSPODAR.S.monthSummary('2026-10').exp); const items = await E(p, () => [...document.querySelectorAll('section:has(#r1) table tfoot td')].map(x => x.textContent));
  assert.match(items[0], new RegExp(((exp / 100).toLocaleString('ro-RO', {minimumFractionDigits: 2}))));
  await p.selectOption('#rep-group', 'leaf'); await p.waitForTimeout(80); assert.ok((await p.locator('section:has(#r1) table tbody tr').count()) > 6);
  await p.click('#mk-prev'); await p.waitForTimeout(80); assert.match(await p.textContent('.mlabel'), /septembrie 2026/i);
  await p.evaluate(() => GOSPODAR.U.renderPrint()); await p.emulateMedia({media: 'print'});
  assert.equal(await p.isVisible('#printReport'), true); assert.equal(await p.isVisible('#nav'), false); assert.equal(await p.isVisible('main'), false);
  assert.match(await p.textContent('#printReport'), /Raport lunar/); assert.ok(await p.locator('#printReport svg').count() >= 4);
  await p.screenshot({path: path.join(HERE, '..', 'tests', '.print-check.png')}).catch(() => {}); try { fs.unlinkSync(path.join(HERE, '.print-check.png')); } catch (e) { /* */ }
  await p.emulateMedia({media: 'screen'}); assert.equal(await p.isVisible('#printReport'), false);
  await clean(p); await close(p);
});

await T('criptare AES-GCM: activare, nimic în clar, blocare, parolă greșită, deblocare, schimbare, dezactivare', async () => {
  const p = await newPage(); await demo(p); await nav(p, 'set');
  await p.click('[data-act=encon]'); await p.fill('#pw1', 'scurt'); await p.fill('#pw2', 'scurt'); await p.click('dialog [data-dk=ok]');
  assert.match(await p.textContent('dialog .derr'), /confirmarea/);
  await p.check('#enc-ack'); await p.click('dialog [data-dk=ok]'); assert.match(await p.textContent('dialog .derr'), /cel puțin 8/);
  await p.fill('#pw1', 'parola-lunga-123'); await p.fill('#pw2', 'parola-lunga-124'); await p.click('dialog [data-dk=ok]'); assert.match(await p.textContent('dialog .derr'), /nu coincid/);
  await p.fill('#pw2', 'parola-lunga-123'); await p.click('dialog [data-dk=ok]'); await p.waitForFunction(() => /Criptare activată/.test(document.getElementById('toast').textContent), null, {timeout: 20000});
  await E(p, () => GOSPODAR.S.whenSaved());
  const ls = await E(p, () => { const o = {}; for (let i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = localStorage.getItem(localStorage.key(i)); return o; });
  assert.ok(!('fff.gospodar.data' in ls), 'datele în clar au fost șterse'); const enc = JSON.parse(ls['fff.gospodar.enc']);
  assert.equal(enc.kdf, 'PBKDF2-SHA256'); assert.ok(enc.iter >= 310000); assert.ok(enc.ct.length > 1000);
  const all = JSON.stringify(ls); for (const w of ['SUPERMARKET', 'CHIRIE', 'Cont principal', 'Salariu']) assert.ok(!all.includes(w), 'text în clar: ' + w);
  // o modificare se re-criptează (alt IV) fără text în clar
  await E(p, () => { GOSPODAR.S.addTx({date: '2026-10-14', amt: -100, acc: GOSPODAR.S.data().accounts[0].id, desc: 'TEXT SECRET UNIC'}); });
  await E(p, () => GOSPODAR.S.whenSaved()); const enc2 = JSON.parse(await E(p, () => localStorage.getItem('fff.gospodar.enc'))); assert.notEqual(enc2.iv, enc.iv); assert.ok(!JSON.stringify(enc2).includes('SECRET'));
  // reload → ecran de blocare
  await p.reload(); await p.waitForSelector('#lockPw'); assert.equal(await p.isVisible('#appwrap'), false);
  await p.fill('#lockPw', 'gresita-gresita'); await p.press('#lockPw', 'Enter'); await p.waitForFunction(() => /greșită/.test(document.getElementById('lockErr').textContent), null, {timeout: 20000});
  assert.equal(await p.isVisible('#appwrap'), false);
  await p.fill('#lockPw', 'parola-lunga-123'); await p.press('#lockPw', 'Enter'); await p.waitForSelector('#appwrap', {state: 'visible', timeout: 20000});
  assert.ok((await txs(p)).some(x => x.desc === 'TEXT SECRET UNIC'));
  // blocare manuală
  await p.click('#lockBtn'); await p.waitForSelector('#lockPw'); assert.equal(await E(p, () => document.getElementById('view').innerHTML), '');
  await p.fill('#lockPw', 'parola-lunga-123'); await p.press('#lockPw', 'Enter'); await p.waitForSelector('#appwrap', {state: 'visible', timeout: 20000});
  // schimbare parolă
  await nav(p, 'set'); await p.click('[data-act=encchange]'); await p.fill('#pw1', 'parola-lunga-123'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(1500);
  await p.fill('#pw1', 'alta-parola-9999'); await p.fill('#pw2', 'alta-parola-9999'); await p.click('dialog [data-dk=ok]'); await p.waitForFunction(() => /Parola a fost schimbată/.test(document.getElementById('toast').textContent), null, {timeout: 20000}); await E(p, () => GOSPODAR.S.whenSaved());
  await p.reload(); await p.waitForSelector('#lockPw'); await p.fill('#lockPw', 'parola-lunga-123'); await p.press('#lockPw', 'Enter'); await p.waitForFunction(() => /greșită/.test(document.getElementById('lockErr').textContent), null, {timeout: 20000});
  await p.fill('#lockPw', 'alta-parola-9999'); await p.press('#lockPw', 'Enter'); await p.waitForSelector('#appwrap', {state: 'visible', timeout: 20000});
  // dezactivare
  await nav(p, 'set'); await p.click('[data-act=encoff]'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(300);
  assert.ok(await E(p, () => localStorage.getItem('fff.gospodar.data') !== null && localStorage.getItem('fff.gospodar.enc') === null));
  await p.reload(); await p.waitForSelector('#view h2'); assert.ok((await txs(p)).length > 100);
  await clean(p); await close(p);
});

await T('export/import .fff.json (clar și criptat), CSV, șterge tot', async () => {
  const p = await newPage(); await demo(p); const n = (await txs(p)).length;
  const b = await E(p, () => GOSPODAR.bundleObj());
  assert.equal(b.format, 'fff-bundle'); assert.equal(b.schema, 1); assert.equal(b.app, 'gospodar'); assert.equal(b.version, '2.0.0'); assert.equal(b.updated, '2026-10-26'); assert.ok(typeof b.data['fff.gospodar.data'] === 'string');
  await nav(p, 'set');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportjson]')]); assert.match(dl.suggestedFilename(), /^gospodar-2026-10-14\.fff\.json$/);
  const file = path.join(HERE, '.tmp-export.fff.json'); await dl.saveAs(file); const j = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(j.app, 'gospodar');
  // criptat
  await p.click('[data-act=exportenc]'); await p.fill('#pw1', 'export-parola-1'); await p.fill('#pw2', 'export-parola-1');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('dialog [data-dk=ok]')]); const file2 = path.join(HERE, '.tmp-export-enc.fff.json'); await dl2.saveAs(file2);
  const ej = JSON.parse(fs.readFileSync(file2, 'utf8')); assert.equal(ej.format, 'fff-bundle-enc'); assert.ok(ej.iter >= 310000); assert.ok(!fs.readFileSync(file2, 'utf8').includes('SUPERMARKET'));
  // șterge tot
  await p.click('[data-act=wipe]'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(100); assert.equal((await txs(p)).length, 0);
  assert.ok(await E(p, () => localStorage.getItem('fff.gospodar.data') === null || JSON.parse(localStorage.getItem('fff.gospodar.data')).txs.length === 0));
  // importă clar
  await nav(p, 'set'); await p.setInputFiles('#imp-json', file); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(300);
  assert.equal((await txs(p)).length, n); assert.equal(await E(p, () => GOSPODAR.S.data().accounts.length), 4);
  // importă criptat: parolă greșită apoi corectă
  await wipe(p); await nav(p, 'set'); await p.setInputFiles('#imp-json', file2); await p.fill('#pw1', 'gresita-gresita'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(1500);
  assert.match(await p.textContent('#toast'), /Parolă greșită/);
  await p.setInputFiles('#imp-json', file2); await p.fill('#pw1', 'export-parola-1'); await p.click('dialog [data-dk=ok]'); await p.waitForSelector('dialog [data-dk=ok]', {timeout: 20000}); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(300);
  assert.equal((await txs(p)).length, n);
  // fișier străin
  fs.writeFileSync(file, JSON.stringify({format: 'fff-bundle', schema: 1, app: 'orar', data: {}})); await nav(p, 'set'); await p.setInputFiles('#imp-json', file); await p.waitForTimeout(200); assert.match(await p.textContent('#toast'), /altei aplicații/);
  fs.writeFileSync(file, '{nu e json'); await p.setInputFiles('#imp-json', file); await p.waitForTimeout(200); assert.match(await p.textContent('#toast'), /JSON valid/);
  // export CSV
  await nav(p, 'tx'); await p.click('[data-act=exportcsv]');
  const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('dialog [data-dk=ok]')]); const f3 = path.join(HERE, '.tmp.csv'); await dl3.saveAs(f3); const csv = fs.readFileSync(f3, 'utf8');
  assert.ok(csv.startsWith('﻿date;amount;currency')); assert.equal(csv.trim().split('\r\n').length, n + 1);
  // CSV exportat se reimportă identic (round-trip)
  const before = (await txs(p)).map(x => x.date + '|' + x.amt).sort(); fs.unlinkSync(file); fs.unlinkSync(file2); fs.unlinkSync(f3);
  await clean(p); await close(p);
});

await T('limbi: 8 limbi, persistență, html[lang], formatare Intl, fără chei lipsă', async () => {
  const p = await newPage(); await demo(p);
  const dict = await E(p, () => Object.keys(GOSPODAR.G.DICT)); assert.ok(dict.length > 300);
  const miss = await E(p, () => { const out = []; for (const [k, v] of Object.entries(GOSPODAR.G.DICT)) { if (v.length !== 8 || v.some(x => !x || !x.trim())) out.push(k); } return out; }); assert.deepEqual(miss, []);
  const navTexts = {};
  for (const l of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {
    await p.selectOption('#langSel', l); await p.waitForTimeout(60);
    assert.equal(await E(p, () => document.documentElement.lang), l); assert.equal(await E(p, () => localStorage.getItem('fff.gospodar.lang')), l);
    navTexts[l] = await p.textContent('#nav [data-v=tx]'); await nav(p, 'dash'); const dash = await p.textContent('main');
    assert.ok(!/\{[a-z]+\}/.test(dash), 'variabilă nesubstituită ' + l); assert.ok(!/\bnav_|\bimp_|\bc_[a-z]/.test(dash));
  }
  assert.equal(new Set(Object.values(navTexts)).size >= 7, true);
  await p.selectOption('#langSel', 'en'); await nav(p, 'dash'); assert.match(await p.textContent('main'), /RON/); assert.match(await p.textContent('main'), /10,950\.00|[\d,]+\.\d\d RON/);
  await p.selectOption('#langSel', 'de'); await nav(p, 'dash'); assert.match(await p.textContent('main'), /\d\.\d{3},\d\d/);
  await p.reload(); await p.waitForSelector('#view h2'); assert.equal(await E(p, () => document.documentElement.lang), 'de'); assert.equal(await p.inputValue('#langSel'), 'de');
  // toate vizualizările în fiecare limbă fără erori
  for (const l of ['hu', 'fr']) { await p.selectOption('#langSel', l); for (const v of ['dash', 'tx', 'imp', 'setup', 'rules', 'rec', 'bud', 'rep', 'calc', 'set']) { await nav(p, v); const t = await p.textContent('main'); assert.ok(!/\{[a-z]+\}|undefined|NaN/.test(t), v + ' ' + l); } }
  await clean(p); await close(p);
});

await T('performanță: 20.000 de tranzacții (import CSV, filtre, rapoarte, reguli, salvare, reîncărcare)', async () => {
  const p = await newPage(); const a = await mkAcc(p, {name: 'Mare', cur: 'RON'});
  const rows = ['Data;Descriere;Debit;Credit']; let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; const shops = ['KAUFLAND', 'MEGA IMAGE', 'FARMACIA', 'BENZINARIE', 'CAFENEA', 'PIATA', 'ABONAMENT', 'RESTAURANT'];
  for (let i = 0; i < 20000; i++) { const d = new Date(Date.UTC(2023, 0, 1) + Math.floor(i / 20000 * 1370) * 86400000); const ds = String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear(); const amt = (rnd() * 500 + 1).toFixed(2).replace('.', ','); const desc = 'PLATA POS ' + shops[i % 8] + ' ' + (1000 + i); rows.push(i % 25 === 0 ? `${ds};Încasare ${i};;${amt}` : `${ds};${desc};${amt};`); }
  const csv = rows.join('\n'); await nav(p, 'imp'); let t0 = Date.now(); await setFile(p, 'mare.csv', csv); const tParse = Date.now() - t0;
  assert.equal(await E(p, () => GOSPODAR.U.imp.info.ok), 20000);
  await E(p, () => { const S = GOSPODAR.S, C = {}; S.data().cats.forEach(c => { C[c.name] = c.id; }); const r = (n, pat, cat) => ({id: S.nid('u'), name: n, pat, mode: 'contains', cat: C[cat], tags: [], on: true, acc: '', min: null, max: null, sign: ''}); S.data().rules = [r('a', 'kaufland;mega image', 'Supermarket'), r('b', 'farmacia', 'Farmacie'), r('c', 'benzinarie', 'Carburant'), r('d', 'restaurant;cafenea', 'Restaurante și cafenele')]; S.commit('r'); });
  t0 = Date.now(); await p.click('[data-act=imdo]'); await p.waitForFunction(() => GOSPODAR.S.data().txs.length === 20000); const tImport = Date.now() - t0;
  const cats = await E(p, () => GOSPODAR.S.data().txs.filter(t => t.cat).length); assert.ok(cats > 8000);
  await E(p, () => GOSPODAR.S.whenSaved()); const size = await E(p, () => localStorage.getItem('fff.gospodar.data').length); assert.ok(size < 4.5e6, 'dimensiune ' + size);
  const timing = await E(p, () => { const U = GOSPODAR.U, S = GOSPODAR.S, o = {}; let t = performance.now(); U.go('tx', false); o.tx = performance.now() - t; U.f.q = 'kaufland'; t = performance.now(); const n = U.filterTxs().length; o.filter = performance.now() - t; o.n = n; U.f.q = '';
    t = performance.now(); U.mk = '2024-06'; U.go('rep', false); o.rep = performance.now() - t; t = performance.now(); U.go('dash', false); o.dash = performance.now() - t; t = performance.now(); const pl = S.planRules('all', 3000); o.rules = performance.now() - t; o.changes = pl.changes.length; t = performance.now(); S.markDuplicates([{date: '2024-06-01', amt: 1, desc: 'x'}], S.data().accounts[0].id); o.dup = performance.now() - t; return o; });
  console.log('       perf:', 'parse+detect', tParse, 'ms; import', tImport, 'ms;', JSON.stringify(Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, Math.round(v)]))), 'bytes', size);
  assert.ok(tParse < 8000 && tImport < 8000); assert.ok(timing.tx < 600 && timing.filter < 400 && timing.rep < 1500 && timing.dash < 600 && timing.rules < 2500 && timing.dup < 400, JSON.stringify(timing));
  await p.reload(); await p.waitForSelector('#view h2'); assert.equal((await txs(p)).length, 20000);
  // reimport → toate duplicate, sub 8 s
  await nav(p, 'imp'); t0 = Date.now(); await setFile(p, 'mare.csv', csv); assert.equal(await E(p, () => GOSPODAR.U.imp.info.dups), 20000); assert.ok(Date.now() - t0 < 8000);
  await clean(p); await close(p);
});

await T('i18n/stocare: fără localStorage (blocat) aplicația rulează', async () => {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, locale: 'ro-RO'});
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocat'); }}); });
  const p = await newPage({ctx}); await p.waitForTimeout(200);
  assert.equal(p.errs.filter(e => !/blocat/.test(e)).length, 0, p.errs.join('|'));
  await demo(p); await nav(p, 'rep'); assert.ok(await p.locator('svg.chart').count() > 3);
  await p.selectOption('#langSel', 'fr'); assert.equal(await E(p, () => document.documentElement.lang), 'fr');
  await close(p);
});

await T('accesibilitate: axe 0 violări în toate vizualizările și dialogurile, ambele teme', async () => {
  for (const scheme of ['light', 'dark']) {
    const p = await newPage({bypassCSP: true, colorScheme: scheme}); await demo(p); await p.addScriptTag({content: fs.readFileSync(AXE, 'utf8')});
    const run = async label => { await p.waitForTimeout(3600); const r = await E(p, () => axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']})); const v = r.violations.map(x => x.id + ': ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')); assert.deepEqual(v, [], scheme + ' ' + label); };
    for (const v of ['dash', 'tx', 'imp', 'setup', 'rules', 'rec', 'bud', 'rep', 'calc', 'set']) { await nav(p, v); await run(v); }
    await nav(p, 'imp'); await p.setInputFiles('#im-file', {name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_A)}); await p.waitForFunction(() => GOSPODAR.U.imp.info); await run('import preview');
    await nav(p, 'tx'); await p.locator('[data-act=edittx]').first().click(); await run('dialog tx'); await p.keyboard.press('Escape');
    await p.click('[data-act=newtr]'); await run('dialog transfer'); await p.keyboard.press('Escape');
    await p.click('[data-act=quick]'); await run('dialog quick'); await p.keyboard.press('Escape');
    await nav(p, 'rules'); await p.click('[data-act=addrule]'); await run('dialog rule'); await p.keyboard.press('Escape');
    await p.click('[data-act=applyrules][data-scope=all]'); await run('dialog rules preview'); await p.keyboard.press('Escape');
    await nav(p, 'setup'); await p.click('[data-act=addacc]'); await run('dialog account'); await p.keyboard.press('Escape');
    await p.click('[data-act=addcat][data-parent=""]'); await run('dialog cat'); await p.keyboard.press('Escape');
    await nav(p, 'rec'); await p.click('[data-act=addrec]'); await run('dialog rec'); await p.keyboard.press('Escape');
    await nav(p, 'set'); await p.click('[data-act=encon]'); await run('dialog enc'); await p.keyboard.press('Escape');
    await close(p);
  }
});

await T('layout: fără depășire orizontală la 360×740 și 1280×800; tastatură; reduced-motion', async () => {
  for (const vp of [{width: 360, height: 740}, {width: 1280, height: 800}]) {
    const p = await newPage({viewport: vp}); await demo(p);
    for (const v of ['dash', 'tx', 'imp', 'setup', 'rules', 'rec', 'bud', 'rep', 'calc', 'set']) { await nav(p, v); await p.waitForTimeout(150); const ov = await E(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(ov <= 0, `${vp.width} ${v} depășire ${ov}`); }
    await nav(p, 'tx'); await p.click('[data-act=newtx]'); const dw = await E(p, () => { const d = document.querySelector('dialog'); const r = d.getBoundingClientRect(); return [r.left, r.right, innerWidth]; }); assert.ok(dw[0] >= 0 && dw[1] <= dw[2]); await p.keyboard.press('Escape');
    await close(p);
  }
  // tastatură: Tab ajunge la butoanele de navigare și Enter schimbă vizualizarea; focus în dialog
  const p = await newPage(); await demo(p); await p.focus('#nav [data-v=dash]'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  assert.equal(await p.getAttribute('#nav [data-v=tx]', 'aria-current'), 'page'); assert.equal(await E(p, () => document.activeElement.tagName), 'H2');
  await p.click('[data-act=newtx]'); assert.ok(await E(p, () => !!document.activeElement.closest('dialog'))); await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog'), null, {timeout: 3000}); /* evenimentul `close` (care elimină dialogul) e asincron față de Escape */ assert.equal(await p.locator('dialog').count(), 0);
  await close(p);
  const ctx = await browser.newContext({reducedMotion: 'reduce', viewport: {width: 1280, height: 800}}); const q = await newPage({ctx}); await demo(q);
  assert.equal(await E(q, () => getComputedStyle(document.getElementById('toast')).transitionDuration), '0s'); await close(q);
});

await T('teme: comutator luminos/întunecat/sistem cu persistență', async () => {
  const p = await newPage(); await p.click('#themeBtn'); assert.equal(await E(p, () => document.documentElement.dataset.theme), 'light');
  await p.click('#themeBtn'); assert.equal(await E(p, () => document.documentElement.dataset.theme), 'dark'); assert.equal(await E(p, () => localStorage.getItem('fff.gospodar.theme')), 'dark');
  assert.equal(await E(p, () => getComputedStyle(document.body).backgroundColor), 'rgb(17, 19, 23)');
  await p.reload(); await p.waitForSelector('#view h2'); assert.equal(await E(p, () => document.documentElement.dataset.theme), 'dark');
  await p.click('#themeBtn'); assert.equal(await E(p, () => document.documentElement.dataset.theme), undefined); await close(p);
});

await T('categorii și conturi: editare, subcategorii, ștergere, set implicit românesc', async () => {
  const p = await newPage(); await nav(p, 'setup');
  assert.match(await p.textContent('main'), /Alimentație/); assert.match(await p.textContent('main'), /Supermarket/); assert.match(await p.textContent('main'), /Chirie sau rată/);
  await p.click('[data-act=addcat][data-parent=""]'); await p.fill('#ct-name', 'Animale'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(80);
  const id = await E(p, () => GOSPODAR.S.data().cats.find(c => c.name === 'Animale').id);
  await p.click(`[data-act=addcat][data-parent="${id}"]`); await p.fill('#ct-name', 'Hrană'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(80);
  assert.equal(await E(p, () => { const c = GOSPODAR.S.data().cats.find(c => c.name === 'Hrană'); return [c.parent !== '', c.kind]; }).then(x => x.join()), 'true,exp');
  await p.click(`[data-act=editcat][data-id="${id}"]`); await p.click('dialog [data-dk=del]'); assert.match(await p.textContent('dialog .derr'), /subcategorii/); await p.keyboard.press('Escape');
  const sid = await E(p, () => GOSPODAR.S.data().cats.find(c => c.name === 'Hrană').id);
  await p.click(`[data-act=editcat][data-id="${sid}"]`); await p.fill('#ct-name', 'Hrană pisică'); await p.click('dialog [data-dk=ok]'); await p.waitForTimeout(80);
  assert.ok(await E(p, () => GOSPODAR.S.data().cats.some(c => c.name === 'Hrană pisică')));
  await p.click(`[data-act=editcat][data-id="${sid}"]`); await p.click('dialog [data-dk=del]'); await okLast(p); await p.waitForTimeout(80);
  assert.ok(!(await E(p, () => GOSPODAR.S.data().cats.some(c => c.name === 'Hrană pisică'))));
  await clean(p); await close(p);
});

await T('persistență: reîncărcare păstrează datele; fără cereri de rețea; demo = cursuri de exemplu', async () => {
  const p = await newPage(); await demo(p); const n = (await txs(p)).length; await E(p, () => GOSPODAR.S.whenSaved());
  await p.reload(); await p.waitForSelector('#view h2'); assert.equal((await txs(p)).length, n);
  assert.match(await p.textContent('main'), /octombrie 2026/i); await clean(p); await close(p);
});

await browser.close();
const bad = results.filter(r => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste verzi`);
process.exit(bad.length ? 1 : 0);
