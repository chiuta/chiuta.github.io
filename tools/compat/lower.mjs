#!/usr/bin/env node
// tools/compat/lower.mjs — coboară sintaxa JS peste pragul din compat.config.json în scripturile inline ale aplicațiilor single-file HTML.
// Regiunea kit (<!--fff:kit:start…end-->) și blocul fff-info nu se ating; restul fișierului rămâne identic octet cu octet în afara nodurilor rescrise.
//   node tools/compat/lower.mjs [--root DIR] [--only A,B] [--skip A,B] [--write] [--json raport.json] [--verbose]
// Fără --write rulează „pe uscat” (raport). Cu --write recalculează și hash-urile CSP ale scripturilor inline.
// Cod de ieșire 1 dacă rămân construcții ce cer rescriere manuală sau scripturi care tot depășesc pragul.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {lowerHtml, ensureCompat} from './lower-lib.mjs';
import {findApps, CONFIG, auditHtml} from './audit.mjs';
import {recomputeCspHashes} from '../../fff-kit/lib/csp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const root = path.resolve(opt('--root', path.resolve(HERE, '..', '..', '..')));
const only = opt('--only') ? opt('--only').split(',') : null, skip = opt('--skip') ? opt('--skip').split(',') : null;
const write = flag('--write');

const report = {};
let touched = 0, problems = 0;
for (const a of findApps(root, only, skip)) {
  const html = fs.readFileSync(a.file, 'utf8');
  const r = lowerHtml(html, {floor: CONFIG.floor.ecma});
  const ex = CONFIG.exceptions[a.repo];
  if (ex && Array.isArray(ex.manual)) {      // note recunoscute ca rezolvate manual (cu motiv în compat.config.json)
    if (!ex.because) { console.error(`compat.config.json: excepția pentru ${a.repo} cere «because»`); process.exit(2); }
    r.report.acknowledged = r.report.manual.filter((m) => ex.manual.includes(m.kind));
    r.report.manual = r.report.manual.filter((m) => !ex.manual.includes(m.kind));
  }
  // pagini fără kit care ajung să folosească FFF.rx/FFF.imp sau API-uri acoperite doar de fff-compat (ResizeObserver, padStart…): primesc doar stratul fff-compat
  const ec = ensureCompat(r.html, {force: auditHtml(r.html).api.some((x) => x.covered)});
  r.html = ec.html; r.changed = r.changed || ec.injected;
  if (ec.injected) r.report.stats['compat-layer'] = 1;
  if (!r.changed && !r.report.manual.length && !r.report.floorErrors.length && !r.report.errors.length) continue;
  let out = r.html, csp = null;
  if (write && r.changed) {
    const c = recomputeCspHashes(out);
    out = c.html; csp = c.note;
    fs.writeFileSync(a.file, out);
  }
  if (r.changed) touched++;
  const bad = r.report.manual.length || r.report.floorErrors.length || r.report.errors.length;
  if (bad) problems++;
  report[a.id] = {file: a.rel, changed: r.changed, stats: r.report.stats, manual: r.report.manual, acknowledged: (r.report.acknowledged || []).length, floorErrors: r.report.floorErrors, errors: r.report.errors, csp};
  if (flag('--verbose') || bad) {
    const st = Object.entries(r.report.stats).map(([k, v]) => `${k}×${v}`).join(' ');
    console.log(`${bad ? '!' : '·'} ${a.id.padEnd(40)} ${st}`);
    for (const m of r.report.manual) console.log(`    manual linia ${m.line}: ${m.kind} — ${m.why}  «${m.text.slice(0, 70)}»`);
    for (const e of r.report.floorErrors) console.log(`    peste prag: ${e}`);
    for (const e of r.report.errors) console.log(`    parsare: ${e}`);
  }
}
console.log(`${write ? 'rescrise' : 'de rescris'}: ${touched} aplicații · cu probleme rămase: ${problems}`);
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 1) + '\n');
process.exit(problems ? 1 : 0);
