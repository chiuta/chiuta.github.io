// Etapa 4 — teste unitare (Node, fără browser): fluxurile (data/flows.json), motorul A/B (tools/fff-ab.js), laboratorul de reproducere (tools/fff-repro.js).
// Rulare: node tests/flows-unit.test.mjs
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url'; import {createRequire} from 'node:module';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const AB = require(path.join(HUB, 'tools/fff-ab.js')), RP = require(path.join(HUB, 'tools/fff-repro.js'));
const {loadFlows, validateFlows, flowsByApp} = await import(path.join(HUB, 'tools/catalog-meta-lib.mjs'));
let ok = 0, bad = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

console.log('Fluxuri (data/flows.json)');
const flows = loadFlows(HUB), html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
const keys = [...html.matchAll(/data-c="apps\|([^|"]+)\|title"/g)].map((m) => m[1]);
const prob = validateFlows(flows, keys);
T('fluxurile sunt coerente cu cardurile și tipurile (0 probleme)', prob.length === 0, prob);
T('4 fluxuri: sursa, ab, repro, jurnal', flows.flows.map((f) => f.id).join() === 'sursa,ab,repro,jurnal');
const by = flowsByApp(flows);
T('LegatorOCR → TEZAUR → VERIGA → AcademiSearch în graf', by.LegatorOCR.next[0].app === 'TEZAUR' && by.TEZAUR.next.some((x) => x.app === 'VERIGA') && by.VERIGA.next[0].app === 'AcademiSearch' && by.AcademiSearch.prev.some((x) => x.app === 'VERIGA'));
T('fiecare card din flux apare cu „înlănțuie cu…” în blocul încorporat', ((html.match(/id="catalog-meta">([\s\S]*?)<\/script>/) || [])[1] || '').includes('"byApp"'));
const bad1 = validateFlows({flows: [{id: 'x', name: {}, summary: {}, nodes: {A: {mode: 'web', produces: ['t/a']}, B: {mode: 'web', accepts: ['t/b']}}, edges: [['A', 'B', 't/a']]}]}, ['A']);
T('validatorul prinde: nod fără card, tip neacceptat, limbi lipsă', bad1.some((m) => /nu are card/.test(m)) && bad1.some((m) => /nu acceptă/.test(m)) && bad1.some((m) => /nu are limba/.test(m)), bad1);

