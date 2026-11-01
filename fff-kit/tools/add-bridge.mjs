// node fff-kit/tools/add-bridge.mjs <dirAplicație> <slug> <versiuneNouă> "<notă changelog ro>"
// Adaugă modulul FFF.bridge (prin build.mjs apply, păstrând modulele existente) + adaptorul aplicației
// (<script id="fff-bridge-adapter">), recalculează hash-urile CSP și app.json, ridică versiunea, scrie changelog.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const kit = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dir, slug, ver, note] = process.argv.slice(2);
if (!note) { console.error('utilizare: add-bridge.mjs <dir> <slug> <versiune> "<notă>"'); process.exit(2); }
const rd = (f) => fs.readFileSync(f, 'utf8'), run = (...a) => { const r = spawnSync('node', [path.join(kit, 'build.mjs'), ...a], {encoding: 'utf8'}); if (r.status) { console.error(r.stdout + r.stderr); process.exit(1); } return r.stdout; };
const idx = path.join(dir, 'index.html'); let html = rd(idx);
const mods = (/fff:kit:start v=\d+ modules=([a-z0-9,-]+?)-->/.exec(html) || [])[1]; if (!mods) throw new Error('kitul nu e aplicat');
const list = [...new Set([...mods.split(','), 'bridge'])];
const oldVer = JSON.parse(rd(path.join(dir, 'app.json'))).version;
run('apply', dir, '--slug', slug, '--modules', list.join(','));
html = rd(idx).replace(/<script id="fff-bridge-adapter">[\s\S]*?<\/script>\n?/, '');
const adapter = '\n' + rd(path.join(kit, 'bridge-adapters/registry.js')) + '\n' + rd(path.join(kit, `bridge-adapters/${slug}.js`)) + '\n';
if (/<\/script/i.test(adapter)) throw new Error('adaptor cu </script');
const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + `<script id="fff-bridge-adapter">${adapter}</script>\n` + html.slice(i);
// versiune (literal între ghilimele, ca în fișierele existente)
html = html.split(`"${oldVer}"`).join(`"${ver}"`).split(`'${oldVer}'`).join(`'${ver}'`);
fs.writeFileSync(idx, html);
for (const f of ['sw.js', 'manifest.webmanifest']) { const p = path.join(dir, f); if (fs.existsSync(p)) fs.writeFileSync(p, rd(p).split(`"${oldVer}"`).join(`"${ver}"`).split(`'${oldVer}'`).join(`'${ver}'`)); }
run('fixcsp', dir); run('info', dir);
const cl = path.join(dir, 'CHANGELOG.md'), t = rd(cl), k = t.indexOf('\n## ');
if (!t.includes(`## ${ver} `)) fs.writeFileSync(cl, t.slice(0, k) + `\n## ${ver} — ${new Date().toISOString().slice(0, 10)}\n\n${note}\n` + t.slice(k));
console.log(slug, oldVer, '->', ver, 'module:', list.join(','));
