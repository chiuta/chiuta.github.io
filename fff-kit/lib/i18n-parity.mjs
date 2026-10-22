// fff-kit · i18n-parity — detectează chei lipsă între limbi în dicționarele unei aplicații.
// Formate recunoscute (toate prin evaluare izolată a literalului de obiect, fără acces la nimic din pagină):
//  A) „limbă→chei”:   {ro:{a:'..',b:'..'}, en:{a:'..'}}                (I18N, TR, DICT, STRINGS, FFF.registerI18n('x', {...}) …; imbricat: chei cu punct a.b.c)
//  B) „cheie→limbi”:  {titlu:{ro:'..',en:'..'}, buton:{ro:'..'}}      (fiecare intrare e comparată cu uniunea limbilor din același container)
//  C) JSON-ul kitului <script type="application/json" id="fff-i18n"> = {modul:{limbă:{cheie}}} (format A pe fiecare modul)
//  D) tabele brute în șir: «linie\nlinie» cu coloane separate prin „|” (ex. I18N_RAW): rânduri cu mai puține coloane decât majoritatea.
// Limite (euristic): obiecte construite dinamic (spread, apeluri, variabile) nu pot fi evaluate; tipul A cere cel puțin 2 coduri de limbă; chei „folosite dar nedefinite” (data-i18n) doar cu `used:true`.
import vm from 'node:vm';
import {maskJs, inlineJsScripts, lineAt, braceIndex} from './jsscan.mjs';

export const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
const LANG_SET = new Set(LANGS);
const KEY_LANG_RE = new RegExp(`(?:^|[{,\\s])(?:"(?:${LANGS.join('|')})"|'(?:${LANGS.join('|')})'|(?:${LANGS.join('|')}))\\s*:\\s*[{"'\`]`, 'g');

function evalLiteral(text) {
  try { return JSON.parse(text); } catch { /* nu e JSON strict */ }
  try {
    const ctx = vm.createContext(Object.create(null), {codeGeneration: {strings: false, wasm: false}});
    return new vm.Script('(' + text + ')').runInContext(ctx, {timeout: 100});
  } catch { return undefined; }
}
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
/** Chei „aplatizate” (cale cu punct) ale frunzelor-șir dintr-un obiect. */
export function flatKeys(o, pre = '', out = new Set(), depth = 0) {
  if (!isObj(o) || depth > 6) return out;
  for (const k of Object.keys(o)) {
    const v = o[k], p = pre ? pre + '.' + k : k;
    if (isObj(v)) flatKeys(v, p, out, depth + 1); else out.add(p);
  }
  return out;
}
const langKeys = (o) => Object.keys(o).filter((k) => LANG_SET.has(k));

/** Compară un container „limbă→chei”. Întoarce {langs, missing: {limbă: [chei]}, total} sau null dacă nu e un astfel de container. */
export function compareLangMajor(o) {
  if (!isObj(o)) return null;
  const ls = langKeys(o).filter((l) => isObj(o[l]));
  if (ls.length < 2 || ls.length < Object.keys(o).length * 0.6) return null;
  const sets = Object.fromEntries(ls.map((l) => [l, flatKeys(o[l])]));
  const union = new Set(); for (const l of ls) for (const k of sets[l]) union.add(k);
  if (union.size < 1) return null;
  const missing = {};
  for (const l of ls) { const m = [...union].filter((k) => !sets[l].has(k)); if (m.length) missing[l] = m; }
  return {kind: 'lang-major', langs: ls, total: union.size, missing};
}
/** Compară un container „cheie→limbi”: pentru fiecare intrare, limbile lipsă față de uniunea limbilor din container. */
export function compareKeyMajor(o) {
  if (!isObj(o)) return null;
  const entries = [];
  const walk = (node, pre, depth) => {
    for (const k of Object.keys(node)) {
      const v = node[k], p = pre ? pre + '.' + k : k;
      if (isObj(v)) {
        const ls = langKeys(v).filter((l) => typeof v[l] === 'string' || (isObj(v[l])));
        if (ls.length >= 1 && ls.length >= Object.keys(v).length * 0.6) entries.push([p, ls]);
        else if (depth < 4) walk(v, p, depth + 1);
      }
    }
  };
  walk(o, '', 0);
  if (entries.length < 2) return null;
  const union = new Set(); for (const [, ls] of entries) for (const l of ls) union.add(l);
  if (union.size < 2) return null;
  const missing = {};
  for (const [p, ls] of entries) for (const l of union) if (!ls.includes(l)) (missing[l] = missing[l] || []).push(p);
  return {kind: 'key-major', langs: [...union], total: entries.length, missing};
}

