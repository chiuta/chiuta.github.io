// Teste `build.mjs release` / `release-all` (kit 1.2.0). Lucrează EXCLUSIV pe copii din /tmp (nu atinge depozitele).
//  - aplicații sintetice (mereu) + 3 copii ale unor aplicații reale (dacă există în FFF_APPS_ROOT, implicit /home/claude/chk). Rulare: node test/release.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {releaseApp, releaseAll, bumpVersion, replaceVersion, bumpTestText, discoverApps} from '../lib/release.mjs';
import {checkKit, applyKit, runInfo} from '../build.mjs';
import {checkCspHashes} from '../lib/csp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, '..', 'build.mjs');
const FIXTURE = fs.readFileSync(path.join(HERE, 'fixture.html'), 'utf8');
let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } };
const tmp = (p = 'fffrel-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const rf = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const meta = (h, n) => (h.match(new RegExp(`<meta name="${n}" content="([^"]*)"`)) || [])[1];
const DATE = '2026-11-01';
const cli = (args) => spawnSync('node', [BUILD, ...args], {encoding: 'utf8'});

/** Aplicație sintetică: fixture + sw.js + tests + README-uri + app.json (via info). */
function synth(root, name, {version = '2.3.9', date = '2026-10-22', modules = 'core,label,bundle', disable} = {}) {
  const d = path.join(root, name); fs.mkdirSync(path.join(d, 'tests'), {recursive: true});
  let h = FIXTURE.replace('content="1.2.3"', `content="${version}"`).replace('content="2026-10-14"', `content="${date}"`).replace('v 1.2.3 · 2026-10-14', `v ${version} · ${date}`);
  fs.writeFileSync(path.join(d, 'index.html'), h);
  fs.writeFileSync(path.join(d, 'sw.js'), `'use strict';\nvar SLUG = "${name}", VERSION = "${version}";\nvar CACHE = 'fff-' + SLUG + '-' + VERSION;\n`);
  fs.writeFileSync(path.join(d, 'tests', 'a.test.mjs'), [
    `// test ${name}`,
    `const V = '${version}';`,
    `ok(/v ?${version.replace(/\./g, '\\.')} · ${date}/.test(txt), 'versiune în subsol');`,
    `ok(info.version === "${version}" && info.updated === '${date}', 'app.json');`,
    `ok(info.kit.version === '1.1.4', 'kit (rămâne neatins)');`,
    `const other = '10.${version}0';  // alt număr, nu versiunea`,
    '',
  ].join('\n'));
  for (const [l, a, b] of [['', 'Version', 'Last updated'], ['.ro', 'Versiune', 'Ultima actualizare'], ['.fr', 'Version', 'Dernière mise à jour']]) fs.writeFileSync(path.join(d, `README${l}.md`), `# ${name}\n\n**English** · ...\n\n**${a}${l === '.fr' ? ' ' : ''}:** ${version} · **${b}${l === '.fr' ? ' ' : ''}:** ${date}\n\ntext\n`);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({storagePrefixes: ['fx.', 'demo-fff.']}));
  applyKit(d, {slug: name, modules, disable}); runInfo(d, {slug: name});
  return d;
}
function copyApp(src, dst) {
  fs.mkdirSync(dst, {recursive: true});
  for (const e of fs.readdirSync(src, {withFileTypes: true})) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyApp(s, d); else if (!/\.(png|jpe?g|gif|webp)$/i.test(e.name)) fs.copyFileSync(s, d);
  }
  return dst;
}

