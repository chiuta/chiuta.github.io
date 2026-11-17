// tools/compat/lower-lib.mjs — coboară sintaxa JS mai nouă decât pragul (ES2017) la forme echivalente, CU PĂSTRAREA restului fișierului
// (comentarii, spații, ordine): doar nodurile vizate sunt rescrise; tot restul se copiază octet cu octet. Dependențe: acorn (obligatoriu) și, opțional, esbuild
// (pentru construcțiile care nu se rescriu simplu: generatoare asincrone, for await, rest de obiect în pattern, câmpuri de clasă).
//
//   ?.                        → (a == null ? void 0 : a.b)        (temporare $cN, declarate cu var în funcția/scriptul care le conține)
//   ??  ??=  ||=  &&=         → forme cu != null / || / &&
//   catch { }                 → catch (_e) { }
//   separatori numerici 1_000 → 1000
//   literale BigInt 10n       → BigInt("10")                       (rămâne nevoie de BigInt la rulare: vezi FFF.compat.need)
//   {...a, b}                 → Object.assign({}, a, {b})
//   import(x)                 → $fffImp(x)                         (= FFF.imp dacă există stratul fff-compat, altfel respinge promisiunea; vezi fff-kit/src/compat.js)
//   /(?<=a)b/ , /\p{L}/u , /./s , /…/d  → $fffRx("…", "flags")    (= FFF.rx dacă există stratul fff-compat, altfel new RegExp: identic în motoare noi)
//   new RegExp("…\\p{L}…")    → $fffRx("…\\p{L}…")
// Exponentul (**) și async/await sunt ES2016/ES2017 și rămân (pragul garantat: Chrome/Edge 55, Firefox 52, Safari/iOS 10.1).
// Fără esbuild, async generators / for await / rest în pattern / câmpuri de clasă rămân în `manual`. Mereu manuale: delete a?.b,
// (a?.b)() cu `this`, ??= pe ținte complexe, grupuri cu nume în regex, import.meta, steagul d (indices).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function loadAcorn() {
  for (const base of [import.meta.url, 'file:///opt/node-tools/package.json', 'file:///tmp/claude-0/compat/x.js']) {
    try { return createRequire(base)('acorn'); } catch { /* următoarea */ }
  }
  throw new Error('acorn lipsește: npm i acorn');
}
export const acorn = loadAcorn();

/** esbuild (opțional): folosit DOAR pentru ce nu se rescrie simplu cu mâna — async generators, for await, rest în pattern. Lipsa lui lasă acele cazuri în `manual`. */
function loadEsbuild() {
  for (const base of [import.meta.url, 'file:///opt/node-tools/package.json', 'file:///tmp/claude-0/compat/x.js']) {
    try { return createRequire(base)('esbuild'); } catch { /* următoarea */ }
  }
  return null;
}
const esb = loadEsbuild();
export const hasEsbuild = !!esb;

