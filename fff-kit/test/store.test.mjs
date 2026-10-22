// Teste FFF.store (modulul „store”, kit 1.2.0): prefix <slug>., JSON sigur, cote/erori, migrate idempotentă, freeze/bundle.
// Rulare: node test/store.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {makeApp, launch, newPage, check, summary, FIXTURE, tmpDir} from './_pw.mjs';
import {applyKit} from '../build.mjs';

const browser = await launch();
const app = makeApp(FIXTURE, {modules: 'core,store,label,bundle'});
const {page, errors, net} = await newPage(browser);
await page.goto(app.url);
await page.waitForTimeout(300);

console.log('get/set/remove/keys');
check('modul încărcat: appPrefix = „demo-fff.”, migrate/has/owns definite', await page.evaluate(() => FFF.store.appPrefix === 'demo-fff.' && ['migrate', 'has', 'owns', 'get', 'set', 'remove', 'keys'].every((k) => typeof FFF.store[k] === 'function')));
const r1 = await page.evaluate(() => {
  const s = FFF.store;
  s.set('cfg', {a: 1, b: [1, 2], c: 'ț'}); s.set('n', 42); s.set('flag', false);
  return {raw: localStorage.getItem('demo-fff.cfg'), cfg: s.get('cfg'), n: s.get('n'), flag: s.get('flag', 'def'), miss: s.get('nu-exista', 'def'), has: s.has('n'), keys: s.keys(), leg: localStorage.getItem('fff.demo-fff.cfg')};
});
check('valorile se scriu JSON sub `<slug>.<cheie>` (nu sub fff.<slug>.)', r1.raw === '{"a":1,"b":[1,2],"c":"ț"}' && r1.leg === null, r1);
check('get: tipuri păstrate, implicit doar când lipsește (false rămâne false)', r1.n === 42 && r1.flag === false && r1.miss === 'def' && r1.cfg.c === 'ț' && r1.has === true);
check('keys(): fără prefix, sortate', r1.keys.join() === 'cfg,flag,n', r1.keys);
const r2 = await page.evaluate(() => {
  const s = FFF.store, out = {};
  const circ = {}; circ.self = circ;
  out.circ = s.set('c', circ); out.err = s.lastError && s.lastError.op;
  out.big = s.set('b', 10n); 
  out.undef = (s.set('u', 1), s.set('u', undefined), s.has('u'));
  out.badkey = [s.set('', 1), s.get(null, 'd'), s.get(undefined, 'd')];
  s.remove('n'); out.removed = s.has('n') || localStorage.getItem('demo-fff.n') !== null;
  localStorage.setItem('demo-fff.raw', 'dark');  // valoare brută, fără JSON
  out.raw = s.get('raw');
  out.proto = (s.set('__proto__', 1), s.set('constructor', 2), [s.get('__proto__'), s.get('constructor'), s.keys().includes('constructor')]);
  return out;
});
check('JSON invalid (circular/BigInt) → false, fără excepție, lastError setat', r2.circ === false && r2.big === false && r2.err === 'set', r2);
check('set(k, undefined) = remove; chei goale/null ignorate', r2.undef === false && r2.badkey[0] === false && r2.badkey[1] === 'd' && r2.badkey[2] === 'd', r2);
check('remove șterge cheia', r2.removed === false);
check('valoare brută non-JSON (ex. „dark”) → get întoarce șirul', r2.raw === 'dark');
check('chei ca __proto__/constructor funcționează ca niște chei obișnuite', r2.proto[0] === 1 && r2.proto[1] === 2 && r2.proto[2] === true, r2.proto);

console.log('compatibilitate cu spațiul vechi fff.<slug>.*');
const r3 = await page.evaluate(() => {
  localStorage.setItem('fff.demo-fff.srs-old', JSON.stringify({x: 1}));
  const s = FFF.store, out = {};
  out.read = s.get('srs-old'); out.keys = s.keys().includes('srs-old');
  s.set('srs-old', {x: 2}); out.after = [JSON.parse(localStorage.getItem('demo-fff.srs-old')).x, s.get('srs-old').x];
  s.remove('srs-old'); out.gone = [localStorage.getItem('fff.demo-fff.srs-old'), localStorage.getItem('demo-fff.srs-old')];
  return out;
});
check('citește rezerva fff.<slug>.*; scrierea merge în spațiul nou; remove curăță ambele', r3.read.x === 1 && r3.keys && r3.after.join() === '2,2' && r3.gone.join() === ',', r3);

