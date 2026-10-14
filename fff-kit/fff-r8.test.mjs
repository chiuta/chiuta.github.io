// Teste r8 (14 oct. 2026): dosar tipărit/PDF, rezumat .txt, verificări salvate local.
// Rulare: node tests/fff-r8.test.mjs  (Playwright din /opt/node-tools, Chromium local, rețea blocată)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.join(HERE, '..', 'index.html');
const AXE = process.env.FFF_AXE || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
let ok = 0, bad = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const TMP = fs.mkdtempSync(path.join(process.env.FFF_TMP || os.tmpdir(), 'punte-'));
const SRC = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const RESULT_KEYS = [...SRC.matchAll(/^ {4}"([a-z0-9-]+)":\{\n {6}type:/gm)].map((m) => m[1]);

const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
async function open(w = 1280, h = 800) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, acceptDownloads: true, locale: 'ro-RO'});
  const net = [];
  await ctx.route(/^https?:/, (r) => { net.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) errs.push('csp: ' + t); });
  await page.goto(FILE);
  await page.waitForTimeout(500);
  return {ctx, page, errs, net};
}
async function toResult(page) {
  await page.click('[data-action="goto"]');
  await page.click('[data-action="pick-profesie"][data-key="farmacist"]');
  await page.selectOption('#sel-origine', 'Germania');
  await page.selectOption('#sel-destinatie', 'România');
  await page.click('[data-action="continue-tari"]');
  await page.click('[data-action="auto-answer"][data-val="da"]');
  await page.waitForSelector('h2.r-title');
}

