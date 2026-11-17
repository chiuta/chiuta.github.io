// Teste pentru tools/compat/lower-lib.mjs (codemodul care coboară sintaxa JS la pragul ES2017).
// Fiecare eșantion rulează o dată ca atare și o dată coborât; rezultatele (valori, ordinea efectelor, erori) trebuie să fie identice.
// + cazuri de „lipire” de token-uri (return{...x} → returnObject.assign(…)), plasa tokenCheck și respectarea pragului.
//   Rulare: node tests/compat-lower.test.mjs        (async generators / for await / rest în pattern cer esbuild; fără el se sar)
import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {lowerJs, acorn, hasEsbuild, tokenCheck} = await import(path.join(HUB, 'tools/compat/lower-lib.mjs'));
const {auditHtml, serializedHelperUses, scriptBlocks} = await import(path.join(HUB, 'tools/compat/audit.mjs'));

let ok = 0, bad = 0, skipped = 0;
const T = async (n, f) => { try { await f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const yes = (c, m) => { if (!c) throw new Error(m); };

const samples = [
// --- async generators / for await / rest (esbuild)

`var log=[]; async function* g(n){ try { for (var i=0;i<n;i++){ log.push('y'+i); yield i; } return 'fin'; } finally { log.push('cleanup'); } }
 async function run(){ var out=[]; for await (var v of g(5)) { out.push(v); if (v===2) break; } return [out, log.slice()]; }
 run().then(v => { __async = v; });`,
`var log=[]; async function* g(){ yield 1; yield 2; throw new Error('boom'); }
 async function run(){ var out=[]; try { for await (const v of g()) out.push(v); } catch (e) { out.push('err:'+e.message); } return out; }
 run().then(v => { __async = v; });`,
`async function run(){ var out=[]; for await (const v of [Promise.resolve(1), 2, Promise.resolve(3)]) out.push(v); for await (const ch of 'ab') out.push(ch); return out; }
 run().then(v => { __async = v; });`,
`var order=[]; var o = { async *gen(){ yield 1; yield 2; } };
 async function run(){ for await (const v of o.gen()) order.push(v); return order; } run().then(v => { __async = v; });`.replace('async *gen(){ yield 1; yield 2; }','gen: async function*(){ yield 1; yield 2; }'),
`async function* take(it, n){ var i=0; for await (const x of it) { if (i++>=n) return; yield x; } }
 async function* nat(){ var i=0; while(true) yield i++; }
 async function run(){ var out=[]; for await (const x of take(nat(), 4)) out.push(x); return out; } run().then(v => { __async = v; });`,
`function f(o){ var {a, ...rest} = o; return [a, rest]; } var g = ({x, ...r}, y=2) => [x, r, y]; __r = [f({a:1,b:2,c:3}), g({x:1,z:9}), (function({k, ...m}){ return m; })({k:1, q:2})];`,
`var s = 'a b c'; __r = [s.length, s.charCodeAt(1), s.charCodeAt(3)];`,
`class K { async *items(){ yield 1; yield 2; } async collect(){ var r=[]; for await (const v of this.items()) r.push(v); return r; } } new K().collect().then(v => { __async = v; });`,
// --- optional chaining

`var o={a:{b:0}}; o.a.b ||= 9; o.a.c ??= 1; o.a.b &&= 4; __r=o;`,
`var log=[]; var o={get a(){ log.push('get a'); return {b:null}; }}; o.a.b ??= 5; __r=log;`,
`var log=[]; function k(){ log.push('k'); return 'z'; } var o={z:0}; o[k()] ||= 3; o[k()] &&= 7; __r=[o,log];`,
`var s={set v(x){ this._v=x }, get v(){ return this._v }}; s.v ||= 5; s.v ||= 6; s.v ??= 7; __r=s._v;`,
`var arr=[0,null,2]; arr[0] ||= 1; arr[1] ??= 5; arr[2] &&= 9; arr[arr.length-1] ??= 0; __r=arr;`,
`var o={x:{}}; var i=0; o.x[i++] ??= 'a'; o.x[i++] ??= 'b'; __r=[o,i];`,
`var out=[]; for (var i=0;i<3;i++){ var v = [null,{a:i}][i%2]; out.push(v?.a ?? 'n'+i); } __r=out;`,
`var out=[]; outer: for (var i=0;i<3;i++){ for (var j=0;j<3;j++){ if ((j ?? 0) === 1) continue outer; out.push(i*10+j); } } __r=out;`,
`var f=(a,b)=>a?.[b]?.length ?? -1; __r=[f(null,0), f(['xy'],0), f([[1]],0), f([],3)];`,
`var obj={n:{m(){ return this===obj.n }}}; __r=[obj?.n?.m?.(), obj.n?.m(), obj?.n.m()];`,
`__r = [ 'a-b'.replace(/(?<=-)b/, '[$&]'), 'x'.replace(/(?<!y)x/, 'Z'), 'u'.match(/\u{75}/u)[0] ];`,
`var x = null; __r = (x ?? 1) + (x ?? 2) * 2;`,
`var x = null; __r = !(x ?? false) && (x ?? true);`,
`var d = {}; d.list ??= []; d.list.push(1); d.list ??= ['no']; __r = d;`,
`var c=0; var o={get p(){ c++; return 0 }}; var r = o?.p ?? 'd'; __r=[r,c];`,
`var a = {b:{c:{d:5}}}; var n = null; __r = [a?.b?.c?.d, n?.b, n?.b.c.d, a.x?.y, a?.['b']?.['c']?.d, n?.[0]];`,
`var calls = 0; function get(){ calls++; return {v: calls}; } __r = [get()?.v, get()?.v, calls];`,
`var o = {v: 7, f(){ return this.v; }, g: null}; __r = [o.f?.(), o?.f?.(), o.g?.(), o.h?.(1), o?.f(), (o?.f)?.call({v:9})];`,
`var o = {v: 7, f(){ return this.v; }}; var n; __r = [n?.f(), n?.f?.(), o?.["f"]?.()];`,
`function f(x){ return x?.a?.b ?? 'dflt'; } __r = [f(null), f({}), f({a:{b:0}}), f({a:{b:''}}), f({a:{b:false}})];`,
`var args=[]; var o={f(a,b){ args.push(a,b); return a+b; }}; __r = [o.f?.(1, (args.push('x'),2)), args];`,
`var cnt=0; function mk(){ cnt++; return {f(){return this===undefined?'u':'o'}}; } __r=[mk()?.f?.(), mk()?.f(), cnt];`,
`var n=null; __r = [typeof n?.a, typeof (n?.a), (n?.a) === undefined, void n?.a];`,
`var a={b:[1,2,{c:3}]}; __r = [a?.b?.[2]?.c, a?.b?.length, a.b?.[5]?.c];`,
`function* g(o){ yield o?.a?.b; yield o?.a ?? 'z'; } __r = [...g({a:{b:1}}), ...g(null)];`,
`async function af(o){ return (await o?.p)?.q ?? 'none'; } af({p: Promise.resolve({q: 4})}).then(v=>{ __async=v; });`,
`var o = {a:{b:()=>({c:()=>42})}}; __r = o?.a?.b?.()?.c?.();`,
`var ob = {x: undefined}; __r = [ob?.x?.y.z.w, ob?.x?.y(), (ob?.x)?.y];`.replace('(ob?.x)?.y','(ob?.x ?? {}).y'),
// --- nullish
`var a=null,b=0,c='',d; __r=[a??1, b??2, c??3, d??4, (a ?? b) ?? 5, a ?? (b ?? 6)];`,
`var n=0; function t(){ n++; return 0; } __r=[t() ?? 5, n];`,
`var o={a:null}; __r=[o.a ?? 'x', o.b ?? 'y', (o.a ?? o.b) ?? 'z', (1, 2) ?? 3];`,
`var x = null; var y = x ?? (1, 2); __r = y;`,
`var o={}; o.p ??= 5; o.p ??= 6; o.q ||= 7; o.q &&= 8; var s=''; s ||= 'def'; var z=1; z &&= 2; var w; w ??= 3; __r=[o,s,z,w];`,
`var o={a:{b:0}}; o.a.b ||= 9; o.a.c ??= 1; __r=o;`,
`var f = (x = null) => x ?? 'def'; __r=[f(), f(0), f(undefined), f(null)];`,
`function g(a = b ?? 'dp', b) { return a; } var b; __r = g();`,
`function h(a, d = a?.x ?? 3) { return d; } __r=[h({x:1}), h(null), h({})];`,
// --- ASI / statement-position
`var q = 1\nvar k = null\nk ??= 4\n;(function(){})()\n__r = [q, k]`,
`var c = true, x = null; if (c) x ??= 1; else x ??= 2; __r = x;`,
`var c = false, x = null; if (c) x ??= 1; __r = x;`,
`var i=0, x=null; for (;i<2;i++) x ??= i+10; __r=x;`,
`var x=null; switch(1){ case 1: x ??= 3; break; default: x ??= 4; } __r=x;`,
`var x=null; lbl: x ??= 5; __r=x;`,
`var o={f(){return 1}}\no?.f()\nvar r = o?.f()\n__r=r`,
`var t=0\nlet v = {a:1}\nv?.a\n__r = v?.a`,
`var a = {b: function(){ return 7 }}; (a?.b)(); var r = a.b?.(); __r=r;`.replace('(a?.b)();','a.b();'),
// --- directives & nesting
`function f(o){ 'use strict'; return o?.a?.b; } __r=[f(null), f({a:{b:1}}), (function(){ 'use strict'\n return this })()];`,
`function f(o){ "use strict" ; "x" ; return o?.a?.b ?? 0; } __r = f({a:{}});`,
`var out=[]; [1,null,{v:2}].forEach(x=>out.push(x?.v ?? -1)); __r=out;`,
`var out = [{a:{b:1}}, null, {a:null}].map(x => x?.a?.b); __r = out;`,
`var f = function(){ var g = () => { var h = o => o?.p?.q; return h; }; return g(); }; __r=[f()({p:{q:5}}), f()(null)];`,
`class A { m(o){ return o?.x ?? 'none'; } static s(o){ return o?.y?.z; } get g(){ return this.v?.w; } constructor(){ this.v = {w:3}; } } __r=[new A().m({x:1}), new A().m(), A.s({y:{z:2}}), new A().g];`,
`var o = { m(){ return this?.k ?? 'no'; }, k: 'yes' }; __r = o.m();`,
// --- catch / numbers / bigint
`var r=[]; try{ throw 1 }catch{ r.push('c'); } try{ throw 2 }catch(e){ r.push(e) } __r=r;`,
`var _e = 'outer'; try{ throw 1 }catch{ __r = _e; }`,
`__r = [1_000_000, 0xFF_FF, 0b1010_1010, 1e1_0, .5_5, 1_0.0_1];`,
`__r = [String(10n + 20n), String(2n ** 64n), String(0xFFn), typeof 5n, String(1_000n)];`,
// --- object spread
`var a={x:1,y:2}, c={y:3,z:4}; __r = [{...a}, {...a, w:0}, {w:0, ...a, ...c}, {...a, y:9}, {...null, ...undefined, k:1}, {...'ab'}, {...[7,8]}];`,
`var a={x:1}; var o = {...a, get g(){ return 1 }}; __r = Object.keys(o);`.replace(', get g(){ return 1 }',', g(){ return 1 }'),
`var k='dyn'; var a={x:1}; __r = {...a, [k]: 2, ['a'+'b']: 3};`,
`var a={x:1}; var f = ({p}) => ({...p, extra: true}); __r = f({p: a});`,
// --- regex
`__r = ['aXb cXd'.replace(/(?<=a)X/g, '-'), 'ab'.match(/\\p{L}+/u)[0], 'a\\nb'.match(/a.b/s) !== null, 'x'.search(/(?<!y)x/)];`,
`__r = ['é1'.match(new RegExp('\\\\p{L}','u'))[0], RegExp('(?<=a)b').test('ab')];`,
`var rr=/(?<=\\$)\\d+/; __r = rr.exec('cost $42')[0];`,
`__r = 'a, b; c'.split(/(?<=[,;])\\s+/);`,
`__r = [/\\(\\?<=x/.test('(?<=x'), /[(?<=]/.test('(')];`,
// --- import
`var p = typeof import('data:text/javascript,export default 1'); __r = p;`,
`__r = typeof (async () => { try { await import('data:text/javascript,export default 1') } catch (e) {} })();`,
// --- strings/templates/comments untouched
"var s = 'a?.b ?? c'; var t = `x ${s?.length ?? 0} y ${null ?? 'q'}`; /* a?.b */ // x ?? y\n__r = [s, t];",
`var o = {a: 1}; var x = o?.a /* c1 */ ?? /* c2 */ 2; __r = x;`,
// --- „lipire” de token-uri după cuvinte-cheie (nu există spațiu în sursă)
`function f(s){ return{...s, a:1} } __r = [f({b:2}), f(null)];`,
`function g(o){ if (o) return{...o, z:0}\n else return{} } __r = [g({k:1}), g(null)];`,
`var t = typeof{...{a:1}}; __r = t;`,
`function th(e){ try { throw{...e, t:1} } catch (x) { return x } } __r = th({m:2});`,
`function* ys(a){ yield{...a, i:1}; yield{...a, i:2}; } __r = [...ys({q:0})];`,
`async function aw(a){ return await{...a, w:1} } aw({p:1}).then(v => { __async = v; });`,
`var d = {a:1}; __r = [delete{...d}.a, void{...d}, ({...d} instanceof Object)];`,
`var k='x'; __r = k in{...{x:1}};`,
`switch(1){ case 1: var cs = {...{p:1}}; break; } __r = cs;`,
`function re(){ return/(?<=a)b/.test('ab') } __r = re();`,
`function rg(s){ return/\\p{L}+/u.exec(s)[0] } __r = rg('éa1');`,
"var x = {y: null}; __r = [`puncte${x}b${x?.y ?? 'n'}c`, `a${1}b${2}c${x?.y}`];",
`var q1 = 1\nvar q2 = q1\n;[q1, q2].forEach(function(v){ __r = (__r||0) + v })`,
];

const stub = `var FFF = {rx: function(s,f){ return new RegExp(s,f); }, imp: function(u){ return import(u); }};`;
async function run(code) {
  const ctx = vm.createContext({console, Promise, __r: undefined, __async: undefined, import: undefined}, {});
  let err = null;
  try {
    const script = new vm.Script(stub + '\n' + code, {importModuleDynamically: vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER});
    script.runInContext(ctx);
  } catch (e) { err = String(e && e.message || e); }
  await new Promise((r) => setTimeout(r, 5));
  return {err, r: JSON.stringify(ctx.__r, (k, v) => typeof v === 'bigint' ? v.toString() + 'n' : v === undefined ? '«undef»' : v), a: JSON.stringify(ctx.__async)};
}
const needsEsbuild = (s) => /async\s*\*|async function\*|for await|\.\.\.\w+\}\s*[,)]\s*=|var \{a, \.\.\.rest\}|\{k, \.\.\.m\}|\{x, \.\.\.r\}/.test(s);

