#!/usr/bin/env node
/* tools/refresh/gate.mjs — porțile dinaintea comiterii (Etapa 8.3). Rulează pe arborele curent, fără să-l modifice (lucrează pe copii/worktree).
 *
 *   node tools/refresh/gate.mjs [--base REF] [--apps-root DIR] [--tests] [--json]
 *
 *   1. schemă: data/sources.json, instantaneele data/refresh/*.json (count, hash, structură), data/source-health.json
 *   2. sync-catalog --check: NU trebuie să apară probleme noi față de REF (în Actions aplicațiile nu sunt clonate, deci și REF are „probleme”;
 *      contează diferența, nu totalul). --apps-root îl îndreaptă spre clonele locale.
 *   3. fixcsp: hash-urile CSP din index.html trebuie să fie deja la zi (fixcsp pe o copie nu schimbă nimic)
 *   4. transparenta --check: transparenta.html corespunde datelor; meta --check: dataSources/#source-health/a8 la zi
 *   5. (--tests) tests/hub.test.mjs: niciun test care trecea pe REF nu trebuie să cadă
 * Cod de ieșire 1 dacă vreo poartă pică.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';
import {HUB, P, loadSources, validateSources, readJson, sha256, stable} from './lib.mjs';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const BASE = val('--base', 'origin/main'), APPS = val('--apps-root', null), TESTS = argv.includes('--tests');
const results = [];
const gate = (name, ok, detail) => { results.push({name, ok, detail}); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const sh = (cmd, args, cwd = HUB, env = {}) => spawnSync(cmd, args, {cwd, encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 << 20});

/* 1. schemă */
{
  const S = loadSources(), probs = validateSources(S), ids = new Set(S.sources.map((s) => s.id));
  const dir = path.join(HUB, 'data', 'refresh');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')) : []) {
    const j = readJson(path.join(dir, f)), id = f.replace(/\.json$/, '');
    if (!ids.has(id)) { probs.push(`${f}: nu corespunde niciunei surse din sources.json`); continue; }
    if (j.schema !== 1 || j.id !== id) probs.push(`${f}: schemă/id`);
    if (!Array.isArray(j.records) || j.count !== j.records.length) probs.push(`${f}: count ≠ records.length`);
    else if (j.sha256 !== sha256(stable(j.records))) probs.push(`${f}: hash-ul nu corespunde înregistrărilor (fișier modificat de mână?)`);
    if (!/^\d{4}-\d\d-\d\d$/.test(j.fetched || '')) probs.push(`${f}: fetched invalid`);
  }
  const h = readJson(P.health, {schema: 1, sources: {}});
  for (const id of Object.keys(h.sources || {})) if (!ids.has(id)) probs.push(`source-health.json: ${id} nu e în sources.json`);
  gate('schemă sources.json / instantanee / sănătate', !probs.length, probs.slice(0, 5).join('; '));
}

/* 2. sync-catalog --check: fără probleme noi față de REF */
let wt = null;
try {
  const problems = (cwd) => {
    const root = APPS || path.join(os.tmpdir(), 'gate-fara-aplicatii');   // aceeași rădăcină pentru ambele arbori, ca liniile să fie comparabile
    fs.mkdirSync(root, {recursive: true});
    const r = sh('node', ['tools/sync-catalog.mjs', '--check', '--root', root], cwd);
    return new Set((r.stdout + r.stderr).split('\n').filter((l) => /^PROBLEMĂ/.test(l)));
  };
  const now = problems(HUB);
  wt = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-base-'));
  const add = sh('git', ['worktree', 'add', '--detach', wt, BASE]);
  if (add.status !== 0) { gate('sync-catalog --check', false, `nu pot crea worktree pentru ${BASE}: ${add.stderr.trim().slice(0, 120)}`); }
  else {
    const before = problems(wt), fresh = [...now].filter((l) => !before.has(l));
    gate('sync-catalog --check (fără probleme noi față de ' + BASE + ')', !fresh.length, fresh.length ? fresh.slice(0, 3).join(' | ') : `${now.size} probleme preexistente (aplicații neclonate în acest mediu), 0 noi`);
  }
} catch (e) { gate('sync-catalog --check', false, e.message); }

/* 3. fixcsp pe o copie */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-csp-'));
  fs.copyFileSync(path.join(HUB, 'index.html'), path.join(tmp, 'index.html'));
  const r = sh('node', ['fff-kit/build.mjs', 'fixcsp', path.join(tmp, 'index.html')]);
  const same = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8') === fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  gate('fixcsp (hash-urile CSP la zi)', r.status === 0 && same, same ? '' : 'index.html ar fi modificat de fixcsp: rulează `node fff-kit/build.mjs fixcsp index.html`');
  fs.rmSync(tmp, {recursive: true, force: true});
}

/* 4. transparenta --check */
{ const r = sh('node', ['tools/transparenta.mjs', '--check']); gate('transparenta --check', r.status === 0, (r.stdout + r.stderr).trim().split('\n').pop().slice(0, 200)); }

/* 4b. meta: catalog-meta.dataSources, #source-health și transparenta a8 la zi față de sources.json + source-health.json */
{ const r = sh('node', ['tools/refresh/meta.mjs', 'check']); gate('meta --check (surse în catalog-meta, #source-health, transparenta)', r.status === 0, (r.stdout + r.stderr).trim().split('\n').slice(0, 3).join(' | ').slice(0, 240)); }

/* 5. testele hubului, comparate cu REF */
if (TESTS) {
  const names = (cwd) => {
    const r = sh('node', ['tests/hub.test.mjs'], cwd, {CHROMIUM_PATH: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'});
    const pass = new Set(), fail = new Set();
    for (const l of r.stdout.split('\n')) { const m = l.match(/^(ok  |FAIL) (.*?)( \(\d+ ms\))?$/); if (m) (m[1] === 'FAIL' ? fail : pass).add(m[2]); }
    return {pass, fail, status: r.status, tail: (r.stdout + r.stderr).split('\n').slice(-4).join(' ')};
  };
  const now = names(HUB);
  if (wt && fs.existsSync(path.join(wt, 'tests', 'hub.test.mjs'))) {
    const before = names(wt), broke = [...before.pass].filter((n) => !now.pass.has(n));
    gate('tests/hub.test.mjs (niciun test trecut pe ' + BASE + ' nu cade)', !broke.length && now.pass.size > 0, broke.length ? 'cad: ' + broke.join(' | ').slice(0, 300) : `${now.pass.size} trec acum, ${before.pass.size} treceau pe REF; ${now.fail.size} cad (și pe REF: ${[...now.fail].filter((n) => before.fail.has(n)).length})`);
  } else gate('tests/hub.test.mjs', now.status === 0, now.tail.slice(0, 200));
}
if (wt) { sh('git', ['worktree', 'remove', '--force', wt]); fs.rmSync(wt, {recursive: true, force: true}); }
const bad = results.filter((r) => !r.ok);
if (argv.includes('--json')) console.log(JSON.stringify(results));
console.log(bad.length ? `\n${bad.length} porți pică.` : '\nToate porțile trec.');
process.exit(bad.length ? 1 : 0);
