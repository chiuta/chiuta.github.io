// Teste Arbore 2.0.0: povestea unei persoane, parcurs + plan din coordonate introduse, verificare/reparare GEDCOM.
// Rulare: node tests/story.test.mjs
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = pathToFileURL(path.join(here, '..', 'index.html')).href;
const AXE = process.env.AXE_PATH || process.env.FFF_AXE;
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
const browser = await chromium.launch({executablePath: exe});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arb-'));

async function newPage(vw) {
  const ctx = await browser.newContext({viewport: vw || {width: 1280, height: 900}, acceptDownloads: true, locale: 'ro-RO'});
  const net = [];
  await ctx.route(/^https?:/, r => { net.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog nativ: ' + d.type()); d.dismiss(); });
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective); }); });
  await page.goto(URL_APP);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.waitForTimeout(3600);
  return {ctx, page, errors, net};
}
const txt = (p, sel) => p.evaluate(s => document.querySelector(s)?.innerText || '', sel);

const PLACES = {'Brașov, Brașov, România': ['45.65', '25.61'], 'Alba Iulia, Alba, România': ['46.07', '23.57'], 'Sibiu, Sibiu, România': ['45,80', '24.15'], 'Cluj-Napoca, Cluj, România': ['46.77', '23.59']};

console.log('1. poveste: structură și parcurs');
const t = await newPage(); const p = t.page;
await p.click('#b-sample'); await p.waitForTimeout(600);
await p.evaluate(() => window.Arbore.selectPerson('I9'));
await p.click('#t-story'); await p.waitForTimeout(300);
ok('fila Poveste e vizibilă', await p.isVisible('#p-story'));
ok('numele persoanei în bară', (await txt(p, '#st-name')).includes('Mihai Moldovan'), await txt(p, '#st-name'));
let out = await txt(p, '#st-out');
ok('părinți: Vasile și Floarea', /Părinți:.*Vasile.*/.test(out) && out.includes('Floarea'), out.slice(0, 300));
ok('parteneri: Carmen și Laura', out.includes('Carmen') && out.includes('Laura'));
ok('copii: 3', /Copii \(3\):/.test(out) && out.includes('Alexandru') && out.includes('Paul'));
ok('grupare pe decenii', out.includes('1950–1959') && out.includes('1970–1979') && out.includes('1990–1999'), out.slice(0, 600));
ok('evenimente: naștere, căsătorie la Sibiu, vârstă', out.includes('Naștere') && /Căsătorie — Carmen.*Sibiu/.test(out) && /la \d+ ani/.test(out));
const route = await p.evaluate(() => [...document.querySelectorAll('#st-out ol.str li')].map(li => li.textContent));
ok('parcurs în ordine cronologică (4 locuri)', route.length === 4 && /1953.*Brașov/.test(route[0]) && /1975.*Alba Iulia/.test(route[1]) && /1976.*Sibiu/.test(route[2]) && /1990.*Cluj/.test(route[3]), route);
ok('fără coordonate: mesaj, fără SVG', (await p.locator('#st-out svg').count()) === 0 && out.includes('Introdu mai jos coordonatele'));
ok('nota de nesiguranță e vizibilă', (await txt(p, '#p-story .warnbox')).includes('nu adaugă nimic'));