await T('eșantioane: rezultat identic înainte/după coborâre (' + samples.length + ' cazuri)', async () => {
  const fails = [];
  for (const s of samples) {
    if (!hasEsbuild && needsEsbuild(s)) { skipped++; continue; }
    const lo = lowerJs(s, {verify: true});
    if (lo.error) { fails.push('parse: ' + lo.error + ' :: ' + s.slice(0, 60)); continue; }
    if (lo.floorError) { fails.push('peste prag: ' + lo.floorError + ' :: ' + s.slice(0, 60)); continue; }
    if (lo.tokenError) { fails.push('lipituri: ' + lo.tokenError + ' :: ' + s.slice(0, 60)); continue; }
    const a = await run(s), b = await run(lo.code);
    if (a.err !== b.err || a.r !== b.r || a.a !== b.a) fails.push(`orig=${a.err || a.r}  coborât=${b.err || b.r} :: ${s.slice(0, 70).replace(/\n/g, ' ')}`);
  }
  yes(!fails.length, fails.length + ' diferențe:\n         ' + fails.slice(0, 5).join('\n         '));
});

await T('rezultatul coborât se parsează la pragul ES2017 (fără ?. ?? ... ||= catch{} separatori, BigInt literal)', () => {
  const lo = lowerJs('var a = x?.y ?? 1_0; a ||= 2n; try{}catch{}; var o = {...a}; var r = /(?<=a)b/u;', {verify: true});
  yes(!lo.floorError && !lo.tokenError, lo.floorError || lo.tokenError);
  acorn.parse(lo.code, {ecmaVersion: 2017});
});

