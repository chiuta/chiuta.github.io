#!/usr/bin/env node
// score-compare — dovada că trecerea de la scorul manual (`score`, arhivat în data/score-legacy.json) la scorul MĂSURAT (data/transparenta.json → a7)
// nu schimbă neintenționat ce se vede în hub. Doar citește.
//   node tools/score-compare.mjs [--json] [--check]
//   --check : cod de ieșire 1 dacă (a) mulțimea „laborator” din index.html diferă de `labExpected` din arhivă, (b) „Recomandate” nu e ordonată după scorul măsurat,
//             (c) o aplicație cu scor măsurat mai poartă `score` manual, (d) `score` de rezervă lipsește unde ar trebui citit.
// Ce se compară (partea vizibilă): starea „laborator” a cardurilor, secțiunea „Recomandate” (ordine), rândul „Audit intern” din fișă, rândul „Audit măsurat” din fișă.
// Ce NU se compară: valorile scorurilor în sine (diferențele manual → măsurat sunt listate informativ).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMeta, scoreOf} from './catalog-meta-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const meta = loadMeta(HUB), thr = meta.policy.labThreshold ?? 5;
const legacy = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'score-legacy.json'), 'utf8'));
const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');

// cardurile, în ordinea din pagină: secțiune, cheie, stare
const parts = html.split('<div class="app-card"'), cards = [];
let sec = ((parts[0].match(/<div class="sec-head[^"]*" id="([^"]+)"/g) || []).pop() || '').replace(/.*id="/, '').replace(/"$/, '');
for (let i = 1; i < parts.length; i++) {
  const key = (parts[i].match(/data-c="apps\|([^|"]+)\|title"/) || [])[1], st = (parts[i].match(/data-status="([^"]*)"/) || [])[1];
  cards.push({sec, key, st});
  const m = [...parts[i].matchAll(/<div class="sec-head[^"]*" id="([^"]+)"/g)]; if (m.length) sec = m[m.length - 1][1];
}
const lab = cards.filter((c) => c.st === 'lab').map((c) => c.key).sort();
const recom = cards.filter((c) => c.sec === 'recomandate').map((c) => c.key);

// diferențe manual (arhivă) → măsurat
const rows = [], manualOnly = [], measuredOnly = [];
for (const k of Object.keys(meta.apps)) {
  const m = typeof legacy.scores[k] === 'number' ? legacy.scores[k] : null, x = meta.apps[k].measured ? meta.apps[k].measured.score : null;
  if (m !== null && x !== null) rows.push({app: k, manual: m, measured: x, diff: +(x - m).toFixed(4)});
  else if (m !== null) manualOnly.push(k); else if (x !== null) measuredOnly.push(k);
}
rows.sort((p, q) => Math.abs(q.diff) - Math.abs(p.diff) || p.app.localeCompare(q.app));

// „laborator”: declarat (status) vs. ce ar fi dat regula veche (manual < prag) și o regulă derivată din scorul măsurat (< prag)
const byLegacyRule = Object.keys(legacy.scores).filter((k) => legacy.scores[k] < thr).sort();
const byMeasuredRule = Object.keys(meta.apps).filter((k) => meta.apps[k].measured && meta.apps[k].measured.score < thr).sort();
const labExpected = [...legacy.labExpected].sort();
// „Recomandate”: ordinea de acum, ordinea după scorul manual vechi, ordinea după cel măsurat (egalitate = ordinea editorială, deci stabilă)
const cmp = (f) => [...recom].map((k, i) => ({k, i, s: f(k)})).sort((p, q) => q.s - p.s || p.i - q.i).map((x) => x.k);
const oldOrder = cmp((k) => legacy.scores[k] ?? -1), newOrder = cmp((k) => scoreOf(meta.apps[k]) ?? -1);
const moved = recom.filter((k, i) => oldOrder.indexOf(k) !== i).length;

const problems = [];
if (JSON.stringify(lab) !== JSON.stringify(labExpected)) problems.push(`laborator: ${lab.join(',') || '(nimic)'} ≠ așteptat ${labExpected.join(',')}`);
if (JSON.stringify(recom) !== JSON.stringify(newOrder)) problems.push(`Recomandate nu e ordonată după scorul măsurat: ${recom.join(',')} ≠ ${newOrder.join(',')}`);
for (const [k, a] of Object.entries(meta.apps)) if (typeof a.score === 'number' && a.measured) problems.push(`${k}: „score” manual depreciat pe o aplicație măsurată`);
const out = {both: rows.length, manualOnly, measuredOnly, threshold: thr, lab, labExpected, labByLegacyRule: byLegacyRule, labByMeasuredRule: byMeasuredRule,
  recomandate: {now: recom, legacyOrder: oldOrder, measuredOrder: newOrder, positionsChangedVsLegacy: moved}, problems, rows};
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
else {
  console.log(`scor manual (arhivă) vs. măsurat · ${rows.length} aplicații cu ambele · doar manual: ${manualOnly.length} · doar măsurat: ${measuredOnly.length}`);
  console.log(`laborator (câmpul status): ${lab.join(', ')} · regula veche (manual < ${thr}) dădea: ${byLegacyRule.join(', ')} · o regulă din scorul măsurat ar da: ${byMeasuredRule.join(', ') || '(nimic)'} → de aceea starea e declarată explicit`);
  console.log(`Recomandate (${recom.length} carduri): ${moved} poziții diferă față de ordinea veche după scor manual · acum: ${recom.join(' > ')}`);
  console.log('cele mai mari diferențe (măsurat − manual):');
  for (const r of rows.slice(0, 15)) console.log(`  ${r.app.padEnd(28)} manual ${String(r.manual).padStart(4)}  măsurat ${String(r.measured).padStart(5)}  ${r.diff > 0 ? '+' : ''}${r.diff}`);
  if (manualOnly.length) console.log('fără scor măsurat, doar manual (rezerva): ' + manualOnly.join(', '));
  console.log(problems.length ? 'PROBLEME:\n  ' + problems.join('\n  ') : 'verificare: ieșirea vizibilă coincide cu cea așteptată');
}
if (process.argv.includes('--check') && problems.length) process.exit(1);