/** Format „limbă→tablou” (ex. {k:[..], en:[..], fr:[..]}): tablourile trebuie să aibă aceeași lungime. */
export function compareArrayMajor(o) {
  if (!isObj(o)) return null;
  const ks = Object.keys(o).filter((k) => Array.isArray(o[k]));
  const ls = ks.filter((k) => LANG_SET.has(k));
  if (ls.length < 2) return null;
  const ref = Math.max(...ks.map((k) => o[k].length));
  const missing = {};
  for (const l of ks) if (o[l].length !== ref) missing[l] = [`lungime ${o[l].length} ≠ ${ref}`];
  return {kind: 'array-major', langs: ls, total: ref, missing};
}
function rawTables(masked, code) {
  // șiruri lungi cu multe rânduri și „|”: coloane inegale (parcurgere liniară; fără regex pe secvențe lungi)
  const out = [];
  for (let i = 0; i < masked.length; i++) {
    const q = masked[i];
    if (q !== '"' && q !== "'" && q !== '`') continue;
    let j = i + 1;
    while (j < masked.length && masked[j] === '\x01') j++;
    if (masked[j] === q && j - i > 200) {
      const txt = code.slice(i + 1, j).replace(/\\n/g, '\n');
      const rows = txt.split('\n').filter((r) => r.includes('|'));
      if (rows.length >= 20) {
        const counts = new Map(); for (const r of rows) { const c = r.split('|').length; counts.set(c, (counts.get(c) || 0) + 1); }
        const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        if (modal >= 2 && modal <= 8) {
          const bad = rows.map((r, k) => [k, r.split('|').length, r]).filter(([, c]) => c !== modal);
          if (bad.length) out.push({kind: 'raw-table', columns: modal, rows: rows.length, bad: bad.slice(0, 5).map(([k, c, r]) => `rând ${k + 1}: ${c} coloane („${r.slice(0, 30)}…”)`), badCount: bad.length, index: i + 1});
        }
      }
    }
    if (j > i) i = Math.max(i, j);
  }
  return out;
}

