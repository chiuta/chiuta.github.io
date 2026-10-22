// Teste reguli noi build.mjs check (kit 1.2.0): native-dialog, unprefixed-storage, cdn-without-sri, i18n-parity + excepții + lax/strict
// + scanner (lib/jsscan.mjs) + uneltele/i18n-parity. Fără browser. Rulare: node test/rules.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyKit, runInfo, checkKit} from '../build.mjs';
import {maskJs, inlineJsScripts} from '../lib/jsscan.mjs';
import {nativeDialogIssues, unprefixedStorageIssues, cdnWithoutSriIssues, i18nParityIssues, keyHasPrefix} from '../lib/rules.mjs';
import {analyzeI18n, compareLangMajor, compareKeyMajor} from '../lib/i18n-parity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(path.join(HERE, 'fixture.html'), 'utf8');
let pass = 0, fail = 0;
const check = (n, c, extra) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); } };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fffr-'));
const page = (body, head = '') => `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-x'; style-src 'unsafe-inline'"><meta name="application-version" content="1.0.0"><meta name="last-updated" content="2026-10-01"><title>T</title>${head}</head><body><span id="app-version">v1.0.0</span><script>${body}</script></body></html>`;
function mkApp(html, cfg) { const d = tmp(); fs.writeFileSync(path.join(d, 'index.html'), html); if (cfg) fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify(cfg)); applyKit(d, {slug: 'demo', modules: 'core,label,bundle'}); return d; }
const run = (args) => spawnSync('node', [path.join(HERE, '..', 'build.mjs'), ...args], {encoding: 'utf8'});