await T('lipire: cuvânt-cheie + înlocuire primește spațiu (return{...s} → return Object.assign(…))', () => {
  for (const [src, want] of [['function f(s){ return{...s, a:1} }', 'return Object.assign('], ['var t = typeof{...q}', 'typeof Object.assign('], ['throw{...e}', 'throw Object.assign('],
    ['function* h(){ yield{...a}; }', 'yield Object.assign('], ['function r(){ return/(?<=a)b/.test(1) }', 'return $fffRx(']]) {
    const lo = lowerJs(src, {verify: true});
    yes(lo.code.includes(want), src + ' → ' + lo.code);
    yes(!/\b(return|typeof|throw|yield)(Object|FFF|\$fff)/.test(lo.code), 'lipit: ' + lo.code);
  }
});

await T('fără stratul FFF (kit scos sau întârziat) codul coborât rulează cu RegExp nativ, ca originalul', async () => {
  const srcs = ["__r = ['a-b'.replace(/(?<=-)b/, '[$&]'), /\\p{L}+/u.exec('é1')[0], 'a\\nb'.match(/a.b/s) !== null, new RegExp('\\\\p{Lu}', 'u').test('É')];",
    "function f(s){ return/(?<!x)y/.test(s) } __r = [f('y'), f('xy')];"];
  for (const src of srcs) {
    const lo = lowerJs(src, {verify: true});
    yes(!lo.floorError && !lo.tokenError && /\$fffRx/.test(lo.code), 'nu s-a coborât: ' + lo.code);
    const run = (code) => { const ctx = vm.createContext({__r: undefined}); vm.runInContext(code, ctx); return JSON.stringify(ctx.__r); };   // fără FFF în context
    yes(run(src) === run(lo.code), run(src) + ' ≠ ' + run(lo.code));
  }
});

