// Funcții comune pentru metadatele de catalog (data/catalog-meta.json): folosite de tools/sync-catalog.mjs și de teste.
// Fără dependențe externe.
import fs from 'node:fs';
import path from 'node:path';

export const LANGS8 = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
export const PLATFORMS = ['web', 'native'];
export const STATUSES = ['stable', 'experimental', 'alpha', 'lab'];

export function loadMeta(hub) {
  const meta = JSON.parse(fs.readFileSync(path.join(hub, 'data', 'catalog-meta.json'), 'utf8'));
  meta.apps ||= {}; meta.kinds ||= {}; meta.variants ||= {}; meta.related ||= []; meta.topics ||= []; meta.extraRelations ||= []; meta.dataSources ||= {};
  return meta;
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
  // scor de audit + stare „laborator” + ordinea din „Recomandate”
  const thr = meta.policy && Number.isFinite(meta.policy.labThreshold) ? meta.policy.labThreshold : 5;
  for (const [k, v] of Object.entries(meta.apps)) {
    if (v.score !== undefined && !(typeof v.score === 'number' && v.score >= 0 && v.score <= 10)) out.push(`catalog-meta: ${k}: „score” trebuie să fie un număr între 0 și 10`);
    if (typeof v.score === 'number' && v.score < thr && v.status !== 'lab') out.push(`catalog-meta: ${k}: scor ${v.score} sub pragul ${thr}, dar starea nu e „lab” (laborator)`);
    if (v.measured !== undefined && !(v.measured && typeof v.measured.score === 'number' && v.measured.score >= 0 && v.measured.score <= 10 && /^\d{4}-\d\d-\d\d$/.test(v.measured.date || ''))) out.push(`catalog-meta: ${k}: „measured” trebuie să fie {score 0–10, date AAAA-LL-ZZ}`);
    if (v.status === 'lab' && typeof v.score !== 'number') out.push(`catalog-meta: ${k}: starea „lab” cere un „score” de audit`);
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
    let prev = Infinity;
    for (const k of bySection.recomandate) {
      const a = meta.apps[k] || {};
      if (a.status === 'lab') out.push(`Recomandate: ${k} e în laborator și nu are ce căuta în „Recomandate”`);
      if (typeof a.score !== 'number') { out.push(`Recomandate: ${k} nu are scor de audit în catalog-meta`); continue; }
      if (a.score < thr) out.push(`Recomandate: ${k} are scor ${a.score}, sub pragul ${thr}`);
      if (a.score > prev) out.push(`Recomandate: ordinea nu e descrescătoare după scor (${k}, ${a.score}, vine după un scor ${prev})`);
      prev = a.score;
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
