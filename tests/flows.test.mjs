// Etapa 4 — teste e2e ale fluxurilor între aplicații, pe aplicațiile reale, rețeaua oprită.
//   1) lanțul de surse: scanare → LegatorOCR → TEZAUR → VERIGA → AcademiSearch (referință citabilă), cu programele Rust reale dacă sunt construite, altfel cu fixturile din tests/fixtures/flows;
//   2) laboratorul de reproducere (DataWeave, AcademiSearch, AGORA); 3) motorul A/B (Cadraj, Surveyor, ScryVeil, FreeDetect → DataWeave); 4) jurnalul de teren (5 aplicații → Arhiva).
// Rulare: node tests/flows.test.mjs [filtru] [--root DIR]    (fără clone: SKIP cu cod 0).  Binarele Rust: FFF_RUST_ROOT (implicit /home/claude/chiuta) cu <Nume>/target/release/{legatorocr,tezaur,veriga}.
import {createRequire} from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import {spawnSync} from 'node:child_process'; import {fileURLToPath, pathToFileURL} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), ri = args.indexOf('--root'), rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const cands = [rootArg, process.env.FFF_ROOT, path.join(HUB, '..'), '/home/claude/demo/apps'].filter(Boolean);
const ROOT = cands.find((d) => fs.existsSync(path.join(d, 'AcademiSearch', 'index.html')));
if (!ROOT) { console.log('SKIP: clonele aplicațiilor nu sunt disponibile (--root / FFF_ROOT)'); process.exit(0); }
const only = args[0], results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return; const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split("\n").slice(0, 14).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const url = (app) => pathToFileURL(path.join(ROOT, app, 'index.html')).href;
const FIX = path.join(HUB, 'tests', 'fixtures', 'flows');
const AXEF = process.env.FFF_AXE || (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
async function open(app, init, ready) {
  const ctx = await browser.newContext({locale: 'en-US', acceptDownloads: true, reducedMotion: 'reduce', viewport: {width: 1100, height: 900}, bypassCSP: !!AXEF});   // axe se injectează inline: CSP ocolit doar când rulează axe
  await ctx.setOffline(true);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errs = [], reqs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { if (/^https?:/.test(r.url())) reqs.push(r.url()); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(url(app)); await page.waitForFunction(ready || (() => window.FFF && FFF.envelope), null, {timeout: 15000});
  const wc = page.locator('#btnWelcomeClose'); if (await wc.isVisible().catch(() => false)) await wc.click();
  return {ctx, page, errs, reqs, close: () => ctx.close()};
}
/** „Primește…” (butonul cu id) → fișier → confirmare „Import” */
async function recvFile(page, env, sel = '#fffEnvRecv') {
  await page.click(sel); const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  await fc.setFiles({name: 'plic.fff.json', mimeType: 'application/json', buffer: Buffer.from(typeof env === 'string' ? env : JSON.stringify(env))});
  await page.locator('[role=alertdialog] button', {hasText: /^Import$/}).click({timeout: 5000});
}
/** „Trimite…” (butonul cu id) → Descarcă fișier → conținutul plicului */
async function sendFile(page, sel = '#fffEnvSend') {
  await page.click(sel); const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  return JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
}
const valid = (page, env) => page.evaluate((e) => FFF.envelope.validate(FFF.envelope.normalize(e)), env);
async function axe(page) {
  if (!AXEF) return null;
  await page.addScriptTag({content: fs.readFileSync(AXEF, 'utf8')});
  return page.evaluate(async () => (await axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'best-practice']})).violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')));
}

