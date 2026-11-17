#!/usr/bin/env node
// tools/compat/audit.mjs — măsoară ce cer aplicațiile single-file HTML de la browser (sintaxă JS, API-uri, CSS) față de pragul din compat.config.json
// și poate fi folosit ca poartă (--gate): eșuează dacă vreun script inline depășește sintaxa pragului sau dacă lipsește stratul fff-compat.
//   node tools/compat/audit.mjs [--root DIR] [--only A,B] [--skip A,B] [--json data/compat.json] [--smoke s0.json,s1.json] [--gate] [--quiet]
//   --smoke: rezultatele smoke.mjs (--json) se alătură fiecărei ținte (câmpul `smoke`); cu --gate, o țintă cu smoke «fail» pică și ea.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {acorn} from './lower-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'compat.config.json'), 'utf8'));
const FLOOR = CONFIG.floor;

// API-uri: [nume, regex, chrome, firefox, safari, acoperit de fff-compat?] — doar cele cu risc real peste prag
const API = [
  ['Object.fromEntries', /\bObject\.fromEntries\b/, 73, 63, 12.1, true], ['Array.flat/flatMap', /\.(flat|flatMap)\s*\(/, 69, 62, 12, true],
  ['Array.at()', /\.at\(\s*-?\d/, 92, 90, 15.4, true], ['String.replaceAll', /\.replaceAll\s*\(/, 85, 77, 13.1, true],
  ['structuredClone', /\bstructuredClone\s*\(/, 98, 94, 15.4, true], ['Promise.allSettled', /\bPromise\.allSettled\b/, 76, 71, 13, true],
  ['Promise.any', /\bPromise\.any\b/, 85, 79, 14, true], ['Promise.finally', /\.finally\s*\(/, 63, 58, 11.1, true],
  ['Object.hasOwn', /\bObject\.hasOwn\b/, 93, 92, 15.4, true], ['findLast', /\.(findLast|findLastIndex)\s*\(/, 97, 104, 15.4, true],
  ['toSorted/toReversed/toSpliced', /\.(toSorted|toReversed|toSpliced)\s*\(/, 110, 115, 16, false],
  ['queueMicrotask', /\bqueueMicrotask\b/, 71, 69, 12.1, true], ['requestIdleCallback', /\brequestIdleCallback\b/, 47, 55, 99, true],
  ['replaceChildren', /\.replaceChildren\s*\(/, 86, 78, 14.1, true], ['crypto.randomUUID', /\brandomUUID\s*\(/, 92, 95, 15.4, true],
  ['Blob.arrayBuffer/text', /\.(arrayBuffer|text)\s*\(\s*\)/, 76, 69, 14, true], ['BigInt', /\bBigInt\b|\b\d+n\b/, 67, 68, 14, false],
  ['AbortController', /\bAbortController\b/, 66, 57, 12.1, true], ['ResizeObserver', /\bResizeObserver\b/, 64, 69, 13.1, true],
  ['IntersectionObserver', /\bIntersectionObserver\b/, 58, 55, 12.1, true], ['navigator.clipboard', /\bnavigator\.clipboard\b/, 66, 63, 13.1, true],
  ['Intl.RelativeTimeFormat/ListFormat/Segmenter', /\bIntl\.(RelativeTimeFormat|ListFormat|Segmenter|DisplayNames)\b/, 71, 65, 14.1, false],
  ['BroadcastChannel', /\bBroadcastChannel\b/, 54, 38, 15.4, false], ['OffscreenCanvas', /\bOffscreenCanvas\b/, 69, 105, 16.4, false],
  ['roundRect', /\.roundRect\s*\(/, 99, 112, 16, true], ['CompressionStream', /\b(Compression|Decompression)Stream\b/, 80, 113, 16.4, false],
  ['fetch', /\bfetch\s*\(/, 42, 39, 10.1, false], ['showOpenFilePicker/FS Access', /\bshow(Open|Save|Directory)(File|Picker)\w*\b/, 86, 999, 999, false],
  ['navigator.share', /\bnavigator\.share\b/, 89, 999, 12.1, false],
  // API-uri din ES2017+ / DOM modern pe care fff-compat le acoperă (rezerve doar dacă lipsesc): o pagină fără stratul fff-compat care le folosește pică auditul
  ['String.padStart/padEnd', /\.(padStart|padEnd)\s*\(/, 57, 48, 10, true], ['String.trimStart/trimEnd', /\.(trimStart|trimEnd)\s*\(/, 66, 61, 12, true],
  ['String.matchAll', /\.matchAll\s*\(/, 73, 67, 13, true],
  ['toggleAttribute', /\.toggleAttribute\s*\(/, 69, 63, 12, true], ['scroll cu opțiuni', /\.(scrollTo|scrollBy|scrollIntoView)\s*\(\s*\{/, 61, 36, 14, true],
  ['canvas.toBlob', /\.toBlob\s*\(/, 50, 19, 11, true], ['<dialog>.showModal', /\.showModal\s*\(/, 37, 98, 15.4, true],
  ['MediaQueryList.addEventListener', /matchMedia\([^)]*\)\s*\.addEventListener/, 45, 55, 14, true],
];
// CSS: [nume, regex, chrome, firefox, safari]
const CSS = [
  [':is()/:where()', /:(is|where)\(/, 88, 78, 14], [':has()', /:has\(/, 105, 121, 15.4], [':focus-visible', /:focus-visible/, 86, 85, 15.4],
  ['inset', /(^|[;{\s])inset\s*:/, 87, 66, 14.1], ['aspect-ratio', /aspect-ratio\s*:/, 88, 89, 15], ['gap (flex)', /(^|[;{\s])gap\s*:/, 84, 63, 14.1],
  ['dvh/svh/lvh', /\d(dvh|svh|lvh|dvw)\b/, 108, 101, 15.4], ['clamp()/min()/max()', /\b(clamp|min|max)\(/, 79, 75, 13.1], ['color-mix()', /color-mix\(/, 111, 113, 16.2],
  ['@container', /@container/, 105, 110, 16], ['@layer', /@layer/, 99, 97, 15.4], ['backdrop-filter', /backdrop-filter/, 76, 103, 18], ['CSS nesting', /\{[^{}]*\n\s*&\s*[.:#\w]/, 120, 117, 17.2],
  ['accent-color', /accent-color/, 93, 92, 15.4], ['text-wrap', /text-wrap/, 114, 121, 17.5], [':not(list)', /:not\([^)]*,/, 88, 84, 9],
  ['prefers-color-scheme', /prefers-color-scheme/, 76, 67, 12.1], ['position: sticky', /position\s*:\s*sticky/, 56, 32, 13], ['individual transform props', /(^|[;{\s])(translate|scale|rotate)\s*:/, 104, 72, 14.1],
  ['overflow: clip', /overflow(-[xy])?\s*:\s*clip/, 90, 81, 16], ['logical props', /(margin|padding|border)-(inline|block)(-start|-end)?\s*:/, 87, 66, 14.1],
  ['range media queries', /@media[^{]*\(\s*(width|height)\s*[<>]=?/, 104, 63, 16.4], ['display: contents', /display\s*:\s*contents/, 65, 37, 11.1],
  ['scroll-behavior', /scroll-behavior/, 61, 36, 15.4], ['CSS variables var()', /var\(--/, 49, 31, 9.1],
];

const BLOCK_RE = /\n<!--fff:kit:start[^>]*-->[\s\S]*?<!--fff:kit:end-->/;
const lineAt = (s, i) => s.slice(0, i).split('\n').length;
export function scriptBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const t = ((attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || [0, ''])[1] || '').toLowerCase();
    if (!['', 'text/javascript', 'application/javascript', 'module'].includes(t)) continue;
    const id = (attrs.match(/\bid\s*=\s*["']([^"']+)["']/i) || [0, ''])[1];
    out.push({code: m[2], module: t === 'module', id, line: lineAt(html, m.index + m[0].indexOf('>') + 1)});
  }
  return out;
}
const ES_LEVEL = [
  ['ES2024 /v', 2024], ['ES2022 class fields', 2022], ['ES2022 static block', 2022], ['ES2022 /d', 2022], ['ES2021 logical assignment', 2021], ['ES2021 numeric separators', 2021],
  ['ES2020 optional chaining', 2020], ['ES2020 nullish', 2020], ['ES2020 import()', 2020], ['ES2020 BigInt', 2020], ['ES2019 optional catch binding', 2019],
  ['ES2018 async generator/for await', 2018], ['ES2018 object spread/rest', 2018], ['ES2018 regex lookbehind', 2018], ['ES2018 regex named groups', 2018], ['ES2018 regex \\p', 2018], ['ES2018 regex /s', 2018],
];
function features(code, module) {
  const f = {};
  const add = (k) => { f[k] = (f[k] || 0) + 1; };
  let ast;
  try { ast = acorn.parse(code, {ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true}); }
  catch (e) { return {error: e.message, f}; }
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    switch (n.type) {
      case 'ChainExpression': add('ES2020 optional chaining'); break;
      case 'LogicalExpression': if (n.operator === '??') add('ES2020 nullish'); break;
      case 'AssignmentExpression': if (['||=', '&&=', '??='].includes(n.operator)) add('ES2021 logical assignment'); break;
      case 'CatchClause': if (!n.param) add('ES2019 optional catch binding'); break;
      case 'PropertyDefinition': add('ES2022 class fields'); break;
      case 'StaticBlock': add('ES2022 static block'); break;
      case 'ImportExpression': add('ES2020 import()'); break;
      case 'ForOfStatement': if (n.await) add('ES2018 async generator/for await'); break;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': if (n.async && n.generator) add('ES2018 async generator/for await'); break;
      case 'ObjectExpression': if (n.properties.some((p) => p.type === 'SpreadElement')) add('ES2018 object spread/rest'); break;
      case 'ObjectPattern': if (n.properties.some((p) => p.type === 'RestElement')) add('ES2018 object spread/rest'); break;
      case 'Literal':
        if (n.bigint) add('ES2020 BigInt');
        if (n.regex) {
          const {pattern, flags} = n.regex;
          if (/\(\?<[=!]/.test(pattern)) add('ES2018 regex lookbehind');
          if (/\(\?<[A-Za-z_$]/.test(pattern)) add('ES2018 regex named groups');
          if (/\\[pP]\{/.test(pattern)) add('ES2018 regex \\p');
          if (flags.includes('s')) add('ES2018 regex /s'); if (flags.includes('d')) add('ES2022 /d'); if (flags.includes('v')) add('ES2024 /v');
        } else if (typeof n.value === 'number' && typeof n.raw === 'string' && /\d_\d/.test(n.raw)) add('ES2021 numeric separators');   // doar numere: un șir ca 'a1_2' nu e separator
        break;
      default: break;
    }
    for (const k in n) { if (k === 'type') continue; const v = n[k]; if (v && typeof v === 'object') { if (Array.isArray(v)) v.forEach(walk); else walk(v); } }
  })(ast);
  return {f};
}

// ── ajutoare coborâte, serializate ─────────────────────────────────────────────────────────────────────────────────
// Coborârea (lower.mjs) înlocuiește /…/ și import() cu $fffRx(…)/$fffImp(…), definite o singură dată în prologul paginii. O funcție al cărei
// text se serializează (f.toString() într-un script exportat, într-un Worker creat din Blob, în `new Function`) pierde acel prolog: apelul din ea
// ar da ReferenceError abia la rulare (în browserul vechi SAU nou). Poarta de mai jos găsește aceste cazuri static; sunt acceptate doar dacă
// funcția care serializează conține și textul care definește ajutorul (un șir/șablon cu «$fffRx» etc.) sau dacă ajutorul e declarat local.
const HELPER_CALLS = new Set(['$fffRx', '$fffImp']);
const GLOBAL = Symbol('global');
const isFnNode = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
/** Numele (identificator) sub care o funcție poate fi referită: declarația ei sau variabila/atribuirea căreia i se dă; funcțiile anonime și cheile de obiect nu pot fi referite ca identificator. */
function bindName(n, parent) {
  if (n.type === 'FunctionDeclaration') return n.id ? n.id.name : null;
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.init === n && parent.id.type === 'Identifier') return parent.id.name;
  if (parent.type === 'AssignmentExpression' && parent.right === n && parent.left.type === 'Identifier') return parent.left.name;
  return null;
}
/** Numele ajutorului apelat de un nod CallExpression («$fffRx», «$fffImp», «FFF.rx», «FFF.imp») sau null. */
function helperCalled(n) {
  if (n.type !== 'CallExpression') return null;
  const c = n.callee;
  if (c.type === 'Identifier' && HELPER_CALLS.has(c.name)) return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'FFF' && (c.property.name === 'rx' || c.property.name === 'imp')) return 'FFF.' + c.property.name;
  return null;
}
function walkAst(root, cb) {   // cb(nod, părinte, funcțiile-care-îl-încadrează [{n, name}], toți strămoșii); funcția însăși nu se numără printre ale ei
  const fns = [], anc = [];
  (function w(n, parent) {
    if (!n || typeof n.type !== 'string') return;
    cb(n, parent, fns, anc);
    const fn = isFnNode(n);
    if (fn) fns.push({n, name: bindName(n, parent)});
    anc.push(n);
    for (const k in n) { if (k === 'type') continue; const v = n[k]; if (v && typeof v === 'object') { if (Array.isArray(v)) v.forEach((x) => w(x, n)); else w(v, n); } }
    anc.pop();
    if (fn) fns.pop();
  })(root, null);
}
const bindCache = new Map();
/** Numele legate în domeniul propriu al unei funcții (parametri, var/let/const, funcții și clase declarate, catch), fără funcțiile imbricate. */
function bindingsOf(fnNode) {
  if (bindCache.has(fnNode)) return bindCache.get(fnNode);
  const set = new Set();
  const pat = (p) => {
    if (!p) return;
    if (p.type === 'Identifier') set.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((q) => pat(q.type === 'RestElement' ? q.argument : q.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach(pat);
    else if (p.type === 'RestElement') pat(p.argument);
    else if (p.type === 'AssignmentPattern') pat(p.left);
  };
  fnNode.params.forEach(pat);
  if (fnNode.type === 'FunctionExpression' && fnNode.id) set.add(fnNode.id.name);
  (function w(n) {
    if (!n || typeof n.type !== 'string') return;
    if (isFnNode(n)) { if (n.type === 'FunctionDeclaration' && n.id) set.add(n.id.name); return; }
    if (n.type === 'VariableDeclarator') pat(n.id);
    else if (n.type === 'ClassDeclaration' && n.id) set.add(n.id.name);
    else if (n.type === 'CatchClause') pat(n.param);
    for (const k in n) { if (k === 'type') continue; const v = n[k]; if (v && typeof v === 'object') { if (Array.isArray(v)) v.forEach(w); else w(v); } }
  })(fnNode.body);
  bindCache.set(fnNode, set);
  return set;
}
/** Domeniul în care se rezolvă un nume folosit în funcțiile `fns` (cea mai interioară ultima): funcția care îl leagă, altfel GLOBAL. */
function scopeOf(name, fns) {
  for (let i = fns.length - 1; i >= 0; i--) if (bindingsOf(fns[i].n).has(name)) return fns[i].n;
  return GLOBAL;
}
export function serializedHelperUses(blocks) {
  const scan = blocks.filter((b) => b.code.trim() && b.id !== 'fff-compat' && b.id !== 'fff-imp');
  if (!scan.some((b) => /\$fff(Rx|Imp)\b|\bFFF\.(rx|imp)\b/.test(b.code))) return [];
  const parsed = [];
  for (const b of scan) {
    try { parsed.push({b, ast: acorn.parse(b.code, {ecmaVersion: 'latest', sourceType: b.module ? 'module' : 'script', locations: true, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true})}); }
    catch (e) { /* eroarea de sintaxă o raportează auditul principal */ }
  }
  // 1) funcțiile care declară ele însele ajutorul (parametru / var / function) nu depind de prologul paginii
  const provides = new Map();
  const mark = (fnNode, name) => { if (!provides.has(fnNode)) provides.set(fnNode, new Set()); provides.get(fnNode).add(name); };
  for (const {ast} of parsed) walkAst(ast, (n, parent, fns) => {
    if (isFnNode(n)) for (const p of n.params) if (p.type === 'Identifier' && HELPER_CALLS.has(p.name)) mark(n, p.name);
    if (fns.length && ((n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && HELPER_CALLS.has(n.id.name)) || (n.type === 'FunctionDeclaration' && n.id && HELPER_CALLS.has(n.id.name)))) mark(fns[fns.length - 1].n, n.id.name);
  });
  // 2) funcții legate de un identificator care apelează un ajutor (direct sau prin funcții anonime din ele) fără să-l declare local; cheia = nume → domeniu → ajutoare
  const tainted = new Map();
  for (const {ast} of parsed) walkAst(ast, (n, parent, fns) => {
    const h = helperCalled(n); if (!h) return;
    for (let i = fns.length - 1; i >= 0; i--) {
      if (provides.has(fns[i].n) && provides.get(fns[i].n).has(h)) break;
      const nm = fns[i].name; if (!nm || nm.length < 3) continue;
      const sc = scopeOf(nm, fns.slice(0, i + 1).slice(0, i));   // domeniul în care numele funcției e legat (în afara ei)
      if (!tainted.has(nm)) tainted.set(nm, new Map());
      if (!tainted.get(nm).has(sc)) tainted.get(nm).set(sc, new Set());
      tainted.get(nm).get(sc).add(h);
    }
  });
  if (!tainted.size) return [];
  // 3) locuri unde o astfel de funcție devine TEXT
  const found = [], seen = new Set(), strCache = new Map();
  const stringsOf = (node) => {
    if (strCache.has(node)) return strCache.get(node);
    let s = '';
    (function w(n) { if (!n || typeof n.type !== 'string') return; if (n.type === 'Literal' && typeof n.value === 'string') s += '\n' + n.value; else if (n.type === 'TemplateElement') s += '\n' + (n.value.cooked || n.value.raw);
      for (const k in n) { if (k === 'type') continue; const v = n[k]; if (v && typeof v === 'object') { if (Array.isArray(v)) v.forEach(w); else w(v); } } })(node);
    strCache.set(node, s); return s;
  };
  const helpersOf = (x, fns) => (x && x.type === 'Identifier' && tainted.has(x.name)) ? (tainted.get(x.name).get(scopeOf(x.name, fns)) || null) : null;
  const strish = (x) => !!x && ((x.type === 'Literal' && typeof x.value === 'string') || x.type === 'TemplateLiteral' || (x.type === 'BinaryExpression' && x.operator === '+' && (strish(x.left) || strish(x.right))));
  for (const {b, ast} of parsed) walkAst(ast, (n, parent, fns, anc) => {
    const hits = [];
    const hit = (x) => { const hs = helpersOf(x, fns); if (hs) hits.push({id: x, helpers: hs}); };
    if (n.type === 'CallExpression') {
      const c = n.callee;
      if (c.type === 'MemberExpression' && !c.computed && c.property.name === 'toString') hit(c.object);
      if (c.type === 'Identifier' && c.name === 'String') hit(n.arguments[0]);
      if (c.type === 'MemberExpression' && !c.computed && (c.property.name === 'call' || c.property.name === 'apply') && c.object.type === 'MemberExpression' && c.object.property.name === 'toString') hit(n.arguments[0]);
    } else if (n.type === 'TemplateLiteral') { for (const e of n.expressions) hit(e); }
    else if (n.type === 'BinaryExpression' && n.operator === '+') { if (strish(n.right)) hit(n.left); if (strish(n.left)) hit(n.right); }
    else if (n.type === 'ArrayExpression') {
      let st = null; for (let i = anc.length - 1; i >= 0 && !st; i--) if (/(Statement|Declaration)$/.test(anc[i].type)) st = anc[i];
      if (st && /\btoString\s*\(|\bString\s*\(|Function\.prototype|new\s+Function\b/.test(b.code.slice(st.start, st.end))) for (const e of n.elements) hit(e);
    }
    for (const {id, helpers} of hits) {
      const need = [...helpers], scope = fns.length ? fns[fns.length - 1].n : ast, text = stringsOf(scope);
      if (need.every((h) => text.includes(h))) continue;           // funcția care serializează scrie și definiția ajutorului în codul generat
      const line = b.line + id.loc.start.line - 1, key = id.name + ':' + line;
      if (seen.has(key)) continue; seen.add(key); found.push({name: id.name, helpers: need, line});
    }
  });
  return found;
}

/** Auditul unei aplicații (conținutul HTML) → {syntax:{errors,features}, kit, api, css}. */
export function auditHtml(html, ctx = {}) {
  const kitBlock = (html.match(BLOCK_RE) || [''])[0];
  const kitVer = (kitBlock.match(/fff-kit\s+v?(\d+\.\d+\.\d+)/) || kitBlock.match(/KIT_VERSION\s*=\s*'(\d+\.\d+\.\d+)'/) || [0, ''])[1];
  const errors = [], feats = {};
  const blocks = scriptBlocks(html);
  for (const b of blocks) {
    if (!b.code.trim()) continue;
    if (b.id === 'fff-imp') continue;                 // import() intenționat: modulul e ignorat de motoarele care nu îl știu
    if (b.id === 'fff-compat') {                      // stratul de compatibilitate trebuie să fie ES5 curat
      try { acorn.parse(b.code, {ecmaVersion: 5, sourceType: 'script'}); } catch (e) { errors.push({line: b.line, msg: 'fff-compat nu este ES5: ' + e.message}); }
      continue;
    }
    try { acorn.parse(b.code, {ecmaVersion: FLOOR.ecma, sourceType: b.module ? 'module' : 'script', allowReturnOutsideFunction: !!ctx.loose}); }
    catch (e) { errors.push({line: b.line + (e.loc ? e.loc.line - 1 : 0), msg: e.message}); }
    const r = features(b.code, b.module);
    for (const [k, v] of Object.entries(r.f)) feats[k] = (feats[k] || 0) + v;
  }
  const hasCompat = /<script id="fff-compat">/.test(html) && /<script type="module" id="fff-imp">/.test(html);
  const usesFff = blocks.some((b) => !['fff-compat', 'fff-imp', 'fff-kit'].includes(b.id) && /(\bFFF\.(rx|imp)|\$+fff(Rx|Imp))\(/.test(b.code));
  if (usesFff && !hasCompat) errors.push({line: 0, msg: 'folosește FFF.rx/FFF.imp dar lipsește stratul fff-compat (rulează tools/compat/lower.mjs --write sau aplică kitul)'});
  for (const u of serializedHelperUses(blocks)) errors.push({line: u.line, msg: `«${u.name}» apelează ${u.helpers.join('/')} și i se serializează textul (toString/șablon/Worker) fără ca ajutorul să fie definit în codul generat → ReferenceError în scriptul exportat sau în Worker (scrie în șirul generat, ex.: var $fffRx = function (s, f) { return new RegExp(s, f); };)`});
  // API-urile și CSS-ul APLICAȚIEI: kitul (fff-kit/fff-style) are propriile rezerve și teste (fff-kit/test/legacy.test.mjs)
  const appCode = blocks.filter((b) => b.id !== 'fff-compat' && b.id !== 'fff-imp' && b.id !== 'fff-kit').map((b) => b.code).join('\n');
  const css = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)].filter((m) => !/\bid\s*=\s*["']fff-style["']/.test(m[1])).map((m) => m[2]).join('\n');
  const over = (a) => a[2] > FLOOR.chrome || a[3] > FLOOR.firefox || a[4] > FLOOR.safari;
  const api = API.filter((a) => a[1].test(appCode) && over(a)).map((a) => ({name: a[0], covered: !!a[5]}));
  const needCompat = api.filter((a) => a.covered).map((a) => a.name);
  if (needCompat.length && !hasCompat) errors.push({line: 0, msg: 'folosește API-uri acoperite doar de fff-compat (' + needCompat.slice(0, 4).join(', ') + ') dar pagina nu are stratul (tools/compat/lower.mjs --write îl adaugă)'});
  return {
    kit: kitVer || null, hasCompat,
    syntax: {errors, features: feats},
    api,
    css: CSS.filter((c) => c[1].test(css) && over(c)).map((c) => c[0]),
  };
}

/** Ținte: fiecare depozit contribuie cu index.html (sau docs/index.html) + fișierele din `extraTargets` din config (copii de distribuție, rezultate de build).
 *  Hub-ul (chiuta.github.io) intră doar prin extraTargets. `id` = depozit pentru ținta principală, «depozit:cale» pentru celelalte. */
export function findApps(root, only, skip, opts = {}) {
  const out = [], extras = (CONFIG.extraTargets || {});
  for (const d of fs.readdirSync(root).sort()) {
    if (d.endsWith('.err') || d.startsWith('.')) continue;
    if (only && !only.includes(d)) continue;
    if (skip && skip.includes(d)) continue;
    const dir = path.join(root, d);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    if (d !== 'chiuta.github.io') {
      for (const rel of ['index.html', path.join('docs', 'index.html')]) {
        const f = path.join(dir, rel);
        if (fs.existsSync(f)) { out.push({repo: d, dir, file: f, rel, id: d}); break; }
      }
    }
    if (opts.extras !== false) {
      for (const rel of extras[d] || []) {
        const f = path.join(dir, rel);
        if (fs.existsSync(f) && !out.some((o) => o.file === f)) out.push({repo: d, dir, file: f, rel, id: d + ':' + rel, extra: true});
      }
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const flag = (k) => argv.includes(k);
  const root = path.resolve(opt('--root', path.resolve(HERE, '..', '..', '..')));
  const only = opt('--only') ? opt('--only').split(',') : null, skip = opt('--skip') ? opt('--skip').split(',') : null;
  const apps = findApps(root, only, skip);
  const res = {};
  let fails = 0;
  // rezultate smoke (opțional): același id ca la audit («depozit» sau «depozit:cale»)
  const smoke = {};
  for (const f of (opt('--smoke') || '').split(',').filter(Boolean)) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [id, v] of Object.entries(j.apps || {})) smoke[id] = v;
  }
  const haveSmoke = Object.keys(smoke).length > 0;
  for (const a of apps) {
    const html = fs.readFileSync(a.file, 'utf8');
    const r = auditHtml(html);
    const ex = CONFIG.exceptions[a.repo];
    const needsKit = !!r.kit;
    const failSyntax = r.syntax.errors.length > 0 && !(ex && ex.syntax);
    const failKit = needsKit && (!r.hasCompat || cmpVer(r.kit, CONFIG.kitMinVersion) < 0);
    const sm = smoke[a.id];
    const smokeRec = !haveSmoke ? undefined : sm ? {status: sm.status, newErrors: (sm.newErrors || []).length, nativeErrors: ((sm.native || {}).errors || []).length, legacyErrors: ((sm.legacy || {}).errors || []).length} : {status: 'missing'};
    const failSmoke = !!smokeRec && smokeRec.status === 'fail';
    const status = failSyntax || failKit || failSmoke ? 'fail' : (r.api.some((x) => !x.covered) || r.css.length ? 'warn' : 'ok');
    if (status === 'fail') fails++;
    res[a.id] = {file: a.rel, status, kit: r.kit, compatLayer: r.hasCompat, syntaxErrors: r.syntax.errors, postFloor: r.syntax.features, apiBeyondFloor: r.api, cssBeyondFloor: r.css, ...(smokeRec ? {smoke: smokeRec} : {}), ...(ex ? {exception: ex} : {})};
    if (!flag('--quiet') && status !== 'ok') console.log(`${status.toUpperCase().padEnd(5)} ${a.id.padEnd(34)} kit=${r.kit || '—'} ${r.syntax.errors.length ? 'sintaxă: ' + r.syntax.errors.slice(0, 2).map((e) => `${e.line}:${e.msg.slice(0, 50)}`).join(' | ') : ''}${failKit ? ' [lipsește fff-compat/kit<' + CONFIG.kitMinVersion + ']' : ''}`);
  }
  const summary = {apps: apps.length, ok: 0, warn: 0, fail: 0};
  for (const v of Object.values(res)) summary[v.status]++;
  if (haveSmoke) {
    summary.smoke = {ok: 0, warn: 0, fail: 0, missing: 0};
    for (const v of Object.values(res)) summary.smoke[v.smoke.status] = (summary.smoke[v.smoke.status] || 0) + 1;
  }
  console.log(`compat: ${summary.apps} aplicații · ok ${summary.ok} · avertizări ${summary.warn} · EȘUATE ${summary.fail} · prag ES${FLOOR.ecma}, Chrome ${FLOOR.chrome}, Firefox ${FLOOR.firefox}, Safari ${FLOOR.safari}`);
  if (haveSmoke) console.log(`smoke (motor vechi simulat): ok ${summary.smoke.ok} · avertizări ${summary.smoke.warn} · EȘUATE ${summary.smoke.fail} · lipsă ${summary.smoke.missing}`);
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify({generated: new Date().toISOString().slice(0, 10), floor: FLOOR, kitMinVersion: CONFIG.kitMinVersion, summary, apps: res}, null, 1) + '\n');
  if (flag('--gate') && fails) process.exit(1);
}
function cmpVer(a, b) { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
