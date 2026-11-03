// Controlul sistematic al traducerilor automate (fr, it, es, pt, de, hu): fără vorbitori nativi, deci verificări mecanice, nu o garanție de calitate.
// Folosit de tools/traduceri-control.mjs (raport, CLI) și de tests/traduceri.test.mjs. Fără dependențe externe.
//
// Ce verifică (per segment, față de textul sursă en; ro e sursa de autor):
//   glosar      : termenii tehnici din data/traduceri.json → glossary, în forma acceptată a limbii; formele interzise (calcuri) sunt erori
//   invarianți  : comenzi, nume de fișiere/formate, cifre, text între ghilimele/backticks din sursă trebuie să apară neschimbate în traducere
//   lungime     : raport lungime traducere / en și lungime absolută a subtitrării (limite în `limits`)
//   caractere   : alfabetul limbii (ex. hu: ő ű, nu õ û), mojibake, caractere de înlocuire, litere românești scăpate (ă ș ț), spații duble, spațiere la punctuație, ghilimele drepte
//   netraduse   : segment identic cu en; cuvinte-funcție englezești rămase în text
//   marcaje     : starea „automat” / „revizuit” din fișiere vs. registrul data/traduceri-revizuite.json (vezi checkMarkers)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
export const MT = ['fr', 'it', 'es', 'pt', 'de', 'hu'];   // limbile traduse automat
export const LANG_NAME = {fr: 'franceză', it: 'italiană', es: 'spaniolă', pt: 'portugheză', de: 'germană', hu: 'maghiară'};

const rd = (f) => fs.readFileSync(f, 'utf8');
export const loadRegistry = (hub) => JSON.parse(rd(path.join(hub, 'data', 'traduceri.json')));
export const loadReviews = (hub) => JSON.parse(rd(path.join(hub, 'data', 'traduceri-revizuite.json')));

// ------------------------------------------------------------------ extractoare: {unit, lang, key, text, ref (en), dur?}
function vttCues(file) {
  const out = [], t = rd(file).replace(/\r/g, '').split(/\n\n+/);
  for (const b of t) {
    const m = b.match(/^(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})\n([\s\S]+)$/m);
    if (m) out.push({start: +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000, end: +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000, text: m[9].replace(/\n/g, ' ')});
  }
  return out;
}

function fromVtt(unit, dir, base, langs = LANGS) {
  const segs = {};
  for (const l of langs) { const f = path.join(dir, `${base}.${l}.vtt`); if (fs.existsSync(f)) segs[l] = vttCues(f); }
  const out = [];
  for (const l of MT) for (let i = 0; i < ((segs[l] || []).length); i++) out.push({unit, lang: l, key: `${base}#${i + 1}`, text: segs[l][i].text, ref: (segs.en[i] || {}).text, ro: (segs.ro[i] || {}).text, dur: segs[l][i].end - segs[l][i].start, file: path.join(dir, `${base}.${l}.vtt`)});
  const counts = Object.fromEntries(langs.map((l) => [l, (segs[l] || []).length]));
  return {segments: out, counts};
}

/** demo/nativ: subtitrări (4 programe × 8 limbi) + șirurile interfeței (nativ-data.js). */
export function extractNativ(hub) {
  const dir = path.join(hub, 'demo', 'nativ'), out = [], struct = [];
  for (const s of ['tezaur', 'veriga', 'legatorocr', 'osatura']) {
    const r = fromVtt('nativ', dir, s); out.push(...r.segments);
    const n = new Set(Object.values(r.counts)); if (n.size !== 1) struct.push(`nativ:${s}: numărul de replici diferă între limbi ${JSON.stringify(r.counts)}`);
  }
  const D = JSON.parse(rd(path.join(dir, 'nativ-data.js')).replace(/^window\.NATIV=/, '').replace(/;\s*$/, ''));
  for (const l of MT) for (const k of Object.keys(D.ui.en)) if (!['auto', 'rev'].includes(k)) out.push({unit: 'nativ', lang: l, key: 'ui.' + k, text: D.ui[l][k] || '', ref: D.ui.en[k], ro: D.ui.ro[k], file: path.join(dir, 'nativ-data.js')});
  return {segments: out, struct};
}

