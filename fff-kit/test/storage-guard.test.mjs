// Teste kit 1.8.1: stocare în memorie când localStorage/sessionStorage aruncă sau lipsesc (Playwright, rețea blocată).
// Rulare: node test/storage-guard.test.mjs
import {makeApp, launch, newPage, check, summary, FIXTURE} from './_pw.mjs';

const browser = await launch();
const app = makeApp(FIXTURE, {modules: 'core,store,label,bundle', info: false});

async function open(initFn) {
  const ctxPage = await newPage(browser);
  if (initFn) await ctxPage.ctx.addInitScript(initFn);
  await ctxPage.page.goto(app.url);
  await ctxPage.page.waitForTimeout(500);
  return ctxPage;
}

/* ====================================================================== getter care aruncă SecurityError */
console.log('localStorage aruncă SecurityError (cookie-uri blocate)');
{
  const {ctx, page, errors} = await open(() => {
    for (const n of ['localStorage', 'sessionStorage']) Object.defineProperty(window, n, {configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }});
  });
  check('pagina pornește fără erori', errors.length === 0, errors);
  const r = await page.evaluate(() => {
    const o = {volatile: window.FFF.storageVolatile === true};
    localStorage.setItem('a', '1');
    o.get = localStorage.getItem('a');
    o.missing = localStorage.getItem('nu-exista');
    localStorage.b = 'x';
    o.prop = localStorage.getItem('b') === 'x' && localStorage.b === 'x' && localStorage['b'] === 'x';
    o.inOp = 'a' in localStorage && 'b' in localStorage && !('c' in localStorage);
    const mine = (a) => a.filter((k) => !k.startsWith('fff.'));      // indexul kitului apare și într-un Storage real
    o.keys = mine(Object.keys(localStorage)).sort().join();
    o.len = mine(Object.keys(localStorage)).length;
    o.lenReal = localStorage.length === Object.keys(localStorage).length;
    o.key0 = ['a', 'b'].includes(localStorage.key(0));
    o.keyOut = localStorage.key(5);
    localStorage.setItem('n', 5);
    o.coerce = localStorage.getItem('n') === '5';
    delete localStorage.b;
    localStorage.removeItem('a');
    o.afterDel = mine(Object.keys(localStorage)).sort().join();
    localStorage.clear();
    o.afterClear = localStorage.length;
    sessionStorage.setItem('s', 'y');
    o.session = sessionStorage.getItem('s') === 'y';
    o.json = (() => { localStorage.setItem('j', JSON.stringify({q: [1, 2]})); return JSON.parse(localStorage.getItem('j')).q[1]; })();
    return o;
  });
  check('FFF.storageVolatile = true', r.volatile, r);
  check('setItem/getItem; cheie lipsă → null', r.get === '1' && r.missing === null, r);
  check('atribuire de proprietate și citire ca proprietate', r.prop, r);
  check('operatorul `in`', r.inOp, r);
  check('Object.keys, length, key()', r.keys === 'a,b' && r.len === 2 && r.lenReal && r.key0 && r.keyOut === null, r);
  check('valorile sunt șiruri', r.coerce, r);
  check('delete, removeItem, clear', r.afterDel === 'n' && r.afterClear === 0, r);
  check('sessionStorage la fel; JSON merge', r.session && r.json === 2, r);
  const f = await page.evaluate(() => { document.getElementById('inc').click(); document.getElementById('inc').click(); return document.getElementById('count').textContent; });
  check('aplicația de probă (care folosește localStorage la pornire) funcționează', f === '2', f);
  const st = await page.evaluate(() => { try { window.FFF.store.set('k', {a: 1}); return JSON.stringify(window.FFF.store.get('k')); } catch (e) { return 'EROARE ' + e.message; } });
  check('FFF.store merge peste stocarea în memorie', st === '{"a":1}', st);
  check('fără erori după utilizare', errors.length === 0, errors);
  const K = await page.evaluate(() => {
    const o = {};
    localStorage.clear();
    localStorage.setItem('demo-fff.nota', 'salvat');
    o.avail = FFF.store.available();
    o.setRet = FFF.store.set('k2', {z: 1});            // stocare nedurabilă: false, valoarea rămâne în memoria modulului
    o.getBack = JSON.stringify(FFF.store.get('k2'));
    o.keys = FFF.store.indexKeys().includes('demo-fff.nota');
    const b = FFF.bundle.build();
    o.bundle = b.data && b.data['demo-fff.nota'];
    FFF.store.freeze();
    localStorage.setItem('demo-fff.dupa', 'x');        // înghețat: scrierea nu are efect
    localStorage.removeItem('demo-fff.nota');          // înghețat: ștergerea nu are efect
    o.frozen = [localStorage.getItem('demo-fff.dupa'), localStorage.getItem('demo-fff.nota')].join('|');
    return o;
  });
  check('FFF.store.available() = false (stocare nedurabilă); set() întoarce false, get() găsește valoarea', K.avail === false && K.setRet === false && K.getBack === '{"z":1}', K);
  check('observatorul kitului vede cheile scrise direct de aplicație', K.keys === true, K);
  check('copia de siguranță (FFF.bundle.build) include datele din stocarea în memorie', K.bundle === 'salvat', K);
  check('freeze() îngheață și stocarea în memorie', K.frozen === '|salvat', K);
  await ctx.close();
}

/* ====================================================================== lipsă totală */
console.log('localStorage lipsește (undefined / null)');
for (const [nume, fn] of [['undefined', () => { Object.defineProperty(window, 'localStorage', {configurable: true, get() { return undefined; }}); }], ['null', () => { Object.defineProperty(window, 'localStorage', {configurable: true, get() { return null; }}); }]]) {
  const {ctx, page, errors} = await open(fn);
  const r = await page.evaluate(() => { localStorage.setItem('z', '9'); return {v: localStorage.getItem('z'), vol: window.FFF.storageVolatile === true}; });
  check(`${nume}: pagina pornește și stocarea în memorie funcționează`, errors.length === 0 && r.v === '9' && r.vol, {errors, r});
  await ctx.close();
}

/* ====================================================================== stocare care merge: neatinsă */
console.log('stocare funcțională: neatinsă');
{
  const {ctx, page, errors} = await open(null);
  const r = await page.evaluate(() => ({vol: window.FFF.storageVolatile, real: Object.prototype.toString.call(localStorage), isStorage: localStorage instanceof Storage}));
  check('FFF.storageVolatile nedefinit; localStorage rămâne obiectul real', r.vol === undefined && r.isStorage && r.real === '[object Storage]', r);
  await page.evaluate(() => { localStorage.setItem('persist', 'da'); });
  await page.reload(); await page.waitForTimeout(300);
  const p = await page.evaluate(() => localStorage.getItem('persist'));
  check('valoarea persistă între încărcări', p === 'da', p);
  check('fără erori', errors.length === 0, errors);
  await ctx.close();
}

/* ====================================================================== setItem cu cotă depășită: nu se înlocuiește */
console.log('cotă depășită la scriere: stocarea reală rămâne (nu se ascund datele existente)');
{
  const {ctx, page, errors} = await open(() => { localStorage.setItem('vechi', '1'); Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  const r = await page.evaluate(() => ({vol: window.FFF.storageVolatile, vechi: localStorage.getItem('vechi')}));
  check('citirea datelor existente merge și nu s-a trecut pe memorie', r.vol === undefined && r.vechi === '1', r);
  await ctx.close();
}

await browser.close();
summary();
