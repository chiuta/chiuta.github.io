#!/usr/bin/env node
// Teste pentru alergătorul de reîmprospătare: node --test tools/refresh/test.mjs   (fără rețea: fixturi sintetice din tools/refresh/fixtures/)
// Fiecare test lucrează într-un depozit temporar (--root), deci nu atinge data/ din hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {HUB, loadSources, validateSources, decide, diffRecords, parseRobots, robotsMatch, readJson, writeJson} from './lib.mjs';
import {extractNumbered, internalLinks} from './parsers/html.mjs';
import {jsonStat} from './parsers/json.mjs';
import {h8} from './parsers/common.mjs';

const RUN = path.join(HUB, 'tools', 'refresh', 'run.mjs');
function mkRoot(patch) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-test-'));
  fs.mkdirSync(path.join(root, 'data'), {recursive: true});
  const s = readJson(path.join(HUB, 'data', 'sources.json'));
  if (patch) patch(s);
  writeJson(path.join(root, 'data', 'sources.json'), s);
  return root;
}
function run(root, id, scenario, extra = []) {
  const r = spawnSync(process.execPath, [RUN, '--root', root, '--out', path.join(root, 'out'), '--only', id, '--fixtures', scenario, ...extra], {encoding: 'utf8'});
  assert.ok(r.status === 0, `run.mjs a ieșit cu ${r.status}: ${r.stderr}${r.stdout}`);
  const res = readJson(path.join(root, 'out', 'result.json'));
  return {out: res.results.find((x) => x.id === id), res, stdout: r.stdout, root};
}
const apply = (root, id, scenario) => run(root, id, scenario, ['--apply']);

test('sources.json respectă schema și nu are aplicații în „faraSurse” care au surse', () => {
  const s = loadSources();
  assert.deepEqual(validateSources(s), []);
  assert.ok(s.sources.length >= 25);
  for (const x of s.sources.filter((q) => q.stare === 'activ')) assert.ok(x.parser && x.validator, x.id);
  // fiecare sursă „data” activă are cadență și autoMerge explicit
  for (const x of s.sources.filter((q) => q.stare === 'activ' && q.kind === 'data')) assert.ok('autoMerge' in x, x.id + ': autoMerge');
  const bad = structuredClone(s); bad.sources[0].cadenta = 'zilnic'; bad.sources[1].url = 'http://exemplu.ro/';
  const p = validateSources(bad); assert.ok(p.some((m) => /cadență/.test(m)) && p.some((m) => /HTTPS/.test(m)));
});

test('robots.txt: RFC 9309 (cel mai lung potrivit, Allow bate Disallow la egalitate, grup specific bate *)', () => {
  const r = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /x$\n\nUser-agent: chiuta-refresh\nDisallow: /c', 'chiuta-refresh/1.0');
  assert.equal(robotsMatch(r, '/a').ok, true, 'grupul specific înlocuiește *');
  assert.equal(robotsMatch(r, '/c/d').ok, false);
  const g = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /x$\nDisallow:', 'bot');
  assert.equal(robotsMatch(g, '/a/q').ok, false); assert.equal(robotsMatch(g, '/a/b/c').ok, true); assert.equal(robotsMatch(g, '/x').ok, false); assert.equal(robotsMatch(g, '/xy').ok, true);
  assert.equal(robotsMatch(parseRobots('User-agent: *\nDisallow:', 'bot'), '/orice').ok, true);
});

