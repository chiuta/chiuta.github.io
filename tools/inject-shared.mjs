#!/usr/bin/env node
// Injectează (idempotent) codul comun FFF din tools/ într-o aplicație single-file: plicul (.fff.json), seiful comun de chei și adaptorul aplicației.
//   node tools/inject-shared.mjs <dirAplicație> <slug> [--release "<notă changelog>"] [--date YYYY-MM-DD]
//   node tools/inject-shared.mjs --check <dirAplicație> <slug>      (nu scrie: verifică că copiile din aplicație sunt identice cu sursa din tools/)
// Surse: tools/fff-envelope.js, tools/fff-seif.js, module comune listate în plan.json la „libs” (ex. tools/fff-agenda.js → <script id="fff-mod-agenda">), tools/envelope-adapters/<Slug>.js (+ registry.extra.json, patches.json).
// Biblioteci după <!--fff:kit:end-->; adaptorul înainte de </body>. Apoi (doar la scriere) build.mjs release/fixcsp/info.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = (f) => path.join(HUB, 'tools', f), AD = (f) => path.join(HUB, 'tools/envelope-adapters', f);
const rd = (f) => fs.readFileSync(f, 'utf8');
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };
const pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--release' && argv[i - 1] !== '--date');
const [dir, slug] = pos;
if (!dir || !slug) { console.error('utilizare: inject-shared.mjs [--check] <dir> <slug> [--release "<notă>"] [--date YYYY-MM-DD]'); process.exit(2); }
const CHECK = has('--check'), NOKIT = has('--nokit');   // --nokit: aplicații fără fff-kit (ex. MENSURA): bibliotecile se pun înainte de </body>; fără release/fixcsp/info/changelog

// ce primește fiecare aplicație: bibliotecile și fișierul de adaptor (după slug-ul din app.json)
const PLAN = JSON.parse(rd(AD('plan.json')));
const plan = PLAN[slug]; if (!plan) { console.error(`slug necunoscut în tools/envelope-adapters/plan.json: ${slug}`); process.exit(2); }

function registryFor() {
  const src = rd(path.join(HUB, 'fff-kit/bridge-adapters/registry.js'));
  const base = [...src.matchAll(/^\s*(\{"slug".*?\}),?\s*$/gm)].map((m) => JSON.parse(m[1]));
  const extra = JSON.parse(rd(AD('registry.extra.json')));
  const by = new Map(base.map((e) => [e.slug, e])); for (const e of extra) by.set(e.slug, e);
  const all = [...by.values()], me = by.get(slug) || {produces: []};
  return all.filter((e) => e.slug === slug || (e.accepts || []).some((t) => (me.produces || []).includes(t)));
}
function adapterSource() {
  const reg = plan.adapter ? registryFor() : [];
  let s = '(function(){if(!(window.FFF&&window.FFF.envelope))return;window.FFF.envelope.registry=' + JSON.stringify(reg) + ';})();\n';
  if (plan.adapter) for (const a of [].concat(plan.adapter)) s += rd(AD(a)).trimEnd() + '\n';   // un adaptor sau o listă (ex. Cadraj: plicul + motorul A/B)
  if (/<\/script/i.test(s)) throw new Error('adaptor cu </script');
  return s;
}
const blocks = () => {
  const o = plan.libsOnly ? [] : [{id: 'fff-envelope', src: rd(T('fff-envelope.js')), lib: true}];   // libsOnly: aplicații care primesc doar module comune (ex. nucleul AI), fără plic
  if (plan.seif) o.push({id: 'fff-seif', src: rd(T('fff-seif.js')), lib: true});
  for (const m of plan.libs || []) { if (!/^fff-[a-z0-9-]+$/.test(m)) throw new Error('modul necunoscut: ' + m); o.push({id: 'fff-mod-' + m.slice(4), src: rd(T(m + '.js')), lib: true}); }   // module comune (Etapa 5): tools/<m>.js → <script id="fff-mod-…">
  if (plan.adapter) o.push({id: 'fff-envelope-adapter', src: adapterSource(), lib: false});
  for (const b of o) if (/<\/script/i.test(b.src)) throw new Error(b.id + ' conține </script');
  return o;
};
const idx = path.join(dir, 'index.html'), RE = (id) => new RegExp(`<script id="${id}">([\\s\\S]*?)</script>\\n?`);
let html = rd(idx);

