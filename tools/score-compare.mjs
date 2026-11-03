#!/usr/bin/env node
// score-compare — compară scorul manual (`score`, auditul din 22.10.2026) cu scorul măsurat (`measured`, tools/audit-run.mjs). Doar citește.
//   node tools/score-compare.mjs [--json]
// Folosește decizia din docs/RETROSPECTIVA.md (Etapa 1): „score” manual poate fi scos după ce autorul acceptă formula măsurată.
// Raportul arată ce s-ar schimba în „Recomandate” (ordinea și pragul de laborator) și unde judecata calitativă diferă de măsurătoare.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMeta} from './catalog-meta-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const meta = loadMeta(HUB), thr = meta.policy.labThreshold ?? 5;
const rows = [], manualOnly = [], measuredOnly = [];
for (const [k, a] of Object.entries(meta.apps)) {
  const m = typeof a.score === 'number' ? a.score : null, x = a.measured && typeof a.measured.score === 'number' ? a.measured.score : null;
  if (m !== null && x !== null) rows.push({app: k, manual: m, measured: x, diff: +(x - m).toFixed(4), manualLab: m < thr, measuredLab: x < thr});
  else if (m !== null) manualOnly.push(k); else if (x !== null) measuredOnly.push(k);
}
rows.sort((p, q) => Math.abs(q.diff) - Math.abs(p.diff) || p.app.localeCompare(q.app));
const rec = rows.filter((r) => !r.manualLab);
const swaps = (() => { const byM = [...rec].sort((p, q) => q.manual - p.manual || p.app.localeCompare(q.app)).map((r) => r.app), byX = [...rec].sort((p, q) => q.measured - p.measured || p.app.localeCompare(q.app)).map((r) => r.app); return byM.filter((a, i) => byX[i] !== a).length; })();
const out = {both: rows.length, manualOnly, measuredOnly, threshold: thr, labFlips: rows.filter((r) => r.manualLab !== r.measuredLab).map((r) => r.app), positionsChanged: swaps, rows};
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
else {
  console.log(`scor manual vs. măsurat · ${rows.length} aplicații cu ambele · doar manual: ${manualOnly.length} · doar măsurat: ${measuredOnly.length}`);
  console.log(`prag laborator ${thr}: ${out.labFlips.length ? 'ar schimba starea: ' + out.labFlips.join(', ') : 'nicio aplicație nu și-ar schimba starea'} · poziții schimbate în ordinea „Recomandate”: ${swaps} din ${rec.length}`);
  console.log('cele mai mari diferențe (măsurat − manual):');
  for (const r of rows.slice(0, 15)) console.log(`  ${r.app.padEnd(28)} manual ${String(r.manual).padStart(4)}  măsurat ${String(r.measured).padStart(5)}  ${r.diff > 0 ? '+' : ''}${r.diff}`);
  if (manualOnly.length) console.log('fără scor măsurat (rămân doar cu cel manual): ' + manualOnly.join(', '));
}
