// Aplică pwa.mjs pe COPII ale tuturor aplicațiilor din inventar și verifică (CSP + încărcare reală cu SW).
// node batch.mjs [rădăcină=S/tmp_k5]  → scrie S/wave/k5_batch.json
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import * as pwa from '../pwa.mjs';
import {getDirective} from '../pwa.mjs';
import {checkCspHashes} from '../../lib/csp.mjs';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const S = '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad';
const ROOT = process.argv[2] || S + '/tmp_k5';
const inv = JSON.parse(fs.readFileSync(S + '/site2/shots_inv.json', 'utf8'));
const SMOKE = process.env.NOSMOKE ? false : true;
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const d of ['all', 'orig']) fs.rmSync(path.join(ROOT, d), {recursive: true, force: true});
const apps = [];
for (const a of inv) {
  if (!a.htmls.includes('index.html')) { apps.push({name: a.proper, skip: 'fără index.html (nu e aplicație HTML: ' + (a.dist ? 'dist/' : 'plugin/depozit') + ')'}); continue; }
  const slug = a.path.split('/').pop().toLowerCase();
  for (const d of ['all', 'orig']) {
    const dst = path.join(ROOT, d, a.proper); fs.mkdirSync(dst, {recursive: true});
    for (const f of fs.readdirSync(a.path)) { const p = path.join(a.path, f); const st = fs.statSync(p); if (st.isFile() && st.size < 8e6 && !/^\.|\.(md|zip|mp4|wav|mp3)$/i.test(f)) fs.copyFileSync(p, path.join(dst, f)); }
  }
  apps.push({name: a.proper, slug, dir: path.join(ROOT, 'all', a.proper), orig: path.join(ROOT, 'orig', a.proper)});
}

const rows = [];
for (const a of apps) {
  if (a.skip) { rows.push({app: a.name, status: 'skipped', reason: a.skip}); continue; }
  const before = {m: getDirective(fs.readFileSync(a.dir + '/index.html', 'utf8'), 'manifest-src'), w: getDirective(fs.readFileSync(a.dir + '/index.html', 'utf8'), 'worker-src'), i: getDirective(fs.readFileSync(a.dir + '/index.html', 'utf8'), 'img-src')};
  let r;
  try { r = await pwa.apply(a.dir, {slug: a.slug}); } catch (e) { r = {status: 'error', reason: e.message}; }
  const row = {app: a.name, slug: a.slug, status: r.status, reason: r.reason};
  if (r.status === 'ok') {
    const c = pwa.check(a.dir);
    const html = fs.readFileSync(a.dir + '/index.html', 'utf8');
    row.check = c.ok ? 'ok' : c.problems.join('; ');
    row.checkWarn = c.info.warnings;
    row.csp = {manifest: [before.m, getDirective(html, 'manifest-src')], worker: [before.w, getDirective(html, 'worker-src')], img: [before.i, getDirective(html, 'img-src')], hashes: checkCspHashes(html).ok};
    row.name = r.name; row.short = r.short; row.mono = r.mono; row.theme = r.theme; row.themeSource = r.themeSource; row.version = r.version; row.categories = r.categories; row.warnings = r.warnings;
    // idempotență
    const h1 = html; await pwa.apply(a.dir, {slug: a.slug}); row.idempotent = fs.readFileSync(a.dir + '/index.html', 'utf8') === h1;
    // remove pe copia „orig” nu e nevoie: verificăm remove pe o copie temporară
    const tmp = a.dir + '.rm'; fs.cpSync(a.dir, tmp, {recursive: true});
    const rm = pwa.remove(tmp);
    const norm = h => h.replace(/'sha256-[^']+'\s*/g, '').replace(/\s+;/g, ';');
    row.removeRestores = rm.status === 'ok' && norm(fs.readFileSync(tmp + '/index.html', 'utf8')) === norm(fs.readFileSync(a.orig + '/index.html', 'utf8'));
    fs.rmSync(tmp, {recursive: true, force: true});
  }
  rows.push(row);
  process.stdout.write(`${row.status === 'ok' ? 'OK  ' : row.status.toUpperCase().padEnd(4)} ${a.name}${row.reason ? ' — ' + row.reason : ''}${row.check && row.check !== 'ok' ? ' CHECK: ' + row.check : ''}\n`);
}
await pwa.closeBrowser();

