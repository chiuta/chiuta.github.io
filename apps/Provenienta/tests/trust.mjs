// Teste Playwright pentru Provenienta 2.0 — lista de încredere importată de utilizator, lanț până la ancoră, „semnat de emitent necunoscut”, axa timpului.
// Toate fișierele C2PA și certificatele sunt SINTETICE (tests/synth.mjs); nu există nicio listă oficială în aplicație sau în teste.
// Rulare: node tests/trust.mjs   (portabil; axe-core prin FFF_AXE / AXE_PATH)
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './synth.mjs';

const require = createRequire(process.env.PW_ROOT || import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_FILE = path.resolve(HERE, '../index.html');
const APP = 'https://provenienta.test/index.html';
const APP_JSON = JSON.parse(fs.readFileSync(path.resolve(HERE, '../app.json'), 'utf8'));
const AXE = process.env.FFF_AXE || process.env.AXE_PATH || (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return undefined; } })();
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'provenienta-trust-'));

const results = []; let current = '';
async function test(name, fn) {
  current = name; const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log('  ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push({ name, ok: false, err: e.stack || String(e) }); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').join('\n       ')); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const netReqs = [], pageErrors = [];
async function mkCtx(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: 'ro-RO', serviceWorkers: 'block' }, opts));
  await ctx.route(/^https?:/, (r) => {
    const u = r.request().url();
    if (u.startsWith('https://provenienta.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) });
    const m = /^https:\/\/provenienta\.test\/(manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png)$/.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: m[1].endsWith('png') ? 'image/png' : 'application/manifest+json', body: fs.readFileSync(path.resolve(HERE, '..', m[1])) });
    netReqs.push(u); r.abort();
  });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  return ctx;
}
const ctx = await mkCtx();
async function openApp(c = ctx) {
  const p = await c.newPage();
  p.on('pageerror', (e) => pageErrors.push(current + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') pageErrors.push(current + ' console: ' + m.text()); });
  await p.goto(APP); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  await p.waitForFunction(() => window.Provenienta && document.querySelector('#lang option') && document.querySelector('#trust-h'));
  return p;
}
const settled = (p, name, slot = 'A') => p.waitForFunction(([n, s]) => { const st = window.Provenienta.state; return !st.busy && st.res[s] && st.res[s].name === n; }, [name, slot], { timeout: 60000 });
async function loadBuf(p, buf, name, slot = 'A') { await p.setInputFiles('#file-' + slot, { name, mimeType: 'application/octet-stream', buffer: buf }); await settled(p, name, slot); }
const trustState = (p, slot = 'A') => p.evaluate((s) => { const r = window.Provenienta.state.res[s]; const m = r.manifests[r.active]; return { sig: m.sig.state, trust: m.trust && m.trust.state, anchor: m.trust && m.trust.anchor }; }, slot);
const text = (p) => p.evaluate(() => document.querySelector('#result').innerText);
const pem = (der, label = 'CERTIFICATE') => `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END ${label}-----\n`;
async function importCerts(p, files) {
  await p.setInputFiles('#trust-file', files.map((f) => ({ name: f.name, mimeType: 'application/octet-stream', buffer: Buffer.isBuffer(f.buf) ? f.buf : Buffer.from(f.buf) })));
  await p.waitForFunction(() => /Adăugate|Added/.test(document.querySelector('#trust-msg').textContent), null, { timeout: 15000 }); await p.waitForTimeout(150);
}

const baseSvg = S.baseSvg();
const signerRoot = S.makeSigner({ alg: 'ES256', cn: 'Semnatar Sintetic A', chain: 'root' });
const [leafA, rootA] = signerRoot.certs;
const signed = S.signAsset('svg', baseSvg, { signer: signerRoot, assertions: [S.actionsAssertion({ source: S.SRC.capture })] }).file;
const otherRoot = S.makeSigner({ alg: 'ES256', cn: 'Alt Semnatar B', chain: 'root' }).certs[1];

console.log('Provenienta — teste de încredere (director de lucru: ' + W + ')');

await test('fără listă: „semnat, dar de un emitent necunoscut” + textul vechi despre lista C2PA rămâne', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  eq(await trustState(p), { sig: 'valid', trust: 'nolist', anchor: null });
  const tx = await text(p); assert(tx.includes('Semnat, dar de un emitent necunoscut') && tx.includes('nu ai încărcat nicio listă'), tx.slice(0, 700));
  assert(tx.includes('Emitentul NU este verificat față de lista de încredere C2PA'), 'nota veche păstrată fără listă');
  assert(await p.locator('#trust-empty').count() === 1 && await p.locator('#trust-clear').isDisabled(), 'listă goală, buton dezactivat');
  await p.close();
});

await test('import PEM al rădăcinii: lanțul se leagă de ancoră → „emitent din lista ta”; persistă după reîncărcare', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  await importCerts(p, [{ name: 'radacina.pem', buf: pem(rootA) }]);
  const st = await trustState(p); eq([st.sig, st.trust], ['valid', 'trusted']); assert(/Provenienta Synthetic Test Root CA/.test(st.anchor), st.anchor);
  const tx = await text(p); assert(tx.includes('Semnat de un emitent din lista ta de încredere') && tx.includes('Nu s-a verificat revocarea'), tx.slice(0, 900));
  assert(!tx.includes('Emitentul NU este verificat față de lista de încredere C2PA'), 'nota veche dispare când emitentul e în listă');
  eq(await p.locator('#trust tbody tr').count(), 1); assert(/1 certificate în listă/.test(await p.textContent('#trust-count')));
  await p.reload(); await p.waitForFunction(() => window.Provenienta.trust.list.length === 1); await loadBuf(p, signed, 'a.svg');
  eq((await trustState(p)).trust, 'trusted', 'lista persistă și după reîncărcare');
  await p.close();
});