/** TEZAUR: subtitrările tutorialelor (assets/tutorials/*.vtt) și dicționarul interfeței web (tezaur.html → I18N). */
export function extractTezaur(root) {
  const out = [], struct = [], dir = path.join(root, 'assets', 'tutorials');
  const ids = fs.readdirSync(dir).filter((f) => /\.en\.vtt$/.test(f)).map((f) => f.replace(/\.en\.vtt$/, '')).sort();
  for (const id of ids) {
    const r = fromVtt('tezaur-tutoriale', dir, id); out.push(...r.segments);
    if (new Set(Object.values(r.counts)).size !== 1) struct.push(`tezaur-tutoriale:${id}: numărul de replici diferă între limbi ${JSON.stringify(r.counts)}`);
  }
  const html = rd(path.join(root, 'tezaur.html')), m = html.match(/const I18N=(\{[\s\S]*?\});\nconst UI_LANGS/);
  if (!m) struct.push('tezaur-ui: dicționarul I18N nu a fost găsit în tezaur.html');
  else for (const [k, v] of Object.entries(JSON.parse(m[1]))) for (const l of MT) out.push({unit: 'tezaur-ui', lang: l, key: k.slice(0, 50), text: v[l] || '', ref: v.en, ro: k, file: path.join(root, 'tezaur.html')});
  return {segments: out, struct};
}

/** README.<l>.md ale unei aplicații, față de README.md (en): linie cu linie (structura trebuie să coincidă). */
export function extractReadme(unit, root) {
  const out = [], struct = [], en = rd(path.join(root, 'README.md')).replace(/\n+$/, '').split('\n');
  const ro = fs.existsSync(path.join(root, 'README.ro.md')) ? rd(path.join(root, 'README.ro.md')).split('\n') : [];
  for (const l of MT) {
    const f = path.join(root, `README.${l}.md`); if (!fs.existsSync(f)) { struct.push(`${unit}: lipsește README.${l}.md`); continue; }
    const t = rd(f).split('\n');
    const trim = (a) => { while (a.length && !a[a.length - 1].trim()) a.pop(); return a; };
    const strip = (a) => trim(a.filter((x) => !/^\s*<!--\s*traducere:/.test(x)));
    const tt = strip(t);
    if (tt.length !== en.length) struct.push(`${unit}: README.${l}.md are ${tt.length} linii, README.md are ${en.length}`);
    for (let i = 0; i < Math.min(tt.length, en.length); i++) if (en[i].trim() && !/^\[English\]|^\*\*English\*\*/.test(en[i])) out.push({unit, lang: l, key: `L${i + 1}`, text: tt[i], ref: en[i], ro: ro[i], file: f, readme: true});
  }
  return {segments: out, struct};
}

// ------------------------------------------------------------------ verificări
const rx = (s, f = 'iu') => new RegExp(s, f);
/** o formă din glosar = rădăcină (prefix de cuvânt); începutul trebuie să fie începutul unui cuvânt */
// de și hu formează cuvinte compuse / aglutinate: formele acceptate pot fi precedate de alte litere (Textbericht, modellszerver)
const stem = (a, l = '') => !a || !a.length ? /(?!)/ : new RegExp('(?<![\\p{L}\\p{N}])(?:' + (l === 'de' || l === 'hu' ? '\\p{L}*' : '') + '(?:' + a.join('|') + '))', 'iu');

const ALPHA = {
  fr: 'a-zàâäçéèêëîïôöùûüÿœæ', it: 'a-zàèéìíòóùú', es: 'a-záéíóúüñ', pt: 'a-záàâãçéêíóôõú', de: 'a-zäöüß', hu: 'a-záéíóöőúüű',
};
const FUNCTION_EN = /(?<![\p{L}\p{N}'’-])(the|and|with|your|from|which|are|this|that|here|its|their|nothing|does|only|command|commands|library|searches|returns|files|checks|then|into)(?![\p{L}\p{N}'’-])/giu;
// cuvinte englezești valide și în limbile țintă în anumite contexte (nume proprii, jargon păstrat intenționat)
const EN_OK = new Set(['command', 'files']);