console.log('Motor A/B');
let s = AB.cleanState({q: 'Care e mai clar?', variants: AB.cleanVariants(['Alfa', 'Beta', 'Gama', 'alfa', '', 'x'.repeat(300)])});
T('variante curățate: fără duplicate/goale, eticheta tăiată la 120', s.variants.length === 4 && s.variants[3].label.length === 120, s.variants.map((v) => v.label.length));
T('minim 2 variante: nextPair null sub 2', AB.nextPair(AB.cleanState({variants: [{id: 'v1', label: 'a'}]})) === null);
// 3 variante: toate perechile se parcurg înainte de a repeta
let st = AB.cleanState({q: 'q', variants: AB.cleanVariants(['A', 'B', 'C'])}), seen = new Set();
for (let i = 0; i < 3; i++) { const p = AB.nextPair(st); seen.add([p.a, p.b].sort().join('|')); st = AB.vote(st, 'a'); }
T('3 variante: primele 3 perechi sunt distincte (round-robin)', seen.size === 3, [...seen]);
// Elo: A bate B de 5 ori → A > B; egalitate nu schimbă între egali
let e = AB.cleanState({variants: AB.cleanVariants(['A', 'B']), rounds: [1, 2, 3, 4, 5].map(() => ({a: 'v1', b: 'v2', w: 'a'}))});
let r = AB.ranking(e);
T('Elo: A conduce după 5 victorii, B ultimul', r[0].label === 'A' && r[0].elo > 1500 && r[1].elo < 1500 && r[0].wins === 5 && r[1].losses === 5, r);
T('Elo: suma punctelor se conservă (3000)', Math.abs(r[0].elo + r[1].elo - 3000) < 0.2);
T('verdict: 5 jocuri și diferență ≥ 60 → „conduce A”', AB.verdict(e).leader === 'v1' && AB.verdict(e).enough);
T('verdict prudent: 2 jocuri → fără lider', AB.verdict({...e, rounds: e.rounds.slice(0, 2)}).leader === null);
T('egalitățile: 4 egalități → fără lider, Elo 1500', (() => { const x = AB.cleanState({variants: AB.cleanVariants(['A', 'B']), rounds: [1, 2, 3, 4].map(() => ({a: 'v1', b: 'v2', w: 't'}))}); return AB.verdict(x).leader === null && AB.ranking(x)[0].elo === 1500 && AB.ranking(x)[0].ties === 4; })());
T('„sar peste” nu schimbă clasamentul', AB.ranking(AB.cleanState({variants: AB.cleanVariants(['A', 'B']), rounds: [{a: 'v1', b: 'v2', w: 's'}]}))[0].games === 0);
T('stare coruptă curățată (id necunoscut, vot invalid)', AB.cleanState({variants: [{id: 'v1', label: 'a'}, {id: 'zz', label: 'b'}], rounds: [{a: 'v1', b: 'v9', w: 'a'}, {a: 'v1', b: 'v1', w: 'a'}]}).rounds.length === 0);
T('undo scoate ultimul vot', AB.undo(e).rounds.length === 4);
T('CSV: antet + 2 rânduri, ghilimele escapate', (() => { const x = AB.cleanState({variants: AB.cleanVariants(['A "q", x', 'B']), rounds: [{a: 'v1', b: 'v2', w: 'a'}]}); const c = AB.toCsv(x).trim().split('\n'); return c.length === 3 && c[0] === 'rank,variant,elo,wins,losses,ties,games' && c[1].includes('"A ""q"", x"'); })());
const pl = AB.payload(e, 'Cadraj');
T('payload: întrebare, clasament, voturi cu etichete, avertisment, csv', pl.variants.length === 2 && pl.rounds[0].w === 'A' && pl.votes === 5 && /^Elo sequential/.test(pl.method) && pl.csv.startsWith('rank,') && pl.caveat.length > 20, pl);
const back = AB.fromEnvelope({payload: pl});
T('fromEnvelope reface starea (aceleași voturi și clasament)', back && back.rounds.length === 5 && AB.ranking(back)[0].label === 'A' && AB.ranking(back)[0].elo === r[0].elo);
T('fromEnvelope respinge payload străin', AB.fromEnvelope({payload: 'x'}) === null && AB.fromEnvelope(null) === null);
T('8 limbi în A/B cu aceleași chei', (() => { const L = Object.keys(AB.I18N), k0 = Object.keys(AB.I18N.ro).sort().join(); return L.length === 8 && L.every((l) => Object.keys(AB.I18N[l]).sort().join() === k0); })());

