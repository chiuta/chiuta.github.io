#!/usr/bin/env node
// fff-kit · tools/portable-tests — face testele unei aplicații (tests/*.mjs) portabile (CI, alt calculator). NU rulează git.
//   node tools/portable-tests.mjs <aplicație>... [--write] [--root <rădăcină>] [--no-versions] [--json]
//   fără --write: doar arată diff-ul (uscat); cu --write rescrie fișierele (idempotent).
//
// Transformări:
//  1. Chromium:  executablePath: '/opt/pw-browsers/…'            → executablePath: process.env.CHROMIUM_PATH || undefined   (Playwright alege singur browserul)
//                process.env.CHROME || '/opt/pw-browsers/…'      → process.env.CHROMIUM_PATH || process.env.CHROME || undefined
//  2. Playwright: createRequire('/opt/node-tools/package.json')  → createRequire(process.env.PW_ROOT || import.meta.url)
//                 (caută `playwright` în node_modules ale aplicației / NODE_PATH; PW_ROOT=/cale/package.json rămâne suprascrierea).
//  3. axe-core:   literali '/…/axe.min.js'                       → __fffAxe(): FFF_AXE / AXE_PATH, apoi `axe-core` instalat (npm i -D axe-core).
//                 Rezervă documentată: dacă nu se găsește, __fffAxe() întoarce undefined (testele care cer axe pică cu un mesaj clar).
//  4. Versiuni/date hard-codate → citite din app.json (tests/ → ../app.json): versiunea aplicației (șiruri, șabloane, regex), data `updated`
//     (doar pe linii despre versiune/dată) și versiunea kitului (pe linii despre kit, din app.json → kit.version).
//     Literalii în regex devin new RegExp(String.raw`…`); șirurile cu text în jur devin șabloane. Cazurile neacoperite se raportează la „manual”.
//  5. Raportează căi absolute rămase (/opt/…, /home/…, /tmp/claude…) fără să le schimbe.
// Insertul de ajutor este marcat «[fff-portable]» (a doua rulare nu mai găsește nimic de schimbat).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {maskJs} from '../lib/jsscan.mjs';
import {discoverApps} from '../lib/release.mjs';

const MARK = '[fff-portable]';
const KIT_LINE = /fff-kit|kit\.version|KIT_VERSION|kitVersion|FFF\.version|core\.version|\.kit\b/i;
const DATE_LINE = /updated|last-updated|Ultima|Last updated|date|data\b/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HELPER_AXE = `// ${MARK} axe-core: FFF_AXE / AXE_PATH, apoi pachetul \`axe-core\` (npm i -D axe-core). Dacă lipsește: undefined (testele cu axe pică cu mesaj clar).
import {createRequire as __fffCR} from 'node:module';
const __fffAxe = () => { try { return __fffCR(import.meta.url).resolve('axe-core/axe.min.js'); } catch { return undefined; } };
`;
const HELPER_APP = `// ${MARK} versiunea/data/kitul aplicației se citesc din app.json (nu mai sunt hard-codate în teste)
import {readFileSync as __fffRF} from 'node:fs';
const __FFF_APP = JSON.parse(__fffRF(new URL('../app.json', import.meta.url), 'utf8'));
const __fffRe = (s) => String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
`;

