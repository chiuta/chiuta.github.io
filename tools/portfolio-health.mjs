/* tools/portfolio-health.mjs — tabloul de bord al sănătății portofoliului (Etapa 7).
 *
 * Biblioteca calculează, DOAR din fișierele hubului (index.html cu cardurile, data/catalog-meta.json, data/flows.json, data/source-health.json,
 * data/sources.json și data/transparenta.json → a7), șase grupe de indicatori. Fără rețea, fără ceasul sistemului: data de referință e cea mai
 * recentă dată de pe carduri, deci rezultatul e determinist și `transparenta.mjs --check` îl poate recalcula în CI și compara cu ce e salvat.
 *
 *   relations : câte aplicații au cel puțin o relație (înrudite, relații suplimentare, variante, fluxuri), orfanii, numărul de perechi și de fluxuri
 *   coverage  : câte au toate cele 8 limbi, câte parțiale / monolingve, câte sunt native; media scorului de acoperire (0–4)
 *   score     : scorul MĂSURAT (a7): medie, mediană, benzi, câte fără teste, câte incomplete, cele mai slabe 5
 *   age       : învechirea după data cardului (data-upd) față de data de referință
 *   sources   : sănătatea surselor externe (active, ok, alertă, oprite, învechite)
 *   versions  : versiunile de pe carduri față de ce a fost măsurat (a7.apps[].ver) — dacă diferă, scorul e „vechi”
 */
import fs from 'node:fs';
import path from 'node:path';

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

