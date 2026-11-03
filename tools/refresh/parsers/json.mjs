// Parsere pentru surse JSON: videoneat-index (VNTV), eurostat-population (AGORA), json-shape (canare de API), npm-package, pypi-package.
import {fetchOk, parseJson, path, err} from './common.mjs';

export const videoneat = {
  version: 1, kind: 'data',
  async run(src, http) {
    let j, used, firstErr;
    for (const u of [src.url, ...(src.urls || [])].filter((x, i, a) => x && a.indexOf(x) === i)) {
      try { j = parseJson(http.text(await fetchOk(http, src, u)), 'indexul VideoNeat'); used = u; break; } catch (e) { firstErr ||= e; }
    }
    if (!j) throw firstErr;
    const problems = [], summary = {url: used};
    if (!j || typeof j !== 'object' || !Array.isArray(j.items)) throw err('parse', 'lipsește tabloul „items” (formatul indexului s-a schimbat?)');
    if (j.v !== 1) problems.push({type: 'structure', msg: `versiunea formatului indexului este ${JSON.stringify(j.v)}, se aștepta 1`});
    if (typeof j.count === 'number' && j.count !== j.items.length) problems.push({type: 'structure', msg: `count=${j.count} dar items are ${j.items.length}`});
    const keys = new Set(); for (const it of j.items.slice(0, 20)) Object.keys(it || {}).forEach((x) => keys.add(x));
    const structure = 'v' + j.v + '|' + Object.keys(j).sort().join(',') + '|' + [...keys].sort().join(',');
    const records = [], seen = new Set(); let bad = 0, withTrailer = 0;
    for (const it of j.items) {
      if (!it || !Number.isInteger(it.id) || typeof it.title !== 'string' || !it.title.trim() || typeof it.link !== 'string') { bad++; continue; }
      if (seen.has(it.id)) { bad++; continue; } seen.add(it.id);
      const tr = it.trailer && it.trailer.host && it.trailer.id ? `${it.trailer.host}/${it.trailer.id}` : null;
      if (tr) withTrailer++;
      records.push({k: String(it.id).padStart(7, '0'), t: it.title.trim(), d: it.date || null, y: it.year || null, tr});
    }
    records.sort((a, b) => (a.k < b.k ? -1 : 1));
    if (j.items.length && bad / j.items.length > 0.02) problems.push({type: 'validation', msg: `${bad} din ${j.items.length} articole fără id/titlu/link valide (>2%)`});
    summary.items = j.items.length; summary.withTrailer = withTrailer; summary.generated = j.generated || null;
    if (j.generated) { const age = (Date.now() - Date.parse(j.generated)) / 864e5; if (age > 30) summary.warning = `indexul este generat acum ${Math.round(age)} zile`; }
    return {records, structure, problems, summary, labels: Object.fromEntries(records.map((r) => [r.k, r.t]))};
  },
};

