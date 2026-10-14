import fs from 'node:fs';
import {loadKit, ok, eq, done} from './_node.mjs';
import {docs, queries, synonyms} from './search-corpus.mjs';
const F = loadKit(['search'], {lang: 'ro'});
const S = F.search;

// ---------- normalizare ----------
eq(S.normalize('Șoșon ŞŢ ţară Ăâî ő ű ß Ünicode Éa'), 'soson st tara aai o u ss unicode ea', 'normalizare ș/ş ț/ţ ă â î ő ű ß');
eq(S.tokenize('Școala, ţara; Größe-Straße 12'), ['scoala', 'tara', 'grosse', 'strasse', '12'], 'tokenizare');
eq(S.stem('copiilor', 'ro'), 'copi', 'stem ro copiilor'); eq(S.stem('casele', 'ro'), S.stem('casă', 'ro'), 'casele ~ casă');
eq(S.stem('organizațiile', 'ro'), S.stem('organizații', 'ro'), 'derivat ro');
eq(S.stem('running', 'en'), 'runn', 'en -ing'); eq(S.stem('cities', 'en'), S.stem('city', 'en'), 'en ies/y');
eq(S.stem('chevaux', 'fr'), S.stem('cheval', 'fr'), 'fr aux/al'); eq(S.stem('ciudades', 'es'), S.stem('ciudad', 'es'), 'es plural');
eq(S.stem('Häuser', 'de'), S.stem('hauser', 'de'), 'de umlaut'); eq(S.stem('házakban', 'hu'), S.stem('házak', 'hu') === S.stem('házakban', 'hu') ? S.stem('házak', 'hu') : 'x', 'hu -ban');
eq(S.stem('azioni', 'it'), S.stem('azione', 'it'), 'it'); eq(S.stem('organizações', 'pt'), S.stem('organização', 'pt'), 'pt ções/ção');
// ---------- distanță ----------
eq(S.distance('abcd', 'abdc', 2), 1, 'transpoziție = 1'); eq(S.distance('casa', 'cada', 2), 1, 'substituție'); eq(S.distance('casa', 'cs', 2), 2, 'două ștergeri'); ok(S.distance('abc', 'xyz', 1) > 1, 'peste prag');

