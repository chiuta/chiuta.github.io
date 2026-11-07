// Funcții comune pentru metadatele de catalog (data/catalog-meta.json): folosite de tools/sync-catalog.mjs și de teste.
// Fără dependențe externe.
import fs from 'node:fs';
import path from 'node:path';

export const LANGS8 = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
export const PLATFORMS = ['web', 'native'];
/** Carduri cu versiune/dată/linkuri întreținute de mână (nu din <meta> și app.json): sync-catalog nu le sincronizează, iar make-fixtures --check nu le compară cu fixtura. */
export const EXTERNAL = new Set(['OSATURA', 'VERIGA', 'TEZAUR', 'LegatorOCR', 'Fenarium', 'MENSURA', 'BRAZDA', 'VOIAJOR', 'CHIROMANTIA', 'PUNCTUM']);
export const STATUSES = ['stable', 'experimental', 'alpha', 'lab'];

export function loadMeta(hub) {
  const meta = JSON.parse(fs.readFileSync(path.join(hub, 'data', 'catalog-meta.json'), 'utf8'));
  meta.apps ||= {}; meta.kinds ||= {}; meta.variants ||= {}; meta.related ||= []; meta.topics ||= []; meta.extraRelations ||= []; meta.dataSources ||= {};
  // Scorul MĂSURAT vine dintr-o singură sursă: data/transparenta.json → a7.apps (tools/audit-run.mjs + `transparenta.mjs audit`). Nu mai e copiat în catalog-meta.json.
  const m = measuredScores(hub);
  for (const [k, x] of Object.entries(m)) (meta.apps[k] ||= {}).measured = x;
  return meta;
}

/** Scorurile măsurate din data/transparenta.json (a7): {Nume: {score, date[, tests: 0]}}. Aplicațiile fără scor (incomplete sau nemăsurate) lipsesc. */
export function measuredScores(hub) {
  const f = path.join(hub, 'data', 'transparenta.json');
  if (!fs.existsSync(f)) return {};
  const a7 = JSON.parse(fs.readFileSync(f, 'utf8')).a7;
  const out = {};
  if (a7 && Array.isArray(a7.apps)) for (const r of a7.apps) if (r && r.key && typeof r.score === 'number') out[r.key] = {score: r.score, date: r.date || a7.date, ...(r.tests === 0 ? {tests: 0} : {})};
  return out;
}

/** Scorul folosit la ordonare și praguri: cel MĂSURAT; `score` (manual, depreciat) doar ca rezervă pentru o aplicație fără scor măsurat. null dacă nu are niciunul. */
export function scoreOf(app) {
  if (app && app.measured && typeof app.measured.score === 'number') return app.measured.score;
  if (app && typeof app.score === 'number') return app.score;
  return null;
}

/** Stare: suprascrierea din meta (dacă există), altfel regula: 0.x sau sufix -alpha/-beta/-rc → alpha; restul → stable. */
export function deriveStatus(version, override) {
  if (override && STATUSES.includes(override)) return override;
  if (/^0\./.test(version || '') || /-(alpha|beta|rc|pre)/i.test(version || '')) return 'alpha';
  return 'stable';
}

/** Textul de pe card: versiunea + (ultima schimbare de fond, dacă e cunoscută). Data de sincronizare rămâne doar în data-upd. */
export function verText(version, substantive) {
  void substantive; // data ultimei schimbări de fond rămâne în fișă și în titlul etichetei, nu pe card
  return `v${version}`;
}

/** Graful relațiilor declarate (Etapa 3): grupurile vechi `related`, subiectele `topics` (clici) și perechile `extraRelations`.
 *  Întoarce {cheie: [cheie înrudită, …]} simetric, ordonat după greutate (câte legături comune) apoi alfabetic. */