console.log('jsscan');
check('mascare: comentarii, șiruri, șabloane, regex', (() => {
  const c = 'a = "alert(1)"; // confirm(2)\n/* prompt(3) */ b = `x ${ foo("bar") } alert(4)`; r = /alert\\(/g; c = 5 / 2;';
  const m = maskJs(c);
  return m.length === c.length && !/alert|confirm|prompt/.test(m.replace(/foo/, '')) && /foo\(/.test(m) && /5 \/ 2/.test(m) && m.includes('\n');
})());
check('scripturi inline: exclude src, JSON, ld+json', inlineJsScripts('<script src="a.js"></script><script type="application/json">{"a":1}</script><script>var x=1</script><script type="module">import 1</script>').length === 2);

console.log('native-dialog');
const nd = (code, extra = '') => nativeDialogIssues(page(code) + extra);
check('apeluri directe alert/confirm/prompt detectate cu linia', nd('var a = 1;\nif (confirm("sigur?")) alert("ok"); var n = prompt("nume");').length === 1 && /3 apeluri/.test(nd('var a = 1;\nif (confirm("sigur?")) alert("ok"); var n = prompt("nume");')[0]) && /alert\/confirm\/prompt|confirm\/alert\/prompt|prompt/.test(nd('confirm(1)')[0]));
check('window.confirm( și window . alert( detectate', nd('window.confirm("x"); window . alert(1)').length === 1 && /2 apeluri/.test(nd('window.confirm("x"); window . alert(1)')[0]));
check('FFF.dialog.confirm(…), x.alert(…), metode și definiții NU se numără', nd('FFF.dialog.confirm("x"); ui.alert("y"); function confirm(m){return 1}; const o = {prompt(m){ return 2 }, alert: function(){}}; class K { alert(x){ } }').length === 0);
check('în șiruri și comentarii NU se numără', nd('var s = "alert(1)"; // confirm(2)\n/* prompt(3) */ var t = `confirm(${1})`;').length === 0);
check('în atribute inline onclick="…confirm(…)" se numără', nativeDialogIssues(page('') .replace('<span', '<button onclick="if(confirm(\'x\'))go()">a</button><span')).length === 1);
check('fără apeluri → nimic', nd('var x = 1;').length === 0);

console.log('unprefixed-storage');
const us = (code, slug = 'demo', cfg) => unprefixedStorageIssues(page(code), slug, cfg);
check('chei fără prefix detectate (getItem/setItem/removeItem/localStorage[…])', us('localStorage.setItem("state","1"); var t = localStorage.getItem(\'theme\'); localStorage.removeItem(`old`); var z = localStorage["zoom"];').length === 1 && /4 chei/.test(us('localStorage.setItem("state","1"); var t = localStorage.getItem(\'theme\'); localStorage.removeItem(`old`); var z = localStorage["zoom"];')[0]));
check('chei cu prefixul slugului (. _ : - / camelCase) sau fff. acceptate', us('localStorage.setItem("demo.a",1); localStorage.setItem("demo_b",1); localStorage.setItem("demo:c",1); localStorage.setItem("demo-d",1); localStorage.setItem("demoE",1); localStorage.setItem("fff.x",1);').length === 0);
check('lang/language/locale și sondele __t acceptate', us('localStorage.setItem("lang","ro"); localStorage.setItem("__t","1"); localStorage.setItem("locale","x")').length === 0);
check('slug de tip „xyz-fara-frontiere”: prefix scurt „xyz” acceptat', us('localStorage.setItem("sah_pref",1)', 'sah-fara-frontiere').length === 0);
check('sessionStorage ignorat; chei dinamice (variabile, concatenări) neverificate', us('sessionStorage.setItem("tmp",1); localStorage.setItem(K, 1); localStorage.getItem(P + "x"); localStorage.getItem(`a${b}`)').length === 0);
check('constantă *_KEY fără prefix detectată', us('const STORAGE_KEY = "app_state_v1"; localStorage.getItem(STORAGE_KEY)').length === 1);
check('în comentarii/șiruri NU se numără', us('// localStorage.setItem("x",1)\nvar s = "localStorage.getItem(\'y\')";').length === 0);
check('config.storagePrefixes acceptă prefixe suplimentare', us('localStorage.setItem("old_a",1)', 'demo', {storagePrefixes: ['old_']}).length === 0 && us('localStorage.setItem("old_a",1)', 'demo').length === 1);
check('keyHasPrefix: „demo” gol sau fără separator nu trece', !keyHasPrefix('demo', 'demo') && !keyHasPrefix('demolition', 'demo') && keyHasPrefix('demo.x', 'demo'));

console.log('cdn-without-sri');
const cd = (head, body = '') => cdnWithoutSriIssues(page(body, head));
check('script extern fără integrity detectat', cd('<script src="https://cdn.example.com/a.js"></script>').length === 1);
check('link stylesheet extern fără integrity detectat; cu integrity → ok', cd('<link rel="stylesheet" href="https://x.example/s.css">').length === 1 && cd('<link rel="stylesheet" href="https://x.example/s.css" integrity="sha384-abc" crossorigin="anonymous">').length === 0);
check('//cdn… (fără schemă) detectat', cd('<script src="//cdn.example.com/a.js"></script>').length === 1);
check('resurse locale/relative, localhost, icon/preconnect/canonical/manifest NU', cd('<script src="a.js"></script><link rel="stylesheet" href="s.css"><link rel="preconnect" href="https://fonts.example.com"><link rel="canonical" href="https://x.example/"><link rel="icon" href="https://x.example/i.png"><script src="http://localhost:8000/a.js"></script>').length === 0);
check('în comentarii HTML NU', cd('<!-- <script src="https://cdn.example.com/a.js"></script> -->').length === 0);
check('script injectat dinamic extern fără integrity detectat', cd('', 'var s = document.createElement("script"); s.src = "https://cdn.example.com/x.js"; document.head.appendChild(s);').length === 1 && cd('', 'var s = document.createElement("script"); s.src = "https://cdn.example.com/x.js"; s.integrity = "sha384-a"; ').length === 0);

console.log('i18n-parity');
check('limbă→chei: cheie lipsă într-o limbă', (() => { const r = i18nParityIssues(page('var I18N = {ro:{a:"1",b:"2"}, en:{a:"1"}};')); return r.length === 1 && /I18N/.test(r[0]) && /en: 1 \(b\)/.test(r[0]); })());
check('limbă→chei: imbricate (a.b.c) și 3 limbi', (() => { const r = i18nParityIssues(page('const T = {ro:{m:{x:"1",y:"2"}}, en:{m:{x:"1",y:"2"}}, fr:{m:{x:"1"}}};')); return r.length === 1 && /fr: 1 \(m\.y\)/.test(r[0]); })());
check('limbă→chei: paritate completă → nimic', i18nParityIssues(page('var I18N = {ro:{a:"1"}, en:{a:"2"}, fr:{a:"3"}};')).length === 0);
check('chei între ghilimele și virgule finale', i18nParityIssues(page('var I18N = {"ro":{"a":"1","b":"2",}, "en":{"a":"1",},};')).length === 1);
check('cheie→limbi: intrare fără o limbă', (() => { const r = i18nParityIssues(page('var L = {titlu:{ro:"a",en:"b",fr:"c"}, buton:{ro:"a",en:"b"}};')); return r.length === 1 && /fr: 1 \(buton\)/.test(r[0]); })());
check('registerI18n(modul, {…}) recunoscut', i18nParityIssues(page('FFF.registerI18n("app", {ro:{a:"1",b:"2"}, en:{a:"1"}});')).length === 1);
check('completări: cheia lipsă definită pentru aceeași limbă într-un al doilea obiect (Object.assign) NU se raportează', i18nParityIssues(page('var T = {ro:{a:"1",b:"2"}, en:{a:"1"}}; var EXTRA = {en:{b:"2"}, ro:{b:"2"}}; Object.assign(T.en, EXTRA.en);')).length === 0);
check('JSON <script type="application/json" id="x-i18n"> analizat', i18nParityIssues(page('', '<script type="application/json" id="app-i18n">{"ro":{"a":"1","b":"2"},"en":{"a":"1"}}</script>')).length === 1);
check('tablouri de lungimi diferite (format {k:[..], en:[..]})', i18nParityIssues(page('', '<script type="application/json" id="d-i18n">{"k":["a","b","c"],"en":["x","y"],"fr":["x","y","z"],"ro":["a","b","c"]}</script>')).length === 1);
check('în șiruri/comentarii NU: „// ro:{” și "ro:{" în text', i18nParityIssues(page('// ro:{a:1} en:{b:1}\nvar s = "ro:{a:1}, en:{b:1}";')).length === 0);
check('obiecte neevaluabile (apeluri, spread) sunt ignorate, fără excepții', (() => { try { return i18nParityIssues(page('var T = {ro:{a: f()}, en:{...x}};')).length === 0; } catch { return false; } })());
check('tabel brut cu „|”: rânduri cu număr greșit de coloane', (() => { const rows = Array.from({length: 30}, (_, i) => `r${i}|e${i}|f${i}|g${i}`); rows[7] = 'doar|doua'; const r = i18nParityIssues(page('var RAW = "' + rows.join('\\n') + '";')); return r.length === 1 && /rând/.test(r[0]); })());
check('compareLangMajor/KeyMajor: API', compareLangMajor({ro: {a: 1}, en: {}}).missing.en[0] === 'a' && compareKeyMajor({x: {ro: 'a'}, y: {ro: 'a', en: 'b'}}).missing.en[0] === 'x');
check('JSON-ul kitului (fff-i18n) are paritate completă în toate modulele', (() => {
  const mods = fs.readdirSync(path.join(HERE, '..', 'i18n')).filter((f) => f.endsWith('.json'));
  const bad = [];
  for (const f of mods) { const j = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'i18n', f), 'utf8')); const r = compareLangMajor(j); if (r && Object.keys(r.missing).length) bad.push([f, r.missing]); }
  return bad.length === 0 ? true : JSON.stringify(bad).slice(0, 300);
})());

