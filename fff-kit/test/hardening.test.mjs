// Teste kit 1.1.3–1.1.4 (întărire, dimensiuni minime): restaurare vs. salvare la pagehide, chei la import, rollback, parolă/iterații, date sensibile la export,
// anti-clickjacking cu mesaj, politici CSP în `check`, derivă a blocului kit, candidate ICE, plafon lockstep, tools/.
// Rulare: node test/hardening.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {makeApp, launch, newPage, tmpDir, check, summary, FIXTURE, HERE} from './_pw.mjs';
import {recomputeCspHashes} from '../lib/csp.mjs';
import {kitVersion} from '../build.mjs';

const KIT = path.join(HERE, '..');
const BUILD = path.join(KIT, 'build.mjs');
const run = (args) => spawnSync('node', [BUILD, ...args], {encoding: 'utf8'});
const ORIG = recomputeCspHashes(FIXTURE).html;
const mkDir = (html, config) => { const d = tmpDir(); fs.writeFileSync(path.join(d, 'index.html'), html); if (config) fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify(config)); return d; };
const rf = (d) => fs.readFileSync(path.join(d, 'index.html'), 'utf8');
const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
const bundleOf = (data, app = 'demo-fff') => JSON.stringify({format: 'fff-bundle', schema: 1, app, version: '1', updated: '', exported: '2026-10-22T00:00:00Z', data});

/* ====================================================================== versiune */
console.log('versiune');
check('KIT_VERSION = 1.2.0 (core.js, build.mjs)', kitVersion() === '1.2.0' && /KIT_VERSION = '1\.2\.0'/.test(fs.readFileSync(path.join(KIT, 'src/core.js'), 'utf8')));
check('README: Versiune 1.2.0', /\*\*Versiune:\*\* 1\.2\.0/.test(fs.readFileSync(path.join(KIT, 'README.md'), 'utf8')));

/* ====================================================================== D3: iterații în texte */
console.log('D3: textele din label.json derivă din constantă');
const LJ = JSON.parse(fs.readFileSync(path.join(KIT, 'i18n/label.json'), 'utf8'));
const bundleSrc = fs.readFileSync(path.join(KIT, 'src/bundle.js'), 'utf8');
const ITER = +bundleSrc.match(/ITER = (\d+)/)[1];
check('constanta ITER din bundle.js = 600000', ITER === 600000);
check('label.json: bk_hint conține {iter} în toate cele 8 limbi și niciun număr de iterații fix', LANGS.every((l) => LJ[l].bk_hint.includes('{iter}') && !/\d{3}[ .,  ]?\d{3}/.test(LJ[l].bk_hint)));
check('nicio sursă/i18n nu mai conține 310 000 în formă fixă', ['i18n/label.json', 'i18n/bundle.json', 'src/label.js', 'src/bundle.js', 'README.md', 'SPEC.md'].every((f) => !/310[ .,  ]?000/.test(fs.readFileSync(path.join(KIT, f), 'utf8'))));

