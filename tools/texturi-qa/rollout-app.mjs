#!/usr/bin/env node
// Pune texturile fractale într-o aplicație clonată și o verifică vizual, într-o singură comandă.
//   node tools/texturi-qa/rollout-app.mjs <dirAplicație> --m <material> [--p <material>] [--a 1] [--seed 7] [--inc "sel"] [--exc "sel"] [--release] [--no-shots] [--out <dir>] [--views "0,1400"]
// Pași: citește app.json (slug) → capturi „înainte” (?notex=1) → texturi-register → inject-shared (--nokit automat dacă lipsește kitul) → --check → capturi „după”
//       (luminos 1280×800 la derulările cerute, întunecat, mobil 390×800) → comparații → JSON-ul-rezumat (și în <out>/summary.json).
// Nu face commit și nu împinge nimic: asta o face cine apelează, după ce se uită la capturi.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const QA = path.dirname(fileURLToPath(import.meta.url)), HUB = path.join(QA, '../..');
const argv = process.argv.slice(2), dir = path.resolve(argv[0] || '');
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; }, has = (f) => argv.includes(f);
if (!argv[0] || !fs.existsSync(path.join(dir, 'index.html'))) { console.error('utilizare: rollout-app.mjs <dirAplicație cu index.html> --m <material> [...]'); process.exit(2); }
const app = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8')); } catch { return null; } })();
if (!app || !app.slug) { console.error('app.json lipsește sau nu are „slug” în ' + dir); process.exit(2); }
const slug = app.slug, out = path.resolve(val('--out', path.join('/home/claude/fractal/shots', slug))); fs.mkdirSync(out, {recursive: true});
const run = (cmd, args, o = {}) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 26, ...o});
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), nokit = !html.includes('<!--fff:kit:end-->');
const views = (val('--views', '0,1400')).split(',').map(Number), res = {slug, dir, version0: app.version, nokit, steps: {}, shots: {}, errors: []};
const shot = (name, extra) => {
  const png = path.join(out, name + '.png'), r = run('python3', [path.join(QA, 'app-shot.py'), path.join(dir, 'index.html'), png, ...extra], {timeout: 420000});
  let j = null; try { j = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* fără JSON */ }
  if (!j) res.errors.push(`captura ${name} a eșuat: ${(r.stderr || r.stdout || '').slice(-300)}`);
  return {png, j};
};
if (!has('--no-shots')) for (const y of views) res.shots['before_' + y] = shot('before_' + y, ['--off', '--scroll', String(y), '--size', '512']);

// 1) înregistrare + injectare
const reg = ['--m', val('--m', 'parchment')]; for (const k of ['--p', '--a', '--seed', '--inc', '--exc', '--max']) if (val(k) != null) reg.push(k, val(k));
let r = run('node', [path.join(HUB, 'tools/texturi-register.mjs'), slug, ...reg]); res.steps.register = (r.stdout + r.stderr).trim();
if (r.status) { console.log(JSON.stringify({...res, fail: 'register'})); process.exit(1); }
const note = 'Texturi fractale hiper-detaliate (fff-texturi): fundalul și suprafețele mari primesc un material generat local (WebGL2, fără rețea și fără imagini), care se repetă fără cusătură; se oprește din dialogul „Transparență” sau cu ?notex=1.';
const inj = ['tools/inject-shared.mjs', dir, slug]; if (nokit) inj.push('--nokit'); if (has('--release') && !nokit) inj.push('--release', note);
r = run('node', inj, {cwd: HUB}); res.steps.inject = (r.stdout + r.stderr).trim().slice(-400);
if (r.status) { console.log(JSON.stringify({...res, fail: 'inject'})); process.exit(1); }
r = run('node', ['tools/inject-shared.mjs', '--check', dir, slug], {cwd: HUB}); res.steps.check = (r.stdout + r.stderr).trim().slice(-300);
if (r.status) res.errors.push('inject-shared --check a eșuat');
res.bytes = fs.statSync(path.join(dir, 'index.html')).size;

// 2) capturi „după” + metrici
if (!has('--no-shots')) {
  for (const y of views) res.shots['after_' + y] = shot('after_' + y, ['--scroll', String(y), '--size', '768']);
  res.shots.dark = shot('after_dark', ['--dark', '--size', '768']);
  res.shots.mobile = shot('after_mobile', ['--w', '390', '--h', '800', '--size', '512']);
  for (const y of views) { const b = res.shots['before_' + y], a = res.shots['after_' + y]; if (b && a && fs.existsSync(b.png) && fs.existsSync(a.png)) { const c = run('python3', [path.join(QA, 'compare.py'), b.png, a.png]); try { res['diff_' + y] = JSON.parse(c.stdout); } catch { /* fără metrici */ } } }
  const a0 = res.shots.after_0 && res.shots.after_0.j; res.info = a0 && a0.info; res.marked = a0 && a0.marked;
  for (const [k, s] of Object.entries(res.shots)) { const j = s.j; if (!j) continue; for (const e of j.errors || []) if (!k.startsWith('before')) res.errors.push(`${k}: ${e}`); for (const c of j.csp || []) res.errors.push(`${k}: CSP ${c}`); }
  // erorile care existau deja înainte de texturi nu sunt ale noastre
  const pre = new Set(Object.entries(res.shots).filter(([k]) => k.startsWith('before')).flatMap(([, s]) => (s.j && s.j.errors) || []));
  res.errors = res.errors.filter((e) => ![...pre].some((p) => e.endsWith(p)));
  for (const s of Object.values(res.shots)) { delete s.j; }
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