{
  const {ctx, page, errs, net} = await open();
  check('versiune 1.1.0 în meta și #app-version', await page.evaluate(() => document.querySelector('meta[name=application-version]').content === '1.1.0' && /^v 1\.1\.0 · 2026-10-14$/.test(document.getElementById('app-version').textContent.trim())));
  check('CSP: script-src pe hash, fără unsafe-inline la scripturi', await page.evaluate(() => { const c = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content; return /script-src 'sha256-[^;]*'(?:\s+'sha256-[^;]*')*;/.test(c) && !/script-src[^;]*unsafe-inline/.test(c); }));
  check('pagina de start: fără verificări salvate', (await page.$('.saved-box')) === null);
  await toResult(page);
  const title = await page.textContent('h2.r-title');
  check('rezultat afișat (recunoaștere automată)', /automat/i.test(await page.textContent('.result-tag')), title);

  // --- rezumat .txt ---
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="dl-rezumat"]')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  check('rezumat .txt: nume, BOM, CRLF și conținut', dl.suggestedFilename() === 'punte-rezumat.txt' && txt.startsWith('﻿PUNTE — rezumat verificare') && /Profesie: Farmacist/.test(txt) && /Origine: Germania/.test(txt) && /Destinație: România/.test(txt) && /\r\n/.test(txt) && /Rezultat: /.test(txt), txt);
  check('mesaj de confirmare', /punte-rezumat\.txt/.test(await page.textContent('#r8-msg')));

  // --- dosar tipărit ---
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('[data-action="print-dossier"]');
  check('„Tipărește dosarul” apelează window.print()', (await page.evaluate(() => window.__printed)) === 1);
  const dossier = await page.evaluate(() => document.getElementById('dossier').innerText || document.getElementById('dossier').textContent);
  check('dosarul conține datele de intrare, rezultatul, articolele și avertismentul', /dosar de verificare/.test(dossier) && /Farmacist/.test(dossier) && /Germania/.test(dossier) && /Articole citate/.test(dossier) && /nu are valoare juridică/.test(dossier) && /Organism profesional în România/.test(dossier), dossier.slice(0, 400));
  check('dosarul nu menționează CNRED', !/CNRED/i.test(dossier));
  await page.emulateMedia({media: 'print'});
  const vis = await page.evaluate(() => ({d: getComputedStyle(document.getElementById('dossier')).display, a: getComputedStyle(document.getElementById('app')).display}));
  check('în mod print: se vede doar dosarul', vis.d === 'block' && vis.a === 'none', vis);
  const pdfPath = path.join(TMP, 'dosar.pdf');
  await page.pdf({path: pdfPath});
  const pt = spawnSync('pdftotext', ['-layout', pdfPath, '-'], {encoding: 'utf8'});
  if (pt.status === 0) {
    check('PDF: titlu, tabel, rezultat; fără butoane', /PUNTE — dosar de verificare/.test(pt.stdout) && /Recunoaștere calificărilor|Recunoaștere automată/i.test(pt.stdout) && !/Reîncepe verificarea/.test(pt.stdout) && !/Descarcă rezumatul/.test(pt.stdout), pt.stdout.slice(0, 500));
    const pages = spawnSync('pdfinfo', [pdfPath], {encoding: 'utf8'}).stdout.match(/Pages:\s+(\d+)/);
    check('PDF: cel mult 2 pagini', pages && +pages[1] <= 2, pages && pages[1]);
  } else console.log('  --   pdftotext indisponibil: verificarea PDF omisă');
  await page.emulateMedia({media: 'screen'});
  // Ctrl+P obișnuit (fără dosar) păstrează comportamentul vechi: se tipărește pagina
  await page.evaluate(() => document.body.classList.remove('print-dossier'));
  await page.emulateMedia({media: 'print'});
  const vis2 = await page.evaluate(() => ({d: getComputedStyle(document.getElementById('dossier')).display, a: getComputedStyle(document.getElementById('app')).display}));
  check('tipărire obișnuită (Ctrl+P): pagina rămâne, dosarul ascuns', vis2.d === 'none' && vis2.a !== 'none', vis2);
  await page.emulateMedia({media: 'screen'});

  // --- salvare / redeschidere ---
  await page.click('[data-action="save-case"]');
  check('verificarea e salvată în localStorage', await page.evaluate(() => JSON.parse(localStorage.getItem('punte.cases')).length === 1));
  check('mesaj de confirmare salvare', /salvată/.test(await page.textContent('#r8-msg')), await page.textContent('#r8-msg'));
  await page.click('[data-action="restart"]');
  const sum = await page.textContent('.saved-box summary');
  check('pe pagina de start apare lista cu 1 verificare salvată', /\(1\)/.test(sum), sum);
  await page.click('.saved-box summary');
  await page.reload(); await page.waitForTimeout(500);
  check('după reîncărcare lista persistă', (await page.$$('.saved-list li')).length === 1);
  await page.click('.saved-box summary');
  await page.click('[data-action="open-case"]');
  await page.waitForSelector('h2.r-title');
  check('„Deschide” readuce rezultatul cu aceleași date', (await page.textContent('h2.r-title')) === title && /Germania/.test(await page.textContent('#trail-wrap')) && /Farmacist/.test(await page.textContent('#trail-wrap')));
  await page.click('[data-action="restart"]');
  await page.click('.saved-box summary');
  const bundle = await page.evaluate(() => FFF.bundle.build());
  check('copia .fff.json (kit) include punte.cases', typeof bundle.data['punte.cases'] === 'string' && JSON.parse(bundle.data['punte.cases']).length === 1, Object.keys(bundle.data));
  await page.click('[data-action="del-case"]');
  check('„Șterge” elimină verificarea salvată', (await page.$('.saved-box')) === null && (await page.evaluate(() => JSON.parse(localStorage.getItem('punte.cases')).length)) === 0);

  // --- date alterate în localStorage ---
  await page.evaluate(() => localStorage.setItem('punte.cases', JSON.stringify([
    {id: 'bad1', t: '2026-10-14', label: 'x', s: {sector: '__proto__', resultKey: 'auto-success', profesieLabel: 'X', log: []}},
    {id: 'bad2', t: '2026-10-14', label: 'x', s: {sector: 'farmacist', resultKey: 'nu-exista', profesieLabel: 'X', log: []}},
    {id: '<img src=x onerror=alert(1)>', t: '2026-10-14', label: 'x', s: {sector: 'farmacist', resultKey: 'auto-success', profesieLabel: 'X', log: []}},
    {id: 'okid1', t: '2026-10-14', label: '<b>x</b>', s: {sector: 'farmacist', resultKey: 'auto-success', profesieLabel: '<img src=x onerror=alert(1)>', origine: 'Germania', destinatie: 'România', log: [{q: '<i>q</i>', a: 'a'}]}}
  ])));
  await page.reload(); await page.waitForTimeout(500);
  check('intrări invalide sunt ignorate, rămâne doar cea validă', (await page.$$('.saved-list li')).length === 0 ? false : (await page.$$('.saved-list li')).length === 1);
  await page.click('.saved-box summary'); await page.click('[data-action="open-case"]');
  check('conținutul salvat este escapat (fără element injectat)', (await page.$('#content img')) === null && (await page.$('#trail-wrap img')) === null);
  await page.evaluate(() => localStorage.setItem('punte.cases', '{nu e json'));
  await page.reload(); await page.waitForTimeout(500);
  check('JSON corupt: pagina de start merge, fără listă', (await page.$('.saved-box')) === null && (await page.$('h1.q-title')) !== null);
  check('0 erori / 0 CSP / 0 rețea', errs.length === 0 && net.length === 0, {errs, net});
  await ctx.close();
}
{
  // toate tipurile de rezultat se pot salva și redeschide fără erori
  const {ctx, page, errs} = await open();
  const cases = RESULT_KEYS.map((k, i) => ({id: 'r' + i + 'k', t: '2026-10-14', label: k, s: {sector: 'farmacist', profesieLabel: 'Farmacist', specialitate: '', origine: 'Germania', destinatie: 'România', mode: 'auto', resultKey: k, log: [{q: 'Q', a: 'A'}]}}));
  await page.evaluate((c) => localStorage.setItem('punte.cases', JSON.stringify(c.slice(0, 20))), cases);
  await page.reload(); await page.waitForTimeout(500);
  const n = Math.min(cases.length, 20);
  check(`${RESULT_KEYS.length} tipuri de rezultat în sursă; primele ${n} se încarcă în listă`, RESULT_KEYS.length >= 10 && (await page.$$('.saved-list li')).length === n, {keys: RESULT_KEYS.length});
  let fails = [];
  for (let i = 0; i < n; i++) {
    await page.click('.saved-box summary').catch(() => {});
    const open_ = await page.$('.saved-box[open]');
    if (!open_) await page.click('.saved-box summary');
    const btns = await page.$$('[data-action="open-case"]');
    await btns[i].click();
    const t = await page.$('h2.r-title');
    if (!t) fails.push(cases[i].label);
    await page.click('[data-action="restart"]');
  }
  check('toate rezultatele salvate se redeschid (titlu prezent)', fails.length === 0, fails);
  check('0 pageerror la redeschiderea tuturor', errs.length === 0, errs);
  await ctx.close();
}
{
  // axe + 360 px
  const {ctx, page} = await open(360, 740);
  await toResult(page);
  await page.click('[data-action="save-case"]');
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('fără depășire orizontală la 360 px (rezultat cu butoane noi)', o <= 1, o);
  await page.evaluate(fs.readFileSync(AXE, 'utf8') + '\n;0');
  const ax = await page.evaluate(async () => (await window.axe.run(document, {resultTypes: ['violations']})).violations.map((v) => v.id + ':' + v.nodes.length));
  check('axe 0 violări pe pagina de rezultat', ax.length === 0, ax);
  await page.click('[data-action="restart"]');
  const ax2 = await page.evaluate(async () => (await window.axe.run(document, {resultTypes: ['violations']})).violations.map((v) => v.id + ':' + v.nodes.length));
  check('axe 0 violări pe pagina de start cu lista salvată', ax2.length === 0, ax2);
  await page.click('.saved-box summary');
  const ax3 = await page.evaluate(async () => (await window.axe.run(document, {resultTypes: ['violations']})).violations.map((v) => v.id + ':' + v.nodes.length));
  check('axe 0 violări cu lista deschisă', ax3.length === 0, ax3);
  await ctx.close();
}
{
  // fără kit
  const ctx = await b.newContext({viewport: {width: 1280, height: 800}, locale: 'ro-RO', acceptDownloads: true});
  await ctx.route(/^https?:/, (r) => r.abort());
  await ctx.addInitScript(() => { Object.defineProperty(window, 'FFF', {get() { return undefined; }, set() {}, configurable: true}); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(FILE); await page.waitForTimeout(500);
  await toResult(page);
  await page.click('[data-action="save-case"]');
  check('fără kit: salvarea merge, 0 erori', /salvată/.test(await page.textContent('#r8-msg')) && errs.length === 0, errs);
  await ctx.close();
}
await b.close();
fs.rmSync(TMP, {recursive: true, force: true});
console.log(`PUNTE fff-r8: ${ok} ok, ${bad} eșuate`);
process.exit(bad ? 1 : 0);
