// Teste Etapa 9 – relații justificate (fără browser): fiecare dintre cardurile catalogului (inclusiv variantele ascunse)
// are ≥2 relații, fiecare cu cel puțin un motiv verificabil; data/relations.json e la zi; nicio relație fără card.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadMeta, loadFlows, loadEnvelopeInfo, relationEvidence, evidenceByCard, validateRelations, buildRelations} from '../tools/catalog-meta-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const T = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e.message || e)); } };

const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
const keys = [...new Set([...html.matchAll(/data-c="apps\|([^|"]+)\|title"/g)].map((m) => m[1]))];
const meta = loadMeta(HUB), flows = loadFlows(HUB), env = loadEnvelopeInfo(HUB);
const ev = relationEvidence(meta, flows, env), by = evidenceByCard(ev);

T('catalogul are cel puțin 117 carduri', () => assert.ok(keys.length >= 117, 'carduri: ' + keys.length));
T('fiecare card (și variantă) are ≥2 relații justificate', () => assert.deepEqual(validateRelations(ev, keys, {topics: meta.topics}), []));
T('fiecare relație are cel puțin un motiv și cheile există', () => {
  for (const e of Object.values(ev)) { assert.ok(e.reasons.length >= 1, e.a + '|' + e.b); assert.ok(keys.includes(e.a) && keys.includes(e.b), e.a + '|' + e.b); }
});
T('motivele sunt dintr-o listă închisă', () => {
  for (const e of Object.values(ev)) for (const r of e.reasons) assert.match(r, /^(topic:[\w-]+|related|pair|variant|flow:[\w-]+|envelope:[\w.+-]+\/[\w.+-]+|data:[\w.-]+|module:fff-[\w-]+)$/, r);
});
T('o relație „pair” nouă are motiv în cuvinte (cele adăugate în Etapa 9)', () => {
  const pairs = meta.extraRelations.filter((r) => r.length === 3);
  assert.ok(pairs.length >= 12, 'perechi cu motiv: ' + pairs.length);
});
T('variantele Universul Observabil au ≥2 relații (părinte + frați)', () => {
  for (const v of meta.variants['Universul-Observabil']) assert.ok((by[v] || []).length >= 2, v);
});
T('graful din pagină (buildRelations) rămâne simetric', () => {
  const r = buildRelations(meta);
  for (const [k, l] of Object.entries(r)) for (const o of l) assert.ok((r[o] || []).includes(k), k + '>' + o);
});
T('data/relations.json corespunde dovezilor calculate', () => {
  const j = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'relations.json'), 'utf8'));
  assert.equal(j.count, Object.keys(ev).length, 'rulează: node tools/sync-catalog.mjs --root <apps>');
  assert.equal(j.relations.length, j.count);
});
T('minimul scade detectabil: un card cu o singură relație e respins', () => {
  const fake = {'A|B': {a: 'A', b: 'B', reasons: ['pair'], strong: 1}};
  assert.ok(validateRelations(fake, ['A', 'B']).length >= 2);
});
T('un card legat doar prin subiecte largi (>8 membri) e respins', () => {
  const t = [{id: 'big', members: Array.from({length: 10}, (_, i) => 'C' + i)}];
  const e = {};
  for (let i = 1; i < 4; i++) e['C0|C' + i] = {a: 'C0', b: 'C' + i, reasons: ['topic:big'], strong: 0};
  const bad = validateRelations(e, ['C0', 'C1', 'C2', 'C3'], {topics: t});
  assert.ok(bad.some((m) => m.includes('C0') && m.includes('solid')), bad.join(';'));
});
console.log(fail ? `\n${fail} eșuate` : `\ntoate trec (${keys.length} carduri, ${Object.keys(ev).length} relații)`);
process.exit(fail ? 1 : 0);