console.log('check: lax = avertisment, strict = eroare, excepții');
{
  const bad = page('localStorage.setItem("stare", 1); if (confirm("sigur?")) {}', '<script src="https://cdn.example.com/a.js"></script>').replace('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-x\'; style-src \'unsafe-inline\'">', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-x\' https://cdn.example.com; style-src \'unsafe-inline\'">');
  const d = mkApp(bad);
  const strict = checkKit(d), lax = checkKit(d, {lax: true});
  const has = (arr, rule) => arr.some((m) => m.startsWith(rule + ':'));
  const RULES = ['native-dialog', 'unprefixed-storage', 'cdn-without-sri'];
  check('strict: cele 3 reguli sunt erori', RULES.every((r) => has(strict.errors, r)) && !strict.ok, strict.errors.map((e) => e.slice(0, 40)));
  check('lax: aceleași reguli sunt doar avertismente, check ok', RULES.every((r) => has(lax.warns, r) && !has(lax.errors, r)) && lax.ok, lax);
  check('CLI: exit 1 strict / 0 --lax', run(['check', d]).status === 1 && run(['check', d, '--lax']).status === 0);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({exceptions: [{rule: 'native-dialog', reason: 'confirm nativ intenționat (demo)'}, {rule: 'unprefixed-storage', reason: 'chei vechi, migrare planificată'}, {rule: 'cdn-without-sri', reason: 'bibliotecă externă fixată de utilizator'}]}));
  const ex = checkKit(d);
  check('excepții justificate în fff.config.json → nicio regulă nouă în strict', RULES.every((r) => !has(ex.errors, r) && !has(ex.warns, r)) && ex.ok, ex);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({exceptions: [{rule: 'native-dialog'}, {rule: 'nu-exista', reason: 'regulă inventată aici'}, 'cdn-without-sri: bibliotecă externă fixată']}));
  const ex2 = checkKit(d);
  check('excepție fără justificare e ignorată și semnalată; regulă necunoscută semnalată; formă „regulă: motiv” acceptată', has(ex2.errors, 'native-dialog') && ex2.errors.some((e) => /fără justificare/.test(e)) && ex2.errors.some((e) => /necunoscută/.test(e)) && !has(ex2.errors, 'cdn-without-sri'), ex2.errors.map((e) => e.slice(0, 60)));
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({cspExceptions: [{rule: 'native-dialog', reason: 'cheie veche compatibilă'}]}));
  check('cspExceptions acceptă și regulile noi (compatibil)', !has(checkKit(d).errors, 'native-dialog'));
  const jf = JSON.parse(run(['check', d, '--lax', '--json']).stdout);
  check('--json include avertismentele noi', Array.isArray(jf.warns) && jf.warns.some((w) => /unprefixed-storage|cdn-without-sri/.test(w)));
  const good = mkApp(page('localStorage.setItem("demo.stare", 1); FFF.dialog && FFF.dialog.confirm("x");').replace("script-src 'sha256-x'", "script-src 'sha256-x'"));
  check('aplicație curată: nicio regulă nouă', ['native-dialog', 'unprefixed-storage', 'cdn-without-sri', 'i18n-parity'].every((r) => !has(checkKit(good, {lax: true}).warns, r)));
  const k = checkKit(mkApp(FIXTURE), {lax: true});
  check('blocul kit (inclusiv dialog.js cu «confirm(») nu declanșează regulile', !k.warns.some((w) => /^native-dialog/.test(w)));
  const dk = tmp(); fs.writeFileSync(path.join(dk, 'index.html'), page('')); applyKit(dk, {slug: 'demo', modules: 'core,store,dialog,label,bundle'}); runInfo(dk, {slug: 'demo'});
  check('kit cu core,store,dialog,label,bundle: check strict ok, fără derivă', checkKit(dk).ok && !checkKit(dk, {lax: true}).warns.some((w) => /derivă/.test(w)), checkKit(dk));
}

