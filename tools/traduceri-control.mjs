#!/usr/bin/env node
// Controlul traducerilor automate (fr, it, es, pt, de, hu). Fără vorbitori nativi: verificări mecanice (glosar, invarianți, lungime, caractere, netraduse, registru, marcaje).
//   node tools/traduceri-control.mjs [--apps DIR] [--tezaur DIR] [--json] [--report] [--check]
//   fără --apps/--tezaur : se controlează doar ce e în hub (demo/nativ); unitățile din depozite externe sunt trecute „neverificate aici”.
//   --report       : rescrie partea generată din docs/TRADUCERI-REVIZIE.md (între marcajele <!-- gen:… -->), doar din registru (nu cere depozitele externe)
//   --check-report : cod 1 dacă partea generată nu coincide cu registrul (pentru CI)
//   --check        : cod 1 dacă există erori (nu avertismente), nepotriviri de structură sau marcaje inconsecvente
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from './traduceri-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const APPS = arg('--apps'), TEZ = arg('--tezaur');
const reg = T.loadRegistry(HUB), reviews = T.loadReviews(HUB);
const rd = (f) => fs.readFileSync(f, 'utf8');

/** Colectează segmentele și fișierele cu marcaj, pe unități. `present` = unitățile verificabile în această rulare. */
export function collect(hub, {apps = null, tezaur = null} = {}) {
  const segs = [], struct = [], markers = {}, present = new Set();
  const addMk = (unit, rel, file, extra = {}) => { (markers[unit] ||= []).push({rel, file, text: rd(file), ...extra}); };
  { const r = T.extractNativ(hub); segs.push(...r.segments); struct.push(...r.struct); present.add('nativ');
    addMk('nativ', 'demo/nativ/index.html', path.join(hub, 'demo', 'nativ', 'index.html'), {visibleSentence: (l) => { const m = rd(path.join(hub, 'demo', 'nativ', 'index.html')).match(/data-ui="auto"[^>]*>([^<]*)</); return m ? new RegExp('\\b' + l + '\\b').test(m[1]) : false; }}); }
  if (tezaur && fs.existsSync(path.join(tezaur, 'tezaur.html'))) {
    const r = T.extractTezaur(tezaur); segs.push(...r.segments); struct.push(...r.struct); present.add('tezaur-tutoriale'); present.add('tezaur-ui');
    addMk('tezaur-tutoriale', 'TEZAUR/scripts/tutorials/tutorials.py', path.join(tezaur, 'scripts', 'tutorials', 'tutorials.py'));
    addMk('tezaur-tutoriale', 'TEZAUR/scripts/tutorials/README.md', path.join(tezaur, 'scripts', 'tutorials', 'README.md'));
    addMk('tezaur-tutoriale', 'TEZAUR/index.html', path.join(tezaur, 'index.html'), {visibleSentence: (l) => { const m = rd(path.join(tezaur, 'index.html')).match(/Traducerile (?:în )?([a-z, ș]+) sunt automate/); return m ? new RegExp('\\b' + l + '\\b').test(m[1]) : false; }});
    addMk('tezaur-ui', 'TEZAUR/tezaur.html', path.join(tezaur, 'tezaur.html'));
  }
  if (apps) for (const [unit, dir] of [['mensura-readme', 'MENSURA'], ['fenarium-readme', 'Fenarium']]) {
    const root = path.join(apps, dir); if (!fs.existsSync(path.join(root, 'README.md'))) continue;
    const r = T.extractReadme(unit, root); segs.push(...r.segments); struct.push(...r.struct); present.add(unit);
    for (const l of T.MT) { const f = path.join(root, `README.${l}.md`); if (fs.existsSync(f)) addMk(unit, `${dir}/README.${l}.md`, f, {lang: l, visibleSentence: (ll) => T.AUTO_SENTENCE_STRICT[ll].test(rd(f).replace(/<!--[\s\S]*?-->/g, ''))}); }
  }
  return {segs, struct, markers, present};
}

export function run(hub, o = {}) {
  const c = collect(hub, o), findings = [];
  for (const s of c.segs) findings.push(...T.checkSegment(s, reg, {numAlt: s.lang === 'hu' || s.lang === 'de' || s.lang === 'fr' || s.lang === 'it' || s.lang === 'es' || s.lang === 'pt'}));
  for (const u of c.present) { const sg = c.segs.filter((s) => s.unit === u); findings.push(...T.checkConsistency(sg, reg), ...T.checkRegister(sg, reg)); }
  const markerProblems = [...T.checkReviewEntries(reviews, reg)];
  for (const u of reg.units) if (c.present.has(u.id)) markerProblems.push(...T.checkMarkers(u, reviews, c.markers[u.id] || []));
  return {...c, findings, markerProblems};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportOnly = (argv.includes('--report') || argv.includes('--check-report')) && !argv.includes('--check') && !argv.includes('--json') && !APPS && !TEZ;
  const r = reportOnly ? {findings: [], struct: [], markerProblems: [], present: new Set(), segs: []} : run(HUB, {apps: APPS, tezaur: TEZ});
  const err = r.findings.filter((f) => f.sev === 'eroare'), warn = r.findings.filter((f) => f.sev === 'avertisment');
  if (reportOnly) { /* doar raportul */ }
  else if (argv.includes('--json')) console.log(JSON.stringify({present: [...r.present], findings: r.findings, struct: r.struct, markerProblems: r.markerProblems}));
  else {
    console.log(`segmente verificate: ${r.segs.length} · unități: ${[...r.present].join(', ')} · erori ${err.length} · avertismente ${warn.length} · structură ${r.struct.length} · marcaje ${r.markerProblems.length}`);
    const show = (list, label) => { for (const f of list) console.log(`  ${label} ${f.unit}/${f.lang} ${f.key}: [${f.code}] ${f.msg}`); };
    show(err, 'EROARE'); show(warn, 'avert. ');
    for (const s of r.struct) console.log('  STRUCTURĂ ' + s);
    for (const m of r.markerProblems) console.log('  MARCAJ ' + m);
  }
  if (argv.includes('--report') || argv.includes('--check-report')) {
    const f = path.join(HUB, 'docs', 'TRADUCERI-REVIZIE.md'), cur = rd(f), next = T.applyReport(cur, T.generateReport(reg, reviews));
    if (argv.includes('--check-report')) { if (next !== cur) { console.error('docs/TRADUCERI-REVIZIE.md nu corespunde registrului: rulează node tools/traduceri-control.mjs --report'); process.exit(1); } console.log('raport la zi'); }
    else if (next !== cur) { fs.writeFileSync(f, next); console.log('docs/TRADUCERI-REVIZIE.md actualizat'); } else console.log('raportul era la zi');
  }
  if (argv.includes('--check') && (err.length || r.struct.length || r.markerProblems.length)) process.exit(1);
}