await test('reevaluare imediată: la import/eliminare se actualizează rezultatul deja afișat; golirea listei', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  eq((await trustState(p)).trust, 'nolist');
  await importCerts(p, [{ name: 'alt.pem', buf: pem(otherRoot) }]);
  eq((await trustState(p)).trust, 'unknown'); assert((await text(p)).includes('niciun certificat din lista ta (1)'), 'mesaj cu lista nevidă');
  await importCerts(p, [{ name: 'radacina.der', buf: rootA }]); eq((await trustState(p)).trust, 'trusted', 'DER simplu acceptat');
  await p.locator('#trust tbody button', { hasText: 'Elimină' }).first().click(); await p.waitForTimeout(200);
  eq(await p.locator('#trust tbody tr').count(), 1); eq((await trustState(p)).trust, 'trusted', 'ancora corectă a rămas (prima eliminată era cea străină)');
  await p.click('#trust-clear'); await p.waitForTimeout(200);
  eq((await trustState(p)).trust, 'nolist'); assert(/golită/.test(await p.textContent('#trust-msg')));
  await p.close();
});

await test('certificat-frunză importat direct = ancoră (identic); pachet PEM cu mai multe certificate + gunoi + duplicate', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  const bundle = 'text liber înainte\n' + pem(otherRoot) + '\n-----BEGIN CERTIFICATE-----\n!!!nu-e-base64!!!\n-----END CERTIFICATE-----\n' + pem(leafA);
  await importCerts(p, [{ name: 'pachet.pem', buf: bundle }]);
  const msg = await p.textContent('#trust-msg'); assert(/Adăugate: 2/.test(msg) && /ilizibile: 1/.test(msg), msg);
  eq((await trustState(p)).trust, 'trusted', 'frunza identică cu o ancoră');
  await importCerts(p, [{ name: 'pachet.pem', buf: bundle }]); assert(/Adăugate: 0; deja în listă: 2/.test(await p.textContent('#trust-msg')), await p.textContent('#trust-msg'));
  await importCerts(p, [{ name: 'gunoi.txt', buf: 'nimic de aici' }]); assert(/ilizibile: 1/.test(await p.textContent('#trust-msg')));
  eq(await p.locator('#trust tbody tr').count(), 2);
  await p.close();
});

