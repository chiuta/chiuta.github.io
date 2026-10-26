// Teste Playwright pentru Curatitor 2.0 — curățare în lot cu politică de risc (dosar, niveluri, profiluri, raport înainte/după, miniaturi).
// Rulare: node tests/risk.mjs   (portabil: rulează din directorul aplicației; axe-core prin FFF_AXE / AXE_PATH, opțional)
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './fixtures.mjs';

const require = createRequire(process.env.PW_ROOT || import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = 'https://curatitor.test/index.html';
const APP_FILE = path.resolve(HERE, '../index.html');
const APP_JSON = JSON.parse(fs.readFileSync(path.resolve(HERE, '../app.json'), 'utf8'));
const AXE = process.env.FFF_AXE || process.env.AXE_PATH || (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return undefined; } })();
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'curatitor-risk-'));

const results = []; let current = '';
async function test(name, fn) {
  current = name; const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log('  ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push({ name, ok: false, err: e.stack || String(e) }); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').join('\n       ')); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const netReqs = [], pageErrors = [];
async function mkCtx(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: 'ro-RO', serviceWorkers: 'block' }, opts));
  await ctx.route(/^https?:/, (r) => {
    const u = r.request().url();
    if (u.startsWith('https://curatitor.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) });
    const m = /^https:\/\/curatitor\.test\/(manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png)$/.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: m[1].endsWith('png') ? 'image/png' : 'application/manifest+json', body: fs.readFileSync(path.resolve(HERE, '..', m[1])) });
    netReqs.push(u); r.abort();
  });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  return ctx;
}
const ctx = await mkCtx();
const util = await ctx.newPage(); await util.goto('about:blank');

async function openApp() {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => pageErrors.push(current + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') pageErrors.push(current + ' console: ' + m.text()); });
  await p.goto(APP); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload(); await p.waitForSelector('#list', { state: 'attached' }); return p;
}
async function settled(p) {
  await p.waitForFunction(() => { const s = window.__curatitor.state(); return s.length > 0 && s.every((f) => f.state !== 'work'); }, null, { timeout: 120000 });
  await p.waitForTimeout(120);
}
const st = (p) => p.evaluate(() => window.__curatitor.state());
const by = (s, n) => s.find((x) => (x.path || x.name) === n || x.name === n);
const wr = (rel, b) => { const f = path.join(W, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); return f; };
async function pickProfile(p, v) { await p.check('input[name=prof][value=' + v + ']'); await p.waitForTimeout(100); await settled(p); }
async function dl(p, name, dest) { const [d] = await Promise.all([p.waitForEvent('download'), p.locator('li.file').filter({ has: p.locator('.fname', { hasText: name }) }).locator('button[data-act=dl]').click()]); await d.saveAs(dest); return fs.readFileSync(dest); }

/* imagini: model „sursă” desenată în pagină, apoi JPEG cu miniatură EXIF coerentă / diferită */
async function jpegOf(kind) {
  const r = await util.evaluate(async (kind) => {
    const draw = (c, inv) => { const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, c.width, c.height); gr.addColorStop(0, inv ? '#f0f0f0' : '#101090'); gr.addColorStop(1, inv ? '#a01010' : '#f0e040'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); g.fillStyle = inv ? '#000' : '#fff'; g.beginPath(); g.arc(c.width * (inv ? .2 : .75), c.height * .5, c.height * .3, 0, 7); g.fill(); };
    const mk = (w, h, inv) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c, inv); return c; };
    const b64 = async (c) => { const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85)); const ab = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < ab.length; i++) s += String.fromCharCode(ab[i]); return btoa(s); };
    return { main: await b64(mk(240, 160, false)), same: await b64(mk(48, 32, false)), other: await b64(mk(48, 32, true)) };
  }, kind);
  return { main: Buffer.from(r.main, 'base64'), same: Buffer.from(r.same, 'base64'), other: Buffer.from(r.other, 'base64') };
}
const plainJpeg = (await jpegOf()).main;