/** Poziția unde se inserează ajutoarele: după shebang și blocul de comentarii de la început. */
function insertAt(code) {
  const lines = code.split('\n');
  let i = 0;
  if (lines[0] && lines[0].startsWith('#!')) i++;
  while (i < lines.length && (/^\s*\/\//.test(lines[i]) || /^\s*$/.test(lines[i]))) i++;
  return lines.slice(0, i).join('\n').length + (i ? 1 : 0);
}

/** Rulează transformările pe un text. ctx: {version, updated, kitVersion, esm}. Întoarce {code, changes, manual}. */
export function portableTransform(code, ctx = {}) {
  const changes = [], manual = [];
  const lineOf = (s, idx) => { let l = 1; for (let k = 0; k < idx; k++) if (s.charCodeAt(k) === 10) l++; return l; };
  let out = code;
  const sub = (kind, re, fn) => { out = out.replace(re, (...m) => { const idx = m[m.length - 2]; const r = fn(...m); if (r !== m[0]) changes.push({kind, line: lineOf(out, idx), before: m[0].slice(0, 90), after: String(r).slice(0, 90)}); return r; }); };

  /* 1. Chromium */
  sub('chromium', /(executablePath\s*:\s*)process\.env\.(\w+)\s*\|\|\s*(['"])\/opt\/pw-browsers\/[^'"]*\3/g, (m, a, env) => `${a}process.env.CHROMIUM_PATH || ${env === 'CHROMIUM_PATH' ? '' : `process.env.${env} || `}undefined`);
  sub('chromium', /(executablePath\s*:\s*)(['"])\/opt\/pw-browsers\/[^'"]*\2/g, (m, a) => `${a}process.env.CHROMIUM_PATH || undefined`);
  sub('chromium', /(['"])\/opt\/pw-browsers\/[^'"]*\1/g, () => '(process.env.CHROMIUM_PATH || undefined)');
  sub('chromium', /(executablePath\s*:\s*)process\.env\.CHROMIUM_PATH(?=\s*[,}])/g, (m, a) => `${a}process.env.CHROMIUM_PATH || undefined`);

  /* 2. Playwright */
  if (ctx.esm !== false) sub('playwright', /createRequire\(\s*(?:process\.env\.PW_ROOT\s*\|\|\s*)?(['"])(?:\/opt\/node-tools|\/home\/claude\/pw)\/package\.json\1\s*\)/g, () => 'createRequire(process.env.PW_ROOT || import.meta.url)');

  /* 3. axe */
  let needAxe = false;
  sub('axe', /(['"])\/[^'"\n]*axe(?:\.min)?\.js\1/g, () => { needAxe = true; return '__fffAxe()'; });

  /* 4. versiuni/date din app.json */
  let needApp = false;
  if (ctx.version || ctx.updated || ctx.kitVersion) {
    const masked = maskJs(out);
    const reps = [];   // {start, end, text}
    const lineStarts = [0]; for (let i = 0; i < out.length; i++) if (out.charCodeAt(i) === 10) lineStarts.push(i + 1);
    const lineText = (idx) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; } const e = out.indexOf('\n', lineStarts[lo]); return {n: lo + 1, t: out.slice(lineStarts[lo], e < 0 ? out.length : e)}; };
    const delim = (v) => new RegExp(`(?<![\\d.A-UW-Za-uw-z_])${esc(v)}(?![\\w]|\\.\\d)`, 'g');
    const delimEsc = (v) => new RegExp(`(?<![\\d.A-UW-Za-uw-z_])${esc(v.replace(/\./g, '\\.'))}(?![\\w]|\\\\\\.\\d)`, 'g');
    const runRe = /\x01+/g; let m;
    while ((m = runRe.exec(masked))) {
      const s = m.index, e = s + m[0].length, left = masked[s - 1], right = masked[e];
      const body = out.slice(s, e), ln = lineText(s);
      let kind = null;
      if ((left === '"' || left === "'") && right === left) kind = 'str';
      else if (left === '/' && right === '/') kind = 're';
      else if ((left === '`' || left === '}') && (right === '`' || right === '$')) kind = 'tpl';
      if (!kind) continue;
      const isKitLine = KIT_LINE.test(ln.t);
      // ce se înlocuiește aici
      const items = [];
      if (ctx.version && !isKitLine) items.push(['version', ctx.version, 'version']);
      if (ctx.updated && !isKitLine && (DATE_LINE.test(ln.t) || (ctx.version && (delim(ctx.version).test(body) || delimEsc(ctx.version).test(body))))) items.push(['updated', ctx.updated, 'updated']);
      if (ctx.kitVersion && isKitLine) items.push(['kit', ctx.kitVersion, 'kit.version']);
      const expr = (key) => (key === 'kit' ? '__FFF_APP.kit.version' : `__FFF_APP.${key}`);
      let hit = false;
      if (kind === 'str') {
        // literal întreg = valoarea
        for (const [key, val] of items) if (body === val) { reps.push({s: s - 1, e: e + 1, text: expr(key)}); hit = true; break; }
        if (!hit) {
          let b = body, any = false;
          for (const [key, val] of items) { const d = delim(val); if (d.test(b)) { any = true; d.lastIndex = 0; b = b.replace(d, '\u0000' + key + '\u0000'); } }
          if (any) {
            if (/[\\`]|\$\{/.test(b)) manual.push({line: ln.n, why: 'literal cu escape-uri/backtick: înlocuiește manual cu __FFF_APP', text: ln.t.trim().slice(0, 100)});
            else { const tpl = '`' + b.replace(/\u0000(\w+)\u0000/g, (_, k) => '${' + expr(k) + '}') + '`'; reps.push({s: s - 1, e: e + 1, text: tpl}); hit = true; }
          }
        }
      } else if (kind === 'tpl') {
        let b = body, any = false;
        for (const [key, val] of items) { const d = delim(val); if (d.test(b)) { any = true; d.lastIndex = 0; b = b.replace(d, '${' + expr(key) + '}'); } }
        if (any) { reps.push({s, e, text: b}); hit = true; }
      } else if (kind === 're') {
        // regex literal: reconstruiește întregul literal /…/flags
        let fe = e + 1; while (fe < out.length && /[a-z]/i.test(out[fe])) fe++;
        const flags = out.slice(e + 1, fe);
        let b = body, any = false;
        for (const [key, val] of items) {
          const de = delimEsc(val), dr = delim(val);
          if (de.test(b)) { any = true; de.lastIndex = 0; b = b.replace(de, '\u0000' + key + '\u0000'); }
          else if (dr.test(b)) { any = true; dr.lastIndex = 0; b = b.replace(dr, '\u0000' + key + '\u0000'); }
        }
        if (any) {
          if (/[`]|\$\{/.test(b)) manual.push({line: ln.n, why: 'regex cu backtick/${…}: înlocuiește manual', text: ln.t.trim().slice(0, 100)});
          else { reps.push({s: s - 1, e: fe, text: 'new RegExp(String.raw`' + b.replace(/\u0000(\w+)\u0000/g, (_, k) => '${__fffRe(' + expr(k) + ')}') + '`' + (flags ? `, '${flags}'` : '') + ')'}); hit = true; }
        }
      }
      if (hit) needApp = true;
    }
    reps.sort((a, b) => b.s - a.s);
    for (const r of reps) {
      changes.push({kind: 'app.json', line: lineText(r.s).n, before: out.slice(r.s, r.e).slice(0, 90), after: r.text.slice(0, 90)});
      out = out.slice(0, r.s) + r.text + out.slice(r.e);
    }
    changes.sort((a, b) => a.line - b.line);
  }

  /* ajutoare */
  const ins = [];
  if (needAxe && !out.includes(`${MARK} axe-core`)) ins.push(HELPER_AXE);
  if (needApp && !out.includes(`${MARK} versiunea/data`)) ins.push(HELPER_APP);
  if (ins.length) { const at = insertAt(out); out = out.slice(0, at) + ins.join('') + out.slice(at); }

  const rest = [];
  out.split('\n').forEach((l, i) => { if (/^\s*\/\//.test(l)) return; for (const m of l.matchAll(/['"`](\/(?:opt|home|root)\/[^'"`\s]+|\/tmp\/claude[^'"`\s]*)['"`]/g)) rest.push({line: i + 1, path: m[1]}); });
  return {code: out, changes, manual, remaining: rest};
}

function unifiedDiff(a, b, label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fffdiff-'));
  fs.writeFileSync(path.join(d, 'a'), a); fs.writeFileSync(path.join(d, 'b'), b);
  const r = spawnSync('diff', ['-u', '--label', 'a/' + label, '--label', 'b/' + label, path.join(d, 'a'), path.join(d, 'b')], {encoding: 'utf8'});
  fs.rmSync(d, {recursive: true, force: true});
  return r.stdout || '';
}

export function portableApp(dir, o = {}) {
  const rep = {dir: path.resolve(dir), files: [], changed: 0, appJson: false};
  const appJson = path.join(rep.dir, 'app.json');
  let info = null;
  if (fs.existsSync(appJson)) { try { info = JSON.parse(fs.readFileSync(appJson, 'utf8')); rep.appJson = true; } catch { /* invalid */ } }
  const ctx = o.versions === false || !info ? {} : {version: info.version, updated: info.updated, kitVersion: info.kit && info.kit.version};
  if (o.versions !== false && !info) rep.note = 'fără app.json valid: versiunile nu se transformă (rulează build.mjs info)';
  const td = path.join(rep.dir, 'tests');
  if (!fs.existsSync(td)) { rep.note = (rep.note ? rep.note + '; ' : '') + 'fără director tests/'; return rep; }
  for (const f of fs.readdirSync(td).filter((x) => /\.mjs$/.test(x)).sort()) {
    const p = path.join(td, f), src = fs.readFileSync(p, 'utf8');
    const r = portableTransform(src, ctx);
    const changed = r.code !== src;
    const entry = {file: 'tests/' + f, changed, changes: r.changes.length, kinds: [...new Set(r.changes.map((c) => c.kind))], manual: r.manual, remaining: r.remaining};
    if (changed) { entry.diff = unifiedDiff(src, r.code, 'tests/' + f); rep.changed++; if (o.write) fs.writeFileSync(p, r.code); }
    rep.files.push(entry);
  }
  return rep;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = {versions: true}, pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--root') opt.root = args[++i];
    else if (a === '--write') opt.write = true;
    else if (a === '--no-versions') opt.versions = false;
    else if (a === '--json') opt.json = true;
    else if (a === '--quiet') opt.quiet = true;
    else pos.push(a);
  }
  const dirs = [...pos, ...(opt.root ? discoverApps(opt.root) : [])];
  if (!dirs.length) { console.error('utilizare: node tools/portable-tests.mjs <aplicație>... [--write] [--root <rădăcină>] [--no-versions] [--json] [--quiet]'); process.exit(2); }
  const all = dirs.map((d) => portableApp(d, opt));
  if (opt.json) console.log(JSON.stringify(all.map((r) => ({...r, files: r.files.map((f) => ({...f, diff: undefined}))})), null, 1));
  else {
    for (const r of all) {
      console.log(`# ${r.dir}${r.note ? ' — ' + r.note : ''}: ${r.changed} fișiere ${opt.write ? 'rescrise' : 'de rescris'} din ${r.files.length}`);
      for (const f of r.files) {
        if (f.diff && !opt.quiet) console.log(f.diff.replace(/\n$/, ''));
        for (const m of f.manual) console.log(`  MANUAL ${f.file}:${m.line} — ${m.why}: ${m.text}`);
        if (f.remaining.length) console.log(`  AVERT. ${f.file}: căi absolute rămase: ${f.remaining.slice(0, 4).map((x) => x.path + '@' + x.line).join(', ')}${f.remaining.length > 4 ? '…' : ''}`);
      }
    }
    console.log(`${opt.write ? 'rescrise' : 'de rescris (dry-run; --write pentru a aplica)'}: ${all.reduce((n, r) => n + r.changed, 0)} fișiere în ${all.length} aplicații`);
  }
}