await test('lanț rupt sau semnătură invalidă: nu se acordă încredere chiar dacă rădăcina e în listă', async () => {
  const p = await openApp();
  const sg = S.makeSigner({ alg: 'ES256', cn: 'Rupt', chain: 'broken' });
  await importCerts(p, [{ name: 'r.pem', buf: pem(sg.certs[1]) }]);
  await loadBuf(p, S.signAsset('svg', baseSvg, { signer: sg, assertions: [S.actionsAssertion()] }).file, 'rupt.svg');
  const a = await trustState(p); eq([a.sig, a.trust], ['valid', 'broken']); assert(!(await text(p)).includes('Semnat de un emitent din lista ta'), 'fără încredere pentru lanț rupt');
  await importCerts(p, [{ name: 'a.pem', buf: pem(rootA) }]);
  await loadBuf(p, S.signAsset('svg', baseSvg, { signer: signerRoot, assertions: [S.actionsAssertion()], tamper: { sig: true } }).file, 'inv.svg');
  const b = await trustState(p); eq([b.sig, b.trust], ['invalid', 'na']); assert((await text(p)).includes('Încrederea în emitent nu se evaluează'), 'încredere neevaluată');
  await p.close();
});

await test('lanț fără rădăcină în x5chain (doar frunza) se închide prin emitentul din listă', async () => {
  const p = await openApp();
  const sg = S.makeSigner({ alg: 'ES256', cn: 'Doar frunza', chain: 'root' }); const only = { ...sg, certs: [sg.certs[0]] };
  await loadBuf(p, S.signAsset('svg', baseSvg, { signer: only, assertions: [S.actionsAssertion()] }).file, 'leaf.svg');
  eq((await trustState(p)).trust, 'nolist');
  await importCerts(p, [{ name: 'r.pem', buf: pem(sg.certs[1]) }]); const st = await trustState(p);
  eq(st.trust, 'trusted'); eq(await p.evaluate(() => window.Provenienta.state.res.A.manifests[0].trust.at), 0);
  await p.close();
});

await test('axa timpului: două manifeste, fiecare cu dată/semnatar/stare de încredere; comparare cu rând de încredere', async () => {
  const p = await openApp(); const sg2 = S.makeSigner({ alg: 'ES256', cn: 'Editor B', chain: 'root' });
  await importCerts(p, [{ name: 'a.pem', buf: pem(rootA) }]);
  const old = S.makeManifest({ signer: signerRoot, title: 'a.svg', assertions: [S.actionsAssertion({ source: S.SRC.capture })], hashAssertion: { label: 'c2pa.hash.data', cbor: { exclusions: [], alg: 'sha256', hash: Buffer.alloc(32), name: 'x' } } });
  const two = S.signAsset('svg', baseSvg, { signer: sg2, prior: [old.box], assertions: [S.actionsAssertion({ source: S.SRC.composite })] }).file;
  await loadBuf(p, two, 'doua.svg');
  eq(await p.locator('ol.tl > li').count(), 2); eq(await p.locator('ol.tl > li .tl-when').count(), 2);
  const first = await p.locator('ol.tl > li').nth(0).textContent(), second = await p.locator('ol.tl > li').nth(1).textContent();
  assert(/emitent în lista ta/.test(first), 'manifestul anterior (semnat de A) e în listă: ' + first.slice(0, 200)); assert(/emitent necunoscut/.test(second) && /Editor B/.test(second), 'cel activ e de la B, necunoscut: ' + second.slice(0, 200));
  await p.click('#mode-compare'); await loadBuf(p, signed, 'a.svg', 'A'); await loadBuf(p, two, 'doua.svg', 'B');
  const row = await p.locator('table.cmp tr', { hasText: 'Încredere în emitent' }).textContent(); assert(/emitent în lista ta/.test(row) && /emitent necunoscut/.test(row), row);
  await p.close();
});