export function checkSegment(s, reg, opt = {}) {
  const l = s.lang, out = [], push = (sev, code, msg) => out.push({sev, code, unit: s.unit, lang: l, key: s.key, msg, file: s.file});
  const t = s.text || '', ref = s.ref || '', lim = reg.limits;
  if (!t.trim()) { push('eroare', 'gol', 'traducere goală'); return out; }
  // caractere
  if (/[�]|Ã[\u0080-¿]|â€|Â[ -¿]/.test(t)) push('eroare', 'mojibake', 'caractere deteriorate (mojibake / înlocuire)');
  // cuvintele care apar identic în sursa ro sau en (nume de limbi, etichete citate din interfața românească, nume proprii) nu se judecă la alfabet
  const known = new Set([...(`${s.ro || ''} ${ref}`).matchAll(/[\p{L}]+/gu)].map((m) => m[0].toLowerCase().slice(0, 5)));
  const own = [...t.matchAll(/[\p{L}]+/gu)].map((m) => m[0]).filter((w) => !known.has(w.toLowerCase().slice(0, 5))).join(' ');
  const letters = [...own.matchAll(/\p{L}/gu)].map((m) => m[0]);
  const bad = new Set(letters.filter((c) => !new RegExp('[' + ALPHA[l] + ']', 'iu').test(c)));
  if (bad.size) push('eroare', 'alfabet', `litere din afara alfabetului ${l}: ${[...bad].join(' ')}`);
  if (l === 'hu' && /[õûÕÛ]/.test(own)) push('eroare', 'alfabet', 'hu: õ/û în loc de ő/ű (diacritice din Latin-1)');
  if (/[ășțşţ]/i.test(own) || (l !== 'fr' && /î/i.test(own)) || (l !== 'fr' && l !== 'pt' && /â/i.test(own))) push('eroare', 'ro-scapat', 'litere românești în traducere');
  if (/ {2,}/.test(t.replace(/^\s+/, ''))) push('avertisment', 'spatii', 'spații duble');
  if (l !== 'fr' && /\s[:;?!]/.test(t) && !/\s[:;?!]\s*$/.test(t.slice(0, 0))) push('avertisment', 'punctuatie', 'spațiu înainte de : ; ? ! (regulă franceză, nu a limbii)');
  if (l === 'fr' && /[^\s  ][:;?!](?=\s|$)/.test(t.replace(/https?:\/\/\S+/g, '').replace(/`[^`]*`/g, ''))) push('avertisment', 'punctuatie', 'fr: lipsește spațiul înainte de : ; ? !');
  if (/"/.test(t.replace(/`[^`]*`/g, '')) && !s.readme) push('avertisment', 'ghilimele', 'ghilimele drepte (" ") în loc de cele tipografice ale limbii');
  if (l === 'es' && ((t.match(/\?/g) || []).length !== (t.match(/¿/g) || []).length || (t.match(/!/g) || []).length !== (t.match(/¡/g) || []).length)) push('eroare', 'es-semne', 'spaniolă: ¿ ¡ nu se potrivesc cu ? !');
  // netraduse
  if (ref && t.trim() === ref.trim() && ref.trim().split(/\s+/).length >= 3 && ref.length >= 20 && t.trim() !== (s.ro || '').trim()) push('eroare', 'netradus', 'identic cu textul en');
  const leaked = [...t.replace(/`[^`]*`|https?:\/\/\S+|\([^)]*\)|\[[^\]]*\]/g, ' ').matchAll(FUNCTION_EN)].map((m) => m[1].toLowerCase()).filter((w) => !EN_OK.has(w));
  if (leaked.length >= 1) push('avertisment', 'cuvant-en', `cuvinte englezești rămase: ${[...new Set(leaked)].join(', ')}`);
  // invarianți din sursă: comenzi/ fișiere / cifre / ALLCAPS / cod
  if (ref) {
    const inv = new Set();
    for (const m of ref.matchAll(/`([^`]+)`/g)) inv.add(m[1]);
    for (const m of ref.matchAll(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)*)(?![\p{L}\p{N}])/gu)) inv.add(m[1]);
    for (const m of ref.matchAll(/(?<![\p{L}\p{N}_.-])([A-Z][A-Z0-9]{1,}|[A-Za-z]+(?:\.[a-z0-9]+)+|[a-z]+_[a-z_]+|--?[a-z][\w-]+|[A-Z][a-z]+[A-Z]\w*)(?![\p{L}\p{N}_-])/gu)) inv.add(m[1]);
    for (const w of (reg.invariantWords || [])) if (new RegExp('(?<![\\p{L}\\p{N}])' + w + '(?![\\p{L}\\p{N}])', 'u').test(ref)) inv.add(w);
    const alt = (reg.acronyms || {});
    const miss = [...inv].filter((x) => !t.includes(x) && !(opt.numAlt && /^\d/.test(x) && t.includes(x.replace('.', ','))) && !(alt[x] && alt[x][l] && t.includes(alt[x][l])));
    if (miss.length) push('eroare', 'invariant', `lipsește din traducere (trebuie păstrat): ${miss.join(' ')}`);
  }
  // lungime
  if (ref && ref.length >= 60 && t.length >= 20) {
    const r = t.length / ref.length;
    if (r > lim.ratioMax) push('avertisment', 'lungime', `de ${r.toFixed(2)} ori mai lungă decât en (limită ${lim.ratioMax})`);
    if (r < lim.ratioMin) push('avertisment', 'lungime', `doar ${r.toFixed(2)} din lungimea en (limită ${lim.ratioMin}): posibil incompletă`);
  }
  if (!s.readme && s.key.includes('#') && t.length > lim.cueMaxChars) push('avertisment', 'subtitrare', `subtitrare de ${t.length} caractere (limită ${lim.cueMaxChars})`);
  if (s.dur && t.length / s.dur > lim.cps) push('avertisment', 'subtitrare', `${(t.length / s.dur).toFixed(1)} caractere/secundă (limită ${lim.cps})`);
  // glosar
  for (const g of reg.glossary) {
    if (!rx(g.en).test(ref) || (g.skipRef && rx(g.skipRef).test(ref))) continue;
    const f = g.forms && g.forms[l];
    if (f && !stem(f, l).test(t)) push('avertisment', 'glosar', `„${g.id}”: nu apare niciuna dintre formele acceptate (${f.join(' | ')})`);
    const fb = g.forbid && g.forbid[l];
    if (fb && stem(fb, l).test(t)) push('eroare', 'glosar', `„${g.id}”: formă interzisă (${fb.join(' | ')})`);
  }
  // deosebiri dintre limbi apropiate (calcuri frecvente)
  for (const r of (reg.confusions || [])) if (r.lang === l && new RegExp(r.re, 'iu').test(t)) push(r.sev || 'avertisment', 'confuzie', r.msg);
  return out;
}