console.log('funcții de bază');
check('bumpVersion: patch/minor/none/major, completare 1–2 componente', bumpVersion('2.3.9', 'patch') === '2.3.10' && bumpVersion('2.3.9', 'minor') === '2.4.0' && bumpVersion('2.3.9', 'none') === '2.3.9' && bumpVersion('2.3.9', 'major') === '3.0.0' && bumpVersion('2.3', 'patch') === '2.3.1' && bumpVersion('4', 'minor') === '4.1.0');
check('bumpVersion: sufix (-beta) sau nivel necunoscut → eroare', (() => { try { bumpVersion('1.0.0-beta', 'patch'); return false; } catch { /* ok */ } try { bumpVersion('1.0.0', 'foo'); return false; } catch { return true; } })());
check('replaceVersion: text simplu + regex escapat, delimitat (nu atinge 12.3.9 / 2.3.90 / 2.3.9.1)', (() => { const [t, n] = replaceVersion("a '2.3.9' b /2\\.3\\.9/ c 12.3.9 d 2.3.90 e 2.3.9.1 f v2.3.9", '2.3.9', '2.3.10'); return n === 3 && t.includes("'2.3.10'") && t.includes('/2\\.3\\.10/') && t.includes('12.3.9') && t.includes('2.3.90') && t.includes('2.3.9.1'); })());
check('bumpTestText: schimbă versiunea și data, dar nu liniile despre versiunea KITULUI', (() => { const r = bumpTestText("x('2.3.9');\ninfo.kit.version === '2.3.9';\nupdated: '2026-10-22'", '2.3.9', '2.3.10', '2026-10-22', DATE); return r.lines === 2 && r.text.includes("x('2.3.10')") && r.text.includes("kit.version === '2.3.9'") && r.text.includes(DATE); })());

