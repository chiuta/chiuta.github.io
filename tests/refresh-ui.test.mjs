// Etapa 8.6 — „date actualizate la …”, sursa, insigna „învechit” și tabelul „sănătatea surselor”. Rulare: node tests/refresh-ui.test.mjs
// Cerințe: /opt/node-tools (playwright) + Chromium (CHROMIUM_PATH sau /opt/pw-browsers/chromium). Fără rețea externă.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png'};
let fail = 0;
const T = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n       ' + String(e.message || e).split('\n')[0]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(HUB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(HUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'});
async function open(lang, url = '') {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, locale: lang + '-' + lang.toUpperCase(), serviceWorkers: 'block'});
  const page = await ctx.newPage(), bad = [];
  page.on('pageerror', (e) => bad.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') bad.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) bad.push('cerere externă ' + r.url()); });
  await page.addInitScript((l) => { try { localStorage.setItem('lang', l); localStorage.setItem('hub.lang', l); } catch (e) {} }, lang);
  await page.goto(BASE + url); await page.waitForSelector(url ? '#content table' : '#apps-grid .app-card');
  return {page, bad, close: () => ctx.close()};
}
const line = (page, k) => page.evaluate((k) => { const c = document.getElementById('app-' + k); const d = c && c.querySelector('.card-data'); return d ? d.textContent : null; }, k);

await T('cardurile cu sursă principală arată „date actualizate/verificate la …” + sursa; cele fără sursă nu arată nimic', async () => {
  const {page, bad, close} = await open('ro');
  const meta = JSON.parse(await page.evaluate(() => document.getElementById('source-health').textContent));
  const cardApps = Object.entries(meta.ds).filter(([, l]) => l.some((e) => e.card)).map(([k]) => k);
  ok(cardApps.length >= 10, 'prea puține aplicații cu sursă pe card: ' + cardApps.length);
  for (const k of cardApps) {
    if (!(await page.$('#app-' + k + ':not([data-variant-of])'))) continue;
    const t = await line(page, k); ok(t, k + ': fără linie de date');
    ok(/^(Date actualizate la \d{4}-\d\d-\d\d|Date verificate de autor la \d{4}-\d\d(-\d\d)?|Data datelor: neconfirmată) · sursa: [\w.-]+\.[a-z]+$/.test(t), k + ': format neașteptat: ' + t);
  }
  ok((await line(page, 'Sudoku-fara-frontiere')) === null, 'Sudoku nu are sursă externă');
  ok(!bad.length, bad.join(' | ')); await close();
});

await T('„învechit”: apare doar peste 2× cadența, niciodată pentru sursele înghețate sau neactive; titlul explică', async () => {
  const {page, close} = await open('ro');
  const r = await page.evaluate(() => {
    const out = {};
    const stale = (k) => { const c = document.getElementById('app-' + k), b = c.querySelector('.bd-stale'); return b ? b.title : null; };
    SH.s.VNTV = {ok: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), st: 'ok'}; decorateCards(); out.fresh = stale('VNTV');
    SH.s.VNTV = {ok: '2000-01-01', st: 'ok'}; decorateCards(); out.old = stale('VNTV');
    out.frozen = stale('ATINGERE'); out.inventory = stale('Cupa-Mondiala-2026');
    out.days = SH.ds.VNTV.find((x) => x.card).days; out.dup = document.getElementById('app-VNTV').querySelectorAll('.card-data').length;
    return out;
  });
  ok(r.dup === 1, 'linia de date apare de ' + r.dup + ' ori după redesenare');
  ok(r.fresh === null, 'VNTV actualizat acum 3 zile nu e învechit: ' + r.fresh);
  ok(r.days === 7, 'VNTV e „viu” (7 zile)'); ok(r.old && /săptămânal/.test(r.old), 'insigna lipsește pentru 2000-01-01: ' + r.old);
  ok(r.frozen === null && r.inventory === null, 'înghețat / neactiv nu expiră');
  await close();
});

await T('fișa listează toate sursele aplicației; textele sunt traduse în cele 8 limbi, fără substituenți rămași', async () => {
  const seen = new Set();
  for (const l of LANGS) {
    const {page, bad, close} = await open(l);
    const t = await line(page, 'VNTV'); ok(t && !/\{d\}|undefined/.test(t), l + ': ' + t); seen.add(t.replace(/\d{4}-\d\d-\d\d/, ''));
    const row = await page.evaluate(() => { const c = document.getElementById('app-VNTV'); c.querySelector('details.fisa').open = true; const l = c.querySelector('.src-list'); return l ? l.textContent : null; });
    ok(row && /VNTV · www\.videoneat\.com/.test(row) && !/undefined|\{/.test(row), l + ': fișă ' + row);
    ok(!bad.length, l + ': ' + bad.join(' | ')); await close();
  }
  ok(seen.size >= 7, 'traduceri prea puține diferite: ' + seen.size);
});

await T('transparenta.html: tabelul „sănătatea surselor” în 8 limbi, o linie pe sursă, fără substituenți', async () => {
  const D = JSON.parse(fs.readFileSync(path.join(HUB, 'data/transparenta.json'), 'utf8')), n = D.a8.sources.length;
  for (const l of LANGS) {
    const {page, bad, close} = await open(l, 'transparenta.html');
    await page.waitForSelector('#s-src');
    const r = await page.evaluate(() => { const s = document.getElementById('s-src').parentElement; return {rows: s.querySelectorAll('tbody tr').length, text: s.textContent, h: s.querySelector('h2').textContent}; });
    ok(r.rows === n, `${l}: ${r.rows} rânduri, se așteptau ${n}`); ok(!/\{\w+\}|undefined|null/.test(r.text), l + ': substituent rămas'); ok(r.h.length > 5, l);
    ok(!bad.length, l + ': ' + bad.join(' | ')); await close();
  }
});

await browser.close(); server.close();
console.log(fail ? `\n${fail} teste pică.` : '\nToate trec.');
process.exit(fail ? 1 : 0);
