#!/usr/bin/env node
// tools/compat/kit-sync.mjs — aduce la versiunea curentă a kitului variantele single-file distribuite separat (extraTargets din compat.config.json)
// al căror bloc kit e mai vechi decât `kitMinVersion` (sau nu are stratul fff-compat). Folosește comanda oficială `build.mjs apply` pe o copie
// temporară (index.html + fff.config.json), ca să nu atingă app.json / blocul fff-info al aplicației principale a depozitului.
//   node tools/compat/kit-sync.mjs [--root DIR] [--only A,B] [--write] [--force]
// --force: reaplică kitul chiar dacă versiunea e la zi (când sursele kitului s-au schimbat fără ridicarea versiunii; `apply` e idempotent).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {findApps, auditHtml, CONFIG} from './audit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '..', '..', 'fff-kit', 'build.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const root = path.resolve(opt('--root', path.resolve(HERE, '..', '..', '..')));
const only = opt('--only') ? opt('--only').split(',') : null;
const write = argv.includes('--write');
const force = argv.includes('--force');
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

let n = 0, bad = 0;
for (const a of findApps(root, only, null).filter((x) => x.extra)) {
  const html = fs.readFileSync(a.file, 'utf8');
  const r = auditHtml(html);
  if (!r.kit) continue;                                         // fără kit: nimic de sincronizat
  if (!force && r.hasCompat && cmp(r.kit, CONFIG.kitMinVersion) >= 0) continue;
  n++;
  const slug = (html.match(/<meta name="fff-app" content="([^"]+)"/) || [])[1];
  const mods = (html.match(/<!--fff:kit:start[^>]*\bmodules=([a-z0-9,-]+?)-->/) || [])[1];
  console.log(`${write ? '→' : '·'} ${a.id.padEnd(46)} kit ${r.kit} → ${CONFIG.kitMinVersion}+   slug=${slug} module=${mods}`);
  if (!write) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kitsync-'));
  try {
    fs.writeFileSync(path.join(tmp, 'index.html'), html);
    const cfg = path.join(a.dir, 'fff.config.json');
    if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(tmp, 'fff.config.json'));
    const res = spawnSync(process.execPath, [KIT, 'apply', tmp, '--slug', slug, '--modules', mods], {encoding: 'utf8'});
    if (res.status !== 0) { bad++; console.log('    EȘEC: ' + (res.stderr || res.stdout).trim().split('\n').pop()); continue; }
    const out = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    if (out !== html) fs.writeFileSync(a.file, out);
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
console.log(`${write ? 'sincronizate' : 'de sincronizat'}: ${n}${bad ? ' · eșecuri: ' + bad : ''}`);
process.exit(bad ? 1 : 0);