console.log('Curatitor — teste de risc și lot (director de lucru: ' + W + ')');

const imgs = await jpegOf();
const secretJpg = F.jpegInject(imgs.main, { exif: F.secretExif({ thumb: imgs.same }), xmp: F.xmpPacket(), com: 'Comentariu-Risc-Secret' });
const pdf = F.buildPdf({ info: true, xmp: true });
const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" width="40" height="20"><title>Titlu-Oficial-Vizibil</title><desc>Descriere-Autor-Vizibila</desc><metadata><rdf:RDF><rdf:Description><dc:creator>Creator-Svg-Secret</dc:creator></rdf:Description></rdf:RDF></metadata><rect width="40" height="20" fill="#08c"/></svg>');
const folder = path.join(W, 'dosar');
wr('dosar/poze/secret.jpg', secretJpg); wr('dosar/poze/curat.jpg', plainJpeg); wr('dosar/acte/raport.pdf', pdf); wr('dosar/acte/plan.svg', svg); wr('dosar/note.txt', 'nu e suportat'); wr('dosar/.DS_Store', 'junk');

await test('dosar: selectarea unui dosar scanează tot, ignoră fișierele-gunoi și păstrează căile', async () => {
  const p = await openApp();
  assert(await p.locator('#sumCard').isHidden(), 'sumarul e ascuns fără fișiere');
  await p.setInputFiles('#folderInput', folder); await settled(p);
  const s = await st(p);
  eq(s.length, 5, 'fișiere (fără .DS_Store): ' + JSON.stringify(s.map((x) => x.path)));
  assert(s.every((x) => /^dosar\//.test(x.path)), 'căi relative păstrate: ' + JSON.stringify(s.map((x) => x.path)));
  eq(by(s, 'dosar/poze/secret.jpg').risk.before, 3, 'GPS+serie+autor = ridicat');
  eq(by(s, 'dosar/poze/curat.jpg').risk.before, 0, 'fără metadate = 0');
  eq(by(s, 'dosar/acte/raport.pdf').risk.before, 3, 'PDF cu autor = ridicat');
  eq(by(s, 'dosar/note.txt').risk, null, 'nesuportat = neevaluat');
  assert(await p.locator('#sumCard').isVisible(), 'sumar vizibil');
  const rows = await p.locator('#sumBody tr').count(); eq(rows, 5);
  const txt = await p.textContent('#sumCounts'); assert(/5 fișiere/.test(txt) && /risc ridicat: 3/.test(txt) && /neevaluate: 1/.test(txt), txt);
  const sec = await p.locator('#sumBody tr', { hasText: 'secret.jpg' }).textContent();
  assert(/locație GPS/.test(sec) && /serie/.test(sec) && /autor/.test(sec), 'motive: ' + sec);
  await p.close();
});

await test('profiluri: „jurnalism” duce riscul la 0 și raportul înainte/după e în țintă', async () => {
  const p = await openApp(); await p.setInputFiles('#folderInput', folder); await settled(p);
  await pickProfile(p, 'journalism');
  let s = await st(p); eq(by(s, 'dosar/poze/secret.jpg').risk.verdict, 'est_ok', 'estimare înainte de curățare');
  await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p); s = await st(p);
  for (const n of ['dosar/poze/secret.jpg', 'dosar/acte/raport.pdf', 'dosar/acte/plan.svg']) { const r = by(s, n).risk; eq([r.before >= 2, r.after, r.verdict], [true, 0, 'ok'], n + ' ' + JSON.stringify(r)); }
  assert(/în țintă după curățare: 4/.test(await p.textContent('#sumCounts')) || /în țintă după curățare: 3/.test(await p.textContent('#sumCounts')), await p.textContent('#sumCounts'));
  await p.close();
});

await test('profiluri: „publicare” scoate titlul, „dosar oficial” îl păstrează; ținta diferă', async () => {
  const p = await openApp(); await p.setInputFiles('#fileInput', [wr('v/plan.svg', svg)]); await settled(p);
  await pickProfile(p, 'publish'); await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p);
  let out = (await dl(p, 'plan.svg', path.join(W, 'o-pub.svg'))).toString();
  assert(!out.includes('Titlu-Oficial-Vizibil') && !out.includes('Creator-Svg-Secret'), 'publicare: titlu/autor eliminate');
  await pickProfile(p, 'official'); await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p);
  out = (await dl(p, 'plan.svg', path.join(W, 'o-off.svg'))).toString();
  assert(out.includes('Titlu-Oficial-Vizibil'), 'dosar oficial: titlul rămâne'); assert(!out.includes('Creator-Svg-Secret'), 'dosar oficial: autorul pleacă');
  const note = await p.textContent('#sumNote').catch(() => ''); assert(note === '' || /mediu/.test(note), note);
  await p.close();
});