export function buildRelations(meta) {
  const w = new Map();
  const add = (a, b, x = 1) => { if (a === b) return; for (const [p, q] of [[a, b], [b, a]]) { if (!w.has(p)) w.set(p, new Map()); w.get(p).set(q, (w.get(p).get(q) || 0) + x); } };
  for (const g of meta.related || []) for (const a of g) for (const b of g) add(a, b);
  for (const t of meta.topics || []) for (const a of t.members) for (const b of t.members) add(a, b);
  for (const [a, b] of meta.extraRelations || []) add(a, b, 2);
  const out = {};
  for (const [k, m] of [...w].sort((x, y) => x[0].localeCompare(y[0]))) out[k] = [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map((e) => e[0]);
  return out;
}

/** Variantele (carduri ascunse în fișa hub-ului): cheie variantă → cheia hub-ului. */
export function variantOf(meta) {
  const out = {};
  for (const [hub, list] of Object.entries(meta.variants)) for (const v of list) out[v] = hub;
  return out;
}

/** Scor de acoperire 0–4 din numărul de limbi (din cele 8). */
export function coverageScore(n) { return n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0; }

/** Contoare derivate din lista reală de carduri (chei). */
export function counts(meta, keys, sections) {
  const vo = variantOf(meta);
  const engines = keys.filter((k) => meta.kinds[k] === 'engine').length;
  const variants = keys.filter((k) => vo[k]).length;
  return {singleFile: keys.length - engines, listed: keys.length - variants - engines, variants, engines, sections};
}

/** Verificări de coerență ale metadatelor față de lista de carduri. Returnează mesaje de problemă. */
export function validateMeta(meta, keys, bySection = null) {
  const set = new Set(keys), out = [];
  for (const k of Object.keys(meta.apps)) if (!set.has(k)) out.push(`catalog-meta: aplicația „${k}” nu are card`);
  for (const [h, list] of Object.entries(meta.variants)) for (const k of [h, ...list]) if (!set.has(k)) out.push(`catalog-meta: varianta/hub-ul „${k}” nu are card`);
  const rel = buildRelations(meta), vo = variantOf(meta);
  for (const t of meta.topics) {
    if (!t.id || !t.name || !t.kw) out.push(`catalog-meta: subiectul „${t.id}” nu are id/name/kw`);
    for (const l of LANGS8) if (!t.name || !t.name[l]) out.push(`catalog-meta: subiectul „${t.id}” nu are numele în limba ${l}`);
    for (const k of t.members || []) if (!set.has(k)) out.push(`catalog-meta: subiectul „${t.id}”: aplicația „${k}” nu are card`);
  }
  for (const r of meta.extraRelations) if (r.length < 2 || r.length > 3 || (r[2] !== undefined && !(typeof r[2] === 'string' && r[2].trim().length > 8))) out.push(`catalog-meta: relația ${JSON.stringify(r)}: forma e [A, B] sau [A, B, "motiv în cuvinte"]`);
  for (const [a, b] of meta.extraRelations) for (const k of [a, b]) if (!set.has(k)) out.push(`catalog-meta: relația „${a}”–„${b}”: „${k}” nu are card`);
  for (const k of keys) if (!vo[k] && (rel[k] || []).length < 2) out.push(`catalog-meta: „${k}” are ${(rel[k] || []).length} relații declarate (minim 2)`);
  for (const g of meta.related) for (const k of g) if (!set.has(k)) out.push(`catalog-meta: aplicația înrudită „${k}” nu are card`);
  for (const [k, v] of Object.entries(meta.apps)) {
    if (v.status && !STATUSES.includes(v.status)) out.push(`catalog-meta: ${k}: stare necunoscută „${v.status}”`);
    if (v.substantive && !/^\d{4}-\d\d-\d\d$/.test(v.substantive)) out.push(`catalog-meta: ${k}: „substantive” trebuie să fie AAAA-LL-ZZ`);
    if (v.screenshot && !/^[\w./-]+\.(png|jpe?g|webp|gif|svg)$/i.test(v.screenshot)) out.push(`catalog-meta: ${k}: „screenshot” trebuie să fie o cale relativă către o imagine din hub`);
  }
  for (const [k, v] of Object.entries(meta.apps)) {
    if (!v.figures) continue;
    for (const l of ['ro', 'en']) {
      const c = v.fisa && v.fisa[l] && v.fisa[l].cifre;
      if (!c || !/\d{4}-\d\d-\d\d/.test(c)) out.push(`catalog-meta: ${k}: „figures” cere în fișa ${l} un text „cifre” cu sursă și dată AAAA-LL-ZZ`);
    }
  }
  // evidence / coverage / health / fragile
  const pol = meta.policy || {};
  for (const [k, v] of Object.entries(meta.apps)) {
    if (v.evidence !== undefined && !(v.evidence && Number.isInteger(v.evidence.level) && v.evidence.level >= 0 && v.evidence.level <= 4)) out.push(`catalog-meta: ${k}: „evidence.level” trebuie să fie un întreg 0–4`);
    if (v.health !== undefined && v.health !== true) out.push(`catalog-meta: ${k}: „health” poate fi doar true`);
    if (v.fragile !== undefined && v.fragile !== true) out.push(`catalog-meta: ${k}: „fragile” poate fi doar true`);
    if (v.checked !== undefined && !/^\d{4}-\d\d-\d\d$/.test(v.checked)) out.push(`catalog-meta: ${k}: „checked” trebuie să fie AAAA-LL-ZZ`);
    if (v.coverage !== undefined) {
      const c = v.coverage;
      if (!c || !Array.isArray(c.langs) || !c.langs.length || c.langs.some((l) => !LANGS8.includes(l))) out.push(`catalog-meta: ${k}: „coverage.langs” trebuie să fie o listă nevidă din ${LANGS8.join(',')}`);
      if (!c || !PLATFORMS.includes(c.platform)) out.push(`catalog-meta: ${k}: „coverage.platform” trebuie să fie ${PLATFORMS.join(' sau ')}`);
    }
  }
  for (const [list, field] of [['evidenceRequired', 'evidence'], ['healthRequired', 'health'], ['fragileRequired', 'fragile']]) {
    for (const k of pol[list] || []) if (!meta.apps[k] || meta.apps[k][field] === undefined) out.push(`catalog-meta: ${k} trebuie să aibă „${field}” (policy.${list})`);
  }
  // scor MĂSURAT (data/transparenta.json) + `score` manual depreciat (rezervă) + stare „laborator” declarată explicit, independentă de scor
  for (const [k, v] of Object.entries(meta.apps)) {
    if (v.score !== undefined && !(typeof v.score === 'number' && v.score >= 0 && v.score <= 10)) out.push(`catalog-meta: ${k}: „score” trebuie să fie un număr între 0 și 10`);
    if (v.score !== undefined && v.measured && typeof v.measured.score === 'number') out.push(`catalog-meta: ${k}: „score” manual (depreciat) pe o aplicație cu scor măsurat; scoate-l (rezerva e doar pentru aplicațiile nemăsurate)`);
    if (v.measured !== undefined && !(v.measured && typeof v.measured.score === 'number' && v.measured.score >= 0 && v.measured.score <= 10 && /^\d{4}-\d\d-\d\d$/.test(v.measured.date || ''))) out.push(`catalog-meta: ${k}: „measured” trebuie să fie {score 0–10, date AAAA-LL-ZZ}`);
  }
  // Etapa 8.6: sursele externe ale aplicațiilor (derivate din data/sources.json de tools/refresh/meta.mjs)
  for (const [k, list] of Object.entries(meta.dataSources)) {
    if (!set.has(k)) { out.push(`catalog-meta: dataSources: „${k}” nu are card`); continue; }
    for (const e of list) {
      if (!e.id || !e.host) out.push(`catalog-meta: dataSources.${k}: sursă fără id/host`);
      if (!['înghețat', 'lent', 'viu'].includes(e.cad)) out.push(`catalog-meta: dataSources.${k}.${e.id}: cadență „${e.cad}”`);
      if (e.asOf && !/^\d{4}-\d\d(-\d\d)?$/.test(e.asOf)) out.push(`catalog-meta: dataSources.${k}.${e.id}: asOf trebuie să fie AAAA-LL[-ZZ]`);
    }
    if (list.filter((e) => e.card).length > 1) out.push(`catalog-meta: dataSources.${k}: cel mult o sursă „card” (cea afișată pe card)`);
  }
  if (bySection && bySection.recomandate) {
    // pragul nu mai decide „laborator” (aceea e câmpul `status`); doar interzice scoruri slabe în „Recomandate”
    const thr = meta.policy && Number.isFinite(meta.policy.labThreshold) ? meta.policy.labThreshold : 5;
    let prev = Infinity;
    for (const k of bySection.recomandate) {
      const a = meta.apps[k] || {};
      if (a.status === 'lab') out.push(`Recomandate: ${k} e în laborator și nu are ce căuta în „Recomandate”`);
      const sc = scoreOf(a);
      if (sc === null) { out.push(`Recomandate: ${k} nu are scor măsurat (data/transparenta.json) și nici rezerva „score”`); continue; }
      if (sc < thr) out.push(`Recomandate: ${k} are scor ${sc}, sub pragul ${thr}`);
      if (sc > prev) out.push(`Recomandate: ordinea nu e descrescătoare după scorul măsurat (${k}, ${sc}, vine după un scor ${prev})`);
      prev = sc;
    }
  }
  return out;
}

/** Fluxuri între aplicații (Etapa 4): data/flows.json. */
export function loadFlows(hub) {
  const f = path.join(hub, 'data', 'flows.json');
  if (!fs.existsSync(f)) return {schema: 1, flows: []};
  const o = JSON.parse(fs.readFileSync(f, 'utf8')); o.flows ||= []; return o;
}

const TYPE_RE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;
/** Coerența fluxurilor: id unic, nume și rezumat în 8 limbi, noduri cu card, tipuri valide, muchii care respectă „produce/acceptă”. */
export function validateFlows(flows, keys) {
  const set = new Set(keys), out = [], ids = new Set();
  for (const f of flows.flows || []) {
    const w = `fluxul „${f.id}”`;
    if (!f.id || ids.has(f.id)) out.push(`flows: id lipsă sau duplicat (${f.id})`); ids.add(f.id);
    for (const fld of ['name', 'summary']) for (const l of LANGS8) if (!f[fld] || !f[fld][l]) out.push(`flows: ${w}: „${fld}” nu are limba ${l}`);
    const nodes = f.nodes || {};
    for (const [k, nd] of Object.entries(nodes)) {
      if (!set.has(k)) out.push(`flows: ${w}: aplicația „${k}” nu are card`);
      if (!['web', 'cli'].includes(nd.mode)) out.push(`flows: ${w}: „${k}”: mode trebuie să fie web sau cli`);
      for (const t of [...(nd.accepts || []), ...(nd.produces || [])]) if (!TYPE_RE.test(t)) out.push(`flows: ${w}: „${k}”: tip de plic invalid „${t}”`);
    }
    if (!(f.edges || []).length) out.push(`flows: ${w} nu are muchii`);
    for (const [a, b, t] of f.edges || []) {
      if (!nodes[a] || !nodes[b]) { out.push(`flows: ${w}: muchia ${a}→${b}: nod nedefinit`); continue; }
      if (!(nodes[a].produces || []).includes(t)) out.push(`flows: ${w}: ${a} nu produce ${t}`);
      if (!(nodes[b].accepts || []).includes(t)) out.push(`flows: ${w}: ${b} nu acceptă ${t}`);
    }
  }
  return out;
}

/** Pe aplicație: {next: [{app,type,flow}], prev: [...]} — pentru „înlănțuie cu…” pe carduri. */
export function flowsByApp(flows) {
  const out = {};
  const slot = (k) => (out[k] ||= {next: [], prev: []});
  for (const f of flows.flows || []) for (const [a, b, t] of f.edges || []) {
    if (!slot(a).next.some((x) => x.app === b && x.type === t)) slot(a).next.push({app: b, type: t, flow: f.id});
    if (!slot(b).prev.some((x) => x.app === a && x.type === t)) slot(b).prev.push({app: a, type: t, flow: f.id});
  }
  return out;
}

/* ---- Relații cu justificare (Etapa 9) ----
 * O relație între două carduri e „semnificativă” doar dacă are cel puțin un motiv verificabil din depozit:
 *   topic:<id>      subiect (temă) comun, declarat în `topics` (clică curată, cu cuvinte-cheie în 8 limbi)
 *   related         grup `related` (declarat de mână)
 *   pair            pereche `extraRelations` (al treilea element, opțional, e motivul în cuvinte)
 *   variant         varianta și părintele ei, sau două variante ale aceluiași părinte
 *   flow:<id>       muchie sau nod din același flux declarat (data/flows.json)
 *   envelope:<tip>  unul PRODUCE un tip de plic SPECIFIC pe care celălalt îl ACCEPTĂ (tipurile generice nu contează singure)
 *   data:<gazdă>    aceeași sursă externă de date (data/sources.json → dataSources)
 *   module:<fff-x>  același motor comun cu date proprii (locație, pașaport, agendă, sunet, jurnal)
 * Motivele „tari” (strong) sunt toate în afară de topic și module. */
export const GENERIC_TYPES = new Set(['text/plain', 'text/markdown', 'table/csv']);
export const DATA_MODULES = new Set(['fff-place', 'fff-pasaport', 'fff-agenda', 'fff-sunet', 'fff-jurnal', 'fff-ai', 'fff-jocuri']);

/** Capacitățile de plic (produce/acceptă) pe slug, din registrul kitului + registry.extra.json + plan.json (module). */
export function loadEnvelopeInfo(hub) {
  const out = {types: {}, modules: {}};
  const add = (slug, p, a) => { const e = (out.types[slug] ||= {produces: new Set(), accepts: new Set()}); (p || []).forEach((t) => e.produces.add(t)); (a || []).forEach((t) => e.accepts.add(t)); };
  try {
    const src = fs.readFileSync(path.join(hub, 'fff-kit', 'bridge-adapters', 'registry.js'), 'utf8');
    const m = src.match(/var FFF_REG = (\[[\s\S]*?\]);/);
    if (m) for (const r of JSON.parse(m[1])) add(r.slug, r.produces, r.accepts);
  } catch { /* fără registru */ }
  try { for (const r of JSON.parse(fs.readFileSync(path.join(hub, 'tools', 'envelope-adapters', 'registry.extra.json'), 'utf8'))) add(r.slug, r.produces, r.accepts); } catch { /* fără extra */ }
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(hub, 'tools', 'envelope-adapters', 'plan.json'), 'utf8'));
    for (const [slug, v] of Object.entries(plan)) if (v && Array.isArray(v.libs)) out.modules[slug] = v.libs;
  } catch { /* fără plan */ }
  return out;
}

