// Teste Node pentru tools/fff-pasaport.js (pașaportul de învățare): curățare, SM-2, îmbinare, plic, certificat.   Rulare: node tests/pasaport.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
process.env.TZ = 'Europe/Bucharest';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mk = () => { const m = {}; return {getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m}; };
globalThis.localStorage = mk();
const P = require(path.join(HUB, 'tools/fff-pasaport.js'));
let ok = 0, bad = 0; const T = (n, f) => { try { f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' așteptat ' + JSON.stringify(b) + ', obținut ' + JSON.stringify(a)); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const reset = () => { globalThis.localStorage = mk(); };

T('add: notă simplă și card; nivel limitat 1–5; titlu gol respins; control chars scoase', () => {
  reset(); const a = P.add({app: 'ETER', skill: 'Cod Q \u0001QRM', level: 9}); eq(a.skill, 'Cod Q QRM'); eq(a.level, 5); eq(a.kind, 'note');
  const b = P.add({app: 'SEVA', skill: 'Respirație', schedule: true}); eq(b.kind, 'card'); eq(b.due, P.today(Date.now() + 864e5));
  yes(P.add({app: 'x', skill: '   '}) === null, 'gol'); eq(P.list().length, 2);
});
T('persistă în localStorage sub cheia fff.pasaport.v1 și se recitește curat', () => {
  reset(); P.add({app: 'A', skill: 'X'}); yes(JSON.parse(localStorage.getItem('fff.pasaport.v1')).entries.length === 1, 'stocat');
  localStorage.setItem('fff.pasaport.v1', '{stricat'); eq(P.list(), [], 'JSON stricat → gol');
  localStorage.setItem('fff.pasaport.v1', JSON.stringify({entries: [{skill: 'ok', app: 'a'}, {skill: ''}, 5, null, {skill: 'x'.repeat(500), level: 'abc'}]})); const l = P.list(); eq(l.length, 2); eq(l[1].skill.length, 120); eq(l[1].level, 1);
});
T('SM-2: 1 → 3 → ×ease; „nu am știut” resetează la 1 zi; ease ≥ 1.3', () => {
  const t0 = Date.UTC(2026, 10, 3, 9); let e = {ease: 2.5, reps: 0, interval: 0};
  let s = P.schedule(e, 4, t0); eq([s.interval, s.reps, s.due], [1, 1, '2026-11-04']); e = s;
  s = P.schedule(e, 4, t0); eq([s.interval, s.reps], [3, 2]); e = s;
  s = P.schedule(e, 4, t0); eq(s.interval, Math.round(3 * e.ease)); eq(s.reps, 3); e = s;
  s = P.schedule(e, 0, t0); eq([s.interval, s.reps], [1, 0]);
  let h = {ease: 1.35, reps: 5, interval: 10}; for (let i = 0; i < 5; i++) h = Object.assign(h, P.schedule(h, 0, t0)); yes(h.ease >= 1.3, 'ease ' + h.ease);
  yes(P.schedule({ease: 2.5, reps: 3, interval: 1}, 3, t0).interval >= 2, 'interval strict crescător la reps≥3');
});
T('due + grade: cardul iese din „scadente” după notare; notele simple nu sunt scadente', () => {
  reset(); const c = P.add({app: 'INDICATIV', skill: 'Cod Q', schedule: true}); P.add({app: 'ETER', skill: 'Nota'});
  const tom = Date.now() + 864e5; eq(P.due(tom).length, 1); eq(P.due(Date.now()).length, 0, 'azi nu e scadent');
  const g = P.grade(c.id, 4, tom); eq(g.reps, 1); eq(P.due(tom).length, 0, 'după notare dispare'); eq(P.due(tom + 2 * 864e5).length, 1, 'revine peste 1 zi'); yes(P.grade('nu-exista', 4) === null, 'id necunoscut');
});
T('merge: fără dubluri, cea mai nouă versiune câștigă, plic străin sanitizat', () => {
  reset(); const a = P.add({app: 'A', skill: 'S', schedule: true}); const copy = JSON.parse(JSON.stringify(a));
  let r = P.merge([copy]); eq(r, {added: 0, skipped: 1}); const newer = Object.assign({}, copy, {reps: 4, interval: 9, last: '2099-01-01T00:00:00.000Z'});
  r = P.merge([newer]); eq(r.added, 1); eq(P.list()[0].reps, 4);
  r = P.merge([{id: 'zz', app: 'B', skill: 'Nou', ts: '2026-01-01T00:00:00.000Z'}, {id: '../../x', app: '<b>', skill: 'Rău', ts: 'ieri'}, 'x', null]); eq(r.added, 2); yes(P.list().every((e) => /^[A-Za-z0-9_.:-]+$/.test(e.id)), 'id sanitizat');
});
T('plic passport/fff: dus-întors prin FFF.envelope, versiune greșită respinsă', () => {
  reset(); globalThis.window = globalThis; const E = require(path.join(HUB, 'tools/fff-envelope.js')); globalThis.FFF = {envelope: E};
  P.add({app: 'ETER', skill: 'Morse', level: 3}); const env = P.envelope('ETER'); eq(env.type, 'passport/fff'); yes(E.validate(E.normalize(env)).ok, 'valid');
  const back = E.parse(E.serialize(env)); eq(P.fromEnvelope(back).length, 1); eq(P.fromEnvelope({type: 'passport/fff', payload: {v: 2, entries: [{}]}}), []); eq(P.fromEnvelope({type: 'text/plain', payload: 'x'}), []);
});
T('digest: stabil, sensibil la schimbare, format XXXX-XXXX-XXXX-XXXX', () => {
  reset(); P.add({app: 'A', skill: 'S'}); const l = P.list(), d1 = P.digest(l); yes(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(d1), d1); eq(P.digest(l), d1);
  const l2 = JSON.parse(JSON.stringify(l)); l2[0].level = 4; yes(P.digest(l2) !== d1, 'nivelul intră în cod'); l2[0].level = l[0].level; l2[0].skill = 'T'; yes(P.digest(l2) !== d1, 'denumirea intră în cod'); l2[0].skill = l[0].skill; l2[0].note = 'altceva'; eq(P.digest(l2), d1, 'nota liberă nu intră în cod');
});
T('I18N: 8 limbi cu aceleași chei', () => {
  const ks = Object.keys(P.I18N.ro).sort(); eq(Object.keys(P.I18N).sort(), ['de', 'en', 'es', 'fr', 'hu', 'it', 'pt', 'ro']);
  for (const l in P.I18N) eq(Object.keys(P.I18N[l]).sort(), ks, l);
  yes(Object.values(P.I18N).every((o) => /diploma|dipl|Diplom|oklevél|diplôme/i.test(o.cdisc) || /diploma|diplôme|Diplom|oklevél|diploma/i.test(o.cdisc)), 'avertisment în fiecare limbă');
});
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
