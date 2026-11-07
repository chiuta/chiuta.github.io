// Teste pentru sugestiile din docs/RETROSPECTIVA.md puse în aplicare fără risc (Etapa 9). Fără browser.
//  1. tipuri de plic acceptate dar nicicând produse: lista e înghețată (text/plain, cards/qa); un acceptor nou fără producător pică;
//  2. scorul: sursă unică data/transparenta.json; `score` manual depreciat (rezervă); „laborator” din `status`; „Recomandate” după scorul măsurat (tools/score-compare.mjs);
//  3. make-fixtures --check: mesaj clar „regenerează”, fără să scrie nimic.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadEnvelopeInfo, loadMeta, scoreOf, validateMeta} from '../tools/catalog-meta-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const T = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e.message || e)); } };

// Tipurile acceptate fără niciun producător, cunoscute la 3 noiembrie 2026 (RETROSPECTIVA, Etapa 2). Când apare un producător, scoate tipul de aici;
// un tip NOU acceptat fără producător nu se adaugă în tăcere: promite o legătură care nu există.
const KNOWN_DEAD_ACCEPTORS = ['cards/qa', 'text/plain'];

T('acceptori fără producător: exact lista cunoscută', () => {
  const env = loadEnvelopeInfo(HUB), prod = new Set(), acc = new Map();
  for (const [slug, e] of Object.entries(env.types)) { e.produces.forEach((t) => prod.add(t)); e.accepts.forEach((t) => (acc.get(t) || acc.set(t, []).get(t)).push(slug)); }
  const dead = [...acc.keys()].filter((t) => !prod.has(t)).sort();
  assert.deepEqual(dead, KNOWN_DEAD_ACCEPTORS, 'tipuri acceptate fără producător: ' + dead.join(', ') + ' (dacă a apărut un producător, actualizează KNOWN_DEAD_ACCEPTORS)');
});