console.log('tools/i18n-parity.mjs');
{
  const d = tmp();
  fs.writeFileSync(path.join(d, 'index.html'), page('var I18N = {ro:{a:"1",b:"2"}, en:{a:"1"}};'));
  const r = spawnSync('node', [path.join(HERE, '..', 'tools', 'i18n-parity.mjs'), '--app', d], {encoding: 'utf8'});
  check('--app <dir>: raportează lipsa și iese cu 1', r.status === 1 && /I18N/.test(r.stdout) && /en: 1 \(b\)/.test(r.stdout), r.stdout);
  fs.writeFileSync(path.join(d, 'index.html'), page('var I18N = {ro:{a:"1"}, en:{a:"1"}};'));
  check('paritate → exit 0', spawnSync('node', [path.join(HERE, '..', 'tools', 'i18n-parity.mjs'), '--app', d], {encoding: 'utf8'}).status === 0);
  fs.writeFileSync(path.join(d, 'index.html'), page('var I18N = {ro:{a:"1"}, en:{a:"1"}};').replace('<span id="app-version">', '<p data-i18n="a">x</p><p data-i18n="zzz">y</p><span id="app-version">'));
  const u = spawnSync('node', [path.join(HERE, '..', 'tools', 'i18n-parity.mjs'), '--app', d, '--used', '--json'], {encoding: 'utf8'});
  check('--used: cheie data-i18n nedefinită în dicționar', u.status === 1 && JSON.parse(u.stdout)[0].issues.some((i) => i.kind === 'used-undefined' && i.missing.ro.includes('zzz')), u.stdout.slice(0, 300));
  check('fără --app → cod 2', spawnSync('node', [path.join(HERE, '..', 'tools', 'i18n-parity.mjs')], {encoding: 'utf8'}).status === 2);
}

console.log(`rules: ${pass} ok, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