console.log('2. coordonate introduse de utilizator');
await p.click('#st-coords summary'); await p.waitForTimeout(150);
const names = await p.evaluate(() => [...document.querySelectorAll('#st-cbody .cpl')].map(e => e.textContent));
ok('un rând pentru fiecare loc distinct', Object.keys(PLACES).every(k => names.includes(k)), names);
// latitudine în afara limitelor
const idx = k => names.indexOf(k);
await p.fill(`[data-cl="${idx('Brașov, Brașov, România')}"]`, '95'); await p.fill(`[data-cn="${idx('Brașov, Brașov, România')}"]`, '25.6');
await p.click('#st-csave'); await p.waitForTimeout(200);
ok('latitudine 95 respinsă, nimic salvat', (await txt(p, '#st-cerr')).includes('Coordonate invalide') && (await p.locator('#st-out svg').count()) === 0);
await p.fill(`[data-cl="${idx('Brașov, Brașov, România')}"]`, '45.65'); await p.fill(`[data-cn="${idx('Brașov, Brașov, România')}"]`, '');
await p.click('#st-csave'); await p.waitForTimeout(200);
ok('un singur câmp completat: respins', (await txt(p, '#st-cerr')).includes('Brașov'));
await p.fill(`[data-cl="${idx('Brașov, Brașov, România')}"]`, 'abc');
await p.click('#st-csave'); await p.waitForTimeout(200);
ok('text în loc de număr: respins', (await txt(p, '#st-cerr')).includes('Coordonate invalide'));
for (const [k, v] of Object.entries(PLACES)) { await p.fill(`[data-cl="${idx(k)}"]`, v[0]); await p.fill(`[data-cn="${idx(k)}"]`, v[1]); }
await p.click('#st-csave'); await p.waitForTimeout(500);
ok('planul SVG apare după salvare', (await p.locator('#st-out svg.stmap').count()) === 1);
const sv = await p.evaluate(() => { const s = document.querySelector('#st-out svg.stmap'); return {c: s.querySelectorAll('circle').length, l: s.querySelectorAll('line').length, label: s.getAttribute('aria-label'), role: s.getAttribute('role'), txt: s.textContent, w: s.getBoundingClientRect().width}; });
ok('4 noduri, 3 segmente, etichetă accesibilă', sv.c === 4 && sv.l === 3 && sv.role === 'img' && sv.label.includes('Mihai Moldovan'), sv);
ok('etichete: locul și anul', sv.txt.includes('Brașov 1953') && sv.txt.includes('Cluj-Napoca 1990'), sv.txt);
ok('„4 din 4 locuri”', (await txt(p, '#st-out')).includes('4 din 4'));
ok('detaliile coordonatelor rămân deschise', await p.evaluate(() => document.querySelector('#st-coords').open));

