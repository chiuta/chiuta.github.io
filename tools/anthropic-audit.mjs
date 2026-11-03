#!/usr/bin/env node
// anthropic-audit — verifică, în toate aplicațiile, că apelurile către API-ul Anthropic folosesc locul central (tools/fff-ai.js).
//   node tools/anthropic-audit.mjs [--root DIR]... [--json]
//   Implicit: apps/ din hub + tools/ (envelope-adapters, nucleu). Pentru portofoliul complet: --root /calea/către/aplicații.
// Reguli (cod de ieșire 1 la prima încălcare):
//   1. În paginile HTML care conțin nucleul AI (`<script id="fff-mod-ai">`), NICIUN literal `anthropic-version` cu dată: versiunea vine din FFF.ai.ANTHROPIC_VERSION / FFF.ai.anthropicHeaders.
//   1b. Același lucru pentru opțiunea `version: "AAAA-LL-ZZ"` transmisă lui FFF.ai.run/stream/build.
//   2. În fișierele fără nucleu (ex. worker Cloudflare), literalul trebuie să fie egal cu FFF.ai.ANTHROPIC_VERSION.
//   3. Nicio pagină care apelează api.anthropic.com nu trimite `temperature`, `top_p` sau `top_k` către Anthropic (eliminate în 2026-10-21).
//      Euristică: în fișierele cu api.anthropic.com, parametrul nu apare într-un obiect JSON.stringify(...) de pe un rând care conține „anthropic” sau „max_tokens” fără „ollama/openai/google”.
//   4. Niciun id de model retras (FFF.ai.MODELS.retired) pe rânduri fără explicație (cuvintele „retras”, „retired”, „migrat”, „înlocuit”, „scos”).
//   5. Orice id `claude-…` folosit trebuie să fie cunoscut nucleului (active/legacy/retrase) — altfel e raportat ca „necunoscut” (avertisment, nu eroare).
// Nu citește chei și nu face cereri de rețea.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AI = createRequire(import.meta.url)(path.join(HUB, 'tools', 'fff-ai.js'));
const argv = process.argv.slice(2);
const roots = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--root') roots.push(path.resolve(argv[++i]));
if (!roots.length) roots.push(path.join(HUB, 'apps'), path.join(HUB, 'tools'));
const EXPLAIN = /retras|retired|migrat|înlocuit|inlocuit|scos|nu mai|elimin/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures', 'vendor', 'tests', 'demo']);
const EXT = /\.(html|js|mjs)$/;

function* walk(d, depth = 0) {
  if (depth > 3) return;
  let ents; try { ents = fs.readdirSync(d, {withFileTypes: true}); } catch { return; }
  for (const e of ents) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p, depth + 1);
    else if (EXT.test(e.name) && fs.statSync(p).size < 20e6) yield p;
  }
}

const findings = [], warnings = [], seen = [];
for (const root of roots) for (const f of walk(root)) {
  if (path.basename(f) === 'fff-ai.js') continue;   // sursa canonică
  let t = fs.readFileSync(f, 'utf8');
  if (!/anthropic|claude-/i.test(t)) continue;
  const hasCore = /<script id="fff-mod-ai">/.test(t);
  if (hasCore) t = t.replace(/<script id="fff-mod-ai">[\s\S]*?<\/script>/, (m) => m.replace(/[^\n]/g, ''));   // copia nucleului se verifică cu inject-shared --check
  t = t.replace(/<script type="application\/json" id="fff-info">[\s\S]*?<\/script>/, (m) => m.replace(/[^\n]/g, ''));   // app.json încorporat: gazde, nu cereri
  const rel = path.relative(HUB, f).startsWith('..') ? f : path.relative(HUB, f);
  const lines = t.split('\n');
  let calls = false;
  lines.forEach((ln, i) => {
    const at = `${rel}:${i + 1}`;
    for (const m of ln.matchAll(/anthropic-version['"]?\s*[:=\]]?\s*[,]?\s*['"](\d{4}-\d\d-\d\d)['"]/g)) {
      if (hasCore) findings.push(`${at}: literal anthropic-version ${m[1]} într-o pagină cu nucleul AI; folosește FFF.ai.anthropicHeaders / FFF.ai.ANTHROPIC_VERSION`);
      else if (m[1] !== AI.ANTHROPIC_VERSION) findings.push(`${at}: anthropic-version ${m[1]} ≠ ${AI.ANTHROPIC_VERSION} (valoarea centrală)`);
      else seen.push(at);
    }
    if (hasCore) for (const m of ln.matchAll(/\bversion\s*:\s*['"](\d{4}-\d\d-\d\d)['"]/g)) findings.push(`${at}: opțiunea version: ${m[1]} trimisă nucleului AI; omite-o (valoarea centrală se aplică) sau folosește FFF.ai.ANTHROPIC_VERSION`);
    if (/api\.anthropic\.com\/v1\//.test(ln)) calls = true;
    for (const m of ln.matchAll(/claude-[a-z0-9][a-z0-9.-]*[a-z0-9]/gi)) {
      const id = m[0];
      const st = AI.modelStatus(id);
      if (st === 'retired' && !EXPLAIN.test(ln) && !EXPLAIN.test(lines[i - 1] || '') && !EXPLAIN.test(lines[i - 2] || '')) findings.push(`${at}: model retras ${id} (înlocuitor: ${AI.MODELS.retired[id]})`);
      else if (st === 'unknown' && /^claude-(sonnet|opus|haiku|fable|mythos)-[\d-]/.test(id)) warnings.push(`${at}: id de model necunoscut nucleului: ${id}`);
    }
  });
  if (calls) {
    // temperature/top_p/top_k în corpul unei cereri către Anthropic: rânduri cu JSON.stringify/body care conțin max_tokens (semnătura Messages API)
    lines.forEach((ln, i) => { if (/\b(temperature|top_p|top_k)\b\s*[:=]/.test(ln) && /max_tokens|anthropic/i.test(ln) && !/ollama|openai|google|gemini/i.test(ln)) findings.push(`${rel}:${i + 1}: temperature/top_p/top_k către Anthropic (eliminate în 2026-10-21 → 400)`); });
  }
}
if (argv.includes('--json')) console.log(JSON.stringify({version: AI.ANTHROPIC_VERSION, checked: AI.MODELS.checked, findings, warnings, ok: seen.length}, null, 1));
else {
  warnings.forEach((w) => console.log('avertisment  ' + w));
  findings.forEach((p) => console.log('PROBLEMĂ     ' + p));
  console.log(`anthropic-audit: versiune centrală ${AI.ANTHROPIC_VERSION} · modele verificate ${AI.MODELS.checked} · ${findings.length} probleme · ${warnings.length} avertismente (rădăcini: ${roots.map((r) => path.relative(HUB, r) || '.').join(', ')})`);
}
process.exit(findings.length ? 1 : 0);
