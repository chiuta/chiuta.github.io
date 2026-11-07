// Controlul traducerilor automate (fr, it, es, pt, de, hu): fără browser, fără rețea.
//  1. hub: demo/nativ nu are erori de control, marcajul din pagină coincide cu registrul, raportul generat e la zi;
//  2. GARANȚIA: marcajul „automat” dispare doar când există revizuire în registru (și revizuirea cere nume, dată validă, marcaj „revizuit” în fișier);
//  3. verificările pe segment prind greșelile pe care promit să le prindă (și nu se plâng de un text bun);
//  4. opțional, cu depozitele externe prezente (TRADUCERI_APPS, TRADUCERI_TEZAUR sau căile implicite din acest mediu): controlul complet.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as T from '../tools/traduceri-lib.mjs';
import {run} from '../tools/traduceri-control.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const t = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 6).join('\n     ')); } };
const reg = T.loadRegistry(HUB), reviews = T.loadReviews(HUB);

t('registrul: unități, glosar, praguri; revizuirile din registru sunt valide', () => {
  assert.deepEqual(reg.units.map((u) => u.id), ['nativ', 'tezaur-tutoriale', 'tezaur-ui', 'mensura-readme', 'fenarium-readme']);
  assert.ok(reg.glossary.length >= 25 && reg.glossary.every((g) => g.id && g.en && g.forms && T.MT.every((l) => Array.isArray(g.forms[l]) && g.forms[l].length)), 'fiecare termen are formă acceptată în fiecare limbă');
  for (const g of reg.glossary) { new RegExp(g.en, 'iu'); for (const l of T.MT) for (const f of g.forms[l]) new RegExp(f, 'iu'); }
  assert.deepEqual(T.checkReviewEntries(reviews, reg), []);
});

t('hub: demo/nativ fără erori de control; subtitrări în 8 limbi cu același număr de replici', () => {
  const r = run(HUB);
  assert.deepEqual(r.present.has('nativ'), true);
  assert.deepEqual(r.struct, []);
  assert.deepEqual(r.findings.filter((f) => f.sev === 'eroare').map((f) => `${f.unit}/${f.lang} ${f.key}: ${f.msg}`), []);
  assert.ok(r.segs.filter((s) => s.unit === 'nativ').length >= 250, 'segmente nativ: ' + r.segs.length);
});

t('hub: marcajul din demo/nativ/index.html coincide cu registrul de revizuiri', () => {
  const r = run(HUB);
  assert.deepEqual(r.markerProblems, []);
  const mk = T.parseMarker(fs.readFileSync(path.join(HUB, 'demo', 'nativ', 'index.html'), 'utf8'));
  assert.deepEqual(Object.keys(mk).sort(), [...T.MT].sort());
  const D = JSON.parse(fs.readFileSync(path.join(HUB, 'demo', 'nativ', 'nativ-data.js'), 'utf8').replace(/^window\.NATIV=/, '').replace(/;\s*$/, ''));
  const pending = T.MT.filter((l) => mk[l].state === 'automat');
  for (const l of T.LANGS) {
    if (pending.length) for (const p of pending) assert.ok(new RegExp('\\b' + p + '\\b').test(D.ui[l].auto), `${l}: nota „automat” trebuie să numească ${p}`);
    else assert.equal(D.ui[l].auto, '', 'toate revizuite: nota „automat” trebuie să dispară');
  }
});

t('raportul docs/TRADUCERI-REVIZIE.md: partea generată coincide cu registrul', () => {
  const r = spawnSync('node', [path.join(HUB, 'tools', 'traduceri-control.mjs'), '--check-report'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(HUB, 'docs', 'TRADUCERI-CONTRIBUTIE.md')));
});

// ---------------------------------------------------------------- GARANȚIA
const unit = {id: 'nativ'};
const file = (text, extra = {}) => ({rel: 'f', text, ...extra});
const MK_AUTO = 'traducere: ' + T.MT.map((l) => `${l}=automat`).join(' ');
const MK_HU = 'traducere: ' + T.MT.map((l) => (l === 'hu' ? 'hu=revizuit:Ana_Maria_Popescu:2026-12-01' : `${l}=automat`)).join(' ');
const REV_HU = {reviews: [{unit: 'nativ', lang: 'hu', by: 'Ana Maria Popescu', date: '2026-12-01'}]};

