import {loadKit, ok, eq, done} from './_node.mjs';
const F = loadKit(['srs']);

// --- Referință independentă: aritmetică în sutimi (întregi), scrisă separat de implementare ---
function ref(seq) {
  let efc = 250, n = 0, i = 0; const out = [];
  for (const q of seq) {
    if (q >= 3) {
      const prevEf = efc;
      i = n === 0 ? 1 : n === 1 ? 6 : Math.floor((i * prevEf + 50) / 100);   // round(i*EF), EF în sutimi
      n++;
      const d = 10 - (5 - q) * (8 + (5 - q) * 2);                          // delta EF în sutimi
      efc = Math.max(130, efc + d);
    } else { n = 0; i = 1; }
    out.push({ef: efc / 100, n, i});
  }
  return out;
}
// valori calculate de mână (literal)
eq(ref([4,4,4,4,4]).map(x => x.i), [1,6,15,38,95], 'ref q=4 intervale');
eq(ref([5,5,5,5]).map(x => x.i), [1,6,16,45], 'ref q=5 intervale');
eq(ref([5,5,5,5]).map(x => x.ef), [2.6,2.7,2.8,2.9], 'ref q=5 EF');
eq(ref([3,3,3]).map(x => x.ef), [2.36,2.22,2.08], 'ref q=3 EF');
eq(ref([3,3,3]).map(x => x.i), [1,6,13], 'ref q=3 intervale');   // 6*2.22=13.32
const seqs = [[4,4,4,4,4,4],[5,5,5,5,5],[3,3,3,3,3,3,3],[4,2,4,4,4],[5,5,0,5,5,5],[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],[1,1,1,1],[0,5,4,3,2,1,0,5,4,3,2,1],[4,5,3,4,5,3,4,5,3,4]];
// secvențe pseudo-aleatoare reproductibile
let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let k = 0; k < 40; k++) seqs.push(Array.from({length: 15}, () => Math.floor(rnd() * 6)));
let cmp = 0;
for (const seq of seqs) {
  const r = ref(seq); let st = {ef: 2.5, n: 0, i: 0};
  seq.forEach((q, idx) => { st = F.srs.sm2(st, q); cmp++;
    ok(st.n === r[idx].n && st.i === r[idx].i && Math.abs(st.ef - r[idx].ef) < 1e-9, `SM-2 secvența ${seq.join('')} pasul ${idx}: ${JSON.stringify(st)} vs ${JSON.stringify(r[idx])}`); });
}
ok(F.srs.sm2({ef:1.3,n:2,i:6}, 0).ef === 1.3, 'EF ≥ 1.3 la q=0 (neschimbat)');
let st = {ef: 1.4, n: 3, i: 10}; for (let k = 0; k < 10; k++) st = F.srs.sm2(st, 3); ok(st.ef === 1.3, 'EF plafonat la 1.3');
eq(F.srs.sm2({ef:2.5,n:5,i:50}, 2), {ef:2.5,n:0,i:1,q:2}, 'reset la q<3');
eq(F.srs.sm2({ef:2.5,n:0,i:0}, 9).q, 5, 'q limitat la 5');

// --- Pachet: programare pe zile ---
const D = (k) => new Date(2026, 0, 1 + k, 12);           // ziua k, prânz local
const dk = F.srs.create('t1', {newPerDay: 2});
eq(dk.add([{front:'a',back:'A'},{front:'b',back:'B'},{front:'c',back:'C'}]), 3, 'add 3');
eq(dk.add([{front:'a',back:'A'}]), 0, 'dedup');
let c = dk.next(D(0)); eq(c.front, 'a', 'primul nou');
eq(dk.stats(D(0)).newToday, 2, 'limită 2 noi/zi');
let g = dk.grade(c.id, 4, D(0)); eq([g.interval, g.dueDate], [1, '2026-01-02'], 'a: 1 zi');
c = dk.next(D(0)); eq(c.front, 'b', 'al doilea nou'); dk.grade(c.id, 2, D(0));   // eșec -> rămâne azi
c = dk.next(D(0)); eq(c.front, 'b', 'b reapare azi (reînvățare)'); ok(dk.stats(D(0)).newToday === 0, 'cota nouă epuizată');
dk.grade(c.id, 4, D(0));
ok(dk.next(D(0)) === null, 'nimic azi (c depășește cota)');
eq(dk.stats(D(0)).toStudy, 0, 'toStudy 0');
c = dk.next(D(1)); ok(c && c.isNew === false && ['a','b'].includes(c.front), 'a/b scadente a doua zi');
const st1 = dk.stats(D(1)); eq([st1.due, st1.newToday], [2, 1], 'ziua 2: 2 scadente + 1 nou (c)');
dk.grade(dk.next(D(1)).id, 4, D(1)); dk.grade(dk.next(D(1)).id, 5, D(1));
const byF = Object.fromEntries(dk.export().cards.map(x => [x.f, x]));
eq([byF.a.i, byF.b.i], [6, 6], 'al doilea succes -> 6 zile');
const base = Math.round(Date.UTC(2026, 0, 1) / 86400000);
eq([byF.a.due, byF.b.due], [base + 7, base + 7], 'due în zile absolute (ziua 1 + 6)');
const s7 = dk.stats(D(1)); ok(s7.retention > 0 && s7.retention < 1, 'retenție între 0 și 1: ' + s7.retention);
eq(s7.reviews, 5, 'număr revizuiri'); eq(s7.total, 3, 'total');
ok(s7.avgEase > 2.4 && s7.avgEase < 2.7, 'ease mediu');
// persistare: reîncărcare modul cu același localStorage
const F2 = loadKit(['srs']);
const dk2 = F2.srs.create('t1'); eq(dk2.stats(D(1)).total, 3, 'persistat și reîncărcat'); eq(dk2.export().cards.map(x => x.due), dk.export().cards.map(x => x.due), 'due persistat');
eq(F2.srs.decks(), ['t1'], 'registru pachete');
// export/import în alt pachet
const ex = dk.export(); eq(ex.format, 'fff-srs-deck', 'format export');
const dk3 = F2.srs.create('t3'); eq(dk3.import(JSON.stringify(ex)), 3, 'import 3 carduri'); eq(dk3.import(ex), 0, 'import repetat nu suprascrie');
eq(dk3.export().cards.map(x => [x.f, x.i, x.ef]), ex.cards.map(x => [x.f, x.i, x.ef]), 'import păstrează starea');
const dk5 = F2.srs.create('t5'); dk5.add([{front: 'a', back: 'A'}]); const c5 = dk5.next(D(0)); dk5.grade(c5.id, 4, D(0));
const behind = F2.srs.create('t6'); behind.add([{front: 'a', back: 'A'}, {front: 'b', back: 'B'}]);
eq(behind.import(dk5.export(), {merge: 'progress'}), 1, 'merge=progress: preia cardul cu mai multe revizuiri'); eq(dk5.import(behind.export(), {merge: 'progress'}), 1, 'merge=progress: doar cardul nou (b) e adăugat'); eq(dk5.get(c5.id).rev, 1, 'merge=progress: progresul existent nu e degradat');
let thrown = false; try { dk3.import({format: 'x'}); } catch (e) { thrown = true; } ok(thrown, 'import invalid aruncă');
// ID-uri numerice nu schimbă ordinea
const dk4 = F2.srs.create('t4'); dk4.add([{id: 10, front: 'x'}, {id: 2, front: 'y'}, {id: 1, front: 'z'}]); eq(dk4.next(D(0)).front, 'x', 'ordinea inserării păstrată');
console.log('SM-2 comparații efectuate:', cmp);
done('srs');
