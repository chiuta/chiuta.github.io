// Bolta 1.1.2 — legături de intrare (#sky&t=&ll=&from=). Se copiază în apps/Bolta/tests/bridge.test.mjs
// Rulare: node apps/Bolta/tests/bridge.test.mjs
import {createRequire} from 'module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const APP = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;
let fails = 0, passes = 0;
const check = (n, c, x) => { if (c) { passes++; console.log('  ok  ' + n); } else { fails++; console.log('FAIL  ' + n + (x !== undefined ? ' :: ' + JSON.stringify(x) : '')); } };
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(hash, locale = 'ro-RO') {
  const ctx = await browser.newContext({viewport: {width: 1100, height: 800}, locale});   // context nou = localStorage curat
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(APP + hash); await page.waitForTimeout(1200);
  return {page, ctx, errs};
}
const st = p => p.evaluate(() => ({lat: S.place.lat, lon: S.place.lon, tz: S.place.tz, iso: new Date(S.ms).toISOString(), live: S.live, back: (document.getElementById('fff-back') || {}).textContent || null, href: (document.getElementById('fff-back') || {}).href || null}));
let r = await open('#sky&t=2026-10-18T15:00:00Z&ll=44.43,26.10&from=terra');
let s = await st(r.page);
check('t și ll aplicate, ora fixă (nu live)', s.iso === '2026-10-18T15:00:00.000Z' && s.lat === 44.43 && s.lon === 26.1 && s.live === false, s);
check('buton „← înapoi la TerRa”', s.back === '← înapoi la TerRa' && s.href === 'https://chiuta.github.io/TerRa/', s);
check('0 erori', r.errs.length === 0, r.errs); await r.ctx.close();
r = await open('#sky&ll=44.43,26.10&from=orarium', 'en-US');
s = await st(r.page);
check('fără t: Bolta rămâne live', s.live === true, s);
await r.page.selectOption('#langSel', 'de'); await r.page.waitForTimeout(200);
check('schimbarea limbii (de) retraduce butonul', (await st(r.page)).back === '← zurück zu ORARIUM', (await st(r.page)).back);
await r.ctx.close();
r = await open('#sky&ll=44.43,26.10&from=evil.example'); s = await st(r.page);
check('from necunoscut: ignorat', s.back === null, s); await r.ctx.close();
r = await open('#sky&t=2026-10-18T15:00:00Z&ll=91,26&from=vatra'); s = await st(r.page);
check('ll invalid ignorat, from=vatra funcționează, t aplicat', s.back === '← înapoi la VATRA' && s.iso === '2026-10-18T15:00:00.000Z' && s.lat !== 91, s); await r.ctx.close();
r = await open('#sky&t=2150-01-01T00:00:00Z&ll=44.43,26.10&from=fieldobserver'); s = await st(r.page);
check('t în afara 1900–2100 ignorat (live), ll aplicat', s.live === true && s.lat === 44.43 && /Field Observer/.test(s.back), s); await r.ctx.close();
r = await open('#sky&t=2026-10-18T15:00:00.000Z&ll=44.43,26.10'); s = await st(r.page);
check('t cu .000Z acceptat de Bolta', s.iso === '2026-10-18T15:00:00.000Z', s); await r.ctx.close();
await browser.close();
console.log(`\n${passes} reușite, ${fails} eșuate`); process.exit(fails ? 1 : 0);
