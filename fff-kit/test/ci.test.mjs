// Teste CI (kit 1.2.0): workflow reutilizabil, șablon caller, tools/add-ci.mjs, ci/axe-check.mjs, logica de „derivă”. Rulare: node test/ci.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyKit, runInfo} from '../build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, '..');
const FIXTURE = fs.readFileSync(path.join(HERE, 'fixture.html'), 'utf8');
let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 500) : '')); } };
const tmp = (p = 'fffci-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const rf = (...p) => fs.readFileSync(path.join(...p), 'utf8');

function yaml(file) {
  const r = spawnSync('python3', ['-c', 'import sys,json,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf8"))))', file], {encoding: 'utf8'});
  if (r.status !== 0) return null;
  return JSON.parse(r.stdout);
}
const hasYaml = spawnSync('python3', ['-c', 'import yaml'], {encoding: 'utf8'}).status === 0;

console.log('workflow reutilizabil (ci/fff-check.yml)');
{
  const raw = rf(KIT, 'ci', 'fff-check.yml');
  const y = hasYaml ? yaml(path.join(KIT, 'ci', 'fff-check.yml')) : null;
  if (!hasYaml) console.log('  (PyYAML lipsește: verificări structurale pe text)');
  const on = y ? (y.on || y[true]) : null;
  check('YAML valid', !hasYaml || y !== null);
  check('declanșator: workflow_call (reutilizabil)', y ? !!on.workflow_call : /^\s{2}workflow_call:/m.test(raw));
  const inputs = y ? on.workflow_call.inputs : null;
  check('intrări: app-dir, kit-repo, kit-ref, lax, drift, run-tests, test-glob, axe, versiuni', y ? ['app-dir', 'kit-repo', 'kit-ref', 'lax', 'drift', 'run-tests', 'test-glob', 'axe', 'node-version', 'playwright-version', 'axe-version'].every((k) => inputs[k]) : /app-dir:[\s\S]*kit-ref:[\s\S]*lax:/.test(raw));
  check('strict implicit (lax: false), derivă activă, teste active, axe activ', y ? inputs.lax.default === false && inputs.drift.default === true && inputs['run-tests'].default === true && inputs.axe.default === true : /lax:[\s\S]{0,200}default: false/.test(raw));
  check('permisiuni minime: contents: read; fără secrete', y ? y.permissions.contents === 'read' : /permissions:\s*\n\s+contents: read/.test(raw));
  check('fără ${{ secrets.* }} și fără pull_request_target', !/secrets\./.test(raw) && !/pull_request_target/.test(raw));
  const steps = y ? y.jobs.check.steps : [];
  const text = y ? JSON.stringify(steps) : raw;
  check('pași: checkout aplicație + checkout kit (hub), setup-node', /actions\/checkout@v4/.test(text) && /repository/.test(text) && /actions\/setup-node@v4/.test(text) && (text.match(/actions\/checkout@v4/g) || []).length >= 2);
  check('rulează build.mjs check (strict, --lax condiționat)', /build\.mjs\\?"? check/.test(text) || /build\.mjs" check/.test(raw));
  check('derivă: release --dry-run --bump none', /release[^\n]*--dry-run --bump none/.test(raw) || /release[^"]*--dry-run --bump none/.test(text));
  check('Playwright + axe-core instalate (npm --no-save) și chromium (--with-deps)', /npm install --no-save[^\n]*playwright@/.test(raw) && /playwright install --with-deps chromium/.test(raw));
  check('variabile pentru teste portabile: CHROMIUM_PATH, FFF_AXE, AXE_PATH', /CHROMIUM_PATH/.test(raw) && /FFF_AXE/.test(raw) && /AXE_PATH/.test(raw));
  check('testele aplicației (glob) și axe-check.mjs', /TEST_GLOB/.test(raw) && /ci\/axe-check\.mjs/.test(raw));
  check('acțiunile cu eșec propagă codul de ieșire (set -o pipefail / exit $fail)', /pipefail/.test(raw) && /exit \$fail/.test(raw));
  check('referințe externe doar actions/* (fără script-uri descărcate cu curl|sh)', !/curl[^\n]*\|\s*(ba)?sh/.test(raw) && (raw.replace(/^\s*#.*$/gm, '').match(/uses:\s*([^\s@]+)@/g) || []).every((u) => /actions\//.test(u)));
}

console.log('șablon caller (ci/caller.yml)');
{
  const raw = rf(KIT, 'ci', 'caller.yml');
  const y = hasYaml ? yaml(path.join(KIT, 'ci', 'caller.yml')) : null;
  check('YAML valid; apelează workflow-ul din hub', (!hasYaml || y !== null) && /uses: chiuta\/chiuta\.github\.io\/\.github\/workflows\/fff-check\.yml@main/.test(raw) && (!y || y.jobs.fff.uses === 'chiuta/chiuta.github.io/.github/workflows/fff-check.yml@main'));
  check('declanșatoare: push (main), pull_request, workflow_dispatch; permissions read', y ? (!!(y.on || y[true]).push && 'pull_request' in (y.on || y[true]) && 'workflow_dispatch' in (y.on || y[true]) && y.permissions.contents === 'read') : true);
  check('strict implicit în caller (lax: false)', y ? y.jobs.fff.with.lax === false : /lax: false/.test(raw));
}

console.log('tools/add-ci.mjs');
{
  const ADD = path.join(KIT, 'tools', 'add-ci.mjs');
  const run = (...a) => spawnSync('node', [ADD, ...a], {encoding: 'utf8'});
  const root = tmp('fffroot-');
  for (const n of ['app-a', 'app-b']) { fs.mkdirSync(path.join(root, n, '.git'), {recursive: true}); fs.writeFileSync(path.join(root, n, 'index.html'), FIXTURE); }
  fs.mkdirSync(path.join(root, 'sub-dir')); fs.writeFileSync(path.join(root, 'sub-dir', 'notes.txt'), 'x');
  const hub = path.join(root, 'chiuta.github.io'); fs.mkdirSync(path.join(hub, 'apps', 'in-hub'), {recursive: true}); fs.writeFileSync(path.join(hub, 'apps', 'in-hub', 'index.html'), FIXTURE);
  const wf = (n) => path.join(root, n, '.github', 'workflows', 'fff-check.yml');
  const d = run(root, '--dry-run');
  check('dry-run: nimic scris', d.status === 0 && !fs.existsSync(wf('app-a')) && /would-be-created/.test(d.stdout), d.stdout + d.stderr);
  const r = run(root, '--json');
  const js = JSON.parse(r.stdout);
  check('scrie .github/workflows/fff-check.yml în fiecare depozit (= caller.yml)', fs.existsSync(wf('app-a')) && rf(wf('app-a')) === rf(KIT, 'ci', 'caller.yml') && fs.existsSync(wf('app-b')), js);
  check('omite aplicațiile din hub (fără depozit propriu) și directoarele fără index.html', js.rows.some((x) => /omis/.test(x.status) && /in-hub/.test(x.target)) && !fs.existsSync(path.join(root, 'sub-dir', '.github')) && !fs.existsSync(path.join(hub, 'apps', 'in-hub', '.github')));
  check('nu rulează git: nu creează/atinge .git (conținutul .git neschimbat)', fs.readdirSync(path.join(root, 'app-a', '.git')).length === 0);
  const again = JSON.parse(run(root, '--json').stdout);
  check('a doua rulare: unchanged', again.rows.filter((x) => x.status === 'unchanged').length === 2);
  fs.writeFileSync(wf('app-a'), '# modificat de mână\n');
  const ex = JSON.parse(run(root, '--json').stdout);
  check('fișier existent diferit: nu se suprascrie fără --force', rf(wf('app-a')) === '# modificat de mână\n' && ex.rows.some((x) => /^exists/.test(x.status)));
  run(root, '--force', '--lax', '--kit-ref', 'fff-kit-1.2.0', '--app-dir', 'app');
  const t = rf(wf('app-a'));
  check('--force --lax --kit-ref --app-dir: valorile intră în caller', /lax: true/.test(t) && /kit-ref: 'fff-kit-1\.2\.0'/.test(t) && /app-dir: 'app'/.test(t), t);
  if (hasYaml) { const y = yaml(wf('app-a')); check('callerul personalizat rămâne YAML valid cu valorile corecte', y && y.jobs.fff.with.lax === true && y.jobs.fff.with['kit-ref'] === 'fff-kit-1.2.0' && y.jobs.fff.with['app-dir'] === 'app', y); }
  const hubRun = run('--hub', hub, '--json');
  check('--hub: instalează workflow-ul reutilizabil în hub/.github/workflows/fff-check.yml', rf(hub, '.github', 'workflows', 'fff-check.yml') === rf(KIT, 'ci', 'fff-check.yml'), hubRun.stdout);
  const direct = tmp('fffdirect-'); fs.mkdirSync(path.join(direct, '.git')); fs.writeFileSync(path.join(direct, 'index.html'), FIXTURE);
  run(direct);
  check('un depozit dat direct primește workflow-ul', fs.existsSync(path.join(direct, '.github', 'workflows', 'fff-check.yml')));
  check('fără argumente → cod 2', run().status === 2);
}

console.log('logica de derivă (release --dry-run --bump none)');
{
  const d = tmp(); fs.writeFileSync(path.join(d, 'index.html'), FIXTURE.replace('<meta name="viewport"', '<meta name="fff-app-x" content="1"><meta name="viewport"'));
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({storagePrefixes: ['demo-fff.', 'fx.']}));
  applyKit(d, {slug: 'demo-fff', modules: 'core,label,bundle'}); runInfo(d, {slug: 'demo-fff'});
  const drift = () => { const r = spawnSync('node', [path.join(KIT, 'build.mjs'), 'release', d, '--dry-run', '--bump', 'none', '--json', '--lax'], {encoding: 'utf8'}); const j = JSON.parse(r.stdout); return j.changed.filter((f) => /^(index\.html|app\.json)$/.test(f)); };
  check('pagină curentă: fără derivă (index.html/app.json neschimbate)', drift().length === 0, drift());
  fs.writeFileSync(path.join(d, 'index.html'), rf(d, 'index.html').replace('var SCHEMA = 1,', 'var SCHEMA = 1, /* editat */'));
  check('bloc kit modificat → derivă detectată (index.html)', drift().includes('index.html'));
}

console.log('ci/axe-check.mjs');
{
  const AX = path.join(KIT, 'ci', 'axe-check.mjs');
  const env = {...process.env, NODE_PATH: [process.env.NODE_PATH, '/opt/node-tools/node_modules', '/home/claude/pw/node_modules'].filter(Boolean).join(':'), PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || (fs.existsSync('/opt/pw-browsers') ? '/opt/pw-browsers' : '')};
  const good = tmp(); fs.writeFileSync(path.join(good, 'index.html'), FIXTURE); fs.writeFileSync(path.join(good, 'fff.config.json'), JSON.stringify({storagePrefixes: ['demo-fff.', 'fx.']}));
  applyKit(good, {slug: 'demo-fff', modules: 'core,label,bundle'}); runInfo(good, {slug: 'demo-fff'});
  const r = spawnSync('node', [AX, good], {encoding: 'utf8', env, timeout: 200000});
  check('pagină curată (cu dialogul Transparență): 0 violări în 8 scenarii, exit 0', r.status === 0 && /axe: 0 violări în 8 scenarii/.test(r.stdout), r.stdout + r.stderr);
  check('raportează dialogul Transparență la 360 și 1366 px, luminos și întunecat', ['light', 'dark'].every((s) => ['1366x800', '360x740'].every((v) => new RegExp(`ok\\s+${s}\\s+${v}\\s+dialog Transparență`).test(r.stdout))), r.stdout);
  const bad = tmp(); fs.writeFileSync(path.join(bad, 'index.html'), FIXTURE.replace('<h1>Demo FFF</h1>', '<h1>Demo FFF</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'));
  fs.writeFileSync(path.join(bad, 'fff.config.json'), '{}');
  applyKit(bad, {slug: 'demo-fff', modules: 'core,label,bundle'});
  const rb = spawnSync('node', [AX, bad, '--json'], {encoding: 'utf8', env, timeout: 200000});
  const jb = rb.status === 1 ? JSON.parse(rb.stdout) : [];
  check('pagină cu <img> fără alt: exit 1, violarea image-alt raportată', rb.status === 1 && jb.some((x) => x.violations.some((v) => v.id === 'image-alt')), rb.stdout.slice(0, 200) + rb.stderr.slice(0, 200));
  const ra = spawnSync('node', [AX, bad, '--allow', 'image-alt'], {encoding: 'utf8', env, timeout: 200000});
  check('--allow image-alt → exit 0', ra.status === 0, ra.stdout.slice(-200));
  check('fără argumente → cod 2', spawnSync('node', [AX], {encoding: 'utf8', env}).status === 2);
}

console.log(`ci: ${pass} ok, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