test('decide(): praguri la limită (exact 20% scădere trece, peste nu), structură, creștere, auto-fuziune', () => {
  const defs = loadSources().defaults, mk = (n) => ({records: Array.from({length: n}, (_, i) => ({k: String(i).padStart(4, '0'), h: 'x' + i})), structure: 's'});
  const prev = (n) => { const r = mk(n); return {records: r.records, structure: 's', sha256: 'zzz'}; };
  const src = {validator: {}, autoMerge: {maxChanged: 3, maxChangedPct: 0}};
  assert.equal(decide(src, mk(80), prev(100), null, defs).action, 'apply');            // −20,0% → trece
  assert.equal(decide(src, mk(79), prev(100), null, defs).action, 'reject');           // −21% → respins
  assert.equal(decide(src, mk(141), prev(100), null, defs).action, 'reject');          // +41% → respins
  const st = mk(100); st.structure = 't'; assert.equal(decide(src, st, prev(100), null, defs).reasons[0].type, 'structure');
  assert.equal(decide(src, mk(0), null, null, defs).reasons[0].type, 'parse');
  assert.equal(decide({validator: {minRecords: 50}}, mk(10), null, null, defs).reasons[0].type, 'threshold');
  const a = mk(100); a.records[3].h = 'schimbat'; a.records[4].h = 'schimbat'; const d = decide(src, a, prev(100), null, defs);
  assert.equal(d.action, 'apply'); assert.equal(d.diff.changed.length, 2); assert.equal(d.autoMerge, true);
  a.records[5].h = 'q'; a.records[6].h = 'q'; assert.equal(decide(src, a, prev(100), null, defs).autoMerge, false, '4 > maxChanged 3');
  assert.equal(decide({validator: {}, autoMerge: false}, a, prev(100), null, defs).autoMerge, false);
  assert.deepEqual(diffRecords([{k: 'a', v: 1}, {k: 'b'}], [{k: 'a', v: 2}, {k: 'c'}]), {added: ['c'], removed: ['b'], changed: ['a'], total: 3});
});

test('parsere: linii numerotate, linkuri interne, JSON-stat', () => {
  const lines = ['Cursuri', '1. Reiki Usui', '2) Karuna', '2026. Copyright', '3 - ', '1134: Ultimul titlu', '12. 34'];
  assert.deepEqual(extractNumbered(lines).map((e) => e.n), [1, 2, 1134]);
  // format real observat pe sursă (2026-11-03): „N Titlu” fără punct, „NTitlu” lipit, numărul singur pe rând; „680.20 …” și „11:11…” nu sunt numere de ordine
  const real = ['1125', 'Alfa Beta', '1126 Gama Delta', '1041Epsilon Zeta', '680.20 Zeta Eta', '11:11Theta Iota', '13 Titlu 5 Kappa', '2026 Lambda Mu'];
  assert.deepEqual(extractNumbered(real).map((e) => e.n), [1125, 1126, 1041, 13]);
  assert.equal(extractNumbered(real)[0].title, 'Alfa Beta');
  const html = '<a href="/a/">x</a><a href="/a/#top">y</a><a href="/f.pdf">z</a><a href="https://alt.invalid/">e</a><a href="/b?x=1">q</a><a href="/c">c</a>';
  assert.deepEqual(internalLinks(html, 'https://s.invalid/', null, 10), ['https://s.invalid/a/', 'https://s.invalid/c']);
  const j = {class: 'dataset', id: ['geo', 'time'], size: [2, 2], dimension: {geo: {category: {index: ['AT', 'BE']}}, time: {category: {index: {2024: 0, 2025: 1}}}}, value: {0: 1, 1: 2, 3: 4}};
  assert.deepEqual(jsonStat(j), {AT: {2024: 1, 2025: 2}, BE: {2025: 4}});
  assert.throws(() => jsonStat({class: 'collection'}), /JSON-stat/);
});