t('garanție: „automat” fără nicio revizuire → în regulă; „automat” dispărut fără revizuire → eroare', () => {
  assert.deepEqual(T.checkMarkers(unit, {reviews: []}, [file(`<!-- ${MK_AUTO} -->`)]), []);
  const p = T.checkMarkers(unit, {reviews: []}, [file(`<!-- ${MK_HU} -->`)]);
  assert.ok(p.some((x) => /hu.*„automat” a dispărut fără o revizuire/.test(x)), p.join('|'));
  assert.ok(T.checkMarkers(unit, {reviews: []}, [file('fără marcaj')]).some((x) => /lipsește marcajul/.test(x)), 'fără niciun marcaj = eroare, nu „implicit revizuit”');
  assert.ok(T.checkMarkers(unit, {reviews: []}, [file('traducere: hu=')]).length > 0);
});

t('garanție: revizuire în registru + marcaj „revizuit” cu același nume și dată → în regulă; marcaj rămas „automat” sau nume diferit → eroare', () => {
  assert.deepEqual(T.checkMarkers(unit, REV_HU, [file(`<!-- ${MK_HU} -->`)]), []);
  assert.ok(T.checkMarkers(unit, REV_HU, [file(`<!-- ${MK_AUTO} -->`)]).some((x) => /registrul spune „revizuit de Ana Maria Popescu”.*încă marcajul „automat”/.test(x)));
  const other = MK_HU.replace('Ana_Maria_Popescu', 'Altcineva');
  assert.ok(T.checkMarkers(unit, REV_HU, [file(`<!-- ${other} -->`)]).some((x) => /nu coincide cu registrul/.test(x)));
  assert.ok(T.checkMarkers(unit, REV_HU, [file(`<!-- ${MK_HU.replace('2026-12-01', '2026-12-02')} -->`)]).some((x) => /nu coincide cu registrul/.test(x)));
  assert.ok(T.checkMarkers(unit, REV_HU, [file('traducere: fr=automat it=automat es=automat pt=automat de=automat')]).some((x) => /nu poartă marcajul limbii/.test(x)), 'registru fără marcaj în fișiere');
});

t('garanție: fraza vizibilă „traducere automată” urmează starea (README per limbă)', () => {
  const sent = {hu: 'A felület 8 nyelvű; a románon kívüli fordítások automatikusak, anyanyelvi beszélők nem ellenőrizték őket.', fr: 'les traductions autres que le roumain sont automatiques et non vérifiées par des locuteurs natifs.',
    it: 'le traduzioni diverse dal rumeno sono automatiche e non verificate da madrelingua.', es: 'las traducciones distintas del rumano son automáticas y no están revisadas por hablantes nativos.',
    pt: 'as traduções além do romeno são automáticas e não foram revistas por falantes nativos.', de: 'Übersetzungen außer Rumänisch sind automatisch und nicht von Muttersprachlern geprüft.'};
  for (const l of T.MT) assert.ok(T.AUTO_SENTENCE_STRICT[l].test(sent[l]), l + ': propoziția cunoscută trebuie recunoscută');
  const u = {id: 'mensura-readme'};
  const mkFile = (text, l) => ({rel: `README.${l}.md`, lang: l, text, visibleSentence: (ll) => T.AUTO_SENTENCE_STRICT[ll].test(text.replace(/<!--[\s\S]*?-->/g, ''))});
  const ok = T.checkMarkers(u, {reviews: []}, [mkFile(`${sent.hu}\n<!-- traducere: hu=automat -->`, 'hu')]);
  assert.deepEqual(ok, []);
  const gone = T.checkMarkers(u, {reviews: []}, [mkFile('Text fără propoziție.\n<!-- traducere: hu=automat -->', 'hu')]);
  assert.ok(gone.some((x) => /fraza vizibilă despre traducerea automată lipsește/.test(x)));
  const rv = {reviews: [{unit: 'mensura-readme', lang: 'hu', by: 'Gábor Kiss', date: '2026-12-01'}]};
  const left = T.checkMarkers(u, rv, [mkFile(`${sent.hu}\n<!-- traducere: hu=revizuit:Gábor_Kiss:2026-12-01 -->`, 'hu')]);
  assert.ok(left.some((x) => /fraza vizibilă „traducere automată” a rămas/.test(x)));
  assert.deepEqual(T.checkMarkers(u, rv, [mkFile('Revizuit de Gábor Kiss (2026-12-01).\n<!-- traducere: hu=revizuit:Gábor_Kiss:2026-12-01 -->', 'hu')]), []);
  assert.ok(T.checkMarkers(u, {reviews: []}, [mkFile(`${sent.hu}\n<!-- traducere: fr=automat -->`, 'hu')]).some((x) => /marcajul e pentru fr, fișierul e hu/.test(x)));
});