T('scor: sursă unică (transparenta.json), `score` manual doar rezervă depreciată, „laborator” din câmpul `status`', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'catalog-meta.json'), 'utf8'));
  const a7 = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'transparenta.json'), 'utf8')).a7;
  const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
  const keys = [...html.matchAll(/data-c="apps\|([^|"]+)\|title"/g)].map((m) => m[1]);
  const meta = loadMeta(HUB);
  // 1. scorul măsurat nu mai e copiat în catalog-meta.json; vine din a7 pentru fiecare aplicație măsurată
  assert.deepEqual(Object.entries(raw.apps).filter(([, v]) => v.measured !== undefined).map(([k]) => k), [], 'catalog-meta.json nu mai conține „measured” (sursa e data/transparenta.json)');
  const scored = a7.apps.filter((r) => typeof r.score === 'number');
  assert.ok(scored.length >= 112);
  for (const r of scored) assert.equal(meta.apps[r.key].measured.score, r.score, r.key);
  // 2. cele 9 nemăsurate: programele native, Pendulul și cele 4 aplicații adăugate la 2026-11-07 (BRAZDA, VOIAJOR, CHIROMANTIA, PUNCTUM; auditul de scor nu a rulat încă pe ele); nu au scor de rezervă (nu s-a inventat nimic)
  const unmeasured = keys.filter((k) => scoreOf(meta.apps[k] || {}) === null).sort();
  assert.deepEqual(unmeasured, ['BRAZDA', 'CHIROMANTIA', 'LegatorOCR', 'OSATURA', 'PUNCTUM', 'Pendulul', 'TEZAUR', 'VERIGA', 'VOIAJOR'], 'aplicații fără niciun scor');
  assert.deepEqual(keys.filter((k) => !(meta.apps[k] && meta.apps[k].measured) && meta.apps[k] && typeof meta.apps[k].score === 'number'), [], 'rezerva `score` doar pentru nemăsurate');
  // 3. `score` manual interzis pe o aplicație măsurată; acceptat (rezervă) pe una nemăsurată; citit doar dacă lipsește măsurătoarea
  const probs = (m) => validateMeta(m, keys, null).filter((p) => /score|măsurat|laborator|lab/i.test(p));
  assert.deepEqual(probs(meta), [], 'catalogul curent trebuie să fie curat');
  const m1 = structuredClone(meta); m1.apps.DataWeave.score = 9.9;
  assert.ok(probs(m1).some((p) => /DataWeave.*depreciat/.test(p)), '`score` pe aplicație măsurată trebuie respins');
  const m2 = structuredClone(meta); m2.apps.TEZAUR.score = 6;
  assert.deepEqual(probs(m2), [], '`score` de rezervă pe o aplicație nemăsurată e acceptat');
  assert.equal(scoreOf({score: 6}), 6); assert.equal(scoreOf({score: 6, measured: {score: 9, date: '2026-11-03'}}), 9); assert.equal(scoreOf({}), null);
  // 4. „laborator” nu depinde de scor: OmniHost și LocalMind au scor măsurat mare și rămân lab; o stare lab fără niciun scor e validă; un scor mic nu face o aplicație lab
  assert.deepEqual(Object.entries(meta.apps).filter(([, v]) => v.status === 'lab').map(([k]) => k).sort(), ['LocalMind', 'OmniHost']);
  assert.ok(meta.apps.OmniHost.measured.score >= 8 && meta.apps.LocalMind.measured.score >= 8);
  const m3 = structuredClone(meta); delete m3.apps.OmniHost.measured; assert.deepEqual(probs(m3), [], 'lab fără scor e valid');
  const m4 = structuredClone(meta); m4.apps.DataWeave.measured.score = 1; assert.deepEqual(probs(m4), [], 'scor mic fără status lab nu mai e o eroare de catalog (starea e declarată)');
  // 5. „Recomandate” urmează scorul măsurat: ordinea greșită, scor sub prag și laborator sunt respinse
  const rec = ['DataWeave', 'Undava', 'MarkdownAtelier', 'Arhiva-fara-frontiere'];
  assert.deepEqual(validateMeta(meta, keys, {recomandate: rec}).filter((p) => /Recomandate/.test(p)), []);
  assert.ok(validateMeta(meta, keys, {recomandate: ['Arhiva-fara-frontiere', 'MarkdownAtelier']}).some((p) => /ordinea nu e descrescătoare după scorul măsurat/.test(p)));
  assert.ok(validateMeta(meta, keys, {recomandate: ['DataWeave', 'OmniHost']}).some((p) => /OmniHost e în laborator/.test(p)));
  // 6. raportul de comparație: ieșirea vizibilă coincide cu arhiva (laborator, ordinea din „Recomandate”), fără scriere
  const before = fs.statSync(path.join(HUB, 'data', 'catalog-meta.json')).mtimeMs;
  const r = spawnSync('node', [path.join(HUB, 'tools', 'score-compare.mjs'), '--json', '--check'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(j.problems, []); assert.deepEqual(j.lab, ['LocalMind', 'OmniHost']); assert.deepEqual(j.labByMeasuredRule, [], 'o regulă derivată din scorul măsurat ar fi scos laboratorul');
  assert.ok(j.rows.every((x) => typeof x.manual === 'number' && typeof x.measured === 'number' && Math.abs(x.diff - (x.measured - x.manual)) < 1e-9));
  assert.equal(fs.statSync(path.join(HUB, 'data', 'catalog-meta.json')).mtimeMs, before);
  // 7. arhiva scorurilor vechi există și acoperă ce s-a scos (pas reversibil)
  const leg = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'score-legacy.json'), 'utf8'));
  assert.ok(Object.keys(leg.scores).length >= 97 && Object.values(leg.scores).every((v) => typeof v === 'number'));
});

T('make-fixtures: fără --root nu scrie nimic; --check fără clone cere explicit regenerarea', () => {
  const dir = path.join(HUB, 'tests', 'fixtures', 'apps'), n = fs.readdirSync(dir).length;
  const w = spawnSync('node', [path.join(HUB, 'tools', 'make-fixtures.mjs')], {encoding: 'utf8'});
  assert.equal(w.status, 2); assert.match(w.stderr, /--root/);
  assert.equal(fs.readdirSync(dir).length, n, 'fixturile nu trebuie atinse');
  const c = spawnSync('node', [path.join(HUB, 'tools', 'make-fixtures.mjs'), '--check'], {encoding: 'utf8'});
  assert.ok(c.status === 0 || /Regenerează: node tools\/make-fixtures\.mjs --root/.test(c.stdout), c.stdout);
  const empty = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'nofix-'));
  const e = spawnSync('node', [path.join(HUB, 'tools', 'make-fixtures.mjs'), '--root', empty], {encoding: 'utf8'});
  assert.equal(e.status, 2); assert.match(e.stderr, /nu scriu nimic/);
  assert.equal(fs.readdirSync(dir).length, n, 'o rădăcină goală nu golește fixturile');
  fs.rmSync(empty, {recursive: true, force: true});
});

console.log(fail ? `\n${fail} eșuate` : '\ntoate trec');
process.exit(fail ? 1 : 0);
