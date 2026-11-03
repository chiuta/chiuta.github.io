// Teste Node pentru tools/fff-jocuri.js (motorul comun de jocuri): Elo, turneu, istoric, export/import, i18n.   Rulare: node tests/jocuri.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, bad = 0; const T = (n, f) => { try { f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' așteptat ' + JSON.stringify(b) + ', obținut ' + JSON.stringify(a)); };
const yes = (c, m) => { if (!c) throw new Error(m); };
/* DOM minimal: modulul cere `document` doar la încărcare (atributul lang) */
globalThis.document = {documentElement: {getAttribute: () => 'ro'}, createElement: () => ({}), getElementById: () => null};
globalThis.window = globalThis;
const G = require(HUB + '/tools/fff-jocuri.js'), T_ = G.TBL;
T('FFF.games și TBL expuse; TBL e același obiect', () => { yes(globalThis.FFF.games === G, 'FFF.games'); yes(globalThis.TBL === T_, 'TBL'); eq(G.VERSION, 1); });
T('Elo: egali, victorie = +20 la primele partide (K 40), suma se păstrează', () => {
  const r = G.record('t1', 'Ana', 'Ion', 1); eq(Math.round(r.a.delta), 20); eq(Math.round(r.b.delta), -20); yes(Math.abs(r.a.delta + r.b.delta) < 1e-9, 'sumă zero');
});
T('remiză între egali nu schimbă nimic; remiza cu un mai slab scade favoritul', () => {
  G.clear('t2'); const r = G.record('t2', 'A', 'B', 0.5); eq(r.a.delta, 0);
  G.record('t2', 'A', 'B', 1); const r2 = G.record('t2', 'A', 'B', 0.5); yes(r2.a.delta < 0 && r2.b.delta > 0, 'favoritul pierde puncte la remiză');
});
T('clasament sortat descrescător, cu V/E/I și jocuri', () => {
  G.clear('t3'); G.record('t3', 'X', 'Y', 1); G.record('t3', 'X', 'Z', 0.5); G.record('t3', 'Y', 'Z', 0);
  const L = G.ladder('t3'); eq(L.map((p) => p.name), ['Z', 'X', 'Y']); const x = L[1]; eq([x.g, x.w, x.d, x.l], [2, 1, 1, 0]);
  yes(G.toCSV('t3').split('\n').length === 4, 'csv');
});
T('validare: același jucător (și cu majuscule), nume gol, rezultat invalid', () => {
  for (const [a, b, r] of [['A', 'a', 1], ['', 'B', 1], ['A', 'B', 2], ['A', 'B', '1']]) { let t = false; try { G.record('t4', a, b, r); } catch (e) { t = true; } yes(t, `${a}/${b}/${r}`); }
  eq(G.history('t4'), [], 'nimic salvat');
});
T('istoric plafonat la 300; cheia de joc e curățată', () => {
  G.clear('t5'); for (let i = 0; i < 305; i++) G.record('t5', 'A', 'B', i % 2); eq(G.history('t5').length, 300);
  G.record('Joc Ciudat/../x', 'A', 'B', 1); eq(G.history('joc-ciudat-x').length, 1);
});
T('export → import reproduce exact clasamentul (recalculat din istoric)', () => {
  G.clear('t6'); G.record('t6', 'P', 'Q', 1); G.record('t6', 'Q', 'R', 0.5); G.record('t6', 'R', 'P', 0);
  const L0 = G.ladder('t6'), js = G.exportJSON('t6'); G.clear('t6'); eq(G.ladder('t6'), []);
  eq(G.importJSON('t6', js), 3); eq(G.ladder('t6'), L0);
});
T('import respinge formatul greșit fără a șterge datele', () => {
  G.clear('t7'); G.record('t7', 'A', 'B', 1);
  for (const bad of ['nu e json', '{"fff":"altceva","v":1,"history":[]}', '{"fff":"games","v":2,"history":[]}', '{"fff":"games","v":1,"history":[{"a":"A","b":"A","res":1}]}', '{"fff":"games","v":1,"history":[{"a":"A","b":"B","res":0.7}]}']) {
    let t = false; try { G.importJSON('t7', bad); } catch (e) { t = true; } yes(t, bad);
  }
  eq(G.history('t7').length, 1);
});
T('turneu tur-retur: rezultate manuale, clasament, import/export JSON', () => {
  const tour = T_.tournament({key: 'jg-t8'}); tour.reset();
  tour.create([{name: 'Eu', ai: 0}, {name: 'Maria', ai: 0}, {name: 'Dan', ai: 0}], false, '', null);
  const ms = tour.state.matches; eq(ms.length, 3); ms.forEach((m) => tour.record(m.id, 1, 'man'));
  yes(tour.finished(), 'terminat'); eq(tour.standings().length, 3); yes(tour.standings()[0].pts >= tour.standings()[2].pts, 'ordine');
  const js = tour.toJSON(); tour.reset(); yes(!tour.exists(), 'șters'); tour.load(js); yes(tour.finished(), 'reîncărcat');
});
T('I18N jg.*: 8 limbi, aceleași chei, fără chei lipsă', () => {
  const D = T_.dict, keys = Object.keys(D.ro).filter((k) => k.startsWith('jg.')).sort(); yes(keys.length >= 20, 'chei');
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) eq(Object.keys(D[l]).filter((k) => k.startsWith('jg.')).sort(), keys, l);
  yes(G.css.includes('.c1a-btn') && G.css.includes('c1a-dlg'), 'css');
});
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
