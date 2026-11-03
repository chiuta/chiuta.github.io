// tools/refresh/lib.mjs — piese comune ale alergătorului de reîmprospătare (Etapa 8). Fără dependențe externe (Node ≥ 20).
// Aici: citirea inventarului, HTTP politicos (User-Agent propriu, limită de rată, robots.txt după RFC 9309, mod fixturi/înregistrare),
// hash, diferențe între instantanee și decizia de aplicare (praguri, structură, auto-fuziune).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const HUB = process.env.REFRESH_HUB ? path.resolve(process.env.REFRESH_HUB) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const paths = (root = HUB) => ({
  root,
  sources: path.join(root, 'data', 'sources.json'),
  health: path.join(root, 'data', 'source-health.json'),
  snap: (id) => path.join(root, 'data', 'refresh', id + '.json'),
  baseline: (id) => path.join(root, 'data', 'refresh', 'baseline', id + '.json'),
  archive: (day, id) => path.join(root, 'data', 'archive', day, id + '.json'),
  fixtures: path.join(HUB, 'tools', 'refresh', 'fixtures'),
});
export const P = paths();
export const CADENCES = ['înghețat', 'lent', 'viu'];
export const ERR = ['network', 'http', 'robots', 'parse', 'structure', 'threshold', 'validation', 'drift', 'unconfirmed'];

export const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; } };
export const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, JSON.stringify(o, null, 1) + '\n'); };
export const sha256 = (x) => createHash('sha256').update(x).digest('hex');
export const today = () => new Date().toISOString().slice(0, 10);
export const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function loadSources(file = P.sources) {
  const s = readJson(file);
  const d = s.defaults || {};
  s.sources = (s.sources || []).map((x) => ({kind: 'data', ...x}));
  s.defaults = {minIntervalMs: 2000, timeoutMs: 20000, maxBytes: 8_000_000, retries: 1,
    thresholds: {dropPct: 20, growthPct: 40, autoMerge: {maxChangedPct: 5, maxChanged: 10}}, cadenceDays: {'înghețat': null, lent: 30, viu: 7}, staleFactor: 2, ...d};
  return s;
}

/** Verificări de schemă pentru data/sources.json (rulate de run.mjs și de gate.mjs). Returnează mesaje de problemă. */
export function validateSources(s) {
  const out = [], ids = new Set();
  const STATES = ['activ', 'doar-inventar', 'de-confirmat', 'oprit'];
  for (const x of s.sources) {
    const w = (m) => out.push(`sources.json: ${x.id || '?'}: ${m}`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(x.id || '')) w('id invalid');
    if (ids.has(x.id)) w('id duplicat'); ids.add(x.id);
    if (!x.app) w('lipsește „app”');
    if (!CADENCES.includes(x.cadenta)) w(`cadență necunoscută „${x.cadenta}”`);
    if (!STATES.includes(x.stare)) w(`stare necunoscută „${x.stare}”`);
    if (!(x.url || (x.urls && x.urls.length))) w('lipsește „url”/„urls”');
    for (const u of [x.url, ...(x.urls || [])].filter(Boolean)) if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) w(`URL ne-HTTPS sau invalid: ${u}`);
    for (const f of ['tip', 'licenta', 'robots']) if (!x[f]) w(`lipsește „${f}”`);
    if (!x.termeni) w('lipsește „termeni”');
    if (x.stare === 'activ') {
      if (!x.parser) w('sursă activă fără „parser”');
      if (!x.validator) w('sursă activă fără „validator”');
      if (!['data', 'watch'].includes(x.kind)) w('kind trebuie să fie data sau watch');
    }
    if (x.stare === 'oprit' && !x.motivOprire) w('sursă oprită fără „motivOprire”');
    if (x.asOf && !/^\d{4}-\d\d(-\d\d)?$/.test(x.asOf)) w('asOf trebuie să fie AAAA-LL sau AAAA-LL-ZZ');
  }
  const apps = new Set([...s.sources.map((x) => x.app), ...s.sources.flatMap((x) => x.apps || [])]);
  for (const a of (s.faraSurse && s.faraSurse.apps) || []) if (apps.has(a)) out.push(`sources.json: aplicația ${a} e și în „faraSurse”, și are sursă`);
  return out;
}