await T('șabloane: textul dintre ${…} nu primește spații (lipirea se aplică doar copiilor rescriși)', () => {
  const lo = lowerJs('var x = {y: null}; var s = `puncte${x}b${x?.y}c`;', {verify: true});
  yes(lo.code.includes('`puncte${x}b${(x == null ? void 0 : x.y)}c`'), lo.code);
  yes(!lowerJs('var s = `ab${x}cd${y}é${z}é`; var t = "a" + `b${1}c`;', {verify: true}).changed, 'cod fără sintaxă nouă rescris fără motiv');
});

await T('tokenCheck: prinde identificatori lipiți, acceptă numele generate de reguli', () => {
  const toks = (s) => { const t = []; acorn.parse(s, {ecmaVersion: 2017, onToken: t}); return t; };
  const bad = tokenCheck(toks('function f(s){ return s }'), toks('function f(s){ returnObject.assign({}, s) }'));
  yes(bad && /returnObject/.test(bad), 'nu a prins returnObject: ' + bad);
  const good = tokenCheck(toks('function f(s){ return s }'), toks('function f(s){ var $c1; return Object.assign({}, s, FFF.rx("a"), BigInt("1"), $c1.call(s), _e) }'));
  yes(good === null, 'fals-pozitiv: ' + good);
  const kw = tokenCheck(toks('x.a'), toks('x.catch(1).for.return'));
  yes(kw === null, 'cuvinte rezervate ca proprietăți: ' + kw);
});