/* ====================================================================== D4 / M4 / F11: build check */
console.log('D4: politici CSP în check (strict = eroare, --lax = avertisment, cspExceptions)');
const cases = {
  'script-unsafe-inline': ORIG.replace(/script-src '[^;]*;/, "script-src 'unsafe-inline';"),
  'script-unsafe-eval': ORIG.replace(/(script-src [^;]*);/, "$1 'unsafe-eval';"),
  'no-script-src': ORIG.replace(/default-src 'none'; script-src '[^;]*;/, "img-src data:;"),
  'no-csp': ORIG.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, ''),
};
for (const [name, html] of Object.entries(cases)) {
  const rule = name === 'no-csp' ? 'no-script-src' : name;
  const d = mkDir(html); run(['apply', d, '--slug', 'demo-fff']);
  const st = run(['check', d]), lx = run(['check', d, '--lax']);
  check(`${name}: strict → eroare CSP [${rule}], exit 1`, st.status === 1 && st.stdout.includes(`EROARE  CSP [${rule}]`), st.stdout);
  check(`${name}: --lax → avertisment, exit 0`, lx.status === 0 && lx.stdout.includes(`avert.  CSP [${rule}]`) && !/EROARE/.test(lx.stdout), lx.stdout);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({cspExceptions: [{rule, reason: 'justificare de test suficient de lungă'}]}));
  const ex = run(['check', d]);
  check(`${name}: cspExceptions justificat → strict trece`, ex.status === 0 && !/CSP \[/.test(ex.stdout), ex.stdout);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({cspExceptions: [{rule}]}));
  const nj = run(['check', d]);
  check(`${name}: excepție fără justificare → ignorată și semnalată`, nj.status === 1 && /fără justificare/.test(nj.stdout) && nj.stdout.includes(`CSP [${rule}]`), nj.stdout);
}
{
  const d = mkDir(ORIG); run(['apply', d, '--slug', 'demo-fff']);
  check('fixture curat: strict trece, fără avertismente CSP', run(['check', d]).status === 0 && !/CSP \[/.test(run(['check', d]).stdout));
  // hash în afara metei principale: a doua meta CSP cu hash-urile scripturilor
  const h = rf(d), hashes = h.match(/'sha256-[^']+'/g).join(' ');
  fs.writeFileSync(path.join(d, 'index.html'), h.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="script-src ${hashes}">\n</head>`));
  const o = run(['check', d, '--lax']);
  check('hash-outside-meta: a doua meta CSP cu hash-uri → avertisment (lax) / eroare (strict)', /avert\.  CSP \[hash-outside-meta\]/.test(o.stdout) && /EROARE  CSP \[hash-outside-meta\]/.test(run(['check', d]).stdout), o.stdout);
  fs.writeFileSync(path.join(d, 'fff.config.json'), JSON.stringify({cspExceptions: ['regula-inexistenta: motiv lung de test']}));
  check('regulă necunoscută în cspExceptions semnalată', /regulă necunoscută/.test(run(['check', d, '--lax']).stdout));
}

console.log('M4: check avertizează la chei sensibile fără redactor');
{
  const withKey = (extra) => ORIG.replace("var c = parseInt(", `${extra}\n  var c = parseInt(`);
  const d1 = mkDir(withKey("localStorage.setItem('api_token', 'x');")); run(['apply', d1, '--slug', 'demo-fff', '--modules', 'core,label,bundle']);
  const o1 = run(['check', d1, '--lax']);
  check('cheie api_token fără redactor → avertisment (și în strict, fără a fi eroare)', /avert\.  chei sensibile în stocare \(api_token\)/.test(o1.stdout) && !/EROARE  chei sensibile/.test(run(['check', d1]).stdout), o1.stdout);
  const d2 = mkDir(withKey("localStorage.setItem('api_token', 'x'); FFF.bundle.redact(function (k, v) { return /token/.test(k) ? '' : v; });")); run(['apply', d2, '--slug', 'demo-fff', '--modules', 'core,label,bundle']);
  check('cu FFF.bundle.redact(...) → fără avertisment', !/chei sensibile/.test(run(['check', d2, '--lax']).stdout));
  const d3 = mkDir(withKey("localStorage.setItem('api_token', 'x');")); run(['apply', d3, '--slug', 'demo-fff', '--modules', 'core,label']);
  check('fără modulul bundle → nu se avertizează', !/chei sensibile/.test(run(['check', d3, '--lax']).stdout));
}

console.log('F11: derivă a blocului kit față de sursă');
{
  const d = mkDir(ORIG); run(['apply', d, '--slug', 'demo-fff', '--modules', 'core,label,bundle']);
  check('bloc identic cu sursa → fără „derivă”', !/derivă/.test(run(['check', d, '--lax']).stdout));
  const h = rf(d);
  fs.writeFileSync(path.join(d, 'index.html'), h.replace("var SCHEMA = 1,", "var SCHEMA = 1, /* editat de mână */"));
  const o = run(['check', d, '--lax']);
  check('modificare manuală a bundle.js în pagină → avertisment „derivă” cu modulul', /avert\.  derivă: blocul kit din pagină diferă de sursa kitului v1\.2\.0 \(bundle\)/.test(o.stdout), o.stdout);
  fs.writeFileSync(path.join(d, 'index.html'), h.replace('.fff-dlg-sm{', '.fff-dlg-sm{/*x*/'));
  check('modificare în CSS → „derivă (css)”', /derivă: .*\(css\)/.test(run(['check', d, '--lax']).stdout));
  run(['apply', d, '--slug', 'demo-fff', '--modules', 'core,label,bundle']);
  check('apply repară deriva', !/derivă/.test(run(['check', d, '--lax']).stdout));
}

/* ====================================================================== F9: tools/ */
console.log('F9/D9: tools/ (fixcsp.py, ver.py, lang.py)');
{
  for (const f of ['fixcsp.py', 'ver.py', 'lang.py']) check(`tools/${f} există`, fs.existsSync(path.join(KIT, 'tools', f)));
  check('tools/fixcsp.py nu are implementare proprie (apelează build.mjs fixcsp)', /build\.mjs/.test(fs.readFileSync(path.join(KIT, 'tools/fixcsp.py'), 'utf8')) && !/hashlib/.test(fs.readFileSync(path.join(KIT, 'tools/fixcsp.py'), 'utf8')));
  // hash-uri învechite + lipsă
  const d = mkDir(ORIG.replace(/script-src '[^;]*;/, "script-src 'sha256-AAAA';"));
  let r = spawnSync('python3', ['-I', path.join(KIT, 'tools/fixcsp.py'), d], {encoding: 'utf8'});
  const fixed = rf(d);
  check('fixcsp.py: înlocuiește hash-ul învechit cu cel real', r.status === 0 && !/AAAA/.test(fixed) && /script-src 'sha256-[A-Za-z0-9+/=]+'/.test(fixed), r.stdout + r.stderr);
  r = spawnSync('python3', ['-I', path.join(KIT, 'tools/fixcsp.py'), d], {encoding: 'utf8'});
  check('fixcsp.py: idempotent', /neschimbat/.test(r.stdout) && rf(d) === fixed, r.stdout);
  // regula „nu pune hash lângă 'unsafe-inline'”
  const du = mkDir(ORIG.replace(/script-src '[^;]*;/, "script-src 'unsafe-inline' 'sha256-BBBB';"));
  r = spawnSync('python3', ['-I', path.join(KIT, 'tools/fixcsp.py'), du], {encoding: 'utf8'});
  check("fixcsp.py: lângă 'unsafe-inline' hash-urile se elimină", /script-src 'unsafe-inline';/.test(rf(du)) && !/BBBB/.test(rf(du)), rf(du).match(/Content-Security[^>]*/)?.[0]);
  const dk = mkDir(ORIG.replace(/script-src '[^;]*;/, "script-src 'unsafe-inline' 'sha256-BBBB';")); run(['apply', dk, '--slug', 'demo-fff']);
  check("build.mjs apply aplică aceeași regulă ('unsafe-inline' fără hash-uri)", /script-src 'unsafe-inline';/.test(rf(dk)) && !/BBBB/.test(rf(dk)));
  for (const f of ['ver.py', 'lang.py']) { const o = spawnSync('python3', ['-I', path.join(KIT, 'tools', f)], {encoding: 'utf8'}); check(`tools/${f}: rulare uscată fără erori`, o.status === 0 && !/Traceback/.test(o.stderr), o.stderr); }
}

/* ====================================================================== browser */
const browser = await launch();
const app = makeApp(FIXTURE);
const SAVER = FIXTURE.replace('window.__fx =', "window.addEventListener('pagehide', function(){ localStorage.setItem('demo-fff.count', String(c)); localStorage.setItem('demo-fff.note', note.value); }); window.addEventListener('beforeunload', function(){ localStorage.setItem('demo-fff.count', String(c)); }); window.__fx =");
const saverApp = makeApp(SAVER, {slug: 'demo-fff'});

console.log('M2: restaurarea nu e suprascrisă de salvarea la pagehide/beforeunload');
{
  const S = await newPage(browser);
  await S.page.goto(saverApp.url); await S.page.waitForTimeout(300);
  for (let i = 0; i < 5; i++) await S.page.click('#inc');
  await S.page.fill('#note', 'in-memorie');
  // control: fără fix (scriere + reload simplu) salvarea la pagehide suprascrie importul
  const nav0 = S.page.waitForNavigation({waitUntil: 'load'});
  await S.page.evaluate(() => { FFF.store.raw.set('demo-fff.count', '3'); FFF.store.raw.set('demo-fff.note', 'din-backup'); setTimeout(() => location.reload(), 0); });
  await nav0; await S.page.waitForTimeout(200);
  check('control: fără înghețare, pagehide suprascrie restaurarea (reproduce defectul)', await S.page.evaluate(() => localStorage.getItem('demo-fff.count')) === '5' && await S.page.evaluate(() => localStorage.getItem('demo-fff.note')) === 'in-memorie');
  // cu kitul: import + reload
  for (let i = 0; i < 4; i++) await S.page.click('#inc');          // 9 în memorie
  await S.page.fill('#note', 'iar-in-memorie');
  const nav = S.page.waitForNavigation({waitUntil: 'load'});
  const imp = await S.page.evaluate(async (t) => {
    const ev = [];
    FFF.bus.on('bundle:imported', (d) => { ev.push({frozen: FFF.store.frozen(), n: d.keys}); try { localStorage.setItem('demo-fff.count', 'din-handler'); } catch (e) { /* ignorat */ } });
    const r = await FFF.bundle.import(new File([t], 'b.fff.json'), {confirm: false, reload: true, delay: 4000});
    // în fereastra de dinainte de reload: scrierile (inclusiv IndexedDB) sunt blocate
    localStorage.setItem('late', '1'); localStorage.removeItem('demo-fff.note'); sessionStorage.setItem('late', '1');
    const idb = await new Promise((res) => { const rq = indexedDB.open('t'); rq.onupgradeneeded = () => rq.result.createObjectStore('s', {keyPath: 'id'}); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
    let cnt = 0;
    if (idb) {
      const tx = idb.transaction('s', 'readwrite'); try { tx.objectStore('s').put({id: 1}); } catch (e) { /* ignorat */ }
      await new Promise((res) => { tx.oncomplete = res; tx.onerror = res; tx.onabort = res; setTimeout(res, 300); });
      cnt = await new Promise((res) => { const rq = idb.transaction('s').objectStore('s').count(); rq.onsuccess = () => res(rq.result); });
      idb.close();
    }
    return {r, ev, late: localStorage.getItem('late'), note: localStorage.getItem('demo-fff.note'), count: localStorage.getItem('demo-fff.count'), ses: sessionStorage.getItem('late'), cnt, frozen: FFF.store.frozen()};
  }, bundleOf({'demo-fff.count': '3', 'demo-fff.note': 'din-backup'}));
  check('bundle:imported emis sincron DUPĂ înghețare; scrierile din handler sunt ignorate', imp.ev.length === 1 && imp.ev[0].frozen === true && imp.ev[0].n === 2 && imp.count === '3', imp);
  check('după import, înainte de reload: setItem/removeItem/IndexedDB.put sunt no-op', imp.late === null && imp.note === 'din-backup' && imp.ses === null && imp.cnt === 0 && imp.frozen === true, imp);
  await nav; await S.page.waitForTimeout(300);
  const after = await S.page.evaluate(() => ({c: localStorage.getItem('demo-fff.count'), n: localStorage.getItem('demo-fff.note'), out: document.getElementById('count').textContent, note: document.getElementById('note').value, frozen: FFF.store.frozen()}));
  check('după reload: valorile restaurate, nu cele din memorie', after.c === '3' && after.n === 'din-backup' && after.out === '3' && after.note === 'din-backup' && after.frozen === false, after);
  // wipe: aceeași protecție
  for (let i = 0; i < 2; i++) await S.page.click('#inc');
  const nav2 = S.page.waitForNavigation({waitUntil: 'load'});
  await S.page.evaluate(() => FFF.bundle.wipe({confirm: false, reload: true, delay: 100}));
  await nav2; await S.page.waitForTimeout(300);
  check('wipe + reload: pagehide nu recreează datele', await S.page.evaluate(() => localStorage.getItem('demo-fff.count')) === null && await S.page.evaluate(() => localStorage.getItem('demo-fff.note')) === null);
  // fără reload: nu îngheață
  const nf = await S.page.evaluate(async (t) => { await FFF.bundle.import(new File([t], 'b.fff.json'), {confirm: false, reload: false}); localStorage.setItem('liber', '1'); return {frozen: FFF.store.frozen(), v: localStorage.getItem('liber')}; }, bundleOf({'demo-fff.count': '4'}));
  check('import fără reload nu îngheață scrierile', nf.frozen === false && nf.v === '1', nf);
  // UI complet (Transparență → Importă…): același rezultat
  await S.page.evaluate(() => localStorage.clear());
  await S.page.reload(); await S.page.waitForTimeout(300);
  for (let i = 0; i < 6; i++) await S.page.click('#inc');
  const f = path.join(saverApp.dir, 'ui.fff.json'); fs.writeFileSync(f, bundleOf({'demo-fff.count': '2'}));
  await S.page.click('#app-version');
  const [fc] = await Promise.all([S.page.waitForEvent('filechooser'), S.page.click('dialog button:has-text("Importă…")')]);
  const nav3 = S.page.waitForNavigation({waitUntil: 'load', timeout: 10000});
  await fc.setFiles(f);
  await S.page.waitForSelector('dialog.fff-dlg-sm'); await S.page.click('dialog.fff-dlg-sm button.fff-primary');
  await nav3; await S.page.waitForTimeout(300);
  check('UI „Importă…” cu aplicație care salvează la pagehide: valoarea importată rămâne', await S.page.evaluate(() => localStorage.getItem('demo-fff.count')) === '2' && await S.page.evaluate(() => document.getElementById('count').textContent) === '2');
  check('0 erori de pagină (M2)', S.errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, S.errors);
}

console.log('D1: dialogul de import arată cheile; cele nedeclarate sunt semnalate');
{
  const A = await newPage(browser);
  await A.page.goto(app.url); await A.page.waitForTimeout(300);
  const ask = async (data, pre) => {
    if (pre) await A.page.evaluate(pre);
    await A.page.evaluate(([t]) => { window.__imp = FFF.bundle.import(new File([t], 'x.fff.json'), {reload: false}).then((r) => r, (e) => ({err: e.code})); }, [bundleOf(data)]);
    await A.page.waitForSelector('dialog.fff-dlg-sm');
    const txt = await A.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm').innerText);
    await A.page.click('dialog.fff-dlg-sm button.fff-primary');
    return {txt, res: await A.page.evaluate(() => window.__imp)};
  };
  const a = await ask({'demo-fff.count': '1', 'demo-fff.note': 'n', 'fff.demo-fff.srs': '1'});
  check('dialog: numele cheilor, fără avertisment pentru cele declarate/ale aplicației', /Chei: demo-fff\.count, demo-fff\.note, fff\.demo-fff\.srs/.test(a.txt) && !/Atenție/.test(a.txt) && a.res.unknown.length === 0, a.txt);
  const b = await ask({'demo-fff.count': '1', evil_key: 'x', 'alta.cheie': 'y'});
  check('chei în afara declarațiilor: avertisment cu numele lor (import cu confirmare)', /Atenție: 2 chei nu sunt declarate/.test(b.txt) && /evil_key, alta\.cheie/.test(b.txt) && b.res.keys === 3 && b.res.unknown.join() === 'evil_key,alta.cheie', b.txt);
  const c = await ask({k1: 'a', k2: 'b'}, () => FFF.bundle.allow(['k1', 'k*']));
  check('FFF.bundle.allow: cheie exactă și prefix cu *', c.res.unknown.length === 0 && !/Atenție/.test(c.txt), c.txt);
  const many = {}; for (let i = 0; i < 30; i++) many['zz' + i] = 'v';
  const m = await ask(many);
  check('rezumat limitat (primele 8 + (+N))', /zz7 … \(\+22\)/.test(m.txt) && !/zz8,/.test(m.txt), m.txt);
  check('dialogul ține liniile (white-space: pre-line, F13)', await A.page.evaluate(() => { const d = document.createElement('dialog'); d.className = 'fff-dlg'; d.innerHTML = '<p class="fff-msg">a\nb</p>'; document.body.appendChild(d); const w = getComputedStyle(d.querySelector('.fff-msg')).whiteSpace; d.remove(); return w; }) === 'pre-line');
  check('confirmare lipsă: cheile din afara declarațiilor se semnalează și cu confirm funcție', await A.page.evaluate(async (t) => { let seen = ''; await FFF.bundle.import(new File([t], 'x'), {confirm: (m) => { seen = m; return false; }, reload: false}); return /Atenție: 1 chei/.test(seen); }, bundleOf({necunoscuta: '1'})));
  const cfgApp = makeApp(FIXTURE, {config: {bundleKeys: ['evil_*', 'alta.cheie']}});
  const B = await newPage(browser);
  await B.page.goto(cfgApp.url); await B.page.waitForTimeout(300);
  const r2 = await B.page.evaluate(async (t) => { let seen = ''; const r = await FFF.bundle.import(new File([t], 'x'), {confirm: (m) => { seen = m; return true; }, reload: false}); return {unknown: r.unknown, seen}; }, bundleOf({evil_key: '1', 'alta.cheie': '2', straina: '3'}));
  check('fff.config.json bundleKeys → fff-info → chei permise (doar „straina” rămâne semnalată)', r2.unknown.join() === 'straina', r2);
  check('0 erori (D1)', [...A.errors, ...B.errors].filter((e) => !/Failed to load resource/.test(e)).length === 0, [...A.errors, ...B.errors]);
}

console.log('D2: rollback și export cu chei din Object.prototype');
{
  const A = await newPage(browser);
  await A.page.goto(app.url); await A.page.waitForTimeout(300);
  const RB = await A.page.evaluate(async (t) => {
    let n = 0; const orig = FFF.store.raw.set;
    FFF.store.raw.set = function (k, v) { if (++n === 5) throw new DOMException('plin', 'QuotaExceededError'); return orig.call(this, k, v); };
    let code; try { await FFF.bundle.import(new File([t], 'q.fff.json'), {confirm: false, reload: false}); } catch (e) { code = e.code; }
    FFF.store.raw.set = orig;
    return {code, keys: ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].map((k) => localStorage.getItem(k))};
  }, bundleOf({constructor: 'a', toString: 'b', ['__proto__']: 'c', hasOwnProperty: 'd', valueOf: 'e', zzz: 'f'}));
  check('rollback șterge cheile constructor/toString/__proto__/hasOwnProperty noi (nu mai rămân scrise)', RB.code === 'quota' && RB.keys.every((v) => v === null), RB);
  const RB2 = await A.page.evaluate(async (t) => {
    localStorage.setItem('toString', 'vechi'); localStorage.setItem('__proto__', 'vechi2');
    let n = 0; const orig = FFF.store.raw.set;
    FFF.store.raw.set = function (k, v) { if (++n === 3) throw new DOMException('plin', 'QuotaExceededError'); return orig.call(this, k, v); };
    let code; try { await FFF.bundle.import(new File([t], 'q.fff.json'), {confirm: false, reload: false}); } catch (e) { code = e.code; }
    FFF.store.raw.set = orig;
    return {code, a: localStorage.getItem('toString'), b: localStorage.getItem('__proto__')};
  }, bundleOf({toString: 'nou', ['__proto__']: 'nou2', zzz: 'f'}));
  check('rollback restaurează valorile vechi ale cheilor din Object.prototype', RB2.a === 'vechi' && RB2.b === 'vechi2', RB2);
  await A.page.evaluate(() => { localStorage.clear(); localStorage.setItem('constructor', 'c1'); localStorage.setItem('__proto__', 'p1'); localStorage.setItem('toString', 't1'); localStorage.setItem('demo-fff.count', '1'); });
  const ex = await A.page.evaluate(() => { const b = FFF.bundle.build(); return {keys: Object.keys(b.data).sort(), p: b.data['__proto__'], c: b.data.constructor, t: b.data.toString, idx: FFF.store.indexKeys().sort()}; });
  check('export: __proto__/constructor/toString apar în data, cu valorile lor', ex.keys.join() === '__proto__,constructor,demo-fff.count,toString' && ex.p === 'p1' && ex.c === 'c1' && ex.t === 't1', ex);
  await A.page.evaluate(() => { localStorage.removeItem('toString'); });
  check('indexKeys nu inventează chei absente (toString ș.a.)', await A.page.evaluate(() => FFF.store.indexKeys().indexOf('toString') < 0));
  const rt = await A.page.evaluate(async () => { const t = JSON.stringify(FFF.bundle.build()); localStorage.clear(); const r = await FFF.bundle.import(new File([t], 'r.fff.json'), {confirm: false, reload: false}); return {n: r.keys, p: localStorage.getItem('__proto__'), c: localStorage.getItem('constructor')}; });
  check('round-trip cu chei speciale', rt.n === 3 && rt.p === 'p1' && rt.c === 'c1', rt);
}

console.log('D3: textul din „Transparență” afișează numărul real de iterații (8 limbi)');
{
  const A = await newPage(browser);
  await A.page.goto(app.url); await A.page.waitForTimeout(300);
  const hints = await A.page.evaluate(async (langs) => {
    const out = {};
    for (const l of langs) {
      document.documentElement.lang = l; FFF.label.open();
      out[l] = [...document.querySelectorAll('dialog p')].map((p) => p.textContent).find((t) => /PBKDF2/.test(t)) || '';
      FFF.label.close();
    }
    document.documentElement.lang = 'ro';
    return {out, iter: FFF.bundle.iterations};
  }, LANGS);
  const nums = Object.fromEntries(Object.entries(hints.out).map(([l, t]) => [l, +((t.match(/PBKDF2[^(]*\(([\d .,  ]+)/) || [])[1] || '').replace(/\D/g, '')]));
  check('FFF.bundle.iterations = constanta din cod (600000)', hints.iter === ITER && ITER === 600000);
  check('în fiecare limbă textul afișează exact constanta', LANGS.every((l) => nums[l] === ITER), nums);
  check('ro: „600 000 de iterații”', /600 000 de iterații/.test(hints.out.ro) && /600,000 iterations/.test(hints.out.en) && /600\.000 Iterationen/.test(hints.out.de), [hints.out.ro, hints.out.en, hints.out.de]);
}

console.log('F4/F5: parola de export și limitele de iterații');
{
  const A = await newPage(browser);
  await A.page.goto(app.url); await A.page.waitForTimeout(300);
  await A.page.evaluate(() => localStorage.setItem('demo-fff.count', '1'));
  const exp = (pw, lang) => A.page.evaluate(async ([p, l]) => { document.documentElement.lang = l || 'ro'; try { const r = await FFF.bundle.export({encrypt: true, password: p, filename: 'p.json'}); return {ok: r.encrypted}; } catch (e) { return {code: e.code, msg: e.message}; } }, [pw, lang]);
  const s11 = await exp('a1b2c3d4e5f'), s12 = await exp('a1b2c3d4e5f6');
  check('parolă de 11 caractere respinsă, mesaj cu „12”', s11.code === 'pw_short' && /12/.test(s11.msg), s11);
  check('parolă de 12 caractere acceptată', s12.ok === true, s12);
  check('mesajul „prea scurtă” tradus în toate limbile cu 12', (await Promise.all(LANGS.map((l) => exp('scurt', l)))).every((r) => r.code === 'pw_short' && /12/.test(r.msg)));
  check('minPassword/passwordStrength expuse', await A.page.evaluate(() => FFF.bundle.minPassword === 12 && FFF.bundle.passwordStrength('abc') === 0 && FFF.bundle.passwordStrength('aaaaaaaaaaaaaaaa') === 0 && FFF.bundle.passwordStrength('abcdefghijkl') === 1 && FFF.bundle.passwordStrength('Cal-Verde-Ploua-7!') === 2));
  // F5
  const enc = await A.page.evaluate(async () => { let txt; const o = URL.createObjectURL; URL.createObjectURL = (b) => { txt = b; return o.call(URL, b); }; await FFF.bundle.export({encrypt: true, password: 'parola-secreta', filename: 'e.json'}); URL.createObjectURL = o; return await txt.text(); });
  const E = JSON.parse(enc);
  const tryIter = (iter) => A.page.evaluate(async ([t, pw]) => { try { await FFF.bundle.import(new File([t], 'e.json'), {password: pw, confirm: false, reload: false}); return {ok: 1}; } catch (e) { return {code: e.code, msg: e.message}; } }, [JSON.stringify({...E, iter}), 'parola-secreta']);
  const bad = {};
  for (const [n, v] of Object.entries({subLimita: 99999, peste: 5000001, fractie: 600000.5, text: '600000', nul: null, negativ: -5, enorm: 1e12})) bad[n] = await tryIter(v);
  check('iter în afara 100000..5000000, non-întreg, ne-număr → cod „iter” cu mesaj clar', Object.values(bad).every((r) => r.code === 'iter' && /100000/.test(r.msg) && /5000000/.test(r.msg)), bad);
  const lim = [100000, 5000000].map((v) => v);
  const t0 = Date.now(); const okLow = await tryIter(lim[0]);
  check('limita inferioară (100000) trece de validare (apoi parola nu corespunde: bad_password)', okLow.code === 'bad_password', okLow);
  void t0;
  const NaNcase = await A.page.evaluate(async (t) => { const o = JSON.parse(t); o.iter = NaN; try { await FFF.bundle.import(new File([JSON.stringify(o)], 'e.json'), {password: 'x', confirm: false}); return 'ok'; } catch (e) { return e.code; } }, enc);
  check('iter NaN/null (JSON) → „iter”', NaNcase === 'iter');
  // UI: indicator de tărie
  await A.page.evaluate(() => { document.documentElement.lang = 'ro'; });
  await A.page.click('#app-version');
  await A.page.click('dialog button:has-text("Exportă criptat…")');
  const stat = async (v) => { await A.page.fill('dialog input[autocomplete=new-password] >> nth=0', v); return A.page.evaluate(() => [...document.querySelectorAll('dialog [role=status]')].map((x) => x.textContent).join('|')); };
  check('UI: eticheta parolei „min. 12” și indicator de tărie slabă/acceptabilă/bună', await A.page.evaluate(() => [...document.querySelectorAll('dialog label')].some((l) => /min\. 12 caractere/.test(l.textContent))) && /slabă/.test(await stat('scurt')) && /acceptabilă/.test(await stat('abcdefghijkl')) && /bună/.test(await stat('Cal-Verde-Ploua-7!')));
  await A.page.fill('dialog input[autocomplete=new-password] >> nth=0', 'scurtaaaaaa'); await A.page.fill('dialog input[autocomplete=new-password] >> nth=1', 'scurtaaaaaa');
  await A.page.click('dialog button.fff-primary:has-text("Exportă criptat")');
  check('UI: parolă < 12 → mesaj de eroare, fără descărcare', /12 caractere/.test(await A.page.evaluate(() => [...document.querySelectorAll('dialog [role=status].fff-res')].pop().textContent)));
}

console.log('M4: export necriptat cu date sensibile cere confirmare și propune criptarea');
{
  const A = await newPage(browser);
  await A.page.goto(app.url); await A.page.waitForTimeout(300);
  await A.page.evaluate(() => { localStorage.setItem('demo-fff.count', '1'); localStorage.setItem('openai_api_key', 'sk-SECRET-1'); localStorage.setItem('demo-fff.session_token', 'tok-2'); });
  const start = () => A.page.evaluate(() => { window.__ex = FFF.bundle.export().then((r) => r, (e) => ({err: e.code})); });
  await start();
  await A.page.waitForSelector('dialog.fff-dlg-sm');
  const txt = await A.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm').innerText);
  check('mesaj: „date sensibile necriptate”, cheile sensibile numite, propunere de criptare', /date sensibile necriptate/.test(txt) && /openai_api_key/.test(txt) && /demo-fff\.session_token/.test(txt) && !/demo-fff\.count,/.test(txt) && /Criptează \(recomandat\)/.test(txt), txt);
  check('„Criptează (recomandat)” e butonul evidențiat (primary)', await A.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm button.fff-primary').textContent) === 'Criptează (recomandat)');
  await A.page.click('dialog.fff-dlg-sm button:has-text("Anulează")');
  const cancelled = await A.page.evaluate(() => window.__ex);
  check('Anulează → nimic descărcat, cancelled:true', cancelled.cancelled === true && !cancelled.filename, cancelled);
  // necriptat explicit
  await start(); await A.page.waitForSelector('dialog.fff-dlg-sm');
  const [d1] = await Promise.all([A.page.waitForEvent('download'), A.page.click('dialog.fff-dlg-sm button:has-text("Exportă necriptat")')]);
  const j1 = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
  check('„Exportă necriptat” → fișier necriptat cu valorile', j1.format === 'fff-bundle' && j1.data.openai_api_key === 'sk-SECRET-1' && !/\.enc\./.test(d1.suggestedFilename()));
  // criptat prin dialog cu parolă
  await start(); await A.page.waitForSelector('dialog.fff-dlg-sm');
  await A.page.click('dialog.fff-dlg-sm button.fff-primary');
  await A.page.waitForSelector('dialog input[type=password]');
  await A.page.fill('#fff-pw-1', 'scurta'); await A.page.fill('#fff-pw-2', 'scurta');
  await A.page.click('dialog button.fff-primary:has-text("Exportă criptat")');
  check('dialogul de parolă: < 12 caractere → mesaj, dialogul rămâne', /12 caractere/.test(await A.page.evaluate(() => document.querySelector('dialog [role=status]').textContent)) && await A.page.evaluate(() => !!document.querySelector('#fff-pw-1')));
  await A.page.fill('#fff-pw-1', 'o-parola-buna-1'); await A.page.fill('#fff-pw-2', 'o-parola-buna-2');
  await A.page.click('dialog button.fff-primary:has-text("Exportă criptat")');
  check('dialogul de parolă: parole diferite → mesaj', /nu coincid/.test(await A.page.evaluate(() => document.querySelector('dialog [role=status]').textContent)));
  await A.page.fill('#fff-pw-2', 'o-parola-buna-1');
  const [d2] = await Promise.all([A.page.waitForEvent('download'), A.page.click('dialog button.fff-primary:has-text("Exportă criptat")')]);
  const t2 = fs.readFileSync(await d2.path(), 'utf8'), j2 = JSON.parse(t2);
  const res2 = await A.page.evaluate(() => window.__ex);
  check('criptare aleasă → plic criptat (fără valori în clar), nume *.enc.fff.json', j2.format === 'fff-bundle-enc' && !t2.includes('sk-SECRET') && /\.enc\.fff\.json$/.test(d2.suggestedFilename()) && res2.encrypted === true, res2);
  const back = await A.page.evaluate((t) => FFF.bundle.inspect(new File([t], 'e.json'), {password: 'o-parola-buna-1'}), t2);
  check('plicul criptat se deschide cu parola aleasă și conține toate cheile', back.keys === 3, back);
  // opțiuni care omit dialogul
  const skip = await A.page.evaluate(async () => { const o = URL.createObjectURL; let n = 0; URL.createObjectURL = (b) => { n++; return o.call(URL, b); }; const a = await FFF.bundle.export({sensitive: false}); const b = await FFF.bundle.export({confirm: false}); URL.createObjectURL = o; return {a: a.encrypted, b: b.encrypted, n, dlg: document.querySelectorAll('dialog').length}; });
  check('{sensitive:false} / {confirm:false}: fără dialog', skip.a === false && skip.b === false && skip.n === 2 && skip.dlg === 0, skip);
  const enc = await A.page.evaluate(async () => { const r = await FFF.bundle.export({encrypt: true, password: 'o-parola-buna-1'}); return {e: r.encrypted, dlg: document.querySelectorAll('dialog').length}; });
  check('export criptat direct: fără dialog de avertizare', enc.e === true && enc.dlg === 0);
  // UI din „Transparență”
  await A.page.click('#app-version');
  await A.page.click('dialog button:has-text("Exportă"):not(:has-text("criptat"))');
  await A.page.waitForSelector('dialog.fff-dlg-sm');
  check('UI „Exportă” trece prin aceeași confirmare', /date sensibile necriptate/.test(await A.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm').innerText)));
  await A.page.click('dialog.fff-dlg-sm button:has-text("Anulează")');
  await A.page.waitForTimeout(200);
  check('UI: anularea afișează „Anulat.”', /Anulat/.test(await A.page.evaluate(() => [...document.querySelectorAll('dialog [role=status].fff-res')].pop().textContent)));
  // cu redactor: valorile sensibile sunt golite → fără dialog
  const B = await newPage(browser);
  await B.page.goto(app.url); await B.page.waitForTimeout(300);
  const red = await B.page.evaluate(async () => { localStorage.setItem('openai_api_key', 'sk-X'); FFF.bundle.redact((k, v) => /api_key/.test(k) ? '' : v); const o = URL.createObjectURL; let t; URL.createObjectURL = (b) => { t = b; return o.call(URL, b); }; const r = await FFF.bundle.export(); URL.createObjectURL = o; return {dlg: document.querySelectorAll('dialog').length, v: JSON.parse(await t.text()).data.openai_api_key, enc: r.encrypted}; });
  check('cu redactor care golește cheia: fără dialog, valoare goală', red.dlg === 0 && red.v === '' && red.enc === false, red);
  // 8 limbi
  const BJ = JSON.parse(fs.readFileSync(path.join(KIT, 'i18n/bundle.json'), 'utf8'));
  const need = ['sens_msg', 'sens_enc', 'sens_plain', 'pw_prompt', 'pw_label', 'pw_label2', 'pw_go', 'pw_mismatch', 'pw_weak', 'pw_fair', 'pw_strong', 'err_iter', 'import_keys', 'import_unknown', 'err_pw_short'];
  check('bundle.json: cheile noi în toate cele 8 limbi, cu aceleași {variabile}', LANGS.every((l) => need.every((k) => BJ[l][k] && BJ[l][k].length > 3 && (BJ[l][k].match(/\{[a-z]+\}/g) || []).sort().join() === (BJ.ro[k].match(/\{[a-z]+\}/g) || []).sort().join())));
  check('mesajul sensibil tradus la rulare (de/fr)', await A.page.evaluate(async () => { const out = []; for (const l of ['de', 'fr']) { document.documentElement.lang = l; window.__e = FFF.bundle.export(); await new Promise((r) => setTimeout(r, 100)); out.push(document.querySelector('dialog.fff-dlg-sm').innerText); document.querySelector('dialog.fff-dlg-sm button').click(); await window.__e; } document.documentElement.lang = 'ro'; return /unverschlüsselte sensible Daten/.test(out[0]) && /non chiffrées/.test(out[1]); }));
  check('0 erori (M4)', [...A.errors, ...B.errors].filter((e) => !/Failed to load resource/.test(e)).length === 0, [...A.errors, ...B.errors]);
}

console.log('D7: anti-clickjacking cu mesaj tradus');
{
  // pagina-părinte și aplicația se servesc pe două origini http fictive (rute Playwright): din file:// cadrul reușește să navigheze fereastra de sus
  const parentHtml = (sandbox) => `<!doctype html><meta charset=utf-8><body><iframe id=fr ${sandbox ? 'sandbox="allow-scripts"' : ''} src="http://app.test/index.html" style="width:700px;height:500px"></iframe></body>`;
  const probe = async (html, sandbox, lang) => {
    const a = makeApp(html), appHtml = fs.readFileSync(a.file, 'utf8');
    const P = await newPage(browser);
    await P.ctx.route('http://app.test/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: appHtml}));
    await P.ctx.route('http://parent.test/**', (r) => r.fulfill({contentType: 'text/html; charset=utf-8', body: parentHtml(sandbox)}));
    await P.page.goto('http://parent.test/'); await P.page.waitForTimeout(800);
    const fr = P.page.frames().find((f) => f !== P.page.mainFrame());
    const r = await fr.evaluate(() => {
      const g = document.querySelector('[data-fff-frameguard]');
      const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
      const a = g && g.querySelector('a');
      return {text: g ? g.innerText : null, link: a ? {href: a.href, target: a.target, rel: a.rel} : null, htmlDisplay: getComputedStyle(document.documentElement).display, guardVisible: vis(g), appVisible: ['h1', '#inc', '#count', 'main', 'header', 'footer', '#app-version'].filter((s) => vis(document.querySelector(s))), url: location.href, late: (() => { const x = document.createElement('div'); x.id = 'tarziu'; x.textContent = 'dinamic'; document.body.appendChild(x); return x.id; })()};
    });
    await fr.waitForTimeout(50);
    const lateVis = await fr.evaluate(() => { const b = document.getElementById('tarziu').getBoundingClientRect(); return b.width > 0 && b.height > 0; });
    return {r, lateVis, errors: P.errors.filter((e) => !/Failed to load resource|Blocked a frame|Unsafe attempt|sandbox|Failed to set/i.test(e)), P};
  };
  const lang = (l) => FIXTURE.replace('<html lang="ro">', `<html lang="${l}">`);
  const cross = await probe(FIXTURE, false);
  check('cadru cross-origin: mesaj în loc de ecran gol (ro)', cross.r.text && /Această pagină nu poate fi încadrată în alt site\./.test(cross.r.text) && /Deschide-o într-o fereastră nouă/.test(cross.r.text) && cross.r.guardVisible && cross.r.htmlDisplay !== 'none', cross.r);
  check('link target=_blank rel=noopener către adresa paginii', cross.r.link && cross.r.link.target === '_blank' && /noopener/.test(cross.r.link.rel) && cross.r.link.href === cross.r.url, cross.r.link);
  check('conținutul aplicației NU este vizibil (nici cel adăugat ulterior)', cross.r.appVisible.length === 0 && cross.lateVis === false, cross.r.appVisible);
  check('0 erori CSP/pagină în cadru', cross.errors.length === 0, cross.errors);
  const sb = await probe(FIXTURE, true);
  check('iframe sandbox (origine opacă): același mesaj, aplicația ascunsă', sb.r.guardVisible && /nu poate fi încadrată/.test(sb.r.text) && sb.r.appVisible.length === 0, sb.r);
  const strictCss = FIXTURE.replace("style-src 'unsafe-inline'", "style-src 'self'");
  const sc = await probe(strictCss, false);
  check('CSP cu style-src fără unsafe-inline: mesajul apare, fără încălcări de tip style-src-attr (stilurile se pun prin CSSOM)', sc.r.guardVisible && sc.r.appVisible.length === 0 && !sc.errors.some((e) => /style-src-attr|inline style attribute/.test(e)), [sc.r, sc.errors]);
  const expect = {en: /cannot be embedded in another site/, fr: /ne peut pas être intégrée/, it: /non può essere incorporata/, es: /no se puede incrustar/, pt: /não pode ser incorporada/, hu: /nem ágyazható be/, de: /nicht in eine andere Website eingebettet/};
  const got = {};
  for (const l of Object.keys(expect)) { const p = await probe(lang(l), false); got[l] = expect[l].test(p.r.text || '') && p.r.appVisible.length === 0; await p.P.ctx.close(); }
  check('mesaj tradus în cele 7 limbi (după html[lang])', Object.values(got).every(Boolean), got);
  // pagina de sine stătătoare: neatinsă
  const T = await newPage(browser);
  await T.page.goto(app.url); await T.page.waitForTimeout(300);
  check('pagina deschisă direct: fără mesaj, aplicația vizibilă', await T.page.evaluate(() => !document.querySelector('[data-fff-frameguard]') && getComputedStyle(document.documentElement).display !== 'none' && document.getElementById('inc').getBoundingClientRect().width > 0));
}

console.log('F2: candidate ICE și plafonul lockstep');
{
  const p2 = makeApp(FIXTURE, {modules: 'core,label,bundle,p2p'});
  const A = await newPage(browser);
  await A.page.goto(p2.url); await A.page.waitForTimeout(300);
  const r = await A.page.evaluate(async () => {
    const base = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
    const dec = async (cands) => { try { const code = await FFF.p2p.encodeSignal('offer', base.concat(cands).join('\r\n') + '\r\n'); await FFF.p2p.decodeSignal(code); return 'ok'; } catch (e) { return e.code || String(e); } };
    const good = ['a=candidate:842163049 1 udp 1677729535 203.0.113.7 51234 typ srflx raddr 192.168.1.5 rport 51234 generation 0 ufrag abcd network-id 1 network-cost 10',
      'a=candidate:1 1 udp 2113937151 7f3a2b1c-0000-4000-8000-123456789abc.local 55000 typ host generation 0 ufrag abcd network-cost 999',
      'a=candidate:2 1 udp 41885439 198.51.100.9 3478 typ relay raddr 0.0.0.0 rport 0 generation 0',
      'a=candidate:3 1 tcp 1518280447 2001:db8::1 9 typ host tcptype active generation 0'];
    const out = {good: await dec(good)};
    out.prflx = await dec(['a=candidate:1 1 udp 1 10.0.0.1 5000 typ prflx']);
    out.badTyp = await dec(['a=candidate:1 1 udp 1 10.0.0.1 5000 typ evil']);
    out.hostname = await dec(['a=candidate:1 1 udp 1 evil.example.com 5000 typ host']);
    out.port = await dec(['a=candidate:1 1 udp 1 10.0.0.1 70000 typ host']);
    out.octet = await dec(['a=candidate:1 1 udp 1 999.0.0.1 5000 typ host']);
    out.inject = await dec(['a=candidate:1 1 udp 1 10.0.0.1 5000 typ host; x=y']);
    out.extra = await dec(['a=candidate:1 1 udp 1 10.0.0.1 5000 typ host foo bar']);
    out.empty = await dec(['a=candidate:']);
    const many = (n) => Array.from({length: n}, (_, i) => `a=candidate:${i} 1 udp 1 10.0.0.${i % 250 + 1} ${5000 + i} typ host`);
    out.n32 = await dec(many(32)); out.n33 = await dec(many(33));
    out.limits = FFF.p2p.limits;
    return out;
  });
  check('candidate valide (host/srflx/relay, IPv4/IPv6/mDNS, raddr, tcptype) acceptate', r.good === 'ok', r.good);
  check('typ prflx/necunoscut, hostname arbitrar, port/octet invalid, injecție, câmpuri în plus, candidat gol → respinse', [r.prflx, r.badTyp, r.hostname, r.port, r.octet, r.inject, r.extra, r.empty].every((x) => x === 'bad-code'), r);
  check('plafon de candidate: 32 trec, 33 nu', r.n32 === 'ok' && r.n33 === 'bad-code' && r.limits.maxCandidates === 32, r);
  const ls = await A.page.evaluate(() => {
    const h = {}, sent = []; let applied = 0;
    const sess = {role: 'guest', open: false, on: (ev, fn) => { h[ev] = fn; return () => {}; }, send: (m) => { sent.push(m); return true; }};
    const L = FFF.p2p.lockstep(sess, {onMove: () => { applied++; }, onState: () => {}});
    h.message({t: 'sync', seq: 0, seed: 1, state: {}});
    for (let s = 700; s >= 2; s--) h.message({t: 'move', seq: s, move: {a: s}, from: 'host'});   // 699 mutări înainte, lipsește seq 1
    const before = applied;
    h.message({t: 'move', seq: 1, move: {a: 1}, from: 'host'});
    return {before, applied, seq: L.seq, needs: sent.filter((m) => m.t === 'need').length, max: FFF.p2p.limits.maxAhead};
  });
  check('lockstep: mutările „din viitor” sunt plafonate (≤ 256 păstrate), restul cer resincronizare', ls.before === 0 && ls.applied === 1 + 255 && ls.seq === 256 && ls.needs >= 600 && ls.max === 256, ls);
  check('0 erori (p2p)', A.errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, A.errors);
}

await browser.close();
summary('hardening');