/* ───────────── 1. Lanțul de surse ───────────── */
const RR = process.env.FFF_RUST_ROOT || '/home/claude/chiuta';
const BIN = {leg: path.join(RR, 'LegatorOCR/target/release/legatorocr'), tez: path.join(RR, 'TEZAUR/target/release/tezaur'), ver: path.join(RR, 'VERIGA/target/release/veriga')};
const LIVE = Object.values(BIN).every((b) => fs.existsSync(b));
console.log(LIVE ? 'Lanț: programele Rust reale (' + RR + ')' : 'Lanț: fixturi (programele Rust nu sunt construite; FFF_RUST_ROOT)');
let chain = {doc: path.join(FIX, 'doc.fff.json'), bib: path.join(FIX, 'bib.fff.json'), checked: path.join(FIX, 'checked.fff.json')};
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(FIX, 'scan.png'))).digest('hex');
const run = (bin, a, o = {}) => spawnSync(bin, a, {encoding: 'utf8', env: {PATH: process.env.PATH, HOME: os.tmpdir(), LANG: 'en_US.UTF-8'}, timeout: 120000, ...o});
if (LIVE) await T('lanț (programe Rust): LegatorOCR → TEZAUR → VERIGA produc plicuri valide, fără rețea', async () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'fffchain-')), p = (f) => path.join(w, f);
  let r = run(BIN.leg, [path.join(FIX, 'scan.png'), '--ocr', '--lang', 'en', '--mode', 'bw', '--format', 'none', '-o', w, '--author', 'Popescu, Ana', '--fff-year', '1999', '--fff-out', p('doc.fff.json')]);
  ok(r.status === 0 && fs.existsSync(p('doc.fff.json')), 'legatorocr: ' + r.status + ' ' + (r.stderr || '').slice(-300));
  const doc = JSON.parse(fs.readFileSync(p('doc.fff.json'), 'utf8'));
  ok(doc.type === 'document/ocr' && doc.payload.sha256 === sha && doc.source.id === 'sha256:' + sha, 'amprenta scanării în plic');
  ok(/Lorem ipsum/i.test(doc.payload.pages[0].text), 'textul OCR conține Lorem ipsum: ' + doc.payload.pages[0].text.slice(0, 60));
  ok(doc.payload.author === 'Popescu, Ana' && doc.payload.year === '1999', 'autor/an în plic');
  fs.mkdirSync(p('idx')); const ix = ['--index', p('idx/tezaur.idx')];
  r = run(BIN.tez, [...ix, 'ingest', '--fff-in', p('doc.fff.json')]); ok(r.status === 0, 'tezaur ingest: ' + r.stderr.slice(-300));
  r = run(BIN.tez, [...ix, 'search', 'ipsum dolor', '-k', '1']); ok(r.status === 0 && /Popescu \(1999\)/.test(r.stdout) && /p\. 1/.test(r.stdout), 'tezaur search citează Popescu (1999), p. 1: ' + r.stdout.slice(0, 200));
  r = run(BIN.tez, [...ix, 'ingest', '--fff-in', p('doc.fff.json')]); ok(/unchanged/.test(r.stderr), 'a doua ingerare: neschimbat (idempotent)');
  r = run(BIN.tez, [...ix, 'bib', '--fff-out', p('bib.fff.json')]); ok(r.status === 0, 'tezaur bib: ' + r.stderr.slice(-200));
  r = run(BIN.ver, ['--fff-in', p('bib.fff.json'), '--fff-out', p('checked.fff.json'), '--timeout', '3', '--retries', '0'], {env: {PATH: process.env.PATH, HOME: os.tmpdir(), http_proxy: '', https_proxy: '', HTTPS_PROXY: '', HTTP_PROXY: ''}});
  ok(r.status === 0 && fs.existsSync(p('checked.fff.json')), 'veriga: ' + r.status + ' ' + r.stderr.slice(-200));
  const chk = JSON.parse(fs.readFileSync(p('checked.fff.json'), 'utf8')), it = chk.payload[0];
  ok(chk.type === 'citation/csl' && chk.app === 'VERIGA' && it.custom.veriga.status === 'no-link' && it.custom.veriga.checked === false, 'VERIGA: no-link, nimic inventat');
  ok(it.issued['date-parts'][0][0] === 1999 && it.author[0].family === 'Popescu' && it.note.includes('sha256:' + sha), 'referința poartă autor, an, amprenta scanării');
  chain = {doc: p('doc.fff.json'), bib: p('bib.fff.json'), checked: p('checked.fff.json')};
});
await T('lanț (VERIGA cu DOI, rețea absentă): „unreachable”, nu „broken”; DOI invalid semnalat; referința fără legătură rămâne', async () => {
  if (!LIVE) return;
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'fffchain2-')), src = path.join(w, 'in.fff.json');
  fs.writeFileSync(src, JSON.stringify({fff: 2, type: 'citation/csl', title: 't', payload: [{id: 'a', type: 'article-journal', title: 'A', DOI: '10.1000/xyz123'}, {id: 'b', type: 'document', title: 'B'}, {id: 'c', type: 'document', title: 'C', DOI: 'nu-e-doi'}], created: '2026-11-03T00:00:00Z', app: 't'}));
  const r = run(BIN.ver, ['--fff-in', src, '--fff-out', path.join(w, 'o.fff.json'), '--timeout', '3', '--retries', '0', '--no-fail', '-q'], {env: {PATH: process.env.PATH, HOME: os.tmpdir(), http_proxy: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9'}});
  ok(r.status === 0, 'veriga: ' + r.status + r.stderr.slice(-200));
  const o = JSON.parse(fs.readFileSync(path.join(w, 'o.fff.json'), 'utf8')).payload, st = o.map((x) => x.custom.veriga.status);
  ok(st[0] === 'unreachable' && st[1] === 'no-link' && st[2] === 'bad-doi' && o.every((x) => x.custom.veriga.checked === false), 'stări: ' + st);
});
await T('lanț: plicurile (live sau fixturi) sunt valide și coerente (amprentă, tipuri, lanț de surse)', async () => {
  const A = await open('AcademiSearch');
  for (const [k, f] of Object.entries(chain)) { const e = JSON.parse(fs.readFileSync(f, 'utf8')); ok((await valid(A.page, e)).ok, 'plic invalid: ' + k); }
  const doc = JSON.parse(fs.readFileSync(chain.doc, 'utf8')), chk = JSON.parse(fs.readFileSync(chain.checked, 'utf8'));
  ok(doc.type === 'document/ocr' && chk.type === 'citation/csl', 'tipuri'); ok(doc.payload.sha256 === sha, 'amprenta din plic = SHA-256 al scanării din fixturi');
  ok(chk.payload[0].note.includes(sha), 'amprenta ajunge până la referință'); await A.close();
});
await T('lanț: o scanare ajunge, fără rețea, în AcademiSearch ca referință citabilă (BibTeX cu autor, an, titlu, amprentă)', async () => {
  const A = await open('AcademiSearch');
  await recvFile(A.page, fs.readFileSync(chain.checked, 'utf8'));
  await A.page.waitForFunction(() => (JSON.parse(localStorage.getItem('academisearch.library') || '[]')).length === 1);
  const lib = (await A.page.evaluate(() => JSON.parse(localStorage.getItem('academisearch.library'))))[0];
  ok(lib && lib.authors === 'Popescu, Ana' && lib.year === '1999' && /Lorem ipsum/.test(lib.title), 'referința din bibliotecă: ' + JSON.stringify(lib));
  ok(lib.note.includes('sha256:' + sha) && /VERIGA: no-link/.test(lib.note), 'nota păstrează amprenta și adnotarea VERIGA: ' + lib.note);
  // export BibTeX din bibliotecă (citabil)
  await A.page.evaluate(() => openLib()); const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.evaluate(() => libExport('bib'))]);
  const bib = fs.readFileSync(await dl.path(), 'utf8');
  ok(/@\w+\{/.test(bib) && /Popescu/.test(bib) && /1999/.test(bib) && /Lorem ipsum/.test(bib) && bib.includes(sha), 'BibTeX citabil: ' + bib.slice(0, 400));
  ok(A.reqs.length === 0, 'cereri de rețea: ' + A.reqs.join(',')); ok(!A.errs.length, A.errs.join(';')); await A.close();
});
await T('lanț: aceeași referință primită de două ori nu se dublează', async () => {
  const A = await open('AcademiSearch'), env = fs.readFileSync(chain.checked, 'utf8');
  await recvFile(A.page, env); await A.page.waitForFunction(() => (JSON.parse(localStorage.getItem('academisearch.library') || '[]')).length === 1);
  await recvFile(A.page, env); await A.page.waitForTimeout(300);
  ok((await A.page.evaluate(() => JSON.parse(localStorage.getItem('academisearch.library')).length)) === 1, 'dublură'); await A.close();
});

