// Rulează TOATE testele autonome ale kitului, pe rând (mașina poate fi încărcată): node test/all.mjs [opțiuni]
//   --timeout=<secunde>   limita per test (implicit 900; 0 = fără limită)
//   --only=core,bundle    rulează doar testele numite (fără sufixul .test.mjs)
//   --skip=ephem,p2p      omite testele numite
//   --list                afișează testele fără a le rula
//   --fail-fast           se oprește la primul test eșuat
// Include fiecare test/*.test.mjs și testele de integrare autonome (ephem.browser.mjs, kit3-ui.mjs — acesta cere axe-core: FFF_AXE).
// Nu rulează utilitarele care cer argumente sau date externe: compat.mjs, quine.mjs, csp_sanity.mjs (vezi README) și pwa/test/*.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const timeout = (opt.timeout === undefined ? 900 : Number(opt.timeout)) * 1000;
const only = opt.only ? String(opt.only).split(',') : null, skip = new Set(opt.skip ? String(opt.skip).split(',') : []);
const AXE = process.env.FFF_AXE || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const tests = [
  ...fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => ({name: f.replace(/\.test\.mjs$/, ''), file: f})),
  {name: 'ephem.browser', file: 'ephem.browser.mjs'},
  {name: 'kit3-ui', file: 'kit3-ui.mjs', needs: AXE},
];
// ordinea: nucleul întâi (rapide), apoi restul
const first = ['core', 'label', 'bundle', 'build', 'hardening'];
tests.sort((a, b) => (first.indexOf(a.name) < 0 ? 99 : first.indexOf(a.name)) - (first.indexOf(b.name) < 0 ? 99 : first.indexOf(b.name)));
if (opt.list) { console.log(tests.map((t) => t.name).join('\n')); process.exit(0); }
let bad = 0, ran = 0;
const rows = [];
for (const t of tests) {
  if ((only && !only.includes(t.name)) || skip.has(t.name)) continue;
  if (t.needs && !fs.existsSync(t.needs)) { rows.push(`${t.name}: OMIS (lipsește ${t.needs})`); continue; }
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(here, t.file)], {encoding: 'utf8', timeout: timeout || undefined, maxBuffer: 64 * 1048576, stdio: ['ignore', 'pipe', 'pipe']});
  ran++;
  const out = (r.stdout || '').trim().split('\n'), secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.error && r.error.code === 'ETIMEDOUT') { bad++; rows.push(`${t.name}: EȘUAT — depășit timpul (${timeout / 1000}s)`); console.log(rows[rows.length - 1]); }
  else {
    rows.push(`${t.name}: ${r.status === 0 ? 'ok' : 'EȘUAT'} (${secs}s) — ${out[out.length - 1] || (r.stderr || '').trim().split('\n').pop()}`);
    console.log(rows[rows.length - 1]);
    if (r.status !== 0) { bad++; console.log((r.stdout || '').split('\n').filter((l) => /FAIL|✗|EȘUAT/.test(l)).slice(0, 30).join('\n')); if (r.stderr) console.log(r.stderr.split('\n').slice(-8).join('\n')); }
  }
  if (bad && opt['fail-fast']) break;
}
rows.filter((x) => /OMIS/.test(x)).forEach((x) => console.log(x));
console.log(`\n${ran} teste rulate, ${bad} eșuate`);
process.exit(bad ? 1 : 0);