/* ---------------- HTTP ---------------- */
export class Http {
  /** opts: {fixtures:dir|null, record:dir|null, ua, minIntervalMs, timeoutMs, maxBytes, log} */
  constructor(opts) { this.o = opts; this.last = new Map(); this.robots = new Map(); this.count = 0; }
  fixtureFile(url) { return path.join(this.o.fixtures, sha256(url).slice(0, 12)); }
  async raw(url, init = {}) {
    this.count++;
    if (this.o.fixtures) {
      const f = this.fixtureFile(url);
      if (!fs.existsSync(f + '.json')) { const e = new Error(`fixtură lipsă pentru ${url} (${path.basename(f)})`); e.type = 'network'; throw e; }
      const m = readJson(f + '.json');
      const body = fs.existsSync(f + '.body') ? fs.readFileSync(f + '.body') : Buffer.alloc(0);
      return {status: m.status, headers: m.headers || {}, body, url: m.finalUrl || url};
    }
    const u = new URL(url), now = Date.now(), wait = (this.last.get(u.host) || 0) + (this.o.minIntervalMs ?? 2000) - now;
    if (wait > 0) await sleep(wait);
    this.last.set(u.host, Date.now());
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), this.o.timeoutMs || 20000);
    try {
      const r = await fetch(url, {redirect: 'follow', signal: ctl.signal, ...init, headers: {'User-Agent': this.o.ua, 'Accept': '*/*', ...(init.headers || {})}});
      const chunks = []; let n = 0;
      for await (const c of r.body) { n += c.length; if (n > (this.o.maxBytes || 8e6)) { ctl.abort(); const e = new Error('răspuns peste limita de mărime'); e.type = 'validation'; throw e; } chunks.push(c); }
      const res = {status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.concat(chunks), url: r.url};
      if (this.o.record) {
        const f = path.join(this.o.record, sha256(url).slice(0, 12));
        fs.mkdirSync(this.o.record, {recursive: true});
        fs.writeFileSync(f + '.json', JSON.stringify({url, finalUrl: r.url, status: r.status, headers: {'content-type': res.headers['content-type'] || ''}}, null, 1));
        fs.writeFileSync(f + '.body', res.body);
      }
      return res;
    } catch (e) {
      if (!e.type) e.type = 'network';
      if (e.name === 'AbortError') e.message = 'timeout sau întrerupt';
      throw e;
    } finally { clearTimeout(timer); }
  }
  /** GET cu reîncercare unică pe 5xx/rețea. Aruncă erori tipate (type: network|http). */
  async get(url, init) {
    let last;
    for (let i = 0; i <= (this.o.retries ?? 1); i++) {
      try {
        const r = await this.raw(url, init);
        if (r.status >= 500 && i < (this.o.retries ?? 1)) { last = Object.assign(new Error('HTTP ' + r.status), {type: 'http'}); await sleep(this.o.fixtures ? 0 : 3000); continue; }
        return r;
      } catch (e) { last = e; if (i < (this.o.retries ?? 1) && !this.o.fixtures) await sleep(3000); else if (this.o.fixtures) break; }
    }
    throw last;
  }
  text(r) { return r.body.toString('utf8'); }
  /** robots.txt după RFC 9309: 2xx → reguli; 4xx → permis; 5xx/rețea → interzis (nu se continuă). */
  async allowed(url) {
    const u = new URL(url);
    let rules = this.robots.get(u.origin);
    if (rules === undefined) {
      try {
        const r = await this.raw(u.origin + '/robots.txt');
        if (r.status >= 200 && r.status < 300) rules = parseRobots(r.body.toString('utf8'), this.o.uaToken || 'chiuta-refresh');
        else if (r.status >= 400 && r.status < 500) rules = [];
        else rules = 'deny';
      } catch (e) { rules = 'deny'; }
      this.robots.set(u.origin, rules);
    }
    if (rules === 'deny') return {ok: false, why: 'robots.txt indisponibil (5xx/rețea): nu continui'};
    return robotsMatch(rules, u.pathname + u.search);
  }
}

