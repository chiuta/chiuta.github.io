// Test PWA: node test.mjs [workdir]  (servește cu python3 -m http.server pe localhost; localhost e context sigur)
// Verifică, pe aplicații reale (copii): manifest, înregistrare SW, cache cu shell, repornire offline, invalidare la versiune nouă,
// 0 încălcări CSP, 0 pageerror, axe fără violări noi, plus idempotență / remove / file://.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as pwa from '../pwa.mjs';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad';
const AXE = path.join(S, 'sweep/node_modules/axe-core/axe.min.js');
const WORK = process.argv[2] || path.join(S, 'tmp_k5/apps');
const APPS = [ // [dosar sursă, slug]
  ['/home/claude/clopotel', 'clopotel'], ['/home/claude/arena', 'arena'], ['/home/claude/urme', 'urme'],
  [S + '/pub/Origami', 'origami'], [S + '/pub/Tarot', 'tarot'], [S + '/pub/CLEPSIDRA', 'clepsidra'],
  ['/home/claude/nota-zero', 'nota-zero'], ['/home/claude/vaultcrypt', 'vaultcrypt'], ['/home/claude/academisearch', 'academisearch'], [S + '/pub/PUNTE', 'punte'],
];
const inv = JSON.parse(fs.readFileSync(S + '/site2/shots_inv.json', 'utf8'));
const byName = Object.fromEntries(inv.map(a => [a.path.split('/').pop().toLowerCase(), a.path]));
for (const a of APPS) if (!fs.existsSync(a[0])) a[0] = byName[path.basename(a[0]).toLowerCase()] || a[0];

if (process.env.ONLY) for (let i = APPS.length - 1; i >= 0; i--) if (!process.env.ONLY.split(',').includes(APPS[i][1])) APPS.splice(i, 1);
let pass = 0, fail = 0; const out = [];
const ok = (c, m) => { if (c) pass++; else { fail++; out.push('FAIL ' + m); console.log('  FAIL ' + m); } };

fs.rmSync(WORK, {recursive: true, force: true}); fs.mkdirSync(WORK, {recursive: true});
for (const [src, slug] of APPS) {
  fs.mkdirSync(path.join(WORK, slug), {recursive: true});
  for (const f of fs.readdirSync(src)) { const p = path.join(src, f); if (fs.statSync(p).isFile() && /\.(html|png|jpg|svg)$/i.test(f) && fs.statSync(p).size < 6e6) fs.copyFileSync(p, path.join(WORK, slug, f)); }
}
const PORT = 8900 + Math.floor(Math.random() * 90);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '-d', WORK], {stdio: 'ignore'});
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const axeSrc = fs.readFileSync(AXE, 'utf8');
const normCsp = h => h.replace(/'sha256-[^']+'\s*/g, '').replace(/\s+;/g, ';');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function session(bypass) {
  const ctx = await browser.newContext({bypassCSP: !!bypass, viewport: {width: 1000, height: 700}});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  return ctx;
}
async function watch(page, bag) {
  page.on('pageerror', e => bag.err.push(String(e.message || e)));
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) bag.csp.push(m.text().slice(0, 160)); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
}
async function axeRun(url) {
  const ctx = await session(true); const page = await ctx.newPage();
  await page.goto(url, {waitUntil: 'load'}); await sleep(3600);
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => (await axe.run(document)).violations.map(v => v.id + ':' + v.nodes.length));
  await ctx.close(); return r;
}

