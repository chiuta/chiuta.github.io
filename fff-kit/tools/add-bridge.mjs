// node fff-kit/tools/add-bridge.mjs <dirAplicație> <slug> <versiuneNouă> "<notă changelog ro>"
// Aplică (idempotent) petecele mici din bridge-adapters/patches.json, apoi `build.mjs release --to <versiune> --add-modules bridge`
// (apply kit + ridicarea versiunii în toate locurile standard + fixcsp + info + check), inserează adaptorul aplicației
// (<script id="fff-bridge-adapter">: registru + adaptor propriu, dacă există + strat universal), recalculează CSP/app.json și scrie CHANGELOG.md.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const kit = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dir, slug, ver, note] = process.argv.slice(2);
if (!note) { console.error('utilizare: add-bridge.mjs <dir> <slug> <versiune> "<notă>"'); process.exit(2); }
const rd = (f) => fs.readFileSync(f, 'utf8');
const run = (...a) => { const r = spawnSync('node', [path.join(kit, 'build.mjs'), ...a], {encoding: 'utf8'}); if (r.status) { console.error(r.stdout + r.stderr); process.exit(1); } return r.stdout; };
const idx = path.join(dir, 'index.html'); let html = rd(idx);

// 1) petece (hook-uri de legătură în codul aplicației)
const patches = (JSON.parse(rd(path.join(kit, 'bridge-adapters/patches.json')))[slug]) || [];
for (const p of patches) {
  if (p.replace) {
    const {find, with: w} = p.replace;
    if (html.includes(w)) continue;
    const n = html.split(find).length - 1; if (n !== 1) throw new Error(`petec ${slug}: ancora apare de ${n} ori`);
    html = html.replace(find, () => w);
  } else if (p.afterBlockEnd) {
    const {marker, end, insert} = p.afterBlockEnd; if (html.includes(insert)) continue;
    const i = html.indexOf(marker); if (i < 0) throw new Error(`petec ${slug}: lipsește markerul`);
    const j = html.indexOf(end, i); if (j < 0) throw new Error(`petec ${slug}: lipsește sfârșitul blocului`);
    const k = j + end.length; html = html.slice(0, k) + '\n' + insert + html.slice(k);
  } else if (p.iifeEndAfter) {
    const {marker, insert} = p.iifeEndAfter; if (html.includes(insert)) continue;
    const i = html.indexOf(marker); if (i < 0) throw new Error(`petec ${slug}: lipsește markerul`);
    const j = html.indexOf('\n})();', i); if (j < 0) throw new Error(`petec ${slug}: lipsește sfârșitul IIFE`);
    html = html.slice(0, j + 1) + insert + '\n' + html.slice(j + 1);
  }
}
fs.writeFileSync(idx, html);

// 2) release: kit + modul bridge + versiune în toate locurile standard
const cur = JSON.parse(rd(path.join(dir, 'app.json'))).version;
const out = run('release', dir, ...(cur === ver ? ['--bump', 'none'] : ['--to', ver]), '--add-modules', 'bridge');
html = rd(idx).replace(/<script id="fff-bridge-adapter">[\s\S]*?<\/script>\n?/, '');
if (cur !== ver) { // locuri nestandard cu versiunea veche: const VERSION='…', <span class="ver">v…</span>
  const q = cur.replace(/\./g, '\\.');
  html = html.replace(new RegExp(`(\\b(?:VERSION|VER)\\s*[=:]\\s*['"])${q}(['"])`, 'g'), `$1${ver}$2`)
             .replace(/\b(UPDATED|UPD)(\s*=\s*['"])\d{4}-\d\d-\d\d(['"])/g, `$1$2${(html.match(/name="last-updated" content="(\d{4}-\d\d-\d\d)"/) || [])[1] || new Date().toISOString().slice(0, 10)}$3`)
             .replace(new RegExp(`(\\bv ?)${q}( · \\d{4}-\\d\\d-\\d\\d)`, 'g'), (m, a, b) => `${a}${ver}${b.replace(/\d{4}-\d\d-\d\d/, (html.match(/name="last-updated" content="(\d{4}-\d\d-\d\d)"/) || [])[1] || '')}`)
             .replace(new RegExp(`(\\b${(JSON.parse(rd(path.join(dir, 'app.json'))).name || slug).split(/[\s—·-]+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} v)${q}\\b`, 'gi'), `$1${ver}`)
             .replace(new RegExp(`(class="ver"[^>]*>v)${q}(<)`, 'g'), `$1${ver}$2`);
}

// 3) adaptor
const customPath = path.join(kit, `bridge-adapters/${slug}.js`), custom = fs.existsSync(customPath);
// registru filtrat per aplicație: ea însăși + aplicațiile care acceptă ce produce ea (fără adrese inutile în cod)
const regSrc = rd(path.join(kit, 'bridge-adapters/registry.js'));
const entries = [...regSrc.matchAll(/^\s*(\{"slug".*?\}),?\s*$/gm)].map((m) => JSON.parse(m[1]));
const meE = entries.find((e) => e.slug === slug) || {produces: []};
const keep = entries.filter((e) => e.slug === slug || (e.accepts || []).some((t) => (meE.produces || []).includes(t)));
const regOut = regSrc.replace(/var FFF_REG = \[[\s\S]*?\n\];/, 'var FFF_REG = [\n' + keep.map((e) => ' ' + JSON.stringify(e)).join(',\n') + '\n];');
const customSrc = fs.existsSync(path.join(kit, `bridge-adapters/${slug}.js`)) ? rd(path.join(kit, `bridge-adapters/${slug}.js`)) : '';
const regFinal = customSrc.includes('fffCslToMd') ? regOut : regOut.slice(0, regOut.indexOf('function fffCslToMd')).trimEnd(); // asistentul CSL doar unde e folosit
const adapter = '\n' + regFinal + '\n' + (custom ? rd(customPath) + '\n' : '') + rd(path.join(kit, 'bridge-adapters/auto.js')).replace('__FFF_CUSTOM__', String(custom)) + '\n';
if (/<\/script/i.test(adapter)) throw new Error('adaptor cu </script');
const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + `<script id="fff-bridge-adapter">${adapter}</script>\n` + html.slice(i);
fs.writeFileSync(idx, html);
run('fixcsp', dir); run('info', dir);

// 4) changelog
const cl = path.join(dir, 'CHANGELOG.md'), t = rd(cl), k = t.indexOf('\n## ');
if (!t.includes(`## ${ver} `)) fs.writeFileSync(cl, t.slice(0, k) + `\n## ${ver} — ${new Date().toISOString().slice(0, 10)}\n\n${note}\n` + t.slice(k));
console.log(slug, cur, '->', ver);