/** Analizează o pagină HTML (sau un fragment JS cu `{js:true}`). Întoarce [{where, line, kind, langs, total, missing}] doar pentru containerele cu lipsuri, plus `scanned` (câte containere au fost găsite). */
export function analyzeI18n(html, opt = {}) {
  const found = [], seen = new Set();
  const allKeys = {};
  const collect = (o) => { if (!isObj(o)) return; for (const l of langKeys(o)) if (isObj(o[l])) { allKeys[l] = allKeys[l] || new Set(); for (const k of flatKeys(o[l])) allKeys[l].add(k); } };
  let scanned = 0;
  const scripts = opt.js ? [{body: html, start: 0}] : inlineJsScripts(html);
  if (!opt.js && opt.includeKit) {
    const m = html.match(/<script type="application\/json" id="fff-i18n">([\s\S]*?)<\/script>/);
    if (m) { try { const j = JSON.parse(m[1]); for (const mod of Object.keys(j)) { const r = compareLangMajor(j[mod]); scanned++; if (r && Object.keys(r.missing).length) found.push({where: `fff-i18n[${mod}]`, line: lineAt(html, m.index), ...r}); } } catch { /* JSON invalid: îl raportează alt check */ } }
  }
  if (!opt.js) {
    const jre = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi; let jm;
    while ((jm = jre.exec(html))) {
      const attrs = jm[1];
      if (!/type\s*=\s*["']?(?:application\/json|application\/ld\+json|text\/plain)/i.test(attrs) || /id=["']fff-(?:info|i18n)["']/.test(attrs)) continue;
      let j; try { j = JSON.parse(jm[2]); } catch { continue; }
      const id = (attrs.match(/\bid=["']([^"']+)["']/) || [])[1] || 'json';
      const line = lineAt(html, jm.index);
      const visit = (o, nm, depth) => {
        if (!isObj(o) || depth > 2) return;
        const r = compareLangMajor(o) || compareKeyMajor(o) || compareArrayMajor(o);
        if (r) { scanned++; if (Object.keys(r.missing).length) found.push({where: `${id}${nm}`, line, ...r}); return; }
        for (const k of Object.keys(o)) visit(o[k], nm + '.' + k, depth + 1);
      };
      visit(j, '', 0);
    }
  }
  for (const sc of scripts) {
    const code = sc.body, masked = maskJs(code), bi = braceIndex(masked), enclosingOpen = (_m, p) => bi.enclosing(p), matchClose = (_m, o) => bi.close(o);
    if (/\/\* ---- fff-kit\//.test(code)) continue;   // blocul kitului nu e al aplicației
    KEY_LANG_RE.lastIndex = 0;
    let m;
    while ((m = KEY_LANG_RE.exec(code))) {
      const pos = m.index + (/^[{,\s]/.test(m[0]) ? 1 : 0);
      if (masked[pos] === '\x01' || masked[pos] === ' ' || masked[pos] === undefined) continue;   // în comentariu sau în interiorul unui șir
      let o = enclosingOpen(masked, pos), skipTo = -1;
      for (let up = 0; o >= 0 && up < 4; up++, o = enclosingOpen(masked, o)) {
        if (seen.has(o)) continue;
        seen.add(o);   // și încercările eșuate (nu reevalua același obiect)
        const close = matchClose(masked, o);
        if (close < 0 || close - o > 600000) continue;
        const obj = evalLiteral(code.slice(o, close + 1));
        if (!isObj(obj)) continue;
        const A0 = compareLangMajor(obj);
        if (A0) collect(obj);
        const r = A0 || compareKeyMajor(obj);
        if (!r) continue;
        scanned++; skipTo = close;
        const before = code.slice(Math.max(0, o - 80), o);
        const nm = (before.match(/([A-Za-z_$][\w$.]*)\s*[:=]\s*$/) || before.match(/registerI18n\(\s*['"]([^'"]+)['"]\s*,\s*$/) || [])[1] || '(obiect)';
        if (Object.keys(r.missing).length) found.push({where: nm, line: lineAt(html, sc.start + o), ...r});
        break;
      }
      if (skipTo > 0) KEY_LANG_RE.lastIndex = Math.max(KEY_LANG_RE.lastIndex, skipTo);
    }
    for (const t of rawTables(masked, code)) { scanned++; found.push({where: 'tabel brut', line: lineAt(html, sc.start + t.index), kind: t.kind, langs: [], total: t.rows, missing: {'(rânduri)': t.bad}, columns: t.columns, badCount: t.badCount}); }
  }
  // completări: o cheie „lipsă” dintr-un container dar definită pentru aceeași limbă în alt container al paginii (ex. Object.assign(T, R8)) nu se raportează
  for (const it of found) if (it.kind === 'lang-major') {
    for (const l of Object.keys(it.missing)) { it.missing[l] = it.missing[l].filter((k) => !(allKeys[l] && allKeys[l].has(k))); if (!it.missing[l].length) delete it.missing[l]; }
  }
  for (let i = found.length - 1; i >= 0; i--) if (found[i].kind === 'lang-major' && !Object.keys(found[i].missing).length) found.splice(i, 1);
  // chei folosite în HTML (data-i18n="cheie") și nedefinite pentru o limbă în niciun dicționar al paginii (opțional)
  if (opt.used && !opt.js) {
    const usedKeys = new Set([...html.matchAll(/\bdata-i18n\s*=\s*["']([^"';:\s]+)["']/g)].map((x) => x[1]));
    const langs = Object.keys(allKeys);
    if (usedKeys.size && langs.length >= 2 && [...usedKeys].some((k) => langs.some((l) => allKeys[l].has(k)))) {
      const missing = {};
      for (const l of langs) { const m = [...usedKeys].filter((k) => !allKeys[l].has(k)); if (m.length) missing[l] = m; }
      if (Object.keys(missing).length) found.push({where: 'data-i18n folosite', line: 0, kind: 'used-undefined', langs, total: usedKeys.size, missing});
    }
  }
  return {scanned, issues: found};
}

/** Mesaje scurte (în română) pentru build.mjs check / uneltă. */
export function describeIssue(it, maxKeys = 4) {
  const parts = Object.entries(it.missing).map(([l, ks]) => `${l}: ${ks.length}${ks.length ? ' (' + ks.slice(0, maxKeys).join(', ') + (ks.length > maxKeys ? '…' : '') + ')' : ''}`);
  const what = it.kind === 'key-major' ? 'limbi lipsă' : it.kind === 'raw-table' ? 'rânduri cu număr greșit de coloane' : 'chei lipsă';
  return `${it.where}${it.line ? ' (linia ' + it.line + ')' : ''}: ${what} — ${parts.join('; ')}`;
}
