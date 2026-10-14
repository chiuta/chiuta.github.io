// Test pwa-ui.js: buton „Instalează” (beforeinstallprompt simulat), stare instalat, fallback iOS, ascundere în context nesigur.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad';
const dir = path.join(S, 'tmp_k5/ui'); fs.rmSync(dir, {recursive: true, force: true}); fs.mkdirSync(dir, {recursive: true});
const js = fs.readFileSync(path.join(HERE, '../pwa-ui.js'), 'utf8');
const i18n = fs.readFileSync(path.join(HERE, '../pwa-ui.i18n.json'), 'utf8');
fs.writeFileSync(dir + '/index.html', `<!doctype html><html lang="ro"><meta charset="utf-8"><title>t</title><body><div id="host"></div>
<script>window.FFF={_l:{},registerI18n(m,o){this._l[m]=o},t(m,k){return (JSON.parse(document.getElementById('i').textContent)[document.documentElement.lang]||{})[k]},bus:{ev:[],emit(e,d){this.ev.push([e,d])}}};</script>
<script type="application/json" id="i">${i18n}</script><script>${js}</script></body></html>`);
const PORT = 8700 + Math.floor(Math.random() * 90);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '-d', dir], {stdio: 'ignore'});
await new Promise(r => setTimeout(r, 1000));
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const ctx = await browser.newContext(); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/`);
ok(await page.evaluate(() => FFF.pwa.supported()), 'supported pe localhost');
ok(!(await page.evaluate(() => FFF.pwa.canInstall())), 'canInstall fals fără eveniment');
await page.evaluate(() => { window.__unmount = FFF.pwa.mount(document.getElementById('host')); });
ok(await page.evaluate(() => document.querySelector('.fff-pwa').hidden), 'ascuns fără eveniment (non-iOS)');
await page.evaluate(() => { window.__prompted = 0; const e = new Event('beforeinstallprompt', {cancelable: true}); e.prompt = () => { window.__prompted++; return Promise.resolve(); }; e.userChoice = Promise.resolve({outcome: 'accepted'}); window.dispatchEvent(e); window.__ev = e; });
ok(await page.evaluate(() => FFF.pwa.canInstall() && __ev.defaultPrevented), 'beforeinstallprompt captat');
ok(await page.evaluate(() => !document.querySelector('.fff-pwa').hidden && !document.querySelector('.fff-pwa-btn').hidden && document.querySelector('.fff-pwa-btn').textContent === 'Instalează'), 'buton vizibil, text ro');
await page.click('.fff-pwa-btn'); await page.waitForTimeout(200);
ok(await page.evaluate(() => __prompted === 1 && !FFF.pwa.canInstall()), 'click apelează prompt() o dată');
ok(await page.evaluate(() => FFF.bus.ev.some(e => e[0] === 'pwa:state')), 'eveniment pwa:state pe bus');
await page.evaluate(() => { document.documentElement.lang = 'de'; FFF.pwa.mount(document.createElement('div')); });
await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
ok(await page.evaluate(() => FFF.pwa.installed() && document.querySelector('.fff-pwa-note').textContent.length > 0), 'stare „instalat”');
ok(errs.length === 0, 'fără pageerror ' + errs);
// iOS
const ictx = await browser.newContext({userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'}); const ip = await ictx.newPage();
await ip.goto(`http://127.0.0.1:${PORT}/`); await ip.evaluate(() => FFF.pwa.mount(document.getElementById('host')));
ok(await ip.evaluate(() => /Adaugă pe ecranul principal/.test(document.querySelector('.fff-pwa-note').textContent) && document.querySelector('.fff-pwa-btn').hidden), 'iOS: indiciu, fără buton');
// file://
const fctx = await browser.newContext(); const fp = await fctx.newPage(); await fp.goto('file://' + dir + '/index.html');
await fp.evaluate(() => FFF.pwa.mount(document.getElementById('host')));
ok(await fp.evaluate(() => !FFF.pwa.supported() && document.querySelector('.fff-pwa').hidden), 'file://: ascuns');
await browser.close(); srv.kill('SIGTERM');
console.log(`${pass} reușite, ${fail} eșecuri`); process.exit(fail ? 1 : 0);
