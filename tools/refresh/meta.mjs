#!/usr/bin/env node
/* tools/refresh/meta.mjs — vizibilitatea surselor (Etapa 8.6) și actualizarea tranzitivă (8.5).
 *
 *   node tools/refresh/meta.mjs sync  [--apps-root DIR] [--no-build]   derivă din sources.json + source-health.json:
 *        • data/catalog-meta.json → „dataSources” (descriptori statici per aplicație: sursă, gazdă, cadență, data declarată de autor)
 *        • index.html → blocul <script type="application/json" id="source-health"> (ultima reușită per sursă; JS-ul paginii calculează „învechit”)
 *        • data/transparenta.json → „a8” (tabelul „sănătatea surselor”)
 *      apoi, dacă ceva s-a schimbat (și fără --no-build): sync-catalog (încorporează meta, hash-urile CSP, sw.js), transparenta build, fixcsp.
 *   node tools/refresh/meta.mjs check [--apps-root DIR]   cod 1 dacă oricare dintre cele de mai sus nu corespunde (nu scrie nimic)
 *
 * „Învechit” = ultima reușită mai veche de 2× cadența (viu 7 zile, lent 30; înghețat nu expiră). Pe card se afișează „date actualizate la …” + sursa.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {HUB, P, loadSources, readJson, today} from './lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] || 'sync';
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const APPS = val('--apps-root', null);
const INDEX = path.join(HUB, 'index.html'), CMETA = path.join(HUB, 'data', 'catalog-meta.json'), TJSON = path.join(HUB, 'data', 'transparenta.json');

export function derive(S, H) {
  const host = (u) => { try { return new URL(u).host; } catch { return ''; } };
  const dataSources = {};
  // pe card se afișează o singură sursă per aplicație: cea cu card:true a cărei „app” e chiar aplicația, altfel prima cu card:true care o include
  const cardOf = {};
  for (const s of S.sources.filter((x) => x.card)) for (const app of new Set([s.app, ...(s.apps || [])])) if (!cardOf[app] || (s.app === app && S.sources.find((x) => x.id === cardOf[app]).app !== app)) cardOf[app] = s.id;
  for (const s of S.sources) {
    const hosts = [...new Set([s.url, ...(s.urls || [])].filter(Boolean).map(host))];
    for (const app of new Set([s.app, ...(s.apps || [])])) {
      (dataSources[app] ||= []).push({id: s.id, host: hosts[0] || '', cad: s.cadenta, days: S.defaults.cadenceDays[s.cadenta] ?? null, st: s.stare, ...(cardOf[app] === s.id ? {card: true} : {}), ...(s.asOf ? {asOf: s.asOf} : {}), ...(s.fragil ? {fragil: true} : {})});
    }
  }
  const sortedDS = Object.fromEntries(Object.keys(dataSources).sort().map((k) => [k, dataSources[k]]));
  const hs = (H && H.sources) || {};
  const sh = {schema: 1, date: (H && H.updated) || null, ds: sortedDS, s: Object.fromEntries(S.sources.filter((s) => hs[s.id] && (hs[s.id].lastOk || hs[s.id].status)).map((s) => [s.id, {...(hs[s.id].lastOk ? {ok: hs[s.id].lastOk} : {}), st: hs[s.id].status}]))};
  const ref = Date.parse((H && H.updated) || today());
  const a8 = (H && H.updated) ? {date: H.updated, sources: S.sources.map((s) => {
    const h = hs[s.id] || {}, days = S.defaults.cadenceDays[s.cadenta], f = S.defaults.staleFactor;
    const stale = s.stare === 'activ' && days != null && h.lastOk ? (ref - Date.parse(h.lastOk)) / 864e5 > f * days : false;
    return {id: s.id, app: s.app, cad: s.cadenta, st: h.status || 'neexecutat', active: s.stare === 'activ', lastOk: h.lastOk || null, lastFail: h.lastFail || null, err: h.errorType || null, recs: h.records ?? null, stale};
  })} : null;
  return {dataSources: sortedDS, sh, a8};
}
/** Înlocuiește (sau adaugă la sfârșit) cheia de nivel superior `key` din textul JSON fără a reformata restul fișierului (diferențe mici, fără conflicte cu alte editări). */
export function setTopKey(text, key, value) {
  const ser = JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
  const m = text.match(new RegExp('\\n  "' + key + '": '));
  if (!m) { const end = text.lastIndexOf('\n}'); return text.slice(0, end).replace(/\s*$/, '') + ',\n  "' + key + '": ' + ser + text.slice(end); }
  let i = m.index + m[0].length, depth = 0, inStr = false;
  const start = i;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return text.slice(0, start) + ser + text.slice(i);
}
const embed = (sh) => JSON.stringify(sh).replace(/</g, '\\u003c');
const BLOCK_RE = /(<script type="application\/json" id="source-health">)([\s\S]*?)(<\/script>)/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function plan() {
  const S = loadSources(), H = readJson(P.health, null), d = derive(S, H);
  const out = {changes: [], write: []};
  const cm = readJson(CMETA);
  if (!same(cm.dataSources, d.dataSources)) { out.changes.push('data/catalog-meta.json (dataSources)'); out.write.push(() => fs.writeFileSync(CMETA, setTopKey(fs.readFileSync(CMETA, 'utf8'), 'dataSources', d.dataSources))); }
  const html = fs.readFileSync(INDEX, 'utf8'), m = html.match(BLOCK_RE);
  if (!m) out.changes.push('index.html: lipsește blocul #source-health (inserează-l o dată, vezi Etapa 8.6)');
  else if (m[2] !== embed(d.sh)) { out.changes.push('index.html (#source-health)'); out.write.push(() => fs.writeFileSync(INDEX, html.replace(BLOCK_RE, (_, a, __, c) => a + embed(d.sh) + c))); }
  if (d.a8) { const t = readJson(TJSON); if (!same(t.a8, d.a8)) { t.a8 = d.a8; out.changes.push('data/transparenta.json (a8)'); out.write.push(() => fs.writeFileSync(TJSON, JSON.stringify(t, null, 1) + '\n')); } }
  return out;
}