test('ACORDAJ (lent, pilot): initial → neschimbat → diferențe mici/mari; respins la scădere, creștere, structură, robots, acoperire față de aplicație', () => {
  const root = mkRoot();
  const first = apply(root, 'ACORDAJ', 'ok');
  assert.equal(first.out.action, 'initial'); assert.equal(first.out.count, 1134); assert.equal(first.out.autoMerge, false);
  const snap = readJson(path.join(root, 'data/refresh/ACORDAJ.json'));
  assert.ok(snap.records.every((r) => Object.keys(r).sort().join() === 'h,k'), 'se păstrează doar hash-uri, nu titluri');
  assert.ok(!fs.readFileSync(path.join(root, 'data/refresh/ACORDAJ.json'), 'utf8').includes('Sistem spiritual'), 'niciun titlu în instantaneu');
  // baseline = lista din „aplicație”
  writeJson(path.join(root, 'data/refresh/baseline/ACORDAJ.json'), {count: 1134, hashes: snap.records.map((r) => r.h)});
  assert.equal(run(root, 'ACORDAJ', 'ok').out.action, 'unchanged');
  const small = run(root, 'ACORDAJ', 'changed-small', ['--apply']);
  assert.equal(small.out.action, 'apply'); assert.equal(small.out.diff.changed, 3); assert.equal(small.out.autoMerge, false, 'ACORDAJ nu se fuzionează automat');
  assert.ok(small.out.archive && fs.existsSync(path.join(root, small.out.archive)), 'versiunea veche e arhivată');
  assert.ok(small.out.diff.changedSample.some((x) => /Sistem spiritual de test 0010/.test(x)), 'raportul arată titlurile modificate');
  const big = run(root, 'ACORDAJ', 'changed-big'); assert.equal(big.out.action, 'apply'); assert.equal(big.out.autoMerge, false);
  for (const [scen, type] of [['drop', 'threshold'], ['grow', 'threshold'], ['structure', 'parse']]) {
    const r = run(root, 'ACORDAJ', scen); assert.equal(r.out.status, 'alert', scen); assert.equal(r.out.action, 'reject'); assert.ok(r.out.reasons.some((q) => q.type === type), scen + ': ' + JSON.stringify(r.out.reasons));
  }
  for (const scen of ['robots-block', 'robots-5xx']) { const r = run(root, 'ACORDAJ', scen); assert.equal(r.out.status, 'error', scen); assert.equal(r.out.errorType, 'robots', scen); }
  // conținut diferit de aplicație (baseline cu alte hash-uri) → respins chiar dacă numărul e corect
  writeJson(path.join(root, 'data/refresh/baseline/ACORDAJ.json'), {count: 1134, hashes: snap.records.map((r) => 'altceva' + r.h)});
  const ov = run(root, 'ACORDAJ', 'ok'); assert.equal(ov.out.action, 'reject'); assert.match(ov.out.reasons[0].msg, /coincid/);
  fs.rmSync(root, {recursive: true, force: true});
});

test('VNTV (viu, pilot): auto-fuziune doar pentru diferențe mici; respins la scădere/structură/format; reîncercare pe URL de rezervă; duplicate', () => {
  const root = mkRoot();
  assert.equal(apply(root, 'VNTV', 'ok').out.action, 'initial');
  assert.equal(run(root, 'VNTV', 'ok').out.action, 'unchanged');
  const sm = run(root, 'VNTV', 'changed-small'); assert.equal(sm.out.action, 'apply'); assert.equal(sm.out.autoMerge, true);
  assert.deepEqual([sm.out.diff.added, sm.out.diff.removed, sm.out.diff.changed], [2, 1, 1]);
  const big = run(root, 'VNTV', 'changed-big'); assert.equal(big.out.action, 'apply'); assert.equal(big.out.autoMerge, false, '40 articole noi → aprobare umană');
  for (const [scen, type] of [['drop', 'threshold'], ['structure', 'structure']]) { const r = run(root, 'VNTV', scen); assert.equal(r.out.status, 'alert', scen); assert.ok(r.out.reasons.some((q) => q.type === type), scen); }
  const g = run(root, 'VNTV', 'garbage'); assert.equal(g.out.status, 'error'); assert.equal(g.out.errorType, 'parse');
  const fb = run(mkRoot(), 'VNTV', 'fallback'); assert.equal(fb.out.status, 'changed'); assert.match(fb.out.summary.url, /videoneat-index\.json$/);
  const wp = run(mkRoot(), 'VNTV', 'wp-fallback'); assert.equal(wp.out.count, 130); assert.equal(wp.out.summary.source, 'wp-posts'); assert.equal(wp.out.status, 'changed');
  const dup = run(root, 'VNTV', 'duplicates'); assert.equal(dup.out.count, 119, 'duplicatul e ignorat (sub pragul de 2%)');
  fs.rmSync(root, {recursive: true, force: true});
});

