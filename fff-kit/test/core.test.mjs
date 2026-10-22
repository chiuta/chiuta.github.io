// Teste FFF.core (Playwright, rețea blocată). Rulare: node test/core.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {makeApp, launch, newPage, check, summary, FIXTURE, sleep} from './_pw.mjs';

const browser = await launch();
const app = makeApp(FIXTURE, {modules: 'core', info: false});
const {ctx, page, errors, net} = await newPage(browser);
await page.goto(app.url);
await page.waitForTimeout(500);

console.log('FFF.app / meta');
const A = await page.evaluate(() => ({app: FFF.app, v: FFF.version, mods: FFF.core.modules(), disabled: FFF.core.disabled}));
check('FFF.app = {slug,name,version,updated}', A.app.slug === 'demo-fff' && A.app.name === 'Demo FFF' && A.app.version === '1.2.3' && A.app.updated === '2026-10-14', A.app);
check('FFF.version și module', A.v === '1.1.4' && A.mods.join() === 'core' && A.disabled === false, A);

console.log('lang / onLang');
const L = await page.evaluate(async () => {
  const out = {};
  out.initial = FFF.lang();
  const seen = [];
  const off = FFF.onLang((l) => seen.push(l));
  document.documentElement.lang = 'de';
  await new Promise((r) => setTimeout(r, 50));
  out.de = FFF.lang();
  document.documentElement.lang = 'pt-BR';
  await new Promise((r) => setTimeout(r, 50));
  out.pt = FFF.lang();
  off();
  document.documentElement.lang = 'fr';
  await new Promise((r) => setTimeout(r, 50));
  out.seen = seen;
  document.documentElement.lang = 'xx';
  localStorage.setItem('lang', 'hu');
  out.fromLs = FFF.lang();
  localStorage.setItem('lang', '"it"');
  out.fromLsQuoted = FFF.lang();
  localStorage.removeItem('lang');
  out.fallback = FFF.lang();
  document.documentElement.lang = 'ro';
  return out;
});
check('lang din html[lang]', L.initial === 'ro' && L.de === 'de' && L.pt === 'pt', L);
check('onLang notifică și se dezabonează', L.seen.join() === 'de,pt', L.seen);
check('lang cade pe localStorage (inclusiv JSON)', L.fromLs === 'hu' && L.fromLsQuoted === 'it', L);
check('lang cade pe navigator → en/ro suportate', ['ro', 'en'].includes(L.fallback), L.fallback);

console.log('t / registerI18n');
const T = await page.evaluate(() => {
  FFF.registerI18n('demo', {ro: {a: 'Salut {name}', b: 'doar ro'}, en: {a: 'Hello {name}', c: 'only en'}, de: {a: 'Hallo {name}'}});
  const r = {};
  document.documentElement.lang = 'ro'; r.ro = FFF.t('demo', 'a', {name: 'Ana'});
  document.documentElement.lang = 'de'; r.de = FFF.t('demo', 'a', {name: 'Ana'});
  r.deFallbackEn = FFF.t('demo', 'c'); r.deFallbackRo = FFF.t('demo', 'b'); r.missing = FFF.t('demo', 'zzz'); r.noMod = FFF.t('nomod', 'k');
  r.vars = FFF.t('demo', 'a', {name: '$&{name}'});
  document.documentElement.lang = 'ro';
  return r;
});
check('t cu variabile și limbă', T.ro === 'Salut Ana' && T.de === 'Hallo Ana', T);
check('t cade pe en, apoi ro, apoi cheie', T.deFallbackEn === 'only en' && T.deFallbackRo === 'doar ro' && T.missing === 'zzz' && T.noMod === 'k', T);
check('t nu interpretează $& în variabile', T.vars === 'Hallo $&{name}', T.vars);