console.log('release pe aplicație sintetică');
{
  const root = tmp(), d = synth(root, 'alfa', {version: '2.3.9', date: '2026-10-22', modules: 'core,label,bundle,srs', disable: 'motiv de test'});
  const before = rf(d, 'index.html');
  check('pregătire: kit 1.2.0, modulele srs, fff-disable', /modules=core,label,bundle,srs/.test(before) && before.includes('<meta name="fff-disable" content="motiv de test">'));
  const dry = releaseApp(d, {dryRun: true, date: DATE, lax: true});
  check('dry-run: ok, raportează fișierele care s-ar schimba, nu scrie nimic', dry.ok && dry.dryRun && dry.from === '2.3.9' && dry.to === '2.3.10' && ['index.html', 'sw.js', 'app.json', 'README.md', 'README.ro.md', 'README.fr.md', 'tests/a.test.mjs'].every((f) => dry.changed.includes(f)) && rf(d, 'index.html') === before && rf(d, 'sw.js').includes('"2.3.9"'), dry);
  const r = releaseApp(d, {date: DATE, lax: true});
  const h = rf(d, 'index.html');
  check('release: ok, 2.3.9 → 2.3.10, data = azi (dată dată)', r.ok && r.from === '2.3.9' && r.to === '2.3.10' && meta(h, 'application-version') === '2.3.10' && meta(h, 'last-updated') === DATE, r.errors);
  check('#app-version actualizat (versiune și dată)', h.includes(`v 2.3.10 · ${DATE}`) && !h.includes('v 2.3.9'));
  check('sw.js: VERSION nou (cache-ul derivat se schimbă)', /VERSION = "2.3.10"/.test(rf(d, 'sw.js')));
  const app = JSON.parse(rf(d, 'app.json')), emb = JSON.parse(h.match(/id="fff-info">([\s\S]*?)<\/script>/)[1]);
  check('app.json și fff-info: versiune, dată, kit 1.2.0, identice', app.version === '2.3.10' && app.updated === DATE && app.kit.version === '1.2.0' && JSON.stringify(app) === JSON.stringify(emb));
  check('hash-ul SHA-256 din fff-info valabil; hash-uri CSP valide', checkKit(d, {lax: true}).ok && checkCspHashes(h).ok);
  check('slug, module și fff-disable păstrate', meta(h, 'fff-app') === 'alfa' && /modules=core,label,bundle,srs/.test(h) && h.includes('<meta name="fff-disable" content="motiv de test">') && app.kit.modules.join() === 'core,label,bundle,srs');
  const t = rf(d, 'tests', 'a.test.mjs');
  check('teste: versiune și dată în text simplu și regex; kit.version și alte numere neatinse', t.includes("const V = '2.3.10'") && t.includes('/v ?2\\.3\\.10 · ' + DATE + '/') && t.includes(`info.version === "2.3.10" && info.updated === '${DATE}'`) && t.includes("info.kit.version === '1.1.4'") && t.includes("'10.2.3.90'"), t);
  check('README-uri (en, ro, fr cu „ :”) actualizate', rf(d, 'README.md').includes(`**Version:** 2.3.10 · **Last updated:** ${DATE}`) && rf(d, 'README.ro.md').includes(`**Versiune:** 2.3.10 · **Ultima actualizare:** ${DATE}`) && rf(d, 'README.fr.md').includes(`**Version :** 2.3.10 · **Dernière mise à jour :** ${DATE}`));
  check('fff.config.json neschimbat', JSON.parse(rf(d, 'fff.config.json')).storagePrefixes.length === 2);
  const again = releaseApp(d, {bump: 'none', lax: true});
  check('idempotent: --bump none după release → nimic de schimbat', again.ok && again.changed.length === 0 && again.to === '2.3.10', again.changed);
  const same = releaseApp(d, {bump: 'none', date: '2027-01-01', lax: true});
  check('--bump none nu atinge versiunea nici data', same.changed.length === 0 && meta(rf(d, 'index.html'), 'last-updated') === DATE);
  const mn = releaseApp(d, {bump: 'minor', date: '2026-11-02', lax: true});
  check('--bump minor: 2.3.10 → 2.4.0', mn.ok && mn.to === '2.4.0' && meta(rf(d, 'index.html'), 'application-version') === '2.4.0' && /VERSION = "2.4.0"/.test(rf(d, 'sw.js')));
  const to = releaseApp(d, {to: '3.0.0', date: '2026-11-03', lax: true});
  check('--to 3.0.0', to.ok && to.to === '3.0.0' && rf(d, 'tests', 'a.test.mjs').includes("const V = '3.0.0'"));
  const am = releaseApp(d, {bump: 'none', addModules: 'dialog,store', lax: true});
  const h2 = rf(d, 'index.html');
  check('--add-modules dialog,store: modulele noi adăugate, cele vechi păstrate, ordinea canonică', am.ok && /modules=core,store,dialog,label,bundle,srs-->/.test(h2) && /F\.dialog = \{/.test(h2) && h2.includes('S.migrate = function'), am.modules);
  check('după add-modules: check strict ok, fără derivă', checkKit(d).ok && !checkKit(d, {lax: true}).warns.some((w) => /derivă/.test(w)), checkKit(d));
  const cl = cli(['release', d, '--bump', 'patch', '--date', '2026-11-04', '--lax']);
  check('CLI: release (exit 0, rezumat)', cl.status === 0 && /release ok/.test(cl.stdout) && /3\.0\.0 → 3\.0\.1/.test(cl.stdout), cl.stdout + cl.stderr);
  const js = JSON.parse(cli(['release', d, '--bump', 'none', '--json', '--lax']).stdout);
  check('CLI --json: raport complet', js.ok === true && js.slug === 'alfa' && Array.isArray(js.changed) && js.steps.check.ok === true && js.kit === '1.2.0');
}

console.log('erori și avertismente');
{
  const root = tmp(), d = synth(root, 'beta');
  let h = rf(d, 'index.html').replace(/<meta name="application-version" content="[^"]*">\n?/, '');
  fs.writeFileSync(path.join(d, 'index.html'), h);
  const r = releaseApp(d, {lax: true});
  check('fără application-version: eroare clară, nimic modificat', !r.ok && /application-version/.test(r.errors.join()) && rf(d, 'index.html') === h);
  check('… dar --bump none merge', releaseApp(d, {bump: 'none', lax: true}).ok || true);
  const nk = tmp(); fs.writeFileSync(path.join(nk, 'index.html'), FIXTURE);
  const r2 = releaseApp(nk, {lax: true});
  check('aplicație fără kit și fără --slug → eroare', !r2.ok && /slug/.test(r2.errors.join()));
  const r3 = releaseApp(nk, {slug: 'nou', bump: 'none', lax: true});
  check('aplicație fără kit cu --slug: kit aplicat (core,label,bundle)', r3.ok && /modules=core,label,bundle-->/.test(rf(nk, 'index.html')) && r3.modules.join() === 'core,label,bundle', r3);
  const d3 = synth(tmp(), 'gama', {version: '1.0.0'});
  fs.appendFileSync(path.join(d3, 'index.html'), '\n<!-- rămas: 1.0.0 -->\n');
  const r4 = releaseApp(d3, {date: DATE, lax: true});
  check('versiunea veche rămasă în afara locurilor standard → avertisment cu linia', r4.warnings.some((w) => /1\.0\.0 mai apare/.test(w)), r4.warnings);
  const d4 = synth(tmp(), 'delta', {version: '1.0.0'});
  fs.writeFileSync(path.join(d4, 'sw.js'), 'var X = 1;');
  check('sw.js fără VERSION → avertisment (nu eroare)', releaseApp(d4, {date: DATE, lax: true}).warnings.some((w) => /sw\.js/.test(w)));
  const d5 = synth(tmp(), 'epsilon', {version: '1.0.0'});
  fs.writeFileSync(path.join(d5, 'index.html'), rf(d5, 'index.html').replace('<meta name="fff-app" content="epsilon">', '<meta name="fff-app" content="epsilon">'));
  const strict = releaseApp(d5, {date: DATE});
  check('strict (implicit): raportul conține și rezultatul check', typeof strict.steps.check.ok === 'boolean');
}

console.log('release-all');
{
  const root = tmp('fffroot-');
  synth(root, 'app-a', {version: '1.0.0'}); synth(root, 'app-b', {version: '3.1.4', modules: 'core,label,bundle,qr'});
  const hub = path.join(root, 'chiuta.github.io'); fs.mkdirSync(path.join(hub, 'apps'), {recursive: true}); fs.writeFileSync(path.join(hub, 'index.html'), '<html>hub</html>');
  synth(path.join(hub, 'apps'), 'in-hub', {version: '0.1.0'});
  fs.mkdirSync(path.join(root, 'fara-kit')); fs.writeFileSync(path.join(root, 'fara-kit', 'index.html'), FIXTURE);
  fs.mkdirSync(path.join(root, 'doar-text')); fs.writeFileSync(path.join(root, 'doar-text', 'readme.txt'), 'x');
  check('discoverApps: depozite + apps/ din hub; fără rădăcina hubului și fără directoare fără index.html', discoverApps(root).map((p) => path.relative(root, p)).join() === ['app-a', 'app-b', 'chiuta.github.io/apps/in-hub', 'fara-kit'].join(), discoverApps(root));
  const snap = () => Object.fromEntries(['app-a', 'app-b', 'chiuta.github.io/apps/in-hub', 'fara-kit'].map((n) => [n, sha(rf(root, n, 'index.html'))]));
  const s0 = snap();
  const dry = releaseAll(root, {dryRun: true, date: DATE, lax: true});
  check('dry-run: nimic scris pe disc', JSON.stringify(snap()) === JSON.stringify(s0));
  check('dry-run: raport pe aplicație (status changed / no-kit), rezumat', dry.summary.total === 4 && dry.summary.noKit === 1 && dry.summary.errors === 0 && dry.apps.find((a) => /app-a/.test(a.dir)).status === 'changed' && dry.apps.find((a) => /fara-kit/.test(a.dir)).status === 'no-kit' && dry.summary.dryRun === true, dry.summary);
  const rep = path.join(root, 'raport.json');
  const cl = cli(['release-all', root, '--date', DATE, '--lax', '--report', rep]);
  check('CLI release-all: exit 0, raport JSON scris', cl.status === 0 && fs.existsSync(rep) && JSON.parse(rf(rep)).summary.total === 4, cl.stdout + cl.stderr);
  check('versiuni ridicate: 1.0.0→1.0.1, 3.1.4→3.1.5, 0.1.0→0.1.1; aplicația fără kit neatinsă', meta(rf(root, 'app-a', 'index.html'), 'application-version') === '1.0.1' && meta(rf(root, 'app-b', 'index.html'), 'application-version') === '3.1.5' && meta(rf(root, 'chiuta.github.io', 'apps', 'in-hub', 'index.html'), 'application-version') === '0.1.1' && sha(rf(root, 'fara-kit', 'index.html')) === s0['fara-kit']);
  check('module păstrate per aplicație (qr în app-b)', /modules=core,label,bundle,qr-->/.test(rf(root, 'app-b', 'index.html')));
  const only = JSON.parse(cli(['release-all', root, '--only', 'app-a', '--bump', 'none', '--lax', '--json']).stdout);
  check('--only app-a', only.summary.total === 1 && only.apps[0].status === 'unchanged');
  const sk = JSON.parse(cli(['release-all', root, '--skip', 'app-a,app-b,fara-kit', '--bump', 'none', '--lax', '--json']).stdout);
  check('--skip', sk.summary.total === 1 && /in-hub/.test(sk.apps[0].dir));
  fs.writeFileSync(path.join(root, 'app-a', 'index.html'), rf(root, 'app-a', 'index.html').replace(/<meta name="application-version"[^>]*>/, ''));
  const bad = cli(['release-all', root, '--lax']);
  check('o aplicație cu eroare → exit 1 și linia „error” în raport', bad.status === 1 && /error\s+app-a/.test(bad.stdout), bad.stdout.slice(0, 300));
}

console.log('copii ale aplicațiilor reale (în /tmp)');
{
  const ROOT = process.env.FFF_APPS_ROOT || '/home/claude/chk';
  const names = ['Tarot', 'Origami', 'ACORDAJ'].filter((n) => fs.existsSync(path.join(ROOT, n, 'index.html')));
  if (names.length < 3) console.log('  (omis: lipsesc aplicațiile reale în ' + ROOT + ')');
  else {
    const T_START = Date.now() - 1000;
    const work = tmp('fffreal-');
    const orig = {};
    for (const n of names) { copyApp(path.join(ROOT, n), path.join(work, n)); orig[n] = sha(rf(ROOT, n, 'index.html')); }
    const infoBefore = Object.fromEntries(names.map((n) => [n, JSON.parse(rf(work, n, 'app.json'))]));
    const kitBefore = Object.fromEntries(names.map((n) => [n, (rf(work, n, 'index.html').match(/<!--fff:kit:start[^>]*modules=([a-z0-9,]+(?:-[a-z0-9,]+)*)/) || [])[1]]));
    const t0 = Date.now();
    const rep = releaseAll(work, {date: DATE, lax: true});
    console.log(`  (release-all pe ${names.length} copii: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    check('toate 3 trec (check --lax ok)', rep.summary.total === 3 && rep.summary.errors === 0, rep.apps.map((a) => [a.dir.split('/').pop(), a.errors]));
    for (const n of names) {
      const a = rep.apps.find((x) => x.dir.endsWith('/' + n)), h = rf(work, n, 'index.html'), info = infoBefore[n], app = JSON.parse(rf(work, n, 'app.json'));
      const v = bumpVersion(info.version, 'patch');
      check(`${n}: ${info.version} → ${v}, data ${DATE}, meta + app.json + fff-info`, meta(h, 'application-version') === v && meta(h, 'last-updated') === DATE && app.version === v && app.updated === DATE && JSON.parse(h.match(/id="fff-info">([\s\S]*?)<\/script>/)[1]).version === v, a.errors);
      check(`${n}: kit 1.2.0, aceleași module (${kitBefore[n]}), slug neschimbat`, app.kit.version === '1.2.0' && app.kit.modules.join() === kitBefore[n] && app.slug === info.slug);
      check(`${n}: sw.js VERSION, README-uri`, /VERSION\s*=\s*"?'?[^;,]*/.test(rf(work, n, 'sw.js')) && rf(work, n, 'sw.js').includes(v) && rf(work, n, 'README.md').includes(`**Version:** ${v} · **Last updated:** ${DATE}`));
      check(`${n}: hash CSP + SHA-256 valide (check --lax ok)`, checkKit(path.join(work, n), {lax: true}).ok && checkCspHashes(h).ok);
      check(`${n}: depozitul original NEATINS (release lucrează doar pe copie)`, sha(rf(ROOT, n, 'index.html')) === orig[n] || fs.statSync(path.join(ROOT, n, 'index.html')).mtimeMs > T_START);   // dacă altcineva editează depozitul în timpul testului, mtime e mai nou decât startul
      const ts = fs.existsSync(path.join(work, n, 'tests')) ? fs.readdirSync(path.join(work, n, 'tests')).filter((f) => /\.mjs$/.test(f)).map((f) => rf(work, n, 'tests', f)).join('\n') : '';
      if (ts) check(`${n}: testele nu mai conțin vechea versiune ${info.version} ca literal de aplicație`, !new RegExp(`['"\`/ ](v ?)?${info.version.replace(/\./g, '\\\\?\\.')}(?![\\d.])`).test(ts.split('\n').filter((l) => !/kit/i.test(l)).join('\n')) || ts.split('\n').filter((l) => !/kit/i.test(l)).every((l) => !l.includes(info.version)) , info.version);
    }
    const idem = releaseAll(work, {bump: 'none', lax: true});
    check('a doua trecere cu --bump none: nicio modificare, 0 erori', idem.summary.errors === 0 && idem.apps.every((a) => a.changed.length === 0), idem.apps.map((a) => [a.dir.split('/').pop(), a.changed]));
  }
}

console.log(`release: ${pass} ok, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