console.log('3. exporturi');
const msk = async () => { await p.click('#st-svg'); await p.waitForTimeout(400); return (await p.evaluate(() => document.querySelector('.toasts')?.innerText || document.body.innerText)).includes('protejată de setările de confidențialitate'); };
ok('persoană vie: exportul e blocat de masca de confidențialitate, cu explicație', await msk());
await p.click('#t-data'); await p.uncheck('#x-mask'); await p.click('#t-story'); await p.waitForTimeout(200);
const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#st-svg'), p.waitForSelector('#dlg-confirm[open]', {timeout: 1500}).then(() => p.click('#cf-yes')).catch(() => {})]);
const svgTxt = fs.readFileSync(await d1.path(), 'utf8');
ok('SVG exportat autonom', svgTxt.startsWith('<svg') && svgTxt.includes('xmlns=') && (svgTxt.match(/<circle/g) || []).length === 4 && !svgTxt.includes('var(') && !/https?:\/\//.test(svgTxt.replace('http://www.w3.org/2000/svg', '')), svgTxt.slice(0, 120));
const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#st-txt'), p.waitForSelector('#dlg-confirm[open]', {timeout: 1500}).then(() => p.click('#cf-yes')).catch(() => {})]);
const txtOut = fs.readFileSync(await d2.path(), 'utf8');
ok('text exportat: titlu, evenimente, parcurs, notă', txtOut.includes('Mihai Moldovan') && txtOut.includes('Naștere') && txtOut.includes('1990 — Cluj-Napoca') && txtOut.includes('nu adaugă nimic'), txtOut.slice(0, 200));

console.log('4. persistență și copie de siguranță');
const bundleCoords = await p.evaluate(async () => { const b = window.FFF && FFF.bundle ? FFF.bundle.build() : null; const raw = b && b.data && b.data['fff.arbore.tree']; return raw ? JSON.parse(raw).coords : null; });
ok('coordonatele intră în copia de siguranță (4 locuri)', bundleCoords && Object.keys(bundleCoords).length === 4, bundleCoords);
ok('virgula zecimală acceptată (Sibiu 45,80 → 45.8)', bundleCoords && bundleCoords['Sibiu, Sibiu, România'] && bundleCoords['Sibiu, Sibiu, România'][0] === 45.8, bundleCoords);
await p.waitForTimeout(1500);
await p.click('#t-data'); await p.check('#x-mask');
await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1'); await p.waitForTimeout(3600);
await p.evaluate(() => window.Arbore.selectPerson('I9'));
await p.click('#t-story'); await p.waitForTimeout(300);
ok('după reîncărcare planul rămâne', (await p.locator('#st-out svg.stmap circle').count()) === 4);
ok('0 erori, 0 rețea, 0 CSP', t.errors.length === 0 && t.net.length === 0 && !(await p.evaluate(() => window.__csp || [])).length, {e: t.errors, n: t.net});

console.log('5. import ostil de coordonate');
const bun = await p.evaluate(() => FFF.bundle.build());
const tree = JSON.parse(bun.data['fff.arbore.tree']);
tree.coords = {'Ok, loc': [10, 20], 'Lat prea mare': [95, 10], 'Șir': ['1', '2'], 'Lung': [1, 2, 3], '__proto__': [1, 1], 'NaN': [null, 5], 'Lon': [0, 181]};
bun.data['fff.arbore.tree'] = JSON.stringify(tree);
const hp = path.join(tmp, 'hostil.fff.json'); fs.writeFileSync(hp, JSON.stringify(bun));
await p.click('#t-data');
await p.setInputFiles('#in-json', hp);
await p.waitForSelector('#dlg-confirm[open]', {timeout: 3000}).then(() => p.click('#cf-yes')).catch(() => {});
await p.waitForTimeout(900);
const cleaned = await p.evaluate(() => { const b = FFF.bundle.build(); return JSON.parse(b.data['fff.arbore.tree']).coords; });
ok('import ostil: rămâne doar intrarea validă', JSON.stringify(Object.keys(cleaned)) === '["Ok, loc"]' && cleaned['Ok, loc'][0] === 10, cleaned);
ok('import ostil: prototipul nu e poluat', ({}).lat === undefined && Object.keys(Object.prototype).length === 0);

console.log('6. verificare / reparare GEDCOM');
await p.click('#b-sample').catch(() => {});
await p.click('#t-quality'); await p.waitForTimeout(200);
const before = await p.evaluate(() => window.Arbore.order.length);
const bad = '0 HEAD\r\n1 GEDC\r\n2 VERS 5.5.1\r\n1 CHAR UTF-8\r\n0 @I1@ INDI\r\n1 NAME Ion /Test/\r\n1 SEX M\r\n1 BIRT\r\n2 DATE cândva primăvara lui 1900\r\n2 PLAC Brașov\r\n1 FAMS @F9@\r\n1 FAMC @F8@\r\n0 @I2@ INDI\r\n1 NAME Ana /Test/\r\n1 SEX F\r\n1 BIRT\r\n2 DATE 12 MAR 1905\r\n1 FAMS @F1@\r\nbroken line without level\r\n0 @F1@ FAM\r\n1 HUSB @I1@\r\n1 WIFE @I2@\r\n1 CHIL @I77@\r\n1 MARR\r\n2 DATE 1925\r\n';
const bp = path.join(tmp, 'stricat.ged'); fs.writeFileSync(bp, bad);
await p.setInputFiles('#gv-file', bp); await p.waitForTimeout(800);
const gv = await txt(p, '#gv-out');
ok('raportul listează probleme', /Probleme găsite: [1-9]/.test(gv), gv.slice(0, 300));
ok('data neinterpretabilă e semnalată', gv.includes('cândva primăvara lui 1900'));
ok('referință lipsă (I77) și lipsa TRLR raportate', gv.includes('I77') && gv.includes('TRLR'), gv);
ok('arborele curent nu e modificat', (await p.evaluate(() => window.Arbore.order.length)) === before);
ok('buton de descărcare prezent', await p.isVisible('#gv-dl'));
const [d3] = await Promise.all([p.waitForEvent('download'), p.click('#gv-dl')]);
const fixed = fs.readFileSync(await d3.path(), 'utf8');
ok('GEDCOM reparat: dată în paranteze', fixed.includes('2 DATE (cândva primăvara lui 1900)'), fixed.slice(0, 400));
ok('GEDCOM reparat: HEAD și TRLR', /^﻿?0 HEAD/.test(fixed) && /0 TRLR\s*$/.test(fixed));
ok('GEDCOM reparat: fără referința I77 și fără linia fără nivel', !fixed.includes('@I77@') && !fixed.includes('broken line'));
const [d3b] = await Promise.all([p.waitForEvent('download'), p.click('#gv-dl')]);
ok('a doua descărcare nu dublează parantezele', !fs.readFileSync(await d3b.path(), 'utf8').includes('(('));
const fp = path.join(tmp, 'reparat.ged'); fs.writeFileSync(fp, fixed);
await p.setInputFiles('#gv-file', fp); await p.waitForTimeout(800);
const gv2 = await txt(p, '#gv-out');
ok('fișierul reparat se verifică curat', gv2.includes('Fișierul este curat'), gv2.slice(0, 300));
await p.setInputFiles('#gv-file', path.join(here, 'fixtures', 'probleme.ged')); await p.waitForTimeout(900);
ok('fixture cu probleme: raport nevid', /Probleme găsite: [1-9]/.test(await txt(p, '#gv-out')) || (await txt(p, '#gv-out')).includes('Import'));
const junk = path.join(tmp, 'gunoi.ged'); fs.writeFileSync(junk, 'asta nu este GEDCOM\nde loc');
await p.setInputFiles('#gv-file', junk); await p.waitForTimeout(600);
ok('fișier non-GEDCOM: eroare, fără buton de descărcare', (await p.locator('#gv-dl').count()) === 0 && (await txt(p, '#gv-out')).length > 10);
ok('0 erori JS / dialoguri native', t.errors.length === 0, t.errors);

console.log('7. buton din fișă, limbi');
await p.click('#b-sample').catch(() => {});
await p.click('#t-people'); await p.waitForTimeout(200);
await p.evaluate(() => window.Arbore.selectPerson('I16'));
await p.waitForTimeout(300);
await p.click('#sheet [data-act="story"]'); await p.waitForTimeout(300);
ok('butonul „Povestea persoanei” deschide fila', (await p.isVisible('#p-story')) && (await txt(p, '#st-name')).includes('Alexandru'));
const raw = /\b(?:st|gv|show)_[a-z_]+\b/;
for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
  await p.selectOption('#lang', l); await p.waitForTimeout(250);
  await p.click('#t-story');
  const s = await p.evaluate(() => ({tab: document.querySelector('#t-story').textContent, note: document.querySelector('#p-story .warnbox').textContent, out: document.querySelector('#st-out').innerText, co: document.querySelector('#st-coords summary').textContent, btn: document.querySelector('#st-txt').textContent}));
  await p.click('#t-quality'); await p.waitForTimeout(100);
  const g = await p.evaluate(() => document.querySelector('#gv').innerText);
  const bad2 = [s.tab, s.note, s.out, s.co, s.btn, g].some(x => raw.test(x));
  const isRo = l === 'ro';
  ok('limba ' + l + ': chei traduse' + (isRo ? '' : ', diferit de română'), !bad2 && (isRo || (s.tab !== 'Poveste' && !/Salvează|Părinți|Verifică și repară/.test(s.btn + s.out + g))), {tab: s.tab, btn: s.btn});
}