/** Registrul (tu / vous, du / Sie): în aceeași unitate și limbă, un singur registru. Cuvintele se potrivesc doar ca cuvinte întregi, cu majuscule/minuscule respectate pentru formele de politețe. */
export function checkRegister(segs, reg) {
  const out = [], w = (a, f) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + a + ')(?![\\p{L}\\p{N}])', f);
  const by = new Map();
  for (const s of segs) { const k = s.unit + '|' + s.lang; (by.get(k) || by.set(k, []).get(k)).push(s); }
  for (const [k, list] of by) {
    const [unit, l] = k.split('|'), r = reg.register && reg.register[l]; if (!r) continue;
    let inf = 0, frm = 0; const ex = {inf: null, frm: null};
    for (const s of list) {
      const t = s.text.replace(/`[^`]*`/g, ''); // formele de politețe cu majusculă (de, it) se potrivesc exact; celelalte fără majuscule
      const fFlags = l === 'de' || l === 'it' ? 'gu' : 'giu';
      const a = t.match(w(r.informal, 'giu')), b = t.match(w(r.formal, fFlags));
      if (a) { inf += a.length; ex.inf ||= s.key; }
      if (b) { frm += b.length; ex.frm ||= s.key; }
    }
    if (inf && frm) out.push({sev: 'avertisment', code: 'registru', unit, lang: l, key: ex.inf, msg: `registru amestecat: informal ×${inf} (ex. ${ex.inf}) și formal ×${frm} (ex. ${ex.frm})`});
  }
  return out;
}

/** Consecvența: aceeași formă pentru același termen în toate segmentele unei limbi (o singură familie de forme folosită; mai multe = avertisment). */
export function checkConsistency(segs, reg) {
  const out = [];
  for (const g of reg.glossary) {
    for (const l of MT) {
      const fm = g.forms && g.forms[l]; if (!fm || fm.length < 2) continue;
      const used = new Map();
      for (const s of segs) if (s.lang === l && rx(g.en).test(s.ref || '')) for (const f of fm) if (stem([f], l).test(s.text)) used.set(f, (used.get(f) || 0) + 1);
      if (used.size > 1 && !g.synonyms) out.push({sev: 'avertisment', code: 'consecventa', unit: segs[0] && segs[0].unit, lang: l, key: g.id, msg: `„${g.id}” tradus în mai multe feluri: ${[...used].map(([f, n]) => f + '×' + n).join(', ')}`});
    }
  }
  return out;
}

// ------------------------------------------------------------------ marcaje „automat” / „revizuit”
/** Citește marcajele `traducere: fr=automat hu=revizuit:Nume:2026-12-01` dintr-un text. Returnează {lang: {state, by?, date?}} sau null dacă nu există niciun marcaj. */
export function parseMarker(text) {
  const out = {}; let found = false;
  for (const m of text.matchAll(/traducere:\s*((?:[a-z]{2}=[^\s\]>*,;]+(?:[ ,]+(?=[a-z]{2}=))?)+)/g)) {
    found = true;
    for (const p of m[1].matchAll(/([a-z]{2})=([^\s\]>*,;]+)/g)) {
      const v = p[2];
      if (v === 'automat') out[p[1]] = {state: 'automat'};
      else { const r = v.match(/^revizuit:(.+):(\d{4}-\d\d-\d\d)$/); out[p[1]] = r ? {state: 'revizuit', by: r[1].replace(/_/g, ' '), date: r[2]} : {state: 'invalid', raw: v}; }
    }
  }
  return found ? out : null;
}

/** Fraze vizibile „traducere automată / neverificată de vorbitori nativi”, în fiecare limbă (README-uri, pagini). */
export const AUTO_SENTENCE = {
  ro: /automat|nerevizuit|vorbitori nativi/i, en: /automatic|machine|native speaker/i, fr: /automatiques?\b|locuteurs? natifs?/i, it: /automatic[hi]e?|madrelingua/i,
  es: /autom[aá]tic[ao]s?|hablantes? nativos?/i, pt: /autom[aá]tic[ao]s?|falantes? nativos?|nativos/i, de: /automatisch|Muttersprachler/i, hu: /automatikus|anyanyelvi/i,
};

/** Variantă strictă pentru README-uri: doar propoziția „traducerile … sunt automate / neverificate de vorbitori nativi”, nu orice „automat(ă)”. */
export const AUTO_SENTENCE_STRICT = {
  fr: /automatiques et non v[ée]rifi[ée]es/i, it: /automatiche e non verificate/i, es: /autom[aá]ticas y no est[aá]n revisadas/i,
  pt: /autom[aá]ticas e n[aã]o foram revistas/i, de: /automatisch und nicht von Muttersprachlern/i, hu: /automatikusak, anyanyelvi besz[eé]l[oő]k nem ellen[oő]rizt[eé]k/i,
};

const VALID_DATE = /^\d{4}-\d\d-\d\d$/;
const PLACEHOLDER = /^(nume|name|todo|tbd|xxx*|\?+|n\/a|-+)$/i;

export function checkReviewEntries(reviews, reg, today = new Date().toISOString().slice(0, 10)) {
  const out = [], seen = new Set();
  const units = new Set(reg.units.map((u) => u.id));
  for (const r of reviews.reviews || []) {
    const id = `${r.unit}/${r.lang}`;
    if (!units.has(r.unit)) out.push(`registru: unitate necunoscută „${r.unit}”`);
    if (!MT.includes(r.lang)) out.push(`registru: ${id}: limba trebuie să fie una dintre ${MT.join(', ')}`);
    if (!r.by || typeof r.by !== 'string' || r.by.trim().length < 3 || PLACEHOLDER.test(r.by.trim()) || /[:\]>]/.test(r.by)) out.push(`registru: ${id}: „by” trebuie să fie numele revizorului (cel puțin 3 caractere, fără : ] >)`);
    if (!VALID_DATE.test(r.date || '') || r.date > today) out.push(`registru: ${id}: „date” trebuie să fie AAAA-LL-ZZ, nu în viitor`);
    if (seen.has(id)) out.push(`registru: ${id}: dublură`); seen.add(id);
  }
  return out;
}

/** Marcajul „automat” dispare doar când există revizuire în registru (și invers: revizuirea din registru cere marcaj „revizuit de <nume>” în fișiere).
 *  `files` = [{file, text, langs?}] pentru unitate; `langScoped` = fișierul poartă marcajul unei singure limbi (README.<l>.md). */
export function checkMarkers(unit, reviews, files, opt = {}) {
  const out = [], rev = new Map((reviews.reviews || []).filter((r) => r.unit === unit.id).map((r) => [r.lang, r]));
  const seen = new Set();
  for (const f of files) {
    const mk = parseMarker(f.text), rel = f.rel || f.file;
    if (!mk) { out.push(`${unit.id}: ${rel}: lipsește marcajul „traducere: …” (automat sau revizuit)`); continue; }
    for (const [l, st] of Object.entries(mk)) {
      if (!MT.includes(l)) { out.push(`${unit.id}: ${rel}: marcaj pentru o limbă netradusă automat: ${l}`); continue; }
      if (f.lang && f.lang !== l) { out.push(`${unit.id}: ${rel}: marcajul e pentru ${l}, fișierul e ${f.lang}`); continue; }
      seen.add(l);
      const r = rev.get(l);
      if (st.state === 'invalid') out.push(`${unit.id}/${l}: ${rel}: marcaj invalid „${st.raw}” (forma: automat sau revizuit:Nume:AAAA-LL-ZZ, cu _ în loc de spații)`);
      else if (st.state === 'automat' && r) out.push(`${unit.id}/${l}: ${rel}: registrul spune „revizuit de ${r.by}”, dar fișierul are încă marcajul „automat”`);
      else if (st.state === 'revizuit' && !r) out.push(`${unit.id}/${l}: ${rel}: marcajul „automat” a dispărut fără o revizuire în data/traduceri-revizuite.json`);
      else if (st.state === 'revizuit' && (r.by !== st.by || r.date !== st.date)) out.push(`${unit.id}/${l}: ${rel}: marcajul (${st.by}, ${st.date}) nu coincide cu registrul (${r.by}, ${r.date})`);
      // textul vizibil trebuie să urmeze starea
      if (f.visible !== false && f.visibleSentence) {
        const has = f.visibleSentence(l);
        if (st.state === 'automat' && has === false) out.push(`${unit.id}/${l}: ${rel}: marcaj „automat”, dar fraza vizibilă despre traducerea automată lipsește`);
        if (st.state === 'revizuit' && has === true) out.push(`${unit.id}/${l}: ${rel}: marcaj „revizuit”, dar fraza vizibilă „traducere automată” a rămas`);
      }
    }
  }
  for (const l of rev.keys()) if (!seen.has(l)) out.push(`${unit.id}/${l}: revizuire în registru, dar niciun fișier nu poartă marcajul limbii`);
  return out;
}

export function summarize(findings) {
  const by = {}; for (const f of findings) { const k = `${f.unit}|${f.lang}`; (by[k] ||= {eroare: 0, avertisment: 0}); by[k][f.sev]++; }
  return by;
}

export function evalFile(file) { return vm.runInNewContext(rd(file)); }

// ------------------------------------------------------------------ raportul generat (docs/TRADUCERI-REVIZIE.md, între <!-- gen:start --> și <!-- gen:end -->)
export const GEN_START = '<!-- gen:start (tools/traduceri-control.mjs --report; nu edita de mână) -->', GEN_END = '<!-- gen:end -->';

/** Fișierele unei unități, pe limbă: din registru (fără acces la depozitele externe). */
export function unitFiles(u, lang) {
  const out = [];
  const ids = u.ids && u.ids.length ? u.ids : [null];
  for (const f of u.files) for (const id of ids) out.push(f.replace('{id}', id || '').replace('{l}', lang));
  for (const e of u.extra || []) out.push(e.replace('{id}', (u.ids || [])[0] || '').replace('{l}', lang));
  return [...new Set(out)];
}

export function generateReport(reg, reviews) {
  const rev = new Map((reviews.reviews || []).map((r) => [`${r.unit}/${r.lang}`, r]));
  const L = [];
  L.push('### Stare pe unitate și limbă', '');
  L.push('| Unitate | Depozit | ' + MT.join(' | ') + ' |', '|---|---|' + MT.map(() => '---').join('|') + '|');
  for (const u of reg.units) L.push(`| ${u.title} | ${u.repo} | ` + MT.map((l) => { const r = rev.get(`${u.id}/${l}`); return r ? `revizuit de ${r.by} (${r.date})` : 'automat'; }).join(' | ') + ' |');
  const waiting = [];
  for (const u of reg.units) for (const l of MT) if (!rev.has(`${u.id}/${l}`)) waiting.push([u, l]);
  const total = reg.units.length * MT.length;
  L.push('', `Așteaptă revizuire nativă: **${waiting.length} din ${total}** perechi unitate × limbă; revizuite: ${total - waiting.length}.`, '');
  L.push('### Fișiere care așteaptă revizuire nativă', '', 'Căile sunt relative la depozitul unității. Unde apare `{id}`, identificatorii sunt enumerați în paranteză.', '');
  for (const l of MT) {
    const mine = waiting.filter(([, ll]) => ll === l);
    L.push(`#### ${l} · ${LANG_NAME[l]} (${mine.length} unități)`, '');
    if (!mine.length) { L.push('Toate unitățile sunt revizuite.', ''); continue; }
    for (const [u] of mine) {
      const ids = u.ids && u.ids.length ? u.ids : null;
      L.push(`- **${u.title}** (${u.repo})`);
      for (const f of u.files) L.push(`  - \`${f.replace('{l}', l)}\`${ids ? ` × ${ids.length} (${f.includes('{id}') ? 'id: ' + ids.join(', ') : ''})` : ''}`);
      for (const e of u.extra || []) L.push(`  - ${e.replace('{l}', l).replace(/^([^ ]+)/, '`$1`')}`);
    }
    L.push('');
  }
  return L.join('\n');
}

export function applyReport(doc, gen) {
  const a = doc.indexOf(GEN_START), b = doc.indexOf(GEN_END);
  if (a < 0 || b < a) throw new Error('docs/TRADUCERI-REVIZIE.md nu are marcajele gen:start / gen:end');
  return doc.slice(0, a + GEN_START.length) + '\n\n' + gen + '\n' + doc.slice(b);
}
