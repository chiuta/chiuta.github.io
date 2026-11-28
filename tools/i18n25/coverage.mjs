#!/usr/bin/env node
// coverage — acoperirea celor 27 de limbi (data/limbi.json) pe fiecare depozit public, fără dependențe externe.
//
//   node tools/i18n25/coverage.mjs --root DIR [--json OUT.json] [--md OUT.md] [--lang uk] [--missing]
//
//   --root DIR   directorul care conține depozitele <Nume>/ (clone ale celor publice)
//   --json F     scrie rezultatul complet (pe aplicație și pe fațetă) în F
//   --md F       scrie un tabel Markdown (aplicație × fațetă × limbă) în F
//   --lang xx    afișează doar limba xx
//   --missing    listează aplicațiile cărora le lipsește cel puțin o limbă
//
// Fațete măsurate (doar fapte din depozit, fără estimări ascunse):
//   ui      limbile din app.json → features.i18n (sursa pe care o folosește și hub-ul pentru filtrul „Limba aplicației”)
//   readme  fișierele README.md (en) și README.<cod>.md existente și nescurte (≥ 400 de octeți)
//   page    limbile detectate în docs/index.html (pagina de prezentare a depozitului), euristic: atribute lang/data-lang/hreflang și chei "xx":{
// O fațetă fără sursă în depozit (ex. un program Rust nu are app.json, un depozit nu are docs/index.html) apare ca „n/a”, nu ca „0”.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = path.resolve(arg('--root') || path.join(HUB, '..'));
const ONLY = arg('--lang');
const reg = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'limbi.json'), 'utf8'));
const ORDER = reg.order.filter((l) => !ONLY || l === ONLY);

const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const MIN_README = 400;

function uiLangs(dir) {
  const p = path.join(dir, 'app.json');
  if (!exists(p)) return null;
  try { const l = JSON.parse(read(p))?.features?.i18n; return Array.isArray(l) ? l : null; } catch { return null; }
}
function readmeLangs(dir) {
  const out = [];
  for (const l of reg.order) {
    const f = path.join(dir, l === 'en' ? 'README.md' : `README.${l}.md`);
    if (exists(f) && fs.statSync(f).size >= MIN_README) out.push(l);
  }
  return out;
}
function pageLangs(dir) {
  const f = path.join(dir, 'docs', 'index.html');
  if (!exists(f)) return null;
  const s = read(f);
  return reg.order.filter((l) => new RegExp(`(?:\\blang|data-lang|hreflang)\\s*=\\s*["']${l}["']|["']${l}["']\\s*:\\s*[{\\[]`).test(s));
}

const apps = fs.readdirSync(ROOT).filter((d) => exists(path.join(ROOT, d, '.git')) || exists(path.join(ROOT, d, 'README.md'))).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
const rows = apps.map((name) => {
  const dir = path.join(ROOT, name);
  return {name, ui: uiLangs(dir), readme: readmeLangs(dir), page: pageLangs(dir)};
});

const facets = ['ui', 'readme', 'page'];
const total = {};
for (const f of facets) {
  total[f] = {apps: 0, have: Object.fromEntries(ORDER.map((l) => [l, 0]))};
  for (const r of rows) if (r[f]) { total[f].apps++; for (const l of ORDER) if (r[f].includes(l)) total[f].have[l]++; }
}
const result = {registry: reg.order.length, root: ROOT, apps: rows, total};

if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(result, null, 1));
if (arg('--md')) {
  const hd = '| Depozit | ' + facets.join(' | ') + ' |\n|---|' + facets.map(() => '---|').join('') + '\n';
  const cell = (x) => x == null ? 'n/a' : `${x.filter((l) => reg.order.includes(l)).length}/${reg.order.length}`;
  fs.writeFileSync(arg('--md'), hd + rows.map((r) => `| ${r.name} | ${facets.map((f) => cell(r[f])).join(' | ')} |`).join('\n') + '\n');
}

console.log(`rădăcină: ${ROOT}\nlimbi în registru: ${reg.order.length} · depozite: ${rows.length}\n`);
for (const f of facets) {
  const t = total[f];
  const full = rows.filter((r) => r[f] && reg.order.every((l) => r[f].includes(l))).length;
  const miss = ORDER.map((l) => `${l}:${t.have[l]}`).join(' ');
  console.log(`${f.padEnd(7)} depozite cu sursă: ${String(t.apps).padStart(3)} · complete în toate limbile: ${String(full).padStart(3)}\n        ${miss}`);
}
if (argv.includes('--missing')) {
  console.log('\nDepozite cu limbi lipsă (ui):');
  for (const r of rows) if (r.ui) { const m = reg.order.filter((l) => !r.ui.includes(l)); if (m.length) console.log(`  ${r.name}: lipsesc ${m.length}`); }
}