await test('raport JSON/Markdown: trustListChecked, lista folosită (doar amprente) și starea emitentului', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  const dl = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = path.join(W, 'rep-' + sel.replace(/\W/g, '')); await d.saveAs(f); return fs.readFileSync(f, 'utf8'); };
  let rep = JSON.parse(await dl('#x-json-btn')); eq([rep.trustListChecked, rep.issuerTrust.state, rep.trustList.count], [false, 'nolist', 0]);
  await importCerts(p, [{ name: 'r.pem', buf: pem(rootA) }]);
  rep = JSON.parse(await dl('#x-json-btn')); eq([rep.trustListChecked, rep.issuerTrust.state, rep.trustList.count, rep.trustList.source], [true, 'trusted', 1, 'user-imported']);
  assert(/^[0-9a-f]{64}$/.test(rep.trustList.sha256[0]) && !JSON.stringify(rep).includes(Buffer.from(rootA).toString('base64').slice(0, 40)), 'doar amprenta, nu certificatul');
  const md = await dl('#x-md-btn'); assert(/Semnat de un emitent din lista ta de încredere/.test(md), md.slice(0, 600));
  await p.close();
});

await test('i18n: secțiunea de încredere este tradusă în toate cele 8 limbi (fără chei brute)', async () => {
  const p = await openApp(); await loadBuf(p, signed, 'a.svg');
  const exp = { ro: 'Lista ta de încredere (emitenți)', en: 'Your trust list (issuers)', fr: 'Votre liste de confiance (émetteurs)', it: 'La tua lista di fiducia (emittenti)', es: 'Tu lista de confianza (emisores)', pt: 'A sua lista de confiança (emissores)', hu: 'A te megbízhatósági listád (kibocsátók)', de: 'Ihre Vertrauensliste (Aussteller)' };
  const unk = { ro: 'Semnat, dar de un emitent necunoscut', en: 'Signed, but by an unknown issuer', de: 'Signiert, aber von einem unbekannten Aussteller' };
  for (const [l, v] of Object.entries(exp)) {
    await p.selectOption('#lang', l); await p.waitForTimeout(80); eq(await p.textContent('#trust-h'), v, l);
    const tx = await text(p); assert(!/\btrust_[a-z_]+\b/.test(tx), l + ' chei brute: ' + tx.slice(0, 200)); if (unk[l]) assert(tx.includes(unk[l]), l + ' semnat necunoscut');
  }
  await p.close();
});

await test('accesibilitate (axe) cu lista încărcată și rezultat afișat, luminos/întunecat', async () => {
  if (!AXE) throw new Error('axe-core lipsește (FFF_AXE / AXE_PATH)');
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  for (const scheme of ['light', 'dark']) {
    const c = await mkCtx({ colorScheme: scheme, bypassCSP: true }); const p = await openApp(c);
    await loadBuf(p, signed, 'a.svg'); await importCerts(p, [{ name: 'pachet.pem', buf: pem(rootA) + pem(otherRoot) }]);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); await p.waitForTimeout(3600);
    await p.evaluate(axeSrc); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
    assert(r.violations.length === 0, scheme + ': ' + r.violations.map((v) => v.id + ' x' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')).join('; '));
    await p.close(); await c.close();
  }
});

await test('final: versiune, 0 erori de pagină, 0 violări CSP, 0 cereri de rețea', async () => {
  const p = await openApp();
  assert(new RegExp(`v ${APP_JSON.version.replace(/\./g, '\\.')} · ${APP_JSON.updated}`).test(await p.textContent('#app-version')), 'versiune afișată');
  eq(await p.evaluate(() => window.__csp), []); await p.close();
  eq(pageErrors, [], 'erori de pagină'); eq(netReqs, [], 'cereri de rețea');
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' teste trecute' + (failed.length ? ', ' + failed.length + ' eșuate' : ''));
fs.rmSync(W, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