t('garanție: intrările din registru fără nume real, cu dată greșită, limbă sau unitate necunoscută sunt respinse', () => {
  const bad = (r) => T.checkReviewEntries({reviews: [{unit: 'nativ', lang: 'hu', by: 'Ana Pop', date: '2026-12-01', ...r}]}, reg, '2026-12-31');
  assert.deepEqual(bad({}), []);
  for (const by of ['', '  ', 'AB', 'nume', 'TODO', 'xxx', '???', 'N/A', 'Ana: Pop', 'Ana]']) assert.ok(bad({by}).some((x) => /„by”/.test(x)), `nume respins: „${by}”`);
  assert.ok(bad({by: undefined}).some((x) => /„by”/.test(x)));
  for (const date of ['', '2026-1-1', '01.12.2026', '2027-01-01', undefined]) assert.ok(bad({date}).some((x) => /„date”/.test(x)), `dată respinsă: ${date}`);
  assert.ok(bad({lang: 'ro'}).some((x) => /limba trebuie/.test(x)) && bad({lang: 'en'}).length > 0 && bad({lang: 'xx'}).length > 0);
  assert.ok(bad({unit: 'altceva'}).some((x) => /unitate necunoscută/.test(x)));
  const dup = T.checkReviewEntries({reviews: [{unit: 'nativ', lang: 'hu', by: 'Ana Pop', date: '2026-12-01'}, {unit: 'nativ', lang: 'hu', by: 'Ion Pop', date: '2026-12-02'}]}, reg, '2026-12-31');
  assert.ok(dup.some((x) => /dublură/.test(x)));
});

t('marcaj: parseMarker citește automat / revizuit și respinge formele invalide', () => {
  const m = T.parseMarker('x <!-- traducere: fr=automat hu=revizuit:Ana_Pop:2026-12-01 --> y');
  assert.deepEqual(m, {fr: {state: 'automat'}, hu: {state: 'revizuit', by: 'Ana Pop', date: '2026-12-01'}});
  assert.equal(T.parseMarker('fără marcaj'), null);
  assert.equal(T.parseMarker('traducere: hu=revizuit')['hu'].state, 'invalid');
  assert.equal(T.parseMarker('traducere: hu=revizuit:Ana:azi')['hu'].state, 'invalid');
  assert.equal(T.parseMarker('traducere: hu=gata')['hu'].state, 'invalid');
});

// ---------------------------------------------------------------- verificările pe segment
const seg = (lang, text, ref, extra = {}) => ({unit: 'x', lang, key: 'k', text, ref, ro: extra.ro || '', ...extra});
const codes = (s) => T.checkSegment(s, reg).map((f) => f.code + ':' + f.sev);

t('segment: text bun → fără erori; greșelile cunoscute → semnalate', () => {
  const ref = 'The ingest command indexes the files locally, together with the BibTeX bibliography. Nothing leaves the computer.';
  assert.deepEqual(T.checkSegment(seg('fr', "La commande ingest indexe les fichiers localement, avec la bibliographie BibTeX. Rien ne quitte l'ordinateur.", ref), reg).filter((f) => f.sev === 'eroare'), []);
  assert.ok(codes(seg('hu', 'Az ingest parancs helyben indexeli a fájlokat, a BibTeX irodalomjegyzékkel. Semmi nem hagyja el a gépet õ.', ref)).includes('alfabet:eroare'), 'hu õ');
  assert.ok(codes(seg('fr', 'La commande ingest indexe les fichiers, avec la bibliographie BibTeX. Nimic nu pleacă de pe calculator.', ref)).includes('ro-scapat:eroare'));
  assert.ok(codes(seg('fr', "La commande indexe les fichiers localement, avec la bibliographie. Rien ne quitte l'ordinateur.", ref)).includes('invariant:eroare'), 'ingest și BibTeX lipsesc');
  assert.ok(codes(seg('fr', 'Dans la librairie, rien ne bouge.', 'The library does not change at all in this long sentence about things.')).includes('glosar:eroare'), 'librairie = calc interzis');
  assert.ok(codes(seg('pt', 'O ingest guarda os arquivos na biblioteca, com BibTeX.', 'The ingest keeps the files in the library, with BibTeX.')).includes('confuzie:avertisment'), 'pt-BR');
  assert.ok(codes(seg('es', '¿Qué hace esto? Nada!', 'What does this do? Nothing!')).includes('es-semne:eroare'));
  assert.ok(codes(seg('de', 'The library keeps the files and the sources with your notes here.', 'The library keeps the files and the sources with your notes here.')).includes('netradus:eroare'));
  assert.ok(codes(seg('it', 'Il comando legge i file e the sources della libreria.', 'The command reads the files and the sources of the library.')).some((c) => c.startsWith('cuvant-en')));
  assert.ok(codes(seg('de', 'Ein Satz  mit zwei Leerzeichen.', 'A sentence with two spaces.')).includes('spatii:avertisment'));
  assert.ok(codes(seg('de', 'Das Verzeichnis â ist kaputt Ã©.', 'The directory is broken, a long enough sentence.')).includes('mojibake:eroare'));
  assert.ok(codes(seg('it', 'Che cosa succede ?', 'What happens?')).includes('punctuatie:avertisment'), 'spațiu înainte de ? în it');
  assert.ok(codes(seg('fr', 'Que se passe-t-il?', 'What happens?')).includes('punctuatie:avertisment'), 'fr cere spațiu');
  assert.ok(codes(seg('fr', 'Quoi ?', 'What?')).filter((c) => c.startsWith('punctuatie')).length === 0);
  assert.ok(codes(seg('hu', '', ref)).includes('gol:eroare'));
  const longRef = 'Pick the tab and type a question here, then press the button that runs it on the whole library.';
  assert.ok(codes(seg('de', longRef.replace(/\w+/g, 'wort') + ' ' + longRef + ' ' + longRef, longRef)).includes('lungime:avertisment'));
  assert.ok(codes(seg('it', 'Siglă: QI, EQ, CQ, QR.', 'Tests: IQ, EQ, CQ, RQ.')).filter((c) => c.startsWith('invariant')).length === 0, 'IQ→QI, RQ→QR acceptate');
});