export function readCards(html) {
  const out = [];
  for (const c of html.split('<div class="app-card"').slice(1)) {
    const key = (c.match(/data-c="apps\|([^|"]+)\|title"/) || [])[1];
    if (!key) continue;
    out.push({
      key, ver: (c.match(/data-ver="([^"]*)"/) || [])[1] || '', upd: (c.match(/data-upd="([^"]*)"/) || [])[1] || '',
      langs: ((c.match(/data-langs="([^"]*)"/) || [])[1] || '').split(',').filter(Boolean), plat: (c.match(/data-plat="([^"]*)"/) || [])[1] || 'web',
      off: (c.match(/data-off="([^"]*)"/) || [])[1] || 'no',
    });
  }
  return out;
}

export function computeHealth(HUB) {
  const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
  const cards = readCards(html);
  const meta = rj(path.join(HUB, 'data', 'catalog-meta.json'), {});
  const flows = (rj(path.join(HUB, 'data', 'flows.json'), {}).flows) || [];
  const T = rj(path.join(HUB, 'data', 'transparenta.json'), {});
  const sh = rj(path.join(HUB, 'data', 'source-health.json'), {sources: {}});
  const keys = cards.map((c) => c.key), set = new Set(keys);
  const ref = cards.map((c) => c.upd).filter(Boolean).sort().pop() || '1970-01-01';
  const days = (d) => Math.round((Date.parse(ref) - Date.parse(d)) / 864e5);

  // relații
  const pairs = new Set(), has = new Map(keys.map((k) => [k, new Set()]));
  const link = (a, b, why) => { if (!set.has(a) || !set.has(b) || a === b) return; pairs.add([a, b].sort().join('|')); has.get(a).add(why); has.get(b).add(why); };
  for (const g of meta.related || []) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) link(g[i], g[j], 'related');
  for (const [a, b] of meta.extraRelations || []) link(a, b, 'extra');
  for (const [p, vs] of Object.entries(meta.variants || {})) for (const v of vs) link(p, v, 'variant');
  const flowApps = new Set();
  for (const f of flows) { for (const k of Object.keys(f.nodes || {})) if (set.has(k)) flowApps.add(k); for (const [a, b] of f.edges || []) link(a, b, 'flow'); }
  for (const k of flowApps) has.get(k).add('flow');
  const orphans = keys.filter((k) => has.get(k).size === 0).sort();
  const relations = {withRelation: keys.length - orphans.length, orphans, pairs: pairs.size, flows: flows.length, flowApps: flowApps.size};

  // acoperire
  const covOf = (c) => {
    const o = ((meta.apps || {})[c.key] || {}).coverage || {};
    const langs = o.langs || c.langs, plat = o.platform || c.plat;
    return {n: langs.length, plat};
  };
  const sc = (n) => (n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);
  let sum = 0, full8 = 0, partial = 0, single = 0, native = 0;
  for (const c of cards) { const v = covOf(c); sum += sc(v.n); if (v.n >= 8) full8++; else if (v.n >= 2) partial++; else single++; if (v.plat === 'native') native++; }
  const coverage = {full8, partial, single, native, avg: +(sum / Math.max(1, cards.length)).toFixed(2)};

  // scor măsurat
  const a7 = T.a7 || null, ma = (a7 && a7.apps) || [];
  const scores = ma.filter((x) => typeof x.score === 'number').map((x) => x.score).sort((x, y) => x - y);
  const med = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) : null;
  const score = a7 ? {
    measured: scores.length, mean: scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(2) : null, median: med == null ? null : +med.toFixed(2),
    bands: {b9: scores.filter((s) => s >= 9).length, b8: scores.filter((s) => s >= 8 && s < 9).length, b7: scores.filter((s) => s >= 7 && s < 8).length, b6: scores.filter((s) => s < 7).length},
    noTests: ma.filter((x) => x.tests === 0).length, incomplete: ma.filter((x) => x.incomplete).length,
    lowest: ma.filter((x) => typeof x.score === 'number').sort((x, y) => x.score - y.score || x.key.localeCompare(y.key)).slice(0, 5).map((x) => x.key + ' ' + x.score.toFixed(1)),
  } : null;

  // învechire
  const ds = cards.filter((c) => c.upd).map((c) => ({k: c.key, d: days(c.upd)}));
  const oldest = ds.slice().sort((x, y) => y.d - x.d || x.k.localeCompare(y.k))[0];
  const age = {ref, fresh7: ds.filter((x) => x.d <= 7).length, fresh30: ds.filter((x) => x.d <= 30).length, stale30: ds.filter((x) => x.d > 30).length, stale90: ds.filter((x) => x.d > 90).length,
    oldest: oldest ? oldest.k + ' (' + oldest.d + ')' : null};

  // surse
  const a8 = (T.a8 && T.a8.sources) || [];
  const sources = {total: a8.length, active: a8.filter((s) => s.active).length, ok: a8.filter((s) => s.st === 'ok' || s.st === 'schimbat').length,
    alert: a8.filter((s) => s.st === 'alertă' || s.st === 'eroare').length, stopped: a8.filter((s) => !s.active).length, stale: a8.filter((s) => s.stale).length,
    failingApps: [...new Set(a8.filter((s) => s.active && (s.st === 'alertă' || s.st === 'eroare')).map((s) => s.app))].sort(), healthFile: sh.updated || null};

  // versiuni
  const mv = new Map(ma.map((x) => [x.key, x.ver]));
  const behind = cards.filter((c) => mv.has(c.key) && mv.get(c.key) !== c.ver).map((c) => c.key).sort();
  const versions = {cards: cards.length, measured: mv.size, behind, unmeasured: cards.filter((c) => !mv.has(c.key)).map((c) => c.key).sort()};

  return {date: ref, apps: cards.length, relations, coverage, score, age, sources, versions};
}

/** Probleme care fac `--check` să pice: tabloul salvat lipsește sau nu corespunde stării hubului. Cifrele proaste (aplicații slabe, versiuni nemăsurate) NU pică verificarea: apar în tablou. */
export function healthProblems(saved, fresh) {
  const out = [];
  if (!saved) return ['data/transparenta.json nu are „health” (rulează `node tools/transparenta.mjs health`)'];
  if (JSON.stringify(saved) !== JSON.stringify(fresh)) out.push('„health” din data/transparenta.json nu corespunde stării hubului (rulează `node tools/transparenta.mjs health && node tools/transparenta.mjs build`)');
  return out;
}
