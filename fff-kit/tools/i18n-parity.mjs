#!/usr/bin/env node
// fff-kit · tools/i18n-parity — chei lipsă între limbi în dicționarele unei aplicații.
//   node tools/i18n-parity.mjs --app <dir|index.html> [--used] [--json] [--max N]
//   --used  verifică și cheile data-i18n din HTML nedefinite într-o limbă
// Cod de ieșire 0 = paritate, 1 = lipsuri, 2 = utilizare greșită. Detalii despre formatele recunoscute: lib/i18n-parity.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeI18n, describeIssue} from '../lib/i18n-parity.mjs';

const args = process.argv.slice(2), opt = {};
const apps = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--app') apps.push(args[++i]);
  else if (a === '--max') opt.max = Number(args[++i]);
  else if (a.startsWith('--')) opt[a.slice(2)] = true;
  else apps.push(a);
}
if (!apps.length || !apps.every(Boolean)) { console.error('utilizare: node tools/i18n-parity.mjs --app <dir|index.html> [--used] [--json] [--max N]'); process.exit(2); }
let bad = 0;
const all = [];
for (const a of apps) {
  const p = path.resolve(a), f = fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  const html = fs.readFileSync(f, 'utf8');
  const r = analyzeI18n(html, {used: !!opt.used, includeKit: false});
  all.push({file: f, scanned: r.scanned, issues: r.issues});
  if (r.issues.length) bad++;
  if (!opt.json) {
    console.log(`${f}: ${r.scanned} dicționare analizate, ${r.issues.length} cu lipsuri`);
    for (const it of r.issues) console.log('  ' + describeIssue(it, opt.max || 4));
  }
}
if (opt.json) console.log(JSON.stringify(all, null, 1));
process.exit(bad ? 1 : 0);
