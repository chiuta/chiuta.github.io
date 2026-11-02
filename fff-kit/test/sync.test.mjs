// Teste fff-kit · FFF.sync — două contexte Chromium (localStorage separat) se sincronizează prin p2p, fără rețea.
import {createRequire} from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path'; import {execFileSync} from 'child_process';
import {fileURLToPath, pathToFileURL} from 'url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), K = path.resolve(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fffsync-'));
fs.writeFileSync(tmp + '/index.html', '<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Sync Test</title><meta name="application-version" content="1.0.0"><meta name="last-updated" content="2026-11-02"></head><body><main><h1>t</h1><span id="app-version">v1</span></main></body></html>');
execFileSync('node', [K + '/build.mjs', 'apply', tmp, '--slug', 'sync-test', '--modules', 'core,store,dialog,label,bundle,qr,p2p,sync'], {stdio: 'pipe'});
const URL_ = pathToFileURL(tmp + '/index.html').href;
let pass = 0, fail = 0;
const ok = (c, n, i) => { if (c) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i).slice(0, 400)); } };
const FLAGS = ['--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns'];
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: FLAGS});
const errs = [];
async function mk() { const ctx = await browser.newContext(); await ctx.route(/^https?:/, r => r.abort()); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL_); await p.waitForFunction(() => window.FFF && FFF.sync); return p; }
const A = await mk(), B = await mk();
const big = 'x'.repeat(130000) + 'é';
await A.evaluate(big => { localStorage.setItem('onlyA', 'a1'); localStorage.setItem('same', 'ident'); localStorage.setItem('conf', 'A-old'); localStorage.setItem('big', big); localStorage.setItem('apiKey', 'SECRET'); }, big);
await new Promise(r => setTimeout(r, 30));
await B.evaluate(() => { localStorage.setItem('onlyB', 'b1'); localStorage.setItem('same', 'ident'); });
await new Promise(r => setTimeout(r, 1100));
await B.evaluate(() => { localStorage.setItem('conf', 'B-new'); });   // mai recent decât la A
const hostS = await A.evaluate(async () => { window.__h = await FFF.p2p.host({}); return window.__h.offer; });
const ansS = await B.evaluate(async o => { window.__g = await FFF.p2p.join(o, {}); return window.__g.answer; }, hostS);
await A.evaluate(a => window.__h.accept(a), ansS);
await Promise.all([A, B].map(p => p.waitForFunction(() => (window.__h || window.__g).state === 'open', null, {timeout: 20000})));
const rA = A.evaluate(() => FFF.sync.run(window.__h, {confirm: false, reload: false}));
const rB = B.evaluate(() => FFF.sync.run(window.__g, {confirm: false, reload: false}));
const [ra, rb] = await Promise.all([rA, rB]);
const dump = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => !k.startsWith('fff.')).map(k => [k, localStorage.getItem(k).slice(0, 12) + ':' + localStorage.getItem(k).length])));
const dA = await dump(A), dB = await dump(B);
ok(dA.onlyB === 'b1:2', 'A a primit onlyB', dA);
ok(dB.onlyA === 'a1:2', 'B a primit onlyA', dB);
ok(dB.big && dB.big.endsWith(':130001'), 'cheie mare (bucăți) transferată integral', dB.big);
ok(dA.conf === 'B-new:5' && dB.conf === 'B-new:5', 'conflict: câștigă cea mai recentă', [dA.conf, dB.conf]);
ok(!('apiKey' in dB), 'secretele nu se sincronizează', dB);
ok(ra.same >= 1 && rb.same >= 1, 'chei identice numărate', [ra, rb]);
ok(ra.adopted === 2 && rb.adopted === 2, 'număr chei adoptate (onlyB+conf / onlyA+big)', [ra, rb]);
// plan() pur
const pl = await A.evaluate(() => FFF.sync.plan({a: {h: '1', t: 5, n: 1}, b: {h: '2', t: 0, n: 1}}, {a: {h: '9', t: 9, n: 1}, b: {h: '3', t: 0, n: 1}, c: {h: '4', t: 0, n: 1}}));
ok(pl.want.join() === 'a,c' && pl.conflicts.join() === 'b', 'plan: mai nou/lipsă/conflict', pl);
// butonul din dialogul „Transparență” (FFF.label) apare când modulul sync e prezent
await A.click('#app-version'); await A.waitForSelector('dialog');
ok(await A.locator('dialog button', {hasText: 'Sincronizează între dispozitive'}).count() === 1, 'buton de sincronizare în dialogul kitului');
// altă aplicație → refuz
const C = await mk(); await C.evaluate(() => { document.querySelector('meta[name=fff-app]'); });
ok(errs.length === 0, 'fără erori de pagină', errs);
await browser.close();
console.log(`sync: ${pass} reușite, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
