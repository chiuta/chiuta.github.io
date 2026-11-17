#!/usr/bin/env node
// tools/compat/smoke.mjs — deschide fiecare aplicație single-file HTML o dată în Chromium NORMAL și o dată într-un „motor vechi" simulat
// (API-urile peste prag șterse, RegExp fără sintaxă nouă, fără <dialog> nativ — vezi legacy-env.mjs) și compară: orice eroare de pagină, CSP sau
// excepție neprinsă apărută DOAR în motorul vechi este o regresie de compatibilitate. Apoi deschide dialogul „Transparență" (kit) și îl închide cu Esc.
// Nu poate verifica sintaxa (o face audit.mjs, cu acorn) și nici aspectul CSS. Rețeaua e blocată (se raportează și încercările de ieșire).
//   node tools/compat/smoke.mjs [--root DIR] [--only A,B] [--skip A,B] [--shard K/N] [--jobs 4] [--json fisier] [--wait 900] [--mode both|legacy|native] [--quiet]
// Browser: CHROMIUM_PATH sau cel din Playwright; Playwright: pachetul `playwright` (PW_ROOT=/cale/package.json dacă nu e vizibil).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {findApps} from './audit.mjs';
import {legacyInit} from './legacy-env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const root = path.resolve(opt('--root', path.resolve(HERE, '..', '..', '..')));
const only = opt('--only') ? opt('--only').split(',') : null, skip = opt('--skip') ? opt('--skip').split(',') : null;
const jobs = Math.max(1, Number(opt('--jobs', 4)));
const wait = Number(opt('--wait', 900));
const mode = opt('--mode', 'both');

function loadPlaywright() {
  const bases = [process.env.PW_ROOT, import.meta.url, '/opt/node-tools/package.json'].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)('playwright'); } catch { /* următorul */ } }
  console.error('Nu găsesc pachetul `playwright` (npm i -D playwright, sau PW_ROOT=/cale/package.json).'); process.exit(2);
}
const {chromium} = loadPlaywright();

const norm = (s) => String(s).replace(/file:\/\/[^\s)]+/g, 'file').replace(/:\d+:\d+/g, '').replace(/\(\d+:\d+\)/g, '').replace(/line \d+/gi, 'line').replace(/\s+/g, ' ').trim().slice(0, 220);
const IGNORE = /Failed to load resource|net::ERR|ERR_FAILED|ERR_BLOCKED|aborted|favicon|ServiceWorker|service worker|Service worker/i;

async function run(browser, file, legacy) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block', acceptDownloads: true, locale: 'en-US'});
  const net = [], errors = [];
  await ctx.route(/^https?:/, (r) => { net.push(r.request().url()); r.abort(); });
  await ctx.addInitScript({content: legacy ? legacyInit() : "try { Object.defineProperty(navigator, 'webdriver', {get: () => false}); } catch (e) {}"});
  await ctx.addInitScript({content: "window.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + String(e.blockedURI).slice(0, 80)); });"});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message ? e.message : e)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !IGNORE.test(t)) errors.push('console: ' + t); });
  const t0 = Date.now();
  let info = {};
  try {
    await page.goto(pathToFileURL(file).href, {waitUntil: 'load', timeout: 30000});
    await page.waitForTimeout(wait);
    // scurtă interacțiune: Tab, derulare, dialogul „Transparență"
    await page.keyboard.press('Tab').catch(() => {}); await page.mouse.wheel(0, 600).catch(() => {}); await page.waitForTimeout(150);
    info = await page.evaluate(async () => {
      const out = {kit: typeof FFF !== 'undefined' ? FFF.version : null, compat: typeof FFF !== 'undefined' && FFF.compat ? {tooOld: !!FFF.compat.tooOld, missing: FFF.compat.missing || [], cls: document.documentElement.className} : null};
      const b = document.getElementById('app-version');
      if (b) { try { b.click(); await new Promise((r) => setTimeout(r, 350)); const d = document.querySelector('dialog.fff-dlg[open], .fff-dlg[open]'); out.dialog = !!d; if (d) { d.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await new Promise((r) => setTimeout(r, 200)); out.closed = !(document.querySelector('dialog.fff-dlg[open], .fff-dlg[open]')); } } catch (e) { out.dlgErr = String(e && e.message || e); } }
      out.csp = window.__csp || [];
      out.body = document.body ? document.body.innerText.length : 0;
      return out;
    });
  } catch (e) { errors.push('navigare: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
  const ms = Date.now() - t0;
  await ctx.close();
  if (info.csp && info.csp.length) for (const c of info.csp) errors.push('csp: ' + c);
  return {errors: [...new Set(errors.map(norm))], net: [...new Set(net)].slice(0, 5), info, ms};
}

let apps = findApps(root, only, skip);
if (opt('--shard')) { const [k, n] = opt('--shard').split('/').map(Number); apps = apps.filter((_, i) => i % n === k); }   // --shard K/N: rulare în bucăți (fiecare cu propriul --json)
const results = {};
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
let next = 0, done = 0;
async function worker() {
  while (next < apps.length) {
    const a = apps[next++];
    const r = {file: a.rel};
    if (mode !== 'legacy') r.native = await run(browser, a.file, false);
    if (mode !== 'native') r.legacy = await run(browser, a.file, true);
    const base = new Set((r.native ? r.native.errors : []));
    r.newErrors = r.legacy ? r.legacy.errors.filter((e) => !base.has(e)) : [];
    const dlgBroken = r.legacy && r.legacy.info && r.legacy.info.dialog === false && r.native && r.native.info && r.native.info.dialog === true;
    const emptied = r.legacy && r.native && r.native.info.body > 50 && (r.legacy.info.body || 0) < r.native.info.body * 0.5;
    r.status = r.newErrors.length || dlgBroken || emptied ? 'fail' : (r.native && r.native.errors.length ? 'warn' : 'ok');
    if (dlgBroken) r.newErrors.push('dialogul „Transparență" nu se deschide în motorul vechi');
    if (emptied) r.newErrors.push(`conținut vizibil mult redus în motorul vechi (${r.native.info.body} → ${r.legacy.info.body} caractere)`);
    results[a.id] = r;
    done++;
    if (!flag('--quiet') && r.status !== 'ok') console.log(`${r.status.toUpperCase().padEnd(5)} ${a.id.padEnd(40)} ${r.newErrors.slice(0, 2).join(' | ') || (r.native ? 'doar în motorul normal: ' + r.native.errors.slice(0, 1).join('') : '')}`);
  }
}
await Promise.all(Array.from({length: jobs}, worker));
await browser.close();
const sum = {apps: apps.length, ok: 0, warn: 0, fail: 0};
for (const v of Object.values(results)) sum[v.status]++;
console.log(`smoke: ${sum.apps} aplicații · ok ${sum.ok} · doar erori native ${sum.warn} · REGRESII în motorul vechi ${sum.fail}`);
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify({generated: new Date().toISOString().slice(0, 10), mode, summary: sum, apps: results}, null, 1) + '\n');
process.exit(sum.fail ? 1 : 0);
