// Teste pentru sugestiile din docs/RETROSPECTIVA.md puse în aplicare fără risc (Etapa 9). Fără browser.
//  1. tipuri de plic acceptate dar nicicând produse: lista e înghețată (text/plain, cards/qa); un acceptor nou fără producător pică;
//  2. scorul manual `score` vs. scorul măsurat `measured`: raportul de diferențe (tools/score-compare.mjs) rulează și acoperă aplicațiile;
//  3. make-fixtures --check: mesaj clar „regenerează”, fără să scrie nimic.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadEnvelopeInfo, loadMeta} from '../tools/catalog-meta-lib.mjs';

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

T('scor manual vs. măsurat: raportul rulează și listează diferențele', () => {
  const r = spawnSync('node', [path.join(HUB, 'tools', 'score-compare.mjs'), '--json'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  const meta = loadMeta(HUB);
  const both = Object.values(meta.apps).filter((a) => typeof a.score === 'number' && a.measured).length;
  assert.equal(j.both, both, 'aplicații cu ambele scoruri');
  assert.ok(j.rows.every((x) => typeof x.manual === 'number' && typeof x.measured === 'number' && Math.abs(x.diff - (x.measured - x.manual)) < 1e-9));
  assert.ok(Array.isArray(j.manualOnly) && Array.isArray(j.measuredOnly));
  // niciun fișier nu s-a schimbat: raportul e doar citire
  const before = fs.statSync(path.join(HUB, 'data', 'catalog-meta.json')).mtimeMs;
  spawnSync('node', [path.join(HUB, 'tools', 'score-compare.mjs')], {encoding: 'utf8'});
  assert.equal(fs.statSync(path.join(HUB, 'data', 'catalog-meta.json')).mtimeMs, before);
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