await test('verdict „peste țintă” când politica personalizată lasă autorul în PDF', async () => {
  const p = await openApp(); await p.setInputFiles('#fileInput', [wr('v/r.pdf', pdf)]); await settled(p);
  await pickProfile(p, 'custom'); await p.uncheck('#opt-pdfinfo'); await p.uncheck('#opt-pdfxmp'); await p.waitForTimeout(100); await settled(p);
  await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p);
  const r = (await st(p))[0].risk; eq(r.verdict, 'over', JSON.stringify(r)); assert(r.after >= 3, 'autorul a rămas: ' + r.after);
  await p.setInputFiles('#fileInput', [wr('v/r2.pdf', pdf)]); await settled(p);
  assert(await p.locator('#sumBody .vd-over').count() >= 1, 'verdictul „peste țintă” apare în sumar');
  await p.close();
});

await test('miniatură: se detectează miniatura care arată altceva decât imaginea (și nu semnalează una coerentă)', async () => {
  const p = await openApp();
  const same = wr('t/coerent.jpg', F.jpegInject(imgs.main, { exif: F.secretExif({ thumb: imgs.same, orientation: 1 }) }));
  const diff = wr('t/diferit.jpg', F.jpegInject(imgs.main, { exif: F.secretExif({ thumb: imgs.other, orientation: 1 }) }));
  await p.setInputFiles('#fileInput', [same, diff]); await settled(p);
  await p.waitForFunction(() => window.__curatitor.state().every((f) => f.thumbDiff !== undefined), null, { timeout: 15000 });
  const s = await st(p);
  eq(by(s, 'coerent.jpg').thumbDiff, false, 'miniatură coerentă'); eq(by(s, 'diferit.jpg').thumbDiff, true, 'miniatură diferită');
  await p.locator('li.file', { hasText: 'diferit.jpg' }).locator('button[data-act=view]').click();
  assert(/ALTĂ imagine/.test(await p.textContent('.box.warn')), 'avertisment miniatură diferită');
  assert(/zgomotul de senzor al aparatului/i.test(await p.textContent('.box.warn')), 'avertisment zgomot de senzor');
  await p.close();
});

await test('raport înainte/după HTML: autonom, fără nume implicit, cu risc înainte/după', async () => {
  const p = await openApp(); await p.setInputFiles('#folderInput', folder); await settled(p);
  await pickProfile(p, 'publish'); await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p);
  const get = async (values) => { if (values) await p.check('#repValues'); else await p.uncheck('#repValues'); const [d] = await Promise.all([p.waitForEvent('download'), p.click('#repHtml')]); const f = path.join(W, 'rep' + values + '.html'); await d.saveAs(f); return fs.readFileSync(f, 'utf8'); };
  const anon = await get(false);
  assert(/^<!doctype html>/i.test(anon) && /<table>/.test(anon), 'HTML valid'); assert(!/<script|src=|href=|https?:\/\//i.test(anon), 'fără resurse externe/script');
  assert(/file-1/.test(anon) && !/secret\.jpg/.test(anon), 'nume anonimizate implicit'); assert(/ridicat/.test(anon) && /în țintă/.test(anon), 'risc înainte + verdict');
  const named = await get(true); assert(/dosar\/poze\/secret\.jpg/.test(named), 'nume cu căi când se cere');
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#repJson')]); const jf = path.join(W, 'r.json'); await d.saveAs(jf); const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  eq([j.format, j.schema, j.profile], ['curatitor-report', 1, 'publish']); const f1 = j.files.find((x) => x.format === 'jpeg' && x.risk.before.level === 3);
  assert(f1 && f1.risk.after && f1.risk.after.level <= 1 && f1.risk.verdict === 'ok' && f1.risk.before.categories.gps >= 1, JSON.stringify(f1 && f1.risk));
  await p.close();
});