if (cmd === 'check') {
  const p = plan();
  if (p.changes.length) { console.error('meta nu e la zi:\n - ' + p.changes.join('\n - ') + '\nrulează `node tools/refresh/meta.mjs sync`'); process.exit(1); }
  console.log('meta ok (catalog-meta.dataSources, #source-health, transparenta a8)');
} else if (cmd === 'sync') {
  const p = plan();
  if (!p.changes.length) { console.log('meta: nimic de schimbat'); process.exit(0); }
  console.log('meta: ' + p.changes.join(', '));
  if (p.changes.some((c) => /lipsește blocul/.test(c))) { console.error('blocul #source-health lipsește din index.html'); process.exit(1); }
  p.write.forEach((w) => w());
  if (!argv.includes('--no-build')) {
    const node = (args) => execFileSync(process.execPath, args, {cwd: HUB, stdio: 'inherit'});
    // sync-catalog scrie chiar dacă iese cu cod 1 din cauza aplicațiilor neclonate (în Actions); problemele noi le prinde gate.mjs
    const sc = spawnSync(process.execPath, ['tools/sync-catalog.mjs', ...(APPS ? ['--root', APPS] : [])], {cwd: HUB, encoding: 'utf8'});
    console.log(sc.stdout.split('\n').filter((l) => /^(schimbare|\d+ carduri)/.test(l)).join('\n'));
    if (sc.status !== 0 && !/^\d+ carduri/m.test(sc.stdout)) { console.error(sc.stdout + sc.stderr); process.exit(1); }
    node(['tools/transparenta.mjs', 'build']);
    node(['fff-kit/build.mjs', 'fixcsp', 'index.html']);
  }
} else { console.error('folosire: meta.mjs sync|check'); process.exit(2); }