test('AGORA-populatii: JSON-stat, 21 de state, diferențe față de aplicație raportate, valori implauzibile respinse', () => {
  const root = mkRoot();
  writeJson(path.join(root, 'data/refresh/baseline/AGORA-populatii.json'), readJson(path.join(HUB, 'data/refresh/baseline/AGORA-populatii.json')));
  const ok = run(root, 'AGORA-populatii', 'ok'); assert.equal(ok.out.action, 'initial'); assert.equal(ok.out.count, 21); assert.deepEqual(ok.out.summary.deviationsFromApp, []);
  const dev = run(root, 'AGORA-populatii', 'deviation'); assert.equal(dev.out.summary.deviationsFromApp.length, 1); assert.match(dev.out.summary.deviationsFromApp[0], /^FR: aplicație ~69\.1 mil\., Eurostat 65\.7/);
  assert.equal(run(root, 'AGORA-populatii', 'missing-geo').out.errorType, 'validation');
  assert.equal(run(root, 'AGORA-populatii', 'implausible').out.errorType, 'validation');
  assert.equal(run(root, 'AGORA-populatii', 'structure').out.errorType, 'parse');
  assert.equal(run(root, 'AGORA-populatii', 'http-500').out.errorType, 'http');
  fs.rmSync(root, {recursive: true, force: true});
});

test('surse „watch”: deriva produce alertă, nu date; erorile tehnice nu sunt deriva', () => {
  const root = mkRoot((s) => { const a = s.sources.find((x) => x.id === 'ATINGERE-tessdata'); const h = JSON.parse(fs.readFileSync(path.join(HUB, 'tools/refresh/fixtures/ATINGERE-tessdata/ok/_hashes.json'), 'utf8')); a.expect.files.forEach((f) => { f.sha256 = h[f.name]; }); });
  for (const id of ['Nexus-modele-Anthropic', 'Nexus-modele-OpenAI', 'Nexus-modele-Google', 'Anthropic-API-versiune']) {
    assert.equal(run(root, id, 'ok').out.status, 'ok', id);
    const d = run(root, id, 'drift'); assert.equal(d.out.status, 'alert', id); assert.equal(d.out.errorType, 'drift'); assert.match(d.out.reasons[0].msg, /nu mai apare/);
    assert.equal(run(root, id, 'short').out.errorType, 'validation', id);
  }
  assert.equal(run(root, 'LocalMind-modele', 'ok').out.status, 'ok');
  const lm = run(root, 'LocalMind-modele', 'drift'); assert.equal(lm.out.reasons.length, 2); assert.match(lm.out.reasons.map((r) => r.msg).join(), /404.*redenumit în onnx-community\/Alt-Nume/);
  assert.equal(run(root, 'ATINGERE-tessdata', 'ok', ['--cadence', 'înghețat']).out.status, 'ok');
  const at = run(root, 'ATINGERE-tessdata', 'drift'); assert.equal(at.out.status, 'alert'); assert.match(at.out.reasons[0].msg, /hash diferit/);
  assert.equal(run(root, 'fff-kit-astronomia', 'ok').out.status, 'ok');
  assert.match(run(root, 'fff-kit-astronomia', 'deprecated').out.reasons[0].msg, /DEPRECAT/);
  assert.match(run(root, 'fff-kit-astronomia', 'missing').out.reasons[0].msg, /404/);
  assert.match(run(root, 'fff-kit-hipparcos', 'yanked').out.reasons[0].msg, /YANKED/);
  for (const id of ['AcademiSearch-API', 'OmniHost-API', 'ScryVeil-API', 'X-fara-cont-Wayback']) {
    assert.equal(run(root, id, 'ok').out.status, 'ok', id);
    assert.equal(run(root, id, 'drift').out.status, 'alert', id);
    const t = run(root, id, 'http-503'); assert.equal(t.out.status, 'error', id + ': 503 e eroare tehnică'); assert.equal(t.out.errorType, 'http');
  }
  fs.rmSync(root, {recursive: true, force: true});
});