// ---------- relevanță pe mini-corpus ----------
ok(docs.length >= 60, 'corpus ≥ 60: ' + docs.length);
const fold = s => s.toLowerCase();
function simpleAll(q) { const ws = fold(q).split(/\s+/).filter(Boolean); return docs.filter(d => ws.every(w => fold(d.title + ' ' + d.text).includes(w))).map(d => d.id); }
function simpleAny(q) { const ws = fold(q).split(/\s+/).filter(Boolean); return docs.map(d => ({id: d.id, n: ws.filter(w => fold(d.title + ' ' + d.text).includes(w)).length})).filter(x => x.n).sort((a, b) => b.n - a.n || a.id - b.id).map(x => x.id); }
function metrics(run) {
  let succ = 0, rec = 0, mrr = 0;
  const per = queries.map(([q, rel, cat]) => { const ids = run(q).slice(0, 10), top5 = ids.slice(0, 5);
    const got = rel.filter(r => top5.includes(r)).length, rank = ids.findIndex(i => rel.includes(i));
    succ += got > 0 ? 1 : 0; rec += got / rel.length; mrr += rank >= 0 ? 1 / (rank + 1) : 0;
    return {q, cat, rel, top3: ids.slice(0, 3), recall5: got / rel.length}; });
  const n = queries.length, byCat = {};
  per.forEach(p => { const c = byCat[p.cat] = byCat[p.cat] || {n: 0, r: 0}; c.n++; c.r += p.recall5; });
  Object.keys(byCat).forEach(k => byCat[k] = {n: byCat[k].n, recall_at_5: +(byCat[k].r / byCat[k].n).toFixed(3)});
  return {success_at_5: +(succ / n).toFixed(3), recall_at_5: +(rec / n).toFixed(3), mrr_at_10: +(mrr / n).toFixed(3), by_category: byCat, per};
}
const ixPlain = S.index(docs, {lang: 'ro'});
const ixSyn = S.index(docs, {lang: 'ro', synonyms});
const runPlain = q => ixPlain.query(q, {limit: 10}).map(h => h.id), runSyn = q => ixSyn.query(q, {limit: 10}).map(h => h.id);
const M = {
  includes_toate_cuvintele: metrics(simpleAll), includes_oricare_cuvant_clasat: metrics(simpleAny),
  fff_search_fara_sinonime: metrics(runPlain), fff_search_cu_sinonime: metrics(runSyn)
};
const noFuzzy = metrics(q => ixPlain.query(q, {limit: 10, fuzzy: false, ngram: false}).map(h => h.id)); M.fff_search_doar_stemming_BM25 = noFuzzy;
const out = {};
for (const [k, v] of Object.entries(M)) out[k] = {success_at_5: v.success_at_5, recall_at_5: v.recall_at_5, mrr_at_10: v.mrr_at_10, by_category: v.by_category};
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes('--fails')) M.fff_search_cu_sinonime.per.filter(p => p.recall5 < 1).forEach(p => console.log('RATAT (cu sin.)', p.q, 'așteptat', p.rel, 'primele', p.top3));
if (process.argv.includes('--failsplain')) M.fff_search_fara_sinonime.per.filter(p => p.recall5 < 1).forEach(p => console.log('RATAT (fără sin.)', p.q, 'așteptat', p.rel, 'primele', p.top3));
ok(M.fff_search_fara_sinonime.recall_at_5 > M.includes_toate_cuvintele.recall_at_5 + 0.3, 'fff (fără sinonime) bate includes (toate cuvintele)');
ok(M.fff_search_fara_sinonime.recall_at_5 > M.includes_oricare_cuvant_clasat.recall_at_5, 'fff bate includes clasat');
ok(M.fff_search_cu_sinonime.recall_at_5 >= M.fff_search_fara_sinonime.recall_at_5, 'sinonimele nu strică');

// ---------- funcționalități ----------
let r = ixPlain.query('școala', {limit: 3}); ok(r[0].id === 11, 'diacritice: școala -> 11');
eq(ixPlain.query('SCOALA', {limit: 1})[0].id, ixPlain.query('Școala', {limit: 1})[0].id, 'majuscule/diacritice indiferente');
r = ixPlain.query('copiii bolnavi', {limit: 3}); ok(r[0].id === 2 && /<mark>copiii<\/mark>/i.test(r[0].html) && /<mark>bolnavi<\/mark>/i.test(r[0].html), 'evidențiere: ' + r[0].html);
ok(r[0].highlights.length >= 2 && r[0].highlights.every(([a, b]) => r[0].snippet.slice(a, b).length > 0), 'intervale de evidențiere');
const xss = S.index([{id: 'x', title: 't', text: 'ceva <script>alert(1)</script> test'}], {lang: 'ro'}).query('script test'); ok(!/<script>/.test(xss[0].html), 'HTML scăpat în evidențiere');
eq(ixPlain.query('tren', {mode: 'and', limit: 5}).length >= 1, true, 'mod and');
eq(ixPlain.query('tren zmeură', {mode: 'and'}).length, 0, 'and fără potrivire completă');
eq(ixPlain.query('', {}).length, 0, 'interogare goală'); eq(ixPlain.query('qqqqzzzz').length, 0, 'fără rezultate');
ok(ixPlain.query('bibliotca').map(h => h.id).includes(10), 'fuzzy: bibliotca');
ok(ixPlain.query('biblio', {prefix: true}).map(h => h.id).includes(10), 'prefix');
ok(S.index([{id: 1, text: 'Autobahnraststätte an der Straße'}, {id: 2, text: 'Banane'}], {lang: 'de'}).query('Strasse')[0].id === 1, 'DE ß/ss + compus');
ok(S.index([{id: 1, text: 'Kovács János háza a Duna-parton'}, {id: 2, text: 'alma'}], {lang: 'hu'}).query('hazak janos')[0].id === 1, 'HU ő/ű/diacritice');
ok(S.index([{id: 1, text: 'Les chevaux courent'}, {id: 2, text: 'le chat dort'}], {lang: 'fr'}).query('cheval')[0].id === 1, 'FR aux->al');
ok(S.index([{id: 1, text: 'The running dogs'}, {id: 2, text: 'a cat'}], {lang: 'en'}).query('dog')[0].id === 1, 'EN plural');
// sinonime la interogare
eq(ixPlain.query('automobil', {synonyms: [['automobil', 'autoturism']], limit: 1})[0].id, 4, 'sinonime date la interogare');