console.log('migrate');
const m1 = await page.evaluate(() => {
  const s = FFF.store;
  ['oldA', 'oldB', 'oldC', 'save_1', 'save_2', 'sess'].forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('oldA', '{"v":1}'); localStorage.setItem('oldB', 'text simplu'); localStorage.setItem('oldC', '7');
  localStorage.setItem('save_1', 'a'); localStorage.setItem('save_2', 'b');
  localStorage.setItem('demo-fff.newB', '"deja nou"');
  const rep = s.migrate({oldA: 'a', oldB: 'newB', oldC: 'c', lipsa: 'x', 'save_*': 'slot.*'});
  return {rep, a: localStorage.getItem('demo-fff.a'), oldA: localStorage.getItem('oldA'), newB: localStorage.getItem('demo-fff.newB'), oldB: localStorage.getItem('oldB'), c: s.get('c'), slot: [localStorage.getItem('demo-fff.slot.1'), localStorage.getItem('demo-fff.slot.2'), localStorage.getItem('save_1')], idx: JSON.parse(localStorage.getItem('fff.demo-fff.__keys') || '[]')};
});
check('copiază valoarea exactă și șterge cheia veche', m1.a === '{"v":1}' && m1.oldA === null && m1.rep.moved.includes('oldA'), m1);
check('nu suprascrie o valoare nouă diferită: conflict, ambele rămân', m1.newB === '"deja nou"' && m1.oldB === 'text simplu' && m1.rep.conflicts.length === 1 && m1.rep.conflicts[0].key === 'oldB', m1.rep);
check('valoare numerică brută: get → număr; cheia lipsă raportată', m1.c === 7 && m1.rep.missing.join() === 'lipsa');
check('șablon prefix: save_* → slot.*', m1.slot.join() === 'a,b,' && m1.rep.moved.includes('save_1') && m1.rep.moved.includes('save_2'), m1.slot);
check('cheile mutate ies din indexul observatorului', !m1.idx.includes('oldA') && !m1.idx.includes('save_1'), m1.idx);
const m2 = await page.evaluate(() => FFF.store.migrate({oldA: 'a', oldC: 'c', 'save_*': 'slot.*'}));
check('idempotentă: a doua rulare nu mută nimic și nu dă erori', m2.moved.length === 0 && m2.errors.length === 0 && m2.missing.length === 2, m2);
const m3 = await page.evaluate(() => { localStorage.setItem('oldA', '{"v":1}'); const r = FFF.store.migrate({oldA: 'a'}); return {r, old: localStorage.getItem('oldA')}; });
check('aceeași valoare în ambele locuri → doar șterge cheia veche', m3.r.same.join() === 'oldA' && m3.old === null && m3.r.moved.length === 0, m3);
const m4 = await page.evaluate(() => { localStorage.setItem('oldB', 'text simplu'); const r = FFF.store.migrate({oldB: 'newB'}, {dropOld: true}); return {r, old: localStorage.getItem('oldB'), nw: localStorage.getItem('demo-fff.newB')}; });
check('dropOld: conflictul șterge cheia veche, păstrează valoarea nouă', m4.old === null && m4.nw === '"deja nou"' && m4.r.conflicts[0].dropped === true, m4);
const m5 = await page.evaluate(() => { localStorage.setItem('oldS', 'abc'); const r = FFF.store.migrate({oldS: 's'}, {wrap: 'string'}); return {v: FFF.store.get('s'), raw: localStorage.getItem('demo-fff.s'), r}; });
check('wrap:"string": șirul vechi se întoarce exact', m5.v === 'abc' && m5.raw === '"abc"', m5);
const m6 = await page.evaluate(() => { localStorage.setItem('oldD', 'x'); const r = FFF.store.migrate({oldD: 'd'}, {dryRun: true}); return {r, old: localStorage.getItem('oldD'), nw: localStorage.getItem('demo-fff.d')}; });
check('dryRun: raportează fără a modifica', m6.r.moved.join() === 'oldD' && m6.old === 'x' && m6.nw === null, m6);
const m7 = await page.evaluate(() => { let ev = null; FFF.bus.on('store:migrated', (r) => { ev = r.moved; }); localStorage.setItem('oldE', '1'); FFF.store.migrate({oldE: 'e'}); return ev; });
check('eveniment bus „store:migrated”', Array.isArray(m7) && m7[0] === 'oldE', m7);
const m8 = await page.evaluate(() => { localStorage.setItem('fff.zz', '1'); const r = FFF.store.migrate({'fff.zz': 'zz', 'demo-fff.self': 'demo-fff.self'}); return {r, k: localStorage.getItem('fff.zz')}; });
check('nu atinge chei fff.* (ale kitului) și ignoră mapări identice', m8.k === '1' && m8.r.moved.length === 0, m8);
const m9 = await page.evaluate(() => { localStorage.setItem('oldF', '1'); const r = FFF.store.migrate({oldF: 'demo-fff.fullname'}); return {r, v: localStorage.getItem('demo-fff.fullname')}; });
check('cheie nouă care începe deja cu „<slug>.” e luată ca atare', m9.v === '1' && m9.r.moved[0] === 'oldF', m9);

