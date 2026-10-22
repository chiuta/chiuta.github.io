// Teste FFF.bundle (export/import/ștergere, criptare). Rulare: node test/bundle.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {makeApp, launch, newPage, check, summary, FIXTURE, HERE} from './_pw.mjs';

const browser = await launch();
const app = makeApp(FIXTURE);
const seed = async (page) => { await page.click('#inc'); await page.click('#inc'); await page.click('#inc'); await page.fill('#note', 'ăîșț ★ "ghilimele" \\'); await page.selectOption('#lg', 'fr'); await page.evaluate(() => { document.documentElement.lang = 'ro'; }); };
const exportVia = async (page, fn) => { const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(fn)]); const p = await dl.path(); return {name: dl.suggestedFilename(), text: fs.readFileSync(p, 'utf8'), path: p}; };

const A = await newPage(browser);
// cheie străină, scrisă înaintea kitului → nu trebuie atinsă de ștergere
await A.ctx.addInitScript(() => { try { if (!localStorage.getItem('__s')) { localStorage.setItem('__s', '1'); localStorage.setItem('foreign.x', 'rămâne'); localStorage.setItem('fff.altaplicatie.cheie', 'rămâne'); } } catch (e) { /* ignorat */ } });
await A.page.goto(app.url); await A.page.waitForTimeout(400);
await seed(A.page);

console.log('export');
const ex = await exportVia(A.page, () => FFF.bundle.export());
const J = JSON.parse(ex.text);
check('nume *.fff.json cu slug', /^demo-fff-\d{8}-\d{6}\.fff\.json$/.test(ex.name), ex.name);
check('antet: format, schema, app, version, updated, exported', J.format === 'fff-bundle' && J.schema === 1 && J.app === 'demo-fff' && J.version === '1.2.3' && J.updated === '2026-10-14' && !isNaN(Date.parse(J.exported)), J);
check('data: valori exact ca în localStorage', J.data['fx.count'] === '3' && J.data['fx.note'] === 'ăîșț ★ "ghilimele" \\' && J.data.lang === 'fr', J.data);
check('data: fără chei străine și fără indexul kitului', !('foreign.x' in J.data) && !Object.keys(J.data).some((k) => k.includes('__keys') || k.startsWith('fff.altaplicatie')), Object.keys(J.data));

console.log('șterge → importă (round-trip)');
const ls0 = await A.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, FFF.store.raw.get(k)])));
const W = await A.page.evaluate(() => FFF.bundle.wipe({confirm: false}));
const ls1 = await A.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, FFF.store.raw.get(k)])));
check('wipe: șterge doar cheile indexate (rămân cele străine)', W.keys === 3 && ls1['foreign.x'] === 'rămâne' && ls1['fff.altaplicatie.cheie'] === 'rămâne' && !('fx.count' in ls1) && !('fx.note' in ls1) && !('lang' in ls1) && !('fff.demo-fff.__keys' in ls1), {W, ls1});
const impPath = path.join(app.dir, 'in.fff.json'); fs.writeFileSync(impPath, ex.text);
const R = await A.page.evaluate(async (t) => { const r = await FFF.bundle.import(new File([t], 'in.fff.json'), {confirm: false, reload: false}); return r; }, ex.text);
const ls2 = await A.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, FFF.store.raw.get(k)])));
check('import restabilește exact valorile', R.keys === 3 && ls2['fx.count'] === ls0['fx.count'] && ls2['fx.note'] === ls0['fx.note'] && ls2.lang === ls0.lang, {R, ls2});
check('import: cheile revin în index; cele străine neatinse', await A.page.evaluate(() => FFF.store.indexKeys().join()) === 'fx.count,fx.note,lang' && ls2['foreign.x'] === 'rămâne');