const RX_PROP = /\\[pP]\{/;
const RX_LB = /\(\?<[=!]/;
const RX_NAMED = /\(\?<[A-Za-z_$]/;

function kids(node) {
  if (node.type === 'Property' && node.shorthand) return [node.value];
  const out = [];
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') out.push(x); } else if (typeof v.type === 'string') out.push(v);
    }
  }
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const res = []; let last = -1;
  for (const c of out) { if (c.start < last) continue; res.push(c); last = c.end; }
  return res;
}

/** Șir JS (ghilimele duble) sigur în <script> inline și în motoare ES2017 (fără U+2028/9 brute, fără </ și <!--). */
export function jsString(s) {
  return JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029').replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

/** Plasă de siguranță împotriva „lipirii” de token-uri (return{...s} → returnObject.assign(…) se parsează ca apel valid, deci parsarea nu o vede):
 *  orice identificator din rezultat care nu există în sursă și nu e dintre cele generate de reguli/esbuild se raportează. */
const GEN_NAMES = new Set(['Object', 'assign', 'call', 'apply', 'BigInt', 'rx', 'imp']);
// cuvintele rezervate folosite ca nume de proprietate (Symbol.for, .catch, .return) sunt re-tipate de parser în „name”: nu sunt identificatori noi
const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static await async of get set'.split(' '));
export function tokenCheck(origToks, outToks, {fff = 'FFF', prefix = '$c', generated = new Set()} = {}) {
  const nm = (toks) => { const s = new Set(); for (const t of toks) if (t.type.label === 'name' || t.type.label === 'privateId') s.add(t.value); return s; };
  const a = nm(origToks), tmp = new RegExp('^' + prefix.replace(/\$/g, '\\$') + '\\d+$');
  const bad = [];
  for (const n of nm(outToks)) if (!a.has(n) && n !== fff && !RESERVED.has(n) && !GEN_NAMES.has(n) && !generated.has(n) && !tmp.test(n) && !/^_{1,2}[A-Za-z0-9]*$/.test(n)) bad.push(n);
  return bad.length ? 'identificatori noi în rezultat (token-uri lipite?): ' + bad.slice(0, 8).join(', ') : null;
}

export const rxPrologue = (name = '$fffRx', fff = 'FFF') => `var ${name} = typeof ${fff} === "object" && ${fff} && ${fff}.rx || function (s, f) { return new RegExp(s, f); };`;
export const impPrologue = (name = '$fffImp', fff = 'FFF') => `var ${name} = typeof ${fff} === "object" && ${fff} && ${fff}.imp || function (u) { return Promise.reject(new Error("import() indisponibil")); };`;

export function lowerJs(code, opts = {}) {
  const sourceType = opts.sourceType || 'script';
  const fff = opts.fff || 'FFF';
  const manual = [], stats = {};
  const bump = (k) => { stats[k] = (stats[k] || 0) + 1; };
  const lineOf = (pos) => code.slice(0, pos).split('\n').length + (opts.lineOffset || 0);
  const note = (kind, node, why) => manual.push({line: lineOf(node.start), kind, why: why || '', text: code.slice(node.start, Math.min(node.end, node.start + 90)).replace(/\s+/g, ' ')});

  let ast;
  const origToks = [], generated = new Set();   // generated: nume introduse de esbuild (de încredere); origToks: identificatorii din sursă, pentru verificarea de „lipituri”
  try {
    ast = acorn.parse(code, {ecmaVersion: 'latest', sourceType, allowHashBang: true, preserveParens: true,
      allowAwaitOutsideFunction: sourceType === 'module', onToken: origToks});
  } catch (e) { return {code, changed: false, stats, manual: [{line: 0, kind: 'parse', why: e.message, text: ''}], error: e.message, counter: opts.counter || 0}; }

  let prefix = '$c';
  while (code.includes(prefix)) prefix = '$' + prefix;
  let counter = opts.counter || 0;
  const stack = [{arrowExpr: false, inParams: false, temps: []}];
  const ownerFrame = () => { for (let i = stack.length - 1; i > 0; i--) if (!stack[i].arrowExpr && !stack[i].inParams) return stack[i]; return stack[0]; };
  const newTemp = () => { const t = prefix + (++counter); ownerFrame().temps.push(t); return t; };
  const unparen = (n) => { while (n && n.type === 'ParenthesizedExpression') n = n.expression; return n; };
  const isSimple = (n) => n.type === 'Identifier' || n.type === 'ThisExpression';

  // instrucțiuni aflate direct într-o listă (Program / bloc / case): aici un „;” de siguranță în față nu schimbă sensul;
  // + părinți și „ținte esbuild”: funcția care conține async generators / for await / rest în pattern (se coboară întreagă, cu helperii esbuild)
  const inList = new Set(), parent = new Map(), targets = new Set(), helpers = new Map();
  const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
  const nearestFn = (n) => { let p = parent.get(n); while (p && !isFn(p)) p = parent.get(p); return p || null; };
  (function mark(n, par) {
    parent.set(n, par);
    if (n.type === 'Program' || n.type === 'BlockStatement' || n.type === 'StaticBlock') for (const st of n.body) inList.add(st);
    else if (n.type === 'SwitchCase') for (const st of n.consequent) inList.add(st);
    if (opts.noEsbuild) { /* fără ținte: ce rămâne se raportează în `manual` */ }
    else if (isFn(n) && n.async && n.generator) targets.add(n);
    else if (n.type === 'ForOfStatement' && n.await) { const f = nearestFn(n); if (f) targets.add(f); }
    else if (n.type === 'ObjectPattern' && n.properties.some((q) => q.type === 'RestElement')) { const f = nearestFn(n); if (f) targets.add(f); }
    for (const k of kids(n)) mark(k, n);
  })(ast, null);
  for (const t of [...targets]) { for (let p = parent.get(t); p; p = parent.get(p)) if (targets.has(p)) { targets.delete(t); break; } }

  // lipirea textului original cu cel înlocuit: DOAR dacă un copil a fost rescris și rezultatul ar lipi două token-uri
  // (return{...s} → returnObject.assign(…)), se pune un spațiu. Textul nemodificat (inclusiv șabloanele `a${b}`) nu se atinge niciodată.
  const IDC = /[\w$\u0080-\uffff]/;
  const glue = (a, b, need) => (need && a && b && IDC.test(a[a.length - 1]) && IDC.test(b[0]) ? a + ' ' + b : a + b);
  function weave(from, to, children, strict) {
    let out = '', pos = from, lastRw = false;
    for (const k of children) {
      if (strict && (k.start < from || k.end > to)) continue;
      const r = render(k), rw = r !== code.slice(k.start, k.end);
      out = glue(glue(out, code.slice(pos, k.start), lastRw), r, rw);
      lastRw = rw; pos = k.end;
    }
    return glue(out, code.slice(pos, to), lastRw);
  }
  function copy(node) { return weave(node.start, node.end, kids(node), false); }
  /** Redă segmentul [from,to) al unui nod, înlocuind copiii care cad în segment. */
  function segment(from, to, children) { return weave(from, to, children, true); }
  function openParen(from) {   // poziția lui „(” după callee (sare peste spații, comentarii și „?.”)
    let i = from;
    for (;;) {
      const c = code[i];
      if (c === undefined) return -1;
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
      if (c === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2) + 2; continue; }
      if (c === '?' && code[i + 1] === '.') { i += 2; continue; }
      return c === '(' ? i : -1;
    }
  }

  /** Program sau corp de funcție: redă instrucțiunile și inserează `var $c…;` după prologul de directive. */
  function renderBody(node, frame) {
    const isProg = node.type === 'Program';
    const from = isProg ? 0 : node.start + 1, to = isProg ? code.length : node.end - 1;
    const stmts = node.body;
    let nDir = 0;
    while (nDir < stmts.length && stmts[nDir].type === 'ExpressionStatement' && typeof stmts[nDir].directive === 'string') nDir++;
    const parts = [], rwf = []; let pos = from;
    for (const s of stmts) { const r = render(s); parts.push(code.slice(pos, s.start), r); rwf.push(false, r !== code.slice(s.start, s.end)); pos = s.end; }
    parts.push(code.slice(pos, to)); rwf.push(false);
    for (let i = 1; i < parts.length; i++) if ((rwf[i] || rwf[i - 1]) && parts[i] && parts[i - 1] && IDC.test(parts[i - 1][parts[i - 1].length - 1]) && IDC.test(parts[i][0])) parts[i] = ' ' + parts[i];
    const open = isProg ? '' : '{', close = isProg ? '' : '}';
    const hl = isProg && helpers.size ? [...helpers.values()].join('\n') + '\n' : '';
    if (!frame.temps.length && !hl) return open + parts.join('') + close;
    const decl = hl + (frame.temps.length ? 'var ' + frame.temps.join(', ') + ';' : '');
    let before = parts.slice(0, 2 * nDir).join(''), after = parts.slice(2 * nDir).join('');
    if (nDir && !/;\s*$/.test(before)) before += ';';
    return open + before + (nDir || !isProg ? ' ' : '') + decl + (nDir || isProg ? '' : '') + (isProg && !nDir ? '\n' : '') + after + close;
  }

  /** esbuild pe un fragment → {out, body} (acorn ES2017) sau null; helperii (instrucțiunile dinaintea ultimei) se rețin pentru începutul scriptului. */
  function esbRun(snippet) {
    if (!esb) return null;
    let out, a2;
    const dbg = (m) => { if (process.env.LOWER_DEBUG) console.error('[esbuild] ' + m + ' :: ' + snippet.slice(0, 80).replace(/\s+/g, ' ')); };
    try { out = esb.transformSync(snippet, {target: 'es2017', loader: 'js', legalComments: 'none', charset: 'utf8'}).code; } catch (e) { dbg('transform: ' + String(e.message).split('\n')[0]); return null; }
    // ce a lăsat esbuild neatins (import(), regex moderne, ...) trece prin același codemod, fără a mai chema esbuild
    const low = lowerJs(out, {noEsbuild: true, fff, floor: 2017, verify: true, counter});
    if (low.manual.length || low.floorError) { dbg('rest nelowerabil: ' + (low.floorError || low.manual[0].kind)); return null; }
    counter = low.counter; out = low.code;
    try { for (const t of acorn.tokenizer(out, {ecmaVersion: 'latest'})) if (t.type.label === 'name') generated.add(t.value); } catch { /* lista de nume permise doar se restrânge */ }
    try { a2 = acorn.parse(out, {ecmaVersion: 2017, sourceType: 'script', allowReturnOutsideFunction: true}); } catch (e) { dbg('parse: ' + e.message); return null; }
    const body = a2.body;
    if (!body.length) return null;
    const mine = new Map();
    for (const st of body.slice(0, -1)) {
      const nm = st.type === 'VariableDeclaration' && st.declarations.length === 1 && st.declarations[0].id.type === 'Identifier' ? st.declarations[0].id.name : (st.type === 'FunctionDeclaration' ? st.id.name : null);
      if (!nm) { dbg('helper neașteptat: ' + st.type); return null; }
      const txt = out.slice(st.start, st.end);
      if (helpers.has(nm) && helpers.get(nm) !== txt) { dbg('helper în conflict: ' + nm); return null; }
      mine.set(nm, txt);
    }
    for (const [k, v] of mine) helpers.set(k, v);
    return {out, body, last: body[body.length - 1]};
  }
  const reindent = (text, pos) => { const ls = code.lastIndexOf('\n', pos - 1) + 1, indent = /^[ \t]*/.exec(code.slice(ls))[0]; return text.replace(/\n/g, '\n' + indent); };

  /** Coboară funcția întreagă cu esbuild (target es2017); helperii merg la începutul scriptului. null dacă nu se poate (rămâne în `manual`). */
  function esbLower(fn) {
    let snippet, expr = false;
    if (fn.type === 'FunctionDeclaration') snippet = code.slice(fn.start, fn.end);
    else {
      const p = parent.get(fn);
      if (p && (p.type === 'MethodDefinition' || (p.type === 'Property' && (p.method || p.kind !== 'init')))) return null;   // metodele se tratează la nivelul membrului
      snippet = '(' + code.slice(fn.start, fn.end) + ');'; expr = true;
    }
    const r = esbRun(snippet);
    if (!r) return null;
    let text;
    if (!expr) { if (r.last.type !== 'FunctionDeclaration') return null; text = r.out.slice(r.last.start, r.last.end); }
    else { if (r.last.type !== 'ExpressionStatement' || !isFn(r.last.expression)) return null; text = r.out.slice(r.last.expression.start, r.last.expression.end); }
    bump('esbuild-function');
    return reindent(text, fn.start);
  }
  /** Metodă de clasă / de obiect (async *m(){…} sau cu for await / rest înăuntru): se coboară membrul întreg. */
  function esbLowerMember(m) {
    const isClass = m.type === 'MethodDefinition', text0 = code.slice(m.start, m.end);
    const r = esbRun(isClass ? 'class __FFFK {' + text0 + '\n}' : '({' + text0 + '});');
    if (!r) return null;
    let text;
    if (isClass) { if (r.last.type !== 'ClassDeclaration' || r.last.body.body.length !== 1) return null; const mm = r.last.body.body[0]; text = r.out.slice(mm.start, mm.end); }
    else { if (r.last.type !== 'ExpressionStatement' || r.last.expression.type !== 'ObjectExpression' || r.last.expression.properties.length !== 1) return null; const pp = r.last.expression.properties[0]; text = r.out.slice(pp.start, pp.end); }
    bump('esbuild-method');
    return reindent(text, m.start);
  }

  function renderFunction(n) {
    if (targets.has(n)) { const r = esbLower(n); if (r !== null) return r; }
    if (n.async && n.generator) note('async-generator', n, 'funcție async generator (ES2018): rescrie manual');
    const frame = {arrowExpr: n.type === 'ArrowFunctionExpression' && n.body.type !== 'BlockStatement', inParams: false, temps: []};
    stack.push(frame);
    try {
      let out = '', pos = n.start;
      for (const k of kids(n)) {
        out += code.slice(pos, k.start);
        if (k === n.body) { frame.inParams = false; out += k.type === 'BlockStatement' ? renderBody(k, frame) : render(k); }
        else { frame.inParams = true; out += render(k); }
        pos = k.end;
      }
      return out + code.slice(pos, n.end);
    } finally { stack.pop(); }
  }

  // Ajutoare locale în scriptul rescris: folosesc FFF.rx / FFF.imp când stratul fff-compat există și cad pe RegExp nativ când lipsește
  // (aplicația nu devine mai fragilă decât originalul în motoarele moderne, chiar dacă kitul e scos sau întârzie).
  let rxName = '$fffRx', impName = '$fffImp';
  while (code.includes(rxName)) rxName = '$' + rxName;
  while (code.includes(impName)) impName = '$' + impName;
  const useHelper = (name, text) => {
    if (helpers.has(name)) return name;
    helpers.set(name, text);
    try { for (const t of acorn.tokenizer(text, {ecmaVersion: 'latest'})) if (t.type.label === 'name') generated.add(t.value); } catch { /* inert */ }
    generated.add(name);
    return name;
  };
  const rxFn = () => useHelper(rxName, rxPrologue(rxName, fff));
  const impFn = () => useHelper(impName, impPrologue(impName, fff));
  function rxCall(src, flags) { return `${rxFn()}(${jsString(src)}, ${jsString(flags)})`; }

  function lowerChain(ce) {
    const links = []; let cur = ce.expression;
    while (cur && (cur.type === 'MemberExpression' || cur.type === 'CallExpression')) { links.push(cur); cur = cur.type === 'CallExpression' ? cur.callee : cur.object; }
    const base = cur; links.reverse();
    let st = {code: render(base), simple: isSimple(base), obj: null};
    const conds = [];
    for (let i = 0; i < links.length; i++) {
      const L = links[i], next = links[i + 1];
      if (L.type === 'MemberExpression') {
        if (L.optional) {
          let test = st.code;
          if (!st.simple) { const t = newTemp(); test = `(${t} = ${st.code})`; st = {code: t, simple: true, obj: null}; }
          conds.push(test);
        }
        const prop = L.computed ? `[${render(L.property)}]` : '.' + (L.property.type === 'PrivateIdentifier' ? '#' + L.property.name : L.property.name);
        const needObj = next && next.type === 'CallExpression' && next.optional && next.callee === L;
        let objText = st.code, obj;
        if (needObj && !st.simple) { const o = newTemp(); objText = `(${o} = ${st.code})`; obj = {code: o}; } else obj = {code: st.code};
        st = {code: objText + prop, simple: false, obj};
      } else {   // CallExpression
        const po = openParen(L.callee.end);
        if (po < 0) { note('call-parse', L, 'nu găsesc parantezele apelului'); return undefined; }
        const argsText = segment(po, L.end, L.arguments);
        if (L.optional) {
          if (st.obj) {
            const t = newTemp();
            conds.push(`(${t} = ${st.code})`);
            const inner = argsText.slice(1, -1);
            st = {code: `${t}.call(${st.obj.code}${inner.trim() ? ', ' + inner : ''})`, simple: false, obj: null};
          } else {
            let test = st.code;
            if (!st.simple) { const t = newTemp(); test = `(${t} = ${st.code})`; st = {code: t, simple: true, obj: null}; }
            conds.push(test);
            st = {code: st.code + argsText, simple: false, obj: null};
          }
        } else st = {code: st.code + argsText, simple: false, obj: null};
      }
    }
    bump('optional-chain');
    return `(${conds.map((c) => c + ' == null').join(' || ')} ? void 0 : ${st.code})`;
  }

  function lowerNullish(n) {
    const l = render(n.left), r = render(n.right);
    bump('nullish');
    if (n.left.type === 'Identifier') return `(${l} != null ? ${l} : ${r})`;
    const t = newTemp();
    return `((${t} = ${l}) != null ? ${t} : ${r})`;
  }

  function lowerLogicalAssign(n) {
    const op = n.operator, t = unparen(n.left);
    let A, B;
    if (t.type === 'Identifier') { A = B = t.name; }
    else if (t.type === 'MemberExpression' && t.object.type !== 'Super' && t.property.type !== 'PrivateIdentifier') {
      let obj = render(t.object), objRef = obj;
      if (!isSimple(unparen(t.object))) { const tmp = newTemp(); obj = `(${tmp} = ${obj})`; objRef = tmp; }
      let kA, kB;
      if (!t.computed) { kA = kB = '.' + t.property.name; }
      else if (unparen(t.property).type === 'Literal') { kA = kB = '[' + render(t.property) + ']'; }
      else { const tk = newTemp(); kA = `[${tk} = ${render(t.property)}]`; kB = `[${tk}]`; }
      A = obj + kA; B = objRef + kB;
    } else { note('logical-assign', n, `${op} pe țintă neacceptată: rescrie manual`); return undefined; }
    const R = render(n.right);
    bump('logical-assign');
    if (op === '||=') return `(${A} || (${B} = ${R}))`;
    if (op === '&&=') return `(${A} && (${B} = ${R}))`;
    const tv = newTemp();
    return `((${tv} = ${A}) != null ? ${tv} : (${B} = ${R}))`;
  }

  function lowerObjectSpread(n) {
    const props = n.properties;
    for (const p of props) {
      if (p.type === 'Property' && (p.kind !== 'init' || (!p.computed && ((p.key.name || p.key.value) === '__proto__')))) { note('object-spread', n, 'accesor/__proto__ lângă spread: rescrie manual'); return undefined; }
    }
    const parts = []; let group = [];
    const flush = () => {
      if (!group.length) return;
      let t = '{', pos = group[0].start;
      for (const p of group) { t += code.slice(pos, p.start) + render(p); pos = p.end; }
      parts.push(t + '}'); group = [];
    };
    for (const p of props) { if (p.type === 'SpreadElement') { flush(); parts.push(render(p.argument)); } else group.push(p); }
    flush();
    bump('object-spread');
    return `Object.assign({}, ${parts.join(', ')})`;
  }

  function regexLiteral(n) {
    const {pattern, flags} = n.regex;
    const props = (flags.includes('u') || flags.includes('v')) && RX_PROP.test(pattern);
    const bad = props || RX_LB.test(pattern) || RX_NAMED.test(pattern) || /[sdv]/.test(flags);
    if (!bad) return undefined;
    if (RX_NAMED.test(pattern)) { note('regex-named-group', n, 'grup cu nume (?<nume>…): rescrie manual'); return undefined; }
    if (flags.includes('d')) note('regex-d-flag', n, 'steagul d (indices): FFF.rx îl elimină; verifică folosirea m.indices');
    bump('regex');
    return rxCall(pattern, flags);
  }

  function regexpCtor(n) {
    if (!n.arguments.length) return undefined;
    const a0 = n.arguments[0];
    if (a0.type === 'Literal' && a0.regex) return undefined;
    const src = code.slice(a0.start, a0.end);
    // steaguri literale noi (s dotAll, d indices, v unicodeSets) cu sursă oricare (și dinamică): FFF.rx încearcă întâi nativ
    const a1 = n.arguments[1], newFlag = !!(a1 && a1.type === 'Literal' && typeof a1.value === 'string' && /[sdv]/.test(a1.value));
    if (!(newFlag || RX_PROP.test(src) || RX_LB.test(src) || RX_NAMED.test(src))) return undefined;
    bump('regexp-ctor');
    return `${rxFn()}${segment(openParen(n.callee.end), n.end, n.arguments)}`;
  }

  function handle(n) {
    switch (n.type) {
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return renderFunction(n);
      case 'ChainExpression': return lowerChain(n);
      case 'LogicalExpression': return n.operator === '??' ? lowerNullish(n) : undefined;
      case 'AssignmentExpression':
        return (n.operator === '||=' || n.operator === '&&=' || n.operator === '??=') ? lowerLogicalAssign(n) : undefined;
      case 'UnaryExpression':
        if (n.operator === 'delete' && unparen(n.argument).type === 'ChainExpression') note('delete-chain', n, 'delete a?.b: rescrie manual');
        return undefined;
      case 'CallExpression':
        if (unparen(n.callee).type === 'ChainExpression' && n.callee.type === 'ParenthesizedExpression') note('call-on-chain', n, '(a?.b)() păstrează `this`: rescrie manual');
        if (n.callee.type === 'Identifier' && n.callee.name === 'RegExp') return regexpCtor(n);
        return undefined;
      case 'NewExpression':
        if (n.callee.type === 'Identifier' && n.callee.name === 'RegExp') return regexpCtor(n);
        return undefined;
      case 'CatchClause':
        if (!n.param) {
          bump('catch-binding');
          const name = /\b_e\b/.test(code.slice(n.body.start, n.body.end)) ? '_e2' : '_e';
          return `catch (${name}) ${render(n.body)}`;
        }
        return undefined;
      case 'Literal':
        if (typeof n.value === 'string' && /[\u2028\u2029]/.test(n.raw)) { bump('ls-ps-in-string'); return n.raw.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
        if (n.regex) return regexLiteral(n);
        if (n.bigint) { bump('bigint'); return `BigInt(${jsString(n.raw.slice(0, -1).replace(/_/g, ''))})`; }
        if (typeof n.value === 'number' && n.raw.includes('_')) { bump('numeric-separator'); return n.raw.replace(/_/g, ''); }
        return undefined;
      case 'ObjectExpression':
        return n.properties.some((p) => p.type === 'SpreadElement') ? lowerObjectSpread(n) : undefined;
      case 'ObjectPattern':
        if (n.properties.some((p) => p.type === 'RestElement')) note('object-rest', n, 'rest în pattern ({a, ...r}): rescrie manual');
        return undefined;
      case 'ImportExpression': bump('import'); return `${impFn()}(${render(n.source)})`;
      case 'MetaProperty':
        if (n.meta.name === 'import') note('import-meta', n, 'import.meta (ES2020): rescrie manual');
        return undefined;
      case 'ForOfStatement':
        if (n.await) note('for-await', n, 'for await (ES2018): rescrie manual');
        return undefined;
      case 'PropertyDefinition': case 'StaticBlock': note('class-field', n, 'câmp/bloc static de clasă (ES2022): rescrie manual'); return undefined;
      case 'MethodDefinition': case 'Property':
        if (n.value && isFn(n.value) && targets.has(n.value) && (n.type === 'MethodDefinition' || n.method || n.kind !== 'init')) { const r = esbLowerMember(n); if (r !== null) return r; }
        return undefined;
      case 'ExpressionStatement': {
        const r = copy(n);
        if (r[0] === '(' && code[n.start] !== '(' && inList.has(n)) {
          const prev = code.slice(0, n.start).replace(/\s+$/, '').slice(-1);
          if (prev && prev !== ';' && prev !== '{') return ';' + r;   // evită lipirea de instrucțiunea anterioară fără „;”
        }
        return r;
      }
      default: return undefined;
    }
  }
  function render(n) { const r = handle(n); return r !== undefined ? r : copy(n); }

  const out = renderBody(ast, stack[0]);
  // Rămășițe pe care doar esbuild le poate coborî (câmpuri/blocuri static de clasă din biblioteci vendorizate, ex. Chart.js 4): tot scriptul trece prin esbuild
  // (target es2017), iar rezultatul — tipărit de esbuild — prin aceleași reguli (regex → FFF.rx, import() → FFF.imp), cu aceeași verificare.
  if (esb && !opts.noEsbuild && manual.length && manual.every((m) => m.kind === 'class-field')) {
    try {
      const whole = esb.transformSync(code, {target: 'es2017', loader: 'js', legalComments: 'none', charset: 'utf8'}).code;
      const low = lowerJs(whole, {noEsbuild: true, fff, floor: 2017, verify: true, counter, sourceType, lineOffset: opts.lineOffset});
      if (!low.manual.length && !low.floorError && !low.tokenError && !low.error) {
        return {code: low.code, changed: true, stats: {...low.stats, 'esbuild-script': 1}, manual: [], floorError: null, tokenError: null, counter: low.counter};
      }
    } catch (e) { /* rămâne în `manual` */ }
  }
  const changed = out !== code;
  let floorError = null, tokenError = null;
  if (changed || opts.verify) {
    const outToks = [];
    try { acorn.parse(out, {ecmaVersion: opts.floor || 2017, sourceType, allowHashBang: true, onToken: outToks}); } catch (e) { floorError = e.message; }
    if (!floorError && changed) tokenError = tokenCheck(origToks, outToks, {fff, prefix, generated});
  }
  return {code: out, changed, stats, manual, floorError, tokenError, counter};
}

// ---------------------------------------------------------------- HTML

import {appScripts, ensureCompat} from './layer.mjs';
export {appScripts, ensureCompat};

export function lowerHtml(html, opts = {}) {
  const scripts = appScripts(html);
  let out = '', pos = 0, counter = 0;
  const report = {scripts: scripts.length, changed: 0, stats: {}, manual: [], floorErrors: [], errors: []};
  for (const s of scripts) {
    const lineOffset = html.slice(0, s.start).split('\n').length - 1;
    const r = lowerJs(s.code, {sourceType: s.module ? 'module' : 'script', lineOffset, fff: opts.fff, floor: opts.floor, verify: true, counter});
    if (r.error) { report.errors.push(`script la linia ${lineOffset + 1}: ${r.error}`); continue; }
    counter = r.counter;
    for (const [k, v] of Object.entries(r.stats)) report.stats[k] = (report.stats[k] || 0) + v;
    report.manual.push(...r.manual);
    if (r.floorError) report.floorErrors.push(`script la linia ${lineOffset + 1}: ${r.floorError}`);
    if (r.tokenError) report.floorErrors.push(`script la linia ${lineOffset + 1}: ${r.tokenError}`);
    if (r.changed) { report.changed++; out += html.slice(pos, s.start) + r.code; pos = s.end; }
  }
  out += html.slice(pos);
  return {html: out, report, changed: out !== html};
}