// ---------- serializare ----------
const exp = ixSyn.exportString(); const ixB = S.load(exp);
eq(runSyn('mașină electrică'), ixB.query('mașină electrică', {limit: 10}).map(h => h.id), 'index importat = original (cu sinonime stocate)');
eq(ixB.query('copiii bolnavi', {limit: 1})[0].html, ixSyn.query('copiii bolnavi', {limit: 1})[0].html, 'snippet identic după import');
const noDocs = ixSyn.exportString({docs: false}); ok(noDocs.length < exp.length, 'export fără documente mai mic');
const ixC = S.load(noDocs, {docs}); eq(ixC.query('doctor', {limit: 3}).map(h => h.id), ixSyn.query('doctor', {limit: 3}).map(h => h.id), 'import cu documente furnizate separat');
let thr = false; try { S.load('{"fmt":"x"}'); } catch (e) { thr = true; } ok(thr, 'format invalid aruncă');
if (typeof CompressionStream !== 'undefined') { const gz = await ixSyn.exportGzip(); ok(gz.length < exp.length * 0.6, 'gzip ' + gz.length + ' < ' + exp.length); }

// ---------- embeddings opționale: model fals, determinist ----------
const AX = [['masina', 'automobil', 'autoturism', 'vehicul', 'electric'], ['pisica', 'felina', 'motan'], ['spital', 'medic', 'doctor', 'bolnav']];
const fakeEmbed = async texts => texts.map(t => { const v = new Array(AX.length + 1).fill(0); S.tokenize(t).forEach(w => { AX.forEach((g, i) => { if (g.includes(w) || g.some(x => w.startsWith(x.slice(0, 5)))) v[i] += 1; }); v[AX.length] += 0.01; }); return v; });
const ixE = S.index(docs, {lang: 'ro'});
eq(ixE.query('motan').length, 0, 'fără model: „motan” nu are nicio potrivire lexicală');
let t1 = false; try { ixE.useEmbeddings({files: [new Blob(['x'])]}); } catch (e) { t1 = /furnizat/.test(e.message); } ok(t1, 'fișierele singure fără embed() sunt refuzate cu mesaj onest');
ixE.useEmbeddings({embed: fakeEmbed, name: 'fals-determinist'});
const prog = []; const nvec = await ixE.embedAll({batch: 16, onProgress: (d, t) => prog.push(d)}); eq(nvec, docs.length, 'toate documentele vectorizate'); eq(prog.at(-1), docs.length, 'progres');
r = await ixE.queryAsync('motan', {limit: 3}); eq(r[0].id, 65, 'hibrid: „motan” -> pisica (doar prin vector)'); ok(r[0].lexRank === null && r[0].embRank === 1, 'rang vector, fără rang lexical');
r = await ixE.queryAsync('mașină', {limit: 3}); eq(r[0].id, 4, 'hibrid: mașină -> autoturism');
r = await ixE.queryAsync('tren Cluj', {limit: 3}); eq(r[0].id, 5, 'hibrid păstrează potrivirea lexicală');
const ixF = S.index(docs, {lang: 'ro'}); eq((await ixF.queryAsync('tren Cluj', {limit: 1}))[0].id, 5, 'queryAsync fără embeddings = lexical');
const pre = S.index(docs, {lang: 'ro'}).useEmbeddings({embed: fakeEmbed, vectors: Object.fromEntries((await fakeEmbed(docs.map(d => d.title + '. ' + d.text))).map((v, i) => [docs[i].id, v]))});
eq(await pre.embedAll(), docs.length, 'vectori precalculați furnizați de utilizator (fără apel embed pe documente)');