if (CHECK) {
  let bad = 0;
  for (const b of blocks()) {
    const m = html.match(RE(b.id));
    if (!m) { console.log(`LIPSEȘTE ${b.id} în ${slug}`); bad++; } else if (m[1].replace(/^\n/, '') !== b.src && m[1] !== b.src) { console.log(`DIFERĂ ${b.id} în ${slug} (rulează inject-shared.mjs)`); bad++; }
  }
  for (const p of (JSON.parse(rd(AD('patches.json')))[slug] || [])) if (!html.includes(p.with)) { console.log(`PETIC lipsă în ${slug}: ${p.name || p.with.slice(0, 40)}`); bad++; }
  console.log(bad ? `${slug}: ${bad} probleme` : `${slug}: ok`); process.exit(bad ? 1 : 0);
}

// 1) petece mici în codul aplicației (ex. un apel FFFSeif.mount în interiorul unui IIFE)
for (const p of (JSON.parse(rd(AD('patches.json')))[slug] || [])) {
  if (html.includes(p.with)) continue;
  const n = html.split(p.find).length - 1; if (n !== 1) throw new Error(`petec ${slug}: ancora apare de ${n} ori (${p.name || p.find.slice(0, 40)})`);
  html = html.replace(p.find, () => p.with);
}
fs.writeFileSync(idx, html);

// 2) release (versiune + kit + README + fixcsp + info), dacă s-a cerut notă
const run = (...a) => { const r = spawnSync('node', [path.join(HUB, 'fff-kit/build.mjs'), ...a], {encoding: 'utf8'}); if (r.status) { console.error(r.stdout + r.stderr); process.exit(1); } return r.stdout; };
const note = val('--release'), date = val('--date') || new Date().toISOString().slice(0, 10);
if (note) run('release', dir, '--bump', 'patch', '--date', date, '--lax', '--no-tests');

// 3) biblioteci + adaptor
html = rd(idx);
for (const id of ['fff-envelope', 'fff-seif', 'fff-envelope-adapter']) html = html.replace(RE(id), '');
html = html.replace(/<script id="fff-mod-[a-z0-9-]+">[\s\S]*?<\/script>\n?/g, '');   // modulele comune se re-injectează mai jos, în ordinea din plan
const bl = blocks(), mk = '<!--fff:kit:end-->';
const libs = bl.filter((b) => b.lib).map((b) => `<script id="${b.id}">${b.src}</script>\n`).join('');
const ad = bl.filter((b) => !b.lib).map((b) => `<script id="${b.id}">${b.src}</script>\n`).join('');
if (NOKIT) { const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + libs + ad + html.slice(i); fs.writeFileSync(idx, html); console.log(slug, 'ok (fără kit)'); process.exit(0); }
if (libs) { const i = html.indexOf(mk); if (i < 0) throw new Error('lipsește <!--fff:kit:end-->'); const k = i + mk.length; html = html.slice(0, k) + '\n' + libs.trimEnd() + html.slice(k); }
if (ad) { const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + ad + html.slice(i); }
fs.writeFileSync(idx, html);
run('fixcsp', dir); run('info', dir);

// 4) changelog
if (note) {
  const cl = path.join(dir, 'CHANGELOG.md'), t = rd(cl), ver = JSON.parse(rd(path.join(dir, 'app.json'))).version, k = t.indexOf('\n## ');
  if (!t.includes(`## ${ver} `)) fs.writeFileSync(cl, t.slice(0, k) + `\n## ${ver} — ${date}\n\n${note}\n` + t.slice(k));
}
console.log(slug, 'ok', JSON.parse(rd(path.join(dir, 'app.json'))).version);