test('sănătatea surselor: eșecuri consecutive, ultima reușită păstrată, refacere; --dry-run nu scrie; sursele nerulate rămân', () => {
  const root = mkRoot();
  apply(root, 'VNTV', 'ok');
  const h1 = readJson(path.join(root, 'data/source-health.json')).sources;
  assert.equal(h1.VNTV.status, 'schimbat'); assert.ok(h1.VNTV.lastOk); assert.equal(h1.VNTV.consecutiveFails, 0);
  assert.equal(h1.ACORDAJ.status, 'neexecutat'); assert.equal(h1['AGORA-BCE-Bulgaria'].status, 'inventar'); assert.equal(h1['Cupa-Mondiala-2026-Wikipedia'].status, 'de-confirmat');
  apply(root, 'VNTV', 'garbage'); apply(root, 'VNTV', 'drop');
  const h2 = readJson(path.join(root, 'data/source-health.json')).sources.VNTV;
  assert.equal(h2.consecutiveFails, 2); assert.equal(h2.lastOk, h1.VNTV.lastOk); assert.ok(h2.lastFail); assert.equal(h2.errorType, 'threshold');
  const before = fs.readFileSync(path.join(root, 'data/source-health.json'), 'utf8');
  const dry = spawnSync(process.execPath, [RUN, '--root', root, '--out', path.join(root, 'out2'), '--only', 'VNTV', '--fixtures', 'ok', '--dry-run'], {encoding: 'utf8'});
  assert.equal(dry.status, 0); assert.ok(!fs.existsSync(path.join(root, 'out2')), 'dry-run nu scrie nimic'); assert.equal(fs.readFileSync(path.join(root, 'data/source-health.json'), 'utf8'), before);
  apply(root, 'VNTV', 'ok');
  const h3 = readJson(path.join(root, 'data/source-health.json')).sources.VNTV; assert.equal(h3.consecutiveFails, 0); assert.equal(h3.errorType, null);
  const strict = spawnSync(process.execPath, [RUN, '--root', root, '--out', path.join(root, 'o3'), '--only', 'VNTV', '--fixtures', 'garbage', '--strict'], {encoding: 'utf8'});
  assert.equal(strict.status, 1, '--strict: cod 1 la eșec');
  fs.rmSync(root, {recursive: true, force: true});
});

test('fixturile lipsă sunt eroare de rețea, nu date (și rularea reală nu e declanșată din greșeală)', () => {
  const root = mkRoot();
  const r = run(root, 'VNTV', 'nu-exista'); assert.equal(r.out.status, 'error'); assert.equal(r.out.errorType, 'robots', 'robots.txt indisponibil → nu se continuă');
  fs.rmSync(root, {recursive: true, force: true});
});

/* ---------- publish.mjs cu un `gh` simulat și un depozit git real (origin local) ---------- */
function mkGit() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-pub-'));
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', ...a], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  git(base, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  const work = path.join(base, 'work'); git(base, 'clone', '-q', 'origin.git', 'work');
  fs.mkdirSync(path.join(work, 'data'), {recursive: true});
  writeJson(path.join(work, 'data/sources.json'), readJson(path.join(HUB, 'data/sources.json')));
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'init'); git(work, 'push', '-q', 'origin', 'HEAD:main');
  const bin = path.join(base, 'bin'); fs.mkdirSync(bin);
  const log = path.join(base, 'gh.log'), openIssues = path.join(base, 'open-issues.json'); fs.writeFileSync(openIssues, '[]'); fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}