await test('ZIP: arhiva curățată păstrează structura de dosare', async () => {
  const p = await openApp(); await p.setInputFiles('#folderInput', folder); await settled(p);
  await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p);
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#zipBtn')]); const f = path.join(W, 'o.zip'); await d.saveAs(f);
  const buf = fs.readFileSync(f); const names = []; for (let i = 0; i + 30 < buf.length; i++) if (buf.readUInt32LE(i) === 0x04034b50) { const n = buf.readUInt16LE(i + 26), e = buf.readUInt16LE(i + 28); names.push(buf.toString('utf8', i + 30, i + 30 + n)); i += 29 + n + e; }
  assert(names.includes('dosar/poze/secret.curat.jpg') && names.includes('dosar/acte/raport.curat.pdf'), 'căi în arhivă: ' + names);
  await p.close();
});

await test('i18n: sumarul și profilurile noi sunt traduse în toate cele 8 limbi', async () => {
  const p = await openApp(); await p.setInputFiles('#folderInput', folder); await settled(p);
  const exp = { ro: 'Sumar dosar și risc', en: 'Folder summary and risk', fr: 'Résumé du dossier et risque', it: 'Riepilogo cartella e rischio', es: 'Resumen de carpeta y riesgo', pt: 'Resumo da pasta e risco', hu: 'Mappa összegzése és kockázat', de: 'Ordnerübersicht und Risiko' };
  for (const [l, v] of Object.entries(exp)) { await p.selectOption('#lang', l); await p.waitForTimeout(60); eq(await p.textContent('#sumH'), v, l); assert(!/^prof_|^risk|^rc_|^v_/.test(await p.textContent('input[value=journalism] ~ span')), l + ' profil'); const c = await p.textContent('#sumCounts'); assert(!/\{\w+\}/.test(c), l + ' substituții: ' + c); }
  await p.close();
});

await test('accesibilitate (axe) cu sumarul afișat, în temă luminoasă și întunecată', async () => {
  if (!AXE) throw new Error('axe-core lipsește (FFF_AXE / AXE_PATH)');
  const axeSrc = fs.readFileSync(AXE, 'utf8'); const c = await mkCtx({ bypassCSP: true });
  for (const scheme of ['light', 'dark']) {
    const p = await c.newPage(); await p.emulateMedia({ colorScheme: scheme }); await p.goto(APP); await p.waitForSelector('#list', { state: 'attached' });
    await p.setInputFiles('#folderInput', folder); await settled(p); await p.click('#cleanAll'); await p.waitForTimeout(50); await settled(p); await p.waitForTimeout(3600);
    assert(await p.locator('#sumCard').isVisible(), 'sumar vizibil');
    await p.evaluate(axeSrc); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
    assert(r.violations.length === 0, scheme + ': ' + r.violations.map((v) => v.id + ' x' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')).join('; '));
    await p.close();
  }
  await c.close();
});

await test('versiune și final: 0 erori de pagină, 0 violări CSP, 0 cereri de rețea', async () => {
  const p = await openApp();
  eq(await p.textContent('#app-version'), `v ${APP_JSON.version} · ${APP_JSON.updated}`);
  eq(await p.evaluate(() => window.__csp), []); await p.close();
  eq(pageErrors, [], 'erori de pagină'); eq(netReqs, [], 'cereri de rețea');
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' teste trecute' + (failed.length ? ', ' + failed.length + ' eșuate' : ''));
fs.rmSync(W, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