console.log('8. accesibilitate, mobil');
await p.selectOption('#lang', 'ro');
await p.evaluate(() => window.Arbore.selectPerson('I9'));
await p.click('#t-story'); await p.waitForTimeout(300);
if (!(await p.evaluate(() => document.querySelector('#st-coords').open))) await p.click('#st-coords summary');
if (AXE) {
  const src = fs.readFileSync(AXE, 'utf8');
  for (const tab of ['story', 'quality']) {
    await p.click('#t-' + tab); await p.waitForTimeout(200);
    await p.evaluate(s => { if (!window.axe) (0, eval)(s); }, src);
    const r = await p.evaluate(() => axe.run(document, {resultTypes: ['violations']}));
    ok('axe 0 violări pe fila ' + tab, r.violations.length === 0, r.violations.map(v => v.id + ':' + v.nodes.length));
  }
}
await p.setViewportSize({width: 360, height: 740});
await p.click('#t-story'); await p.waitForTimeout(300);
const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('fără depășire orizontală la 360 px (poveste)', ov <= 1, ov);
await p.click('#t-quality'); await p.waitForTimeout(200);
const ov2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('fără depășire orizontală la 360 px (calitate)', ov2 <= 1, ov2);
ok('0 erori / 0 rețea la final', t.errors.length === 0 && t.net.length === 0, {e: t.errors, n: t.net});
await t.ctx.close();
await browser.close();
console.log(`\n${pass} reușite, ${fail} eșuate`);
if (fail) { console.log('Eșuate:\n - ' + failures.join('\n - ')); process.exit(1); }