console.log('import: dialog de confirmare, anulare, validări');
await A.page.evaluate(() => localStorage.setItem('fx.count', '99'));
await A.page.evaluate((t) => { window.__imp = FFF.bundle.import(new File([t], 'in.fff.json'), {reload: false}).then((r) => r, (e) => ({err: e.code})); }, ex.text);
await A.page.waitForSelector('dialog.fff-dlg-sm');
const msg = await A.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm').innerText);
check('confirmare cere acord și arată n/app/versiune', /Imporți 3 chei în „demo-fff” \(versiunea 1\.2\.3/.test(msg), msg);
await A.page.click('dialog.fff-dlg-sm button:has-text("Anulează")');
const canc = await A.page.evaluate(() => window.__imp);
check('„Anulează” nu scrie nimic', canc.cancelled === true && (await A.page.evaluate(() => localStorage.getItem('fx.count'))) === '99', canc);
await A.page.evaluate((t) => { window.__imp = FFF.bundle.import(new File([t], 'in.fff.json'), {reload: false}); }, ex.text);
await A.page.waitForSelector('dialog.fff-dlg-sm');
await A.page.click('dialog.fff-dlg-sm button.fff-primary');
const okImp = await A.page.evaluate(() => window.__imp);
check('„Da” importă', okImp.keys === 3 && (await A.page.evaluate(() => localStorage.getItem('fx.count'))) === '3');
check('dialogul de confirmare dispare din DOM', await A.page.evaluate(() => document.querySelectorAll('dialog').length === 0));

const tryImp = (obj, opts) => A.page.evaluate(async ([o, op]) => { try { const r = await FFF.bundle.import(new File([typeof o === 'string' ? o : JSON.stringify(o)], 'x.fff.json'), Object.assign({confirm: false, reload: false}, op || {})); return {ok: r}; } catch (e) { return {code: e.code, msg: e.message, name: e.name}; } }, [obj, opts]);
const good = {format: 'fff-bundle', schema: 1, app: 'demo-fff', version: '1', updated: '', exported: '', data: {k1: 'v'}};
check('app greșit respins', (await tryImp({...good, app: 'alta'})).code === 'app');
check('schema necunoscută respinsă', (await tryImp({...good, schema: 2})).code === 'schema');
check('JSON invalid respins', (await tryImp('nu e json')).code === 'format');
check('format necunoscut respins', (await tryImp({...good, format: 'x'})).code === 'format');
check('valori nenumerice (non-șir) respinse', (await tryImp({...good, data: {a: 1}})).code === 'format');
check('data lipsă/array respinse', (await tryImp({...good, data: []})).code === 'format');
check('cheie a altei aplicații fff.* respinsă', (await tryImp({...good, data: {'fff.altaplicatie.x': '1'}})).code === 'key');
check('cheia indexului respinsă', (await tryImp({...good, data: {'fff.demo-fff.__keys': '[]'}})).code === 'key');
check('cheile kitului propriu acceptate', !!(await tryImp({...good, data: {'fff.demo-fff.srs': '1'}})).ok);
check('fișier prea mare respins', (await A.page.evaluate(async () => { try { await FFF.bundle.import({size: 70 * 1048576, text: () => Promise.resolve('')}, {confirm: false}); return 'ok'; } catch (e) { return e.code; } })) === 'too_big');

console.log('rollback la depășire de cotă');
const RB = await A.page.evaluate(async () => {
  localStorage.setItem('fx.count', 'vechi'); let n = 0; const orig = FFF.store.raw.set;
  FFF.store.raw.set = function (k, v) { if (++n === 2) throw new DOMException('plin', 'QuotaExceededError'); return orig.call(this, k, v); };
  let code; try { await FFF.bundle.import(new File([JSON.stringify({format: 'fff-bundle', schema: 1, app: 'demo-fff', version: '', updated: '', exported: '', data: {'fx.count': 'nou', zzz1: 'a', zzz2: 'b'}})], 'q.fff.json'), {confirm: false, reload: false}); } catch (e) { code = e.code; }
  FFF.store.raw.set = orig;
  return {code, count: localStorage.getItem('fx.count'), z1: localStorage.getItem('zzz1'), z2: localStorage.getItem('zzz2')};
});
check('cotă depășită → eroare tradusă și restaurare completă', RB.code === 'quota' && RB.count === 'vechi' && RB.z1 === null && RB.z2 === null, RB);

console.log('criptare AES-GCM');
await A.page.evaluate(async (t) => { await FFF.bundle.wipe({confirm: false}); await FFF.bundle.import(new File([t], 'in.fff.json'), {confirm: false, reload: false}); }, ex.text);
const enc = await A.page.evaluate(() => FFF.bundle.export({encrypt: true, password: 'parola-secreta'}).then((r) => r.filename), null).catch((e) => String(e));
void enc;
const ee = await exportVia(A.page, () => FFF.bundle.export({encrypt: true, password: 'parola-secreta'}));
const E = JSON.parse(ee.text);
check('plic criptat: format, schema, app, kdf, iter 600000, salt/iv/ct base64', E.format === 'fff-bundle-enc' && E.schema === 1 && E.app === 'demo-fff' && E.kdf === 'PBKDF2-SHA256' && E.iter === 600000 && /^[A-Za-z0-9+/=]+$/.test(E.salt + E.iv + E.ct) && Buffer.from(E.iv, 'base64').length === 12 && Buffer.from(E.salt, 'base64').length === 16 && !('data' in E), Object.keys(E));
check('textul criptat nu conține valorile în clar', !ee.text.includes('ghilimele') && !ee.text.includes('fx.count'));
const ee2 = await exportVia(A.page, () => FFF.bundle.export({encrypt: true, password: 'parola-secreta'}));
const E2 = JSON.parse(ee2.text);
check('salt/iv/ct diferă la fiecare export', E.salt !== E2.salt && E.iv !== E2.iv && E.ct !== E2.ct);
check('parolă prea scurtă respinsă la export', await A.page.evaluate(async () => { try { await FFF.bundle.export({encrypt: true, password: 'scurt'}); return 'ok'; } catch (e) { return e.code; } }) === 'pw_short');
check('inspect fără parolă → encrypted:true', (await A.page.evaluate((t) => FFF.bundle.inspect(new File([t], 'e.json')), ee.text)).encrypted === true);
check('inspect cu parolă → număr de chei', (await A.page.evaluate((t) => FFF.bundle.inspect(new File([t], 'e.json'), {password: 'parola-secreta'}), ee.text)).keys === 3);
await A.page.evaluate(() => FFF.bundle.wipe({confirm: false}));
const impEnc = (text, pw) => A.page.evaluate(async ([t, p]) => { try { const r = await FFF.bundle.import(new File([t], 'e.fff.json'), {password: p, confirm: false, reload: false}); return {keys: r.keys}; } catch (e) { return {code: e.code}; } }, [text, pw]);
check('fără parolă → password_required', (await impEnc(ee.text, undefined)).code === 'password_required');
check('parolă greșită → bad_password (nimic scris)', (await impEnc(ee.text, 'gresita!!')).code === 'bad_password' && (await A.page.evaluate(() => localStorage.getItem('fx.count'))) === null);
const tamper = (o) => JSON.stringify({...E, ...o});
const ct = Buffer.from(E.ct, 'base64'); ct[5] ^= 1;
check('ct modificat → bad_password', (await impEnc(tamper({ct: ct.toString('base64')}), 'parola-secreta')).code === 'bad_password');
check('iter modificat → bad_password', (await impEnc(tamper({iter: 310001}), 'parola-secreta')).code === 'bad_password');
check('iter absurd respins (cod iter)', (await impEnc(tamper({iter: 1}), 'parola-secreta')).code === 'iter' && (await impEnc(tamper({iter: 1e12}), 'parola-secreta')).code === 'iter');
check('app din antet modificat → app greșit', (await impEnc(tamper({app: 'alta'}), 'parola-secreta')).code === 'app');
const okE = await impEnc(ee.text, 'parola-secreta');
check('parolă corectă → importă', okE.keys === 3 && (await A.page.evaluate(() => localStorage.getItem('fx.count'))) === '3');
check('parolă cu diacritice/Unicode (NFC) funcționează', await A.page.evaluate(async () => { const r = await FFF.bundle.export({encrypt: true, password: 'pă​rolă-ț★1234', filename: 'u.json'}); return r.encrypted; }));

console.log('mesaje traduse');
const tr = await A.page.evaluate(async () => {
  const out = {};
  for (const l of ['en', 'de', 'hu']) { document.documentElement.lang = l; try { await FFF.bundle.import(new File(['x'], 'x'), {confirm: false}); } catch (e) { out[l] = e.message; } }
  document.documentElement.lang = 'ro'; return out;
});
check('eroarea e tradusă după html[lang]', /not a valid/.test(tr.en) && /gültige/.test(tr.de) && /érvényes/.test(tr.hu), tr);
const BJ = JSON.parse(fs.readFileSync(path.join(HERE, '../i18n/bundle.json'), 'utf8'));
const ks = Object.keys(BJ.ro); const vars = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
check('bundle.json: 8 limbi, aceleași chei și {variabile}', Object.keys(BJ).join() === 'ro,en,fr,it,es,pt,hu,de' && Object.values(BJ).every((o) => Object.keys(o).join() === ks.join() && ks.every((k) => vars(o[k]) === vars(BJ.ro[k]) && o[k].length)));

console.log('UI din dialogul „Transparență”');
const U = await newPage(browser);
await U.ctx.addInitScript(() => { try { if (!localStorage.getItem('__s')) { localStorage.setItem('__s', '1'); localStorage.setItem('foreign.x', 'rămâne'); } } catch (e) { /* ignorat */ } });
await U.page.goto(app.url); await U.page.waitForTimeout(400); await seed(U.page);
await U.page.click('#app-version');
const [d1] = await Promise.all([U.page.waitForEvent('download'), U.page.click('dialog button:has-text("Exportă"):not(:has-text("criptat"))')]);
const uj = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
check('buton Exportă → .fff.json valid', uj.format === 'fff-bundle' && uj.data['fx.count'] === '3' && /\.fff\.json$/.test(d1.suggestedFilename()));
check('mesaj de stare după export', /Exportat: .*\.fff\.json \(3 chei\)/.test(await U.page.evaluate(() => [...document.querySelectorAll('dialog [role=status].fff-res')].pop().textContent)));
await U.page.click('dialog button:has-text("Exportă criptat…")');
check('„Exportă criptat…” deschide câmpurile (aria-expanded)', await U.page.evaluate(() => document.querySelector('dialog button[aria-expanded]').getAttribute('aria-expanded')) === 'true');
await U.page.fill('dialog input[autocomplete=new-password] >> nth=0', 'parola-secreta'); await U.page.fill('dialog input[autocomplete=new-password] >> nth=1', 'altceva-1234');
await U.page.click('dialog button.fff-primary:has-text("Exportă criptat")');
check('parole diferite → mesaj de eroare', /nu coincid/.test(await U.page.evaluate(() => [...document.querySelectorAll('dialog [role=status].fff-res')].pop().textContent)));
await U.page.fill('dialog input[autocomplete=new-password] >> nth=1', 'parola-secreta');
const [d2] = await Promise.all([U.page.waitForEvent('download'), U.page.click('dialog button.fff-primary:has-text("Exportă criptat")')]);
const encFile = await d2.path();
check('export criptat din UI', JSON.parse(fs.readFileSync(encFile, 'utf8')).format === 'fff-bundle-enc' && /\.enc\.fff\.json$/.test(d2.suggestedFilename()));
// ștergere din UI
await U.page.click('dialog button:has-text("Șterge datele aplicației")');
await U.page.waitForSelector('dialog.fff-dlg-sm');
check('ștergerea cere confirmare cu numărul de chei', /Ștergi 3 chei/.test(await U.page.evaluate(() => document.querySelector('dialog.fff-dlg-sm').innerText)));
const nav = U.page.waitForNavigation({waitUntil: 'load', timeout: 8000}).catch(() => null);
await U.page.click('dialog.fff-dlg-sm button.fff-primary');
await nav; await U.page.waitForTimeout(400);
const afterWipe = await U.page.evaluate(() => Object.keys(localStorage).sort());
check('după ștergere: pagina se reîncarcă, doar cheile străine rămân', afterWipe.join() === '__s,foreign.x', afterWipe);
// import criptat din UI
await U.page.click('#app-version');
const [fc] = await Promise.all([U.page.waitForEvent('filechooser'), U.page.click('dialog button:has-text("Importă…")')]);
await fc.setFiles(encFile);
await U.page.waitForSelector('dialog input[autocomplete=current-password]:visible');
check('fișier criptat → cere parola', /criptat/.test(await U.page.evaluate(() => [...document.querySelectorAll('dialog [role=status].fff-res')].pop().textContent)));
await U.page.fill('dialog input[autocomplete=current-password]', 'gresita-1234');
await U.page.click('dialog button.fff-primary:has-text("Importă")');
await U.page.waitForSelector('dialog.fff-dlg-sm', {timeout: 1500}).catch(() => null);
check('parolă greșită → mesaj, câmpul rămâne vizibil', /Parolă greșită/.test(await U.page.evaluate(() => ([...document.querySelectorAll('dialog [role=status].fff-res')].pop() || {}).textContent || '')) || (await U.page.evaluate(() => !!document.querySelector('dialog.fff-dlg-sm'))) === false);
await U.page.fill('dialog input[autocomplete=current-password]', 'parola-secreta');
const nav2 = U.page.waitForNavigation({waitUntil: 'load', timeout: 8000}).catch(() => null);
await U.page.click('dialog button.fff-primary:has-text("Importă")');
await U.page.waitForSelector('dialog.fff-dlg-sm');
await U.page.click('dialog.fff-dlg-sm button.fff-primary');
await nav2; await U.page.waitForTimeout(500);
const back = await U.page.evaluate(() => ({c: localStorage.getItem('fx.count'), n: localStorage.getItem('fx.note'), l: localStorage.getItem('lang'), out: document.getElementById('count').textContent}));
check('import criptat din UI → date restaurate, pagina reîncărcată', back.c === '3' && back.n === 'ăîșț ★ "ghilimele" \\' && back.l === 'fr' && back.out === '3', back);

console.log('redactare (kit 1.1.x)');
const RD = await A.page.evaluate(async () => {
  const out = {};
  localStorage.setItem('fx.note', 'secret-123');
  FFF.bundle.redact((k, v) => k === 'fx.note' ? 'REDACTAT' : v);
  FFF.bundle.redact((k, v) => { if (k === 'lang') throw new Error('defect'); return v; });
  FFF.bundle.redact((k, v) => k === 'fx.count' ? undefined : v);
  out.build = FFF.bundle.build().data;
  const cap = async (opt) => { let txt; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { txt = b; return orig.call(URL, b); }; try { await FFF.bundle.export(opt); } catch (e) { out.err = e.code || String(e); } URL.createObjectURL = orig; return txt ? JSON.parse(await txt.text()).data : null; };
  out.plain = await cap({});
  out.secrets = await cap({secrets: true});
  return out;
});
check('build() rămâne complet (neredactat)', RD.build['fx.note'] === 'secret-123' && RD.build.lang === 'fr', RD.build);
check('export necriptat: valoarea redactată, redactor defect → gol, ne-șir → gol', RD.plain && RD.plain['fx.note'] === 'REDACTAT' && RD.plain.lang === '' && RD.plain['fx.count'] === '', RD.plain);
check('export {secrets:true}: complet', RD.secrets && RD.secrets['fx.note'] === 'secret-123' && RD.secrets.lang === 'fr', RD.secrets);

console.log('curat');
const allErr = [...A.errors, ...U.errors].filter((e) => !/Failed to load resource|QuotaExceeded|plin/.test(e));
check('0 pageerror/CSP', allErr.length === 0, allErr);
check('0 cereri de rețea', A.net.length === 0 && U.net.length === 0);
await browser.close();
summary('bundle');