console.log('cote / erori prinse');
const q1 = await page.evaluate(() => {
  const raw = FFF.store.raw, orig = raw.set;
  raw.set = function () { throw new DOMException('plin', 'QuotaExceededError'); };
  let ev = null; FFF.bus.on('store:error', (e) => { ev = e; });
  let threw = false, res;
  try { res = FFF.store.set('q', {x: 1}); } catch (e) { threw = true; }
  const got = FFF.store.get('q');
  raw.set = orig;
  return {threw, res, got, last: FFF.store.lastError, ev};
});
check('QuotaExceededError: nu aruncă; set → false; valoarea rămâne în memorie; lastError.quota; eveniment', !q1.threw && q1.res === false && q1.got && q1.got.x === 1 && q1.last.quota === true && q1.ev && q1.ev.op === 'set', q1);
console.log('(migrate cu cotă depășită)');
{
  const q2 = await page.evaluate(() => {
    localStorage.setItem('oldQ', 'valoare');
    const raw = FFF.store.raw, orig = raw.set;
    raw.set = function () { throw new DOMException('plin', 'QuotaExceededError'); };
    const r = FFF.store.migrate({oldQ: 'q'});
    raw.set = orig;
    return {r, old: localStorage.getItem('oldQ')};
  });
  check('migrate: cota depășită → eroare raportată, cheia veche NU se șterge', q2.r.errors.length === 1 && q2.r.errors[0].quota === true && q2.old === 'valoare' && q2.r.moved.length === 0, q2);
}

console.log('freeze / bundle');
const f1 = await page.evaluate(() => {
  const out = {};
  localStorage.setItem('oldZ', 'z');
  FFF.store.set('pre', 1);
  const exp = FFF.bundle.build ? FFF.bundle.build() : null;
  out.exported = exp ? Object.keys(exp.data).filter((k) => k.indexOf('demo-fff.') === 0).length > 0 : null;
  out.known = FFF.store.indexKeys().includes('demo-fff.pre');
  FFF.store.freeze();
  out.set = FFF.store.set('post', 1); out.rem = (FFF.store.remove('pre'), FFF.store.has('pre'));
  out.mig = FFF.store.migrate({oldZ: 'z'});
  out.oldZ = localStorage.getItem('oldZ');
  return out;
});
check('cheile <slug>.* sunt „cunoscute” (indexKeys) și intră în exportul bundle', f1.known === true && f1.exported === true, f1);
check('după freeze: set → false, remove fără efect, migrate nu mută nimic (frozen:true)', f1.set === false && f1.rem === true && f1.mig.frozen === true && f1.mig.moved.length === 0 && f1.oldZ === 'z', f1);

console.log('import/ștergere bundle cu cheile <slug>.*');
{
  const p2 = await newPage(browser);
  await p2.page.goto(app.url); await p2.page.waitForTimeout(300);
  const res = await p2.page.evaluate(async () => {
    FFF.store.set('stare', {nivel: 3});
    const bundle = FFF.bundle.build();
    // simulează o instalare nouă: șterge totul, apoi importă fișierul (fără confirmare, fără reload)
    localStorage.clear();
    const file = new File([JSON.stringify(bundle)], 'x.fff.json', {type: 'application/json'});
    const r = await FFF.bundle.import(file, {confirm: false, reload: false});
    return {r, v: FFF.store.get('stare'), unknown: r.unknown};
  });
  check('export → ștergere → import restaurează FFF.store; cheile <slug>.* nu apar ca „necunoscute”', res.v && res.v.nivel === 3 && res.unknown.filter((k) => k.indexOf('demo-fff.') === 0).length === 0, res);
  const w = await p2.page.evaluate(async () => { FFF.store.set('a', 1); const r = await FFF.bundle.wipe({confirm: false, reload: false}); return {r, left: Object.keys(localStorage).filter((k) => k.indexOf('demo-fff.') === 0)}; });
  check('wipe șterge și cheile <slug>.*', w.left.length === 0, w);
  await p2.ctx.close();
}

console.log('stocare indisponibilă');
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocat', 'SecurityError'); }, configurable: true}); });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(0,3).join('|')));
  await p.goto(app.url); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const s = FFF.store; const w = s.set('k', {a: 1}); return {w, v: s.get('k'), keys: s.keys(), mig: s.migrate({a: 'b'}), avail: s.available()}; });
  check('fără localStorage: memorie, fără excepții; migrate raportează eroare', r.w === false && r.v.a === 1 && r.keys.join() === 'k' && r.avail === false && errs.filter((m) => !/^blocat/.test(m)).length === 0, {r, errs});
  await ctx.close();
}

console.log('apply fără modulul nou rămâne valid');
{
  const old = makeApp(FIXTURE, {modules: 'core,label,bundle'});
  const o = await newPage(browser);
  await o.page.goto(old.url); await o.page.waitForTimeout(250);
  check('fără modulul store: FFF.store din core (prefix fff.<slug>.), fără migrate', await o.page.evaluate(() => { FFF.store.set('q', 1); return FFF.store.prefix === 'fff.demo-fff.' && localStorage.getItem('fff.demo-fff.q') === '1' && !FFF.store.migrate && !FFF.store.appPrefix; }));
  await o.ctx.close();
}
check('fără erori de pagină/CSP și fără rețea', errors.length === 0 && net.length === 0, {errors, net});

await browser.close();
summary('store');
