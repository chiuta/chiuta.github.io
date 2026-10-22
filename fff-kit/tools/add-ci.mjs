#!/usr/bin/env node
// fff-kit · tools/add-ci — scrie workflow-ul GitHub Actions în depozitele de aplicații (FĂRĂ git: doar fișiere).
//   node tools/add-ci.mjs <rădăcină|depozit>... [--dry-run] [--force] [--lax] [--kit-ref REF] [--app-dir D] [--hub <cale-hub>] [--json]
//   <rădăcină>  director cu depozite (fiecare cu index.html; hubul: apps/*); un depozit dat direct primește workflow-ul lui
//   --hub H     instalează și workflow-ul REUTILIZABIL în hub: H/.github/workflows/fff-check.yml (sursa: ci/fff-check.yml)
//   --lax       caller cu `lax: true` (tranziție: regulile noi sunt avertismente)
//   --kit-ref   fixează `kit-ref` în caller (ex. fff-kit-1.2.0) pentru rulări reproductibile
//   --force     suprascrie un fff-check.yml existent (altfel este omis)
// Fiecare depozit primește .github/workflows/fff-check.yml = ci/caller.yml (cu parametrii de mai sus). Raportează JSON cu --json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverApps} from '../lib/release.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (['--kit-ref', '--app-dir', '--hub'].includes(a)) opt[a.slice(2)] = args[++i];
  else if (a.startsWith('--')) opt[a.slice(2)] = true;
  else pos.push(a);
}
if (!pos.length && !opt.hub) { console.error('utilizare: node tools/add-ci.mjs <rădăcină|depozit>... [--dry-run] [--force] [--lax] [--kit-ref REF] [--app-dir D] [--hub <cale-hub>] [--json]'); process.exit(2); }

export function renderCaller(o = {}) {
  let t = fs.readFileSync(path.join(KIT, 'ci', 'caller.yml'), 'utf8');
  if (o.lax) t = t.replace('lax: false                #', 'lax: true                 #');
  if (o['kit-ref']) t = t.replace("# kit-ref: 'main'         #", `kit-ref: '${o['kit-ref']}'  #`);
  if (o['app-dir']) t = t.replace("# app-dir: '.'            #", `app-dir: '${o['app-dir']}'  #`);
  return t;
}
const rows = [];
function put(file, text, label) {
  const exists = fs.existsSync(file), same = exists && fs.readFileSync(file, 'utf8') === text;
  let status;
  if (same) status = 'unchanged';
  else if (exists && !opt.force) status = 'exists (folosește --force)';
  else { status = exists ? 'overwritten' : 'created'; if (!opt['dry-run']) { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text); } }
  rows.push({target: label, file, status: opt['dry-run'] && /^(created|overwritten)$/.test(status) ? 'would-be-' + status : status});
}
if (opt.hub) put(path.join(path.resolve(opt.hub), '.github', 'workflows', 'fff-check.yml'), fs.readFileSync(path.join(KIT, 'ci', 'fff-check.yml'), 'utf8'), 'hub (workflow reutilizabil)');
const caller = renderCaller(opt);
for (const p of pos) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) { rows.push({target: p, status: 'lipsește'}); continue; }
  const direct = fs.existsSync(path.join(abs, 'index.html')) && fs.existsSync(path.join(abs, '.git')) || (fs.existsSync(path.join(abs, 'index.html')) && !fs.existsSync(path.join(abs, 'apps')));
  const dirs = direct ? [abs] : discoverApps(abs);
  for (const d of dirs) {
    // aplicațiile din hub (apps/<nume>) nu sunt depozite separate: workflow-ul lor ar fi inutil → omise
    if (path.basename(path.dirname(d)) === 'apps' && !fs.existsSync(path.join(d, '.git'))) { rows.push({target: d, status: 'omis (aplicație din hub, fără depozit propriu)'}); continue; }
    put(path.join(d, '.github', 'workflows', 'fff-check.yml'), caller, path.basename(d));
  }
}
const summary = rows.reduce((o, r) => { const k = r.status.replace(/^would-be-/, ''); o[k.split(' ')[0]] = (o[k.split(' ')[0]] || 0) + 1; return o; }, {});
if (opt.json) console.log(JSON.stringify({dryRun: !!opt['dry-run'], summary, rows}, null, 1));
else { rows.forEach((r) => console.log(`${r.status.padEnd(34)} ${r.target}`)); console.log(JSON.stringify({dryRun: !!opt['dry-run'], ...summary})); }