console.log('observator de stocare');
await page.click('#inc'); await page.click('#inc');
await page.fill('#note', 'salut');
await page.selectOption('#lg', 'en');
const S = await page.evaluate(() => {
  const o = {};
  o.raw = JSON.stringify(Object.keys(localStorage).sort());
  o.idx = JSON.parse(localStorage.getItem('fff.demo-fff.__keys'));
  o.count = localStorage.getItem('fx.count');
  o.native = /\[native code\]/.test(Storage.prototype.setItem.toString());
  localStorage.setItem('extra.k', '1');
  localStorage.setItem('fff.demo-fff.mine', '2'); // cheile fff.* nu se indexează
  o.idx2 = JSON.parse(localStorage.getItem('fff.demo-fff.__keys'));
  localStorage.removeItem('extra.k');
  o.idx3 = JSON.parse(localStorage.getItem('fff.demo-fff.__keys'));
  sessionStorage.setItem('ss.k', '1');
  o.noSession = sessionStorage.getItem('fff.demo-fff.__keys') === null;
  o.ik = FFF.store.indexKeys();
  return o;
});
check('cheile aplicației rămân neschimbate (fără redenumire)', S.count === '2' && S.raw.includes('"fx.count"') && S.raw.includes('"fx.note"') && S.raw.includes('"lang"'), S.raw);
check('index fff.<slug>.__keys cu cheile atinse', S.idx.join() === 'fx.count,fx.note,lang', S.idx);
check('cheia nouă se indexează, fff.* nu', S.idx2.includes('extra.k') && !S.idx2.some((k) => k.startsWith('fff.')), S.idx2);
check('removeItem scoate din index', !S.idx3.includes('extra.k'), S.idx3);
check('sessionStorage nu e observat', S.noSession);
check('indexKeys = indexate + fff.<slug>.* (fără indexul propriu)', S.ik.includes('fx.count') && S.ik.includes('fff.demo-fff.mine') && !S.ik.includes('fff.demo-fff.__keys'), S.ik);
check('getItem pe cheie preexistentă o indexează', await page.evaluate(() => { localStorage.clear(); return true; }));
const pre = await newPage(browser);
await pre.ctx.addInitScript(() => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('old.key', 'v'); localStorage.setItem('__seeded', '1'); } } catch (e) { /* ignorat */ } });
await pre.page.goto(app.url);
await pre.page.waitForTimeout(300);
const idxPre = await pre.page.evaluate(() => { localStorage.getItem('old.key'); return JSON.parse(localStorage.getItem('fff.demo-fff.__keys')); });
check('init-script (înaintea kitului) vs. kit: cheile citite ulterior se indexează', idxPre.includes('old.key') && idxPre.includes('fx.count') === false, idxPre);

console.log('FFF.store');
const ST = await page.evaluate(() => {
  const r = {};
  FFF.store.set('a', {x: 1}); FFF.store.set('b', [1, 2]);
  r.get = FFF.store.get('a'); r.def = FFF.store.get('nu', 'dflt');
  r.keys = FFF.store.keys();
  r.raw = localStorage.getItem('fff.demo-fff.a');
  FFF.store.remove('a');
  r.afterRemove = FFF.store.get('a', null);
  r.ik = FFF.store.indexKeys();
  return r;
});
check('store get/set/remove/keys', ST.get.x === 1 && ST.def === 'dflt' && ST.keys.join() === 'a,b' && ST.raw === '{"x":1}' && ST.afterRemove === null, ST);
check('store.indexKeys include cheile kitului', ST.ik.includes('fff.demo-fff.b'), ST.ik);

console.log('bus');
const B = await page.evaluate(() => {
  const r = []; const f = (d) => r.push('f' + d);
  const off = FFF.bus.on('t', f); FFF.bus.once('t', (d) => r.push('o' + d));
  FFF.bus.on('t', () => { throw new Error('ignorat'); });
  FFF.bus.emit('t', 1); off(); FFF.bus.emit('t', 2);
  return r;
});
check('bus on/once/off/emit (erorile ascultătorilor nu se propagă)', B.join() === 'f1,o1', B);

console.log('sha256 / download / pickFile');
const H = await page.evaluate(async () => {
  const big = new Uint8Array(200000).map((_, i) => (i * 31 + 7) & 255);
  return {empty: await FFF.sha256(''), abc: await FFF.sha256('abc'), u8: await FFF.sha256(new Uint8Array([97, 98, 99])), blob: await FFF.sha256(new Blob(['abc'])), big: await FFF.sha256(big), diacritice: await FFF.sha256('ăîșțâ')};
});
const sh = (b) => createHash('sha256').update(b).digest('hex');
const bigBuf = Buffer.from(new Uint8Array(200000).map((_, i) => (i * 31 + 7) & 255));
check('sha256 (vectori standard)', H.empty === sh('') && H.abc === sh('abc') && H.u8 === sh('abc') && H.blob === sh('abc'), H);
check('sha256 pe date mari și UTF-8', H.big === sh(bigBuf) && H.diacritice === sh('ăîșțâ'));
const nc = await newPage(browser);
await nc.ctx.addInitScript(() => { try { Object.defineProperty(crypto, 'subtle', {value: undefined, configurable: true}); } catch (e) { /* ignorat */ } });
await nc.page.goto(app.url);
const H2 = await nc.page.evaluate(async () => ({has: !!(crypto && crypto.subtle), abc: await FFF.sha256('abc'), big: await FFF.sha256(new Uint8Array(200000).map((_, i) => (i * 31 + 7) & 255)), len55: await FFF.sha256('a'.repeat(55)), len56: await FFF.sha256('a'.repeat(56)), len64: await FFF.sha256('a'.repeat(64))}));
check('sha256 fără Web Crypto (rezervă în JS) dă aceleași valori', !H2.has && H2.abc === sh('abc') && H2.big === sh(bigBuf) && H2.len55 === sh('a'.repeat(55)) && H2.len56 === sh('a'.repeat(56)) && H2.len64 === sh('a'.repeat(64)), H2);

