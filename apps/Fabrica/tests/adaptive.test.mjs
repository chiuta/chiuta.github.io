// Teste Fabrica 2.0 — parcurs adaptiv (reguli + lecții opționale) și caiet de progres cu amprentă SHA-256.
// Rulare: node tests/adaptive.test.mjs  (rețea blocată; axe: FFF_AXE / AXE_PATH)
import {createRequire} from 'module';
import path from 'path'; import {fileURLToPath} from 'url'; import fs from 'fs'; import os from 'os'; import crypto from 'crypto';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const __dir = path.dirname(fileURLToPath(import.meta.url));
const APP = 'file://' + path.resolve(__dir, '..', 'index.html');
const AXE = process.env.FFF_AXE || process.env.AXE_PATH || (() => { try { return createRequire(import.meta.url).resolve('axe-core/axe.min.js'); } catch { return undefined; } })();
const AXE_SRC = fs.readFileSync(AXE, 'utf8');
let pass = 0, fail = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else { fail++; failures.push(m); console.log('  FAIL:', m); } };
const eq = (a, b, m) => { const A = JSON.stringify(a), B = JSON.stringify(b); ok(A === B, m + ' (obtained ' + A + ', expected ' + B + ')'); };
const sect = s => console.log('\n## ' + s);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-ad-'));
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
async function mk(url) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true, bypassCSP: false});
  const reqs = []; await ctx.route(/^https?:/, r => { reqs.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' || /Content Security Policy|Refused/i.test(t)) errs.push('console: ' + t); });
  p.__errs = errs; p.__reqs = reqs; await p.goto(url); return p;
}
async function axe(p, label) {
  await p.mouse.move(0, 0); await p.waitForTimeout(3600);
  if (!(await p.evaluate(() => !!window.axe))) { const cdp = await p.context().newCDPSession(p); await cdp.send('Runtime.evaluate', {expression: AXE_SRC}); await cdp.detach(); }
  const r = await p.evaluate(async () => { const x = await axe.run(document, {resultTypes: ['violations']}); return x.violations.map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')); });
  eq(r, [], 'axe 0 violări — ' + label);
}
const Q = (id, text) => ({id, type: 'single', text, explain: '', okMsg: '', badMsg: '', options: [{id: id + 'a', text: 'Corect ' + id, correct: true}, {id: id + 'b', text: 'Greșit ' + id, correct: false}]});
const COURSE = {
  id: 'curs-adaptiv', title: 'Curs adaptiv', description: 'Descriere de test pentru parcurs adaptiv.', author: 'Test', license: 'CC0', lang: 'ro', version: '1.2.0',
  levels: [{id: 'n1', title: 'Nivel', lessons: [
    {id: 'l1', title: 'Baza', body: 'Text de bază pentru lecția întâi, suficient de lung ca să nu fie considerat prea scurt de verificări.', questions: [Q('q1', 'Prima?'), Q('q2', 'A doua?')],
      branches: [{op: 'lt', pct: 60, to: 'l2'}, {op: 'gte', pct: 100, to: 'l3'}]},
    {id: 'l2', title: 'Recapitulare', optional: true, body: 'Recapitulare opțională, scrisă pentru cei care au greșit în lecția de bază, cu explicații suplimentare.', questions: []},
    {id: 'l3', title: 'Avansat', optional: true, body: 'Lecție avansată opțională, pentru cei care au răspuns perfect la lecția de bază și vor mai mult.', questions: []},
    {id: 'l4', title: 'Încheiere', body: 'Lecția finală obligatorie, cu un text suficient de lung pentru a trece de avertismentele de lungime.', questions: [Q('q3', 'Ultima?')]}
  ]}],
  finalTest: {enabled: false, seed: 'semn-fix'}
};

sect('1. Model: normalizare și validare');
const ed = await mk(APP); await ed.waitForFunction(() => window.__fabrica);
const n1 = await ed.evaluate(c => { const F = window.__fabrica; const r = F.normCourse(c).course; const ls = r.levels[0].lessons;
  const w = F.normCourse({title: 'x', levels: [{title: 'n', lessons: [{title: 'a', body: 'b', optional: 1, branches: [{op: 'zzz', pct: 250, to: 'x'}, {op: 'gte', pct: -4, to: 'y'}, {}, {}, {}]}]}]}).course.levels[0].lessons[0];
  return [ls[0].branches.length, ls[1].optional, ls[0].optional, w.optional, w.branches.length, w.branches[0], w.branches[1].pct]; }, COURSE);
eq(n1, [2, true, false, true, 3, {op: 'lt', pct: 100, to: 'x'}, 60], 'normCourse: câmpuri optional/branches, prag limitat 0–100, max. 3 reguli');
const lint1 = await ed.evaluate(c => { const F = window.__fabrica; const d = JSON.parse(JSON.stringify(c)); d.levels[0].lessons[0].branches = [{op: 'lt', pct: 60, to: 'l2'}, {op: 'lt', pct: 50, to: 'l1'}, {op: 'lt', pct: 10, to: 'nu-exista'}]; d.levels[0].lessons[2].branches = [{op: 'lt', pct: 5, to: 'l4'}];
  const cc = F.normCourse(d).course; return F.lint(cc, k => k).filter(x => /branch|optional/.test(x.code)).map(x => x.sev + ':' + x.code).sort(); }, COURSE);
ok(lint1.includes('error:branch_target') && lint1.includes('warn:branch_self') && lint1.includes('warn:branch_noq'), 'lint: țintă inexistentă (eroare), auto-referință, reguli fără întrebări — ' + lint1);
const lint2 = await ed.evaluate(c => { const F = window.__fabrica; return F.lint(F.normCourse(c).course, k => k).filter(x => /branch|optional/.test(x.code)).map(x => x.code); }, COURSE);
eq(lint2, [], 'lint: cursul valid nu are probleme de ramificare (lecțiile opționale sunt recomandate)');
const lint3 = await ed.evaluate(c => { const F = window.__fabrica; const d = JSON.parse(JSON.stringify(c)); d.levels[0].lessons[0].branches = []; return F.lint(F.normCourse(d).course, k => k).filter(x => x.code === 'optional_orphan').length; }, COURSE);
eq(lint3, 2, 'lint: lecții opționale nerecomandate -> info');
const rt = await ed.evaluate(c => { const F = window.__fabrica; const j = F.courseToJson(F.normCourse(c).course); const b = F.parseCourseJson(j).course; return [JSON.parse(j).schema, b.levels[0].lessons[0].branches.length, b.levels[0].lessons[1].optional]; }, COURSE);
eq(rt, [1, 2, true], '.course.json: round-trip păstrează regulile (schema rămâne 1)');
const old = await ed.evaluate(() => { const F = window.__fabrica; const l = F.normCourse({title: 'v', levels: [{title: 'n', lessons: [{title: 'a', body: 'b', questions: []}]}]}).course.levels[0].lessons[0]; return [l.optional, l.branches]; });
eq(old, [false, []], 'cursuri vechi (fără câmpuri noi) se încarcă fără modificări de comportament');

sect('2. Editor: interfață pentru reguli');
await ed.evaluate(c => window.__fabrica.setCourse(c), COURSE);
await ed.click('#tab-content'); await ed.waitForSelector('#adaptcard');
eq(await ed.locator('#adaptcard [data-key^="levels.0.lessons.0.branches."]').count(), 2, 'două reguli afișate pentru „Baza”');
await ed.click('#adaptcard [data-act="arr-add"]'); await ed.waitForTimeout(100);
eq(await ed.locator('#adaptcard [data-key^="levels.0.lessons.0.branches."]').count(), 3, 'regulă adăugată');
eq(await ed.locator('#adaptcard [data-act="arr-add"]').count(), 0, 'maxim 3 reguli (butonul dispare)');
await ed.selectOption('#f-levels-0-lessons-0-branches-2-to', 'l4'); await ed.fill('#f-levels-0-lessons-0-branches-2-pct', '40'); await ed.waitForTimeout(100);
eq(await ed.evaluate(() => window.__fabrica.course.levels[0].lessons[0].branches[2]), {op: 'lt', pct: 40, to: 'l4'}, 'editarea câmpurilor regulii');
await ed.click('#adaptcard [data-act="arr-del"][data-i="2"]'); await ed.waitForTimeout(100);
eq(await ed.evaluate(() => window.__fabrica.course.levels[0].lessons[0].branches.length), 2, 'regulă ștearsă');
await ed.locator('#tree .tn').nth(2).click(); await ed.waitForSelector('#f-levels-0-lessons-1-optional');
ok(await ed.isChecked('#f-levels-0-lessons-1-optional'), 'bifa „opțională” reflectă datele');
await ed.uncheck('#f-levels-0-lessons-1-optional'); await ed.waitForTimeout(80);
eq(await ed.evaluate(() => window.__fabrica.course.levels[0].lessons[1].optional), false, 'bifa modifică lecția');
await ed.check('#f-levels-0-lessons-1-optional'); await ed.waitForTimeout(80);
await axe(ed, 'editor, card parcurs adaptiv');

sect('3. Player: recomandări, lecții opționale, progres');
const fHtml = path.join(tmp, 'curs.html');
const built = await ed.evaluate(async c => { const F = window.__fabrica; const r = await F.buildHtml(F.normCourse(c).course); return r.html; }, COURSE);
fs.writeFileSync(fHtml, built);
const pl = await mk('file://' + fHtml); await pl.waitForSelector('#main h1');
const prog0 = await pl.evaluate(() => window.FabricaPlayer.state().P && JSON.stringify(window.FabricaPlayer.state().route));
ok(!!prog0, 'player pornit');
eq(await pl.locator('nav a[data-r^="/l/"]').count(), 4, 'meniu: toate cele 4 lecții');
ok((await pl.locator('nav a[data-r="/l/l2"]').textContent()).includes('extra'), 'lecția opțională marcată „extra” în meniu');
await pl.evaluate(() => location.hash = '#/l/l1'); await pl.waitForSelector('.q');
eq(await pl.locator('#adapt').count(), 0, 'fără recomandare înainte de a răspunde la toate întrebările');
await pl.locator('.q').nth(0).getByLabel('Greșit q1').check(); await pl.locator('.q').nth(0).locator('[data-act="check"]').click();
eq(await pl.locator('#adapt').count(), 0, 'fără recomandare după o singură întrebare din două');
await pl.locator('.q').nth(1).getByLabel('Greșit q2').check(); await pl.locator('.q').nth(1).locator('[data-act="check"]').click();
// recomandarea apare după re-randare
await pl.evaluate(() => window.FabricaPlayer.reRender(false)); await pl.waitForSelector('#adapt');
ok((await pl.textContent('#adapt')).includes('0%') && (await pl.textContent('#adapt')).includes('Recapitulare'), 'scor 0% -> recomandă „Recapitulare”');
eq(await pl.evaluate(() => window.FabricaPlayer.adaptRec('l1')), {score: 0, to: 'l2', optional: true}, 'API adaptRec');
await axe(pl, 'player, lecție cu recomandare');
await pl.click('#adapt [data-act="adapt-go"]'); await pl.waitForFunction(() => location.hash === '#/l/l2');
await pl.waitForSelector('#main h1');
ok((await pl.textContent('#main h1')).includes('Recapitulare'), 'se deschide lecția sugerată');
ok((await pl.textContent('#main')).includes('Lecție opțională'), 'notă „lecție opțională”');
ok((await pl.locator('.pager a').first().getAttribute('href')) === '#/l/l1', 'din lecția opțională se poate reveni la lecția care a recomandat-o');
const afterOpt = await pl.evaluate(() => { const s = window.FabricaPlayer.state(); return Object.keys(s.P.done).length; });
await pl.click('[data-act="toggle-done"]');
const st1 = await pl.evaluate(() => JSON.stringify(window.FabricaPlayer.state().P.done));
ok(afterOpt === 0 && /l2/.test(st1), 'lecția opțională poate fi marcată');
await pl.evaluate(() => location.hash = '#/'); await pl.waitForSelector('#main h1');
const meta0 = (await pl.textContent('#main dl.meta')).replace(/\s+/g, ' ');
ok(/0\D+2/.test(meta0) && !/3/.test(meta0.replace(/Descriere.*/, '')), 'progres: doar cele 2 lecții obligatorii se numără — ' + meta0);
// refacem lecția 1 cu răspunsuri corecte -> 100% -> Avansat
await pl.evaluate(() => location.hash = '#/l/l1'); await pl.waitForSelector('.q');
for (const i of [0, 1]) { await pl.locator('.q').nth(i).locator('[data-act="retry"]').click(); await pl.locator('.q').nth(i).getByLabel('Corect q' + (i + 1)).check(); await pl.locator('.q').nth(i).locator('[data-act="check"]').click(); }
await pl.evaluate(() => window.FabricaPlayer.reRender(false)); await pl.waitForSelector('#adapt');
ok((await pl.textContent('#adapt')).includes('100%') && (await pl.textContent('#adapt')).includes('Avansat'), 'scor 100% -> recomandă „Avansat” (a doua regulă)');
eq(await pl.evaluate(() => window.FabricaPlayer.lessonScore('l1')), 100, 'lessonScore');
// un scor intermediar nu declanșează nimic
await pl.evaluate(() => { const s = window.FabricaPlayer.state().P; s.ans.q2 = {s: 0.5, resp: 1}; });
eq(await pl.evaluate(() => window.FabricaPlayer.adaptRec('l1')), null, 'scor 75%: nicio regulă nu se potrivește (sub 60 / cel puțin 100)');
await pl.evaluate(() => { const s = window.FabricaPlayer.state().P; s.ans.q2 = {s: 1, resp: 0}; });
// certificat: doar lecțiile obligatorii
for (const id of ['l1', 'l4']) { await pl.evaluate(i => { location.hash = '#/l/' + i; }, id); await pl.waitForSelector('[data-act="toggle-done"]'); if ((await pl.getAttribute('[data-act="toggle-done"]', 'aria-pressed')) === 'false') await pl.click('[data-act="toggle-done"]'); }
await pl.evaluate(() => location.hash = '#/cert'); await pl.waitForSelector('#main h1');
ok(await pl.locator('#cname').count() === 1, 'certificat disponibil fără lecția opțională „Avansat” (nebifată)');
eq(pl.__errs, [], 'player: 0 erori/CSP'); eq(pl.__reqs, [], 'player: 0 cereri de rețea');

sect('4. Caiet de progres cu amprentă');
await pl.evaluate(() => location.hash = '#/settings'); await pl.waitForSelector('#nbname');
await pl.fill('#nbname', 'Ana Test');
const [dn] = await Promise.all([pl.waitForEvent('download'), pl.click('[data-act="nb-export"]')]);
ok(/\.caiet\.json$/.test(dn.suggestedFilename()), 'fișier .caiet.json');
const fNb = path.join(tmp, 'ana.caiet.json'); await dn.saveAs(fNb);
const nb = JSON.parse(fs.readFileSync(fNb, 'utf8'));
eq([nb.format, nb.schema, nb.learner.name, nb.course.id, nb.course.version], ['fabrica-notebook', 1, 'Ana Test', 'curs-adaptiv', '1.2.0'], 'antet caiet');
eq([nb.progress.lessonsDone, nb.progress.lessonsTotal, nb.progress.pct, nb.progress.certReady], [2, 2, 100, true], 'progres: 2/2 lecții obligatorii, certificat gata');
eq(nb.lessons.map(l => [l.id, l.optional, l.done, l.score]), [['l1', false, true, 100], ['l2', true, true, null], ['l3', true, false, null], ['l4', false, true, null]], 'detaliu lecții cu scor');
eq(nb.fingerprint.alg, 'SHA-256', 'algoritm declarat'); ok(/^[0-9a-f]{64}$/.test(nb.fingerprint.value) && /^[0-9a-f]{64}$/.test(nb.course.contentHash), 'amprentă și hash de conținut în hex (64)');
// recalculare independentă în Node (JSON canonic)
const canon = o => Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o);
const nb2 = JSON.parse(JSON.stringify(nb)); delete nb2.fingerprint;
eq(crypto.createHash('sha256').update(canon(nb2), 'utf8').digest('hex'), nb.fingerprint.value, 'amprenta se recalculează în Node (SHA-256 peste JSON canonic)');
const cd = JSON.parse(await pl.evaluate(() => document.getElementById('course-data').textContent)); delete cd.updated; delete cd.generator;
eq(crypto.createHash('sha256').update(canon(cd), 'utf8').digest('hex'), nb.course.contentHash, 'hash-ul de conținut se recalculează în Node din datele cursului');
const vv = await pl.evaluate(async n => { const F = window.FabricaPlayer; const a = await F.verifyNotebook(n); const t = JSON.parse(JSON.stringify(n)); t.learner.name = 'Altcineva'; const b = await F.verifyNotebook(t); const c = await F.verifyNotebook({format: 'x'}); return [a.ok, b.ok, c.invalid === true]; }, nb);
eq(vv, [true, false, true], 'verifyNotebook: valid / modificat / invalid');
const fb = await pl.evaluate(async n => { window.__fabricaNoSubtle = true; const v = await window.FabricaPlayer.nbFingerprint(n); window.__fabricaNoSubtle = false; return v; }, nb);
eq(fb, nb.fingerprint.value, 'SHA-256 pur JS (fără crypto.subtle) dă aceeași amprentă');
ok((await pl.textContent('#main')).includes('nu o semnătură digitală'), 'avertisment: sumă de control, nu semnătură');
await axe(pl, 'player, Setări cu caiet'); await pl.close();

sect('5. Editor: verificarea caietelor');
await ed.evaluate(c => window.__fabrica.setCourse(c), COURSE); await ed.click('#tab-export');
fs.writeFileSync(path.join(tmp, 'rau.caiet.json'), JSON.stringify(Object.assign({}, nb, {learner: {name: 'Altcineva'}})));
fs.writeFileSync(path.join(tmp, 'gunoi.json'), '{"a":1}');
fs.writeFileSync(path.join(tmp, 'nujson.json'), 'nu e json');
await ed.setInputFiles('#nbf', [fNb, path.join(tmp, 'rau.caiet.json'), path.join(tmp, 'gunoi.json'), path.join(tmp, 'nujson.json')]);
await ed.waitForSelector('#nbres table');
const rows = await ed.locator('#nbres tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
eq(rows.length, 4, '4 rânduri în tabel');
eq([rows[0][1], rows[0][4], rows[0][5]], ['Ana Test', 'corectă', 'aceeași versiune'], 'caiet valid, aceeași versiune a cursului');
eq(rows[1][4], 'nu corespunde', 'caiet modificat -> amprentă nepotrivită');
ok(rows[2][1].includes('nu este un caiet') && rows[3][1].includes('nu este un caiet'), 'fișiere străine/nevalide semnalate');
// curs modificat -> altă versiune
await ed.evaluate(() => { window.__fabrica.course.levels[0].lessons[0].body += ' Text nou.'; });
await ed.setInputFiles('#nbf', [fNb]); await ed.waitForFunction(() => /altă versiune/.test(document.getElementById('nbres').textContent));
ok(true, 'curs schimbat după export -> „altă versiune”');
await axe(ed, 'editor, verificare caiete'); eq(ed.__errs, [], 'editor: 0 erori/CSP'); eq(ed.__reqs, [], 'editor: 0 cereri de rețea');

sect('6. Limbi');
const keys = await ed.evaluate(() => { const g = id => JSON.parse(document.getElementById(id).textContent); const r = {}; for (const id of ['player-i18n', 'ed-i18n']) { const j = g(id); const k0 = Object.keys(j.ro).sort().join(); r[id] = Object.keys(j).every(l => Object.keys(j[l]).sort().join() === k0) && ['adapt_title', 'nb_text', 'branch_title', 'nbv_text', 'lint_branch_target'].every(k => Object.keys(j).every(l => j[l][k] !== undefined) || !(k in j.ro)); } return r; });
eq(keys, {'player-i18n': true, 'ed-i18n': true}, 'seturi de chei identice în cele 8 limbi (inclusiv cheile noi)');
for (const l of ['en', 'de', 'hu']) { await ed.selectOption('#langSel', l); await ed.click('#tab-content'); await ed.waitForSelector('#adaptcard'); ok(!/branch_/.test(await ed.textContent('#adaptcard')), 'card adaptiv tradus ' + l); }
await ed.close();
await browser.close(); fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${pass} teste reușite, ${fail} eșuate`); if (fail) { console.log(failures.join('\n')); process.exit(1); }