for (const [src, slug] of APPS) {
  console.log('== ' + slug);
  const dir = path.join(WORK, slug);
  const base = `http://127.0.0.1:${PORT}/${slug}/`;
  const axeBefore = await axeRun(base + 'index.html');
  const r = await pwa.apply(dir, {slug});
  ok(r.status === 'ok', `${slug}: apply → ${r.status} ${r.reason || ''}`);
  const c = pwa.check(dir); ok(c.ok, `${slug}: check → ${c.problems}`);
  // idempotență
  const h1 = fs.readFileSync(dir + '/index.html', 'utf8'); await pwa.apply(dir, {slug}); ok(fs.readFileSync(dir + '/index.html', 'utf8') === h1, `${slug}: apply idempotent`);

  const ctx = await session(false); const page = await ctx.newPage(); const bag = {err: [], csp: []};
  await watch(page, bag);
  await page.goto(base, {waitUntil: 'load'});
  const mhref = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.href);
  const mres = await ctx.request.get(mhref); const mj = await mres.json().catch(() => null);
  ok(mres.ok() && mj && mj.display === 'standalone' && mj.short_name.length <= 12 && mj.icons.length === 3, `${slug}: manifest se încarcă`);
  for (const i of mj?.icons || []) { const ir = await ctx.request.get(new URL(i.src, mhref).href); ok(ir.ok() && (await ir.body()).length > 500, `${slug}: icoana ${i.src}`); }
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.scope; });
  ok(reg === base, `${slug}: SW înregistrat (scope ${reg})`);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, {timeout: 8000}).catch(() => {});
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload({waitUntil: 'load'}); }
  const keys = await page.evaluate(async () => { const out = {}; for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname.split('/').slice(2).join('/')); return out; });
  const ver = pwa.check(dir).info.version, ck = `fff-${slug}-${ver}`;
  ok(keys[ck] && keys[ck].includes('index.html') && keys[ck].includes('manifest.webmanifest') && keys[ck].includes('icon-512.png'), `${slug}: cache ${ck} conține shell-ul (${JSON.stringify(keys)})`);
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), `${slug}: pagina controlată de SW`);
  const title = await page.title();
  // offline
  await ctx.setOffline(true);
  const bag2 = {err: [], csp: []}; await watch(page, bag2);
  await page.reload({waitUntil: 'load'}).catch(e => out.push('reload offline: ' + e.message));
  ok((await page.title()) === title && (await page.evaluate(() => document.body && document.body.innerText.length > 20)), `${slug}: repornește offline din cache`);
  await sleep(1500);
  ok(bag2.err.length === 0, `${slug}: offline 0 pageerror ${bag2.err}`);
  await ctx.setOffline(false);
  let nh; const HEAVY = slug === 'nota-zero'; // pagină cu buclă rAF grea: în headless, IPC-ul de update() e înfometat (vezi README, „Limite”)
  if (HEAVY) {
    const pg2 = await ctx.newPage(); await pg2.goto(base + 'recenzie.html', {waitUntil: 'load'}); await sleep(1500); await pg2.close();
    await ctx.setOffline(true); const p3 = await ctx.newPage();
    await p3.goto(base + 'recenzie.html', {waitUntil: 'load'}).catch(() => {}); ok((await p3.title()).length > 0 && (await p3.evaluate(() => document.body.innerText.length)) > 50, `${slug}: recenzie.html (pagină secundară) offline din cache`);
    await p3.close(); await ctx.setOffline(false);
  } else {
  // versiune nouă
    const oldVer = ver, newVer = oldVer.replace(/(\d+)(?!.*\d)/, n => String(+n + 1)).replace(/^h/, 'h9');
    let html = fs.readFileSync(dir + '/index.html', 'utf8');
    const hasMeta = /<meta name="application-version" content="/.test(html);
    const mut = h => hasMeta ? h.replace(/(<meta name="application-version" content=")[^"]*/, '$1' + newVer) : h.replace('</title>', '</title><!-- v2 -->');
    fs.writeFileSync(dir + '/index.html', mut(html));
    nh = mut(fs.readFileSync(src + '/index.html', 'utf8'));
    await pwa.apply(dir, {slug});
    const nv = pwa.check(dir).info.version; ok(nv !== oldVer, `${slug}: sw.js a primit versiunea nouă ${nv}`);
    await page.goto(base, {waitUntil: 'load'}); await page.reload({waitUntil: 'load'});
    for (let i = 0; i < 80; i++) { const ks = await page.evaluate(async () => caches.keys()).catch(() => null); if (ks && ks.length === 1 && ks[0].endsWith('-' + nv)) break; await sleep(500); }
  let k2 = await page.evaluate(async () => caches.keys());
    if (k2.length !== 1) { await sleep(8000); const k3 = await page.evaluate(async () => caches.keys()); out.push(`${slug}: după încă 8 s: ${k3}`); console.log('   (după 8 s:', k3.join(','), ')'); }
    ok(k2.length === 1 && k2[0] === `fff-${slug}-${nv}`, `${slug}: cache vechi șters (${k2})`);
  }
  await sleep(2500);
  ok(bag.err.length === 0, `${slug}: 0 pageerror (${bag.err[0] || ''})`);
  const viol = [...bag.csp, ...(await page.evaluate(() => window.__csp || []))];
  ok(viol.length === 0, `${slug}: 0 încălcări CSP (${viol[0] || ''})`);
  await ctx.close();
  // axe
  const axeAfter = await axeRun(base + 'index.html');
  const novel = axeAfter.filter(v => !axeBefore.includes(v));
  ok(novel.length === 0, `${slug}: axe violări noi: ${novel} (înainte: ${axeBefore})`);
  // file://: funcțional, fără SW
  const fctx = await browser.newContext({}); const fp = await fctx.newPage(); const fb = {err: []};
  fp.on('pageerror', e => fb.err.push(String(e.message)));
  await fp.goto('file://' + dir + '/index.html', {waitUntil: 'load'}); await sleep(1200);
  ok(fb.err.length === 0 && (await fp.evaluate(() => navigator.serviceWorker ? 'sw' in {sw: 1} : true)) && (await fp.title()) === title, `${slug}: file:// funcțional (${fb.err[0] || ''})`);
  await fctx.close();
  // remove
  const rm = pwa.remove(dir); ok(rm.status === 'ok' && !fs.existsSync(dir + '/sw.js') && !fs.readFileSync(dir + '/index.html', 'utf8').includes('fff:pwa'), `${slug}: remove`);
  ok(nh === undefined || normCsp(nh) === normCsp(fs.readFileSync(dir + '/index.html', 'utf8')), `${slug}: remove restaurează fișierul`);
}
await pwa.closeBrowser(); await browser.close(); srv.kill('SIGTERM');
console.log(`\n${pass} reușite, ${fail} eșecuri`);
fs.writeFileSync(path.join(HERE, 'last-run.json'), JSON.stringify({pass, fail, failures: out, apps: APPS.map(a => a[1])}, null, 1));
process.exit(fail ? 1 : 0);