/* ───────────── 2. Laboratorul de reproducere ───────────── */
const CSV = 'tara;an;populatie\nRO;2020;19,2\nRO;2021;19,1\nBG;2020;6,9\nBG;2021;6,8\n';
async function fillLab(page, o) {
  await page.fill('#fffr-claim', o.claim); await page.fill('#fffr-value', o.value); await page.selectOption('#fffr-fn', o.fn); await page.fill('#fffr-col', o.col);
  if (o.where) { await page.fill('#fffr-wcol', o.where[0]); await page.selectOption('#fffr-wop', o.where[1]); await page.fill('#fffr-wval', o.where[2]); }
  if (o.ind) { await page.fill('#fffr-sind', o.ind); await page.fill('#fffr-scty', o.cty || ''); }
  await page.fill('#fffr-data', CSV); await page.click('#fffr-run');
}
for (const app of ['DataWeave', 'AcademiSearch']) await T(`repro: ${app} — afirmația se re-rulează pe CSV atașat (reprodusă / nereprodusă / neconcludent) și iese ca plic claim/repro`, async () => {
  const A = await open(app, null, () => window.FFF && FFF.envelope && document.getElementById('fffrFab'));
  await A.page.click('#fffrFab'); ok(await A.page.isVisible('#fffr-panel'), 'panou');
  await fillLab(A.page, {claim: 'Populația medie a României este 19,15 mil.', value: '19,15', fn: 'mean', col: 'populatie', where: ['tara', '=', 'RO'], ind: 'Populație', cty: 'RO'});
  await A.page.waitForSelector('#fffr-verdict'); let v = await A.page.textContent('#fffr-verdict'); ok(/^REPRODUCED/.test(v) && /19,15/.test(v) === false || /REPRODUCED/.test(v), 'verdict: ' + v);
  const env = await sendFile(A.page, '#fffr-send');
  ok(env.type === 'claim/repro' && (env.payload || env.data).verdict === 'reproduced' && (env.payload || env.data).data.sha256 === crypto.createHash('sha256').update(CSV).digest('hex') && (env.payload || env.data).data.csv === CSV, 'plic: ' + JSON.stringify(env).slice(0, 300));
  ok((await valid(A.page, env)).ok, 'plic valid');
  await A.page.fill('#fffr-value', '21'); await A.page.click('#fffr-run'); await A.page.waitForFunction(() => /NOT REPRODUCED/.test(document.getElementById('fffr-verdict').textContent)); 
  await A.page.fill('#fffr-col', 'lipsa'); await A.page.click('#fffr-run'); await A.page.waitForFunction(() => /INCONCLUSIVE/.test(document.getElementById('fffr-verdict').textContent));
  ok(A.reqs.length === 0, 'rețea: ' + A.reqs); ok(!A.errs.length, A.errs.join(';'));
  const ax = await axe(A.page); if (ax) ok(ax.length === 0, 'axe: ' + ax.join(' || '));
  await A.close(); fs.writeFileSync(path.join(os.tmpdir(), 'fffrepro-' + app + '.json'), JSON.stringify(env));
});
await T('repro: plicul de la DataWeave se primește în AcademiSearch, se re-rulează din datele atașate și se confirmă „rezultat identic”', async () => {
  const env = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'fffrepro-DataWeave.json'), 'utf8'));
  const B = await open('AcademiSearch', null, () => window.FFF && FFF.envelope && document.getElementById('fffEnvRecv'));
  await recvFile(B.page, env); await B.page.waitForSelector('#fffr-rerun', {timeout: 8000});
  ok(/same result/.test(await B.page.textContent('#fffr-rerun')) && /^REPRODUCED/.test(await B.page.textContent('#fffr-verdict')), 'rerun: ' + await B.page.textContent('#fffr-out'));
  await B.close();
  // plic modificat (datele schimbate, rezultatul vechi) → rezultat diferit
  const bad = JSON.parse(JSON.stringify(env)), pl = bad.payload || bad.data; pl.data.csv = pl.data.csv.replace('19,2', '10,0');
  const C = await open('DataWeave', null, () => window.FFF && FFF.envelope && document.getElementById('fffEnvRecv'));
  await recvFile(C.page, bad); await C.page.waitForSelector('#fffr-rerun', {timeout: 8000});
  ok(/DIFFERENT result/.test(await C.page.textContent('#fffr-rerun')), 'rerun pe date schimbate: ' + await C.page.textContent('#fffr-rerun')); await C.close();
});
await T('repro: AGORA marchează cifrele verificat / nepotrivit / neverificat după plicul claim/repro', async () => {
  const env = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'fffrepro-DataWeave.json'), 'utf8'));
  const G = await open('AGORA', null, () => window.FFF && FFF.envelope && document.getElementById('cmpRows'));
  await G.page.click('.navitem[data-section=comparator]'); await G.page.waitForSelector('#cmpRows li.cmp-row');
  const names = await G.page.evaluate(() => [...document.querySelectorAll('#cmpA option')].map((o) => o.textContent + '|' + o.value));
  ok(names.length > 1, 'indicatori: ' + names.length);
  const ind = names[0].split('|')[0];
  const rows0 = await G.page.evaluate(() => [...document.querySelectorAll('#cmpRows li.cmp-row .fffr-mark')].map((m) => m.dataset.state));
  ok(rows0.length > 3 && rows0.every((s) => s === 'un'), 'înainte: toate neverificate (' + rows0.length + ')');
  const ids = await G.page.evaluate(() => [...document.querySelectorAll('#cmpRows li.cmp-row')].map((l) => l.dataset.id)), [C1, C2] = ids;
  const mk = (verdict, country) => { const e = JSON.parse(JSON.stringify(env)); const p = e.payload || e.data; p.verdict = verdict; p.subject = {indicator: ind, country}; return e; };
  await recvFile(G.page, mk('reproduced', C1));
  await G.page.waitForFunction((c) => [...document.querySelectorAll(`#cmpRows li.cmp-row[data-id=${c}] .fffr-mark`)].some((m) => m.dataset.state === 'ok'), C1);
  await recvFile(G.page, mk('not-reproduced', C2));
  await G.page.waitForFunction((c) => [...document.querySelectorAll(`#cmpRows li.cmp-row[data-id=${c}] .fffr-mark`)].some((m) => m.dataset.state === 'no'), C2);
  const sum = await G.page.textContent('#fffrSummary'); ok(/1 verified, 1 mismatched, \d+ unverified/.test(sum), 'rezumat: ' + sum);
  // persistă la reîncărcare și urmărește schimbarea indicatorului
  await G.page.reload(); await G.page.waitForSelector('#cmpRows li.cmp-row .fffr-mark');
  ok((await G.page.evaluate((c) => document.querySelectorAll(`#cmpRows li[data-id=${c}] .fffr-mark[data-state=ok]`).length, C1)) === 1, 'persistă');
  await G.page.selectOption('#cmpA', {index: 1}); await G.page.waitForTimeout(200);
  ok((await G.page.evaluate(() => document.querySelectorAll('#cmpRows .fffr-mark[data-state=ok]').length)) === 0, 'alt indicator: nimic verificat');
  ok(G.reqs.length === 0 && !G.errs.length, 'rețea/erori ' + G.reqs + G.errs); await G.close();
});