console.log('Laborator de reproducere');
const CSV = 'tara;an;populatie\nRO;2020;19,2\nRO;2021;19,1\nBG;2020;6,9\nBG;2021;6,8\n';
const t = RP.parseCsv(CSV);
T('CSV cu ; și zecimale cu virgulă', t.head.join() === 'tara,an,populatie' && t.rows.length === 4 && RP.num('19,2') === 19.2 && RP.num('1.234,5') === 1234.5 && RP.num('1,234.5') === 1234.5 && RP.num('12 %') === 12 && isNaN(RP.num('abc')));
T('citește ghilimele și \\r\\n', RP.parseCsv('a,b\r\n"x, y",2\r\n').rows[0][0] === 'x, y');
T('media populației RO = 19,15', Math.abs(RP.compute(t, {fn: 'mean', col: 'populatie', where: {col: 'tara', op: '=', val: 'RO'}}).value - 19.15) < 1e-9);
T('suma, minim, maxim, mediană, număr, pondere', RP.compute(t, {fn: 'sum', col: 'populatie'}).value.toFixed(1) === '52.0' && RP.compute(t, {fn: 'min', col: 'populatie'}).value === 6.8 && RP.compute(t, {fn: 'max', col: 'populatie'}).value === 19.2 && RP.compute(t, {fn: 'median', col: 'populatie'}).value === (6.9 + 19.1) / 2 && RP.compute(t, {fn: 'count', col: ''}).value === 4 && Math.abs(RP.compute(t, {fn: 'share', col: 'populatie', where: {col: 'tara', op: '=', val: 'RO'}}).value - 38.3 / 52 * 100) < 1e-6);
T('erori fără excepții: coloană lipsă, filtru gol, fără numere', RP.compute(t, {fn: 'sum', col: 'zzz'}).err === 'nocol' && RP.compute(t, {fn: 'sum', col: 'populatie', where: {col: 'tara', op: '=', val: 'XX'}}).err === 'empty' && RP.compute(t, {fn: 'sum', col: 'tara'}).err === 'nonum' && RP.compute({head: [], rows: []}, {fn: 'sum', col: 'a'}).err === 'nodata');
T('judge: rotunjire la precizia afirmată + toleranță', RP.judge('19,15', 19.15, 0) === 'reproduced' && RP.judge('19,2', 19.15, 0) === 'reproduced' && RP.judge('19', 19.15, 0) === 'reproduced' && RP.judge('20', 19.15, 0.5) === 'not-reproduced' && RP.judge('19,0', 19.15, 1) === 'reproduced' && RP.judge('x', 1, 1) === 'inconclusive');
const p1 = await RP.run({claim: 'Populația medie a României 2020–2021 este 19,15 mil.', value: '19,15', spec: {fn: 'mean', col: 'populatie', where: {col: 'tara', op: '=', val: 'RO'}}, tol: 0.5, csv: CSV, dataName: 'pop.csv', subject: {indicator: 'Populație', country: 'RO'}, app: 'DataWeave'});
T('run: reprodusă, cu amprentă SHA-256 și datele atașate', p1.verdict === 'reproduced' && /^[0-9a-f]{64}$/.test(p1.data.sha256) && p1.data.csv === CSV && p1.subject.country === 'RO' && p1.result === 19.15, p1);
const p2 = await RP.run({claim: 'Populația medie a României este 21', value: '21', spec: {fn: 'mean', col: 'populatie', where: {col: 'tara', op: '=', val: 'RO'}}, tol: 0.5, csv: CSV, app: 'AcademiSearch'});
T('run: nereprodusă când cifra nu iese', p2.verdict === 'not-reproduced' && p2.result === 19.15);
const p3 = await RP.run({claim: 'x', value: '1', spec: {fn: 'mean', col: 'lipsa'}, csv: CSV});
T('run: coloană lipsă → neconcludent cu motiv', p3.verdict === 'inconclusive' && /^nocol:lipsa/.test(p3.why) && p3.result === null);
const rr = await RP.rerun(RP.cleanPayload(p1));
T('rerun: același rezultat din datele din plic', rr.ok && rr.same);
const tampered = RP.cleanPayload({...p1, data: {...p1.data, csv: CSV.replace('19,2', '10,0')}});
const rr2 = await RP.rerun(tampered);
T('rerun: datele modificate → rezultat diferit (nu „same”)', rr2.ok && !rr2.same && rr2.after !== rr2.before, rr2);
T('cleanPayload: respinge verdict necunoscut, taie câmpuri străine', RP.cleanPayload({verdict: 'ok'}) === null && !('evil' in RP.cleanPayload({...p1, evil: 1})) && RP.cleanPayload({...p1, spec: {fn: 'rm -rf', col: 'x'}}).spec.fn === '');
T('8 limbi în repro cu aceleași chei', (() => { const L = Object.keys(RP.I18N), k0 = Object.keys(RP.I18N.ro).sort().join(), f0 = Object.keys(RP.I18N.ro.fns).sort().join(); return L.length === 8 && L.every((l) => Object.keys(RP.I18N[l]).sort().join() === k0 && Object.keys(RP.I18N[l].fns).sort().join() === f0); })());
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