const EA21 = ['AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
const idxOf = (cat) => (Array.isArray(cat.index) ? Object.fromEntries(cat.index.map((c, i) => [c, i])) : cat.index);
/** JSON-stat 2.0 → {geo: {time: valoare}} (celelalte dimensiuni trebuie să aibă mărimea 1). */
export function jsonStat(j) {
  if (!j || j.class !== 'dataset' || !Array.isArray(j.id) || !Array.isArray(j.size) || !j.dimension || j.value == null) throw err('parse', 'nu e un set JSON-stat 2.0 (class/id/size/dimension/value)');
  const dims = j.id, sizes = j.size, stride = []; let s = 1;
  for (let i = dims.length - 1; i >= 0; i--) { stride[i] = s; s *= sizes[i]; }
  const gi = dims.indexOf('geo'), ti = dims.indexOf('time');
  if (gi < 0 || ti < 0) throw err('parse', 'lipsesc dimensiunile geo/time');
  for (let i = 0; i < dims.length; i++) if (i !== gi && i !== ti && sizes[i] !== 1) throw err('parse', `dimensiunea „${dims[i]}” are ${sizes[i]} valori (se aștepta 1)`);
  const geo = idxOf(j.dimension.geo.category), time = idxOf(j.dimension.time.category), out = {};
  const val = (flat) => (Array.isArray(j.value) ? j.value[flat] : j.value[String(flat)]);
  for (const [g, gp] of Object.entries(geo)) for (const [t, tp] of Object.entries(time)) {
    const v = val(gp * stride[gi] + tp * stride[ti]);
    if (typeof v === 'number') (out[g] ||= {})[t] = v;
  }
  return out;
}
export const eurostat = {
  version: 1, kind: 'data',
  async run(src, http, ctx) {
    const j = parseJson(http.text(await fetchOk(http, src, src.url)), 'Eurostat');
    const data = jsonStat(j), records = [], problems = [], missing = [];
    for (const g of EA21) {
      const ts = Object.keys(data[g] || {}).sort();
      if (!ts.length) { missing.push(g); continue; }
      const t = ts[ts.length - 1], v = data[g][t];
      if (v < 1e5 || v > 1e8) problems.push({type: 'validation', msg: `populație implauzibilă pentru ${g}: ${v}`});
      records.push({k: g, time: t, v});
    }
    if (missing.length) problems.push({type: 'validation', msg: `lipsesc state din zona euro: ${missing.join(', ')}`});
    const summary = {geos: records.length};
    const bl = ctx.baseline;
    if (bl && bl.popMillions) {
      const dev = [];
      for (const r of records) {
        const a = bl.popMillions[r.k === 'EL' ? 'GR' : r.k]; if (!a) continue;
        const e = r.v / 1e6, pct = Math.abs(e - a) / a * 100;
        if (pct > (src.validator.appDeviationPct ?? 3)) dev.push(`${r.k}: aplicație ~${a} mil., Eurostat ${e.toFixed(2)} mil. (${r.time})`);
      }
      summary.deviationsFromApp = dev;
    }
    return {records, structure: 'jsonstat2|' + j.id.join(','), problems, summary, labels: {}};
  },
};

/** Canar de API: răspunsul trebuie să fie JSON 2xx și să aibă anumite căi (puncte = adâncime; numerele indexează tablouri). */
export const jsonShape = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const checks = [], exp = src.expect || {};
    const list = exp.checks || [{url: src.url, paths: exp.paths}];
    for (const c of list) {
      let r;
      try { r = await fetchOk(http, src, c.url, c.headers ? {headers: c.headers} : undefined); }
      catch (e) {
        // erorile tehnice (rețea, robots, 5xx, 429) nu sunt „schimbare de format”: se propagă ca eroare, nu ca alertă de deriva
        if (e.type === 'robots' || e.type === 'network' || /HTTP (5\d\d|429)\b/.test(e.message)) throw e;
        checks.push({k: c.name || c.url, ok: false, detail: e.message}); continue;
      }
      let j; try { j = JSON.parse(http.text(r)); } catch { checks.push({k: c.name || c.url, ok: false, detail: 'răspuns non-JSON'}); continue; }
      const missing = (c.paths || []).filter((p) => path(j, p) === undefined);
      checks.push({k: c.name || c.url, ok: !missing.length, detail: missing.length ? 'lipsesc: ' + missing.join(', ') : 'structură la fel'});
    }
    return {checks, summary: {}};
  },
};

async function fetchOrMissing(http, src, url, init) {
  try { return await fetchOk(http, src, url, init); } catch (e) { if (/HTTP (404|410)\b/.test(e.message)) return {missing: true}; throw e; }
}
export const npmPackage = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const name = src.expect.package;
    const r = await fetchOrMissing(http, src, `https://registry.npmjs.org/${name}`, {headers: {Accept: 'application/vnd.npm.install-v1+json'}});
    if (r.missing) return {checks: [{k: 'există', ok: false, detail: 'pachetul nu mai există (404)'}], summary: {}};
    const j = parseJson(http.text(r), 'registrul npm');
    const latest = path(j, 'dist-tags.latest'), v = latest && j.versions && j.versions[latest];
    const checks = [{k: 'există', ok: !!latest, detail: latest ? 'ultima versiune ' + latest : 'fără dist-tags.latest'}, {k: 'nedeprecat', ok: !!v && !v.deprecated, detail: v && v.deprecated ? 'DEPRECAT: ' + String(v.deprecated).slice(0, 120) : 'ok'}];
    return {checks, summary: {latest, pinned: src.expect.pinned || null, newer: !!(latest && src.expect.pinned && latest !== src.expect.pinned)}};
  },
};
export const pypiPackage = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const name = src.expect.package;
    const r = await fetchOrMissing(http, src, `https://pypi.org/pypi/${name}/json`);
    if (r.missing) return {checks: [{k: 'există', ok: false, detail: 'pachetul nu mai există (404)'}], summary: {}};
    const j = parseJson(http.text(r), 'PyPI');
    const latest = path(j, 'info.version');
    const checks = [{k: 'există', ok: !!latest, detail: latest ? 'ultima versiune ' + latest : 'fără info.version'}, {k: 'nescos (yanked)', ok: !path(j, 'info.yanked'), detail: path(j, 'info.yanked') ? 'YANKED: ' + (path(j, 'info.yanked_reason') || '') : 'ok'}];
    return {checks, summary: {latest, pinned: src.expect.pinned || null, newer: !!(latest && src.expect.pinned && latest !== src.expect.pinned)}};
  },
};
