// Teste tools/portable-tests.mjs (kit 1.2.0): transformări, idempotență, diff, sintaxă, execuție reală a unui test transformat; pe 5 copii din /tmp (NU atinge depozitele).
// Rulare: node test/portable-tests.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {portableTransform, portableApp} from '../tools/portable-tests.mjs';
import {releaseApp} from '../lib/release.mjs';
import {applyKit, runInfo} from '../build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, '..', 'tools', 'portable-tests.mjs');
const FIXTURE = fs.readFileSync(path.join(HERE, 'fixture.html'), 'utf8');
let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } };
const tmp = (p = 'fffpt-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const T = (code, ctx = {}) => portableTransform(code, ctx);

console.log('transformări (unitar)');
check('executablePath cu literal /opt/pw-browsers/… → CHROMIUM_PATH || undefined (toate variantele)', ["executablePath: '/opt/pw-browsers/chromium'", 'executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"', 'executablePath:"/opt/pw-browsers/chromium"'].every((c) => T(`chromium.launch({${c}, args: []})`).code === 'chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: []})'.replace('executablePath: ', c.includes('executablePath:"') ? 'executablePath:' : 'executablePath: ')));
check('process.env.CHROME || \'/opt/…\' păstrează variabila, adaugă CHROMIUM_PATH și undefined', T("launch({executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: A})").code === 'launch({executablePath: process.env.CHROMIUM_PATH || process.env.CHROME || undefined, args: A})');
check('process.env.CHROMIUM_PATH singur → cu rezervă undefined', T('launch({executablePath: process.env.CHROMIUM_PATH})').code === 'launch({executablePath: process.env.CHROMIUM_PATH || undefined})');
check('constantă cu cale Chromium în altă parte', T("const CH = '/opt/pw-browsers/chromium'; launch({executablePath: CH})").code === 'const CH = (process.env.CHROMIUM_PATH || undefined); launch({executablePath: CH})');
check('createRequire(/opt/node-tools…) și variantele /home/claude/pw și PW_ROOT', ["createRequire('/opt/node-tools/package.json')", 'createRequire("/home/claude/pw/package.json")', "createRequire(process.env.PW_ROOT || '/opt/node-tools/package.json')"].every((c) => T(`const require = ${c};`).code === 'const require = createRequire(process.env.PW_ROOT || import.meta.url);'));
const ax = T("import fs from 'node:fs';\nconst AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928/scratchpad/sweep/node_modules/axe-core/axe.min.js';\nfs.readFileSync(AXE);");
check('axe: literalul din /tmp → __fffAxe() (AXE_PATH rămâne prioritar), ajutor inserat o singură dată', /process\.env\.AXE_PATH \|\| __fffAxe\(\);/.test(ax.code) && (ax.code.match(/const __fffAxe =/g) || []).length === 1 && !/\/tmp\/claude/.test(ax.code) && ax.code.includes('[fff-portable]'));
const ctx = {version: '2.3.9', updated: '2026-10-22', kitVersion: '1.2.0'};
const vv = T([
  "const a = '2.3.9';", 'const b = "v 2.3.9 · 2026-10-22";', 'const c = `x ${y} 2.3.9`;', 'const d = /2\\.3\\.9/;', 'const e = /v ?2\\.3\\.9 · 2026-10-22/g;',
  "ok(info.kit.version === '1.2.0');", "const f = '12.3.9', g = '2.3.90', h = 'versiunea 2.3.9.1';", "// comentariu cu 2.3.9", "const s = 'u\\'2.3.9';", "const big = 'updated 2026-10-22';", "const other = '2026-10-22';",
].join('\n'), ctx);
check('versiune: șir întreg → __FFF_APP.version', vv.code.includes('const a = __FFF_APP.version;'));
check('versiune + dată în șir cu text → șablon', vv.code.includes('const b = `v ${__FFF_APP.version} · ${__FFF_APP.updated}`;'));
check('șablon existent → interpolare', vv.code.includes('const c = `x ${y} ${__FFF_APP.version}`;'));
check('regex → new RegExp(String.raw`…`) cu escapare', vv.code.includes('const d = new RegExp(String.raw`${__fffRe(__FFF_APP.version)}`);') && vv.code.includes('const e = new RegExp(String.raw`v ?${__fffRe(__FFF_APP.version)} · ${__fffRe(__FFF_APP.updated)}`, \'g\');'));
check('versiunea kitului (pe linii despre kit) din app.json → kit.version', vv.code.includes("ok(info.kit.version === __FFF_APP.kit.version);"));
check('numerele asemănătoare (12.3.9, 2.3.90, 2.3.9.1), comentariile și literalii cu escape-uri rămân neatinse; escape-urile → „manual”', vv.code.includes("const f = '12.3.9', g = '2.3.90', h = 'versiunea 2.3.9.1';") && vv.code.includes('// comentariu cu 2.3.9') && vv.manual.length === 1 && /escape/.test(vv.manual[0].why));
check('data simplă: înlocuită doar pe linii despre dată („updated”), nu oriunde', vv.code.includes("const big = `updated ${__FFF_APP.updated}`;") && vv.code.includes("const other = '2026-10-22';"));
check('ajutorul __FFF_APP inserat o singură dată, după comentariile de la început', (vv.code.match(/const __FFF_APP =/g) || []).length === 1);
check('idempotent: a doua rulare nu mai schimbă nimic', (() => { const r2 = T(vv.code, ctx); return r2.code === vv.code && r2.changes.length === 0; })() && T(ax.code).code === ax.code);
check('căi absolute rămase sunt raportate, nu schimbate', (() => { const r = T("const f = '/home/claude/x/y.js'; const t = '/tmp/claude-0/zz';"); return r.remaining.length === 2 && r.code.includes('/home/claude/x/y.js'); })());
check('cod fără nimic de portat: neatins', (() => { const s = "import fs from 'node:fs';\nconst x = 1;\n"; return T(s, ctx).code === s; })());

console.log('aplicații sintetice');
const genTest = (ver, date) => [
  "// Rulare: node tests/v.test.mjs",
  "import fs from 'node:fs';",
  "const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');",
  `const m = (n) => (html.match(new RegExp('<meta name="' + n + '" content="([^"]*)"')) || [])[1];`,
  "let bad = 0; const ok = (c, n) => { if (!c) { bad++; console.log('FAIL ' + n); } };",
  `ok(m('application-version') === '${ver}', 'versiune');`,
  `ok(/v ?${ver.replace(/\./g, '\\.')} · ${date}/.test(html), 'subsol');`,
  `ok(m('last-updated') === "${date}", 'dată');`,
  "console.log('v.test: ' + (bad ? 'EȘUAT' : 'ok')); process.exit(bad ? 1 : 0);",
  '',
].join('\n');

function synth(root, name, ver, date) {
  const d = path.join(root, name); fs.mkdirSync(path.join(d, 'tests'), {recursive: true});
  fs.writeFileSync(path.join(d, 'index.html'), FIXTURE.replace('content="1.2.3"', `content="${ver}"`).replace('content="2026-10-14"', `content="${date}"`).replace('v 1.2.3 · 2026-10-14', `v ${ver} · ${date}`));
  applyKit(d, {slug: name, modules: 'core,label,bundle'}); runInfo(d, {slug: name});
  fs.writeFileSync(path.join(d, 'tests', 'v.test.mjs'), genTest(ver, date));
  return d;
}
{
  const root = tmp(), d = synth(root, 'pt-sint', '4.5.6', '2026-10-20');
  const run = () => spawnSync('node', [path.join(d, 'tests', 'v.test.mjs')], {encoding: 'utf8'});
  check('testul hard-codat trece înainte', run().status === 0, run().stdout);
  releaseApp(d, {date: '2026-11-01', lax: true, tests: false});   // ridică versiunea fără a atinge testele
  check('după un release fără bump în teste: testul hard-codat PICĂ (problema)', run().status === 1);
  fs.writeFileSync(path.join(d, 'tests', 'v.test.mjs'), genTest('4.5.7', '2026-11-01'));
  check('(pregătire) testul aliniat la versiunea curentă trece', run().status === 0, run().stdout);
  const rep = portableApp(d, {write: true, versions: true});
  check('portableApp --write: fișierul rescris, citește app.json', rep.changed === 1 && fs.readFileSync(path.join(d, 'tests', 'v.test.mjs'), 'utf8').includes('__FFF_APP.version'));
  check('testul transformat trece', run().status === 0, run().stdout + run().stderr);
  releaseApp(d, {date: '2026-11-15', lax: true, tests: false});   // versiune nouă, testele NU sunt atinse de release
  check('după încă un release (teste neatinse): testul portabil trece în continuare — versiunea vine din app.json', run().status === 0, run().stdout + run().stderr);
  check('a doua rulare: 0 fișiere de schimbat', portableApp(d, {write: true, versions: true}).changed === 0);
}

console.log('5 copii din /tmp (aplicații reale, dacă există)');
{
  const ROOT = process.env.FFF_APPS_ROOT || '/home/claude/chk';
  const cands = fs.existsSync(ROOT) ? fs.readdirSync(ROOT).filter((n) => fs.existsSync(path.join(ROOT, n, 'tests')) && fs.existsSync(path.join(ROOT, n, 'app.json')) && fs.readdirSync(path.join(ROOT, n, 'tests')).some((f) => f.endsWith('.mjs'))).sort() : [];
  // preferă cele cu versiuni hard-codate în teste
  const pick = [...cands.filter((n) => fs.readdirSync(path.join(ROOT, n, 'tests')).some((f) => { if (!fs.statSync(path.join(ROOT, n, 'tests', f)).isFile()) return false; const t = fs.readFileSync(path.join(ROOT, n, 'tests', f), 'utf8'); const v = JSON.parse(fs.readFileSync(path.join(ROOT, n, 'app.json'), 'utf8')).version; return t.includes(v); })), ...cands].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5);
  if (pick.length < 5) console.log('  (omis: sub 5 aplicații cu teste în ' + ROOT + ')');
  else {
    const work = tmp('fffpt5-'), T0 = Date.now() - 1000;
    const origSnap = {};
    const hashDir = (dir) => fs.readdirSync(path.join(dir, 'tests')).map((f) => f + ':' + fs.statSync(path.join(dir, 'tests', f)).mtimeMs).join('|');
    for (const n of pick) {
      fs.mkdirSync(path.join(work, n, 'tests'), {recursive: true});
      for (const f of fs.readdirSync(path.join(ROOT, n, 'tests'))) if (fs.statSync(path.join(ROOT, n, 'tests', f)).isFile()) fs.copyFileSync(path.join(ROOT, n, 'tests', f), path.join(work, n, 'tests', f));
      fs.copyFileSync(path.join(ROOT, n, 'app.json'), path.join(work, n, 'app.json'));
      origSnap[n] = hashDir(path.join(ROOT, n));
    }
    const dry = spawnSync('node', [TOOL, ...pick.map((n) => path.join(work, n))], {encoding: 'utf8'});
    check(`dry-run pe ${pick.length} copii: arată diff-ul, nu scrie`, dry.status === 0 && /^--- a\/tests\//m.test(dry.stdout) && /de rescris \(dry-run/.test(dry.stdout), dry.stderr);
    console.log(dry.stdout.split('\n').filter((l) => /^(#|\+[^+]|-[^-])/.test(l)).slice(0, 14).map((l) => '      ' + l.slice(0, 150)).join('\n'));
    const before = Object.fromEntries(pick.map((n) => [n, fs.readdirSync(path.join(work, n, 'tests')).map((f) => fs.readFileSync(path.join(work, n, 'tests', f), 'utf8')).join('\0')]));
    check('dry-run: fișierele din copii neschimbate', pick.every((n) => before[n] === fs.readdirSync(path.join(work, n, 'tests')).map((f) => fs.readFileSync(path.join(work, n, 'tests', f), 'utf8')).join('\0')));
    const w = spawnSync('node', [TOOL, '--write', '--quiet', ...pick.map((n) => path.join(work, n))], {encoding: 'utf8'});
    check('--write: rescrie', w.status === 0 && /rescrise: \d+ fișiere/.test(w.stdout), w.stdout.slice(-300));
    let syn = 0, opt = 0, ax = 0, ver = 0, nodeSide = [];
    for (const n of pick) for (const f of fs.readdirSync(path.join(work, n, 'tests')).filter((x) => x.endsWith('.mjs'))) {
      const p = path.join(work, n, 'tests', f), t = fs.readFileSync(p, 'utf8');
      const c = spawnSync('node', ['--check', p], {encoding: 'utf8'});
      if (c.status !== 0) nodeSide.push([n + '/' + f, c.stderr.slice(0, 200)]);
      if (t.split('\n').filter((l) => !/^\s*\/\//.test(l)).some((l) => /\/opt\/pw-browsers|\/opt\/node-tools|\/home\/claude\/pw\/|\/tmp\/claude-0[^'"]*axe/.test(l))) opt++;
      if (t.includes('__FFF_APP')) ver++;
      if (t.includes('__fffAxe')) ax++;
      syn++;
    }
    check(`sintaxa tuturor celor ${syn} fișiere rescrise e validă (node --check)`, nodeSide.length === 0, nodeSide);
    check('nicio cale /opt/pw-browsers, /opt/node-tools sau axe din /tmp nu mai rămâne în cod (în afara comentariilor)', opt === 0, opt);
    console.log(`    (fișiere cu axe portabil: ${ax}, cu versiune din app.json: ${ver})`);
    const again = spawnSync('node', [TOOL, '--json', ...pick.map((n) => path.join(work, n))], {encoding: 'utf8'});
    check('a doua rulare: 0 fișiere de rescris (idempotent)', JSON.parse(again.stdout).every((r) => r.changed === 0), again.stdout.slice(0, 200));
    check('depozitele originale neatinse (mtime-ul fișierelor de test nu s-a schimbat)', pick.every((n) => hashDir(path.join(ROOT, n)) === origSnap[n]));
  }
}

console.log('CLI');
{
  check('fără argumente → cod 2', spawnSync('node', [TOOL], {encoding: 'utf8'}).status === 2);
  const d = tmp(); fs.mkdirSync(path.join(d, 'x')); fs.writeFileSync(path.join(d, 'x', 'index.html'), 'x');
  const r = spawnSync('node', [TOOL, path.join(d, 'x')], {encoding: 'utf8'});
  check('aplicație fără tests/ → notă, cod 0', r.status === 0 && /fără director tests/.test(r.stdout), r.stdout);
}

console.log(`portable-tests: ${pass} ok, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
