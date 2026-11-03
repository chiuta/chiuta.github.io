#!/usr/bin/env node
/* tools/refresh/run.mjs — alergătorul de reîmprospătare a surselor externe (Etapa 8.2–8.3).
 *
 *   node tools/refresh/run.mjs [opțiuni]
 *     --only a,b          doar sursele cu aceste id-uri
 *     --cadence viu,lent  doar sursele cu aceste cadențe (altfel toate cele active, mai puțin „înghețat” dacă nu e cerut)
 *     --dry-run           arată diferența și starea fără să scrie nimic
 *     --fixtures [scen]   în loc de rețea, citește răspunsurile din tools/refresh/fixtures/<id>/<scenariu>/ (implicit „ok”)
 *     --record DIR        salvează răspunsurile reale primite (pentru a crea fixturi); folosit în Actions, încărcat ca artefact
 *     --out DIR           directorul de pregătire (implicit .refresh-out): oglindă a depozitului cu fișierele de comis + result.json + summary.md
 *     --apply             scrie fișierele direct în depozit, în loc de directorul de pregătire
 *     --root DIR          depozitul de date (implicit hub-ul; pentru teste)
 *     --strict            cod de ieșire 1 dacă vreo sursă a eșuat sau a fost respinsă
 *     --list              arată planul (ce s-ar rula) și iese
 *
 * Reguli (8.3): schemă + praguri (scădere > 20% a numărului de înregistrări, creștere > 40%, structură schimbată, acoperire față de aplicație)
 * → nu se aplică; rezultatul „respins” devine issue (publish.mjs). Datele valide ajung într-un instantaneu data/refresh/<id>.json cu hash și dată;
 * versiunea veche se arhivează în data/archive/AAAA-LL-ZZ/<id>.json. Nu se descarcă nimic în aplicațiile publicate (CSP connect-src 'none'):
 * rețeaua se folosește doar aici, în build/Actions.
 */
import fs from 'node:fs';
import path from 'node:path';
import {HUB, paths, loadSources, validateSources, readJson, writeJson, sha256, stable, today, Http, decide} from './lib.mjs';
import {PARSERS} from './parsers/index.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const csv = (n) => (val(n, '') || '').split(',').filter(Boolean);
const opt = {only: csv('--only'), cadence: csv('--cadence'), dry: flag('--dry-run'), apply: flag('--apply'), strict: flag('--strict'), list: flag('--list'),
  fixtures: flag('--fixtures') ? (val('--fixtures', 'ok')) : null, record: val('--record', null), out: path.resolve(val('--out', '.refresh-out')),
  root: path.resolve(val('--root', HUB))};
const PP = paths(opt.root);

const S = loadSources(PP.sources);
const probs = validateSources(S);
if (probs.length) { console.error(probs.join('\n')); process.exit(2); }

const sel = S.sources.filter((s) => s.stare === 'activ' && (!opt.only.length || opt.only.includes(s.id)) && (opt.cadence.length ? opt.cadence.includes(s.cadenta) : (opt.only.length || s.cadenta !== 'înghețat')));
if (opt.list) { for (const s of sel) console.log(`${s.id}\t${s.cadenta}\t${s.kind}\t${s.parser}\t${s.url || s.urls[0]}`); console.log(`${sel.length} surse din ${S.sources.length}`); process.exit(0); }

const day = today();
const health = readJson(PP.health, {schema: 1, updated: null, sources: {}});
health.sources ||= {};
const staged = {};   // cale relativă la depozit → conținut
const results = [];
const short = (m) => String(m || '').replace(/\s+/g, ' ').slice(0, 220);
const labelsOf = (ids, labels) => ids.slice(0, 25).map((k) => (labels && labels[k] ? `${k} ${labels[k]}` : k));