export function parseRobots(txt, token) {
  const groups = []; let cur = null, lastWasUA = false;
  for (let line of txt.split(/\r?\n/)) {
    line = line.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!cur || !lastWasUA) { cur = {agents: [], rules: []}; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasUA = true; continue; }
    lastWasUA = false;
    if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({allow: k === 'allow', path: v});
  }
  const t = token.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && t.includes(a)));
  const pick = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return pick.flatMap((g) => g.rules);
}
export function robotsMatch(rules, pathq) {
  let best = null;
  for (const r of rules) {
    if (r.path === '') continue; // „Disallow:” gol = nimic interzis
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(pathq)) { const len = r.path.length; if (!best || len > best.len || (len === best.len && r.allow)) best = {len, allow: r.allow, path: r.path}; }
  }
  return best && !best.allow ? {ok: false, why: `robots.txt interzice „${best.path}”`} : {ok: true};
}

/* ---------------- diferențe + decizie ---------------- */
/** Compară două liste de înregistrări {k,...} după cheia k. */
export function diffRecords(prev, next) {
  const a = new Map(prev.map((r) => [r.k, stable(r)])), b = new Map(next.map((r) => [r.k, stable(r)]));
  const added = [], removed = [], changed = [];
  for (const [k, v] of b) { if (!a.has(k)) added.push(k); else if (a.get(k) !== v) changed.push(k); }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  return {added, removed, changed, total: added.length + removed.length + changed.length};
}

/**
 * Decide ce se întâmplă cu rezultatul unei surse „data”.
 * result: {records, structure}; prev: instantaneul comis (sau null); baseline: {count} din aplicație (sau null).
 * Returnează {action:'unchanged'|'initial'|'apply'|'reject', diff, autoMerge:boolean, reasons:[{type,msg}]}.
 */
export function decide(src, result, prev, baseline, defs) {
  const th = {...defs.thresholds, ...(src.praguri || {})};
  const reasons = [...(result.problems || [])], n = result.records.length;
  const min = src.validator && src.validator.minRecords;
  if (n === 0) reasons.push({type: 'parse', msg: 'parserul nu a găsit nicio înregistrare'});
  if (min && n < min) reasons.push({type: 'threshold', msg: `${n} înregistrări < minimul ${min}`});
  const ref = prev ? prev.records.length : (baseline && baseline.count) || null;
  if (ref) {
    const drop = (1 - n / ref) * 100, grow = (n / ref - 1) * 100;
    if (drop > th.dropPct) reasons.push({type: 'threshold', msg: `numărul de înregistrări a scăzut cu ${drop.toFixed(1)}% (${ref} → ${n}; prag ${th.dropPct}%)`});
    if (grow > th.growthPct) reasons.push({type: 'threshold', msg: `numărul de înregistrări a crescut cu ${grow.toFixed(1)}% (${ref} → ${n}; prag ${th.growthPct}%): structură suspectă`});
  }
  if (prev && prev.structure && result.structure && prev.structure !== result.structure) reasons.push({type: 'structure', msg: `structura sursei s-a schimbat (${prev.structure} → ${result.structure})`});
  const base = {diff: prev ? diffRecords(prev.records, result.records) : null, autoMerge: false, reasons};
  if (reasons.length) return {action: 'reject', ...base};
  if (!prev) return {action: 'initial', ...base};
  if (sha256(stable(result.records)) === prev.sha256 && prev.structure === result.structure) return {action: 'unchanged', ...base};
  const am = {...th.autoMerge, ...(src.autoMerge && typeof src.autoMerge === 'object' ? src.autoMerge : {})};
  const lim = Math.max(am.maxChanged ?? 0, Math.floor(prev.records.length * (am.maxChangedPct ?? 0) / 100));
  base.autoMerge = !!src.autoMerge && base.diff.total <= lim;
  return {action: 'apply', ...base};
}