// ── smoke în browser: înainte vs. după ──
if (SMOKE) {
  const PORT = 8800 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '-d', ROOT], {stdio: 'ignore'});
  await sleep(1500);
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
  async function load(url, withSW) {
    const ctx = await browser.newContext({viewport: {width: 1000, height: 700}});
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    const page = await ctx.newPage(); const err = [], csp = [];
    page.on('pageerror', e => err.push(String(e.message).slice(0, 120)));
    page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 140)); });
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const res = {};
    try {
      await page.goto(url, {waitUntil: 'load', timeout: 45000});
      if (withSW) {
        res.sw = await page.evaluate(async () => { try { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((_, j) => setTimeout(() => j('timeout'), 12000))]); return r.scope; } catch (e) { return 'ERR ' + e; } });
        await sleep(1200);
        res.cache = await page.evaluate(async () => { const o = {}; for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length; return o; });
        res.hasIndex = await page.evaluate(async () => { for (const k of await caches.keys()) { if (await (await caches.open(k)).match('./index.html')) return true; } return false; });
        await ctx.setOffline(true);
        const t = await page.title();
        try { await page.reload({waitUntil: 'load', timeout: 30000}); res.offlineOk = (await page.title()) === t && (await page.evaluate(() => document.body.innerText.length)) > 0; } catch (e) { res.offlineOk = false; res.offlineErr = String(e.message).slice(0, 80); }
        await ctx.setOffline(false);
      } else await sleep(2500);
      csp.push(...(await page.evaluate(() => window.__csp || []).catch(() => [])));
    } catch (e) { res.loadErr = String(e.message).slice(0, 100); }
    await ctx.close(); res.err = err; res.csp = [...new Set(csp)]; return res;
  }
  const todo = rows.filter(r => r.status === 'ok');
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const r = todo[idx++]; const enc = encodeURIComponent(r.app);
      const b = await load(`http://127.0.0.1:${PORT}/orig/${enc}/index.html`, false);
      const a = await load(`http://127.0.0.1:${PORT}/all/${enc}/`, true);
      r.smoke = {sw: a.sw, cache: a.cache, hasIndex: a.hasIndex, offlineOk: a.offlineOk, offlineErr: a.offlineErr, loadErr: a.loadErr,
        pageerrorsBefore: b.err.length, pageerrorsAfter: a.err.length, newPageerrors: a.err.filter(e => !b.err.includes(e)),
        cspBefore: b.csp.length, cspAfter: a.csp.length, newCsp: a.csp.filter(e => !b.csp.includes(e))};
      const bad = !a.sw || String(a.sw).startsWith('ERR') || !a.hasIndex || a.offlineOk === false || r.smoke.newPageerrors.length || r.smoke.newCsp.length;
      r.smoke.ok = !bad;
      process.stdout.write(`${bad ? 'BAD ' : 'good'} ${r.app} sw=${a.sw ? 'da' : 'nu'} offline=${a.offlineOk} newErr=${r.smoke.newPageerrors.length} newCsp=${r.smoke.newCsp.length}\n`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  await browser.close(); srv.kill('SIGTERM');
}
const summary = {
  total: rows.length, ok: rows.filter(r => r.status === 'ok').length,
  skipped: rows.filter(r => r.status === 'skipped').map(r => ({app: r.app, reason: r.reason})),
  errors: rows.filter(r => r.status === 'error').map(r => ({app: r.app, reason: r.reason})),
  checkFail: rows.filter(r => r.status === 'ok' && r.check !== 'ok').map(r => ({app: r.app, problems: r.check})),
  notIdempotent: rows.filter(r => r.status === 'ok' && !r.idempotent).map(r => r.app),
  removeNotRestoring: rows.filter(r => r.status === 'ok' && !r.removeRestores).map(r => r.app),
  smokeBad: rows.filter(r => r.smoke && !r.smoke.ok).map(r => ({app: r.app, smoke: r.smoke})),
};
fs.writeFileSync(S + '/wave/k5_batch.json', JSON.stringify({summary, rows}, null, 1));
console.log(JSON.stringify({...summary, skipped: summary.skipped.length, smokeBad: summary.smokeBad.length}, null, 1));