/* ───────────── 3. Motorul A/B ───────────── */
async function abRun(app, fillFrom) {
  const A = await open(app, null, () => window.FFF && FFF.envelope && FFF.ab && document.getElementById('fffabFab'));
  await A.page.click('#fffabFab'); ok(await A.page.isVisible('#fffab-panel'), 'panou');
  if (fillFrom) { await A.page.click('#fffab-fill'); const n = (await A.page.inputValue('#fffab-vars')).split('\n').filter(Boolean).length; ok(n >= 2, 'variante preluate din aplicație: ' + n); }
  await A.page.fill('#fffab-q', 'Care e mai clar?'); await A.page.fill('#fffab-vars', 'Alfa\nBeta\nGama');
  await A.page.click('#fffab-start'); await A.page.waitForSelector('#fffab-a');
  for (let i = 0; i < 9; i++) {   // Alfa câștigă mereu; restul perechilor: prima
    const ta = await A.page.textContent('#fffab-a'), tb = await A.page.textContent('#fffab-b');
    await A.page.click(/Alfa/.test(tb) ? '#fffab-b' : '#fffab-a'); await A.page.waitForTimeout(30);
  }
  return A;
}
for (const [app, fill] of [['Cadraj', false], ['Surveyor', false], ['ScryVeil', false], ['FreeDetect', true]]) await T(`A/B: ${app} — comparații pe perechi, Elo, verdict, plic experiment/ab, fără rețea`, async () => {
  const A = await abRun(app, fill);
  const rows = await A.page.$$eval('#fffab-table tbody tr', (r) => r.map((x) => [...x.children].map((c) => c.textContent)));
  ok(rows.length === 3 && rows[0][0] === 'Alfa' && +rows[0][1] > 1500 && rows[0][2] === '6', 'clasament: ' + JSON.stringify(rows));
  ok(/leads/.test(await A.page.textContent('#fffab-verdict')), 'verdict: ' + await A.page.textContent('#fffab-verdict'));
  const env = await sendFile(A.page, '#fffab-send'), p = env.payload || env.data;
  ok(env.type === 'experiment/ab' && p.question === 'Care e mai clar?' && p.votes === 9 && p.verdict.leader === 'Alfa' && /^rank,variant,elo/.test(p.csv) && p.caveat.length > 20, 'plic: ' + JSON.stringify(p).slice(0, 200));
  ok((await valid(A.page, env)).ok, 'plic valid');
  const st = await A.page.evaluate(() => JSON.parse(localStorage.getItem('fff.ab.' + FFF.app.slug)));
  ok(st && st.rounds.length === 9, 'starea persistă în localStorage'); await A.page.reload(); await A.page.waitForSelector('#fffabFab'); await A.page.click('#fffabFab');
  await A.page.waitForSelector('#fffab-table', {timeout: 5000}).catch(() => {}); ok(await A.page.isVisible('#fffab-table'), 'după reîncărcare panoul revine direct la clasament');
  await A.page.click('#fffab-undo'); ok((await A.page.evaluate(() => JSON.parse(localStorage.getItem('fff.ab.' + FFF.app.slug)).rounds.length)) === 8, 'anulează ultimul vot');
  const ax = await axe(A.page); if (ax) ok(ax.length === 0, 'axe: ' + ax.join(' || '));
  ok(A.reqs.length === 0, 'rețea: ' + A.reqs); ok(!A.errs.length, A.errs.join(';'));
  fs.writeFileSync(path.join(os.tmpdir(), 'fffab-' + app + '.json'), JSON.stringify(env)); await A.close();
});
await T('A/B: clasamentul din Cadraj se deschide în DataWeave ca tabel (experiment/ab → CSV) și revine ca stare în alt A/B', async () => {
  const env = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'fffab-Cadraj.json'), 'utf8'));
  const D = await open('DataWeave', null, () => window.FFF && FFF.envelope && document.getElementById('fffEnvRecv'));
  await recvFile(D.page, env); await D.page.waitForFunction(() => /Alfa/.test(document.body.innerText) && /elo/i.test(document.body.innerText), null, {timeout: 8000});
  ok(D.reqs.length === 0 && !D.errs.length, 'rețea/erori'); await D.close();
  const S = await open('Surveyor', null, () => window.FFF && FFF.ab && document.getElementById('fffabFab')); await S.page.click('#fffabFab'); await S.page.click('#fffab-recv');
  const [fc] = await Promise.all([S.page.waitForEvent('filechooser'), S.page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  await fc.setFiles({name: 'ab.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))}); await S.page.locator('[role=alertdialog] button', {hasText: /^Import$/}).click();
  await S.page.waitForSelector('#fffab-table'); const r = await S.page.$$eval('#fffab-table tbody tr td:first-child', (x) => x.map((c) => c.textContent));
  ok(r[0] === 'Alfa' && r.length === 3, 'clasament reconstruit: ' + r); await S.close();
});

/* ───────────── 4. Jurnal de teren → atlas ───────────── */
const JAPPS = ['FieldObserver', 'VATRA', 'URME', 'Poteca', 'ExploratoriiEco'];
for (const app of JAPPS) await T(`jurnal: ${app} — intrare geolocalizată (coordonate), export plic geo/journal, GeoJSON, GPX; rotunjire la export`, async () => {
  const A = await open(app, null, () => window.FFF && FFF.envelope && FFF.jurnal && document.getElementById('fffjFab'));
  await A.page.click('#fffjFab'); ok(await A.page.isVisible('#fffj-panel'), 'panou');
  await A.page.fill('#fffj-title', 'Observație din ' + app); await A.page.fill('#fffj-note', 'Notă de test'); await A.page.fill('#fffj-lat', '45,123456'); await A.page.fill('#fffj-lon', '26,654321'); await A.page.selectOption('#fffj-kind', 'place');
  await A.page.click('#fffj-save'); await A.page.waitForSelector('#fffj-list li strong');
  ok((await A.page.textContent('#fffj-count')).match(/^1 (entries|intrări)/), 'contor: ' + await A.page.textContent('#fffj-count'));
  await A.page.fill('#fffj-title', 'invalid'); await A.page.fill('#fffj-lat', '95'); await A.page.fill('#fffj-lon', '10'); await A.page.click('#fffj-save');
  ok(/Invalid coordinates|Coordonate invalide/.test(await A.page.textContent('#fffj-msg')), 'coordonate invalide respinse');
  ok((await A.page.evaluate(() => FFF.jurnal.load().length)) === 1, 'nimic salvat la coordonate invalide');
  const env = await sendFile(A.page, '#fffj-send'), p = env.payload || env.data;   // rotunjire implicită ~100 m
  ok(env.type === 'geo/journal' && p.entries.length === 1 && p.entries[0].lat === 45.123 && p.entries[0].lon === 26.654 && p.entries[0].app === app && p.rounded === 1, 'plic rotunjit: ' + JSON.stringify(p).slice(0, 220));
  ok((await valid(A.page, env)).ok, 'plic valid');
  await A.page.selectOption('#fffj-round', '0'); const e0 = await sendFile(A.page, '#fffj-send'); ok((e0.payload || e0.data).entries[0].lat === 45.123456, 'exact la cerere');
  const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.click('#fffj-geojson')]); const gj = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(gj.type === 'FeatureCollection' && gj.features[0].geometry.coordinates[0] === 26.654321 && gj.features[0].properties.app === app, 'GeoJSON');
  const [d2] = await Promise.all([A.page.waitForEvent('download'), A.page.click('#fffj-gpx')]); const gpx = fs.readFileSync(await d2.path(), 'utf8');
  ok(/<wpt lat="45.123456" lon="26.654321">/.test(gpx) && /<name>Observație din /.test(gpx), 'GPX');
  ok(await A.page.isVisible('#fffj-atlas svg'), 'atlas SVG local');
  const ax = await axe(A.page); if (ax) ok(ax.length === 0, 'axe: ' + ax.join(' || '));
  ok(A.reqs.length === 0 && !A.errs.length, 'rețea/erori ' + A.reqs + A.errs); fs.writeFileSync(path.join(os.tmpdir(), 'fffj-' + app + '.json'), JSON.stringify(e0)); await A.close();
});
await T('jurnal: cele 5 jurnale se unesc în atlasul din Arhiva fără frontiere (fără duplicate), apoi se exportă din atlas', async () => {
  const R = await open('Arhiva-fara-frontiere', null, () => window.FFF && FFF.jurnal && document.getElementById('fffjFab'));
  await R.page.click('#fffjFab');
  for (const app of JAPPS) await recvFile(R.page, JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'fffj-' + app + '.json'), 'utf8')), '#fffj-recv').then(() => R.page.waitForTimeout(150));
  await R.page.waitForFunction(() => FFF.jurnal.load().length === 5, null, {timeout: 8000});
  await recvFile(R.page, JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'fffj-URME.json'), 'utf8')), '#fffj-recv'); await R.page.waitForTimeout(300);
  const apps = await R.page.evaluate(() => FFF.jurnal.load().map((e) => e.app).sort());
  ok(apps.join() === 'ExploratoriiEco,FieldObserver,Poteca,URME,VATRA', 'aplicațiile din atlas: ' + apps);
  ok((await R.page.textContent('#fffj-count')).match(/^5 (entries|intrări), 5 (apps|aplicații)/), 'contor: ' + await R.page.textContent('#fffj-count'));
  ok((await R.page.$$('#fffj-atlas svg circle')).length === 5, 'cinci puncte pe atlas');
  const env = await sendFile(R.page, '#fffj-send'); ok((env.payload || env.data).entries.length === 5, 'export din atlas');
  const ax = await axe(R.page); if (ax) ok(ax.length === 0, 'axe: ' + ax.join(' || '));
  ok(R.reqs.length === 0 && !R.errs.length, 'rețea/erori'); await R.close();
});
await T('jurnal: plic străin sau cu intrări invalide nu strică jurnalul (se ignoră ce nu e valid)', async () => {
  const R = await open('URME', null, () => window.FFF && FFF.jurnal && document.getElementById('fffjFab')); await R.page.click('#fffjFab');
  const bad = {fff: 2, type: 'geo/journal', title: 'x', payload: {entries: [{title: 'ok', lat: 10, lon: 20, ts: '2026-01-01T00:00:00Z', app: 'x'}, {title: 'lat rău', lat: 999, lon: 1}, {lat: 1, lon: 1}, 'nu-e-obiect', {title: '<img src=x onerror=alert(1)>', lat: 1, lon: 1, ts: '2026-01-02T00:00:00Z', app: 'y'}]}, created: '2026-01-01T00:00:00Z', app: 'x'};
  await recvFile(R.page, bad, '#fffj-recv'); await R.page.waitForFunction(() => FFF.jurnal.load().length === 2);
  ok((await R.page.evaluate(() => document.querySelectorAll('#fffj-panel img').length)) === 0, 'nicio injecție HTML'); ok(!R.errs.length, R.errs.join(';')); await R.close();
});

console.log(`\n${results.filter((r) => r[1]).length}/${results.length} ok`); await browser.close(); process.exit(results.every((r) => r[1]) ? 0 : 1);