await T('manual: construcțiile fără echivalent sigur rămân semnalate (nu se rescriu pe ghicite)', () => {
  const lo = lowerJs('class A { x = 1 }; var o = {a:1}; delete o?.a;', {verify: true});
  yes(lo.manual.length >= 1 || lo.floorError, 'nimic semnalat');
});

/* ---- poarta „ajutor coborât serializat”: funcții care devin text (toString/șablon/Worker) nu mai au prologul paginii ---- */
const PRO = 'var $fffRx = typeof FFF === "object" && FFF && FFF.rx || function (s, f) { return new RegExp(s, f); };\n';
const pg = (code) => '<!doctype html><script id="fff-compat"></script><script type="module" id="fff-imp"></script><script>' + PRO + code + '</script>';
const uses = (code) => serializedHelperUses(scriptBlocks(pg(code)));
const ENGINE = 'function ENGINE(){ return { clean: function (s) { return s.replace($fffRx("\\\\0.*$", "s"), ""); } }; }\n';
const DEF = "'var $fffRx = function (s, f) { return new RegExp(s, f); };\\n' + ";

await T('serializare: toString() al unei funcții cu $fffRx, fără definiția ajutorului în codul generat, e semnalat (cazul Worker din Blob)', () => {
  const u = uses(ENGINE + "function mk(){ return 'const API=(' + ENGINE.toString() + ')();'; }");
  yes(u.length === 1 && u[0].name === 'ENGINE' && u[0].helpers.join() === '$fffRx', JSON.stringify(u));
  const errs = auditHtml(pg(ENGINE + "function mk(){ return 'const API=(' + ENGINE.toString() + ')();'; }")).syntax.errors.filter((e) => /serializ/.test(e.msg));
  yes(errs.length === 1 && /ENGINE/.test(errs[0].msg) && errs[0].line >= 1, 'auditHtml nu raportează: ' + JSON.stringify(errs));
});