// ---------- performanță 5000+ documente ----------
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const SYL = 'ba be bi bo bu ca ce ci co cu da de di do du fa fe fi fo fu ga ge gi go gu la le li lo lu ma me mi mo mu na ne ni no nu pa pe pi po pu ra re ri ro ru sa se si so su ta te ti to tu va ve vi vo vu ză șe ți că întâ'.split(' ');
const words = Array.from({length: 18000}, () => { const n = 2 + Math.floor(rnd() * 3); let w = ''; for (let i = 0; i < n; i++) w += SYL[Math.floor(rnd() * SYL.length)]; return w + ['', 'ul', 'ii', 'ele', 'uri', 'area'][Math.floor(rnd() * 6)]; });
const zipf = () => words[Math.floor(Math.pow(rnd(), 2.2) * words.length)];
const sents = docs.map(d => d.text);
const big = Array.from({length: 6000}, (_, i) => { const s = []; for (let k = 0; k < 3; k++) s.push(sents[Math.floor(rnd() * sents.length)]); const extra = Array.from({length: 40}, zipf).join(' '); return {id: i, title: 'Document ' + zipf() + ' ' + zipf(), text: s.join(' ') + ' ' + extra}; });
const tI = performance.now(); const ixBig = S.index(big, {lang: 'ro'}); const buildMs = Math.round(performance.now() - tI);
const qs = []; for (let i = 0; i < 200; i++) { const d = big[Math.floor(rnd() * big.length)]; const ws = S.tokenize(d.text); let a = ws[Math.floor(rnd() * ws.length)], b = ws[Math.floor(rnd() * ws.length)]; if (i % 3 === 0 && a.length > 4) a = a.slice(0, -1) + 'x'; qs.push(a + ' ' + b); }
ixBig.query(qs[0]); // încălzire (construiește indexul de trigrame)
const tQ = performance.now(); let tot = 0; for (const q of qs) tot += ixBig.query(q, {limit: 10}).length; const qMs = (performance.now() - tQ) / qs.length;
const tQ2 = performance.now(); for (const q of qs) ixBig.query(q, {limit: 10, fuzzy: false, ngram: false}); const qMs2 = (performance.now() - tQ2) / qs.length;
const tE = performance.now(); const str = ixBig.exportString(); const expMs = Math.round(performance.now() - tE);
const tL = performance.now(); const ixL = S.load(str); const loadMs = Math.round(performance.now() - tL);
const tE2 = performance.now(); const strND = ixBig.exportString({docs: false}); 
const q0 = qs[5]; eq(ixL.query(q0, {limit: 5}).map(h => h.id), ixBig.query(q0, {limit: 5}).map(h => h.id), 'index mare: rezultate identice după import');
const gzBig = typeof CompressionStream !== 'undefined' ? (await ixBig.exportGzip()).length : null;
const perf = {documente: big.length, termeni_unici: ixBig.stats().terms, postari: ixBig.stats().postings, indexare_ms: buildMs, interogare_medie_ms_cu_fuzzy_si_ngrame: +qMs.toFixed(2), interogare_medie_ms_doar_BM25_stemming: +qMs2.toFixed(2),
  export_ms: expMs, export_octeti: str.length, export_fara_documente_octeti: strND.length, export_gzip_octeti: gzBig, import_ms: loadMs};
console.log('PERF', JSON.stringify(perf));
ok(big.length >= 5000 && buildMs < 8000 && qMs < 100, 'performanță acceptabilă');
fs.writeFileSync(new URL('./search-metrics.json', import.meta.url), JSON.stringify({corpus: {documente: docs.length, interogari: queries.length, sinonime_grupuri: synonyms.length}, relevanta: out, performanta: perf}, null, 1));
done('search');