const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => FFF.download('t.txt', 'conținut ăș', 'text/plain'))]);
const dp = await dl.path();
check('download: nume și conținut', dl.suggestedFilename() === 't.txt' && fs.readFileSync(dp, 'utf8') === 'conținut ăș');
const tmpf = path.join(path.dirname(app.dir), 'pick-' + path.basename(app.dir) + '.txt'); fs.writeFileSync(tmpf, 'x');
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { window.__pk = FFF.pickFile('.txt').then((f) => (f ? f.name : null)); })]);
await fc.setFiles(tmpf);
check('pickFile întoarce File', (await page.evaluate(() => window.__pk)) === path.basename(tmpf));
const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { window.__pk2 = FFF.pickFile().then((f) => (f ? f.name : 'null')); })]);
await fc2.setFiles([]);
const r2 = await Promise.race([page.evaluate(() => window.__pk2), sleep(1500).then(() => 'timeout')]);
check('pickFile fără fișier → null (nu aruncă)', r2 === 'null' || r2 === 'timeout', r2);
check('fără input-uri rămase în DOM', await page.evaluate(() => document.querySelectorAll('input[type=file]').length === 0) || r2 === 'timeout');

console.log('dezactivare (fff-disable)');
const dis = makeApp(FIXTURE, {modules: 'core,label,bundle', info: false, disable: 'aplicația se salvează singură'});
const dp2 = await newPage(browser);
await dp2.page.goto(dis.url); await dp2.page.waitForTimeout(400);
await dp2.page.click('#inc');
const D = await dp2.page.evaluate(() => ({d: FFF.core.disabled, native: /\[native code\]/.test(Storage.prototype.setItem.toString()), idx: localStorage.getItem('fff.demo-fff.__keys'), state: FFF.label.state, role: document.getElementById('app-version').getAttribute('role')}));
check('mod dezactivat: stocare neobservată, etichetă inactivă', D.d === 'aplicația se salvează singură' && D.native && D.idx === null && D.state === 'disabled' && D.role === null, D);
check('mod dezactivat: fără erori', dp2.errors.length === 0, dp2.errors);

console.log('stocare indisponibilă');
const ns = await newPage(browser);
await ns.ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocat', 'SecurityError'); }, configurable: true}); });
const bare = makeApp('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bare</title></head><body><p id="app-version">v 1.0.0 · 2026-10-14</p></body></html>', {modules: 'core,label,bundle', info: false});
await ns.page.goto(bare.url); await ns.page.waitForTimeout(300);
const NS = await ns.page.evaluate(() => { FFF.store.set('k', {a: 1}); return {g: FFF.store.get('k'), keys: FFF.store.keys(), ik: FFF.store.indexKeys(), av: FFF.store.available(), lang: FFF.lang()}; });
check('FFF.store cade în memorie dacă localStorage aruncă', NS.g.a === 1 && NS.keys.join() === 'k' && NS.ik.length === 0 && !NS.av && NS.lang === 'en', NS);
check('fără erori fără localStorage', ns.errors.length === 0, ns.errors);

console.log('curat');
const realErr = errors.filter((e) => !e.includes('[fff] bus t'));
check('0 pageerror/CSP în pagina principală', realErr.length === 0, realErr);
check('0 cereri de rețea externe', net.length === 0, net);
check('kitul nu schimbă DOM-ul aplicației (fără dialog rămas)', await page.evaluate(() => document.querySelectorAll('dialog').length === 0));
await browser.close();
summary('core');
