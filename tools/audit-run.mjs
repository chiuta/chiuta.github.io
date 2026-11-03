#!/usr/bin/env node
/* tools/audit-run.mjs — rulează măsurătorile auditului 7 pe aplicații și scrie un JSON pe aplicație.
 *   node tools/audit-run.mjs --root /home/claude/demo/apps --out /tmp/audit7 [--only A,B] [--skip-tests] [--skip-axe]
 * Măsurători (toate rulate, nimic estimat):
 *   build   : `fff-kit/build.mjs check <app>` (CSP, hash-uri, reguli native-dialog / unprefixed-storage / i18n-parity ...)
 *   axe     : fff-kit/ci/axe-check.mjs (pagina + dialogul Transparență, 360/1366 px, luminos/întunecat; 8 scenarii)
 *   tests   : fiecare tests/*.mjs al aplicației, cod de ieșire 0 = trece (fiecare fișier rulat o dată, timeout 590 s)
 *   static  : din index.html / app.json: connect-src 'none', script inline doar cu hash, host-uri externe, sw.js, limbi, dimensiune
 * Scorul (0–10) se calculează în tools/transparenta.mjs din aceste fișiere; vezi docs/GHID-AUTORI.md, secțiunea „Scorul”. */
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2); const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const ROOT = path.resolve(opt('--root', '/home/claude/demo/apps')), OUT = path.resolve(opt('--out', '/tmp/audit7'));
const only = opt('--only', '') ? opt('--only').split(',') : null;
fs.mkdirSync(OUT, {recursive: true});
const env = {...process.env, FFF_AXE: process.env.FFF_AXE || '/tmp/claude-0/axe/node_modules/axe-core/axe.min.js'}; env.AXE_PATH = env.FFF_AXE;
const run = (cmd, args, cwd, timeout) => { const t = Date.now(); const r = spawnSync(cmd, args, {cwd, env, encoding: 'utf8', timeout, maxBuffer: 1 << 26}); return {code: r.status, signal: r.signal, out: ((r.stdout || '') + (r.stderr || '')), ms: Date.now() - t, timedOut: r.error && r.error.code === 'ETIMEDOUT'}; };
const dirs = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).filter((d) => !only || only.includes(d)).sort();
for (const d of dirs) {
  const dir = path.join(ROOT, d), res = {app: d, at: new Date().toISOString()};
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  let aj = {}; try { aj = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8')); } catch {}
  const csp = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i) || [])[1] || '';
  const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()));
  res.static = {ver: aj.version || null, size: Buffer.byteLength(html), cspPresent: !!csp, connectNone: /connect-src\s+'none'/.test(csp), scriptHashOnly: csp ? !/script-src[^;]*'unsafe-inline'/.test(csp) && !/script-src[^;]*https?:/.test(csp) : false,
    egress: (aj.egress || []).length, sw: fs.existsSync(path.join(dir, 'sw.js')), manifest: fs.existsSync(path.join(dir, 'manifest.webmanifest')), langs: ((aj.features || {}).i18n || []).length, hosts: hosts.size};
  if (!process.argv.includes('--skip-build')) { const r = run('node', [path.join(HUB, 'fff-kit/build.mjs'), 'check', dir], HUB, 120000); res.build = {ok: r.code === 0, msg: r.out.trim().split('\n').slice(-2).join(' | ').slice(0, 300), ms: r.ms}; }
  if (!process.argv.includes('--skip-axe')) { const r = run('node', [path.join(HUB, 'fff-kit/ci/axe-check.mjs'), dir], HUB, +(process.env.AXE_TIMEOUT || 240000)); const m = r.out.match(/(\d+) violări în (\d+) scenarii/); res.axe = {ok: r.code === 0 && !!m && m[1] === '0', violations: m ? +m[1] : null, scenarios: m ? +m[2] : null, timedOut: !!r.timedOut, ms: r.ms, msg: r.out.trim().split('\n').slice(-2).join(' | ').slice(0, 300)}; }
  const tdir = path.join(dir, 'tests'); res.tests = {files: []};
  if (!process.argv.includes('--skip-tests') && fs.existsSync(tdir)) {
    for (const f of fs.readdirSync(tdir).filter((x) => /\.test\.mjs$|^test\.mjs$/.test(x)).sort()) { const r = run('node', [path.join('tests', f)], dir, 590000); const m = r.out.match(/(\d+) (?:ok|reușite|passed|verzi)/i); res.tests.files.push({f, ok: r.code === 0, code: r.code, ms: r.ms, timedOut: !!r.timedOut, note: r.code === 0 ? (m ? m[0] : '') : r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}); }
  } else if (process.argv.includes('--skip-tests')) res.tests.skipped = true;
  fs.writeFileSync(path.join(OUT, d + '.json'), JSON.stringify(res, null, 1));
  console.log(d, 'build', res.build && res.build.ok, 'axe', res.axe && res.axe.violations, 'tests', res.tests.files.filter((x) => x.ok).length + '/' + res.tests.files.length);
}