/** Toate relațiile (inclusiv variantele ascunse) cu motivele lor: {"A|B": {a, b, reasons: [...], strong: n}} (a < b alfabetic). */
export function relationEvidence(meta, flows, env) {
  const ev = new Map();
  const add = (a, b, reason) => { if (a === b) return; const [x, y] = a < b ? [a, b] : [b, a]; const k = x + '|' + y; const e = ev.get(k) || {a: x, b: y, reasons: []}; if (!e.reasons.includes(reason)) e.reasons.push(reason); ev.set(k, e); };
  const clique = (list, reason) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) add(list[i], list[j], reason); };
  for (const g of meta.related || []) clique(g, 'related');
  for (const t of meta.topics || []) clique(t.members || [], 'topic:' + t.id);
  const why = {};
  for (const [a, b, w] of meta.extraRelations || []) { add(a, b, 'pair'); if (w) why[(a < b ? a + '|' + b : b + '|' + a)] = w; }
  for (const [h, list] of Object.entries(meta.variants || {})) clique([h, ...list], 'variant');
  for (const f of flows.flows || []) { clique(Object.keys(f.nodes || {}), 'flow:' + f.id); }
  const slugKey = new Map();
  const keys = new Set();
  for (const e of ev.values()) { keys.add(e.a); keys.add(e.b); }
  for (const k of Object.keys(meta.apps || {})) keys.add(k);
  for (const k of keys) slugKey.set(k.toLowerCase(), k);
  // plic: A produce un tip specific pe care B îl acceptă
  if (env) {
    const list = [...slugKey].filter(([s]) => env.types[s]);
    for (const [sa, ka] of list) for (const [sb, kb] of list) {
      if (ka === kb) continue;
      for (const t of env.types[sa].produces) if (!GENERIC_TYPES.has(t) && env.types[sb].accepts.has(t)) add(ka, kb, 'envelope:' + t);
    }
    const byMod = {};
    for (const [slug, libs] of Object.entries(env.modules)) { const k = slugKey.get(slug); if (!k) continue; for (const l of libs) if (DATA_MODULES.has(l)) (byMod[l] ||= []).push(k); }
    for (const [l, list2] of Object.entries(byMod)) clique(list2, 'module:' + l);
  }
  // sursă externă comună (aceeași gazdă; doar surse care nu sunt „doar-inventar” ignorate? — contează orice gazdă declarată, dar nu aceeași aplicație)
  const byHost = {};
  for (const [k, list] of Object.entries(meta.dataSources || {})) for (const e of list) if (e.host && e.st !== 'oprit') (byHost[e.host] ||= new Set()).add(k);
  for (const [h, set] of Object.entries(byHost)) clique([...set], 'data:' + h);
  const out = {};
  for (const [k, e] of ev) { if (why[k]) e.why = why[k]; e.strong = e.reasons.filter((r) => !r.startsWith('topic:') && !r.startsWith('module:')).length; out[k] = e; }
  return out;
}