await T('serializare: același cod cu definiția ajutorului scrisă în șirul generat (cazul scriptului exportat) nu e semnalat', () => {
  yes(uses(ENGINE + 'function mk(){ return ' + DEF + "'const API=(' + ENGINE.toString() + ')();'; }").length === 0, 'fals-pozitiv');
  yes(uses(ENGINE + 'function mk(){ const L=[]; L.push(' + DEF.replace(/ \+ $/, '') + '); L.push(`const API=(${ENGINE})();`); return L.join(""); }').length === 0, 'fals-pozitiv (șablon)');
});

await T('serializare: tabloul de funcții cu .map(f => f.toString()) (cazul DataWeave) e semnalat doar fără definiție', () => {
  const T1 = ENGINE + 'function other(){ return 1 }\nfunction gen(){ return [other, ENGINE].map(f => f.toString()).join("\\n"); }';
  const u = uses(T1); yes(u.length === 1 && u[0].name === 'ENGINE', JSON.stringify(u));
  yes(uses(T1.replace('return [other', "const pre = 'var $fffRx = function (s, f) { return new RegExp(s, f); };'; return pre + [other")).length === 0, 'fals-pozitiv cu definiție');
});

await T('serializare: apelurile obișnuite, handler-ele și ajutorul declarat local nu sunt semnalate', () => {
  yes(uses(ENGINE + "var r = ENGINE(); btn.onclick = ENGINE; list.forEach(ENGINE);").length === 0, 'apel/handler');
  yes(uses('function LOC(){ var $fffRx = function (s, f) { return new RegExp(s, f); }; return $fffRx("a", "s"); }\nfunction mk(){ return "(" + LOC.toString() + ")()"; }').length === 0, 'ajutor local');
});

await T('serializare: același nume pe o variabilă locală din alt domeniu nu dă fals-pozitiv (rezolvare pe domenii)', () => {
  const code = ENGINE + "function parse(text){ const out = []; for (let ENGINE of text.split(',')) { out.push('stun:' + ENGINE); } return out; }\n";
  yes(uses(code).length === 0, 'fals-pozitiv: ' + JSON.stringify(uses(code)));
  yes(uses(code + "function mk(){ return 'a' + ENGINE; }").length === 1, 'referința la funcția globală trebuie semnalată');
});

console.log(`\n${ok} reușite, ${bad} eșuate` + (skipped ? `, ${skipped} eșantioane sărite (fără esbuild)` : ''));
process.exit(bad ? 1 : 0);