const fs=require('fs');const a=process.argv.slice(2);let stdin='';try{stdin=fs.readFileSync(0,'utf8')}catch(e){}
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args:a,body:stdin?JSON.parse(stdin):null})+'\\n');
const m=a[a.indexOf('-X')+1],route=a[a.indexOf('-X')+2];
let out='{}';
if(m==='GET'&&/\\/pulls\\?/.test(route))out='[]';
else if(m==='GET'&&/\\/issues\\?/.test(route))out=fs.readFileSync(${JSON.stringify(openIssues)},'utf8');
else if(m==='POST'&&/\\/pulls$/.test(route))out=JSON.stringify({number:7,html_url:'https://x.invalid/pull/7'});
else if(m==='POST'&&/\\/issues$/.test(route))out=JSON.stringify({number:9,html_url:'https://x.invalid/issues/9'});
else if(m==='PUT')out=JSON.stringify({merged:true});
process.stdout.write(out);`, {mode: 0o755});
  return {base, work, bin, log, openIssues, git, calls: () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)), reset: () => fs.writeFileSync(log, '')};
}
function pub(g, id, scenario, extra = []) {
  const out = path.join(g.work, '.refresh-out');
  let r = spawnSync(process.execPath, [RUN, '--root', g.work, '--out', out, '--only', id, '--fixtures', scenario], {encoding: 'utf8'}); assert.equal(r.status, 0, r.stderr);
  r = spawnSync(process.execPath, [path.join(HUB, 'tools/refresh/publish.mjs'), '--out', out, '--work', g.work, '--skip-gate', '--no-health', ...extra], {encoding: 'utf8', env: {...process.env, PATH: g.bin + path.delimiter + process.env.PATH, GITHUB_REPOSITORY: 'chiuta/test', REFRESH_GIT_NAME: 'T', REFRESH_GIT_EMAIL: 't@t.invalid'}});
  assert.equal(r.status, 0, 'publish.mjs: ' + r.stderr + r.stdout);
  return r.stdout;
}
const routes = (g) => g.calls().map((c) => { const i = c.args.indexOf('-X'); return `${c.args[i + 1]} ${c.args[i + 2]}`; });

test('publish: prima captură → ramura data-refresh/VNTV + PR cu eticheta needs-human, fără fuziune; diferență mică → fuziune automată; arhiva ajunge în PR', () => {
  const g = mkGit();
  pub(g, 'VNTV', 'ok');
  let rs = routes(g);
  assert.ok(rs.includes('POST repos/chiuta/test/pulls'), rs.join('\n')); assert.ok(!rs.some((r) => r.startsWith('PUT ')), 'nicio fuziune automată la prima captură');
  const lab = g.calls().find((c) => /issues\/7\/labels/.test(c.args.join(' ')));
  assert.deepEqual(lab.body.labels, ['data-refresh', 'needs-human']);
  assert.match(g.git(g.work, 'ls-remote', '--heads', 'origin'), /refs\/heads\/data-refresh\/VNTV/);
  assert.equal(g.git(g.work, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'main', 'arborele de lucru revine pe main');
  assert.equal(fs.existsSync(path.join(g.work, 'data/refresh/VNTV.json')), false, 'main nu primește datele până la fuziune');
  // fuzionează PR-ul „de mână” și continuă cu o diferență mică
  g.git(g.work, 'fetch', '-q', 'origin'); g.git(g.work, 'merge', '-q', '--ff-only', 'origin/data-refresh/VNTV'); g.git(g.work, 'push', '-q', 'origin', 'HEAD:main');
  g.reset(); pub(g, 'VNTV', 'changed-small');
  rs = routes(g); assert.ok(rs.includes('PUT repos/chiuta/test/pulls/7/merge'), rs.join('\n'));
  assert.deepEqual(g.calls().find((c) => /issues\/7\/labels/.test(c.args.join(' '))).body.labels, ['data-refresh']);
  const files = g.git(g.work, 'diff', '--name-only', 'origin/main', 'origin/data-refresh/VNTV').trim().split('\n');
  assert.ok(files.includes('data/refresh/VNTV.json') && files.some((f) => /^data\/archive\/\d{4}-\d\d-\d\d\/VNTV\.json$/.test(f)), files.join());
  // diferență mare → rămâne deschis
  g.git(g.work, 'fetch', '-q', 'origin'); g.git(g.work, 'merge', '-q', '--ff-only', 'origin/data-refresh/VNTV'); g.git(g.work, 'push', '-q', 'origin', 'HEAD:main');
  g.reset(); pub(g, 'VNTV', 'changed-big'); assert.ok(!routes(g).some((r) => r.startsWith('PUT ')));
  fs.rmSync(g.base, {recursive: true, force: true});
});

test('publish: issue la respingere (o singură dată pentru același mesaj), eroare tehnică abia la a doua, închidere la refacere; nimic nu se comite', () => {
  const g = mkGit();
  pub(g, 'VNTV', 'ok');
  g.git(g.work, 'fetch', '-q', 'origin'); g.git(g.work, 'merge', '-q', '--ff-only', 'origin/data-refresh/VNTV'); g.git(g.work, 'push', '-q', 'origin', 'HEAD:main');
  g.reset(); pub(g, 'VNTV', 'drop');
  const post = g.calls().find((c) => c.args.includes('-X') && c.args[c.args.indexOf('-X') + 1] === 'POST' && /\/issues$/.test(c.args[c.args.indexOf('-X') + 2]));
  assert.ok(post, routes(g).join('\n')); assert.equal(post.body.title, '[refresh] VNTV: threshold'); assert.deepEqual(post.body.labels, ['refresh-alert']); assert.match(post.body.body, /scăzut cu 50\.0%/); assert.match(post.body.body, /Datele din depozit au rămas neschimbate/);
  assert.ok(!routes(g).some((r) => /pulls$/.test(r)), 'respingerea nu deschide PR');
  // același mesaj, issue deja deschis → fără al doilea issue
  fs.writeFileSync(g.openIssues, JSON.stringify([{number: 9, body: post.body.body}])); g.reset(); pub(g, 'VNTV', 'drop');
  assert.ok(!routes(g).some((r) => r === 'POST repos/chiuta/test/issues'), 'fără issue duplicat');
  // refacere → comentariu + închidere
  g.reset(); pub(g, 'VNTV', 'ok');
  assert.ok(routes(g).includes('PATCH repos/chiuta/test/issues/9') && g.calls().some((c) => c.body && c.body.state === 'closed'));
  // eroare HTTP: prima nu deschide issue; a doua consecutivă da (sănătatea e păstrată în --apply)
  fs.writeFileSync(g.openIssues, '[]');
  const runApply = (scen) => { const r = spawnSync(process.execPath, [RUN, '--root', g.work, '--out', path.join(g.work, '.refresh-out'), '--only', 'AGORA-populatii', '--fixtures', scen, '--apply'], {encoding: 'utf8'}); assert.equal(r.status, 0); };
  g.reset(); runApply('http-500');
  spawnSync(process.execPath, [path.join(HUB, 'tools/refresh/publish.mjs'), '--out', path.join(g.work, '.refresh-out'), '--work', g.work, '--skip-gate', '--no-health'], {encoding: 'utf8', env: {...process.env, PATH: g.bin + path.delimiter + process.env.PATH, GITHUB_REPOSITORY: 'chiuta/test'}});
  assert.ok(!routes(g).includes('POST repos/chiuta/test/issues'), 'prima eroare HTTP: fără issue');
  runApply('http-500');
  spawnSync(process.execPath, [path.join(HUB, 'tools/refresh/publish.mjs'), '--out', path.join(g.work, '.refresh-out'), '--work', g.work, '--skip-gate', '--no-health'], {encoding: 'utf8', env: {...process.env, PATH: g.bin + path.delimiter + process.env.PATH, GITHUB_REPOSITORY: 'chiuta/test'}});
  assert.ok(routes(g).includes('POST repos/chiuta/test/issues'), 'a doua eroare consecutivă: issue');
  fs.rmSync(g.base, {recursive: true, force: true});
});

test('publish --dry-run: nu atinge git și nu face apeluri de scriere', () => {
  const g = mkGit();
  const out = path.join(g.work, '.refresh-out');
  spawnSync(process.execPath, [RUN, '--root', g.work, '--out', out, '--only', 'VNTV', '--fixtures', 'ok'], {encoding: 'utf8'});
  const r = spawnSync(process.execPath, [path.join(HUB, 'tools/refresh/publish.mjs'), '--out', out, '--work', g.work, '--dry-run'], {encoding: 'utf8', env: {...process.env, PATH: g.bin + path.delimiter + process.env.PATH, GITHUB_REPOSITORY: 'chiuta/test'}});
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /\[dry-run\]/);
  assert.deepEqual(routes(g).filter((x) => !x.startsWith('GET')), []);
  assert.equal(g.git(g.work, 'ls-remote', '--heads', 'origin').includes('data-refresh'), false);
  fs.rmSync(g.base, {recursive: true, force: true});
});
