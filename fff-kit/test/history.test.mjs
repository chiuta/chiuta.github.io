// Teste fff-kit · FFF.history — instantanee locale (IndexedDB), diferență, restaurare, retenție, fără secrete.
import {createRequire} from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path'; import {execFileSync} from 'child_process';
import {fileURLToPath, pathToFileURL} from 'url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), K = path.resolve(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ffhist-'));
fs.writeFileSync(tmp + '/index.html', '<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Hist Test</title><meta name="application-version" content="1.0.0"><meta name="last-updated" content="2026-11-02"></head><body><main><h1>t</h1><span id="app-version">v1</span></main></body></html>');
execFileSync('node', [K + '/build.mjs', 'apply', tmp, '--slug', 'hist-test', '--modules', 'core,store,dialog,label,bundle,history'], {stdio: 'pipe'});
let pass = 0, fail = 0;
const ok = (c, n, i) => { if (c) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i).slice(0, 400)); } };
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const ctx = await browser.newContext(); await ctx.route(/^https?:/, r => r.abort());
const errs = []; const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.goto(pathToFileURL(tmp + '/index.html').href); await p.waitForFunction(() => window.FFF && FFF.history);
await p.evaluate(() => { localStorage.setItem('a', '1'); localStorage.setItem('b', '2'); localStorage.setItem('apiKey', 'SECRET'); });
const s1 = await p.evaluate(() => FFF.history.snapshot('t1', {force: true}));
ok(s1 && s1.keys === 2, 'instantaneu cu 2 chei (fără secret)', s1 && s1.keys);
const dup = await p.evaluate(() => FFF.history.snapshot('t2'));
ok(dup === null, 'datele identice nu dublează instantaneul');
const hasSecret = await p.evaluate(async () => JSON.stringify(await FFF.history.get((await FFF.history.list())[0].id)).includes('SECRET'));
ok(!hasSecret, 'secretele nu intră în istoric');
await p.evaluate(() => { localStorage.setItem('a', 'changed'); localStorage.removeItem('b'); localStorage.setItem('c', '3'); });
const d = await p.evaluate(async () => FFF.history.diff((await FFF.history.list())[0].id));
ok(d.added.join() === 'b' && d.changed.join() === 'a' && d.extra.join() === 'c', 'diff: adăugate/schimbate/în plus', d);
const r = await p.evaluate(async () => { const id = (await FFF.history.list()).find(x => x.label === 't1').id; await FFF.history.restore(id, {confirm: false, reload: false}); return Object.fromEntries(['a', 'b', 'c'].map(k => [k, localStorage.getItem(k)])); });
ok(r.a === '1' && r.b === '2' && r.c === '3', 'restaurare: a,b readuse, c (extra) rămâne', r);
const labels = await p.evaluate(async () => (await FFF.history.list()).map(x => x.label));
ok(labels.includes('before-restore'), 'înainte de restaurare s-a făcut instantaneu', labels);
// retenție: 14 instantanee distincte în aceeași zi → rămân KEEP_LAST + extra rezonabil
await p.evaluate(async () => { for (let i = 0; i < 14; i++) { localStorage.setItem('n', String(i)); await FFF.history.snapshot('x' + i, {force: true}); } });
const n = await p.evaluate(async () => (await FFF.history.list()).length);
ok(n >= 8 && n <= 12, 'retenție: ~8 recente păstrate', n);
// ștergerea datelor aplicației șterge și istoricul
await p.evaluate(async () => { await FFF.bundle.wipe({confirm: false, reload: false}); });
await p.waitForTimeout(300);
const afterWipe = await p.evaluate(async () => (await FFF.history.list()).length);
ok(afterWipe === 0, 'după „Șterge datele” istoricul e gol', afterWipe);
// UI
await p.click('#app-version'); await p.waitForSelector('dialog');
ok(await p.locator('dialog button', {hasText: 'Istoric (mașina timpului)'}).count() === 1, 'buton Istoric în dialogul kitului');
ok(errs.length === 0, 'fără erori de pagină', errs);
await browser.close();
console.log(`history: ${pass} reușite, ${fail} eșuate`); process.exit(fail ? 1 : 0);