for (const src of sel) {
  const t0 = Date.now();
  const http = new Http({ua: S.defaults.userAgent, uaToken: 'chiuta-refresh', fixtures: opt.fixtures ? path.join(PP.fixtures, src.id, opt.fixtures) : null,
    record: opt.record ? path.join(path.resolve(opt.record), src.id) : null, minIntervalMs: src.minIntervalMs ?? S.defaults.minIntervalMs,
    timeoutMs: src.timeoutMs ?? S.defaults.timeoutMs, maxBytes: src.maxBytes ?? S.defaults.maxBytes, retries: S.defaults.retries});
  const out = {id: src.id, app: src.app, kind: src.kind, cadence: src.cadenta, status: 'ok', errorType: null, reasons: [], summary: {}, requests: 0};
  try {
    const P_ = PARSERS[src.parser];
    if (!P_) throw Object.assign(new Error(`parser necunoscut „${src.parser}”`), {type: 'parse'});
    if (P_.kind !== src.kind) throw Object.assign(new Error(`parserul ${src.parser} este „${P_.kind}”, sursa declară „${src.kind}”`), {type: 'validation'});
    const baseline = readJson(PP.baseline(src.id), null);
    const r = await P_.run(src, http, {baseline, defaults: S.defaults});
    out.summary = r.summary || {};
    if (src.kind === 'watch') {
      const bad = r.checks.filter((c) => !c.ok);
      out.checks = r.checks;
      if (bad.length) { out.status = 'alert'; out.errorType = 'drift'; out.reasons = bad.slice(0, 20).map((c) => ({type: 'drift', msg: `${c.k}: ${c.detail}`})); }
    } else {
      const prev = readJson(PP.snap(src.id), null);
      const d = decide(src, r, prev, baseline, S.defaults);
      out.action = d.action; out.autoMerge = d.autoMerge; out.reasons = d.reasons; out.count = r.records.length; out.structure = r.structure;
      if (d.diff) out.diff = {added: d.diff.added.length, removed: d.diff.removed.length, changed: d.diff.changed.length,
        addedSample: labelsOf(d.diff.added, r.labels), removedSample: labelsOf(d.diff.removed, prev && Object.fromEntries(prev.records.map((x) => [x.k, x.t]))), changedSample: labelsOf(d.diff.changed, r.labels)};
      if (d.action === 'reject') { out.status = 'alert'; out.errorType = d.reasons[0].type; }
      else if (d.action === 'initial' || d.action === 'apply') {
        out.status = 'changed';
        const snap = {schema: 1, id: src.id, app: src.app, source: src.url || src.urls[0], parser: src.parser, parserVersion: P_.version, fetched: day,
          sha256: sha256(stable(r.records)), count: r.records.length, structure: r.structure, records: r.records};
        staged[path.relative(opt.root, PP.snap(src.id))] = JSON.stringify(snap, null, 1) + '\n';
        out.sha256 = snap.sha256;
        if (prev) { const ap = path.relative(opt.root, PP.archive(day, src.id)); if (!fs.existsSync(PP.archive(day, src.id))) staged[ap] = JSON.stringify(prev, null, 1) + '\n'; out.archive = ap; }
      } else out.sha256 = prev.sha256;
    }
  } catch (e) {
    out.status = 'error'; out.errorType = e.type || 'parse'; out.reasons = [{type: out.errorType, msg: short(e.message)}];
  }
  out.requests = http.count; out.ms = Date.now() - t0;
  results.push(out);
  console.log(`${out.status.padEnd(9)} ${src.id.padEnd(26)} ${src.cadenta.padEnd(8)}${out.count != null ? ' n=' + out.count : ''}${out.diff ? ` +${out.diff.added} -${out.diff.removed} ~${out.diff.changed}` : ''}${out.action ? ' [' + out.action + (out.autoMerge ? ', auto-fuziune' : '') + ']' : ''}${out.reasons.length ? ' · ' + out.reasons.map((r) => r.type + ': ' + r.msg).join(' | ').slice(0, 200) : ''}`);
}

/* ---------- sănătatea surselor (toate sursele din inventar) ---------- */
const before = stable(health.sources);
for (const s of S.sources) {
  const h = health.sources[s.id] ||= {};
  const o = results.find((x) => x.id === s.id);
  if (s.stare !== 'activ') { Object.assign(h, {status: s.stare === 'de-confirmat' ? 'de-confirmat' : s.stare === 'oprit' ? 'oprit' : 'inventar'}); continue; }
  if (!o) { h.status ||= 'neexecutat'; continue; }
  if (o.status === 'ok' || o.status === 'changed') {
    Object.assign(h, {status: o.status === 'changed' ? 'schimbat' : 'ok', lastOk: day, errorType: null, errorMsg: null, consecutiveFails: 0});
    if (o.count != null) h.records = o.count; if (o.sha256) h.sha256 = o.sha256.slice(0, 12);
    const inf = o.summary && (o.summary.latest ? `ultima ${o.summary.latest}${o.summary.newer ? ' (mai nouă decât cea fixată)' : ''}` : null);
    h.info = inf || undefined;
  } else {
    Object.assign(h, {status: o.status === 'alert' ? 'alertă' : 'eroare', lastFail: day, errorType: o.errorType, errorMsg: short(o.reasons[0] && o.reasons[0].msg), consecutiveFails: (h.consecutiveFails || 0) + 1});
  }
}
health.updated = stable(health.sources) === before ? health.updated : day;
health.schema = 1;
staged[path.relative(opt.root, PP.health)] = JSON.stringify(health, null, 1) + '\n';

/* ---------- ieșire ---------- */
const summaryMd = ['## Reîmprospătarea surselor · ' + day, '', '| sursă | cadență | stare | înregistrări | diferență | note |', '|---|---|---|---|---|---|',
  ...results.map((o) => `| ${o.id} | ${o.cadence} | ${o.status}${o.action ? ' (' + o.action + ')' : ''} | ${o.count ?? o.checks?.length ?? ''} | ${o.diff ? `+${o.diff.added} −${o.diff.removed} ~${o.diff.changed}` : ''} | ${o.reasons.map((r) => `${r.type}: ${r.msg}`).join('; ').replace(/\|/g, '/').slice(0, 300)} |`)].join('\n') + '\n';
if (opt.dry) { console.log('\n--dry-run: nu se scrie nimic.'); }
else {
  const base = opt.apply ? opt.root : opt.out;
  if (!opt.apply) fs.rmSync(opt.out, {recursive: true, force: true});
  for (const [rel, content] of Object.entries(staged)) { const f = path.join(base, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, content); }
  fs.mkdirSync(opt.out, {recursive: true});
  fs.writeFileSync(path.join(opt.out, 'result.json'), JSON.stringify({date: day, apply: opt.apply, files: Object.keys(staged), results}, null, 1) + '\n');
  fs.writeFileSync(path.join(opt.out, 'summary.md'), summaryMd);
  console.log(`\nscris: ${Object.keys(staged).length} fișiere ${opt.apply ? 'în depozit' : 'în ' + path.relative(process.cwd(), opt.out)}`);
}
const bad = results.filter((o) => o.status === 'alert' || o.status === 'error');
if (opt.strict && bad.length) process.exit(1);