t('segment: cuvintele din sursa ro/en (nume de limbi, etichete de interfață) nu sunt judecate la alfabet', () => {
  assert.deepEqual(codes(seg('fr', "Choisissez l'onglet Întreabă et tapez une question.", 'Pick the Ask tab and type a question.', {ro: 'Alege fila Întreabă și scrie o întrebare.'})).filter((c) => c.startsWith('alfabet') || c.startsWith('ro-scapat')), []);
  assert.ok(codes(seg('fr', "Choisissez l'onglet Întreabă et tapez une question, Căutare.", 'Pick the Ask tab and type a question.', {ro: 'Alege fila Întreabă și scrie o întrebare.'})).includes('ro-scapat:eroare'));
});

t('glosar: consecvență (două forme în aceeași unitate) și registru amestecat sunt semnalate', () => {
  const s = [seg('de', 'Das Zitat ist da.', 'The citation is here.'), seg('de', 'Der Beleg ist da.', 'The citation is there.')].map((x) => ({...x, unit: 'u'}));
  assert.ok(T.checkConsistency(s, reg).some((f) => f.code === 'consecventa' && f.lang === 'de'));
  const r = [seg('de', 'Öffne die Datei, du kannst sie lesen.', 'a'), seg('de', 'Öffnen Sie die Datei, Ihre Daten bleiben.', 'b')].map((x) => ({...x, unit: 'u'}));
  assert.ok(T.checkRegister(r, reg).some((f) => f.code === 'registru'));
  assert.deepEqual(T.checkRegister([seg('de', 'Öffne die Datei, du kannst sie lesen.', 'a')].map((x) => ({...x, unit: 'u'})), reg), []);
});

// ---------------------------------------------------------------- depozitele externe (dacă sunt prezente)
const APPS = process.env.TRADUCERI_APPS || ['/home/claude/demo/apps'].find((d) => fs.existsSync(path.join(d, 'MENSURA', 'README.md')));
const TEZ = process.env.TRADUCERI_TEZAUR || ['/home/claude/chiuta/TEZAUR'].find((d) => fs.existsSync(path.join(d, 'tezaur.html')));
if (APPS && TEZ) {
  t('depozite externe (MENSURA, Fenarium, TEZAUR): fără erori de control, marcaje consecvente cu registrul', () => {
    const r = run(HUB, {apps: APPS, tezaur: TEZ});
    assert.deepEqual([...r.present].sort(), ['fenarium-readme', 'mensura-readme', 'nativ', 'tezaur-tutoriale', 'tezaur-ui']);
    assert.deepEqual(r.struct, []);
    assert.deepEqual(r.findings.filter((f) => f.sev === 'eroare').map((f) => `${f.unit}/${f.lang} ${f.key}: ${f.msg}`), []);
    assert.deepEqual(r.markerProblems, []);
    assert.ok(r.segs.length > 1300, 'segmente: ' + r.segs.length);
  });
} else console.log('omis: depozitele MENSURA / Fenarium / TEZAUR nu sunt prezente (setează TRADUCERI_APPS și TRADUCERI_TEZAUR)');

console.log(fail ? `\n${fail} eșuate` : '\ntoate trec');
process.exit(fail ? 1 : 0);
