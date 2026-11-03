// Test e2e al plicului FFF între aplicațiile-pilot: „un plic creat în A se deschide în B fără rețea”.
// Rulare: node tests/envelope-pilots.test.mjs [filtru] [--root DIR]   (DIR = folderul cu depozitele aplicațiilor; implicit FFF_ROOT sau părintele hub-ului)
// Cere clonele reale ale aplicațiilor (în CI fără clone se sare cu cod 0 și mesaj). Rețeaua e oprită (context offline); aplicațiile se deschid din file://.
import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath, pathToFileURL} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), ri = args.indexOf('--root'), rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const cands = [rootArg, process.env.FFF_ROOT, path.join(HUB, '..'), '/home/claude/demo/apps'].filter(Boolean);
const ROOT = cands.find((d) => fs.existsSync(path.join(d, 'Cadraj', 'index.html')));
if (!ROOT) { console.log('SKIP: clonele aplicațiilor nu sunt disponibile (--root / FFF_ROOT)'); process.exit(0); }
const only = args[0], results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return; const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const url = (app) => pathToFileURL(path.join(ROOT, app, 'index.html')).href;
async function open(app, init) {
  const ctx = await browser.newContext({locale: 'en-US', acceptDownloads: true, viewport: {width: 1100, height: 900}});
  await ctx.setOffline(true);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(url(app)); await page.waitForFunction(() => window.FFF && FFF.envelope && document.getElementById('fffEnvSend'));
  return {ctx, page, errs};
}
/** apasă „Trimite către…” → „Descarcă fișier” și întoarce conținutul plicului */
async function sendFile(page) {
  await page.click('#fffEnvSend'); const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  return JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
}
/** „Primește…” → fișier → confirmare „Import” */
async function recvFile(page, env, confirm = true) {
  await page.click('#fffEnvRecv'); const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  await fc.setFiles({name: 'plic.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))});
  if (confirm) await page.locator('[role=alertdialog] button', {hasText: /^Import$/}).click({timeout: 5000});
}
const validate = (page, env) => page.evaluate((e) => FFF.envelope.validate(FFF.envelope.normalize(e)), env);

await T('Arhiva-fara-frontiere → AcademiSearch (citation/csl, offline)', async () => {
  const A = await open('Arhiva-fara-frontiere', () => { try { localStorage.setItem('arhiva-ff-favorite-v1', JSON.stringify([{identifier: 'test_item_1', title: 'Un document de test', mediatype: 'texts', creator: ['Ana Pop'], date: '1999-05-01'}])); } catch (e) {} });
  const env = await sendFile(A.page);
  ok(env.type === 'citation/csl' && (env.payload || env.data)[0].URL === 'https://archive.org/details/test_item_1', 'plic Arhiva: ' + JSON.stringify(env).slice(0, 200));
  ok((await validate(A.page, env)).ok, 'plic invalid'); ok(!A.errs.length, A.errs.join(';'));
  const B = await open('AcademiSearch');
  await recvFile(B.page, env);
  await B.page.waitForFunction(() => (JSON.parse(localStorage.getItem('academisearch.library') || '[]')).some((x) => x.title === 'Un document de test'));
  ok(!B.errs.length, B.errs.join(';'));
  await A.ctx.close(); await B.ctx.close();
});
await T('AcademiSearch → Arhiva-fara-frontiere (favorite din adrese archive.org)', async () => {
  const A = await open('AcademiSearch', () => { try { localStorage.setItem('academisearch.library', JSON.stringify([{k: 'x1', title: 'Titlu arhivă', authors: 'Ion Vasile', year: '2001', journal: '', doi: '', url: 'https://archive.org/details/titlu_arhiva', abstract: '', saved: '2026-01-01'}, {k: 'x2', title: 'Fără archive', authors: '', year: '2002', journal: 'J', doi: '10.1/x', url: 'https://doi.org/10.1/x', abstract: '', saved: '2026-01-01'}])); } catch (e) {} });
  const env = await sendFile(A.page); ok(env.type === 'citation/csl', 'tip ' + env.type);
  const B = await open('Arhiva-fara-frontiere'); await recvFile(B.page, env);
  await B.page.waitForFunction(() => (JSON.parse(localStorage.getItem('arhiva-ff-favorite-v1') || '[]')).some((f) => f.identifier === 'titlu_arhiva'));
  const n = await B.page.evaluate(() => JSON.parse(localStorage.getItem('arhiva-ff-favorite-v1')).length); ok(n === 1, 'doar adresa archive.org se importă, am ' + n);
  await A.ctx.close(); await B.ctx.close();
});
await T('Cadraj → DataWeave (table/csv, offline)', async () => {
  const A = await open('Cadraj');
  await A.page.fill('#url-input', 'https://www.tiktok.com/@autortest/video/7300000000000000001'); await A.page.press('#url-input', 'Enter');
  await A.page.waitForFunction(() => document.querySelectorAll('#collections *').length > 3);
  const env = await sendFile(A.page); const csv = env.payload || env.data;
  ok(env.type === 'table/csv' && /autortest/.test(csv) && /^user,id,kind,url/.test(csv), 'csv Cadraj: ' + String(csv).slice(0, 120));
  const B = await open('DataWeave'); await recvFile(B.page, env);
  await B.page.waitForFunction(() => state && state.rows && state.rows.length >= 1 && (state.columns || state.cols || []).some((c) => c.name === 'user'));
  ok(!A.errs.length && !B.errs.length, A.errs.concat(B.errs).join(';'));
  await A.ctx.close(); await B.ctx.close();
});
await T('DataWeave → DataWeave (table/csv; semnat/verificat în pagină)', async () => {
  const A = await open('DataWeave'); await A.page.evaluate(() => loadText('nume,val\nA,1\nB,2\nC,3\n', 'mic.csv'));
  await A.page.waitForFunction(() => state.rows.length === 3);
  const env = await sendFile(A.page); ok(env.type === 'table/csv' && /nume,val/.test(env.payload || env.data), 'csv');
  const signed = await A.page.evaluate(async (e) => { const n = FFF.envelope.normalize(e); const s = await FFF.envelope.sign(n, 'parola-de-test'); return {s, ok: await FFF.envelope.verify(s, 'parola-de-test'), bad: await FFF.envelope.verify(s, 'alta')}; }, env);
  ok(signed.ok === 'ok' && signed.bad === 'bad' && signed.s.sig, 'semnătură ' + JSON.stringify([signed.ok, signed.bad]));
  const B = await open('DataWeave'); await recvFile(B.page, env);
  await B.page.waitForFunction(() => state.rows && state.rows.length === 3);
  await A.ctx.close(); await B.ctx.close();
});
await T('Constelar → Constelar (text/markdown în caseta de scris)', async () => {
  const A = await open('Constelar');
  const env = await sendFile(A.page); ok(env.type === 'text/markdown' && (env.payload || env.data).length > 20, 'md Constelar');
  const B = await open('Constelar'); await recvFile(B.page, env);
  await B.page.waitForFunction(() => document.getElementById('composerInput').value.length > 20);
  ok(!A.errs.length && !B.errs.length, A.errs.concat(B.errs).join(';'));
  await A.ctx.close(); await B.ctx.close();
});
await T('plic invalid sau de tip neacceptat → mesaj, nimic importat', async () => {
  const B = await open('AcademiSearch'); const before = await B.page.evaluate(() => localStorage.getItem('academisearch.library'));
  await recvFile(B.page, {fff: 2, type: 'table/csv', title: 'x', payload: 'a,b', created: new Date().toISOString(), app: 't'}, false);
  await B.page.waitForTimeout(300); ok((await B.page.locator('[role=alertdialog]').count()) === 0, 'tip neacceptat nu trebuia să ceară confirmare');
  await B.page.waitForTimeout(200);
  ok((await B.page.evaluate(() => localStorage.getItem('academisearch.library'))) === before, 'nu trebuia să se schimbe biblioteca');
  await B.ctx.close();
});
const PW = 'parola-de-test-1234', KEYV = 'sk-ant-TESTKEY-0123456789';
async function openAny(app, ready, init) {
  const ctx = await browser.newContext({locale: 'en-US', acceptDownloads: true, viewport: {width: 1100, height: 900}}); await ctx.setOffline(true); if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(url(app)); await page.waitForFunction(ready); return {ctx, page, errs};
}
let vaultEnv = null;
await T('VaultCrypt: fila „Chei API” creează seiful și produce plic keys/vault', async () => {
  const A = await openAny('VaultCrypt', () => window.FFFSeif && document.getElementById('view-keys'));
  await A.page.click('[data-tab=keys]'); await A.page.fill('#fffs-pw1', PW); await A.page.fill('#fffs-pw2', PW); await A.page.press('#fffs-pw2', 'Enter');
  await A.page.waitForSelector('#fffs-id', {timeout: 20000});
  await A.page.fill('#fffs-id', 'anthropic'); await A.page.fill('#fffs-key', KEYV); await A.page.press('#fffs-key', 'Enter');
  await A.page.waitForSelector('.fffs-row .fffs-n', {timeout: 20000});
  const ls = await A.page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  ok(!ls.includes(KEYV), 'cheia în clar în localStorage!');
  await A.page.locator('#view-keys button', {hasText: /Send to/}).click(); const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.locator('[role=menu] button', {hasText: '.fff.json'}).click()]);
  vaultEnv = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(vaultEnv.type === 'keys/vault', 'tip ' + vaultEnv.type); ok(!JSON.stringify(vaultEnv).includes(KEYV), 'cheia în clar în plic!');
  const menu = await A.page.evaluate((e) => { const n = FFF.envelope.normalize(e); return FFF.envelope.sendMenu({env: n, registry: FFF.envelope.registry, selfSlug: 'x', anchor: document.body}).textContent; }, vaultEnv);
  ok(!/Nexus|AI Liber|ARENA/i.test(menu), 'keys/vault nu are voie pe link către aplicații: ' + menu);
  ok(!A.errs.length, A.errs.join(';')); await A.ctx.close();
});
for (const [app, gate, host] of [['Nexus-fara-frontiere', '#btn-settings', 'nexus:aik-vault'], ['AI-Liber', null, 'ai-liber.aik.vault'], ['ARENA', null, 'arena']]) {
  await T(`keys/vault → ${app}: importul cere parola și nu scrie cheia în clar`, async () => {
    ok(vaultEnv, 'lipsește plicul din testul precedent');
    const B = await openAny(app, () => window.FFFSeif, app === 'ARENA' ? () => { try { localStorage.setItem('arena-ff-v1', JSON.stringify({lang: 'en', models: [{id: 'm-ant', name: 'Claude', provider: 'anthropic', model: 'claude-test', baseUrl: 'https://api.anthropic.com', apiKey: '', enabled: true}], ratings: {}, history: []})); } catch (e) {} } : null);
    await B.page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close && 0); });
    if (app === 'Nexus-fara-frontiere') await B.page.click('#btn-settings');
    else if (app === 'AI-Liber') await B.page.evaluate(() => openSett());
    else await B.page.evaluate(() => { document.querySelector('#nav button[data-tab="set"]').click(); });
    const rb = B.page.locator('.fff-seif-box button').first(); await rb.waitFor({state: 'attached', timeout: 10000}); await rb.evaluate((b) => b.scrollIntoView({block: 'center'}));
    await rb.click({force: true});
    const [fc] = await Promise.all([B.page.waitForEvent('filechooser'), B.page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
    await fc.setFiles({name: 'seif.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vaultEnv))});
    await B.page.locator('[role=alertdialog] button', {hasText: /^Import$/}).click();
    await B.page.locator('.kv-box input[type=password]').first().fill(PW); await B.page.locator('.kv-box button[type=submit]').click();
    await B.page.waitForFunction(() => !document.querySelector('.kv-ov'), null, {timeout: 20000});
    await B.page.waitForFunction(() => Object.keys(localStorage).some((k) => /vault/.test(k)), null, {timeout: 30000});
    const dump = await B.page.evaluate(() => JSON.stringify(Object.assign({}, localStorage, sessionStorage)));
    ok(!dump.includes(KEYV), 'cheie în clar în stocare');
    ok(Object.keys(JSON.parse(dump)).some((k) => k.includes('vault')), 'seiful aplicației nu a fost creat: ' + Object.keys(JSON.parse(dump)).join(','));
    if (app === 'Nexus-fara-frontiere') ok((await B.page.inputValue('#f-anthropic-apiKey')) === KEYV, 'cheia nu a ajuns în câmpul Anthropic din Nexus');
    if (app === 'AI-Liber') ok((await B.page.evaluate(() => gk('anthropic'))) === KEYV, 'cheia nu a ajuns în AI Liber');
    ok(!B.errs.length, B.errs.join(';')); await B.ctx.close();
  });
}
await browser.close();
const bad = results.filter((r) => !r[1]).length; console.log(`\n${results.length - bad}/${results.length} trecute`); process.exit(bad ? 1 : 0);