/** Relațiile pe card din dovezi: {cheie: [{with, reasons, strong}]}, ordonate după tăria motivelor. */
export function evidenceByCard(evidence) {
  const out = {};
  for (const e of Object.values(evidence)) for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) (out[x] ||= []).push({with: y, reasons: e.reasons, strong: e.strong});
  for (const l of Object.values(out)) l.sort((p, q) => q.strong - p.strong || q.reasons.length - p.reasons.length || p.with.localeCompare(q.with));
  return out;
}

/** Verifică: fiecare card (și fiecare variantă ascunsă) are ≥ `min` relații, fiecare cu cel puțin un motiv verificabil, către carduri existente.
 *  Un card ale cărui relații sunt toate doar „subiect” are nevoie de ≥1 motiv tare (pair/flow/envelope/data/related/variant) printre ele, ca să nu se țină doar de o clică largă. */
export function validateRelations(evidence, keys, {min = 2, broad = 8, topics = []} = {}) {
  const out = [], set = new Set(keys), by = evidenceByCard(evidence);
  const size = Object.fromEntries(topics.map((t) => ['topic:' + t.id, (t.members || []).length]));
  for (const e of Object.values(evidence)) for (const k of [e.a, e.b]) if (!set.has(k)) out.push(`relații: „${k}” nu are card`);
  for (const k of keys) {
    const rel = by[k] || [];
    if (rel.length < min) { out.push(`relații: „${k}” are ${rel.length} relații justificate (minim ${min})`); continue; }
    // o relație „doar subiect” dintr-un subiect larg (> broad membri) nu se numără singură
    const solid = rel.filter((r) => r.strong > 0 || r.reasons.some((x) => x.startsWith('module:')) || r.reasons.some((x) => x.startsWith('topic:') && (size[x] || 0) <= broad));
    if (solid.length < min) out.push(`relații: „${k}” are doar ${solid.length} relații cu motiv solid (minim ${min}; subiectele cu peste ${broad} membri nu ajung)`);
  }
  return out;
}
