// Test de integrare în browser (Chromium, rețea blocată): FFF.ephem + FFF.ephem.stars se încarcă fără erori, fără cereri externe și dau rezultate corecte.
// Rulare: node test/ephem.browser.mjs
import {createRequire} from 'module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const require = createRequire('/opt/node-tools/package.json'); const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.join(here, '..');
const rd = f => fs.readFileSync(path.join(kit, f), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ephem-'));
const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>ephem</title>
<script>${rd('test/core-shim.js')}</script>
<script>FFF.registerI18n('ephem', ${rd('i18n/ephem.json')});</script>
<script>${rd('src/ephem.js')}</script><script>${rd('src/ephem-stars.js')}</script></head><body><p id="o"></p></body></html>`;
const file = path.join(tmp, 'index.html'); fs.writeFileSync(file, html);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('FAIL:', m); } };
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const ctx = await browser.newContext(); const reqs = []; const errs = [];
await ctx.route(/^https?:/, r => { reqs.push(r.request().url()); r.abort(); });
const page = await ctx.newPage(); page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + file);
const r = await page.evaluate(() => {
  const E = FFF.ephem, out = {};
  out.sun = E.sun(E.jdFromCalendar(2000, 1, 1, 12));
  out.ecl = E.eclipse.local(25.6872, 32.6396, 0, {timeZone: 'Africa/Cairo'});
  out.buc = E.eclipse.local(44.4268, 26.1025, 0, {timeZone: 'Europe/Bucharest'});
  out.stars = FFF.ephem.stars.count; out.cons = FFF.ephem.stars.constellations.length;
  out.phase = E.moonPhase(E.jdFromCalendar(2026, 10, 14, 12)).name;
  out.label = E.label('phase', out.phase);
  out.size = [...document.scripts].map(s => s.textContent.length);
  return out;
});
ok(Math.abs(r.sun.ra - 281.3) < 0.6 && Math.abs(r.sun.dec + 23.0) < 0.1, 'Soare la J2000: ra=' + r.sun.ra + ' dec=' + r.sun.dec);
ok(r.ecl.type === 'total' && r.ecl.durationTotality > 370, 'Luxor totală (' + r.ecl.durationTotality + ')');
ok(/^1[34]:/.test(r.ecl.max.local), 'ora locală Cairo în browser (Intl): ' + r.ecl.max.local);
ok(r.buc.type === 'partial' && r.buc.obscuration > 0.45 && r.buc.obscuration < 0.56, 'București parțială ' + r.buc.obscuration);
ok(/^1[23]:/.test(r.buc.max.local) || /^12:|^13:/.test(r.buc.max.local), 'ora locală București (EEST) la maxim: ' + r.buc.max.local);
ok(r.stars > 1500 && r.cons === 88, 'catalog încărcat: ' + r.stars + ' stele, ' + r.cons + ' constelații');
ok(r.phase === 'waxingCrescent' && r.label.length > 3, 'fază + etichetă i18n: ' + r.phase + ' / ' + r.label);
ok(errs.length === 0, 'fără erori de pagină: ' + errs.join(' | ')); ok(reqs.length === 0, 'fără cereri de rețea: ' + reqs.join(','));
await browser.close(); fs.rmSync(tmp, {recursive: true, force: true});
console.log('ephem.browser: ' + (fail ? fail + ' eșuate' : 'ok') + `; ephem.js ${(fs.statSync(path.join(kit, 'src/ephem.js')).size / 1024).toFixed(1)} kB, ephem-stars.js ${(fs.statSync(path.join(kit, 'src/ephem-stars.js')).size / 1024).toFixed(1)} kB`);
process.exit(fail ? 1 : 0);
